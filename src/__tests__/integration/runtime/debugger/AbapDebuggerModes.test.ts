/**
 * Integration test for the debugger requests added for the debugging modes:
 * replacing breakpoints (`syncBreakpoints`, `full` and `partial`), skip counts,
 * leaving and freeing the debugger (`detachDebugger`, `terminateDebugger`),
 * the session settings (`setDebuggerSettings`), the listener check
 * (`checkListener`, `readListenerConflict`), terminal mode, and debugging a run
 * of another user.
 *
 * Two probe classes implementing IF_OO_ADT_CLASSRUN — two distinct main
 * programs — are created in a local package, run under the debugger and deleted
 * at the end. Every case is independent: it arms what it needs and, in a
 * `finally`, deletes its breakpoints, stops its listeners, ends what it attached
 * and waits for its runs.
 *
 * **Measured.** Each case prints what the server answered on lines starting
 * `RECORDED case <n>:`. The outcomes were measured on premise (2026-10-11),
 * BASIS 816, written into the JSDoc of `src/runtime/debugger/abap.ts`, and are
 * asserted here; what could not be measured says so where it is skipped.
 *
 * Nothing else may listen for the same SAP user while this runs (close the
 * IDE), and the second user's IDE must not hold a listener either.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- src/__tests__/integration/runtime/debugger/AbapDebuggerModes.test.ts
 */

import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  analyseDebuggeeEnd,
  analyseDeletion,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtResponse,
  IDebuggerBreakpoint,
  IDebuggerIdentity,
  IDebuggerLineBreakpoint,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import { ClassExecutor } from '../../../../executors/class/ClassExecutor';
import {
  AbapDebugger,
  abapDebuggerDocuments,
  type IAbapDebuggerResults,
} from '../../../../runtime/debugger/AbapDebugger';
import { readListenerConflict } from '../../../../runtime/debugger/abap';
import { rawDocument } from '../../../../utils/resultStrategy';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  closeOwnTestConnection,
  createTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import { logTestStep } from '../../../helpers/testProgressLogger';

const { getEnabledTestCase, resolvePackageName, resolveTransportRequest } =
  require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const testsLogger: ILogger = createTestsLogger();

const testCase = getEnabledTestCase(
  'runtime_debugger',
  'adt_abap_debugger_modes',
);
const CLASS_A: string = (
  testCase?.params?.class_name ?? 'ZAC_DBG_MODES_A'
).toUpperCase();
const CLASS_B: string = (
  testCase?.params?.class_name_b ?? 'ZAC_DBG_MODES_B'
).toUpperCase();
const SECOND_USER_ENV: string = String(
  testCase?.params?.second_user_env ?? '',
).trim();

/** How long a listener waits for a run that is expected to be caught. */
const HOLD_SECONDS = 30;
/** How long a listener waits for a run that is expected NOT to be caught. */
const SHORT_HOLD_SECONDS = 15;
const STEP_TIMEOUT = 240_000;

/**
 * Probe A: five passes over the loop line, then the end line. At a stop on
 * the loop line the line has not run yet, so on the n-th hit `LV_I` is n - 1.
 */
const SOURCE_A = `CLASS ${CLASS_A.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.
ENDCLASS.

CLASS ${CLASS_A.toLowerCase()} IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    DATA lv_i TYPE i.
    DO 5 TIMES.
      lv_i = lv_i + 1. "BP:LOOP
    ENDDO.
    out->write( |done { lv_i }| ). "BP:END
  ENDMETHOD.
ENDCLASS.
`;

/**
 * Probe B: a caught division by zero, so an exception breakpoint stops it at
 * the CATCH line (measured 2026-10-09: the stop is reported there, not at the
 * raising statement), and the marked end line.
 */
const SOURCE_B = `CLASS ${CLASS_B.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.
ENDCLASS.

CLASS ${CLASS_B.toLowerCase()} IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    DATA lv_text TYPE string VALUE 'probe b'.
    DATA lv_zero TYPE i.
    TRY.
        lv_zero = 1 / lv_zero. "BP:RAISE
      CATCH cx_sy_zerodivide.
        lv_text = 'probe b'.
    ENDTRY.
    out->write( lv_text ). "BP:END
  ENDMETHOD.
ENDCLASS.
`;

const OUTPUT_A = 'done 5';
const OUTPUT_B = 'probe b';

function markers(source: string): Record<string, number> {
  const lines: Record<string, number> = {};
  source.split('\n').forEach((text, index) => {
    const marker = /"BP:(\w+)/.exec(text);
    if (marker) lines[marker[1]] = index + 1;
  });
  return lines;
}

const LINE_A = markers(SOURCE_A);
const LINE_B = markers(SOURCE_B);
const CLASS_URI_A = `/sap/bc/adt/oo/classes/${CLASS_A.toLowerCase()}`;
const CLASS_URI_B = `/sap/bc/adt/oo/classes/${CLASS_B.toLowerCase()}`;
/** A class reference that maps to no main program: no such class exists. */
const CLASS_URI_NONE = `/sap/bc/adt/oo/classes/${CLASS_A.toLowerCase()}_nx`;

const lineA = (
  name: 'LOOP' | 'END',
  extra: Partial<IDebuggerLineBreakpoint> = {},
): IDebuggerLineBreakpoint => ({
  kind: 'line',
  uri: `${CLASS_URI_A}/source/main#start=${LINE_A[name]}`,
  ...extra,
});
const lineB = (): IDebuggerLineBreakpoint => ({
  kind: 'line',
  uri: `${CLASS_URI_B}/source/main#start=${LINE_B.END}`,
});
const zeroDivide: IDebuggerBreakpoint = {
  kind: 'exception',
  exceptionClass: 'CX_SY_ZERODIVIDE',
};

// --- reading the documents ------------------------------------------------------

function attr(xml: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
}

function tag(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];
}

/** The answer's document, whether the member succeeded or failed. */
function documentOf(answer: IAdtResponse<unknown>): string {
  return answer.ok
    ? String(answer.getResult().value ?? '')
    : String(answer.getError().response?.data ?? '');
}

function subtypeOf(answer: IAdtResponse<unknown>): string | undefined {
  return /subType">([^<]*)</.exec(documentOf(answer))?.[1];
}

function statusOf(answer: IAdtResponse<unknown>): number | undefined {
  return answer.ok ? 200 : answer.getError().response?.status;
}

/** Status, subtype and the head of the document, for a recorded line. */
function summary(answer: IAdtResponse<unknown>): string {
  const document = documentOf(answer).replace(/\s+/g, ' ').slice(0, 600);
  return `${statusOf(answer) ?? 'no status'} ${subtypeOf(answer) ?? ''} ${answer.ok ? '' : (answer.getError().message ?? '')} body="${document}"`;
}

