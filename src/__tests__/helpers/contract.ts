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

import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces-adt';

/**
 * The value, failing the test with what SAP said when there is none.
 *
 * @param answer the contract a member answered with
 * @param what a label for the call, so a failure names it — e.g. `'discovery'`
 */
export function expectResult<T>(answer: IAdtResponse<T>, what: string): T {
  if (!answer.ok) throw new Error(failureOf(answer, what));
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

/**
 * Whether a refusal says the object is not there: a 404, or the sentence a
 * cloud system answers in place of one. What `presenceOf` calls absence.
 */
export function saysAbsent(failure: IAdtError): boolean {
  return (
    failure.response?.status === 404 ||
    /does not exist/i.test(failure.message ?? '')
  );
}

/** The sentence {@link expectResult} throws, for a caller that collects it. */
export function failureOf(answer: IAdtResponse<unknown>, what: string): string {
  if (answer.ok) return '';
  const failure = answer.getError();
  return (
    `${what} failed [${failure.origin}]: ${failure.message}` +
    (failure.request?.url ? ` (${failure.request.url})` : '')
  );
}

/**
 * Run `body`, then `release` what it took — an unlock, as a rule — and fail on
 * a refused release as well as on a failed body.
 *
 * `try { … } finally { await unlock(…) }` dropped the unlock's answer: a
 * refusal comes back as an answer, not a throw, so a handle left held passed
 * green and surfaced in the next run as a create answering 403. The release
 * still runs whatever the body did. When the body failed, its failure stays the
 * headline and a refused release is added to it, so neither hides the other.
 *
 * @param body the work done under what `release` gives back
 * @param release the call that gives it back
 * @param what a label for the release, so a failure names it — e.g. `'unlock'`
 */
export async function releasing<T>(
  body: () => Promise<T>,
  release: () => Promise<IAdtResponse<unknown>>,
  what: string,
): Promise<T> {
  const refusalOfRelease = async (): Promise<string> => {
    try {
      return failureOf(await release(), what);
    } catch (error) {
      return `${what} threw: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  let value: T;
  try {
    value = await body();
  } catch (error) {
    const refused = await refusalOfRelease();
    if (refused && error instanceof Error) {
      error.message = `${error.message}; then ${refused}`;
    }
    throw error;
  }
  const refused = await refusalOfRelease();
  if (refused) throw new Error(refused);
  return value;
}

/**
 * What a cleanup call refused, as one sentence — `''` when it removed what it
 * was for, or found it already absent. A throw is a refusal too.
 *
 * @param cleanup the cleanup call
 * @param what a label for the cleanup — e.g. `'delete append structure'`
 */
export async function cleanupRefusal(
  cleanup: () => Promise<IAdtResponse<unknown>>,
  what: string,
): Promise<string> {
  try {
    const answer = await cleanup();
    // Absent is what the cleanup wanted — the body may have failed before
    // creating anything.
    return !answer.ok && saysAbsent(answer.getError())
      ? ''
      : failureOf(answer, what);
  } catch (error) {
    return `${what} threw: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * The end of a test whose cleanup ran after its body: the body's failure is
 * rethrown with every cleanup refusal added to it, so neither hides the other;
 * a body that passed fails on the refusals alone.
 *
 * @param body `{ error }` when the body failed, `undefined` when it passed
 * @param refusals what {@link cleanupRefusal} answered for each cleanup
 */
export function raiseAfterCleanup(
  body: { error: unknown } | undefined,
  refusals: readonly string[],
): void {
  const refused = refusals.filter(Boolean);
  if (body) {
    if (refused.length > 0 && body.error instanceof Error) {
      body.error.message = `${body.error.message}; then ${refused.join('; ')}`;
    }
    throw body.error;
  }
  if (refused.length > 0) {
    throw new Error(`cleanup failed: ${refused.join('; ')}`);
  }
}

/**
 * A cleanup that runs after the test has already failed: its refusal — or its
 * throw — is added to that failure instead of being dropped, and never
 * replaces it. A refusal saying the object is absent is no refusal here.
 *
 * @param failure what the test failed with — rethrown by the caller
 * @param cleanup the cleanup call
 * @param what a label for the cleanup — e.g. `'delete append structure'`
 */
export async function noteCleanupRefusal(
  failure: unknown,
  cleanup: () => Promise<IAdtResponse<unknown>>,
  what: string,
): Promise<void> {
  const refused = await cleanupRefusal(cleanup, what);
  if (refused && failure instanceof Error) {
    failure.message = `${failure.message}; then ${refused}`;
  }
}
