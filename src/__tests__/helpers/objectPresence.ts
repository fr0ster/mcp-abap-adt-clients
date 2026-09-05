/**
 * Is the object there?
 *
 * Every `ensureObjectReady` asked this the same way and all of them were wrong
 * in the same way: `await handler.readMetadata(…)` inside a `try`, taking the
 * absence of a throw as "it exists". A read does not throw for a missing object
 * any more — the refusal is the other half of the answer — so that `try` always
 * fell through to "it exists", and every one of those tests refused to run
 * against a system that was in exactly the state it wanted.
 *
 * Measured: `Z_AC_FM03` was deleted, verified absent from `ZAC_SHR_FUGR`, and
 * the FunctionModule flow still reported "already exists. Post-test cleanup
 * will delete it." and verified nothing.
 *
 * The three answers are kept apart, because a test does different things with
 * each: it is there, it is not there, or we could not find out — and the last
 * one must never be silently read as either of the first two. That is the same
 * rule `ensureSharedDependency` follows, and for the same measured reason: a
 * flaky link once read as "missing", and the create that followed came back
 * `ExceptionResourceAlreadyExists`.
 */

import type { IAdtResponse } from '@mcp-abap-adt/interfaces';

export type ObjectPresence =
  | { present: true }
  | { present: false }
  | { present: 'unknown'; reason: string };

/**
 * Read a presence verdict out of an answer.
 *
 * @param answer what the read member answered
 * @param what a label for the object, used in the `unknown` reason
 */
export function presenceOf(
  answer: IAdtResponse<unknown>,
  what: string,
): ObjectPresence {
  if (answer.ok) {
    const value = answer.getResult().value;
    // ADT answers absence with 200 and an empty body on the measured systems,
    // so an empty document is not "it is there".
    const present =
      typeof value === 'string'
        ? value.trim() !== ''
        : value !== undefined && value !== null;
    return present ? { present: true } : { present: false };
  }

  const failure = answer.getError();
  const status = failure.response?.status;
  // A refusal naming the object as non-existent is absence: that is the
  // sentence a cloud system answers in place of a 404.
  if (status === 404 || /does not exist/i.test(failure.message ?? '')) {
    return { present: false };
  }
  return {
    present: 'unknown',
    reason: `Cannot verify ${what} [${failure.origin}]: ${failure.message}`,
  };
}