/** Every `<breakpoint>` row of a breakpoints answer. */
function breakpointRows(xml: string): string[] {
  return [...xml.matchAll(/<breakpoint\b[^>]*>/g)].map((m) => m[0]);
}

function breakpointIds(xml: string): string[] {
  return breakpointRows(xml)
    .map((row) => attr(row, 'id'))
    .filter((id): id is string => !!id);
}

/** NAME → VALUE of every variable row in a variables document. */
function values(variablesXml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of variablesXml.matchAll(
    /<STPDA_ADT_VARIABLE>([\s\S]*?)<\/STPDA_ADT_VARIABLE>/g,
  )) {
    map.set(tag(row[1], 'NAME') ?? '', (tag(row[1], 'VALUE') ?? '').trim());
  }
  return map;
}

function topLine(stackXml: string): number | undefined {
  const top = [...stackXml.matchAll(/<stackEntry\b[^>]*>/g)]
    .map((m) => m[0])
    .find((e) => attr(e, 'stackType') === 'ABAP');
  return top ? Number(attr(top, 'line')) : undefined;
}

/** A line every reader of the log can find and copy into the JSDoc. */
function record(caseNo: number, what: string): void {
  const line = `RECORDED case ${caseNo}: ${what}`;
  process.stdout.write(`${line}\n`);
  logTestStep(line, testsLogger);
}

const hex32 = (): string => randomBytes(16).toString('hex').toUpperCase();

function identityFor(user: string): IDebuggerIdentity {
  const requestUser = user.toUpperCase();
  const id = (suffix: string): string =>
    createHash('sha256')
      .update(`${process.env.SAP_URL}:${requestUser}:modes:${suffix}`)
      .digest('hex')
      .slice(0, 32)
      .toUpperCase();
  return {
    debuggingMode: 'user',
    requestUser,
    terminalId: id('terminalId'),
    ideId: id('ideId'),
  };
}

/** Another debugger of the same user: its own terminal and its own IDE. */
function otherIde(of: IDebuggerIdentity, label: string): IDebuggerIdentity {
  const id = (part: string): string =>
    createHash('sha256')
      .update(`${of.terminalId}:${label}:${part}`)
      .digest('hex')
      .slice(0, 32)
      .toUpperCase();
  return { ...of, terminalId: id('terminalId'), ideId: id('ideId') };
}

/**
 * The ABAP user the session runs as. Basic authentication names it; with a
 * token the login is another name, so the system is asked.
 */
async function abapUserOf(connection: IAbapConnection): Promise<string> {
  const configured = process.env.SAP_USERNAME?.split('#')[0].trim();
  if (configured) return configured;
  return systemUserOf(connection);
}

/** The ABAP user the system says the session runs as. */
async function systemUserOf(connection: IAbapConnection): Promise<string> {
  const answer = await connection.makeAdtRequest({
    url: '/sap/bc/adt/core/http/systeminformation',
    method: 'GET',
    timeout: 30_000,
    headers: {
      Accept: 'application/vnd.sap.adt.core.http.systeminformation.v1+json',
    },
  });
  const info =
    typeof answer.data === 'string' ? JSON.parse(answer.data) : answer.data;
  if (!info?.userName) throw new Error('the system named no ABAP user');
  return String(info.userName);
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The promise's value, or `undefined` once `ms` have passed. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), ms),
    ),
  ]);
}

// --- the test --------------------------------------------------------------------

type Connection = IAbapConnection & ISessionLifecycleAware;

/**
 * The shipped readings, except that answers which carry nothing worth a
 * caller's reading are kept as documents: the detach, the check and the delete
 * answers are what this test records.
 */
const readings = {
  ...abapDebuggerDocuments,
  done: rawDocument,
} satisfies IAbapDebuggerResults;
type Debugger = AbapDebugger<typeof readings>;

const debuggerOn = (
  connection: Connection,
  onConflict: 'refuse' | 'takeOver' = 'refuse',
): Debugger =>
  new AbapDebugger(connection, connectionLogger, readings, { onConflict });

interface ICaught {
  debuggeeId: string;
  server?: string;
}

/**
 * What one case opened, so that its `finally` can close all of it whatever
 * failed in between.
 */
class Scope {
  readonly armed: Array<{
    api: Debugger;
    identity: IDebuggerIdentity;
    id: string;
  }> = [];
  readonly keys: Array<{ api: Debugger; identity: IDebuggerIdentity }> = [];
  readonly listeners: Array<{ api: Debugger; identity: IDebuggerIdentity }> =
    [];
  readonly sessions: Connection[] = [];
  readonly attached: Debugger[] = [];
  readonly runs: Array<Promise<unknown>> = [];

  /** Remember the ids a breakpoints answer carries, and the key they live under. */
  arm(
    api: Debugger,
    identity: IDebuggerIdentity,
    answer: IAdtResponse<unknown>,
  ): string[] {
    const ids = breakpointIds(documentOf(answer));
    for (const id of ids) this.armed.push({ api, identity, id });
    if (!this.keys.some((k) => k.api === api && k.identity === identity)) {
      this.keys.push({ api, identity });
    }
    return ids;
  }

  /** The debuggee attached through `api` ended or was left: nothing to terminate. */
  released(api: Debugger): void {
    const at = this.attached.indexOf(api);
    if (at >= 0) this.attached.splice(at, 1);
  }

  listening(api: Debugger, identity: IDebuggerIdentity): void {
    if (!this.listeners.some((l) => l.api === api && l.identity === identity)) {
      this.listeners.push({ api, identity });
    }
  }

  /** A debug session of its own: a new connection, stateful. */
  async openSession(): Promise<{ connection: Connection; api: Debugger }> {
    const connection = await createTestConnection(connectionLogger, {
      ownSession: true,
    });
    connection.setSessionType('stateful');
    this.sessions.push(connection);
    return { connection, api: debuggerOn(connection) };
  }

