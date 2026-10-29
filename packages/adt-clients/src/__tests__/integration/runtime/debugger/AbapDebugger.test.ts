/**
 * Integration test for the ABAP debugger (AbapDebugger), every member of
 * IAbapDebugger against a live system.
 *
 * The test runs a small class implementing IF_OO_ADT_CLASSRUN — the shared
 * ZAC_SHR_DBG_PROBE, ensured from `shared_dependencies` and never deleted —
 * through the debugger twice: the first from the first breakpoint to
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
import {
  analyseDebuggeeEnd,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtResponse,
  IAdtRunnable,
  IDebuggerBreakpoint,
  IDebuggerIdentity,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { ClassExecutor } from '../../../../executors/class/ClassExecutor';
import { classExecutorDocuments } from '../../../../index.executors';
import {
  AbapDebugger,
  abapDebuggerDocuments,
} from '../../../../runtime/debugger/AbapDebugger';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { CleanupSteps, withCleanup } from '../../../helpers/cleanupSteps';
import { expectResult } from '../../../helpers/contract';
import {
  ensureDebugTarget,
  markerLines,
  sharedSource,
} from '../../../helpers/debuggerTargets';
import { settleRun } from '../../../helpers/runSettlement';
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

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const testsLogger: ILogger = createTestsLogger();

const testCase = configuredCase('runtime_debugger', 'adt_abap_debugger');
// Disabled in test-config.yaml, or no SAP: registered as skipped.
const debuggerCase = gate('runtime_debugger', 'adt_abap_debugger');
const CLASS_NAME: string = (
  testCase?.params?.class_name ?? 'ZAC_SHR_DBG_PROBE'
).toUpperCase();
const HOLD_SECONDS = 30;
const STEP_TIMEOUT = 120_000;

/**
 * The probe: a shared class (`shared_dependencies.classes`), never created or
 * deleted here. Its `"BP:<name>` markers name the lines the test stops at; the
 * work is deterministic, so every run stops at the same lines with the same
 * values.
 */
const SOURCE = sharedSource('classes', CLASS_NAME);
const LINE = markerLines(SOURCE, '"BP:');
const MARKERS = ['loop', 'after', 'raise', 'catch', 'add'];
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
  return {
    debuggingMode: 'user',
    requestUser,
    terminalId: id('terminalId'),
    ideId: id('ideId'),
  };
}

/**
 * The ABAP user the session runs as — the one breakpoints and listeners are
 * keyed on. Basic authentication names it; with a token (the cloud) the login
 * is an e-mail and the ABAP user is another name, so the system is asked.
 */
