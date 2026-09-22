/**
 * Activation, one step at a time, with the whole of what SAP said.
 *
 * **Why a stepwise probe and not another script that runs end to end.** The
 * question is whether ADT's activation of a single object is finished when its
 * POST answers, and the only independent witness is a human looking at the same
 * object in Eclipse between the steps. A script that does everything in one
 * breath leaves no moment to look. So each step is its own command, run when
 * the person on the other side is ready, and every step prints the full
 * exchange — status, headers, body, untruncated — because a summary is where
 * the interesting part goes missing.
 *
 * The object is a class of its own, cheap to throw away. Where it is written —
 * the package, and the transport if that package needs one — comes from
 * `test-config.yaml` through the same resolver the suites use, never from a
 * literal here.
 *
 *   npx ts-node scripts/probe-activation-steps.ts create   ZAC_ACT_PROBE
 *   npx ts-node scripts/probe-activation-steps.ts look     ZAC_ACT_PROBE
 *   npx ts-node scripts/probe-activation-steps.ts write    ZAC_ACT_PROBE
 *   npx ts-node scripts/probe-activation-steps.ts activate ZAC_ACT_PROBE
 *   npx ts-node scripts/probe-activation-steps.ts delete   ZAC_ACT_PROBE
 *
 * `look` reads four things and says what each one answered: the inactive
 * objects list, the class's metadata document, and its source in BOTH versions
 * — active and inactive. The pair is the point. A class that has been written
 * and not activated holds two different sources, and the moment the activation
 * lands is the moment they become one.
 *
 * `activate` times the POST from the client's side, prints `x-sap-adt-profiling`
 * (the server's own time, in microseconds) and reads the inactive list again
 * immediately, stamping every line so the two sides can be lined up against
 * what Eclipse showed.
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
import { activateClass } from '../src/core/class/activation';
import { create as createClass } from '../src/core/class/create';
import { deleteClass } from '../src/core/class/delete';
import { lockClass } from '../src/core/class/lock';
import { getClassMetadata, getClassSource } from '../src/core/class/read';
import { unlockClass } from '../src/core/class/unlock';
import { updateClass } from '../src/core/class/update';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Package and transport come from `test-config.yaml`, through the same
// resolver the suites use — never from a literal in a script. A probe that
// invents a package writes objects somewhere nobody configured, and the
// configuration is where this repository states what may be written to.
const testHelper = require('../src/__tests__/helpers/test-helper');
const fromConfig = (): { packageName: string; transportRequest: string } => ({
  packageName: testHelper.resolvePackageName(undefined) ?? '',
  transportRequest: testHelper.resolveTransportRequest(undefined) ?? '',
});

const CONFIGURED = fromConfig();
const PACKAGE = process.env.PROBE_PACKAGE || CONFIGURED.packageName;
// A configured package may require a transport, and then a create without one
// is refused before it starts. Taken from the same configuration as the
// package, for the same reason: where an object may be written, and under which
// request, is the configuration's to state.
const TRANSPORT = process.env.PROBE_TRANSPORT || CONFIGURED.transportRequest;

const say = (line = ''): void => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.log(line);
};

/** Wall-clock, to the millisecond, so a step can be lined up against Eclipse. */
const stamp = (): string => new Date().toISOString();

/**
 * The whole exchange, and nothing summarised.
 *
 * A body is printed as it arrived. It is XML from a server that knows what it
 * is doing, and the one thing a reader cannot recover is the part a script
 * decided was not worth showing.
 */
function report(what: string, wire: IAdtWireResponse, ms?: number): void {
  say(`--- ${what}${ms === undefined ? '' : ` (${ms}ms)`}`);
  say(`    status: ${wire.status} ${wire.statusText ?? ''}`.trimEnd());
  const headers = (wire.headers ?? {}) as Record<string, string>;
  for (const [key, value] of Object.entries(headers)) {
    say(`    ${key}: ${value}`);
  }
  const body = typeof wire.data === 'string' ? wire.data : String(wire.data);
  say(`    body (${body.length} chars):`);
  say(body === '' ? '    <empty>' : body);
  say();
}

/** The same for a step that threw: a refusal is an answer and gets printed too. */
function reportFailure(what: string, error: unknown): void {
  const carried = error as { response?: IAdtWireResponse; message?: string };
  say(`--- ${what} — THREW`);
  say(`    ${carried?.message ?? String(error)}`);
  if (carried?.response)
    report(`${what} — the answer it carried`, carried.response);
  say();
}

async function inactiveList(connection: IAbapConnection): Promise<void> {
  const wire = await connection.makeAdtRequest({
    method: 'GET',
    url: '/sap/bc/adt/activation/inactiveobjects',
    timeout: 30000,
    headers: {
      Accept:
        'application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8',
    },
  });
  report('GET /sap/bc/adt/activation/inactiveobjects', wire);
}

