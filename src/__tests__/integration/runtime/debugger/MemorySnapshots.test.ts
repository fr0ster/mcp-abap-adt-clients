/**
 * Integration test for memory under the debugger: AbapDebugger's memory
 * members, and the snapshots they write read back through MemorySnapshots.
 *
 * The test runs a class that fills an internal table between two breakpoints
 * — the shared ZAC_SHR_DBG_MEM, ensured from `shared_dependencies` and never
 * deleted — stops at both, and at each reads the memory sizes and writes a
 * memory snapshot. The table is what the reading must show: the sizes grow
 * between the stops, and the delta of the two snapshots puts the table first.
 *
 * Two test cases, because reading back needs more than writing:
 * - `adt_memory_debugger` — sizes and snapshot writing;
 * - `adt_memory_snapshots` — the snapshots read back. A written snapshot
 *   reaches the list minutes later, so the test waits for it
 *   (`list_wait_seconds`). The user needs the authorization object
 *   `S_MEM_SNAP` in a role: without it the list answers 200 and empty, with
 *   no error, and the wait runs out.
 *
 * Nothing else may listen for the same SAP user while this runs (see
 * AbapDebugger.test.ts).
 *
 * Run: npm test -- src/__tests__/integration/runtime/debugger/MemorySnapshots.test.ts
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseDebuggeeEnd } from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtResponse,
  IDebuggerIdentity,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { ClassExecutor } from '../../../../executors/class/ClassExecutor';
import {
  AbapDebugger,
  abapDebuggerDocuments,
} from '../../../../runtime/debugger/AbapDebugger';
import { MemorySnapshots } from '../../../../runtime/memory/MemorySnapshots';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  gateAll,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { CleanupSteps } from '../../../helpers/cleanupSteps';
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

const testCase = configuredCase('runtime_debugger', 'adt_memory_debugger');
// Disabled in test-config.yaml, or no SAP: registered as skipped.
const debuggerCase = gate('runtime_debugger', 'adt_memory_debugger');
const readCase = configuredCase('runtime_debugger', 'adt_memory_snapshots');
// The read-back needs its own case as well.
const snapshotsCase = gateAll(
  debuggerCase,
  gate('runtime_debugger', 'adt_memory_snapshots'),
);
const CLASS_NAME: string = (
  testCase?.params?.class_name ?? 'ZAC_SHR_DBG_MEM'
).toUpperCase();
const LIST_WAIT_SECONDS = Number(readCase?.params?.list_wait_seconds ?? 900);
const STEP_TIMEOUT = 120_000;

/**
 * The probe: a shared class (`shared_dependencies.classes`), never created or
 * deleted here. It fills a table between its `"BP:before` and `"BP:after`
 * lines; how many rows is read from its `DO <n> TIMES` line.
 */
const SOURCE = sharedSource('classes', CLASS_NAME);
const LINE = markerLines(SOURCE, '"BP:');
const MARKERS = ['before', 'after'];
const ROWS = Number(/\bDO (\d+) TIMES\./.exec(SOURCE)?.[1]);
const SOURCE_URI = `/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main`;

function attr(xml: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
}

function tag(xml: string, name: string): string | undefined {
  return new RegExp(`<(?:\\w+:)?${name}>([^<]*)</(?:\\w+:)?${name}>`).exec(
    xml,
  )?.[1];
}

function documentOf(answer: IAdtResponse<unknown>): string {
  return answer.ok
    ? String(answer.getResult().value ?? '')
    : String(answer.getError().response?.data ?? '');
}

/** Every number in the sizes document, summed: it only has to grow. */
function totalOf(sizesXml: string): number {
  return [...sizesXml.matchAll(/>(\d+)</g)].reduce(
    (sum, m) => sum + Number(m[1]),
    0,
  );
}

async function abapUserOf(connection: IAbapConnection): Promise<string> {
  const configured = process.env.SAP_USERNAME?.trim();
  if (configured) return configured.toUpperCase();
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
  return String(info.userName).toUpperCase();
}

type Connection = IAbapConnection & ISessionLifecycleAware;

interface IStop {
  sizes: string;
  /** The file the snapshot was written to, from the action's `data`. */
  file: string;
}

