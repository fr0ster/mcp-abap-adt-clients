/**
 * The one thing every script in here does with an answer.
 *
 * A script has no caller to hand a failure back to — its output is a terminal
 * and its error handling is exiting non-zero. So it unwraps: the result when
 * there is one, and a thrown error naming what SAP said when there is not.
 * Library code must never do this; a script is exactly where it belongs.
 */

import type { IAdtResponse } from '@mcp-abap-adt/interfaces';

export function resultOf<T>(answer: IAdtResponse<T>): T {
  if (!answer.ok) {
    const failure = answer.getError();
    throw new Error(`[${failure.origin}] ${failure.message}`);
  }
  return answer.getResult().value;
}