async function look(
  connection: IAbapConnection,
  className: string,
): Promise<void> {
  await inactiveList(connection);

  for (const [what, run] of [
    [
      `GET metadata /sap/bc/adt/oo/classes/${className.toLowerCase()}`,
      () => getClassMetadata(connection, className),
    ],
    [
      'GET source ?version=active',
      () => getClassSource(connection, className, 'active'),
    ],
    [
      'GET source ?version=inactive',
      () => getClassSource(connection, className, 'inactive'),
    ],
  ] as Array<[string, () => Promise<IAdtWireResponse>]>) {
    try {
      report(what, await run());
    } catch (error) {
      reportFailure(what, error);
    }
  }
}

const SOURCE = (className: string): string =>
  `CLASS ${className.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS say_when RETURNING VALUE(rv_when) TYPE string.
ENDCLASS.

CLASS ${className.toLowerCase()} IMPLEMENTATION.
  METHOD say_when.
    rv_when = '${stamp()}'.
  ENDMETHOD.
ENDCLASS.
`;

async function main(): Promise<void> {
  const [step, nameArg] = process.argv.slice(2);
  const className = (nameArg || 'ZAC_ACT_PROBE').toUpperCase();
  if (!step) {
    say(
      'usage: probe-activation-steps.ts create|look|write|activate|delete [CLASS]',
    );
    process.exitCode = 1;
    return;
  }

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);

  try {
    say(`=== ${step} ${className} — ${stamp()}`);
    // Only the create places the object, so only the create names a package.
    // Printing it on every step said `$TMP` above an activation that had
    // nothing to do with a package, which is a log that misleads its reader.
    if (step === 'create')
      say(
        `    package ${PACKAGE}, transport ${TRANSPORT || '(none configured)'}`,
      );
    say();

    if (step === 'create' && !PACKAGE) {
      say('no package: set PROBE_PACKAGE, or `default_package` in');
      say('src/__tests__/helpers/test-config.yaml. This probe will not guess.');
      process.exitCode = 1;
    } else if (step === 'create') {
      // No activation, by design: the object is left inactive so the next step
      // can be watched from both sides.
      try {
        const started = Date.now();
        const wire = await createClass(connection, {
          class_name: className,
          package_name: PACKAGE,
          description: 'Activation probe (safe to delete)',
          transport_request: TRANSPORT || undefined,
        });
        report('POST /sap/bc/adt/oo/classes', wire, Date.now() - started);
      } catch (error) {
        reportFailure('POST /sap/bc/adt/oo/classes', error);
      }
      await inactiveList(connection);
    } else if (step === 'look') {
      await look(connection, className);
    } else if (step === 'write') {
      // A created class is a skeleton; this puts real source in it and still
      // does not activate, so the active and inactive versions differ and the
      // activation below has something to do that can be seen.
      let handle: string | undefined;
      try {
        const started = Date.now();
        handle = await lockClass(connection, className);
        say(`--- LOCK (${Date.now() - started}ms): handle ${handle}`);
        say();
      } catch (error) {
        reportFailure('LOCK', error);
        return;
      }
      try {
        const started = Date.now();
        const wire = await updateClass(
          connection,
          className,
          SOURCE(className),
          handle,
        );
        report('PUT .../source/main', wire, Date.now() - started);
      } catch (error) {
        reportFailure('PUT .../source/main', error);
      } finally {
        try {
          await unlockClass(connection, className, handle);
          say('--- UNLOCK: done');
          say();
        } catch (error) {
          reportFailure('UNLOCK', error);
        }
      }
      await inactiveList(connection);
    } else if (step === 'activate') {
      say(`    POST sent at ${stamp()}`);
      const started = Date.now();
      try {
        const wire = await activateClass(connection, className);
        const ms = Date.now() - started;
        say(`    answer back at ${stamp()}`);
        report('POST /sap/bc/adt/activation?method=activate', wire, ms);
      } catch (error) {
        say(`    threw at ${stamp()} after ${Date.now() - started}ms`);
        reportFailure('POST /sap/bc/adt/activation?method=activate', error);
      }
      say(`    reading the inactive list at ${stamp()}`);
      await inactiveList(connection);
    } else if (step === 'delete') {
      try {
        const wire = await deleteClass(connection, {
          class_name: className,
          transport_request: TRANSPORT || undefined,
        });
        report('DELETE the class', wire);
      } catch (error) {
        reportFailure('DELETE the class', error);
      }
    } else {
      say(`unknown step: ${step}`);
      process.exitCode = 1;
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  say(`probe failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