describe('Memory under the debugger (AbapDebugger, MemorySnapshots)', () => {
  let listenerConnection: Connection | undefined;
  let triggerConnection: Connection | undefined;
  let sessionConnection: Connection | undefined;
  let listenerApi: AbapDebugger;
  let debuggerApi: AbapDebugger;
  let identity: IDebuggerIdentity;

  const armed: string[] = [];
  let run: Promise<IAdtResponse<unknown>> | undefined;
  let attached = false;
  const stops: Partial<Record<'before' | 'after', IStop>> = {};
  /** Snapshot ids by stop, once the list has them. */
  const ids: Partial<Record<'before' | 'after', string>> = {};

  function needs(condition: unknown, what: string): void {
    if (!condition) throw new Error(`not reached: ${what}`);
  }

  beforeAll(async () => {
    if (!testCase) {
      throw new Error(
        missingCaseMessage('runtime_debugger', 'adt_memory_debugger'),
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
    const user = await abapUserOf(listenerConnection);
    const id = (part: string): string =>
      createHash('sha256')
        .update(`${process.env.SAP_URL}:${user}:memory:${part}`)
        .digest('hex')
        .slice(0, 32)
        .toUpperCase();
    identity = {
      debuggingMode: 'user',
      requestUser: user,
      terminalId: id('t'),
      ideId: id('i'),
    };
    listenerApi = new AbapDebugger(
      listenerConnection,
      connectionLogger,
      abapDebuggerDocuments,
    );
    if (!Number.isFinite(ROWS)) {
      throw new Error(
        `the source of shared class ${CLASS_NAME} has no DO <n> TIMES line`,
      );
    }
    await ensureDebugTarget(
      listenerConnection,
      'classes',
      CLASS_NAME,
      { marker: '"BP:', names: MARKERS },
      testsLogger,
    );
    logTestStep(`probe ${CLASS_NAME} active`, testsLogger);
    listenerConnection.setSessionType('stateful');
  }, STEP_TIMEOUT);

  afterAll(async () => {
    if (!listenerConnection) return;
    // Debugger state only: the probe is shared and stays. Every session this
    // file opened is logged off, and every failure is reported.
    const steps = new CleanupSteps();
    for (const bp of armed) {
      await steps.run(
        `delete breakpoint ${bp}`,
        () => listenerApi.deleteBreakpoint(identity, bp),
        { checkAnswer: true },
      );
    }
    if (attached) {
      await steps.run(
        'continue the debuggee',
        () => debuggerApi.step('stepContinue'),
        { checkAnswer: true },
      );
    }
    await steps.logOff('the debug session', sessionConnection);
    await steps.run(
      'stop the listener',
      () => listenerApi.stopListener(identity),
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

  debuggerCase(
    'stops before the table is filled',
    async () => {
      const set = await listenerApi.setBreakpoints(
        identity,
        [
          { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.before}` },
          { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.after}` },
        ],
        { headers: integrationHeadersOf(listenerApi, 'setBreakpoints') },
      );
      expect(set.ok).toBe(true);
      for (const m of documentOf(set).matchAll(/\bid="([^"]*)"/g))
        armed.push(m[1]);
      expect(armed).toHaveLength(2);

      const listener = listenerApi.listen(identity, { holdSeconds: 60 });
      const early = await Promise.race([
        listener,
        new Promise<undefined>((r) => setTimeout(() => r(undefined), 2000)),
      ]);
      if (early && !early.ok) {
        throw new Error(
          `the listener was refused: another debugger holds ${identity.requestUser}'s debugging — close it and run again`,
        );
      }
      needs(triggerConnection, 'the trigger connection');
      run = new ClassExecutor(
        triggerConnection as Connection,
        connectionLogger,
      ).run({ className: CLASS_NAME });
      const caught = documentOf(await listener);
      const debuggeeId = tag(caught, 'DEBUGGEE_ID');
      needs(debuggeeId, `a debuggee: ${caught.slice(0, 300)}`);

      sessionConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      sessionConnection.setSessionType('stateful');
      debuggerApi = new AbapDebugger(
        sessionConnection,
        connectionLogger,
        abapDebuggerDocuments,
      );
      const attach = await debuggerApi.attach(identity, debuggeeId as string, {
        server: tag(caught, 'INSTANCE_NAME'),
      });
      expect(attach.ok).toBe(true);
      attached = attach.ok;
      const stack = documentOf(await debuggerApi.getStack());
      expect(Number(attr(stack, 'line'))).toBe(LINE.before);
    },
    STEP_TIMEOUT,
  );

  async function atStop(stop: 'before' | 'after'): Promise<void> {
    needs(attached, 'the debug session');
    const sizes = await debuggerApi.getMemorySizes();
    expect(sizes.ok).toBe(true);
    const snapshot = await debuggerApi.createMemorySnapshot();
    const answer = documentOf(snapshot);
    expect(snapshot.ok).toBe(true);
    expect(attr(answer, 'isError')).toBe('false');
    const file = attr(answer, 'data')?.split(',').pop();
    needs(file, `the snapshot's file: ${answer.slice(0, 300)}`);
    stops[stop] = { sizes: documentOf(sizes), file: file as string };
    logTestStep(`${stop}: snapshot ${file}`, testsLogger);
  }

  debuggerCase(
    'reads the memory sizes and writes a snapshot before',
    async () => {
      await atStop('before');
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'after the table is filled, the sizes have grown and a second snapshot is written',
    async () => {
      needs(stops.before, 'the first stop');
      const moved = await debuggerApi.step('stepContinue');
      expect(moved.ok).toBe(true);
      const stack = documentOf(await debuggerApi.getStack());
      expect(Number(attr(stack, 'line'))).toBe(LINE.after);
      await atStop('after');
      // The table holds ROWS strings of over a hundred characters.
      expect(
        totalOf(stops.after?.sizes ?? '') - totalOf(stops.before?.sizes ?? ''),
      ).toBeGreaterThan(ROWS * 100);
    },
    STEP_TIMEOUT,
  );

  debuggerCase(
    'the program runs to its end',
    async () => {
      needs(run, 'the run');
      // Continuing to the end is answered 500 debuggeeEnded; analyseDebuggeeEnd
      // reads it as the step having worked (ERRATA.md).
      const toEnd = await debuggerApi.step('stepContinue', {
        analyse: analyseDebuggeeEnd,
      });
      expect(toEnd.ok).toBe(true);
      expect(documentOf(toEnd)).toContain('debuggeeEnded');
      attached = false;
      const ran = (await run) as IAdtResponse<unknown>;
      expect(ran.ok).toBe(true);
      expect(documentOf(ran)).toContain(`rows ${ROWS}`);
    },
    STEP_TIMEOUT,
  );

  // --- read back ------------------------------------------------------------------

  snapshotsCase(
    'both snapshots reach the list',
    async () => {
      needs(stops.after, 'both snapshots written');
      const snapshots = new MemorySnapshots(
        triggerConnection as Connection,
        connectionLogger,
      );
      const deadline = Date.now() + LIST_WAIT_SECONDS * 1000;
      for (;;) {
        const list = await snapshots.list({ user: identity.requestUser });
        expect(list.ok).toBe(true);
        for (const entry of documentOf(list).split('</mi:snapshot>')) {
          const file = tag(entry, 'fileName') ?? '';
          for (const stop of ['before', 'after'] as const) {
            if (file.endsWith(`/${stops[stop]?.file}`))
              ids[stop] = tag(entry, 'id');
          }
        }
        if ((ids.before && ids.after) || Date.now() > deadline) break;
        await new Promise((r) => setTimeout(r, 30_000));
      }
      expect(ids.before).toBeDefined();
      expect(ids.after).toBeDefined();
    },
    LIST_WAIT_SECONDS * 1000 + STEP_TIMEOUT,
  );

  snapshotsCase(
    'reads a snapshot, its overview, ranking list and references, and the delta',
    async () => {
      needs(ids.before && ids.after, 'both snapshots listed');
      const snapshots = new MemorySnapshots(
        triggerConnection as Connection,
        connectionLogger,
      );
      const before = ids.before as string;
      const after = ids.after as string;

      const header = await snapshots.getById(after);
      expect(header.ok).toBe(true);
      expect(tag(documentOf(header), 'fileName')).toContain(stops.after?.file);

      const overview = await snapshots.getOverview(after);
      expect(overview.ok).toBe(true);
      expect(documentOf(overview)).toContain('abapDynMemObjectsUsed');

      const ranking = await snapshots.getRankingList(after, {
        maxNumberOfObjects: 5,
      });
      expect(ranking.ok).toBe(true);
      expect(documentOf(ranking)).toContain('memoryObject');

      // The delta puts the filled table first, as an object added.
      const delta = await snapshots.getDeltaRankingList(before, after, {
        maxNumberOfObjects: 5,
      });
      expect(delta.ok).toBe(true);
      const first = documentOf(delta).split('</mi:memoryObject>')[0];
      expect(tag(first, 'text')).toContain('LT_ROWS');
      expect(tag(first, 'deltaSegment')).toBe('added');
      const key = tag(first, 'key') as string;

      const deltaOverview = await snapshots.getDeltaOverview(before, after);
      expect(deltaOverview.ok).toBe(true);
      expect(documentOf(deltaOverview)).toContain('<mi:delta>');

      const references = await snapshots.getReferences(after, key, {
        maxNumberOfReferences: 5,
      });
      expect(references.ok).toBe(true);
      expect(documentOf(references)).toContain('LT_ROWS');

      const deltaReferences = await snapshots.getDeltaReferences(
        before,
        after,
        key,
        { maxNumberOfReferences: 5 },
      );
      expect(deltaReferences.ok).toBe(true);

      // A table of strings has no children of its own.
      const children = await snapshots.getChildren(after, key, {
        maxNumberOfObjects: 5,
      });
      expect(children.ok).toBe(true);
      const deltaChildren = await snapshots.getDeltaChildren(
        before,
        after,
        key,
        { maxNumberOfObjects: 5 },
      );
      expect(deltaChildren.ok).toBe(true);

      const missing = await snapshots.getById(
        '00000000000000000000000000000000',
      );
      expect(missing.ok).toBe(false);
      if (!missing.ok) expect(missing.getError().response?.status).toBe(404);
    },
    STEP_TIMEOUT,
  );
});
