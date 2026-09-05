/**
 * Reading `IAdtResponse` in a test, without losing why it failed.
 *
 * Since 17.0.0 the `getUtils()` members answer the contract instead of throwing,
 * so a test that wants the value has to check `ok` first. Written by hand that is
 * three lines of ceremony per call, and the tempting shortcut —
 * `(await utils.x()).getResult()!.value` — throws `TypeError: Cannot read
 * properties of undefined` on failure, which says nothing about what SAP refused.
 *
 * These two exist so the failure message is the server's own sentence.
 */

import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces';

/**
 * The value, failing the test with what SAP said when there is none.
 *
 * @param answer the contract a member answered with
 * @param what a label for the call, so a failure names it — e.g. `'discovery'`
 */
export function expectResult<T>(answer: IAdtResponse<T>, what: string): T {
  if (!answer.ok) {
    const failure = answer.getError();
    throw new Error(
      `${what} failed [${failure.origin}]: ${failure.message}` +
        (failure.request?.url ? ` (${failure.request.url})` : ''),
    );
  }
  return answer.getResult().value;
}

/**
 * The failure, failing the test when the call unexpectedly succeeded.
 *
 * The counterpart matters as much: a member that stopped refusing something it
 * used to refuse is a behaviour change, and `expect(...).rejects.toThrow()` no
 * longer catches it now that failures come back instead of flying past.
 */
export function expectFailure<T>(
  answer: IAdtResponse<T>,
  what: string,
): IAdtError {
  if (answer.ok) {
    throw new Error(`${what} was expected to fail, but it answered a result`);
  }
  return answer.getError();
}
