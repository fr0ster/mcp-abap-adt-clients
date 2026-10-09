/**
 * Integration test for the ABAP debugger (AbapDebugger), every member of
 * IAbapDebugger against a live system.
 *
 * The test deploys a small class implementing IF_OO_ADT_CLASSRUN, then drives
 * two runs of it through the debugger: the first from the first breakpoint to
 * the program's end, the second caught and terminated where it stands. A third
 * part opens two listeners of its own to see what a conflict answers. The
 * steps depend on each other in order — one debug session is one sequence —
 * so a step whose prerequisite failed fails naming it.
 *
 * Nothing else may listen for the same SAP user while this runs: an Eclipse
 * with a breakpoint set holds the user's debugging, the listeners here refuse
 * to displace it (the AbapDebugger default) and the run cannot start.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- src/__tests__/integration/runtime/debugger/AbapDebugger.test.ts
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAdtResponse, IAdtRunnable } from '@mcp-abap-adt/interfaces-adt';
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
} from '../../../../runtime/debugger/AbapDebugger';
import type {
  IDebuggerBreakpoint,
  IDebuggerIdentity,
} from '../../../../runtime/debugger/contracts';
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

const testCase = getEnabledTestCase('runtime_debugger', 'adt_abap_debugger');
const CLASS_NAME: string = (
  testCase?.params?.class_name ?? 'ZAC_DBG_PROBE'
).toUpperCase();
const HOLD_SECONDS = 30;
const STEP_TIMEOUT = 120_000;

/**
 * The probe. `"BP:<name>` markers name the lines the test stops at; the work
 * is deterministic, so every run stops at the same lines with the same values.
 */
