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

import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { deletionRefusedIn, failureOf, saysAbsent } from './contract';

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
  // A refusal naming the object as non-existent is absence: that is the
  // sentence a cloud system answers in place of a 404.
  if (saysAbsent(failure)) {
    return { present: false };
  }
  return {
    present: 'unknown',
    reason: `Cannot verify ${what} [${failure.origin}]: ${failure.message}`,
  };
}

/**
 * A removal of something that may not be there, such as a leftover from an
 * earlier run: removed, or refused because it is absent. Any other refusal —
 * locked, not authorised, a dangling reference — fails, with what SAP said,
 * instead of reappearing three steps later as a `409` on the create.
 *
 * Absence is read as {@link presenceOf} reads it: a 404, or a refusal naming
 * the object as non-existent.
 */
export function expectRemovedOrAbsent(
  answer: IAdtResponse<unknown>,
  what: string,
): 'removed' | 'absent' {
  if (answer.ok) {
    // A 200 is removed only when its deletion document says so.
    const refused = deletionRefusedIn(answer, what);
    if (refused) throw new Error(refused);
    return 'removed';
  }
  if (presenceOf(answer, what).present === false) return 'absent';
  throw new Error(failureOf(answer, what));
}

/**
 * Remove a leftover of an earlier run: read first, delete only what is there.
 *
 * A delete alone cannot tell "gone" from "refused". Measured on premise
 * (2026-10-25): a deleted object whose request is still open reads `404`, yet a
 * second delete answers `isDeleted="false"` with "Release transport … to remove
 * the object directory entry" — and a test may not release a request. The read
 * is the question; the delete runs only when it says the object is there.
 *
 * @param what the delete's label, as {@link expectRemovedOrAbsent} takes it
 * @param read the type's read, judged; absence as {@link presenceOf} reads it
 * @param remove the type's delete, judged
 */
export async function removeLeftover(
  what: string,
  read: () => Promise<IAdtResponse<unknown>>,
  remove: () => Promise<IAdtResponse<unknown>>,
): Promise<'removed' | 'absent'> {
  const presence = presenceOf(await read(), what);
  if (presence.present === 'unknown') throw new Error(presence.reason);
  if (presence.present === false) return 'absent';
  return expectRemovedOrAbsent(await remove(), what);
}
