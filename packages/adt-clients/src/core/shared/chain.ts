/**
 * Run a chain of requests as a resource scope.
 *
 * Cleanup used to run from a `catch`, and that worked only because a refusal
 * threw. A refusal is a returned value now, so an unguarded early return would
 * leave the object locked on the server and the session stateful, with nothing
 * raised to say so.
 *
 * **Cleanup runs on every path** — success, returned failure, and exception — in
 * reverse order of registration. That is the difference between a cleanup and an
 * error handler, and getting it wrong leaks a lock on the happy path, which is
 * the one that runs most.
 *
 * A registration can be **discharged** when the resource is released normally:
 * `onScopeEnd` returns a handle, and calling it removes that entry, so a chain
 * that unlocks as its own step does not unlock twice.
 *
 * **`onFailure` is the other kind**, and it is not a convenience: a rollback is
 * not a cleanup. Every `deleteOnFailure` create registered its rollback with
 * `onScopeEnd`, guarded by a `created` flag that was true by the time the scope
 * ended — so a create that succeeded deleted the object it had just made. The
 * two kinds are named apart here rather than left to each handler to remember.
 *
 * An error raised *by* cleanup is logged, never propagated: a failing unlock must
 * not replace the reason the chain failed, which is what the caller needs.
 *
 * **A credential refusal SAP was never asked about is not a failure to return.**
 * When a step rejects with the connection's refusal (see `answering`), the
 * cleanups and rollbacks still run, in the same order, and then the chain
 * rejects with that same object — not converted, not wrapped, not written to —
 * so a caller walking many objects stops. A rollback that did not complete
 * cannot be said in the answer then, since the refusal is not this library's to
 * change: it is logged (`warn`), as every cleanup failure already is. The same
 * holds when a cleanup or rollback is what met the refusal on a chain that
 * otherwise succeeded or failed: after unwinding, the chain rejects with the
 * first such refusal, and the failure it would have returned is logged instead.
 */
import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  failed,
  isUnansweredCredentialRefusal,
  recogniseFailure,
  succeeded,
} from '../../utils/adtResponse';
import { safeErrorMessage } from '../../utils/internalUtils';

/**
 * Raised by `step()` to abandon a chain, carrying the failure that caused it.
 *
 * Private to this module and never exported: it is a control-flow device, not a
 * failure a caller should ever see. `chain` catches it and returns the failure it
 * carries; anything else that escapes is a real exception and is classified.
 */
class ChainAbandoned extends Error {
  constructor(readonly failure: IAdtError) {
    super(failure.message);
    this.name = 'ChainAbandoned';
  }
}

/** What a chain body is given: a way to take a step, and a way to register cleanup. */
export interface IChainScope {
  /** Await an answer; its value on success, or abandon the chain with its failure. */
  step<S>(answer: Promise<IAdtResponse<S>>): Promise<S>;
  /** Register cleanup that runs on every path. The returned function discharges it. */
  onScopeEnd(undo: () => Promise<void>): () => void;
  /**
   * Register a rollback that runs only when the chain fails.
   *
   * Not on success: undoing work the caller asked for, because it succeeded, is
   * the defect this exists to make unrepresentable.
   */
  onFailure(undo: () => Promise<void>): () => void;
}

export async function chain<T, E extends IAdtError = IAdtError>(
  logger: ILogger | undefined,
  body: (scope: IChainScope) => Promise<T>,
): Promise<IAdtResponse<T, E>> {
  const undos: Array<() => Promise<void>> = [];
  const rollbacks: Array<() => Promise<void>> = [];
  const register = (
    list: Array<() => Promise<void>>,
    undo: () => Promise<void>,
  ): (() => void) => {
    list.push(undo);
    return () => {
      const at = list.indexOf(undo);
      if (at >= 0) list.splice(at, 1);
    };
  };

  const scope: IChainScope = {
    async step<S>(answer: Promise<IAdtResponse<S>>): Promise<S> {
      const a = await answer;
      if (!a.ok) throw new ChainAbandoned(a.getError());
      return a.getResult().value;
    },
    onScopeEnd: (undo) => register(undos, undo),
    onFailure: (undo) => register(rollbacks, undo),
  };

  // The first credential refusal SAP never saw that a cleanup or rollback met.
  // Unwinding still runs every entry; the refusal is rethrown once it is done.
  let cleanupRefusal: { error: unknown } | undefined;
  const unwind = async (
    list: Array<() => Promise<void>>,
    collect?: (reason: string) => void,
  ): Promise<void> => {
    for (const undo of list.reverse()) {
      try {
        await undo();
      } catch (cleanupError: unknown) {
        if (!cleanupRefusal && isUnansweredCredentialRefusal(cleanupError)) {
          cleanupRefusal = { error: cleanupError };
        }
        const reason = safeErrorMessage(cleanupError);
        logger?.warn?.('cleanup failed', { error: reason });
        collect?.(reason);
      }
    }
  };

  let value: T;
  try {
    value = await body(scope);
  } catch (error: unknown) {
    return abandon(error);
  }
  await unwind(undos);
  if (cleanupRefusal) throw cleanupRefusal.error;
  return succeeded<T, E>(value);

  async function abandon(error: unknown): Promise<IAdtResponse<T, E>> {
    // Cleanups first, rollbacks after — the order a single reverse-ordered list
    // already produced, since a rollback is registered before the lock it must
    // outlive. A delete issued while the chain still holds the object's lock is
    // answered 403.
    await unwind(undos);
    const unrolled: string[] = [];
    await unwind(rollbacks, (reason) => unrolled.push(reason));

    // The refusal is the caller's to see, as it came, once everything that
    // must run has run. What the rollback could not undo is in the log above.
    if (isUnansweredCredentialRefusal(error)) {
      if (unrolled.length > 0) {
        logger?.warn?.(
          'rollback did not complete before the credential refusal',
          {
            error: unrolled.join('; '),
          },
        );
      }
      throw error;
    }

    // The same cast `answering` makes, for the same reason: a chain abandons
    // with whatever failure its failing step answered, and a step that had no
    // strategy answered the library's own `IAdtError` — which is what every `E`
    // extends. Nothing a caller sees is cast.
    const failure =
      error instanceof ChainAbandoned ? error.failure : recogniseFailure(error);

    if (cleanupRefusal) {
      // A cleanup or rollback met the refusal: that is the caller's signal to
      // stop, and the failure this chain would have answered goes to the log.
      logger?.warn?.('chain failed before a cleanup met a credential refusal', {
        error: failure.message,
        ...(unrolled.length > 0 ? { rollback: unrolled.join('; ') } : {}),
      });
      throw cleanupRefusal.error;
    }

    if (unrolled.length === 0) return failed<T, E>(failure as E);

    // **A rollback that failed has to reach the caller.** It used to end in a
    // `logger.warn` and nowhere else, so the answer carried the original
    // failure alone and a caller had every reason to believe the system was
    // left clean. It was not: what the rollback could not remove is still
    // there, holding its name. Said in the message rather than in a new field —
    // a failure type grows a field per special case, and this is one.
    return failed<T, E>({
      ...failure,
      message: `${failure.message} — and the rollback did not complete, so something this call made may still exist: ${unrolled.join('; ')}`,
    } as E);
  }
}
