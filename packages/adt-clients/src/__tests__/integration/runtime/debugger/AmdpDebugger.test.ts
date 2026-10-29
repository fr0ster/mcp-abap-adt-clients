/**
 * Integration test for the AMDP debugger (AmdpDebugger), every member of
 * IAmdpDebugger against a live system on SAP HANA.
 *
 * The test uses a class with an AMDP procedure and the AMDP method of a CDS
 * table function, and the table function's DDL — the shared ZAC_SHR_DBG_AMDP
 * and ZAC_SHR_DBG_TF, ensured from `shared_dependencies` and never deleted.
 * The two name each other, so they are activated in one group run. It then drives two runs of the class:
 * the first stopped in both methods, stepped, and let finish; the second
 * stopped and cancelled.
 *
 * Two sessions, as the protocol has them: the debug session starts and reads
 * its events on one stateful connection, the commands go from another, and
 * the class runs on a third.
 *
 * Nothing else may debug for the same SAP user while this runs. Measured on
 * the cloud (2026-10-09): with Eclipse connected and debugging, the
 * breakpoint sync answered INVALID for lines that answered PENDING with
 * Eclipse closed — 32/32 with both debugger tests then.
 *
 * Run: npm test -- src/__tests__/integration/runtime/debugger/AmdpDebugger.test.ts
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtResponse,
  IAmdpBreakpoint,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { ClassExecutor } from '../../../../executors/class/ClassExecutor';
import { classExecutorDocuments } from '../../../../index.executors';
import { AmdpDebugger } from '../../../../runtime/debugger/AmdpDebugger';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { CleanupSteps } from '../../../helpers/cleanupSteps';
import { expectResult } from '../../../helpers/contract';
import {
  ensureDebugTarget,
  markerLines,
  sharedSource,
} from '../../../helpers/debuggerTargets';
import { settleRun } from '../../../helpers/runSettlement';
import {
  createTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { activateSharedGroup } from '../../../helpers/sharedActivation';
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

const testCase = configuredCase('runtime_debugger', 'adt_amdp_debugger');
// Disabled in test-config.yaml, or no SAP: registered as skipped.
const debuggerCase = gate('runtime_debugger', 'adt_amdp_debugger');
const CLASS_NAME: string = (
  testCase?.params?.class_name ?? 'ZAC_SHR_DBG_AMDP'
).toUpperCase();
const DDL_NAME: string = (
  testCase?.params?.ddl_name ?? 'ZAC_SHR_DBG_TF'
).toUpperCase();
const STEP_TIMEOUT = 300_000;

/**
 * The class and its table function are shared (`shared_dependencies`), never
 * created or deleted here. The class's `-- BP:<name>` markers name the
 * SQLScript lines the test stops at.
 */
const CLASS_SOURCE = sharedSource('classes', CLASS_NAME);
const LINE = markerLines(CLASS_SOURCE, '-- BP:');
const MARKERS = ['loop', 'tf'];
const SOURCE_URI = `/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main`;

// --- reading the documents ------------------------------------------------------

function attr(xml: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
}

interface IEvent {
  kind: string;
  requestId: string;
  debuggeeId: string;
  body: string;
}

function eventsOf(xml: string): IEvent[] {
  return [
    ...xml.matchAll(
      /<amdpdbg:mainResponse\b([^>]*)>([\s\S]*?)<\/amdpdbg:mainResponse>/g,
    ),
  ].map((m) => ({
    kind: attr(m[1], 'amdpdbg:kind') ?? '',
    requestId: attr(m[1], 'amdpdbg:requestId') ?? '',
    debuggeeId: attr(m[1], 'amdpdbg:debuggeeId') ?? '',
    body: m[2],
  }));
}

