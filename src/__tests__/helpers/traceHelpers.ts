/**
 * Waiting for a trace, in the tests — where the waiting belongs.
 *
 * `runWithProfiling` used to poll for the trace and throw when it found none.
 * That made the normal case — SAP has not written it yet — look like a failed
 * run, and its fallback took the first id in the feed, which is not the newest:
 * a feed's first entries have been measured minutes old while its last were
 * eight days older. So a run could "succeed" with somebody else's week-old
 * trace.
 *
 * The contract now says a run promises no trace. A caller that wants the trace
 * ITS run produced notes the ids beforehand and waits for a new one. That is
 * what this does, and it is a test concern: the library should not decide how
 * long anybody is willing to wait.
 */

import {
  compareRecordedAt,
  profilerDbAccesses,
  profilerHitList,
  profilerStatements,
  profilerTraceEntries,
  traceSchedulingProfilerId,
  traceSchedulingRequests,
  traceSchedulingTypes,
} from '@mcp-abap-adt/adt-strategies';
import type { IProfilerListOptions } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ClassExecutor,
  classExecutorDocuments,
} from '../../executors/class/ClassExecutor';
import {
  ProgramExecutor,
  programExecutorDocuments,
} from '../../executors/program/ProgramExecutor';
import {
  Profiler,
  profilerDocuments,
} from '../../runtime/traces/ProfilerDomain';
import { expectResult } from './contract';

/**
 * The profiler readings a test that asserts entries and views constructs with.
 *
 * `Profiler` answers the documents as they came by default, and
 * `AdtRuntimeClient.getProfiler()` builds that default; these tests read ids,
 * timestamps and rows, so they build their own. Imported from the strategies
 * package source until its index exports them.
 */
export const profilerReading = {
  ...profilerDocuments,
  list: profilerTraceEntries,
  hitlist: profilerHitList,
  statements: profilerStatements,
  dbAccesses: profilerDbAccesses,
};

export type ReadingProfiler = Profiler<typeof profilerReading>;

/** A profiler that reads its feed into entries and its views into rows. */
export function readingProfiler(
  connection: IAbapConnection,
  logger: ILogger,
): ReadingProfiler {
  return new Profiler(connection, logger, profilerReading);
}

export interface IWaitForTraceOptions extends IProfilerListOptions {
  /** How many times to look. */
  attempts?: number;
  /** How long between looks, in milliseconds. */
  delayMs?: number;
  logger?: ILogger;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The ids visible right now — what "new" is measured against. */
export async function traceIdsNow(
  profiler: ReadingProfiler,
  options?: IProfilerListOptions,
): Promise<Set<string>> {
  return new Set(
    expectResult(await profiler.list(options), 'profiler.list').map(
      (entry) => entry.id,
    ),
  );
}

/**
 * The id of a trace that was not there before, or `undefined` if none appears.
 *
 * Returns rather than throws: "no trace yet" is information, and the caller
 * decides whether that is a failure. Scope with `user` on a shared system —
 * otherwise somebody else's run can satisfy the wait.
 */
export async function waitForNewTrace(
  profiler: ReadingProfiler,
  before: Set<string>,
  options: IWaitForTraceOptions = {},
): Promise<string | undefined> {
  const { attempts = 10, delayMs = 3000, logger, ...listOptions } = options;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const entries = expectResult(
      await profiler.list(listOptions),
      'profiler.list',
    );
    const fresh = entries.filter((entry) => !before.has(entry.id));
    if (fresh.length > 0) {
      // Newest by timestamp, not by position — see the file comment.
      const newest = fresh.reduce((latest, entry) =>
        compareRecordedAt(entry, latest) > 0 ? entry : latest,
      );
      logger?.debug?.('New trace appeared', {
        attempt,
        traceId: newest.id,
        recordedAt: newest.recordedAt,
      });
      return newest.id;
    }
    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }

  logger?.debug?.('No new trace appeared', { attempts, delayMs });
  return undefined;
}

/**
 * The trace-scheduling readings an executor test constructs with: the
 * catalogues and the schedule read into items, the scheduled request id read
 * out of `Location` — which the default, reading the empty body, answers as
 * `''`.
 */
export const schedulingReading = {
  types: traceSchedulingTypes,
  requests: traceSchedulingRequests,
  scheduled: traceSchedulingProfilerId,
};

export function readingClassExecutor(
  connection: IAbapConnection,
  logger: ILogger,
) {
  return new ClassExecutor(connection, logger, {
    ...classExecutorDocuments,
    ...schedulingReading,
  });
}

export function readingProgramExecutor(
  connection: IAbapConnection,
  logger: ILogger,
) {
  return new ProgramExecutor(connection, logger, {
    ...programExecutorDocuments,
    ...schedulingReading,
  });
}
