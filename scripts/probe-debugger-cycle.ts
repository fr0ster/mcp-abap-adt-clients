/**
 * One debug cycle, end to end, on the raw ADT debugger protocol.
 *
 * The question: what does it take to stop a running ABAP program at a
 * breakpoint, look inside it, step it and let it go — measured on a real
 * system, request by request, before any of it is shaped into a member of this
 * library. The sequence follows what abapsmith (an MIT-licensed MCP server)
 * sends, read from its source and its live captures; every step here exists to
 * confirm or refute that sequence on our systems.
 *
 * Two connections, two ABAP sessions, as the protocol demands:
 *
 * - the DEBUGGER connection arms breakpoints, waits on the listener, attaches
 *   to the debuggee, reads the stack and variables, steps, and cleans up;
 * - the TRIGGER connection runs the probe class through classrun and is left
 *   blocked inside it while the debuggee is suspended.
 *
 * The probe class is created in a local package (no transport), activated,
 * and deleted at the end unless `--keep` is given. Breakpoint lines are found
 * from markers in its source, so editing the source never leaves a stale
 * line number behind.
 *
 *   MCP_ENV_PATH=<session>.env npx ts-node scripts/probe-debugger-cycle.ts
 *   ... --keep            leave the probe class in place
 *   ... --package <name>  package for the probe class (default: $TMP)
 *
 * Every request and answer is written to the log, bodies clipped at
 * PROBE_BODY_CHARS (default 1500, 0 for none).
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import * as dotenv from 'dotenv';
import {
  closeOwnTestConnection,
  createTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtClient } from '../src/clients/AdtClient';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const CLASS_NAME = 'ZADT_DBG_PROBE';
const BODY_CHARS = Number(process.env.PROBE_BODY_CHARS ?? '1500');

/**
 * The probe class. `"BP:<name>` markers name the lines breakpoints go on; the
 * work is deterministic so every run stops at the same places with the same
 * values.
 */
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

/** 1-based line of each `"BP:<name>` marker in {@link SOURCE}. */
function markerLines(): Record<string, number> {
  const lines: Record<string, number> = {};
  SOURCE.split('\n').forEach((text, index) => {
    const marker = /"BP:(\w+)/.exec(text);
    if (marker) lines[marker[1]] = index + 1;
  });
  return lines;
}

// --- output -----------------------------------------------------------------

const started = Date.now();

function say(line: string): void {
  const seconds = ((Date.now() - started) / 1000).toFixed(1).padStart(6);
  process.stdout.write(`${seconds}s  ${line}\n`);
}

function clip(body: unknown): string {
  if (body === undefined || body === null || body === '') return '';
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  if (BODY_CHARS === 0) return `[${text.length} chars]`;
  return text.length > BODY_CHARS
    ? `${text.slice(0, BODY_CHARS)}… [${text.length} chars]`
    : text;
}

// --- the wire ----------------------------------------------------------------

export interface IWireAnswer {
  status: number;
  headers: Record<string, unknown>;
  data: string;
  /** Set when no HTTP answer came back at all (timeout, socket). */
  failure?: string;
}

/**
 * One request, logged both ways, and an answer for every outcome.
 *
 * The connection throws on anything outside 2xx; here a 404 or a 409 is the
 * measurement, so it comes back as an answer like any other.
 */
async function send(
  label: string,
  connection: IAbapConnection,
  options: IAbapRequestOptions,
): Promise<IWireAnswer> {
  const query = options.params
    ? `?${new URLSearchParams(options.params as Record<string, string>)}`
    : '';
  say(`${label} → ${options.method} ${options.url}${query}`);
  if (options.data !== undefined) say(`${label}   body: ${clip(options.data)}`);
  const t0 = Date.now();
  let answer: IWireAnswer;
  try {
    const response = await connection.makeAdtRequest(options);
    answer = {
      status: response.status,
      headers: response.headers as Record<string, unknown>,
      data:
        typeof response.data === 'string'
          ? response.data
          : String(response.data ?? ''),
    };
  } catch (error) {
    // biome-ignore lint/suspicious/noExplicitAny: an axios-shaped error, read defensively
    const response = (error as any)?.response;
    answer = response
      ? {
          status: response.status,
          headers: response.headers ?? {},
          data:
            typeof response.data === 'string'
              ? response.data
              : JSON.stringify(response.data ?? ''),
        }
      : {
          status: 0,
          headers: {},
          data: '',
          failure: error instanceof Error ? error.message : String(error),
        };
  }
  const ms = Date.now() - t0;
  say(
    `${label} ← ${answer.status || 'NO ANSWER'} in ${ms} ms${answer.failure ? ` (${answer.failure})` : ''}`,
  );
  if (answer.data) say(`${label}   ${clip(answer.data)}`);
  return answer;
}

