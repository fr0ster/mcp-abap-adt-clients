/**
 * The 17.0.0 contract, against a real system.
 *
 * Everything about the response contract is covered by unit tests with stubs,
 * and stubs prove one thing only: that the library does what I told it to do
 * with a document I wrote. Three questions survive that and need a server:
 *
 * 1. **Does SAP's refusal reach the caller as a refusal?** The stub sends an
 *    `<exc:exception>` document because that is what I believe SAP sends. A real
 *    system is the only thing that can say whether this library recognises the
 *    real one — and if it does not, every `create` that used to answer
 *    `errors: []` still does, with a green unit suite either side of it.
 * 2. **Is the successful half still whole?** A migration that wraps 780 call
 *    sites can lose a field quietly, and only a real payload has fields to lose.
 * 3. **Does the error carry enough to act on?** `origin` decides which system a
 *    caller goes to look at, and it is chosen from what the server actually
 *    sends rather than from what the stub does.
 *
 * The negative cases here are the point. A suite that only asks for things that
 * exist proves the library can read an answer, never that it can recognise a
 * "no" — and "no" reported as an empty result is the defect this release exists
 * to fix.
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/shared/responseContract
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAdtError,
  IAnalyse,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { expectResult } from '../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestSkip, logTestStep } from '../../helpers/testProgressLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

/**
 * A name no system has. Not a constant anyone might create by accident, and not
 * read from configuration — the whole point is that the server has never heard
 * of it, which is a property of the name rather than of the system.
 */
const NEVER_EXISTS = 'ZZ_NO_SUCH_OBJECT_ZZ';

