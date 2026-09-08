/**
 * Which call it was — the part a failure loses on the way up.
 *
 * `IAdtError.request` exists so a caller can locate a refusal: `delete()` sends
 * two requests and `create()` six, and "object is locked" means a different
 * thing depending on which of them asked.
 *
 * It arrives on its own two ways. A request that throws carries its own config,
 * and `recogniseFailure` reads it. A document `sapErrorIn` recognises becomes an
 * `AdtSAPError` built with the request beside it. What was left out is the third
 * way a refusal reaches a caller: an answer of `200 OK` whose verdict is in a
 * document nobody classifies as an exception — an activation checklist, a
 * deletion check, a publication's `<SEVERITY>` — read by a shipped `analyse`
 * instead. Those reach their strategy with the URL already gone, because the
 * connection normalises a successful answer down to four fields:
 *
 * ```
 * keys:     status, statusText, headers, data      // a 200, measured
 * config?   NONE
 * request?  NONE
 * ```
 *
 * So `withRefusalDetection` — which already holds the request, and already
 * wraps every connection the clients are given — attaches it on the way back,
 * and this is where the vocabulary for reading it lives.
 *
 * **A stand-in, deliberately.** `IAdtWireResponse.request` is already in the
 * contract, typed `unknown` and populated by nobody. Its resting place is the
 * connection filling it and the contract typing it; until then it is filled
 * here, where real traffic can be run against it.
 */

import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';

/** Enough to say which call, and nothing more. Matches `IAdtError.request`. */
export interface IAdtRequestTrace {
  readonly method?: string;
  readonly url?: string;
}

/**
 * Read the trace back off an answer, for an `analyse` building a failure.
 *
 * Answers `undefined` rather than an empty object when there is nothing to
 * report — an answer from a connection no client wrapped, most often a handler
 * constructed directly rather than through `AdtClient` — so a failure carries
 * the field only when it means something.
 */
export function requestOf(
  answer?: IAdtWireResponse,
): IAdtRequestTrace | undefined {
  const carried = answer?.request as IAdtRequestTrace | undefined;
  if (!carried || (!carried.url && !carried.method)) return undefined;
  return { method: carried.method, url: carried.url };
}