// --- the probe class ---------------------------------------------------------

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
  say(`class create ${created.ok ? 'ok' : 'already there — reused'}`);

  const lock = await cls.lock(config);
  if (!lock.ok) {
    say(`class lock REFUSED: ${lock.getError().message}`);
    return false;
  }
  const lockHandle = String(lock.getResult().value ?? '');
  const written = await cls.update(config, { source: SOURCE, lockHandle });
  await cls.unlock(config, lockHandle);
  if (!written.ok) {
    say(`class update REFUSED: ${written.getError().message}`);
    return false;
  }
  const activated = await cls.activate(config);
  say(
    `class activate ${activated.ok ? 'ok' : `REFUSED: ${activated.getError().message}`}`,
  );
  return activated.ok;
}

async function deleteProbeClass(
  connection: IAbapConnection,
  packageName: string,
): Promise<void> {
  const cls = new AdtClient(connection, createConnectionLogger()).getClass();
  const deleted = await cls.delete({ className: CLASS_NAME, packageName });
  say(
    `class delete ${deleted.ok ? 'ok' : `REFUSED: ${deleted.getError().message}`}`,
  );
}

/**
 * The trigger: classrun on its own session, not awaited by the caller.
 *
 * While the debuggee is suspended this request stays open; it settles once the
 * program runs to the end or is terminated.
 */
function fireTrigger(connection: IAbapConnection): Promise<IWireAnswer> {
  return send('trigger', connection, {
    url: `/sap/bc/adt/oo/classrun/${CLASS_NAME.toLowerCase()}`,
    method: 'POST',
    timeout: 300_000,
    headers: { Accept: 'text/plain' },
  });
}

// --- the debugger -------------------------------------------------------------

const DEBUGGER = '/sap/bc/adt/debugger';
const ADT_NS =
  'xmlns:dbg="http://www.sap.com/adt/debugger" xmlns:adtcore="http://www.sap.com/adt/core"';
const ASX_NS = 'xmlns:asx="http://www.sap.com/abapxml"';

/** Seconds SAP holds the listener open; the client waits a minute longer. */
const LISTEN_SECONDS = Number(process.env.PROBE_LISTEN_SECONDS ?? '60');
/** Pause between sending the listener and firing the trigger. */
const ARM_DELAY_MS = Number(process.env.PROBE_ARM_DELAY_MS ?? '2000');
/** Upper bound on `stepContinue` rounds after the first stop. */
const MAX_CONTINUES = Number(process.env.PROBE_MAX_CONTINUES ?? '8');

interface IDebugContext {
  requestUser: string;
  terminalId: string;
  ideId: string;
}

/**
 * The identity SAP keys the listener and the breakpoints on: 32 upper-case
 * hex characters each, derived from system and user so two runs of this probe
 * address the same slot (as abapsmith does, `client.ts` `resolveTerminalId`).
 */
function debugContext(): IDebugContext {
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

function query(params: Record<string, string | number | boolean>): string {
  return new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
}

function contextQuery(ctx: IDebugContext): Record<string, string> {
  return {
    debuggingMode: 'user',
    requestUser: ctx.requestUser,
    terminalId: ctx.terminalId,
    ideId: ctx.ideId,
  };
}

type Breakpoint =
  | { kind: 'line'; uri: string }
  | { kind: 'exception'; exceptionClass: string };

function breakpointsBody(
  ctx: IDebugContext,
  breakpoints: Breakpoint[],
  validationOnly: boolean,
): string {
  const rows = breakpoints
    .map((bp) => {
      const only = validationOnly ? ' validationOnly="true"' : '';
      return bp.kind === 'line'
        ? `  <breakpoint kind="line" adtcore:uri="${bp.uri}"${only}/>`
        : `  <breakpoint kind="exception" exceptionClass="${bp.exceptionClass}"${only}/>`;
    })
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<dbg:breakpoints ${ADT_NS} debuggingMode="user" scope="external" requestUser="${ctx.requestUser}" terminalId="${ctx.terminalId}" ideId="${ctx.ideId}">\n` +
    `${rows}\n</dbg:breakpoints>`
  );
}

function attr(xml: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
}

function tag(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];
}

/** What a step or stack answer says about the debuggee being gone. */
function debuggeeEnded(answer: IWireAnswer): boolean {
  if (answer.status >= 400) {
    return /debuggeeEnded|noSessionAttached|DEBUGGEE_ENDED|DBGSESSIONEND|SLAVENOTCONN/i.test(
      answer.data,
    );
  }
  return /isSteppingPossible="false"/.test(answer.data);
}

/** `stackEntry` rows as `position program include:line`. */
function stackSummary(xml: string): string[] {
  return [...xml.matchAll(/<stackEntry\b[^>]*>/g)].map((m) => {
    const e = m[0];
    return `${attr(e, 'stackPosition')} ${attr(e, 'programName')} ${attr(e, 'includeName')}:${attr(e, 'line')}`;
  });
}

const CHILD_VARIABLES_TYPE =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.ChildVariables';

function childVariablesBody(parents: string[]): string {
  const rows = parents
    .map(
      (id) =>
        `    <STPDA_ADT_VARIABLE_HIERARCHY><PARENT_ID>${id}</PARENT_ID></STPDA_ADT_VARIABLE_HIERARCHY>`,
    )
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<asx:abap ${ASX_NS} version="1.0"><asx:values><DATA><HIERARCHIES>\n` +
    `${rows}\n</HIERARCHIES></DATA></asx:values></asx:abap>`
  );
}

