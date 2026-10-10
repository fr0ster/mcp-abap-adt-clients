/**
 * Integration test for memory under the debugger: AbapDebugger's memory
 * members, and the snapshots they write read back through MemorySnapshots.
 *
 * The test deploys a class that fills an internal table between two
 * breakpoints, stops at both, and at each reads the memory sizes and writes a
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
import { AdtClient } from '../../../../clients/AdtClient';
import { ClassExecutor } from '../../../../executors/class/ClassExecutor';
import {
  AbapDebugger,
  abapDebuggerDocuments,
} from '../../../../runtime/debugger/AbapDebugger';
import { MemorySnapshots } from '../../../../runtime/memory/MemorySnapshots';
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

const testCase = getEnabledTestCase('runtime_debugger', 'adt_memory_debugger');
const readCase = getEnabledTestCase('runtime_debugger', 'adt_memory_snapshots');
const CLASS_NAME: string = (
  testCase?.params?.class_name ?? 'ZAC_DBG_MEM'
).toUpperCase();
const ROWS = 100_000;
const LIST_WAIT_SECONDS = Number(readCase?.params?.list_wait_seconds ?? 900);
const STEP_TIMEOUT = 120_000;

const SOURCE = `CLASS ${CLASS_NAME.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.
ENDCLASS.

CLASS ${CLASS_NAME.toLowerCase()} IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    DATA lt_rows TYPE STANDARD TABLE OF string WITH EMPTY KEY.
    DATA(lv_count) = lines( lt_rows ). "BP:before
    DO ${ROWS} TIMES.
      APPEND |row { sy-index } { repeat( val = 'x' occ = 100 ) }| TO lt_rows.
    ENDDO.
    lv_count = lines( lt_rows ). "BP:after
    out->write( |rows { lv_count }| ).
  ENDMETHOD.
ENDCLASS.
`;

const LINE: Record<string, number> = {};
SOURCE.split('\n').forEach((text, index) => {
  const marker = /"BP:(\w+)/.exec(text);
  if (marker) LINE[marker[1]] = index + 1;
});
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
  let packageName = '';
  let transportRequest: string | undefined;
  let skipReason: string | undefined;

  const armed: string[] = [];
  let run: Promise<IAdtResponse<unknown>> | undefined;
  let attached = false;
  const stops: Partial<Record<'before' | 'after', IStop>> = {};
  /** Snapshot ids by stop, once the list has them. */
  const ids: Partial<Record<'before' | 'after', string>> = {};

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

  beforeAll(async () => {
    if (!testCase) {
      skipReason = 'runtime_debugger.adt_memory_debugger is not enabled';
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
    const user = await abapUserOf(listenerConnection);
    const id = (part: string): string =>
      createHash('sha256')
        .update(`${process.env.SAP_URL}:${user}:memory:${part}`)
        .digest('hex')
        .slice(0, 32)
        .toUpperCase();
    identity = { requestUser: user, terminalId: id('t'), ideId: id('i') };
    listenerApi = new AbapDebugger(
      listenerConnection,
      connectionLogger,
      abapDebuggerDocuments,
    );
    packageName = resolvePackageName(testCase.params?.package_name);
    transportRequest = packageName.startsWith('$')
      ? undefined
      : resolveTransportRequest(testCase.params?.transport_request) ||
        undefined;

    const cls = new AdtClient(listenerConnection, connectionLogger).getClass();
    const config = {
      className: CLASS_NAME,
      packageName,
      description: 'Memory integration probe',
      ...(transportRequest ? { transportRequest } : {}),
    };
    const created = await cls.create(config);
    // A probe kept from an earlier run is rewritten in place; the 400 says so
    // in its body, not in the message.
    if (
      !created.ok &&
      !/exist/i.test(String(created.getError().response?.data ?? ''))
    ) {
      throw new Error(
        `probe create: ${created.getError().message} ${String(created.getError().response?.data ?? '').slice(0, 300)}`,
      );
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
    listenerConnection.setSessionType('stateful');
  }, STEP_TIMEOUT);

  afterAll(async () => {
    if (!listenerConnection) return;
    for (const bp of armed) await listenerApi.deleteBreakpoint(identity, bp);
    if (attached) await debuggerApi.step('stepContinue');
    if (sessionConnection) {
      sessionConnection.setSessionType('stateless');
      await closeOwnTestConnection(sessionConnection);
    }
    await listenerApi.stopListener(identity);
    if (run) {
      await Promise.race([
        run,
        new Promise((resolve) => setTimeout(resolve, 15_000)),
      ]);
    }
    listenerConnection.setSessionType('stateless');
    if (!testCase?.params?.keep_probe) {
      await new AdtClient(listenerConnection, connectionLogger)
        .getClass()
        .delete({
          className: CLASS_NAME,
          packageName,
          ...(transportRequest ? { transportRequest } : {}),
        });
    }
    await closeOwnTestConnection(triggerConnection);
    await closeOwnTestConnection(listenerConnection);
  }, STEP_TIMEOUT);

  it(
    'stops before the table is filled',
    async () => {
      if (skipped()) return;
      const set = await listenerApi.setBreakpoints(identity, [
        { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.before}` },
        { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.after}` },
      ]);
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
      const attach = await debuggerApi.attach(
        identity.requestUser,
        debuggeeId as string,
        { server: tag(caught, 'INSTANCE_NAME') },
      );
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

  it(
    'reads the memory sizes and writes a snapshot before',
    async () => {
      if (skipped()) return;
      await atStop('before');
    },
    STEP_TIMEOUT,
  );

  it(
    'after the table is filled, the sizes have grown and a second snapshot is written',
    async () => {
      if (skipped()) return;
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

  it(
    'the program runs to its end',
    async () => {
      if (skipped()) return;
      needs(run, 'the run');
      // Continuing to the end is answered 500 debuggeeEnded (see
      // AbapDebugger.test.ts): a failure to the default analyse, the end here.
      const toEnd = await debuggerApi.step('stepContinue');
      expect(toEnd.ok).toBe(false);
      expect(documentOf(toEnd)).toContain('debuggeeEnded');
      attached = false;
      const ran = await run;
      expect(documentOf(ran as IAdtResponse<unknown>)).toContain(
        `rows ${ROWS}`,
      );
    },
    STEP_TIMEOUT,
  );

  // --- read back ------------------------------------------------------------------

  it(
    'both snapshots reach the list',
    async () => {
      if (skipped()) return;
      if (!readCase) {
        testsLogger.info?.(
          'skipped: runtime_debugger.adt_memory_snapshots is not enabled here',
        );
        return;
      }
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

  it(
    'reads a snapshot, its overview, ranking list and references, and the delta',
    async () => {
      if (skipped() || !readCase) return;
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
