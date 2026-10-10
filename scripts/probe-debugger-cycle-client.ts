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
 *   ... --deploy          only create and activate the probe class, and leave it
 *   ... --run-only        only run the class: no breakpoints, no listener of ours
 *   ... --take-over       let our listener displace another one of the same user
 *   ... --package <name>  package for the probe class (default: $TMP)
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAdtResponse,
  IDebuggerBreakpoint,
  IDebuggerIdentity,
  IDebuggerStepMethod,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import {
  closeOwnTestConnection,
  createTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { AdtClient } from '../src/clients/AdtClient';
import { ClassExecutor } from '../src/executors/class/ClassExecutor';
import {
  AbapDebugger,
  abapDebuggerDocuments,
} from '../src/runtime/debugger/AbapDebugger';

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

// --- presentation -------------------------------------------------------------

const VERBOSE = process.env.PROBE_VERBOSE === '1';
const COLOR =
  !process.env.NO_COLOR &&
  (Boolean(process.env.FORCE_COLOR) || Boolean(process.stdout.isTTY));
const paint =
  (code: string) =>
  (text: string): string =>
    COLOR ? `\x1b[${code}m${text}\x1b[0m` : text;
const c = {
  bold: paint('1'),
  dim: paint('2'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  blue: paint('34'),
  magenta: paint('35'),
  cyan: paint('36'),
  gray: paint('90'),
  hilite: paint('1;30;43'),
};

const started = Date.now();
const WIDTH = 78;

function clock(): string {
  return c.gray(`${((Date.now() - started) / 1000).toFixed(1).padStart(5)}s`);
}

function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function section(title: string, note = ''): void {
  const head = ` ${title} ${note ? `${c.dim(note)} ` : ''}`;
  const visible = ` ${title} ${note ? `${note} ` : ''}`.length;
  out();
  out(
    c.cyan(`━━${c.bold(head)}${'━'.repeat(Math.max(4, WIDTH - visible - 2))}`),
  );
}

function info(label: string, text: string): void {
  out(`${clock()}  ${c.blue('•')} ${c.bold(label.padEnd(10))} ${text}`);
}

function clip(text: string): string {
  if (!text) return '';
  if (BODY_CHARS === 0) return `[${text.length} chars]`;
  return text.length > BODY_CHARS
    ? `${text.slice(0, BODY_CHARS)}… [${text.length} chars]`
    : text;
}

/**
 * Run one member and print one line for it: what it did, how it went, how
 * long it took. The body comes back either way — a failure carries it too —
 * and is printed only with PROBE_VERBOSE=1.
 */
async function call(
  label: string,
  what: string,
  run: () => Promise<IAdtResponse<unknown>>,
): Promise<{ ok: boolean; body: string; status?: number }> {
  const t0 = Date.now();
  const answer = await run();
  const ms = c.gray(`${Date.now() - t0} ms`);
  if (answer.ok) {
    const body = String(answer.getResult().value ?? '');
    out(
      `${clock()}  ${c.green('✓')} ${c.bold(label.padEnd(10))} ${what} ${ms}`,
    );
    if (VERBOSE && body) out(c.gray(`              ${clip(body)}`));
    return { ok: true, body };
  }
  const error = answer.getError();
  const body = String(error.response?.data ?? '');
  const status = error.response?.status;
  const subtype = /subType">([^<]*)</.exec(body)?.[1];
  out(
    `${clock()}  ${c.red('✗')} ${c.bold(label.padEnd(10))} ${what} ${c.red(`${status ?? ''} ${subtype ?? error.message}`)} ${ms}`,
  );
  if (VERBOSE && body) out(c.gray(`              ${clip(body)}`));
  return { ok: false, body, status };
}

function attr(xml: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
}

function tag(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];
}

/** A breakpoint id as a person reads it: kind and where. */
function describeBreakpoint(id: string, lines: Record<string, number>): string {
  const line = /LINE_NR=(\d+)/.exec(id)?.[1];
  if (line) {
    const include = /INCLUDE=([A-Z0-9_]+?)=*CM(\d+)/.exec(id);
    return `${c.magenta('line')} ${include ? `method include CM${include[2]}` : ''} line ${line}`;
  }
  const exception = /EXCEPTION_CLASS=(\w+)/.exec(id)?.[1];
  if (exception) return `${c.magenta('exception')} ${exception}`;
  void lines;
  return id;
}

/** The source around a line, the line itself marked. */
function showSource(line: number): void {
  const source = SOURCE.split('\n');
  for (let n = line - 1; n <= line + 1; n++) {
    const text = source[n - 1];
    if (text === undefined) continue;
    const number = String(n).padStart(4);
    const code = text.replace(/\s*"BP:\w+/, '');
    out(
      n === line
        ? `   ${c.yellow('➜')} ${c.yellow(number)} ${c.gray('│')} ${c.hilite(code)}`
        : `     ${c.gray(number)} ${c.gray('│')} ${c.dim(code)}`,
    );
  }
}

interface IStackFrame {
  position: string;
  program: string;
  event: string;
  eventType: string;
  line: number;
  ours: boolean;
}

function parseStack(xml: string): IStackFrame[] {
  return [...xml.matchAll(/<stackEntry\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((e) => attr(e, 'stackType') === 'ABAP')
    .map((e) => ({
      position: attr(e, 'stackPosition') ?? '',
      program: (attr(e, 'programName') ?? '').replace(/=+CP$/, ''),
      event: attr(e, 'eventName') ?? '',
      eventType: attr(e, 'eventType') ?? '',
      line: Number(attr(e, 'line') ?? '0'),
      ours: (attr(e, 'programName') ?? '').startsWith(CLASS_NAME),
    }));
}

interface IVariable {
  name: string;
  value: string;
  type: string;
  kind: string;
}

/** Values from the previous stop, so a change can be shown as one. */
let previousValues = new Map<string, string>();

/**
 * One stop, read and drawn: where it is (the line in its source), the frames
 * of the probe class above the framework, and every variable by scope, the
 * changed ones marked.
 */
async function readStop(debuggerApi: AbapDebugger): Promise<void> {
  const stack = await call('stack', 'read the call stack', () =>
    debuggerApi.getStack(),
  );
  const frames = parseStack(stack.body);
  const root = await call('variables', 'list the scopes', () =>
    debuggerApi.getChildVariables(['@ROOT']),
  );
  const scopes = [
    ...root.body.matchAll(
      /<CHILD_ID>([^<]*)<\/CHILD_ID><CHILD_NAME>([^<]*)<\/CHILD_NAME>/g,
    ),
  ].map((m) => ({ id: m[1], name: m[2] }));
  const all = scopes.length
    ? await call(
        'variables',
        `read ${scopes.length} scope${scopes.length === 1 ? '' : 's'}`,
        () => debuggerApi.getChildVariables(scopes.map((s) => s.id)),
      )
    : { ok: true, body: '' };

  const top = frames[0];
  out();
  if (top) {
    out(
      `   ${c.bold('at')} ${c.cyan(top.program)} ${c.bold(top.event)} ${c.gray(`(${top.eventType.toLowerCase()})`)}  line ${c.yellow(String(top.line))}`,
    );
    if (top.ours) showSource(top.line);
  }
  const ours = frames.filter((f) => f.ours);
  const framework = frames.length - ours.length;
  out(
    `   ${c.bold('stack')} ${ours
      .map((f) => `${c.cyan(f.event)}${c.gray(`:${f.line}`)}`)
      .join(
        c.gray(' ← '),
      )}${framework ? c.gray(`  ← ${framework} framework frames`) : ''}`,
  );

  const parentOf = new Map<string, string>();
  for (const m of all.body.matchAll(
    /<PARENT_ID>([^<]*)<\/PARENT_ID><CHILD_ID>([^<]*)<\/CHILD_ID>/g,
  )) {
    parentOf.set(m[2], m[1]);
  }
  const byScope = new Map<string, IVariable[]>();
  for (const row of all.body.matchAll(
    /<STPDA_ADT_VARIABLE>([\s\S]*?)<\/STPDA_ADT_VARIABLE>/g,
  )) {
    const id = tag(row[1], 'ID') ?? '';
    const scope = parentOf.get(id) ?? '?';
    const list = byScope.get(scope) ?? [];
    list.push({
      name: tag(row[1], 'NAME') ?? id,
      value: tag(row[1], 'VALUE') ?? '',
      type: tag(row[1], 'TECHNICAL_TYPE') || tag(row[1], 'META_TYPE') || '',
      kind: tag(row[1], 'KIND') ?? '',
    });
    byScope.set(scope, list);
  }

  const current = new Map<string, string>();
  for (const scope of scopes) {
    const variables = (byScope.get(scope.id) ?? []).filter(
      (v) => !/^\{O:/.test(v.value) || VERBOSE,
    );
    if (variables.length === 0) continue;
    out(`   ${c.bold(scope.name)}`);
    for (const v of variables) {
      const key = `${scope.id}/${v.name}`;
      current.set(key, v.value);
      const before = previousValues.get(key);
      const changed = before !== undefined && before !== v.value;
      const value = changed
        ? `${c.bold(c.yellow(v.value.trim() || "''"))} ${c.gray(`(was ${before?.trim() || "''"})`)}`
        : v.value.trim() || c.gray("''");
      out(
        `     ${(changed ? c.yellow : c.green)(v.name.padEnd(14))} ${c.gray(v.type.padEnd(22).slice(0, 22))} ${value}`,
      );
    }
  }
  previousValues = current;
}

function ended(answer: { ok: boolean; body: string }): boolean {
  return answer.ok
    ? /isSteppingPossible="false"/.test(answer.body)
    : /debuggeeEnded|noSessionAttached|DEBUGGEE_ENDED/.test(answer.body);
}

// --- the cycle ----------------------------------------------------------------

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

/**
 * Connection noise stays out of the picture. The connection logs an error for
 * every refused request, the expected end of the debuggee included, so its
 * warnings and errors go to stderr only with PROBE_VERBOSE=1.
 */
const toStderr = (...args: unknown[]): void => {
  if (VERBOSE) process.stderr.write(`${args.map(String).join(' ')}\n`);
};
const quietLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: toStderr,
  error: toStderr,
} as ILogger;

async function deployProbeClass(
  connection: IAbapConnection,
  packageName: string,
): Promise<boolean> {
  const cls = new AdtClient(connection, quietLogger).getClass();
  const config = {
    className: CLASS_NAME,
    packageName,
    description: 'Debugger probe',
  };
  const created = await call('create', `${CLASS_NAME} in ${packageName}`, () =>
    cls.create(config),
  );
  if (!created.ok && !/exist/i.test(created.body)) return false;
  const lock = await cls.lock(config);
  if (!lock.ok) {
    info('lock', c.red(lock.getError().message ?? 'refused'));
    return false;
  }
  const lockHandle = String(lock.getResult().value ?? '');
  const written = await call('write', 'source with markers', () =>
    cls.update(config, { source: SOURCE, lockHandle }),
  );
  await cls.unlock(config, lockHandle);
  if (!written.ok) return false;
  return (await call('activate', CLASS_NAME, () => cls.activate(config))).ok;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // --deploy: create and activate the probe class, leave it, and stop there.
  const deployOnly = args.includes('--deploy');
  const keep = deployOnly || args.includes('--keep');
  // Whether our listener may displace another debugger of the same user
  // (Eclipse): refused with 409 by default, displaced with --take-over.
  const onConflict = args.includes('--take-over') ? 'takeOver' : 'refuse';
  const packageIndex = args.indexOf('--package');
  const packageName = packageIndex >= 0 ? args[packageIndex + 1] : '$TMP';

  section('Connect', process.env.SAP_URL ?? '');
  if (args.includes('--run-only')) {
    // --run-only: no breakpoints and no listener of ours — the class just
    // runs, so another debugger listening for the same user (Eclipse) can
    // catch it. The call stays open while that debugger holds the program.
    const only = await createTestConnection(quietLogger, { ownSession: true });
    try {
      section('Run', 'nothing of ours listens');
      info(
        'run',
        `classrun ${CLASS_NAME} — if a debugger catches it, this waits until it is released`,
      );
      const run = await call('run', 'classrun returned', () =>
        new ClassExecutor(only, quietLogger).run({ className: CLASS_NAME }),
      );
      section('Program output');
      out(
        `   ${run.ok ? c.green(run.body.trim() || "''") : c.red(run.body.trim())}`,
      );
    } finally {
      await closeOwnTestConnection(only);
      out();
    }
    return;
  }
  const debuggerConnection = await createTestConnection(quietLogger, {
    ownSession: true,
  });
  info(
    'debugger',
    `session ${c.gray(String(debuggerConnection.getSessionId()))}`,
  );
  const triggerConnection = await createTestConnection(quietLogger, {
    ownSession: true,
  });
  info(
    'trigger',
    `session ${c.gray(String(triggerConnection.getSessionId()))}`,
  );
  const debuggerApi = new AbapDebugger(
    debuggerConnection,
    quietLogger,
    abapDebuggerDocuments,
    { onConflict },
  );

  try {
    section('Probe class');
    if (!(await deployProbeClass(debuggerConnection, packageName))) return;
    if (deployOnly) {
      out(
        `\n   ${c.green('■')} ${CLASS_NAME} is active in ${packageName} and stays there`,
      );
      return;
    }
    const lines = markerLines();
    const identity = identityFor();
    const source = `/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main`;
    const breakpoints: IDebuggerBreakpoint[] = [
      { kind: 'line', uri: `${source}#start=${lines.loop}` },
      { kind: 'line', uri: `${source}#start=${lines.catch}` },
      { kind: 'exception', exceptionClass: 'CX_SY_ZERODIVIDE' },
    ];

    section('Breakpoints', `user ${identity.requestUser}`);
    // The debugger's session is stateful for the whole cycle — the caller's call.
    debuggerConnection.setSessionType('stateful');
    await call(
      'validate',
      `${breakpoints.length} breakpoints, nothing armed`,
      () =>
        debuggerApi.setBreakpoints(identity, breakpoints, {
          validationOnly: true,
        }),
    );
    const armed = await call('arm', `${breakpoints.length} breakpoints`, () =>
      debuggerApi.setBreakpoints(identity, breakpoints),
    );
    const owned = [
      ...armed.body.matchAll(/<breakpoint\b[^>]*\bid="([^"]*)"/g),
    ].map((m) => m[1]);
    for (const id of owned)
      out(`              ${c.magenta('◆')} ${describeBreakpoint(id, lines)}`);
    out(
      c.gray(
        `              source lines ${lines.loop} and ${lines.catch}; the server renumbers them into the method include`,
      ),
    );

    section('Listen & run');
    const listener = call(
      'listen',
      `user-mode listener, held ${LISTEN_SECONDS} s, ${onConflict === 'refuse' ? 'refusing to displace another' : 'taking over from another'}`,
      () => debuggerApi.listen(identity, { holdSeconds: LISTEN_SECONDS }),
    );
    // A refused listener answers 409 within the delay. Running the program
    // then would hand it to whoever holds the user's debugging — and wait
    // until they release it — so a refusal ends the cycle here.
    const early = await Promise.race([
      listener,
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), ARM_DELAY_MS),
      ),
    ]);
    if (early && !early.ok) {
      info(
        'refused',
        `another debugger holds ${identity.requestUser}'s debugging — the program is not run`,
      );
    }
    let trigger: ReturnType<typeof call> | undefined;
    if (!early || early.ok) {
      info(
        'run',
        `classrun ${CLASS_NAME} on the trigger session ${c.gray(`(${ARM_DELAY_MS} ms after the listener)`)}`,
      );
      // The run stays open while the debuggee is suspended.
      trigger = call('run', 'classrun returned', () =>
        new ClassExecutor(triggerConnection, quietLogger).run({
          className: CLASS_NAME,
        }),
      );
    }

    const caught = await listener;
    const debuggeeId = tag(caught.body, 'DEBUGGEE_ID');
    let attached = false;
    let done = false;
    if (debuggeeId) {
      info(
        'caught',
        `${c.green(tag(caught.body, 'DBGEE_KIND') ?? '')} ${c.gray(debuggeeId)} at line ${c.yellow(/#start=(\d+)/.exec(tag(caught.body, 'URI') ?? '')?.[1] ?? '?')}`,
      );
      const attach = await call('attach', 'to the debuggee', () =>
        debuggerApi.attach(identity.requestUser, debuggeeId),
      );
      attached = attach.ok;
    } else if (caught.ok) {
      info('caught', c.red('nothing — the listener came back empty'));
    }

    if (attached) {
      section('Stop 1', 'first breakpoint');
      await readStop(debuggerApi);
      // PROBE_SNAPSHOT=1: take a memory snapshot of the debuggee here — the
      // memorySnapshot action the attach answer lists — and list the snapshots.
      if (process.env.PROBE_SNAPSHOT === '1') {
        section('Memory snapshot');
        const raw = async (
          label: string,
          method: string,
          url: string,
          accept?: string,
        ) => {
          const t0 = Date.now();
          try {
            const r = await debuggerConnection.makeAdtRequest({
              url,
              method,
              timeout: 120_000,
              ...(accept ? { headers: { Accept: accept } } : {}),
            });
            out(
              `   ${label} ${method} ${url} → ${r.status} in ${Date.now() - t0} ms`,
            );
            out(
              c.gray(
                `     ${String(
                  typeof r.data === 'string' ? r.data : JSON.stringify(r.data),
                )
                  .replace(/\s+/g, ' ')
                  .slice(0, 1500)}`,
              ),
            );
            return r.status;
          } catch (error) {
            // biome-ignore lint/suspicious/noExplicitAny: an axios-shaped error, read defensively
            const r = (error as any)?.response;
            out(
              `   ${label} ${method} ${url} → ${r?.status ?? 'no answer'} in ${Date.now() - t0} ms`,
            );
            out(
              c.gray(
                `     ${String(r?.data ?? (error as Error).message)
                  .replace(/\s+/g, ' ')
                  .slice(0, 800)}`,
              ),
            );
            return r?.status ?? 0;
          }
        };
        const action = '/sap/bc/adt/debugger/actions?action=memorySnapshot';
        const posted = await raw('snapshot', 'POST', action, 'application/xml');
        if (posted >= 400 || posted === 0)
          await raw('snapshot', 'GET', action, 'application/xml');
        await raw(
          'list',
          'GET',
          `/sap/bc/adt/runtime/memory/snapshots?user=${identity.requestUser}`,
          'application/vnd.sap.adt.runtime.memory.snapshots.v1+xml',
        );
      }
      const plan: IDebuggerStepMethod[] = [
        'stepInto',
        'stepReturn',
        ...Array<IDebuggerStepMethod>(MAX_CONTINUES).fill('stepContinue'),
      ];
      for (const [index, method] of plan.entries()) {
        section(`Stop ${index + 2}`, method);
        const answer = await call('step', method, () =>
          debuggerApi.step(method),
        );
        if (ended(answer)) {
          out(
            `   ${c.green('■')} ${c.bold('the program ran to its end')} ${c.gray('(500 debuggeeEnded)')}`,
          );
          done = true;
          break;
        }
        const reached = [
          ...answer.body.matchAll(/<dbg:breakpoint id="([^"]*)"/g),
        ].map((m) => m[1]);
        for (const id of reached)
          out(
            `              ${c.magenta('◆')} reached ${describeBreakpoint(id, lines)}`,
          );
        await readStop(debuggerApi);
      }
    }

    section('Cleanup');
    for (const id of owned) {
      await call('delete', describeBreakpoint(id, lines), () =>
        debuggerApi.deleteBreakpoint(identity, id),
      );
    }
    if (attached && !done) {
      await call('terminate', 'the debuggee', () =>
        debuggerApi.terminateDebuggee(),
      );
    }
    await call('unlisten', 'the listener', () =>
      debuggerApi.stopListener(identity),
    );
    debuggerConnection.setSessionType('stateless');

    if (!trigger) return;
    const run = await trigger;
    section('Program output');
    out(
      `   ${run.ok ? c.green(run.body.trim() || "''") : c.red(run.body.trim())}`,
    );
  } finally {
    if (!keep) {
      section('Teardown');
      await call('delete', CLASS_NAME, () =>
        new AdtClient(debuggerConnection, quietLogger)
          .getClass()
          .delete({ className: CLASS_NAME, packageName }),
      );
    }
    await closeOwnTestConnection(triggerConnection);
    await closeOwnTestConnection(debuggerConnection);
    out();
  }
}

main().catch((error) => {
  out(c.red(`FAILED: ${error instanceof Error ? error.stack : String(error)}`));
  process.exitCode = 1;
});
