/**
 * The debug cycle of `probe-debugger-cycle.ts`, through this library.
 *
 * Same probe class, same breakpoints, same order — but every debugger request
 * is a member of `AbapDebugger` instead of a hand-built `makeAdtRequest`. The
 * raw probe stays as the reference: when the two disagree, the library is
 * what changed.
 *
 *   MCP_ENV_PATH=<session>.env npx ts-node scripts/probe-debugger-cycle-client.ts
 *   ... --keep            leave the probe class in place
 *   ... --package <name>  package for the probe class (default: $TMP)
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import * as dotenv from 'dotenv';
import {
  closeOwnTestConnection,
  createTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtClient } from '../src/clients/AdtClient';
import { ClassExecutor } from '../src/executors/class/ClassExecutor';
import { AbapDebugger } from '../src/runtime/debugger/AbapDebugger';
import type {
  IDebuggerBreakpoint,
  IDebuggerIdentity,
  IDebuggerStepMethod,
} from '../src/runtime/debugger/contracts';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const CLASS_NAME = 'ZADT_DBG_PROBE';
const BODY_CHARS = Number(process.env.PROBE_BODY_CHARS ?? '300');
const LISTEN_SECONDS = Number(process.env.PROBE_LISTEN_SECONDS ?? '60');
const ARM_DELAY_MS = Number(process.env.PROBE_ARM_DELAY_MS ?? '2000');
const MAX_CONTINUES = Number(process.env.PROBE_MAX_CONTINUES ?? '8');

/** The same probe class as the raw probe; markers name the breakpoint lines. */
const SOURCE = `CLASS zadt_dbg_probe DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.
  PRIVATE SECTION.
    METHODS add
      IMPORTING iv_a TYPE i
                iv_b TYPE i
      RETURNING VALUE(rv) TYPE i.
ENDCLASS.

CLASS zadt_dbg_probe IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    DATA lv_total TYPE i.
    DATA lv_text TYPE string VALUE 'start'.
    DO 3 TIMES.
      lv_total = add( iv_a = lv_total iv_b = sy-index ). "BP:loop
    ENDDO.
    lv_text = |total { lv_total }|. "BP:after
    TRY.
        DATA(lv_zero) = 0.
        lv_total = lv_total / lv_zero.
      CATCH cx_sy_zerodivide.
        lv_text = 'caught'. "BP:catch
    ENDTRY.
    out->write( lv_text ).
  ENDMETHOD.

  METHOD add.
    rv = iv_a + iv_b. "BP:add
  ENDMETHOD.
ENDCLASS.
`;

function markerLines(): Record<string, number> {
  const lines: Record<string, number> = {};
  SOURCE.split('\n').forEach((text, index) => {
    const marker = /"BP:(\w+)/.exec(text);
    if (marker) lines[marker[1]] = index + 1;
  });
  return lines;
}

const started = Date.now();

function say(line: string): void {
  const seconds = ((Date.now() - started) / 1000).toFixed(1).padStart(6);
  process.stdout.write(`${seconds}s  ${line}\n`);
}

function clip(text: string): string {
  if (!text) return '';
  if (BODY_CHARS === 0) return `[${text.length} chars]`;
  return text.length > BODY_CHARS
    ? `${text.slice(0, BODY_CHARS)}… [${text.length} chars]`
    : text;
}

/**
 * Run one member and log its answer: the document on success, the status and
 * body the failure carries otherwise. The body comes back either way, which is
 * what the cycle reads.
 */
async function call(
  label: string,
  run: () => Promise<IAdtResponse<unknown>>,
): Promise<{ ok: boolean; body: string }> {
  const t0 = Date.now();
  const answer = await run();
  const ms = Date.now() - t0;
  if (answer.ok) {
    const body = String(answer.getResult().value ?? '');
    say(`${label} ok in ${ms} ms`);
    if (body) say(`${label}   ${clip(body)}`);
    return { ok: true, body };
  }
  const error = answer.getError();
  const body = String(error.response?.data ?? '');
  say(
    `${label} FAILED in ${ms} ms: ${error.response?.status ?? ''} ${error.message}`,
  );
  if (body) say(`${label}   ${clip(body)}`);
  return { ok: false, body };
}

function attr(xml: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
}

function tag(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];
}

function identityFor(): IDebuggerIdentity {
  const requestUser = String(process.env.SAP_USERNAME ?? '').toUpperCase();
  const seed = `${process.env.SAP_URL}:${requestUser}`;
  const id = (suffix: string): string =>
    createHash('sha256')
      .update(`${seed}:${suffix}`)
      .digest('hex')
      .slice(0, 32)
      .toUpperCase();
  return { requestUser, terminalId: id('terminalId'), ideId: id('ideId') };
}

async function deployProbeClass(
  connection: IAbapConnection,
  packageName: string,
): Promise<boolean> {
  const cls = new AdtClient(connection, createConnectionLogger()).getClass();
  const config = {
    className: CLASS_NAME,
    packageName,
    description: 'Debugger probe',
  };
  const created = await cls.create(config);
  if (!created.ok && !/exist/i.test(created.getError().message ?? '')) {
    say(`class create REFUSED: ${created.getError().message}`);
    return false;
  }
  const lock = await cls.lock(config);
  if (!lock.ok) {
    say(`class lock REFUSED: ${lock.getError().message}`);
    return false;
  }
  const lockHandle = String(lock.getResult().value ?? '');
  const written = await cls.update(config, { source: SOURCE, lockHandle });
  await cls.unlock(config, lockHandle);
  const activated = written.ok && (await cls.activate(config)).ok;
  say(
    `class ${created.ok ? 'created' : 'reused'}, activate ${activated ? 'ok' : 'FAILED'}`,
  );
  return activated;
}