const SOURCE = `CLASS ${CLASS_NAME.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.
  PRIVATE SECTION.
    METHODS add
      IMPORTING iv_a TYPE i
                iv_b TYPE i
      RETURNING VALUE(rv) TYPE i.
ENDCLASS.

CLASS ${CLASS_NAME.toLowerCase()} IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    DATA lv_total TYPE i.
    DATA lv_text TYPE string VALUE 'start'.
    DO 3 TIMES.
      lv_total = add( iv_a = lv_total iv_b = sy-index ). "BP:loop
    ENDDO.
    lv_text = |total { lv_total }|. "BP:after
    TRY.
        DATA(lv_zero) = 0.
        lv_total = lv_total / lv_zero. "BP:raise
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

const LINE: Record<string, number> = {};
SOURCE.split('\n').forEach((text, index) => {
  const marker = /"BP:(\w+)/.exec(text);
  if (marker) LINE[marker[1]] = index + 1;
});
const SOURCE_URI = `/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main`;

// --- reading the documents ------------------------------------------------------

function attr(xml: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
}

function tag(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];
}

interface IFrame {
  position: number;
  program: string;
  event: string;
  line: number;
}

function frames(stackXml: string): IFrame[] {
  return [...stackXml.matchAll(/<stackEntry\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((e) => attr(e, 'stackType') === 'ABAP')
    .map((e) => ({
      position: Number(attr(e, 'stackPosition')),
      program: attr(e, 'programName') ?? '',
      event: attr(e, 'eventName') ?? '',
      line: Number(attr(e, 'line')),
    }));
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

function identityFor(user: string): IDebuggerIdentity {
  const requestUser = user.toUpperCase();
  const id = (suffix: string): string =>
    createHash('sha256')
      .update(`${process.env.SAP_URL}:${requestUser}:${suffix}`)
      .digest('hex')
      .slice(0, 32)
      .toUpperCase();
  return { requestUser, terminalId: id('terminalId'), ideId: id('ideId') };
}

// --- the test --------------------------------------------------------------------

type Connection = IAbapConnection & ISessionLifecycleAware;

/** The probe class runs through classrun. */
const asClass = (connection: Connection) =>
  new ClassExecutor(connection, connectionLogger);

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

describe('ABAP debugger (AbapDebugger)', () => {
  let debuggerConnection: Connection | undefined;
  let triggerConnection: Connection | undefined;
  let debuggerApi: AbapDebugger;
  let identity: IDebuggerIdentity;
  let packageName = '';
  let transportRequest: string | undefined;
  let skipReason: string | undefined;

  const armed: string[] = [];
  let run: Promise<IAdtResponse<unknown>> | undefined;
  let attached = false;
  let watchpointId: string | undefined;

  /** Fails the step naming what it waited on, instead of running blind. */
  function needs(condition: unknown, what: string): void {
    if (!condition) throw new Error(`not reached: ${what}`);
  }

  function skipped(): boolean {
    if (skipReason) {
      testsLogger.info?.(`skipped: ${skipReason}`);
      return true;
    }
    return false;
  }

  /**
   * Listen, start the program on the other session through any runnable — a
   * class, a report, whatever implements IAdtRunnable — and answer what was
   * caught.
   */
  async function catchRun<TTarget>(
    runnable: (connection: Connection) => IAdtRunnable<TTarget, unknown>,
    target: TTarget,
  ): Promise<string> {
    const listener = debuggerApi.listen(identity, {
      holdSeconds: HOLD_SECONDS,
    });
    const early = await Promise.race([
      listener,
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), 2000),
      ),
    ]);
    if (early && !early.ok) {
      throw new Error(
        `the listener was refused (${statusOf(early)} ${subtypeOf(early) ?? ''}): another debugger holds ${identity.requestUser}'s debugging — close it and run again`,
      );
    }
    const trigger = triggerConnection;
    needs(trigger, 'the trigger connection');
    run = runnable(trigger as Connection).run(target);
    const caught = await listener;
    const document = documentOf(caught);
    expect(caught.ok).toBe(true);
    const debuggeeId = tag(document, 'DEBUGGEE_ID');
    needs(
      debuggeeId,
      `a debuggee in the listener's answer: ${document.slice(0, 300)}`,
    );
    expect(tag(document, 'DBGEE_KIND')).toBe('DEBUGGEE');
    return debuggeeId as string;
  }

  async function topFrame(): Promise<IFrame> {
    const stack = await debuggerApi.getStack();
    const top = frames(documentOf(stack))[0];
    needs(stack.ok && top, 'a stack');
    return top;
  }

  beforeAll(async () => {
    if (!testCase) {
      skipReason = 'runtime_debugger.adt_abap_debugger is not enabled';
      return;
    }
    try {
      debuggerConnection = await createTestConnection(connectionLogger, {
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
    identity = identityFor(String(process.env.SAP_USERNAME ?? ''));
    debuggerApi = new AbapDebugger(
      debuggerConnection,
      connectionLogger,
      abapDebuggerDocuments,
    );
    packageName = resolvePackageName(testCase.params?.package_name);
    // A local package takes no transport.
    transportRequest = packageName.startsWith('$')
      ? undefined
      : resolveTransportRequest(testCase.params?.transport_request) ||
        undefined;

    const cls = new AdtClient(debuggerConnection, connectionLogger).getClass();
    const config = {
      className: CLASS_NAME,
      packageName,
      description: 'Debugger integration probe',
      ...(transportRequest ? { transportRequest } : {}),
    };
    const created = await cls.create(config);
    if (!created.ok && !/exist/i.test(created.getError().message ?? '')) {
      throw new Error(`probe create: ${created.getError().message}`);
    }
    const lock = await cls.lock(config);
    if (!lock.ok) throw new Error(`probe lock: ${lock.getError().message}`);
    const lockHandle = String(lock.getResult().value ?? '');
    const written = await cls.update(config, { source: SOURCE, lockHandle });
    await cls.unlock(config, lockHandle);
    if (!written.ok)
      throw new Error(`probe write: ${written.getError().message}`);
    const activated = await cls.activate(config);
    if (!activated.ok)
      throw new Error(`probe activate: ${activated.getError().message}`);
    logTestStep(`probe ${CLASS_NAME} active in ${packageName}`, testsLogger);

    // Every debugger request needs the stateful session it attached on.
    debuggerConnection.setSessionType('stateful');
  }, STEP_TIMEOUT);

  afterAll(async () => {
    if (!debuggerConnection) return;
    for (const id of armed) {
      await debuggerApi.deleteBreakpoint(identity, id);
    }
    if (attached) await debuggerApi.terminateDebuggee();
    await debuggerApi.stopListener(identity);
    if (run) {
      await Promise.race([
        run,
        new Promise((resolve) => setTimeout(resolve, 15_000)),
      ]);
    }
    debuggerConnection.setSessionType('stateless');
    if (!testCase?.params?.keep_probe) {
      await new AdtClient(debuggerConnection, connectionLogger)
        .getClass()
        .delete({
          className: CLASS_NAME,
          packageName,
          ...(transportRequest ? { transportRequest } : {}),
        });
    }
    await closeOwnTestConnection(triggerConnection);
    await closeOwnTestConnection(debuggerConnection);
  }, STEP_TIMEOUT);

  // --- breakpoints -----------------------------------------------------------------

  it(
    'validates all four kinds of breakpoint without arming them',
    async () => {
      if (skipped()) return;
      const all: IDebuggerBreakpoint[] = [
        { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.loop}` },
        { kind: 'exception', exceptionClass: 'CX_SY_ZERODIVIDE' },
        { kind: 'statement', statement: 'RAISE EXCEPTION' },
        { kind: 'message', msgId: '00', msgNo: '001', msgTy: 'E' },
      ];
      const answer = await debuggerApi.setBreakpoints(identity, all, {
        validationOnly: true,
      });
      const document = documentOf(answer);
      expect(answer.ok).toBe(true);
      const rows = [...document.matchAll(/<breakpoint\b[^>]*>/g)].map(
        (m) => m[0],
      );
      expect(rows.map((r) => attr(r, 'kind'))).toEqual([
        'line',
        'exception',
        'statement',
        'message',
      ]);
      for (const row of rows) expect(attr(row, 'errorMessage')).toBeFalsy();
    },
    STEP_TIMEOUT,
  );

  it(
    'arms a line and an exception breakpoint; the line comes back in its include',
    async () => {
      if (skipped()) return;
      const answer = await debuggerApi.setBreakpoints(identity, [
        { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.loop}` },
        { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.catch}` },
        { kind: 'exception', exceptionClass: 'CX_SY_ZERODIVIDE' },
      ]);
      expect(answer.ok).toBe(true);
      const ids = [
        ...documentOf(answer).matchAll(/<breakpoint\b[^>]*\bid="([^"]*)"/g),
      ].map((m) => m[1]);
      armed.push(...ids);
      expect(ids).toHaveLength(3);
      // Renumbered: a class-source line becomes the method include's own.
      expect(ids[0]).toMatch(/KIND=0\..*LINE_NR=\d+$/);
      expect(ids[0]).not.toMatch(new RegExp(`LINE_NR=${LINE.loop}$`));
      expect(ids[2]).toBe('KIND=5.EXCEPTION_CLASS=CX_SY_ZERODIVIDE');
    },
    STEP_TIMEOUT,
  );

  // --- run 1: from the first breakpoint to the end ---------------------------------

  it(
    'catches the run on the first breakpoint and attaches',
    async () => {
      if (skipped()) return;
      needs(armed.length === 3, 'armed breakpoints');
      const debuggeeId = await catchRun(asClass, { className: CLASS_NAME });
      const answer = await debuggerApi.attach(identity.requestUser, debuggeeId);
      const document = documentOf(answer);
      expect(answer.ok).toBe(true);
      expect(attr(document, 'isSteppingPossible')).toBe('true');
      expect(attr(document, 'debugSessionId')).toBeTruthy();
      attached = true;
    },
    STEP_TIMEOUT,
  );

  it(
    'reads the stack: the probe on top, at the loop line',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      const top = await topFrame();
      expect(top.program.startsWith(CLASS_NAME)).toBe(true);
      expect(top.event).toBe('IF_OO_ADT_CLASSRUN~MAIN');
      expect(top.line).toBe(LINE.loop);
    },
    STEP_TIMEOUT,
  );

  it(
    'expands the variable scopes and reads the locals',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      const root = await debuggerApi.getChildVariables(['@ROOT']);
      expect(root.ok).toBe(true);
      const scopes = [
        ...documentOf(root).matchAll(/<CHILD_ID>([^<]*)<\/CHILD_ID>/g),
      ].map((m) => m[1]);
      expect(scopes).toContain('@LOCALS');
      const all = await debuggerApi.getChildVariables(scopes);
      expect(all.ok).toBe(true);
      const locals = values(documentOf(all));
      expect(locals.get('LV_TOTAL')).toBe('0');
      expect(locals.get('LV_TEXT')).toBe('start');
    },
    STEP_TIMEOUT,
  );

  it(
    'reads one variable by its id',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      const answer = await debuggerApi.getVariables(['LV_TOTAL']);
      expect(answer.ok).toBe(true);
      expect(values(documentOf(answer)).get('LV_TOTAL')).toBe('0');
    },
    STEP_TIMEOUT,
  );

  it(
    'steps into the called method and sees its parameters',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      expect((await debuggerApi.step('stepInto')).ok).toBe(true);
      const top = await topFrame();
      expect(top.event).toBe('ADD');
      expect(top.line).toBe(LINE.add);
      const params = values(
        documentOf(await debuggerApi.getVariables(['IV_A', 'IV_B'])),
      );
      expect(params.get('IV_A')).toBe('0');
      expect(params.get('IV_B')).toBe('1');
    },
    STEP_TIMEOUT,
  );

  it(
    'moves the read cursor to the caller frame without moving the program',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      const stack = frames(documentOf(await debuggerApi.getStack()));
      const caller = stack.find((f) => f.event === 'IF_OO_ADT_CLASSRUN~MAIN');
      needs(caller, 'the caller frame');
      const moved = await debuggerApi.setStackPosition(
        (caller as IFrame).position,
      );
      expect(moved.ok).toBe(true);
      // The caller's local is readable from here…
      expect(
        values(documentOf(await debuggerApi.getVariables(['LV_TOTAL']))).get(
          'LV_TOTAL',
        ),
      ).toBe('0');
      // …and the program still stands in the method.
      expect((await topFrame()).event).toBe('ADD');
    },
    STEP_TIMEOUT,
  );

  it(
    'returns from the method to the caller',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      expect((await debuggerApi.step('stepReturn')).ok).toBe(true);
      const top = await topFrame();
      expect(top.event).toBe('IF_OO_ADT_CLASSRUN~MAIN');
      expect(
        values(documentOf(await debuggerApi.getVariables(['LV_TOTAL']))).get(
          'LV_TOTAL',
        ),
      ).toBe('1');
    },
    STEP_TIMEOUT,
  );

  it(
    'creates and lists a watchpoint, and continues to the next breakpoint',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      const created = await debuggerApi.createWatchpoint('LV_TOTAL');
      expect(created.ok).toBe(true);
      watchpointId = attr(documentOf(created), 'id');
      needs(
        watchpointId,
        `a watchpoint id: ${documentOf(created).slice(0, 300)}`,
      );

      const listed = await debuggerApi.listWatchpoints();
      expect(listed.ok).toBe(true);
      expect(documentOf(listed)).toContain(`id="${watchpointId}"`);

      // The loop breakpoint comes first: the assignment is on its line.
      const step = await debuggerApi.step('stepContinue');
      expect(step.ok).toBe(true);
      expect(documentOf(step)).toContain('KIND=0.');
      expect((await topFrame()).line).toBe(LINE.loop);
    },
    STEP_TIMEOUT,
  );

  it(
    'stops on the watchpoint when the watched variable changes, then removes it',
    async () => {
      if (skipped()) return;
      needs(watchpointId, 'a watchpoint');
      const step = await debuggerApi.step('stepContinue');
      expect(step.ok).toBe(true);
      expect(documentOf(step)).toMatch(/reachedWatchpoints/);
      expect(
        values(documentOf(await debuggerApi.getVariables(['LV_TOTAL']))).get(
          'LV_TOTAL',
        ),
      ).toBe('3');

      const deleted = await debuggerApi.deleteWatchpoint(
        watchpointId as string,
      );
      expect(deleted.ok).toBe(true);
      watchpointId = undefined;
    },
    STEP_TIMEOUT,
  );

  it(
    'writes a variable at the stop and reads the new value back',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      const written = await debuggerApi.setVariableValue('LV_TOTAL', '100');
      expect(written.ok).toBe(true);
      expect(
        values(documentOf(await debuggerApi.getVariables(['LV_TOTAL']))).get(
          'LV_TOTAL',
        ),
      ).toBe('100');
    },
    STEP_TIMEOUT,
  );

  it(
    'runs to a chosen line',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      // The loop breakpoint is in the way on the last iteration; out of it first.
      const ran = await debuggerApi.step('stepRunToLine', {
        uri: `${SOURCE_URI}#start=${LINE.after}`,
      });
      expect(ran.ok).toBe(true);
      const top = await topFrame();
      expect([LINE.loop, LINE.after]).toContain(top.line);
      if (top.line === LINE.loop) {
        expect(
          (
            await debuggerApi.step('stepRunToLine', {
              uri: `${SOURCE_URI}#start=${LINE.after}`,
            })
          ).ok,
        ).toBe(true);
        expect((await topFrame()).line).toBe(LINE.after);
      }
    },
    STEP_TIMEOUT,
  );

  it(
    'steps over a statement',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      const before = (await topFrame()).line;
      expect((await debuggerApi.step('stepOver')).ok).toBe(true);
      expect((await topFrame()).line).toBeGreaterThan(before);
    },
    STEP_TIMEOUT,
  );

  it(
    'stops on the exception breakpoint, reported at the CATCH line',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      const step = await debuggerApi.step('stepContinue');
      expect(step.ok).toBe(true);
      expect(documentOf(step)).toContain(
        'KIND=5.EXCEPTION_CLASS=CX_SY_ZERODIVIDE',
      );
      // Measured on premise (2026-10-09): the stack names the CATCH line,
      // not the raising statement above it.
      expect((await topFrame()).line).toBe(LINE.raise + 1);
    },
    STEP_TIMEOUT,
  );

  it(
    'continues to the end: the step answers debuggeeEnded and the run returns',
    async () => {
      if (skipped()) return;
      needs(attached, 'an attached debuggee');
      // The CATCH line breakpoint, then the end.
      const toCatch = await debuggerApi.step('stepContinue');
      expect(toCatch.ok).toBe(true);
      expect((await topFrame()).line).toBe(LINE.catch);

      const toEnd = await debuggerApi.step('stepContinue');
      expect(toEnd.ok).toBe(false);
      expect(statusOf(toEnd)).toBe(500);
      expect(subtypeOf(toEnd)).toBe('debuggeeEnded');
      attached = false;

      needs(run, 'the run');
      const output = await (run as Promise<IAdtResponse<unknown>>);
      expect(output.ok).toBe(true);
      expect(documentOf(output).trim()).toBe('caught');
      run = undefined;
    },
    STEP_TIMEOUT,
  );

  // --- run 2: terminated where it stands -------------------------------------------

  it(
    'terminates a debuggee where it stands, and the run returns',
    async () => {
      if (skipped()) return;
      needs(armed.length === 3, 'armed breakpoints');
      // A session that has attached once cannot attach again: measured on
      // premise (2026-10-09), the second attach on the same connection is
      // answered 500 AdiFailed "Debuggee already attached". A new debug
      // session gets a connection of its own; the breakpoints are the user's
      // and stay armed.
      const used = debuggerConnection;
      debuggerConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      debuggerConnection.setSessionType('stateful');
      debuggerApi = new AbapDebugger(
        debuggerConnection,
        connectionLogger,
        abapDebuggerDocuments,
      );
      used?.setSessionType('stateless');
      await closeOwnTestConnection(used);

      const debuggeeId = await catchRun(asClass, { className: CLASS_NAME });
      const second = await debuggerApi.attach(identity.requestUser, debuggeeId);
      expect(second.ok).toBe(true);
      attached = true;
      expect((await topFrame()).line).toBe(LINE.loop);

      const terminated = await debuggerApi.terminateDebuggee();
      // abapsmith records a 500 with the subtype terminateDebuggee as the
      // success shape; whichever answer comes, the debuggee must be gone.
      testsLogger.info?.(
        `terminateDebuggee answered ${statusOf(terminated)} ${subtypeOf(terminated) ?? ''}`,
      );
      expect(
        terminated.ok || subtypeOf(terminated) === 'terminateDebuggee',
      ).toBe(true);
      attached = false;

      const afterwards = await debuggerApi.getStack();
      expect(afterwards.ok).toBe(false);

      needs(run, 'the run');
      const settled = await Promise.race([
        run as Promise<IAdtResponse<unknown>>,
        new Promise<undefined>((resolve) =>
          setTimeout(() => resolve(undefined), 30_000),
        ),
      ]);
      expect(settled).toBeDefined();
      run = undefined;
    },
    STEP_TIMEOUT,
  );

  it(
    'deletes the armed breakpoints and the listener',
    async () => {
      if (skipped()) return;
      for (const id of armed.splice(0)) {
        expect((await debuggerApi.deleteBreakpoint(identity, id)).ok).toBe(
          true,
        );
      }
      expect((await debuggerApi.stopListener(identity)).ok).toBe(true);
    },
    STEP_TIMEOUT,
  );

  // --- conflict: two listeners for one user -----------------------------------------

  it(
    'a refusing listener is answered 409 while another one listens for the user',
    async () => {
      if (skipped()) return;
      const holderConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      holderConnection.setSessionType('stateful');
      const holderIdentity = otherIde(identity, 'holder');
      // The holder registers the way Eclipse does — with the conflict
      // parameters — from an IDE of its own.
      const holder = new AbapDebugger(
        holderConnection,
        connectionLogger,
        abapDebuggerDocuments,
        { onConflict: 'refuse' },
      );
      try {
        const holding = holder.listen(holderIdentity, { holdSeconds: 10 });
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const refused = await debuggerApi.listen(identity, {
          holdSeconds: 10,
        });
        expect(statusOf(refused)).toBe(409);
        expect(subtypeOf(refused)).toBe('conflictDetected');

        await holding;
      } finally {
        await holder.stopListener(holderIdentity);
        holderConnection.setSessionType('stateless');
        await closeOwnTestConnection(holderConnection);
      }
    },
    STEP_TIMEOUT,
  );

  it(
    'a taking-over listener is accepted while another one listens for the user',
    async () => {
      if (skipped()) return;
      const holderConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      holderConnection.setSessionType('stateful');
      const holderIdentity = otherIde(identity, 'holder');
      // The one being displaced listens the way Eclipse does.
      const holder = new AbapDebugger(
        holderConnection,
        connectionLogger,
        abapDebuggerDocuments,
        { onConflict: 'refuse' },
      );
      const taker = new AbapDebugger(
        debuggerConnection as Connection,
        connectionLogger,
        abapDebuggerDocuments,
        { onConflict: 'takeOver' },
      );
      try {
        const holding = holder.listen(holderIdentity, { holdSeconds: 20 });
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const taking = taker.listen(identity, { holdSeconds: 5 });
        // Measured on premise (2026-10-09): the displaced long poll returns
        // at once, 409 with the subtype conflictNotification — the notice
        // Eclipse shows.
        const displaced = await holding;
        expect(statusOf(displaced)).toBe(409);
        expect(subtypeOf(displaced)).toBe('conflictNotification');
        const took = await taking;
        expect(took.ok).toBe(true);
      } finally {
        await taker.stopListener(identity);
        await holder.stopListener(holderIdentity);
        holderConnection.setSessionType('stateless');
        await closeOwnTestConnection(holderConnection);
      }
    },
    STEP_TIMEOUT,
  );

  it(
    'a refusing listener sees a conflict with one registered without the conflict parameters',
    async () => {
      if (skipped()) return;
      const holderConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      holderConnection.setSessionType('stateful');
      const holderIdentity = otherIde(identity, 'quiet-holder');
      const holder = new AbapDebugger(
        holderConnection,
        connectionLogger,
        abapDebuggerDocuments,
        { onConflict: 'takeOver' },
      );
      try {
        const holding = holder.listen(holderIdentity, { holdSeconds: 10 });
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Measured on premise (2026-10-09): the conflict is seen whatever
        // parameters the other listener registered with.
        const beside = await debuggerApi.listen(identity, { holdSeconds: 3 });
        expect(statusOf(beside)).toBe(409);
        expect(subtypeOf(beside)).toBe('conflictDetected');

        await holding;
      } finally {
        await debuggerApi.stopListener(identity);
        await holder.stopListener(holderIdentity);
        holderConnection.setSessionType('stateless');
        await closeOwnTestConnection(holderConnection);
      }
    },
    STEP_TIMEOUT,
  );

  it(
    'two listeners of one IDE — the same IDE id — do not conflict',
    async () => {
      if (skipped()) return;
      const otherConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      otherConnection.setSessionType('stateful');
      // Another terminal of the same IDE: only the terminal id differs.
      const sameIde: IDebuggerIdentity = {
        ...identity,
        terminalId: otherIde(identity, 'same-ide').terminalId,
      };
      const other = new AbapDebugger(
        otherConnection,
        connectionLogger,
        abapDebuggerDocuments,
      );
      try {
        const holding = other.listen(sameIde, { holdSeconds: 10 });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Measured on premise (2026-10-09): 200 after the hold, no 409.
        const beside = await debuggerApi.listen(identity, { holdSeconds: 3 });
        expect(statusOf(beside)).toBe(200);
        await holding;
      } finally {
        await debuggerApi.stopListener(identity);
        await other.stopListener(sameIde);
        otherConnection.setSessionType('stateless');
        await closeOwnTestConnection(otherConnection);
      }
    },
    STEP_TIMEOUT,
  );
});