  async close(): Promise<void> {
    const quietly = async (what: string, work: () => Promise<unknown>) => {
      try {
        await work();
      } catch (error) {
        testsLogger.warn?.(
          `cleanup: ${what}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };
    for (const api of this.attached.splice(0)) {
      await quietly('terminate the debuggee', () =>
        api.terminateDebuggee({ analyse: analyseDebuggeeEnd }),
      );
    }
    for (const { api, identity, id } of this.armed.splice(0)) {
      await quietly(`delete breakpoint ${id}`, () =>
        api.deleteBreakpoint(identity, id),
      );
    }
    // Anything armed under the key that no answer named: an empty full set
    // clears the key.
    for (const { api, identity } of this.keys.splice(0)) {
      await quietly('clear the key', () =>
        api.syncBreakpoints(
          identity,
          { scope: 'full', breakpoints: [] },
          { headers: integrationHeadersOf(api, 'syncBreakpoints') },
        ),
      );
    }
    for (const { api, identity } of this.listeners.splice(0)) {
      await quietly('stop the listener', () => api.stopListener(identity));
    }
    for (const run of this.runs.splice(0)) {
      await within(run, 45_000);
    }
    for (const connection of this.sessions.splice(0)) {
      connection.setSessionType('stateless');
      await quietly('close a session', () =>
        closeOwnTestConnection(connection),
      );
    }
  }
}

describe('ABAP debugger modes (AbapDebugger)', () => {
  let listenerConnection: Connection | undefined;
  let triggerConnection: Connection | undefined;
  /** Arms breakpoints and listens; never attaches. */
  let listenerApi: Debugger;
  let identity: IDebuggerIdentity;
  let packageName = '';
  let transportRequest: string | undefined;
  let skipReason: string | undefined;
  const deployed: string[] = [];

  function skipped(): boolean {
    if (skipReason) {
      testsLogger.info?.(`skipped: ${skipReason}`);
      return true;
    }
    return false;
  }

  function needs(condition: unknown, what: string): void {
    if (!condition) throw new Error(`not reached: ${what}`);
  }

  async function inScope(work: (scope: Scope) => Promise<void>): Promise<void> {
    const scope = new Scope();
    try {
      await work(scope);
    } finally {
      await scope.close();
    }
  }

  /** Run a probe class on the trigger connection (or the given one). */
  function startRun(
    scope: Scope,
    className: string,
    trigger: Connection | undefined = triggerConnection,
  ): Promise<IAdtResponse<unknown>> {
    needs(trigger, 'the trigger connection');
    const run = new ClassExecutor(trigger as Connection, connectionLogger).run({
      className,
    });
    scope.runs.push(run);
    return run;
  }

  /**
   * Listen, start the run once the listener stands, and answer what the
   * listener caught — `undefined` when the hold ran out with nothing.
   */
  async function listenAndRun(
    scope: Scope,
    className: string,
    options: {
      api?: Debugger;
      as?: IDebuggerIdentity;
      holdSeconds?: number;
      trigger?: Connection;
    } = {},
  ): Promise<{ caught?: ICaught; run: Promise<IAdtResponse<unknown>> }> {
    const api = options.api ?? listenerApi;
    const who = options.as ?? identity;
    scope.listening(api, who);
    const listener = api.listen(who, {
      holdSeconds: options.holdSeconds ?? HOLD_SECONDS,
    });
    const early = await within(listener, 2000);
    if (early && !early.ok) {
      throw new Error(
        `the listener was refused (${summary(early)}): another debugger holds ${who.debuggingMode === 'user' ? who.requestUser : 'the terminal'}'s debugging — close it and run again`,
      );
    }
    const run = startRun(scope, className, options.trigger);
    const answer = await listener;
    expect(answer.ok).toBe(true);
    const document = documentOf(answer);
    const debuggeeId = tag(document, 'DEBUGGEE_ID');
    if (!debuggeeId) return { run };
    return {
      run,
      caught: { debuggeeId, server: tag(document, 'INSTANCE_NAME') },
    };
  }

  /** Open a debug session and attach the caught debuggee on it. */
  async function attachOn(
    scope: Scope,
    caught: ICaught,
    as: IDebuggerIdentity = identity,
  ): Promise<{ connection: Connection; api: Debugger }> {
    const session = await scope.openSession();
    const answer = await session.api.attach(as, caught.debuggeeId, {
      server: caught.server,
    });
    if (!answer.ok) {
      throw new Error(`attach refused: ${summary(answer)}`);
    }
    expect(attr(documentOf(answer), 'isSteppingPossible')).toBe('true');
    scope.attached.push(session.api);
    return session;
  }

  async function stopLine(api: Debugger): Promise<number | undefined> {
    const stack = await api.getStack();
    needs(stack.ok, `a stack: ${summary(stack)}`);
    return topLine(documentOf(stack));
  }

  /**
   * Continue until the debuggee ends — through any breakpoints still in the
   * way — and answer the run's output.
   */
  async function continueToEnd(
    scope: Scope,
    api: Debugger,
    run: Promise<IAdtResponse<unknown>>,
  ): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const step = await api.step('stepContinue', {
        analyse: analyseDebuggeeEnd,
      });
      expect(step.ok).toBe(true);
      if (subtypeOf(step) === 'debuggeeEnded') break;
    }
    scope.released(api);
    const output = await run;
    expect(output.ok).toBe(true);
    return documentOf(output).trim();
  }

  /**
   * A run of B with the exception breakpoint and B's END breakpoint armed:
   * caught at the CATCH line, then at END, then to the end.
   */
  async function expectBStopsTwice(scope: Scope): Promise<void> {
    const runB = await listenAndRun(scope, CLASS_B);
    needs(runB.caught, 'B caught');
    const session = await attachOn(scope, runB.caught as ICaught);
    expect(await stopLine(session.api)).toBe(LINE_B.RAISE + 1);
    const next = await session.api.step('stepContinue');
    expect(next.ok).toBe(true);
    expect(await stopLine(session.api)).toBe(LINE_B.END);
    expect(await continueToEnd(scope, session.api, runB.run)).toBe(OUTPUT_B);
  }

  async function deployProbe(className: string, source: string): Promise<void> {
    const cls = new AdtClient(
      listenerConnection as Connection,
      connectionLogger,
    ).getClass();
    const config = {
      className,
      packageName,
      description: 'Debugger modes integration probe',
      ...(transportRequest ? { transportRequest } : {}),
    };
    const created = await cls.create(config, {
      headers: integrationHeadersOf(cls, 'create'),
    });
    // An object that already exists is not ours: neither overwritten here nor
    // deleted in afterAll, so the setup fails instead.
    if (!created.ok) {
      throw new Error(
        `probe ${className} create: ${created.getError().message} (an existing object is never overwritten; remove it or pick another name)`,
      );
    }
    deployed.push(className);
    const lock = await cls.lock(config);
    if (!lock.ok) {
      throw new Error(`probe ${className} lock: ${lock.getError().message}`);
    }
    const lockHandle = String(lock.getResult().value ?? '');
    const written = await cls.update(config, {
      headers: integrationHeadersOf(cls, 'update'),
      source,
      lockHandle,
    });
    await cls.unlock(config, lockHandle);
    if (!written.ok) {
      throw new Error(
        `probe ${className} write: ${written.getError().message}`,
      );
    }
    const activated = await cls.activate(config, {
      headers: integrationHeadersOf(cls, 'activate'),
    });
    if (!activated.ok) {
      throw new Error(
        `probe ${className} activate: ${activated.getError().message}`,
      );
    }
    logTestStep(`probe ${className} active in ${packageName}`, testsLogger);
  }

  beforeAll(async () => {
    if (!testCase) {
      skipReason = 'runtime_debugger.adt_abap_debugger_modes is not enabled';
      return;
    }
    try {
      listenerConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      triggerConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
      skipReason = 'no SAP configuration';
      return;
    }
    identity = identityFor(await abapUserOf(listenerConnection));
    logTestStep(
      `debugging as ${identity.debuggingMode === 'user' ? identity.requestUser : ''}`,
      testsLogger,
    );
    listenerApi = debuggerOn(listenerConnection);
    packageName = resolvePackageName(testCase.params?.package_name);
    // A local package takes no transport.
    transportRequest = packageName.startsWith('$')
      ? undefined
      : resolveTransportRequest(testCase.params?.transport_request) ||
        undefined;

    await deployProbe(CLASS_A, SOURCE_A);
    await deployProbe(CLASS_B, SOURCE_B);

    // Every debugger request needs a stateful session.
    listenerConnection.setSessionType('stateful');
  }, STEP_TIMEOUT);

  afterAll(async () => {
    if (!listenerConnection) return;
    try {
      await listenerApi?.stopListener(identity);
    } catch {
      // nothing listening
    }
    listenerConnection.setSessionType('stateless');
    const cls = new AdtClient(listenerConnection, connectionLogger).getClass();
    const failures: string[] = [];
    for (const className of deployed) {
      // `isDeleted="false"` arrives inside a 200; the reading makes it a failure.
      const answer = await cls.delete(
        {
          className,
          packageName,
          ...(transportRequest ? { transportRequest } : {}),
        },
        {
          headers: integrationHeadersOf(cls, 'delete'),
          analyse: analyseDeletion,
        },
      );
      if (!answer.ok) {
        failures.push(`${className}: ${answer.getError().message}`);
      }
    }
    await closeOwnTestConnection(triggerConnection);
    await closeOwnTestConnection(listenerConnection);
    expect(failures).toEqual([]);
  }, STEP_TIMEOUT);

  // --- 1. syncBreakpoints full -----------------------------------------------------

  it(
    'full: replaces every breakpoint under the key, and an empty set clears it',
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        const armed = await listenerApi.setBreakpoints(
          identity,
          [lineA('LOOP'), lineB()],
          { headers: integrationHeadersOf(listenerApi, 'setBreakpoints') },
        );
        expect(armed.ok).toBe(true);
        expect(scope.arm(listenerApi, identity, armed)).toHaveLength(2);

        const replaced = await listenerApi.syncBreakpoints(
          identity,
          {
            scope: 'full',
            breakpoints: [lineA('END')],
          },
          { headers: integrationHeadersOf(listenerApi, 'syncBreakpoints') },
        );
        expect(replaced.ok).toBe(true);
        expect(
          scope.arm(listenerApi, identity, replaced).length,
        ).toBeGreaterThanOrEqual(1);
        record(1, `full [A:END] answered ${summary(replaced)}`);

        // B's breakpoint was left out of the set: B runs through.
        const runB = await listenAndRun(scope, CLASS_B, {
          holdSeconds: SHORT_HOLD_SECONDS,
        });
        expect(runB.caught).toBeUndefined();
        const outputB = await runB.run;
        expect(outputB.ok).toBe(true);
        expect(documentOf(outputB).trim()).toBe(OUTPUT_B);

        // A stops at END, not at LOOP.
        const runA = await listenAndRun(scope, CLASS_A);
        needs(runA.caught, 'A caught');
        const session = await attachOn(scope, runA.caught as ICaught);
        expect(await stopLine(session.api)).toBe(LINE_A.END);
        expect(await continueToEnd(scope, session.api, runA.run)).toBe(
          OUTPUT_A,
        );

        // An empty full set clears the key: A runs through.
        const cleared = await listenerApi.syncBreakpoints(
          identity,
          {
            scope: 'full',
            breakpoints: [],
          },
          { headers: integrationHeadersOf(listenerApi, 'syncBreakpoints') },
        );
        expect(cleared.ok).toBe(true);
        record(1, `full [] answered ${summary(cleared)}`);
        const again = await listenAndRun(scope, CLASS_A, {
          holdSeconds: SHORT_HOLD_SECONDS,
        });
        expect(again.caught).toBeUndefined();
        const outputA = await again.run;
        expect(outputA.ok).toBe(true);
        expect(documentOf(outputA).trim()).toBe(OUTPUT_A);
      });
    },
    STEP_TIMEOUT,
  );

  // --- 2. syncBreakpoints partial --------------------------------------------------

  it(
    "partial: replaces A's line breakpoints and keeps B's and the exception breakpoint",
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        const armed = await listenerApi.setBreakpoints(
          identity,
          [lineA('LOOP'), lineB(), zeroDivide],
          { headers: integrationHeadersOf(listenerApi, 'setBreakpoints') },
        );
        expect(armed.ok).toBe(true);
        expect(scope.arm(listenerApi, identity, armed)).toHaveLength(3);

        const synced = await listenerApi.syncBreakpoints(
          identity,
          {
            scope: 'partial',
            objects: [CLASS_URI_A],
            breakpoints: [lineA('END')],
          },
          { headers: integrationHeadersOf(listenerApi, 'syncBreakpoints') },
        );
        expect(synced.ok).toBe(true);
        expect(
          scope.arm(listenerApi, identity, synced).length,
        ).toBeGreaterThanOrEqual(1);
        record(2, `partial [A] with [A:END] answered ${summary(synced)}`);

        // B's line breakpoint and the exception breakpoint are out of the
        // scope: both kept. B stops on the exception first, then at END.
        await expectBStopsTwice(scope);

        // A's LOOP was replaced by END.
        const runA = await listenAndRun(scope, CLASS_A);
        needs(runA.caught, 'A caught');
        const sessionA = await attachOn(scope, runA.caught as ICaught);
        expect(await stopLine(sessionA.api)).toBe(LINE_A.END);
        expect(await continueToEnd(scope, sessionA.api, runA.run)).toBe(
          OUTPUT_A,
        );

        // A line breakpoint in B sent within A's scope is refused. The text
        // is the server's (logon language EN), and names the wrong kinds: it
        // is the one message for "outside the scope".
        const outside = await listenerApi.syncBreakpoints(
          identity,
          {
            scope: 'partial',
            objects: [CLASS_URI_A],
            breakpoints: [lineB()],
          },
          { headers: integrationHeadersOf(listenerApi, 'syncBreakpoints') },
        );
        scope.arm(listenerApi, identity, outside);
        record(2, `partial [A] with [B:END] answered ${summary(outside)}`);
        expect(outside.ok).toBe(true);
        const outsideRows = breakpointRows(documentOf(outside));
        expect(outsideRows).toHaveLength(1);
        expect(attr(outsideRows[0], 'errorKind')).toBe('error');
        expect(attr(outsideRows[0], 'errorMessage')).toBeTruthy();
        expect(attr(outsideRows[0], 'id')).toBeFalsy();

        // An empty set clears A's line breakpoints; B's stay.
        const emptied = await listenerApi.syncBreakpoints(
          identity,
          {
            scope: 'partial',
            objects: [CLASS_URI_A],
            breakpoints: [],
          },
          { headers: integrationHeadersOf(listenerApi, 'syncBreakpoints') },
        );
        expect(emptied.ok).toBe(true);
        expect(breakpointRows(documentOf(emptied))).toHaveLength(0);
        const runA2 = await listenAndRun(scope, CLASS_A, {
          holdSeconds: SHORT_HOLD_SECONDS,
        });
        expect(runA2.caught).toBeUndefined();
        const outputA2 = await runA2.run;
        expect(outputA2.ok).toBe(true);
        expect(documentOf(outputA2).trim()).toBe(OUTPUT_A);
        await expectBStopsTwice(scope);

        // An object that maps to no program, alone and with A.
        const alone = await listenerApi.syncBreakpoints(
          identity,
          {
            scope: 'partial',
            objects: [CLASS_URI_NONE],
            breakpoints: [lineA('LOOP')],
          },
          { headers: integrationHeadersOf(listenerApi, 'syncBreakpoints') },
        );
        scope.arm(listenerApi, identity, alone);
        record(
          2,
          `partial [no program] with [A:LOOP] answered ${summary(alone)}`,
        );
        // Measured: refused, with the same "outside the scope" row.
        expect(alone.ok).toBe(true);
        const aloneRows = breakpointRows(documentOf(alone));
        expect(aloneRows).toHaveLength(1);
        expect(attr(aloneRows[0], 'errorKind')).toBe('error');
        expect(attr(aloneRows[0], 'id')).toBeFalsy();
        const mixed = await listenerApi.syncBreakpoints(
          identity,
          {
            scope: 'partial',
            objects: [CLASS_URI_A, CLASS_URI_NONE],
            breakpoints: [lineA('LOOP')],
          },
          { headers: integrationHeadersOf(listenerApi, 'syncBreakpoints') },
        );
        scope.arm(listenerApi, identity, mixed);
        record(
          2,
          `partial [A, no program] with [A:LOOP] answered ${summary(mixed)}`,
        );
        // Measured: the object that maps scopes the request; the other is
        // passed over, and A's breakpoint is armed.
        expect(mixed.ok).toBe(true);
        expect(breakpointIds(documentOf(mixed))).toHaveLength(1);
      });
    },
    STEP_TIMEOUT,
  );

  // --- 12. what a plain setBreakpoints and a stopped listener leave ---------------

  it(
    'setBreakpoints and stopListener: what each leaves of the breakpoints under the key',
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        /** Arm B:END, do `then`, and answer whether a run of B is still caught. */
        const bAfter = async (
          label: string,
          then: () => Promise<IAdtResponse<unknown>>,
        ): Promise<boolean> => {
          const armed = await listenerApi.setBreakpoints(identity, [lineB()], {
            headers: integrationHeadersOf(listenerApi, 'setBreakpoints'),
          });
          expect(armed.ok).toBe(true);
          scope.arm(listenerApi, identity, armed);
          const answer = await then();
          record(12, `${label} answered ${summary(answer)}`);
          expect(answer.ok).toBe(true);
          const runB = await listenAndRun(scope, CLASS_B, {
            holdSeconds: SHORT_HOLD_SECONDS,
          });
          const caught = !!runB.caught;
          record(12, `after ${label}, a run of B was caught: ${caught}`);
          if (runB.caught) {
            const session = await attachOn(scope, runB.caught);
            expect(await continueToEnd(scope, session.api, runB.run)).toBe(
              OUTPUT_B,
            );
          } else {
            const outputB = await runB.run;
            expect(outputB.ok).toBe(true);
            expect(documentOf(outputB).trim()).toBe(OUTPUT_B);
          }
          return caught;
        };

        // The control: nothing in between, and B is caught.
        expect(
          await bAfter('nothing (control)', () =>
            listenerApi.checkListener(identity),
          ),
        ).toBe(true);
        // Measured: a request without a sync scope replaces everything the
        // key holds - even a validation that arms nothing.
        expect(
          await bAfter('setBreakpoints [A:END]', () =>
            listenerApi.setBreakpoints(identity, [lineA('END')], {
              headers: integrationHeadersOf(listenerApi, 'setBreakpoints'),
            }),
          ),
        ).toBe(false);
        expect(
          await bAfter('setBreakpoints [exception] validationOnly', () =>
            listenerApi.setBreakpoints(identity, [zeroDivide], {
              headers: integrationHeadersOf(listenerApi, 'setBreakpoints'),
              validationOnly: true,
            }),
          ),
        ).toBe(false);
        // Measured: stopping the listener deletes the key's breakpoints, even
        // when no listener is running.
        expect(
          await bAfter('stopListener with no listener running', () =>
            listenerApi.stopListener(identity),
          ),
        ).toBe(false);
        // The closing control: armed again, B is caught - so a run that went
        // bad on the way cannot pass the "not caught" answers above.
        expect(
          await bAfter('nothing (closing control)', () =>
            listenerApi.checkListener(identity),
          ),
        ).toBe(true);
      });
    },
    STEP_TIMEOUT,
  );

  // --- 3. skipCount ----------------------------------------------------------------

  it(
    'skipCount: the server ignores it on an external line breakpoint, the first hit stops',
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        // Sent by hand: the contract has no skipCount any more, because the server
        // ignores it on an external breakpoint - which this measures.
        const raw = await (listenerConnection as Connection).makeAdtRequest({
          url: '/sap/bc/adt/debugger/breakpoints',
          method: 'POST',
          timeout: 60_000,
          data:
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<dbg:breakpoints xmlns:dbg="http://www.sap.com/adt/debugger" xmlns:adtcore="http://www.sap.com/adt/core"' +
            ` debuggingMode="user" scope="external" requestUser="${identity.debuggingMode === 'user' ? identity.requestUser : ''}"` +
            ` terminalId="${identity.terminalId}" ideId="${identity.ideId}">\n` +
            `  <breakpoint kind="line" adtcore:uri="${lineA('LOOP').uri}" skipCount="2"/>\n` +
            '</dbg:breakpoints>',
          headers: {
            'Content-Type': 'application/xml',
            Accept: 'application/xml',
          },
        });
        const rawBody = String(raw.data ?? '');
        record(3, `skipCount 2 armed: ${raw.status} body="${rawBody}"`);
        expect(raw.status).toBe(200);
        // The answer does not echo the skip count.
        expect(rawBody).not.toContain('skipCount');
        const ids = breakpointIds(rawBody);
        expect(ids).toHaveLength(1);
        scope.armed.push({ api: listenerApi, identity, id: ids[0] });
        scope.keys.push({ api: listenerApi, identity });

        const runA = await listenAndRun(scope, CLASS_A);
        needs(runA.caught, 'A caught');
        const session = await attachOn(scope, runA.caught as ICaught);
        expect(await stopLine(session.api)).toBe(LINE_A.LOOP);
        const read = await session.api.getVariables(['LV_I'], {
          headers: integrationHeadersOf(session.api, 'getVariables'),
        });
        expect(read.ok).toBe(true);
        const lvI = values(documentOf(read)).get('LV_I');
        // LV_I counts the passes already made, so the hit is LV_I + 1.
        // Measured: the first hit stops - the skip count is not applied.
        record(
          3,
          `skipCount 2 stopped with LV_I=${lvI} (hit ${Number(lvI) + 1})`,
        );
        expect(lvI).toBe('0');
        expect(await continueToEnd(scope, session.api, runA.run)).toBe(
          OUTPUT_A,
        );
      });
    },
    STEP_TIMEOUT,
  );

  // --- 4. detachDebugger without an id ---------------------------------------------

  it(
    'detachDebugger without an id: the debugger leaves and the run goes on',
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        const armed = await listenerApi.setBreakpoints(
          identity,
          [lineA('LOOP'), lineA('END')],
          { headers: integrationHeadersOf(listenerApi, 'setBreakpoints') },
        );
        expect(armed.ok).toBe(true);
        expect(scope.arm(listenerApi, identity, armed)).toHaveLength(2);

        const runA = await listenAndRun(scope, CLASS_A);
        needs(runA.caught, 'A caught');
        const session = await attachOn(scope, runA.caught as ICaught);
        expect(await stopLine(session.api)).toBe(LINE_A.LOOP);

        // The listener stands before the detach, so a second catch of the
        // same run — at the next LOOP pass or at END — is seen.
        scope.listening(listenerApi, identity);
        const relisten = listenerApi.listen(identity, {
          holdSeconds: SHORT_HOLD_SECONDS,
        });
        await sleep(2000);
        const detached = await session.api.detachDebugger();
        record(4, `detachDebugger() answered ${summary(detached)}`);
        expect(detached.ok).toBe(true);
        expect(documentOf(detached)).toBe('');
        scope.released(session.api);

        const second = await relisten;
        const secondId = tag(documentOf(second), 'DEBUGGEE_ID');
        // Measured: the external breakpoint catches the same run again, at
        // the next pass over the loop line.
        expect(secondId).toBeTruthy();
        const again = await attachOn(scope, {
          debuggeeId: secondId as string,
          server: tag(documentOf(second), 'INSTANCE_NAME'),
        });
        const line = await stopLine(again.api);
        expect(line).toBe(LINE_A.LOOP);
        record(
          4,
          `after the detach the same run was caught again through the listener, at line ${line} (LOOP=${LINE_A.LOOP}, END=${LINE_A.END})`,
        );
        expect(await continueToEnd(scope, again.api, runA.run)).toBe(OUTPUT_A);

        // Not measured: a session breakpoint (scope="debugger") is not offered -
        // setBreakpoints sends scope="external" only - so that half is skipped.
        record(
          4,
          'session breakpoint (scope="debugger") bringing the debugger back: not offered, skipped',
        );
      });
    },
    STEP_TIMEOUT,
  );

  // --- 5. detachDebugger with a caught, unattached id ------------------------------

  it(
    'detachDebugger with the id of a caught debuggee nobody attached',
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        const armed = await listenerApi.setBreakpoints(
          identity,
          [lineA('END')],
          { headers: integrationHeadersOf(listenerApi, 'setBreakpoints') },
        );
        expect(armed.ok).toBe(true);
        expect(scope.arm(listenerApi, identity, armed)).toHaveLength(1);

        const runA = await listenAndRun(scope, CLASS_A);
        needs(runA.caught, 'A caught');
        const fresh = await scope.openSession();
        const started = Date.now();
        const detached = await fresh.api.detachDebugger({
          debuggeeId: (runA.caught as ICaught).debuggeeId,
        });
        record(
          5,
          `detachDebugger({ debuggeeId }) answered ${summary(detached)}`,
        );
        expect(statusOf(detached)).toBe(200);
        expect(documentOf(detached)).toBe('');
        const output = await within(runA.run, 90_000);
        const elapsed = Date.now() - started;

        record(
          5,
          `the run ${output ? `returned ${output.ok ? 'ok' : 'failed'} "${documentOf(output).trim()}"` : 'had not returned'} ${elapsed} ms after the detach`,
        );
        expect(output).toBeDefined();
        expect((output as IAdtResponse<unknown>).ok).toBe(true);
        expect(documentOf(output as IAdtResponse<unknown>).trim()).toBe(
          OUTPUT_A,
        );
        // Measured ~1 s: at once, not after the ~30 s hold.
        expect(elapsed).toBeLessThan(15_000);
      });
    },
    STEP_TIMEOUT,
  );

  // --- 6. detachDebugger with an id another session attached -----------------------

  it(
    'detachDebugger with the id of a debuggee another session attached',
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        const armed = await listenerApi.setBreakpoints(
          identity,
          [lineA('END')],
          { headers: integrationHeadersOf(listenerApi, 'setBreakpoints') },
        );
        expect(armed.ok).toBe(true);
        expect(scope.arm(listenerApi, identity, armed)).toHaveLength(1);

        const runA = await listenAndRun(scope, CLASS_A);
        needs(runA.caught, 'A caught');
        const s1 = await attachOn(scope, runA.caught as ICaught);
        expect(await stopLine(s1.api)).toBe(LINE_A.END);

        const s2 = await scope.openSession();
        const detached = await s2.api.detachDebugger({
          debuggeeId: (runA.caught as ICaught).debuggeeId,
        });

        record(
          6,
          `detachDebugger({ debuggeeId }) on a second session answered ${summary(detached)}`,
        );
        // As the source says: success all the same.
        expect(statusOf(detached)).toBe(200);

        const stepped = await s1.api.step('stepOver', {
          analyse: analyseDebuggeeEnd,
        });
        record(
          6,
          `the attached session's stepOver answered ${summary(stepped)}`,
        );
        // Measured: the attached session keeps the debuggee and steps on.
        expect(stepped.ok).toBe(true);
        expect(attr(documentOf(stepped), 'isSteppingPossible')).toBe('true');
        if (stepped.ok && subtypeOf(stepped) !== 'debuggeeEnded') {
          expect(await continueToEnd(scope, s1.api, runA.run)).toBe(OUTPUT_A);
        } else {
          scope.released(s1.api);
          const output = await within(runA.run, 60_000);
          record(
            6,
            `the run ${output ? `returned "${documentOf(output).trim()}"` : 'had not returned after 60 s'}`,
          );
        }
      });
    },
    STEP_TIMEOUT,
  );

  // --- 7. terminateDebugger --------------------------------------------------------

  it(
    'terminateDebugger: the debugger is freed and the run finishes with its output',
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        const armed = await listenerApi.setBreakpoints(
          identity,
          [lineA('END')],
          { headers: integrationHeadersOf(listenerApi, 'setBreakpoints') },
        );
        expect(armed.ok).toBe(true);
        expect(scope.arm(listenerApi, identity, armed)).toHaveLength(1);

        const runA = await listenAndRun(scope, CLASS_A);
        needs(runA.caught, 'A caught');
        const session = await attachOn(scope, runA.caught as ICaught);
        expect(await stopLine(session.api)).toBe(LINE_A.END);

        const terminated = await session.api.terminateDebugger();
        record(7, `terminateDebugger() answered ${summary(terminated)}`);
        // Measured: the server frees the debugger's own ABAP session
        // (SYSTEM-CALL FREE MODE 0), so the request ends in a plain ICF 500 -
        // no ADT exception document - and the session is gone afterwards.
        expect(statusOf(terminated)).toBe(500);
        expect(subtypeOf(terminated)).toBeUndefined();
        scope.released(session.api);

        const output = await within(runA.run, 60_000);
        needs(output, 'the run returning within 60 s');
        expect((output as IAdtResponse<unknown>).ok).toBe(true);
        expect(documentOf(output as IAdtResponse<unknown>).trim()).toBe(
          OUTPUT_A,
        );

        const after = await session.api.getStack();
        record(7, `a stack read on that session afterwards: ${summary(after)}`);
        expect(statusOf(after)).toBe(400);
      });
    },
    STEP_TIMEOUT,
  );

  // --- 8. setDebuggerSettings ------------------------------------------------------

  it(
    'setDebuggerSettings: a mandatory field left out keeps its value; showDataAging does not',
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        const armed = await listenerApi.setBreakpoints(
          identity,
          [lineA('END')],
          { headers: integrationHeadersOf(listenerApi, 'setBreakpoints') },
        );
        expect(armed.ok).toBe(true);
        expect(scope.arm(listenerApi, identity, armed)).toHaveLength(1);

        const runA = await listenAndRun(scope, CLASS_A);
        needs(runA.caught, 'A caught');
        const { api } = await attachOn(scope, runA.caught as ICaught);
        expect(await stopLine(api)).toBe(LINE_A.END);

        const readBack = async (label: string) => {
          const read = await api.getVariables(['LV_I'], {
            headers: integrationHeadersOf(api, 'getVariables'),
          });
          record(
            8,
            `variables after ${label}: ${statusOf(read)} LV_I=${values(documentOf(read)).get('LV_I')}`,
          );
          expect(read.ok).toBe(true);
          expect(values(documentOf(read)).get('LV_I')).toBe('5');
        };

        // The first call after the attach, with systemDebugging=false.
        const first = await api.setDebuggerSettings(
          { systemDebugging: false },
          { headers: integrationHeadersOf(api, 'setDebuggerSettings') },
        );
        record(
          8,
          `first call after the attach, { systemDebugging: false }, answered ${summary(first)}`,
        );
        // The debugger starts with system debugging off, so this cannot tell
        // "ignored" from "applied": it answers false either way.
        expect(first.ok).toBe(true);
        expect(attr(documentOf(first), 'systemDebugging')).toBe('false');
        await readBack('the first call');

        const on = await api.setDebuggerSettings(
          { systemDebugging: true },
          { headers: integrationHeadersOf(api, 'setDebuggerSettings') },
        );
        record(8, `{ systemDebugging: true } answered ${summary(on)}`);
        expect(on.ok).toBe(true);
        expect(attr(documentOf(on), 'systemDebugging')).toBe('true');
        await readBack('systemDebugging true');

        const kept = await api.setDebuggerSettings(
          {},
          { headers: integrationHeadersOf(api, 'setDebuggerSettings') },
        );
        record(8, `{} answered ${summary(kept)}`);
        expect(kept.ok).toBe(true);
        expect(attr(documentOf(kept), 'systemDebugging')).toBe('true');
        await readBack('{}');

        const off = await api.setDebuggerSettings(
          { systemDebugging: false },
          { headers: integrationHeadersOf(api, 'setDebuggerSettings') },
        );
        record(8, `{ systemDebugging: false } answered ${summary(off)}`);
        expect(off.ok).toBe(true);
        expect(attr(documentOf(off), 'systemDebugging')).toBe('false');
        await readBack('systemDebugging false');

        const aging = await api.setDebuggerSettings(
          { showDataAging: true },
          { headers: integrationHeadersOf(api, 'setDebuggerSettings') },
        );
        record(8, `{ showDataAging: true } answered ${summary(aging)}`);
        expect(aging.ok).toBe(true);
        expect(attr(documentOf(aging), 'showDataAging')).toBe('true');
        await readBack('showDataAging true');
        const agingOff = await api.setDebuggerSettings(
          {},
          { headers: integrationHeadersOf(api, 'setDebuggerSettings') },
        );
        record(8, `{} after showDataAging answered ${summary(agingOff)}`);
        expect(agingOff.ok).toBe(true);
        expect(attr(documentOf(agingOff), 'showDataAging') ?? 'false').toBe(
          'false',
        );
        await readBack('{} after showDataAging');

        expect(await continueToEnd(scope, api, runA.run)).toBe(OUTPUT_A);
      });
    },
    STEP_TIMEOUT,
  );

  // --- 9. checkListener ------------------------------------------------------------

  it(
    'checkListener: 200 empty when free, 409 naming the holder when another listener holds the user',
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        const free = await listenerApi.checkListener(identity);
        record(9, `checkListener free answered ${summary(free)}`);
        expect(statusOf(free)).toBe(200);
        expect(documentOf(free).trim()).toBe('');

        const holderConnection = await createTestConnection(connectionLogger, {
          ownSession: true,
        });
        holderConnection.setSessionType('stateful');
        scope.sessions.push(holderConnection);
        const holderIdentity = otherIde(identity, 'check-holder');
        const holder = debuggerOn(holderConnection, 'takeOver');
        scope.listening(holder, holderIdentity);
        const holding = holder.listen(holderIdentity, { holdSeconds: 10 });
        await sleep(2000);

        const busy = await listenerApi.checkListener(identity);
        record(9, `checkListener while held answered ${summary(busy)}`);
        expect(statusOf(busy)).toBe(409);
        expect(busy.ok).toBe(false);
        const conflict = busy.ok
          ? undefined
          : readListenerConflict(busy.getError());
        record(9, `readListenerConflict: ${JSON.stringify(conflict)}`);
        expect(conflict?.conflictText).toBeTruthy();
        // The holder is a listener of our own user under another IDE id.
        expect(conflict?.ideUser).toBe(
          identity.debuggingMode === 'user' ? identity.requestUser : undefined,
        );

        await holding;
      });
    },
    STEP_TIMEOUT,
  );

  // --- 10. terminal mode, without SAP GUI ------------------------------------------

  it(
    'terminal mode: check, listen and stop, set and delete a breakpoint',
    async () => {
      if (skipped()) return;
      await inScope(async (scope) => {
        const terminal: IDebuggerIdentity = {
          debuggingMode: 'terminal',
          terminalId: hex32(),
          ideId: hex32(),
        };

        const checked = await listenerApi.checkListener(terminal);
        record(10, `terminal checkListener answered ${summary(checked)}`);
        expect(statusOf(checked)).toBe(200);

        scope.listening(listenerApi, terminal);
        const listened = await listenerApi.listen(terminal, { holdSeconds: 5 });
        record(
          10,
          `terminal listener (hold 5 s) answered ${summary(listened)}`,
        );
        expect(listened.ok).toBe(true);
        const stopped = await listenerApi.stopListener(terminal);
        record(10, `terminal stopListener answered ${summary(stopped)}`);
        expect(stopped.ok).toBe(true);

        const armed = await listenerApi.setBreakpoints(
          terminal,
          [lineA('LOOP')],
          { headers: integrationHeadersOf(listenerApi, 'setBreakpoints') },
        );
        record(10, `terminal breakpoint answered ${summary(armed)}`);
        expect(armed.ok).toBe(true);
        const ids = scope.arm(listenerApi, terminal, armed);
        expect(ids).toHaveLength(1);
        const deleted = await listenerApi.deleteBreakpoint(terminal, ids[0]);
        record(10, `terminal deleteBreakpoint answered ${summary(deleted)}`);
        expect(statusOf(deleted)).toBe(200);
        scope.armed.splice(0);
      });
    },
    STEP_TIMEOUT,
  );

  // --- 11. another user ------------------------------------------------------------

  /**
   * A connection as the user the env file names: the variables the connection
   * is built from are swapped for the file's while it is opened, then restored.
   */
  async function connectionAs(
    env: Record<string, string>,
  ): Promise<Connection> {
    const read = [
      'SAP_URL',
      'SAP_CLIENT',
      'SAP_AUTH_TYPE',
      'SAP_USERNAME',
      'SAP_PASSWORD',
      'SAP_JWT_TOKEN',
      'SAP_REFRESH_TOKEN',
      'SAP_UAA_URL',
      'SAP_UAA_CLIENT_ID',
      'SAP_UAA_CLIENT_SECRET',
      'UAA_URL',
      'UAA_CLIENT_ID',
      'UAA_CLIENT_SECRET',
      'SAP_UNICODE',
    ];
    const keys = [...new Set([...read, ...Object.keys(env)])];
    const saved = new Map(keys.map((k) => [k, process.env[k]]));
    try {
      for (const key of keys) {
        if (env[key] === undefined) delete process.env[key];
        else process.env[key] = env[key];
      }
      return await createTestConnection(connectionLogger, { ownSession: true });
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  it(
    "another user: our debugger catches the second user's run of A",
    async () => {
      if (skipped()) return;
      if (!SECOND_USER_ENV) {
        testsLogger.info?.('skipped: second_user_env is empty');
        return;
      }
      const file = SECOND_USER_ENV.startsWith('~/')
        ? path.join(os.homedir(), SECOND_USER_ENV.slice(2))
        : SECOND_USER_ENV;
      const env = dotenv.parse(fs.readFileSync(file));
      const otherUser = env.SAP_USERNAME?.split('#')[0].trim().toUpperCase();
      needs(otherUser, 'SAP_USERNAME in second_user_env');

      await inScope(async (scope) => {
        const otherConnection = await connectionAs(env);
        scope.sessions.push(otherConnection);
        // The run must come from the second user, or nothing is measured.
        // Compared, never printed.
        const runsAs = (await systemUserOf(otherConnection)).toUpperCase();
        record(
          11,
          `the second connection runs as the second user: ${runsAs === otherUser}; as the first user: ${runsAs === (identity.debuggingMode === 'user' ? identity.requestUser : '')}`,
        );
        expect(runsAs === otherUser).toBe(true);

        const forOther = otherIde(
          {
            ...identity,
            requestUser: otherUser as string,
          } as IDebuggerIdentity,
          'other-user',
        );
        // A listener session of its own. The server keeps, per ABAP session,
        // the listener context of the first user-mode listener request
        // (CL_TPDAPI_SERVICE caches it): on the session that has listened for
        // our own user, a listener for the second user waits for ours, and the
        // second user's run goes through uncaught (measured).
        const takerSession = await scope.openSession();
        const taker = debuggerOn(takerSession.connection, 'takeOver');
        const armed = await taker.setBreakpoints(forOther, [lineA('LOOP')], {
          headers: integrationHeadersOf(taker, 'setBreakpoints'),
        });
        expect(armed.ok).toBe(true);
        expect(scope.arm(taker, forOther, armed)).toHaveLength(1);

        const runA = await listenAndRun(scope, CLASS_A, {
          api: taker,
          as: forOther,
          trigger: otherConnection,
        });
        needs(runA.caught, "the second user's run caught");
        const session = await attachOn(scope, runA.caught as ICaught, forOther);
        expect(await stopLine(session.api)).toBe(LINE_A.LOOP);
        expect(await continueToEnd(scope, session.api, runA.run)).toBe(
          OUTPUT_A,
        );
      });
    },
    STEP_TIMEOUT,
  );
});