/**
 * The variable survey abapsmith takes at every stop: `@ROOT` answers only the
 * scope ids, and one more request expands all of them.
 */
async function survey(connection: IAbapConnection): Promise<void> {
  const getChildren = (parents: string[]) =>
    send('vars', connection, {
      url: `${DEBUGGER}?method=getChildVariables`,
      method: 'POST',
      timeout: 30_000,
      data: childVariablesBody(parents),
      headers: {
        'Content-Type': CHILD_VARIABLES_TYPE,
        Accept: CHILD_VARIABLES_TYPE,
      },
    });
  const root = await getChildren(['@ROOT']);
  const scopes = [...root.data.matchAll(/<CHILD_ID>([^<]*)<\/CHILD_ID>/g)].map(
    (m) => m[1],
  );
  say(`vars   scopes: ${scopes.join(', ') || '(none)'}`);
  if (scopes.length === 0) return;
  const all = await getChildren(scopes);
  for (const row of all.data.matchAll(
    /<STPDA_ADT_VARIABLE>([\s\S]*?)<\/STPDA_ADT_VARIABLE>/g,
  )) {
    say(
      `vars   ${tag(row[1], 'NAME')} = ${tag(row[1], 'VALUE') ?? ''}  (${tag(row[1], 'DECLARED_TYPE_NAME') ?? tag(row[1], 'META_TYPE') ?? ''})`,
    );
  }
}

async function readStack(connection: IAbapConnection): Promise<IWireAnswer> {
  const answer = await send('stack', connection, {
    url: `${DEBUGGER}/stack?${query({ emode: '_', semanticURIs: true })}`,
    method: 'GET',
    timeout: 30_000,
    headers: { Accept: 'application/xml' },
  });
  for (const line of stackSummary(answer.data)) say(`stack  ${line}`);
  return answer;
}

async function step(
  connection: IAbapConnection,
  method: string,
): Promise<IWireAnswer> {
  const answer = await send(method, connection, {
    url: `${DEBUGGER}?method=${method}`,
    method: 'POST',
    timeout: 60_000,
    headers: { Accept: 'application/xml' },
  });
  const reached = [
    ...answer.data.matchAll(/<dbg:breakpoint id="([^"]*)"/g),
  ].map((m) => m[1]);
  if (reached.length) say(`${method} reached: ${reached.join(' | ')}`);
  return answer;
}

/**
 * The cycle itself, on the debugger connection; the trigger is fired from
 * here so the order — breakpoints, listener, trigger — is in one place.
 */
