/**
 * A program run a debugger test started, settled and judged.
 *
 * A debugger test starts a run on another session and leaves it caught at a
 * breakpoint. Its cleanup releases the debugger state, and then the run has
 * to come back — with its output, or with the error a terminated program
 * ends with. A run that does not come back within the wait is a failure, and
 * so is one that comes back with any other answer: neither is a run that was
 * released. The wait is the test's own, never one of the library's.
 *
 * What a terminated run answers: "the program's run returns … with an error
 * after a termination" (docs/usage/ERRATA.md, measured on premise, BASIS
 * 758). The error asserted here is the one a terminated ABAP request ends
 * with over HTTP: status 500. Any other refusal, a connection failure (no
 * status) and a throw fail.
 */

import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { failureOf } from './contract';

/** How the run is expected to end. */
export type RunEnd =
  /** It ran to its end: only a success. */
  | 'completed'
  /** It may have been terminated: a success, or the HTTP 500 of a termination. */
  | 'completed-or-terminated';

const NOT_SETTLED = Symbol('not settled');

/**
 * Wait up to `ms` for `run`, then judge its answer. Throws when it has not
 * settled, when it rejects, and when its answer is not one `end` accepts.
 * Resolves with the answer otherwise.
 */
export async function settleRun(
  run: Promise<IAdtResponse<unknown>>,
  ms: number,
  what: string,
  end: RunEnd,
): Promise<IAdtResponse<unknown>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settled = await Promise.race([
    run,
    new Promise<typeof NOT_SETTLED>((resolve) => {
      timer = setTimeout(() => resolve(NOT_SETTLED), ms);
    }),
  ]).finally(() => clearTimeout(timer));
  if (settled === NOT_SETTLED) {
    throw new Error(`${what} did not settle within ${ms} ms`);
  }
  if (settled.ok) return settled;
  if (
    end === 'completed-or-terminated' &&
    settled.getError().response?.status === 500
  ) {
    return settled;
  }
  throw new Error(failureOf(settled, what));
}