async function abapUserOf(connection: IAbapConnection): Promise<string> {
  const configured = process.env.SAP_USERNAME?.trim();
  if (configured) return configured;
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

// --- the test --------------------------------------------------------------------

type Connection = IAbapConnection & ISessionLifecycleAware;

/** The probe class runs through classrun. */
const asClass = (connection: Connection) =>
  new ClassExecutor(connection, {
    logger: connectionLogger,
    results: classExecutorDocuments,
  });

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
  let listenerConnection: Connection | undefined;
  let triggerConnection: Connection | undefined;
  /** Arms breakpoints and listens; never attaches. */
  let listenerApi: AbapDebugger;
  /** The debug session: a connection of its own, opened after each catch. */
  let sessionConnection: Connection | undefined;
  let debuggerApi: AbapDebugger;
  let identity: IDebuggerIdentity;

  const armed: string[] = [];
  let run: Promise<IAdtResponse<unknown>> | undefined;
  let attached = false;
  let watchpointId: string | undefined;

  /** Fails the step naming what it waited on, instead of running blind. */
  function needs(condition: unknown, what: string): void {
    if (!condition) throw new Error(`not reached: ${what}`);
  }

  /**
   * Listen, start the program on the other session through any runnable — a
   * class, a report, whatever implements IAdtRunnable — and answer what was
   * caught.
   */
  async function catchRun<TTarget>(
    runnable: (connection: Connection) => IAdtRunnable<TTarget, unknown>,
    target: TTarget,
  ): Promise<{ debuggeeId: string; server?: string }> {
    const listener = listenerApi.listen(identity, {
      analyse: analyseException,
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
    run = runnable(trigger as Connection).run(target, {
      analyse: analyseException,
    });
    const caught = await listener;
    const document = documentOf(caught);
    expect(caught.ok).toBe(true);
    const debuggeeId = tag(document, 'DEBUGGEE_ID');
    needs(
      debuggeeId,
      `a debuggee in the listener's answer: ${document.slice(0, 300)}`,
    );
    expect(tag(document, 'DBGEE_KIND')).toBe('DEBUGGEE');
    process.stdout.write(
      `MEASURED caught on ${tag(document, 'APPSERVER')} same=${tag(document, 'IS_SAME_SERVER')} cross=${tag(document, 'CAN_ADT_CROSS_SERVER')} impossible=${tag(document, 'IS_ATTACH_IMPOSSIBLE')}\n`,
    );
    // The debuggee's application server, which the attach is routed to.
    return {
      debuggeeId: debuggeeId as string,
      server: tag(document, 'INSTANCE_NAME'),
    };
  }

  /**
   * Open the debug session the next attach goes on: a new connection, never
   * the listener's, and the attach routed to the debuggee's server. Measured
   * (2026-10-09): on the cloud, an attach on the listener's connection is
   * refused 500 invalidDebuggee whenever the debuggee runs on another
   * application server; on a new connection routed by saplb it succeeded 10
   * of 10, 5 of them across servers. On premise, a connection that has
   * attached once cannot attach again (500 "Debuggee already attached").
   */
  async function openDebugSession(): Promise<void> {
    const previous = sessionConnection;
    sessionConnection = await createTestConnection(connectionLogger, {
      ownSession: true,
    });
    sessionConnection.setSessionType('stateful');
    debuggerApi = new AbapDebugger(sessionConnection, {
      logger: connectionLogger,
      results: abapDebuggerDocuments,
    });
    if (previous) {
      previous.setSessionType('stateless');
      await closeOwnTestConnection(previous);
    }
  }

  async function topFrame(): Promise<IFrame> {
    const stack = await debuggerApi.getStack({ analyse: analyseException });
    const top = frames(documentOf(stack))[0];
    needs(stack.ok && top, 'a stack');
    return top;
  }

  beforeAll(async () => {
    if (!testCase) {
      throw new Error(
        missingCaseMessage('runtime_debugger', 'adt_abap_debugger'),
      );
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
      throw error;
    }
    identity = identityFor(await abapUserOf(listenerConnection));
    logTestStep(`debugging as ${identity.requestUser}`, testsLogger);
    listenerApi = new AbapDebugger(listenerConnection, {
      logger: connectionLogger,
      results: abapDebuggerDocuments,
    });
    await ensureDebugTarget(
      listenerConnection,
      'classes',
      CLASS_NAME,
      { marker: '"BP:', names: MARKERS },
      testsLogger,
    );
    logTestStep(`probe ${CLASS_NAME} active`, testsLogger);

    // Every debugger request needs the stateful session it attached on.
    listenerConnection.setSessionType('stateful');
  }, STEP_TIMEOUT);

  afterAll(async () => {
    if (!listenerConnection) return;
    // Debugger state only: the probe is shared and stays. Every session this
    // file opened is logged off, and every failure is reported.
    const steps = new CleanupSteps();
    for (const id of armed) {
      await steps.run(
        `delete breakpoint ${id}`,
        () =>
          listenerApi.deleteBreakpoint(identity, id, {
            analyse: analyseException,
          }),
        { checkAnswer: true },
      );
    }
    if (attached) {
      await steps.run(
        'terminate the debuggee',
        () => debuggerApi.terminateDebuggee({ analyse: analyseDebuggeeEnd }),
        { checkAnswer: true },
      );
    }
    await steps.logOff('the debug session', sessionConnection);
    await steps.run(
      'stop the listener',
      () => listenerApi.stopListener(identity, { analyse: analyseException }),
      { checkAnswer: true },
    );
    if (run) {
      // The run must come back, with its output or a termination's 500, and
      // is let go only once it has: a timeout or another answer fails.
      const pending = run;
      await steps.run('wait for the run', async () => {
        await settleRun(pending, 15_000, 'the run', 'completed-or-terminated');
        run = undefined;
      });
    }
    await steps.logOff('the trigger session', triggerConnection);
    await steps.logOff('the listener session', listenerConnection);
    steps.finish();
  }, STEP_TIMEOUT);

  // --- breakpoints -----------------------------------------------------------------

  debuggerCase(
    'validates all four kinds of breakpoint without arming them',
    async () => {
      const all: IDebuggerBreakpoint[] = [
        { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.loop}` },
        { kind: 'exception', exceptionClass: 'CX_SY_ZERODIVIDE' },
        { kind: 'statement', statement: 'RAISE EXCEPTION' },
        { kind: 'message', msgId: '00', msgNo: '001', msgTy: 'E' },
      ];
      const answer = await listenerApi.setBreakpoints(identity, all, {
        analyse: analyseException,
        headers: integrationHeadersOf(listenerApi, 'setBreakpoints'),
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

  debuggerCase(
    'arms a line and an exception breakpoint; the line comes back in its include',
    async () => {
      const answer = await listenerApi.setBreakpoints(
        identity,
        [
          { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.loop}` },
          { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.catch}` },
          { kind: 'exception', exceptionClass: 'CX_SY_ZERODIVIDE' },
        ],
        {
          analyse: analyseException,
          headers: integrationHeadersOf(listenerApi, 'setBreakpoints'),
        },
      );
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

  debuggerCase(
    'catches the run on the first breakpoint and attaches',
    async () => {
      needs(armed.length === 3, 'armed breakpoints');
      const { debuggeeId, server } = await catchRun(asClass, {
        className: CLASS_NAME,
      });
      await openDebugSession();
      const answer = await debuggerApi.attach(identity, debuggeeId, {
        analyse: analyseException,
        server,
      });
      const document = documentOf(answer);
      if (!answer.ok) {
        process.stdout.write(
          `MEASURED attach refused: ${statusOf(answer)} ${subtypeOf(answer) ?? ''} ${document.slice(0, 900)}\n`,
        );
      }
      expect(answer.ok).toBe(true);
      expect(attr(document, 'isSteppingPossible')).toBe('true');
      expect(attr(document, 'debugSessionId')).toBeTruthy();
      attached = true;
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'reads the stack: the probe on top, at the loop line',
    async () => {
      needs(attached, 'an attached debuggee');
      const top = await topFrame();
      expect(top.program.startsWith(CLASS_NAME)).toBe(true);
      expect(top.event).toBe('IF_OO_ADT_CLASSRUN~MAIN');
      expect(top.line).toBe(LINE.loop);
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'expands the variable scopes and reads the locals',
    async () => {
      needs(attached, 'an attached debuggee');
      const root = await debuggerApi.getChildVariables(['@ROOT'], {
        analyse: analyseException,
        headers: integrationHeadersOf(debuggerApi, 'getChildVariables'),
      });
      expect(root.ok).toBe(true);
      const scopes = [
        ...documentOf(root).matchAll(/<CHILD_ID>([^<]*)<\/CHILD_ID>/g),
      ].map((m) => m[1]);
      expect(scopes).toContain('@LOCALS');
      const all = await debuggerApi.getChildVariables(scopes, {
        analyse: analyseException,
        headers: integrationHeadersOf(debuggerApi, 'getChildVariables'),
      });
      expect(all.ok).toBe(true);
      const locals = values(documentOf(all));
      expect(locals.get('LV_TOTAL')).toBe('0');
      expect(locals.get('LV_TEXT')).toBe('start');
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'reads one variable by its id',
    async () => {
      needs(attached, 'an attached debuggee');
      const answer = await debuggerApi.getVariables(['LV_TOTAL'], {
        analyse: analyseException,
        headers: integrationHeadersOf(debuggerApi, 'getVariables'),
      });
      expect(answer.ok).toBe(true);
      expect(values(documentOf(answer)).get('LV_TOTAL')).toBe('0');
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'steps into the called method and sees its parameters',
    async () => {
      needs(attached, 'an attached debuggee');
      expect(
        (await debuggerApi.step('stepInto', { analyse: analyseException })).ok,
      ).toBe(true);
      const top = await topFrame();
      expect(top.event).toBe('ADD');
      expect(top.line).toBe(LINE.add);
      const params = values(
        documentOf(
          await debuggerApi.getVariables(['IV_A', 'IV_B'], {
            analyse: analyseException,
            headers: integrationHeadersOf(debuggerApi, 'getVariables'),
          }),
        ),
      );
      expect(params.get('IV_A')).toBe('0');
      expect(params.get('IV_B')).toBe('1');
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'moves the read cursor to the caller frame without moving the program',
    async () => {
      needs(attached, 'an attached debuggee');
      const stack = frames(
        documentOf(await debuggerApi.getStack({ analyse: analyseException })),
      );
      const caller = stack.find((f) => f.event === 'IF_OO_ADT_CLASSRUN~MAIN');
      needs(caller, 'the caller frame');
      const moved = await debuggerApi.setStackPosition(
        (caller as IFrame).position,
        { analyse: analyseException },
      );
      expect(moved.ok).toBe(true);
      // The caller's local is readable from here…
      expect(
        values(
          documentOf(
            await debuggerApi.getVariables(['LV_TOTAL'], {
              analyse: analyseException,
              headers: integrationHeadersOf(debuggerApi, 'getVariables'),
            }),
          ),
        ).get('LV_TOTAL'),
      ).toBe('0');
      // …and the program still stands in the method.
      expect((await topFrame()).event).toBe('ADD');
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'returns from the method to the caller',
    async () => {
      needs(attached, 'an attached debuggee');
      expect(
        (await debuggerApi.step('stepReturn', { analyse: analyseException }))
          .ok,
      ).toBe(true);
      const top = await topFrame();
      expect(top.event).toBe('IF_OO_ADT_CLASSRUN~MAIN');
      expect(
        values(
          documentOf(
            await debuggerApi.getVariables(['LV_TOTAL'], {
              analyse: analyseException,
              headers: integrationHeadersOf(debuggerApi, 'getVariables'),
            }),
          ),
        ).get('LV_TOTAL'),
      ).toBe('1');
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'creates and lists a watchpoint, and continues to the next breakpoint',
    async () => {
      needs(attached, 'an attached debuggee');
      const created = await debuggerApi.createWatchpoint('LV_TOTAL', {
        analyse: analyseException,
      });
      expect(created.ok).toBe(true);
      watchpointId = attr(documentOf(created), 'id');
      needs(
        watchpointId,
        `a watchpoint id: ${documentOf(created).slice(0, 300)}`,
      );

      const listed = await debuggerApi.listWatchpoints({
        analyse: analyseException,
      });
      expect(listed.ok).toBe(true);
      expect(documentOf(listed)).toContain(`id="${watchpointId}"`);

      // The loop breakpoint comes first: the assignment is on its line.
      const step = await debuggerApi.step('stepContinue', {
        analyse: analyseException,
      });
      expect(step.ok).toBe(true);
      expect(documentOf(step)).toContain('KIND=0.');
      expect((await topFrame()).line).toBe(LINE.loop);
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'stops on the watchpoint when the watched variable changes, then removes it',
    async () => {
      needs(watchpointId, 'a watchpoint');
      const step = await debuggerApi.step('stepContinue', {
        analyse: analyseException,
      });
      expect(step.ok).toBe(true);
      expect(documentOf(step)).toMatch(/reachedWatchpoints/);
      expect(
        values(
          documentOf(
            await debuggerApi.getVariables(['LV_TOTAL'], {
              analyse: analyseException,
              headers: integrationHeadersOf(debuggerApi, 'getVariables'),
            }),
          ),
        ).get('LV_TOTAL'),
      ).toBe('3');

      const deleted = await debuggerApi.deleteWatchpoint(
        watchpointId as string,
        { analyse: analyseException },
      );
      expect(deleted.ok).toBe(true);
      watchpointId = undefined;
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'writes a variable at the stop and reads the new value back',
    async () => {
      needs(attached, 'an attached debuggee');
      const written = await debuggerApi.setVariableValue('LV_TOTAL', '100', {
        analyse: analyseException,
      });
      expect(written.ok).toBe(true);
      expect(
        values(
          documentOf(
            await debuggerApi.getVariables(['LV_TOTAL'], {
              analyse: analyseException,
              headers: integrationHeadersOf(debuggerApi, 'getVariables'),
            }),
          ),
        ).get('LV_TOTAL'),
      ).toBe('100');
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'runs to a chosen line',
    async () => {
      needs(attached, 'an attached debuggee');
      // The loop breakpoint is in the way on the last iteration; out of it first.
      const ran = await debuggerApi.stepToLine(
        'stepRunToLine',
        `${SOURCE_URI}#start=${LINE.after}`,
        { analyse: analyseException },
      );
      expect(ran.ok).toBe(true);
      const top = await topFrame();
      expect([LINE.loop, LINE.after]).toContain(top.line);
      if (top.line === LINE.loop) {
        expect(
          (
            await debuggerApi.stepToLine(
              'stepRunToLine',
              `${SOURCE_URI}#start=${LINE.after}`,
              { analyse: analyseException },
            )
          ).ok,
        ).toBe(true);
        expect((await topFrame()).line).toBe(LINE.after);
      }
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'steps over a statement',
    async () => {
      needs(attached, 'an attached debuggee');
      const before = (await topFrame()).line;
      expect(
        (await debuggerApi.step('stepOver', { analyse: analyseException })).ok,
      ).toBe(true);
      expect((await topFrame()).line).toBeGreaterThan(before);
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'stops on the exception breakpoint, reported at the CATCH line',
    async () => {
      needs(attached, 'an attached debuggee');
      const step = await debuggerApi.step('stepContinue', {
        analyse: analyseException,
      });
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

  debuggerCase(
    'continues to the end: the step answers debuggeeEnded and the run returns',
    async () => {
      needs(attached, 'an attached debuggee');
      // The CATCH line breakpoint, then the end.
      const toCatch = await debuggerApi.step('stepContinue', {
        analyse: analyseException,
      });
      expect(toCatch.ok).toBe(true);
      expect((await topFrame()).line).toBe(LINE.catch);

      // SAP answers the end 500 debuggeeEnded; analyseDebuggeeEnd reads it as
      // the step having worked, the result naming the subtype (ERRATA.md).
      const toEnd = await debuggerApi.step('stepContinue', {
        analyse: analyseDebuggeeEnd,
      });
      expect(toEnd.ok).toBe(true);
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

  debuggerCase(
    'jumps a debuggee to a line, terminates it where it stands, and the run returns',
    async () => {
      needs(armed.length === 3, 'armed breakpoints');
      const { debuggeeId, server } = await catchRun(asClass, {
        className: CLASS_NAME,
      });
      await openDebugSession();
      const second = await debuggerApi.attach(identity, debuggeeId, {
        analyse: analyseException,
        server,
      });
      if (!second.ok) {
        process.stdout.write(
          `MEASURED attach refused: ${statusOf(second)} ${subtypeOf(second) ?? ''} ${documentOf(second).slice(0, 900)}\n`,
        );
      }
      expect(second.ok).toBe(true);
      attached = true;
      expect((await topFrame()).line).toBe(LINE.loop);

      // A jump moves the debuggee without running what lies between.
      const jumped = await debuggerApi.stepToLine(
        'stepJumpToLine',
        `${SOURCE_URI}#start=${LINE.after}`,
        { analyse: analyseException },
      );
      expect(jumped.ok).toBe(true);
      expect((await topFrame()).line).toBe(LINE.after);

      // On premise 500 subtype terminateDebuggee, on the cloud 200: either is
      // the debuggee ended as asked, and analyseDebuggeeEnd reads both so.
      const terminated = await debuggerApi.terminateDebuggee({
        analyse: analyseDebuggeeEnd,
      });
      expect(terminated.ok).toBe(true);
      attached = false;

      const afterwards = await debuggerApi.getStack({
        analyse: analyseException,
      });
      expect(afterwards.ok).toBe(false);

      needs(run, 'the run');
      await settleRun(
        run as Promise<IAdtResponse<unknown>>,
        30_000,
        'the terminated run',
        'completed-or-terminated',
      );
      run = undefined;
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'deletes the armed breakpoints and the listener',
    async () => {
      for (const id of armed.splice(0)) {
        expect(
          (
            await listenerApi.deleteBreakpoint(identity, id, {
              analyse: analyseException,
            })
          ).ok,
        ).toBe(true);
      }
      expect(
        (
          await listenerApi.stopListener(identity, {
            analyse: analyseException,
          })
        ).ok,
      ).toBe(true);
    },
    STEP_TIMEOUT,
  );

  // --- conflict: two listeners for one user -----------------------------------------

  debuggerCase(
    'a refusing listener is answered 409 while another one listens for the user',
    async () => {
      const holderConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      holderConnection.setSessionType('stateful');
      const holderIdentity = otherIde(identity, 'holder');
      // The holder registers the way Eclipse does — with the conflict
      // parameters — from an IDE of its own.
      const holder = new AbapDebugger(holderConnection, {
        logger: connectionLogger,
        results: abapDebuggerDocuments,
        onConflict: 'refuse',
      });
      await withCleanup(
        async () => {
          const holding = holder.listen(holderIdentity, {
            analyse: analyseException,
            holdSeconds: 10,
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const refused = await listenerApi.listen(identity, {
            analyse: analyseException,
            holdSeconds: 10,
          });
          expect(statusOf(refused)).toBe(409);
          expect(subtypeOf(refused)).toBe('conflictDetected');

          // The holder's own long poll ends when its hold runs out, with
          // nothing caught: an answer, not a refusal.
          expectResult(await holding, "the holder's listen");
        },
        async (steps) => {
          await steps.run(
            'stop the holder',
            () =>
              holder.stopListener(holderIdentity, {
                analyse: analyseException,
              }),
            { checkAnswer: true },
          );
          await steps.logOff('the holder session', holderConnection);
        },
      );
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'a taking-over listener is accepted while another one listens for the user',
    async () => {
      const holderConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      holderConnection.setSessionType('stateful');
      const holderIdentity = otherIde(identity, 'holder');
      // The one being displaced listens the way Eclipse does.
      const holder = new AbapDebugger(holderConnection, {
        logger: connectionLogger,
        results: abapDebuggerDocuments,
        onConflict: 'refuse',
      });
      const taker = new AbapDebugger(listenerConnection as Connection, {
        logger: connectionLogger,
        results: abapDebuggerDocuments,
        onConflict: 'takeOver',
      });
      await withCleanup(
        async () => {
          const holding = holder.listen(holderIdentity, {
            analyse: analyseException,
            holdSeconds: 20,
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const taking = taker.listen(identity, {
            analyse: analyseException,
            holdSeconds: 5,
          });
          // Measured on premise (2026-10-09): the displaced long poll returns
          // at once, 409 with the subtype conflictNotification — the notice
          // Eclipse shows.
          const displaced = await holding;
          expect(statusOf(displaced)).toBe(409);
          expect(subtypeOf(displaced)).toBe('conflictNotification');
          const took = await taking;
          expect(took.ok).toBe(true);
        },
        async (steps) => {
          await steps.run(
            'stop the taker',
            () => taker.stopListener(identity, { analyse: analyseException }),
            { checkAnswer: true },
          );
          await steps.run(
            'stop the holder',
            () =>
              holder.stopListener(holderIdentity, {
                analyse: analyseException,
              }),
            { checkAnswer: true },
          );
          await steps.logOff('the holder session', holderConnection);
        },
      );
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'a refusing listener sees a conflict with one registered without the conflict parameters',
    async () => {
      const holderConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      holderConnection.setSessionType('stateful');
      const holderIdentity = otherIde(identity, 'quiet-holder');
      const holder = new AbapDebugger(holderConnection, {
        logger: connectionLogger,
        results: abapDebuggerDocuments,
        onConflict: 'takeOver',
      });
      await withCleanup(
        async () => {
          const holding = holder.listen(holderIdentity, {
            analyse: analyseException,
            holdSeconds: 10,
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Measured on premise (2026-10-09): the conflict is seen whatever
          // parameters the other listener registered with.
          const beside = await listenerApi.listen(identity, {
            analyse: analyseException,
            holdSeconds: 3,
          });
          expect(statusOf(beside)).toBe(409);
          expect(subtypeOf(beside)).toBe('conflictDetected');

          // The holder's own long poll ends when its hold runs out, with
          // nothing caught: an answer, not a refusal.
          expectResult(await holding, "the holder's listen");
        },
        async (steps) => {
          await steps.run(
            'stop the listener',
            () =>
              listenerApi.stopListener(identity, { analyse: analyseException }),
            { checkAnswer: true },
          );
          await steps.run(
            'stop the holder',
            () =>
              holder.stopListener(holderIdentity, {
                analyse: analyseException,
              }),
            { checkAnswer: true },
          );
          await steps.logOff('the holder session', holderConnection);
        },
      );
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'two listeners of one IDE — the same IDE id — do not conflict',
    async () => {
      const otherConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      otherConnection.setSessionType('stateful');
      // Another terminal of the same IDE: only the terminal id differs.
      const sameIde: IDebuggerIdentity = {
        ...identity,
        terminalId: otherIde(identity, 'same-ide').terminalId,
      };
      const other = new AbapDebugger(otherConnection, {
        logger: connectionLogger,
        results: abapDebuggerDocuments,
      });
      await withCleanup(
        async () => {
          const holding = other.listen(sameIde, {
            analyse: analyseException,
            holdSeconds: 10,
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));
          // Measured on premise (2026-10-09): 200 after the hold, no 409.
          const beside = await listenerApi.listen(identity, {
            analyse: analyseException,
            holdSeconds: 3,
          });
          expect(statusOf(beside)).toBe(200);
          // The holder's own long poll ends when its hold runs out, with
          // nothing caught: an answer, not a refusal.
          expectResult(await holding, "the holder's listen");
        },
        async (steps) => {
          await steps.run(
            'stop the listener',
            () =>
              listenerApi.stopListener(identity, { analyse: analyseException }),
            { checkAnswer: true },
          );
          await steps.run(
            'stop the other listener',
            () => other.stopListener(sameIde, { analyse: analyseException }),
            { checkAnswer: true },
          );
          await steps.logOff('the other session', otherConnection);
        },
      );
    },
    STEP_TIMEOUT,
  );
});
