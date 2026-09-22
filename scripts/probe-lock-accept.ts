/**
 * What a LOCK answers when its `Accept` is wrong.
 *
 * **The question.** A hand-written LOCK during another probe came back `423
 * Locked` on an object that, its owner said afterwards, was not locked. The
 * request had named `dataname=com.sap.adt.lock.Result` — capital `R`, and only
 * the one variant — where the library sends
 * `dataname=com.sap.adt.lock.result;q=0.8` together with
 * `…lock.result2;q=0.9`. A content-type refusal is normally `406`, so `423` for
 * a bad `Accept` would be surprising; the alternative is that the object really
 * was locked and the spelling was innocent. Nothing was logged at the time, so
 * neither answer was available — which is the whole reason this file exists.
 *
 * **The method.** One class of this run's own making, three LOCKs against it,
 * every exchange printed whole:
 *
 * 1. the `Accept` the library sends — the control that says the object is
 *    lockable at all, and gives the handle back so the rest is honest;
 * 2. the misspelt `dataname` from that probe;
 * 3. `application/json`, which this endpoint cannot possibly serve — what a
 *    genuine content-type refusal looks like here, in its own words.
 *
 * If 2 answers like 3, the spelling was the cause. If 2 answers like 1, it was
 * not, and a `423` means what it says.
 *
 * Package and transport come from `test-config.yaml` through the same resolver
 * the suites use. The class is created here and deleted here; nothing that
 * existed before this run is touched.
 *
 *   npx ts-node scripts/probe-lock-accept.ts [CLASS]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { ACCEPT_LOCK } from '../src/constants/contentTypes';
import { create as createClass } from '../src/core/class/create';
import { deleteClass } from '../src/core/class/delete';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testHelper = require('../src/__tests__/helpers/test-helper');

const say = (line = ''): void => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.log(line);
};

/** Status, headers and the body as it arrived — a summary is where the answer hides. */
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

function reportFailure(what: string, error: unknown): string {
  const carried = error as { response?: IAdtWireResponse; message?: string };
  say(`--- ${what} — THREW: ${carried?.message ?? String(error)}`);
  if (carried?.response) {
    report(`${what} — the answer it carried`, carried.response);
    return `${carried.response.status}`;
  }
  say();
  return 'no answer';
}

/** One LOCK with one `Accept`, reported whichever way it goes. */
async function lockWith(
  connection: IAbapConnection,
  className: string,
  what: string,
  accept: string,
): Promise<{ status: string; handle?: string }> {
  const url = `/sap/bc/adt/oo/classes/${className.toLowerCase()}?_action=LOCK&accessMode=MODIFY`;
  say(`[${what}]`);
  say(`    Accept: ${accept}`);
  try {
    const wire = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: 30000,
      data: null,
      headers: { Accept: accept },
    });
    report(`LOCK — ${what}`, wire);
    const handle = /<LOCK_HANDLE>([^<]*)</.exec(String(wire.data ?? ''))?.[1];
    return { status: String(wire.status), handle };
  } catch (error) {
    return { status: reportFailure(`LOCK — ${what}`, error) };
  }
}

async function unlock(
  connection: IAbapConnection,
  className: string,
  handle: string,
): Promise<void> {
  try {
    await connection.makeAdtRequest({
      url: `/sap/bc/adt/oo/classes/${className.toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(handle)}`,
      method: 'POST',
      timeout: 30000,
      data: null,
      headers: {},
    });
    say('    (unlocked)');
    say();
  } catch (error) {
    say(`    (unlock threw: ${(error as Error).message})`);
    say();
  }
}

async function main(): Promise<void> {
  const className = (process.argv[2] || 'ZAC_LOCKACC_PROBE').toUpperCase();
  const packageName = testHelper.resolvePackageName(undefined) ?? '';
  const transportRequest = testHelper.resolveTransportRequest(undefined) ?? '';
  if (!packageName) {
    say(
      'no package: set `default_package` in src/__tests__/helpers/test-config.yaml.',
    );
    process.exitCode = 1;
    return;
  }

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  // Only what this run created may be deleted.
  let ours = false;

  try {
    say(`probe-lock-accept — ${className} in ${packageName}`);
    say();

    say("[0] a class of this run's own");
    try {
      const wire = await createClass(connection, {
        class_name: className,
        package_name: packageName,
        description: 'Lock Accept probe (safe to delete)',
        transport_request: transportRequest || undefined,
      });
      say(`    create → status ${wire.status}`);
      ours = true;
    } catch (error) {
      reportFailure('create', error);
      say('cannot probe without an object this run owns.');
      process.exitCode = 1;
      return;
    }
    // A create answers before the object is readable on this system; the lock
    // below would meet a 404 otherwise, which would say nothing about `Accept`.
    await new Promise((r) => setTimeout(r, 6000));
    say();

    const control = await lockWith(
      connection,
      className,
      '1 — the Accept the library sends',
      ACCEPT_LOCK,
    );
    if (control.handle) await unlock(connection, className, control.handle);

    const misspelt = await lockWith(
      connection,
      className,
      '2 — the misspelt dataname from the other probe',
      'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result',
    );
    if (misspelt.handle) await unlock(connection, className, misspelt.handle);

    const absurd = await lockWith(
      connection,
      className,
      '3 — a type this endpoint cannot serve',
      'application/json',
    );
    if (absurd.handle) await unlock(connection, className, absurd.handle);

    say('VERDICT');
    say(`  1 (library's Accept):  ${control.status}`);
    say(`  2 (misspelt dataname): ${misspelt.status}`);
    say(`  3 (application/json):  ${absurd.status}`);
    say();
    if (misspelt.status === absurd.status && misspelt.status !== control.status)
      say('  2 answers like 3: the spelling was the cause.');
    else if (misspelt.status === control.status)
      say(
        '  2 answers like 1: the spelling was innocent, and a 423 meant what',
      );
    else say('  2 answers like neither — read the three bodies above.');
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
