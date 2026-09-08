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

import type { ILogger, IProfilerListOptions } from '@mcp-abap-adt/interfaces';
import type { Profiler } from '../../runtime/traces/ProfilerDomain';
import { compareRecordedAt } from '../../runtime/traces/traceParsing';
import { expectResult } from './contract';

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
  profiler: Profiler,
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
  profiler: Profiler,
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