describe('Response contract - 17.0.0', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolved } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolved;
      hasConfig = true;
    } catch (error) {
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  }, 120000);

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  describe('the successful half', () => {
    it('answers ok, and the result is the member’s own contract', async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'answers ok, and the result is the member’s own contract',
          'No SAP configuration',
        );
        return;
      }
      logTestStep('search for objects that exist', testsLogger);

      const answer = await client.getUtils().search({ query: 'CL_ABAP*' });

      expect(answer.ok).toBe(true);
      if (!answer.ok) {
        throw new Error(`expected a result: ${answer.getError().message}`);
      }

      const hits = answer.getResult().value;
      expect(Array.isArray(hits)).toBe(true);
      expect(hits.length).toBeGreaterThan(0);

      // A migration that wraps 780 call sites can drop a field and stay green.
      // These are the ones a caller reads.
      expect(typeof hits[0].name).toBe('string');
      expect(typeof hits[0].type).toBe('string');
      testsLogger.info?.(`✅ ${hits.length} hits, first: ${hits[0].name}`);
    }, 60000);

    it('has no error on the successful half', async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'has no error on the successful half',
          'No SAP configuration',
        );
        return;
      }

      const answer = await client.getUtils().getAllTypes(50);

      expect(answer.ok).toBe(true);
      if (!answer.ok) {
        throw new Error(`expected a result: ${answer.getError().message}`);
      }
      // The union's other guarantee, and the one a caller relies on when they
      // branch: the success half declares no `getError` at all, so reaching for
      // one does not compile. Asserted here as the runtime shape, since the
      // compile-time half is what the narrowing above already proves.
      expect('getError' in answer).toBe(false);
    }, 60000);
  });

  describe('the failing half — what a stub cannot prove', () => {
    it('recognises a refusal about an object the server has never heard of', async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'recognises a refusal about an object the server has never heard of',
          'No SAP configuration',
        );
        return;
      }
      logTestStep(`read metadata for ${NEVER_EXISTS}`, testsLogger);

      const answer = await client
        .getUtils()
        .readObjectMetadata('class', NEVER_EXISTS);

      // Before 17.0.0 this same call could answer 200 with an exception document
      // and be stored as a result. If this assertion fails, that is still what
      // happens — the unit tests cannot tell, because they send the document I
      // wrote rather than the one this system sends.
      expect(answer.ok).toBe(false);
      if (answer.ok) {
        throw new Error(
          'the server answered a result for an object that does not exist — ' +
            'the refusal was not recognised',
        );
      }

      const failure = answer.getError();
      testsLogger.info?.(
        `📛 origin=${failure.origin} adtType=${failure.adtType ?? '—'}`,
      );
      testsLogger.info?.(`📛 message: ${failure.message}`);

      // Not "something went wrong": `origin` is what tells a caller which system
      // to go and look at.
      expect(['refusal', 'connection', 'parse']).toContain(failure.origin);
      expect(failure.message.length).toBeGreaterThan(0);

      // And the caller must be able to locate it. `create()` issues six calls;
      // "object is locked" means a different thing depending on which asked.
      expect(failure.request?.url).toContain('/sap/bc/adt/');
    }, 60000);

    it('says what SAP said, not what this library guessed', async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'says what SAP said, not what this library guessed',
          'No SAP configuration',
        );
        return;
      }

      const answer = await client
        .getUtils()
        .readObjectSource('class', NEVER_EXISTS);

      expect(answer.ok).toBe(false);
      if (answer.ok) throw new Error('expected a refusal');

      const failure = answer.getError();

      // The document, verbatim, wherever one arrived. A message this library
      // invented would pass a weaker assertion and tell the caller nothing they
      // can act on — which is what the old "may be locked by another user" did.
      if (failure.response) {
        expect(typeof failure.response.status).toBe('number');
        testsLogger.info?.(
          `📄 status=${failure.response.status}, ${String(failure.response.data ?? '').length} bytes`,
        );
      }

      // Two origins, and no `cause`. interfaces 31.0.0 removed both the third
      // origin and the thrown error behind the failure: `parse` described this
      // library failing to read a document, which is not a verdict about the
      // server, and `cause` published what it had thrown internally.
      expect(['connection', 'refusal']).toContain(failure.origin);
    }, 60000);

    it('a package that does not exist is not an empty package', async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'a package that does not exist is not an empty package',
          'No SAP configuration',
        );
        return;
      }
      logTestStep(`node structure for ${NEVER_EXISTS}`, testsLogger);

      const answer = await client
        .getUtils()
        .fetchNodeStructure('DEVC/K', NEVER_EXISTS);

      // The sharpest case in this file, and since 19.0.0 it is a statement
      // about the endpoint rather than about a verdict this package gives.
      //
      // `/repository/nodestructure` answers 200 with an **empty body** for a
      // package that does not exist, and 200 with a tree for one that does.
      // "There is nothing in it" and "there is no such thing" arrive
      // byte-identical, so nothing below the caller can tell them apart — which
      // is how a logon page from an expired session once read as an empty
      // package.
      //
      // The walk that used to raise for this left with the other multi-request
      // members. A caller who needs the distinction makes it here, on the body,
      // and `scripts/lib/packageWalk.ts` shows one doing exactly that.
      expect(answer.ok).toBe(true);
      if (!answer.ok) throw new Error('expected an answer to read');

      const body = String(
        (answer.getResult().value as { data?: unknown })?.data ?? '',
      );
      expect(body.trim().length).toBe(0);
      testsLogger.info?.(
        `📛 ${NEVER_EXISTS} answered 200 with ${body.length} bytes — absence and emptiness are the same document`,
      );
    }, 60000);
  });

  describe('the per-type handlers', () => {
    it('never reports an object that does not exist as one that does', async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'never reports an object that does not exist as one that does',
          'No SAP configuration',
        );
        return;
      }
      logTestStep(`read class ${NEVER_EXISTS}`, testsLogger);

      const answer = await client.getClass().read({ className: NEVER_EXISTS });

      // **Two shapes, both honest, and which one you get is the system's.**
      // Some systems answer a read for an object that is not there with 200 and
      // an empty body; others 404 it. Measured on the cloud trial: a class that
      // does not exist at all is refused, while a class that exists without an
      // active version answers the empty body. This library does not paper over
      // the difference — whether an empty body *is* absence is the caller's
      // `analyse` to decide, and a status the transport refused is a failure.
      //
      // What must never happen is the third thing: a populated result for an
      // object nobody has. That is what this asserts.
      if (answer.ok) {
        const source = answer.getResult().value;
        testsLogger.info?.(
          `📄 absence reached the caller as an empty read (${String(source).length} bytes)`,
        );
        expect(String(source)).toBe('');
      } else {
        const failure = answer.getError();
        testsLogger.info?.(
          `📛 absence reached the caller as [${failure.origin}] ${failure.message}`,
        );
        expect(failure.message.length).toBeGreaterThan(0);
        expect(['connection', 'refusal']).toContain(failure.origin);
      }
    }, 60000);

    it('hands a refusal on a write to the caller, who names it', async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'hands a refusal on a write to the caller, who names it',
          'No SAP configuration',
        );
        return;
      }
      logTestStep(`activate ${NEVER_EXISTS}`, testsLogger);

      // **This is what 19.0.0 changed, and the assertion is the change.**
      //
      // ADT answers a failed activation with `200` and a checklist carrying
      // `<msg type="E">`. Until 19.0.0 this package read that document and
      // called it a failure. It no longer reads bodies at all, so the exchange
      // arrives as a success carrying the checklist, and whether the checklist
      // means "not activated" is the caller's to decide.
      const unjudged = await client
        .getClass()
        .activate({ className: NEVER_EXISTS });

      expect(unjudged.ok).toBe(true);
      if (!unjudged.ok) throw new Error('expected the answer, not a verdict');
      const document = String(unjudged.getResult().value ?? '');
      expect(document.length).toBeGreaterThan(0);

      // And here the caller decides, with the strategy this package stopped
      // shipping. A consumer builds theirs from their own corpus of answers;
      // this one is deliberately crude, because its shape is not the point.
      const refusalIsAFailure: IAnalyse<IAdtError> = (verdict, answer) =>
        /type="?E"?/.test(String(answer?.data ?? ''))
          ? { origin: 'refusal', message: String(answer?.data ?? '') }
          : verdict;

      const judged = await client
        .getClass()
        .activate({ className: NEVER_EXISTS }, { analyse: refusalIsAFailure });

      expect(judged.ok).toBe(false);
      if (judged.ok) throw new Error('expected the caller to decide');
      const failure = judged.getError();
      expect(failure.origin).toBe('refusal');
      expect(failure.message.length).toBeGreaterThan(0);
    }, 60000);
  });
});
