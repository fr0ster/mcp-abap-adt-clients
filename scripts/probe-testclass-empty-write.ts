/**
 * What an empty write to a class's `testclasses` include actually does.
 *
 * **The question.** `AdtLocalTestClass.delete()` is `update({ testClassCode:
 * '' })`, and that is the right shape: a class include is not an object, it is
 * a section of the class document, and ADT offers no DELETE for one — unlike a
 * program include (`PROG/I`) or a function group's include, both of which have
 * a real deletion and are removed when needed. What had never been measured is
 * whether the server accepts the empty body and what the include reads back as
 * afterwards. Two earlier attempts died before the question — `423` on a class
 * someone else held, then `404` on a class assembled from hand-written XML.
 *
 * So this uses the library's own create, waits for the object to settle, and
 * prints every exchange whole: status, headers, body. The class is created here
 * and deleted here.
 *
 *   npx ts-node scripts/probe-testclass-empty-write.ts [CLASS]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtClient } from '../src/clients/AdtClient';
import { create as createClass } from '../src/core/class/create';
import { deleteClass } from '../src/core/class/delete';
import { updateClassTestInclude } from '../src/core/class/testclasses';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testHelper = require('../src/__tests__/helpers/test-helper');

const say = (line = ''): void => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.log(line);
};

function report(what: string, wire: IAdtWireResponse): void {
  say(`--- ${what}`);
  say(`    status: ${wire.status} ${wire.statusText ?? ''}`.trimEnd());
  const headers = (wire.headers ?? {}) as Record<string, string>;
  for (const [k, v] of Object.entries(headers)) say(`    ${k}: ${v}`);
  const body = typeof wire.data === 'string' ? wire.data : String(wire.data);
  say(`    body (${body.length} chars):`);
  say(body === '' ? '    <empty>' : body);
  say();
}

function reportFailure(what: string, error: unknown): void {
  const carried = error as { response?: IAdtWireResponse; message?: string };
  say(`--- ${what} — THREW: ${carried?.message ?? String(error)}`);
  if (carried?.response)
    report(`${what} — the answer it carried`, carried.response);
  say();
}

const TESTS = `CLASS ltc_probe DEFINITION FOR TESTING RISK LEVEL HARMLESS DURATION SHORT.
  PRIVATE SECTION.
    METHODS one FOR TESTING.
ENDCLASS.

CLASS ltc_probe IMPLEMENTATION.
  METHOD one.
  ENDMETHOD.
ENDCLASS.
`;

async function main(): Promise<void> {
  const className = (process.argv[2] || 'ZAC_EMPTYW_PROBE').toUpperCase();
  const packageName = testHelper.resolvePackageName(undefined) ?? '';
  const transportRequest = testHelper.resolveTransportRequest(undefined) ?? '';
  if (!packageName) {
    say('no package: set `default_package` in test-config.yaml.');
    process.exitCode = 1;
    return;
  }

  const uri = `/sap/bc/adt/oo/classes/${className.toLowerCase()}`;
  const logger = createConnectionLogger();
  const connection: IAbapConnection = await createTestConnection(logger);
  const client = new AdtClient(connection, logger);
  let ours = false;

  const readInclude = async (what: string): Promise<void> => {
    try {
      report(
        `GET ${uri}/includes/testclasses — ${what}`,
        await connection.makeAdtRequest({
          url: `${uri}/includes/testclasses`,
          method: 'GET',
          timeout: 30000,
          headers: { Accept: 'text/plain' },
        }),
      );
    } catch (error) {
      reportFailure(`GET includes/testclasses — ${what}`, error);
    }
  };

  const write = async (what: string, source: string): Promise<void> => {
    // **The lock goes through the library, the write does not.** Only the PUT
    // is being measured, so only the PUT is issued by hand; everything around
    // it is the library's, because the library is where the rules live. A
    // first version hand-rolled the lock too and took it from a stateless
    // request: the server answered 200 with a handle that was already dead,
    // and the next call came back `423 ExceptionResourceInvalidLockHandle`,
    // `SADT_RESOURCE/026` — indistinguishable from somebody else holding the
    // object, and blamed on two innocent parties before the body was read.
    // `lockTestClasses` runs the LOCK inside `inStatefulSession`, which is the
    // whole difference.
    let handle = '';
    try {
      // The consumer's own sequence: the CLASS is locked and the handle is
      // passed down to the include's write. `AdtClass.lock` runs the LOCK
      // inside `inStatefulSession`, which is the part a hand-rolled request
      // silently skipped.
      const locked = await client.getClass().lock({ className });
      if (!locked.ok) {
        say(`--- LOCK refused: ${locked.getError().message}`);
        return;
      }
      handle = locked.getResult().value;
      say(`--- LOCK (getClass().lock) — ${what}: handle ${handle}`);
      say();
    } catch (error) {
      reportFailure(`LOCK — ${what}`, error);
      return;
    }
    try {
      report(
        `PUT includes/testclasses — ${what} (${source.length} chars)`,
        await updateClassTestInclude(
          connection,
          className,
          source,
          handle,
          transportRequest || undefined,
        ),
      );
    } catch (error) {
      reportFailure(`PUT includes/testclasses — ${what}`, error);
    } finally {
      try {
        await client.getClass().unlock({ className }, handle);
      } catch (error) {
        say(`    (unlock threw: ${(error as Error).message})`);
      }
    }
  };

  try {
    say(`probe-testclass-empty-write — ${className} in ${packageName}`);
    say();

    say('[0] create the class with the library, then let it settle');
    try {
      const wire = await createClass(connection, {
        class_name: className,
        package_name: packageName,
        description: 'Empty-write probe (safe to delete)',
        transport_request: transportRequest || undefined,
      });
      say(`    create → status ${wire.status}`);
      ours = true;
    } catch (error) {
      reportFailure('create', error);
      process.exitCode = 1;
      return;
    }
    await new Promise((r) => setTimeout(r, 8000));
    say();

    say('[1] the include as the create left it');
    await readInclude('after create');

    say('[2] write a real local test class');
    await write('real source', TESTS);
    await readInclude('after the real write');

    say('[3] write an EMPTY body — what delete() does');
    await write('empty', '');
    await readInclude('after the empty write');
  } finally {
    if (ours) {
      try {
        const gone = await deleteClass(connection, {
          class_name: className,
          transport_request: transportRequest || undefined,
        });
        say(`[cleanup] delete → status ${gone.status}`);
      } catch (error) {
        say(`[cleanup] delete threw — ${(error as Error).message}`);
      }
    }
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  say(`probe failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
