/**
 * Integration test for the AMDP debugger (AmdpDebugger), every member of
 * IAmdpDebugger against a live system on SAP HANA.
 *
 * The test deploys a class with an AMDP procedure and the AMDP method of a CDS
 * table function, and the table function's DDL — the two name each other, so
 * they are activated in one group run. It then drives two runs of the class:
 * the first stopped in both methods, stepped, and let finish; the second
 * stopped and cancelled.
 *
 * Two sessions, as the protocol has them: the debug session starts and reads
 * its events on one stateful connection, the commands go from another, and
 * the class runs on a third.
 *
 * Nothing else may debug AMDP for the same SAP user while this runs (an IDE
 * with an AMDP breakpoint set).
 *
 * Run: npm test -- src/__tests__/integration/runtime/debugger/AmdpDebugger.test.ts
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import { AdtUtils } from '../../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../../core/shared/utilResultSet';
import { ClassExecutor } from '../../../../executors/class/ClassExecutor';
import { AmdpDebugger } from '../../../../runtime/debugger/AmdpDebugger';
import type { IAmdpBreakpoint } from '../../../../runtime/debugger/contracts';
import { wireItself } from '../../../../utils/resultStrategy';
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

const testCase = getEnabledTestCase('runtime_debugger', 'adt_amdp_debugger');
const CLASS_NAME: string = (
  testCase?.params?.class_name ?? 'ZAC_DBG_AMDP2'
).toUpperCase();
const DDL_NAME: string = (
  testCase?.params?.ddl_name ?? 'ZAC_DBG_TF2'
).toUpperCase();
const STEP_TIMEOUT = 300_000;

const DDL_SOURCE = `@EndUserText.label: 'AMDP debugger test table function'
@ClientHandling.type: #CLIENT_INDEPENDENT
@AccessControl.authorizationCheck: #NOT_REQUIRED
define table function ${DDL_NAME}
  with parameters
    p_limit : abap.int4
  returns {
    n      : abap.int4;
    square : abap.int4;
  }
  implemented by method ${CLASS_NAME.toLowerCase()}=>tf;
`;

const CLASS_SOURCE = `CLASS ${CLASS_NAME.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hdb.
    INTERFACES if_oo_adt_classrun.
    METHODS sum_to AMDP OPTIONS READ-ONLY CLIENT INDEPENDENT
      IMPORTING VALUE(iv_limit) TYPE i
      EXPORTING VALUE(ev_total) TYPE i
                VALUE(ev_steps) TYPE i.
    CLASS-METHODS tf FOR TABLE FUNCTION ${DDL_NAME.toLowerCase()}.
ENDCLASS.

CLASS ${CLASS_NAME.toLowerCase()} IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    sum_to( EXPORTING iv_limit = 3
            IMPORTING ev_total = DATA(lv_total)
                      ev_steps = DATA(lv_steps) ).
    SELECT * FROM ${DDL_NAME.toLowerCase()}( p_limit = 3 ) INTO TABLE @DATA(lt_rows).
    out->write( |total { lv_total } steps { lv_steps } rows { lines( lt_rows ) }| ).
  ENDMETHOD.

  METHOD sum_to BY DATABASE PROCEDURE FOR HDB LANGUAGE SQLSCRIPT
    OPTIONS READ-ONLY.
    DECLARE lv_i INTEGER;
    ev_total = 0;
    ev_steps = 0;
    FOR lv_i IN 1..:iv_limit DO
      ev_total = :ev_total + :lv_i; -- BP:loop
      ev_steps = :ev_steps + 1;
    END FOR;
  ENDMETHOD.

  METHOD tf BY DATABASE FUNCTION FOR HDB LANGUAGE SQLSCRIPT
    OPTIONS READ-ONLY.
    DECLARE lt_rows TABLE ( n INTEGER, square INTEGER );
    DECLARE lv_i INTEGER;
    FOR lv_i IN 1..:p_limit DO
      :lt_rows.INSERT( ( :lv_i, :lv_i * :lv_i ) ); -- BP:tf
    END FOR;
    RETURN SELECT n, square FROM :lt_rows;
  ENDMETHOD.
ENDCLASS.
`;

const LINE: Record<string, number> = {};
CLASS_SOURCE.split('\n').forEach((text, index) => {
  const marker = /-- BP:(\w+)/.exec(text);
  if (marker) LINE[marker[1]] = index + 1;
});
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
  let packageName = '';
  let transportRequest: string | undefined;
  let skipReason: string | undefined;

  let mainId = '';
  let hanaSession = '';
  let debuggeeId = '';
  let run: Promise<IAdtResponse<unknown>> | undefined;
  let lastBreak: IEvent | undefined;

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
   * Read events until one of `kinds` arrives; every event on the way is
   * returned too. A read that holds the server's full 200 s answers none, so
   * the bound is on reads.
   */
  async function until(...kinds: string[]): Promise<IEvent[]> {
    const seen: IEvent[] = [];
    for (let reads = 0; reads < 6; reads++) {
      const answer = await onSession.getEvents(mainId);
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
    run = new ClassExecutor(trigger as Connection, connectionLogger).run({
      className: CLASS_NAME,
    });
  }

  beforeAll(async () => {
    if (!testCase) {
      skipReason = 'runtime_debugger.adt_amdp_debugger is not enabled';
      return;
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
      skipReason = 'no SAP configuration';
      return;
    }
    onSession = new AmdpDebugger(session, connectionLogger);
    onCommands = new AmdpDebugger(commands, connectionLogger);
    packageName = resolvePackageName(testCase.params?.package_name);
    transportRequest = packageName.startsWith('$')
      ? undefined
      : resolveTransportRequest(testCase.params?.transport_request) ||
        undefined;
    const transport = transportRequest ? { transportRequest } : {};

    // The two name each other: shells, bodies, then one group activation.
    const adt = new AdtClient(commands, connectionLogger);
    const ddl = adt.getDdl();
    const ddlConfig = {
      ddlName: DDL_NAME,
      packageName,
      description: 'AMDP debugger test table function',
      ...transport,
    };
    await ddl.create(ddlConfig);
    const ddlLock = await ddl.lock(ddlConfig);
    if (!ddlLock.ok)
      throw new Error(`lock ${DDL_NAME}: ${ddlLock.getError().message}`);
    const ddlHandle = String(ddlLock.getResult().value ?? '');
    await ddl.update(ddlConfig, { source: DDL_SOURCE, lockHandle: ddlHandle });
    await ddl.unlock(ddlConfig, ddlHandle);

    const cls = adt.getClass();
    const classConfig = {
      className: CLASS_NAME,
      packageName,
      description: 'AMDP debugger test class',
      ...transport,
    };
    await cls.create(classConfig);
    const clsLock = await cls.lock(classConfig);
    if (!clsLock.ok)
      throw new Error(`lock ${CLASS_NAME}: ${clsLock.getError().message}`);
    const clsHandle = String(clsLock.getResult().value ?? '');
    await cls.update(classConfig, {
      source: CLASS_SOURCE,
      lockHandle: clsHandle,
    });
    await cls.unlock(classConfig, clsHandle);

    const utils = new AdtUtils(commands, connectionLogger, {
      ...utilDocuments,
      activation: wireItself,
    });
    const started = await utils.activateObjectsGroup([
      { type: 'DDLS/DF', name: DDL_NAME },
      { type: 'CLAS/OC', name: CLASS_NAME },
    ]);
    const wire = started.ok ? started.getResult().value : undefined;
    const runId = /runs\/([^/?]+)/.exec(
      String(wire?.headers?.location ?? wire?.headers?.Location ?? ''),
    )?.[1];
    if (!runId) throw new Error('the group activation answered no run id');
    for (let i = 0; i < 10; i++) {
      const state = await utils.getActivationRun(runId, {
        withLongPolling: true,
      });
      const status = /status="([^"]*)"/.exec(
        String(state.ok ? state.getResult().value : ''),
      )?.[1];
      if (status && status !== 'running' && status !== 'waiting') break;
    }
    const outcome = await utils.getActivationResults(runId);
    const results = String(outcome.ok ? outcome.getResult().value : '');
    // activationExecuted="true" beside an error message is still a failure
    // (the errata): the class stays inactive, and a breakpoint in it is
    // answered with an empty state and never stops.
    const errors = [
      ...results.matchAll(
        /<msg\b[^>]*type="E"[^>]*>[\s\S]*?<txt>([^<]*)<\/txt>/g,
      ),
    ].map((m) => m[1]);
    if (!/activationExecuted="true"/.test(results) || errors.length) {
      throw new Error(
        `group activation: ${errors.join('; ') || results.slice(0, 600)}`,
      );
    }
    logTestStep(
      `${CLASS_NAME} and ${DDL_NAME} active in ${packageName}`,
      testsLogger,
    );

    // The debug session's connection: stateful, for the whole test.
    session.setSessionType('stateful');
  }, STEP_TIMEOUT);

  afterAll(async () => {
    if (!commands) return;
    if (mainId) {
      // Release whatever still stands before the stop: a stop does not.
      if (lastBreak && debuggeeId) {
        await onCommands.deleteDebuggee(mainId, debuggeeId);
      }
      await onCommands.stop(mainId);
    }
    if (run) {
      await Promise.race([run, new Promise((r) => setTimeout(r, 30_000))]);
    }
    if (!testCase?.params?.keep_probe) {
      const adt = new AdtClient(commands, connectionLogger);
      const transport = transportRequest ? { transportRequest } : {};
      await adt
        .getClass()
        .delete({ className: CLASS_NAME, packageName, ...transport });
      await adt
        .getDdl()
        .delete({ ddlName: DDL_NAME, packageName, ...transport });
    }
    session?.setSessionType('stateless');
    await closeOwnTestConnection(trigger);
    await closeOwnTestConnection(commands);
    await closeOwnTestConnection(session);
  }, STEP_TIMEOUT);

  it(
    'starts a debug session for the user and names it in Location',
    async () => {
      if (skipped()) return;
      const user = (await abapUserOf(session as Connection)).toUpperCase();
      // A session left behind by an interrupted run locks the user's AMDP
      // debugging (500 DEBUGGEE_CONTEXT_LOCKED_BY_ME, SY 530); a test takes it over.
      const started = await onSession.start(user, { stopExisting: true });
      expect(started.ok).toBe(true);
      mainId = /\/main\/([^/?]+)/.exec(locationOf(started))?.[1] ?? '';
      expect(mainId).toMatch(/^[0-9A-F]{32}$/);
      const body = String(started.ok ? started.getResult().value.data : '');
      expect(body).toContain('HANA_SESSION_ID');
      hanaSession = attr(body, 'amdpdbg:value') ?? '';
    },
    STEP_TIMEOUT,
  );

  it(
    'syncs breakpoints: the request id at once, the outcome as an event',
    async () => {
      if (skipped()) return;
      needs(mainId, 'a debug session');
      const synced = await onCommands.syncBreakpoints(mainId, breakpoints());
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

  it(
    'stops the procedure on its loop line with its variables',
    async () => {
      if (skipped()) return;
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

  it(
    'steps over a statement and sees the variable change',
    async () => {
      if (skipped()) return;
      needs(debuggeeId, 'a debuggee');
      const stepped = await onCommands.step(mainId, debuggeeId, 'over');
      expect(stepped.ok).toBe(true);
      expect(locationOf(stepped)).toMatch(/^[0-9A-F]{32}$/);
      await until('ON_BREAK');
      expect(lineOf(lastBreak as IEvent)).toBe(LINE.loop + 1);
      expect(variablesOf(lastBreak as IEvent).get('EV_TOTAL')).toBe('1');
    },
    STEP_TIMEOUT,
  );

  it(
    'continues to the next iteration, then to the end of the procedure',
    async () => {
      if (skipped()) return;
      needs(debuggeeId, 'a debuggee');
      await onCommands.step(mainId, debuggeeId, 'continue');
      await until('ON_BREAK');
      expect(lineOf(lastBreak as IEvent)).toBe(LINE.loop);
      expect(variablesOf(lastBreak as IEvent).get('LV_I')).toBe('2');

      await onCommands.step(mainId, debuggeeId, 'continue');
      await until('ON_BREAK');
      expect(variablesOf(lastBreak as IEvent).get('LV_I')).toBe('3');

      await onCommands.step(mainId, debuggeeId, 'continue');
      const end = await until('ON_EXECUTION_END', 'ON_BREAK');
      expect(end.some((e) => e.kind === 'ON_EXECUTION_END')).toBe(true);
    },
    STEP_TIMEOUT,
  );

  it(
    'stops in the table function as a debuggee of its own',
    async () => {
      if (skipped()) return;
      const procedureDebuggee = debuggeeId;
      if (lastBreak && lineOf(lastBreak) !== LINE.tf) await until('ON_BREAK');
      expect(lineOf(lastBreak as IEvent)).toBe(LINE.tf);
      expect(debuggeeId).not.toBe(procedureDebuggee);
    },
    STEP_TIMEOUT,
  );

  it(
    'reads a table variable: the whole of it, and through a SELECT of its own',
    async () => {
      if (skipped()) return;
      needs(debuggeeId, 'a debuggee in the table function');
      // One more iteration, so the table holds a row.
      await onCommands.step(mainId, debuggeeId, 'continue');
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
        ...where,
        provideRowId: true,
      });
      expect(whole.ok).toBe(true);
      const wholeXml = String(whole.ok ? whole.getResult().value : '');
      expect(column(wholeXml, 'N')).toEqual(['1']);
      expect(column(wholeXml, 'SQUARE')).toEqual(['1']);

      // A SELECT of the caller's.
      const selected = await onCommands.getDataPreview({
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

  it(
    'lets the run finish: no breakpoints, continue, and the run returns its output',
    async () => {
      if (skipped()) return;
      needs(debuggeeId, 'a debuggee');
      expect((await onCommands.syncBreakpoints(mainId, [])).ok).toBe(true);
      await onCommands.step(mainId, debuggeeId, 'continue');
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

  it(
    'cancels a debuggee where it stands, and the run fails',
    async () => {
      if (skipped()) return;
      needs(mainId, 'a debug session');
      await onCommands.syncBreakpoints(mainId, breakpoints());
      await until('SYNC_BREAKPOINTS');
      runClass();
      await until('ON_BREAK');

      const deleted = await onCommands.deleteDebuggee(mainId, debuggeeId);
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

  it(
    'stops the debug session',
    async () => {
      if (skipped()) return;
      needs(mainId, 'a debug session');
      expect((await onCommands.syncBreakpoints(mainId, [])).ok).toBe(true);
      const stopped = await onCommands.stop(mainId);
      expect(stopped.ok).toBe(true);
      mainId = '';
    },
    STEP_TIMEOUT,
  );
});