/** Stack frames and the two-hop variable survey, as one stop's reading. */
async function readStop(debuggerApi: AbapDebugger): Promise<void> {
  const stack = await call('stack', () => debuggerApi.getStack());
  const top = /<stackEntry\b[^>]*>/.exec(stack.body)?.[0] ?? '';
  say(
    `stop   ${attr(top, 'programName')} ${attr(top, 'includeName')}:${attr(top, 'line')}`,
  );

  const root = await call('vars', () =>
    debuggerApi.getChildVariables(['@ROOT']),
  );
  const scopes = [...root.body.matchAll(/<CHILD_ID>([^<]*)<\/CHILD_ID>/g)].map(
    (m) => m[1],
  );
  if (scopes.length === 0) return;
  const all = await call('vars', () => debuggerApi.getChildVariables(scopes));
  for (const row of all.body.matchAll(
    /<STPDA_ADT_VARIABLE>([\s\S]*?)<\/STPDA_ADT_VARIABLE>/g,
  )) {
    const name = tag(row[1], 'NAME') ?? '';
    if (name.startsWith('LV_')) say(`vars   ${name} = ${tag(row[1], 'VALUE')}`);
  }
}

function ended(answer: { ok: boolean; body: string }): boolean {
  return answer.ok
    ? /isSteppingPossible="false"/.test(answer.body)
    : /debuggeeEnded|noSessionAttached|DEBUGGEE_ENDED/.test(answer.body);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const keep = args.includes('--keep');
  const packageIndex = args.indexOf('--package');
  const packageName = packageIndex >= 0 ? args[packageIndex + 1] : '$TMP';

  const logger = createConnectionLogger();
  const debuggerConnection = await createTestConnection(logger, {
    ownSession: true,
  });
  const triggerConnection = await createTestConnection(logger, {
    ownSession: true,
  });
  const debuggerApi = new AbapDebugger(debuggerConnection, logger);

  try {
    if (!(await deployProbeClass(debuggerConnection, packageName))) return;
    const lines = markerLines();
    const identity = identityFor();
    const source = `/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main`;
    const breakpoints: IDebuggerBreakpoint[] = [
      { kind: 'line', uri: `${source}#start=${lines.loop}` },
      { kind: 'line', uri: `${source}#start=${lines.catch}` },
      { kind: 'exception', exceptionClass: 'CX_SY_ZERODIVIDE' },
    ];

    // The debugger's session is stateful for the whole cycle — the caller's call.
    debuggerConnection.setSessionType('stateful');

    await call('bp-validate', () =>
      debuggerApi.setBreakpoints(identity, breakpoints, {
        validationOnly: true,
      }),
    );
    const armed = await call('bp-arm', () =>
      debuggerApi.setBreakpoints(identity, breakpoints),
    );
    const owned = [
      ...armed.body.matchAll(/<breakpoint\b[^>]*\bid="([^"]*)"/g),
    ].map((m) => m[1]);
    say(`armed ${owned.length}: ${owned.join(' | ')}`);

    const listener = call('listener', () =>
      debuggerApi.listen(identity, { holdSeconds: LISTEN_SECONDS }),
    );
    await new Promise((resolve) => setTimeout(resolve, ARM_DELAY_MS));
    // The run, on the other session: classrun through the class executor.
    // It stays open while the debuggee is suspended.
    const trigger = call('trigger', () =>
      new ClassExecutor(triggerConnection, logger).run({
        className: CLASS_NAME,
      }),
    );

    const caught = await listener;
    const debuggeeId = tag(caught.body, 'DEBUGGEE_ID');
    let attached = false;
    let done = false;
    if (debuggeeId) {
      say(
        `caught ${tag(caught.body, 'DBGEE_KIND')} at ${tag(caught.body, 'URI')}`,
      );
      const attach = await call('attach', () =>
        debuggerApi.attach(identity.requestUser, debuggeeId),
      );
      attached = attach.ok;
    } else {
      say('nothing was caught');
    }

    if (attached) {
      await readStop(debuggerApi);
      const plan: IDebuggerStepMethod[] = [
        'stepInto',
        'stepReturn',
        ...Array<IDebuggerStepMethod>(MAX_CONTINUES).fill('stepContinue'),
      ];
      for (const method of plan) {
        const answer = await call(method, () => debuggerApi.step(method));
        if (ended(answer)) {
          say(`debuggee ended on ${method}`);
          done = true;
          break;
        }
        await readStop(debuggerApi);
      }
    }

    for (const id of owned) {
      await call('bp-delete', () => debuggerApi.deleteBreakpoint(identity, id));
    }
    if (attached && !done) {
      await call('terminate', () => debuggerApi.terminateDebuggee());
    }
    await call('listener-delete', () => debuggerApi.stopListener(identity));
    debuggerConnection.setSessionType('stateless');

    const run = await trigger;
    say(`trigger settled: ${run.ok ? 'ok' : 'failed'} ${clip(run.body)}`);
  } finally {
    if (!keep) {
      const deleted = await new AdtClient(debuggerConnection, logger)
        .getClass()
        .delete({ className: CLASS_NAME, packageName });
      say(
        `class delete ${deleted.ok ? 'ok' : `REFUSED: ${deleted.getError().message}`}`,
      );
    }
    await closeOwnTestConnection(triggerConnection);
    await closeOwnTestConnection(debuggerConnection);
  }
}

main().catch((error) => {
  say(`FAILED: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