/** The class-source line an ON_BREAK stands on. */
function lineOf(event: IEvent): number {
  const abap = /<amdpdbg:abapPosition\b[^>]*>/.exec(event.body)?.[0] ?? '';
  return Number(/#start=(\d+)/.exec(attr(abap, 'adtcore:uri') ?? '')?.[1]);
}

/** NAME → value of the variables an ON_BREAK carries; NULL for a null. */
function variablesOf(event: IEvent): Map<string, string> {
  const map = new Map<string, string>();
  for (const v of event.body.matchAll(
    /<amdpdbg:variable\b([^>]*?)(?:\/>|>([\s\S]*?)<\/amdpdbg:variable>)/g,
  )) {
    const name = attr(v[1], 'amdpdbg:name') ?? '';
    map.set(
      name,
      attr(v[1], 'amdpdbg:isNullValue') === 'true' ? 'NULL' : (v[2] ?? ''),
    );
  }
  return map;
}

function locationOf(answer: IAdtResponse<IAdtWireResponse>): string {
  const wire = answer.ok ? answer.getResult().value : undefined;
  return String(wire?.headers?.location ?? wire?.headers?.Location ?? '');
}

/**
 * The ABAP user the session runs as. Basic authentication names it; with a
 * token (the cloud) the login is an e-mail, so the system is asked.
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

describe('AMDP debugger (AmdpDebugger)', () => {
  let session: Connection | undefined;
  let commands: Connection | undefined;
  let trigger: Connection | undefined;
  let onSession: AmdpDebugger;
  let onCommands: AmdpDebugger;

  let mainId = '';
  let hanaSession = '';
  let debuggeeId = '';
  let run: Promise<IAdtResponse<unknown>> | undefined;
  let lastBreak: IEvent | undefined;

  function needs(condition: unknown, what: string): void {
    if (!condition) throw new Error(`not reached: ${what}`);
  }

  /**
   * Read events until one of `kinds` arrives; every event on the way is
   * returned too. A read that holds the server's full 200 s answers none, so
   * the bound is on reads.
   */
  async function until(...kinds: string[]): Promise<IEvent[]> {
    const seen: IEvent[] = [];
    for (let reads = 0; reads < 6; reads++) {
      const answer = await onSession.getEvents(mainId, {
        analyse: analyseException,
      });
      expect(answer.ok).toBe(true);
      const batch = eventsOf(String(answer.ok ? answer.getResult().value : ''));
      seen.push(...batch);
      const hit = batch.find((e) => kinds.includes(e.kind));
      if (hit) {
        if (hit.kind === 'ON_BREAK') {
          lastBreak = hit;
          debuggeeId = hit.debuggeeId;
        }
        return seen;
      }
    }
    throw new Error(
      `no ${kinds.join('/')} in ${seen.map((e) => e.kind).join(', ')}`,
    );
  }

  function breakpoints(): IAmdpBreakpoint[] {
    return [LINE.loop, LINE.tf].map((line) => ({
      clientId: randomUUID(),
      uri: `${SOURCE_URI}#start=${line}`,
    }));
  }

  function runClass(): void {
    needs(trigger, 'the trigger connection');
    run = new ClassExecutor(
      trigger as Connection,
      connectionLogger,
      classExecutorDocuments,
    ).run(
      {
        className: CLASS_NAME,
      },
      { analyse: analyseException },
    );
  }

  beforeAll(async () => {
    if (!testCase) {
      throw new Error(
        missingCaseMessage('runtime_debugger', 'adt_amdp_debugger'),
      );
    }
    try {
      session = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      commands = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      trigger = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
      throw error;
    }
    onSession = new AmdpDebugger(session, connectionLogger);
    onCommands = new AmdpDebugger(commands, connectionLogger);
    // The two name each other: each is ensured written (skip_activation in
    // the shared config), then both are activated in one group run — unless
    // both were already at their source and active, and nothing was written.
    const tf = await ensureDebugTarget(
      commands,
      'views',
      DDL_NAME,
      undefined,
      testsLogger,
    );
    const cls = await ensureDebugTarget(
      commands,
      'classes',
      CLASS_NAME,
      { marker: '-- BP:', names: MARKERS },
      testsLogger,
    );
    if (tf.changed || cls.changed) {
      await activateSharedGroup(
        commands,
        [
          { type: 'DDLS/DF', name: DDL_NAME },
          { type: 'CLAS/OC', name: CLASS_NAME },
        ],
        testsLogger,
      );
    }
    logTestStep(`${CLASS_NAME} and ${DDL_NAME} active`, testsLogger);

    // The debug session's connection: stateful, for the whole test.
    session.setSessionType('stateful');
  }, STEP_TIMEOUT);

  afterAll(async () => {
    // Debugger state only: the class and the table function are shared and
    // stay. All three sessions this file opened are logged off, and every
    // failure is reported.
    const steps = new CleanupSteps();
    if (commands && mainId) {
      // Release whatever still stands before the stop: a stop does not.
      if (lastBreak && debuggeeId) {
        await steps.run(
          'release the debuggee',
          () =>
            onCommands.deleteDebuggee(mainId, debuggeeId, {
              analyse: analyseException,
            }),
          { checkAnswer: true },
        );
      }
      await steps.run(
        'stop the debug session',
        () => onCommands.stop(mainId, { analyse: analyseException }),
        {
          checkAnswer: true,
        },
      );
    }
    if (run) {
      // The run must come back, with its output or a termination's 500, and
      // is let go only once it has: a timeout or another answer fails.
      const pending = run;
      await steps.run('wait for the run', async () => {
        await settleRun(pending, 30_000, 'the run', 'completed-or-terminated');
        run = undefined;
      });
    }
    await steps.logOff('the trigger session', trigger);
    await steps.logOff('the commands session', commands);
    await steps.logOff('the debug session', session);
    steps.finish();
  }, STEP_TIMEOUT);

  debuggerCase(
    'starts a debug session for the user and names it in Location',
    async () => {
      const user = (await abapUserOf(session as Connection)).toUpperCase();
      // A session left behind by an interrupted run locks the user's AMDP
      // debugging (500 DEBUGGEE_CONTEXT_LOCKED_BY_ME, SY 530); a test takes it over.
      const started = await onSession.start(user, {
        analyse: analyseException,
        stopExisting: true,
      });
      expect(started.ok).toBe(true);
      mainId = /\/main\/([^/?]+)/.exec(locationOf(started))?.[1] ?? '';
      expect(mainId).toMatch(/^[0-9A-F]{32}$/);
      const body = String(started.ok ? started.getResult().value.data : '');
      expect(body).toContain('HANA_SESSION_ID');
      hanaSession = attr(body, 'amdpdbg:value') ?? '';
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'syncs breakpoints: the request id at once, the outcome as an event',
    async () => {
      needs(mainId, 'a debug session');
      const synced = await onCommands.syncBreakpoints(mainId, breakpoints(), {
        analyse: analyseException,
      });
      expect(synced.ok).toBe(true);
      const requestId = locationOf(synced);
      expect(requestId).toMatch(/^[0-9A-F]{32}$/);

      const events = await until('SYNC_BREAKPOINTS');
      const sync = events.find((e) => e.kind === 'SYNC_BREAKPOINTS');
      expect(sync?.requestId).toBe(requestId);
      const states = [
        ...(sync?.body ?? '').matchAll(/amdpdbg:state="([^"]*)"/g),
      ].map((m) => m[1]);
      expect(states).toEqual(['PENDING', 'PENDING']);
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'stops the procedure on its loop line with its variables',
    async () => {
      needs(mainId, 'a debug session');
      runClass();
      const events = await until('ON_BREAK');
      // The breakpoints turn valid once the database reaches the methods.
      expect(events.some((e) => e.kind === 'ON_TOGGLE_BREAKPOINTS')).toBe(true);
      needs(lastBreak, 'a break');
      expect(lineOf(lastBreak as IEvent)).toBe(LINE.loop);
      const vars = variablesOf(lastBreak as IEvent);
      expect(vars.get('IV_LIMIT')).toBe('3');
      expect(vars.get('LV_I')).toBe('1');
      expect(vars.get('EV_TOTAL')).toBe('0');
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'steps over a statement and sees the variable change',
    async () => {
      needs(debuggeeId, 'a debuggee');
      const stepped = await onCommands.step(mainId, debuggeeId, 'over', {
        analyse: analyseException,
      });
      expect(stepped.ok).toBe(true);
      expect(locationOf(stepped)).toMatch(/^[0-9A-F]{32}$/);
      await until('ON_BREAK');
      expect(lineOf(lastBreak as IEvent)).toBe(LINE.loop + 1);
      expect(variablesOf(lastBreak as IEvent).get('EV_TOTAL')).toBe('1');
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'continues to the next iteration, then to the end of the procedure',
    async () => {
      needs(debuggeeId, 'a debuggee');
      expectResult(
        await onCommands.step(mainId, debuggeeId, 'continue', {
          analyse: analyseException,
        }),
        'continue',
      );
      await until('ON_BREAK');
      expect(lineOf(lastBreak as IEvent)).toBe(LINE.loop);
      expect(variablesOf(lastBreak as IEvent).get('LV_I')).toBe('2');

      expectResult(
        await onCommands.step(mainId, debuggeeId, 'continue', {
          analyse: analyseException,
        }),
        'continue',
      );
      await until('ON_BREAK');
      expect(variablesOf(lastBreak as IEvent).get('LV_I')).toBe('3');

      expectResult(
        await onCommands.step(mainId, debuggeeId, 'continue', {
          analyse: analyseException,
        }),
        'continue',
      );
      const end = await until('ON_EXECUTION_END', 'ON_BREAK');
      expect(end.some((e) => e.kind === 'ON_EXECUTION_END')).toBe(true);
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'stops in the table function as a debuggee of its own',
    async () => {
      const procedureDebuggee = debuggeeId;
      if (lastBreak && lineOf(lastBreak) !== LINE.tf) await until('ON_BREAK');
      expect(lineOf(lastBreak as IEvent)).toBe(LINE.tf);
      expect(debuggeeId).not.toBe(procedureDebuggee);
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'reads a table variable: the whole of it, and through a SELECT of its own',
    async () => {
      needs(debuggeeId, 'a debuggee in the table function');
      // One more iteration, so the table holds a row.
      expectResult(
        await onCommands.step(mainId, debuggeeId, 'continue', {
          analyse: analyseException,
        }),
        'continue',
      );
      await until('ON_BREAK');
      expect(lineOf(lastBreak as IEvent)).toBe(LINE.tf);

      const where = {
        rowNumber: 100,
        sessionId: hanaSession,
        debuggerId: mainId,
        debuggeeId,
        variableName: 'LT_ROWS',
      };
      const column = (xml: string, name: string): string[] => {
        const block = [
          ...xml.matchAll(
            /<dataPreview:columns>([\s\S]*?)<\/dataPreview:columns>/g,
          ),
        ].find((c) => c[1].includes(`dataPreview:name="${name}"`));
        return [
          ...(block?.[1] ?? '').matchAll(
            /<dataPreview:data>([^<]*)<\/dataPreview:data>/g,
          ),
        ].map((d) => d[1]);
      };

      // No body: the server selects every column, the row id included.
      const whole = await onCommands.getDataPreview({
        analyse: analyseException,
        headers: integrationHeadersOf(onCommands, 'getDataPreview'),
        ...where,
        provideRowId: true,
      });
      expect(whole.ok).toBe(true);
      const wholeXml = String(whole.ok ? whole.getResult().value : '');
      expect(column(wholeXml, 'N')).toEqual(['1']);
      expect(column(wholeXml, 'SQUARE')).toEqual(['1']);

      // A SELECT of the caller's.
      const selected = await onCommands.getDataPreview({
        analyse: analyseException,
        headers: integrationHeadersOf(onCommands, 'getDataPreview'),
        ...where,
        query: 'SELECT ":LT_ROWS"."SQUARE" AS "SQUARE" FROM ":LT_ROWS"',
      });
      expect(selected.ok).toBe(true);
      const selectedXml = String(selected.ok ? selected.getResult().value : '');
      expect(column(selectedXml, 'SQUARE')).toEqual(['1']);
      expect(column(selectedXml, 'N')).toEqual([]);
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'lets the run finish: no breakpoints, continue, and the run returns its output',
    async () => {
      needs(debuggeeId, 'a debuggee');
      expect(
        (
          await onCommands.syncBreakpoints(mainId, [], {
            analyse: analyseException,
          })
        ).ok,
      ).toBe(true);
      expectResult(
        await onCommands.step(mainId, debuggeeId, 'continue', {
          analyse: analyseException,
        }),
        'continue',
      );
      await until('ON_EXECUTION_END');
      lastBreak = undefined;

      needs(run, 'the run');
      const output = await (run as Promise<IAdtResponse<unknown>>);
      expect(output.ok).toBe(true);
      expect(String(output.ok ? output.getResult().value : '').trim()).toBe(
        'total 6 steps 3 rows 3',
      );
      run = undefined;
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'cancels a debuggee where it stands, and the run fails',
    async () => {
      needs(mainId, 'a debug session');
      expectResult(
        await onCommands.syncBreakpoints(mainId, breakpoints(), {
          analyse: analyseException,
        }),
        'set the breakpoints',
      );
      await until('SYNC_BREAKPOINTS');
      runClass();
      await until('ON_BREAK');

      const deleted = await onCommands.deleteDebuggee(mainId, debuggeeId, {
        analyse: analyseException,
      });
      expect(deleted.ok).toBe(true);
      const events = await until('ON_EXECUTION_END');
      const warning = events.find((e) => e.kind === 'ON_WARNING');
      expect(warning?.body).toMatch(/execution has been canceled/);
      lastBreak = undefined;

      needs(run, 'the run');
      const output = await (run as Promise<IAdtResponse<unknown>>);
      expect(output.ok).toBe(false);
      run = undefined;
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'stops the debug session',
    async () => {
      needs(mainId, 'a debug session');
      expect(
        (
          await onCommands.syncBreakpoints(mainId, [], {
            analyse: analyseException,
          })
        ).ok,
      ).toBe(true);
      const stopped = await onCommands.stop(mainId, {
        analyse: analyseException,
      });
      expect(stopped.ok).toBe(true);
      mainId = '';
    },
    STEP_TIMEOUT,
  );
});
