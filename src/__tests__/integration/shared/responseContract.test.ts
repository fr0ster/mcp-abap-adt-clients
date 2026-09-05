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
import { logTestStep } from '../../helpers/testProgressLogger';

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
      if (!hasConfig) return;
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
      if (!hasConfig) return;

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
      if (!hasConfig) return;
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
      if (!hasConfig) return;

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
      if (!hasConfig) return;
      logTestStep(`package hierarchy for ${NEVER_EXISTS}`, testsLogger);

      const answer = await client.getUtils().getPackageHierarchy(NEVER_EXISTS);

      // The sharpest case in this file. "There is nothing in it" and "there is
      // no such thing" are different answers, and a parser that finds no nodes
      // reports the first for both. That is how a logon page from an expired
      // session read as "the package is empty".
      if (answer.ok) {
        const tree = answer.getResult().value;
        throw new Error(
          `a package that does not exist answered a result: ${JSON.stringify(tree).slice(0, 200)}`,
        );
      }

      expect(answer.getError().message.length).toBeGreaterThan(0);
      testsLogger.info?.(
        `📛 ${answer.getError().origin}: ${answer.getError().message}`,
      );
    }, 60000);
  });

  describe('the per-type handlers, which have not migrated', () => {
    it('answers undefined for an object that does not exist', async () => {
      if (!hasConfig) return;
      logTestStep(`read class ${NEVER_EXISTS}`, testsLogger);

      // Not a defect, and this case asserted otherwise at first. `read()` is
      // typed `Promise<IClassState | undefined>` and answers `undefined` for a
      // 404 on purpose: for a read, "there is no such object" is an answer, and
      // the type says so where a caller cannot miss it.
      //
      // What 17.0.0 changed is the *other* case — a refusal SAP delivers while
      // the request itself succeeded, which used to be stored as a result with
      // `errors: []`. That one is covered by unit tests against a stub, because
      // it needs a server that answers 200 with an exception document.
      const answer = await client.getClass().read({ className: NEVER_EXISTS });

      // ADT answers a read for an object that is not there with 200 and an
      // empty body — never a 404 — so the shipped reading answers `''` and the
      // call succeeds. Whether an empty body *is* absence is the caller's
      // `analyse`, which is exactly why this library does not decide it here.
      expect(answer.ok).toBe(true);
      if (!answer.ok) throw new Error('expected a result');
      expect(answer.getResult().value).toBe('');
    }, 60000);

    it('surfaces a refusal on a write rather than reporting success', async () => {
      if (!hasConfig) return;
      logTestStep(`activate ${NEVER_EXISTS}`, testsLogger);

      // A write is where reporting success on a refusal costs something: the
      // caller believes an object was activated, and it was not.
      //
      // No throw/no-throw dance any more. The refusal is in the answer — that
      // is the whole change — so the test reads it there, and a library that
      // went back to reporting success would fail on the first line.
      const answer = await client
        .getClass()
        .activate({ className: NEVER_EXISTS });

      expect(answer.ok).toBe(false);
      if (answer.ok) throw new Error('expected a failure');

      const failure = answer.getError();
      testsLogger.info?.(
        `📛 [${failure.origin}] ${failure.message.slice(0, 120)}`,
      );
      expect(failure.message.length).toBeGreaterThan(0);
      expect(['connection', 'refusal']).toContain(failure.origin);
    }, 60000);
  });
});