async function debugCycle(
  debuggerConnection: IAbapConnection,
  triggerConnection: IAbapConnection,
  lines: Record<string, number>,
): Promise<Promise<IWireAnswer> | undefined> {
  const ctx = debugContext();
  say(
    `identity: user ${ctx.requestUser} terminal ${ctx.terminalId} ide ${ctx.ideId}`,
  );
  debuggerConnection.setSessionType('stateful');

  const source = `/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main`;
  const breakpoints: Breakpoint[] = [
    { kind: 'line', uri: `${source}#start=${lines.loop}` },
    { kind: 'line', uri: `${source}#start=${lines.catch}` },
    { kind: 'exception', exceptionClass: 'CX_SY_ZERODIVIDE' },
  ];
  const owned: string[] = [];

  for (const validationOnly of [true, false]) {
    const answer = await send(
      validationOnly ? 'bp-validate' : 'bp-arm',
      debuggerConnection,
      {
        url: `${DEBUGGER}/breakpoints`,
        method: 'POST',
        timeout: 30_000,
        data: breakpointsBody(ctx, breakpoints, validationOnly),
        headers: {
          'Content-Type': 'application/xml',
          Accept: 'application/xml',
        },
      },
    );
    for (const m of answer.data.matchAll(/<breakpoint\b[^>]*>/g)) {
      const id = attr(m[0], 'id');
      const error = attr(m[0], 'errorMessage');
      say(
        `  ${attr(m[0], 'kind')} → ${id ?? '(no id)'}${error ? ` ERROR: ${error}` : ''}`,
      );
      if (!validationOnly && id) owned.push(id);
    }
  }

  // The listener holds the session; nothing else may go out on it until it answers.
  const listener = send('listener', debuggerConnection, {
    url: `${DEBUGGER}/listeners?${query({ ...contextQuery(ctx), timeout: LISTEN_SECONDS })}`,
    method: 'POST',
    timeout: (LISTEN_SECONDS + 60) * 1000,
    headers: { Accept: 'application/vnd.sap.as+xml' },
  });
  await new Promise((resolve) => setTimeout(resolve, ARM_DELAY_MS));
  const trigger = fireTrigger(triggerConnection);

  const caught = await listener;
  const debuggeeId = tag(caught.data, 'DEBUGGEE_ID');
  let attached = false;
  if (debuggeeId) {
    say(
      `caught: ${tag(caught.data, 'DBGEE_KIND')} ${debuggeeId} at ${tag(caught.data, 'PRG_CURR')}:${tag(caught.data, 'LINE_CURR')} (${tag(caught.data, 'URI')})`,
    );
    const attach = await send('attach', debuggerConnection, {
      url: `${DEBUGGER}?${query({ method: 'attach', debuggeeId, debuggingMode: 'user', requestUser: ctx.requestUser, dynproDebugging: true })}`,
      method: 'POST',
      timeout: 30_000,
      headers: { Accept: 'application/xml' },
    });
    attached = attach.status === 200;
    say(
      `attach: debugSession ${attr(attach.data, 'debugSessionId')} debuggeeSession "${attr(attach.data, 'debuggeeSessionId')}" stepping ${attr(attach.data, 'isSteppingPossible')}`,
    );
  } else {
    say('listener answered without a debuggee — nothing was caught');
  }

  let ended = !attached;
  if (attached) {
    await readStack(debuggerConnection);
    await survey(debuggerConnection);

    for (const method of ['stepInto', 'stepReturn']) {
      const answer = await step(debuggerConnection, method);
      if (debuggeeEnded(answer)) {
        ended = true;
        break;
      }
      await readStack(debuggerConnection);
    }
    for (let round = 1; !ended && round <= MAX_CONTINUES; round++) {
      const answer = await step(debuggerConnection, 'stepContinue');
      if (debuggeeEnded(answer)) {
        say(`debuggee ended after continue #${round}`);
        ended = true;
        break;
      }
      await readStack(debuggerConnection);
      await survey(debuggerConnection);
    }
  }

  // Teardown in abapsmith's order: breakpoints first, then the debuggee, then the listener.
  for (const id of owned) {
    await send('bp-delete', debuggerConnection, {
      url: `${DEBUGGER}/breakpoints/${encodeURIComponent(id)}?${query({ scope: 'external', ...contextQuery(ctx) })}`,
      method: 'DELETE',
      timeout: 30_000,
    });
  }
  if (attached && !ended) {
    await send('terminate', debuggerConnection, {
      url: `${DEBUGGER}?method=terminateDebuggee`,
      method: 'POST',
      timeout: 30_000,
      headers: { Accept: 'application/xml' },
    });
  }
  await send('listener-delete', debuggerConnection, {
    url: `${DEBUGGER}/listeners?${query(contextQuery(ctx))}`,
    method: 'DELETE',
    timeout: 30_000,
  });
  debuggerConnection.setSessionType('stateless');
  return trigger;
}

// --- main --------------------------------------------------------------------

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
  say(
    `sessions: debugger ${debuggerConnection.getSessionId()} / trigger ${triggerConnection.getSessionId()}`,
  );

  try {
    if (!(await deployProbeClass(debuggerConnection, packageName))) return;
    const lines = markerLines();
    say(`breakpoint lines: ${JSON.stringify(lines)}`);

    const trigger = await debugCycle(
      debuggerConnection,
      triggerConnection,
      lines,
    );
    if (trigger) {
      const settled = await Promise.race([
        trigger,
        new Promise<undefined>((resolve) =>
          setTimeout(() => resolve(undefined), 30_000),
        ),
      ]);
      say(
        settled
          ? `trigger settled: ${settled.status} ${clip(settled.data)}`
          : 'trigger had NOT settled 30 s after teardown',
      );
    }
  } finally {
    if (!keep) await deleteProbeClass(debuggerConnection, packageName);
    await closeOwnTestConnection(triggerConnection);
    await closeOwnTestConnection(debuggerConnection);
  }
}

main().catch((error) => {
  say(`FAILED: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
