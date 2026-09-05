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
 */
import type {
  IAdtError,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { failed, recogniseFailure, succeeded } from '../../utils/adtResponse';
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

  const unwind = async (list: Array<() => Promise<void>>): Promise<void> => {
    for (const undo of list.reverse()) {
      try {
        await undo();
      } catch (cleanupError: unknown) {
        logger?.warn?.('cleanup failed', {
          error: safeErrorMessage(cleanupError),
        });
      }
    }
  };

  try {
    const value = await body(scope);
    await unwind(undos);
    return succeeded<T, E>(value);
  } catch (error: unknown) {
    // Cleanups first, rollbacks after — the order a single reverse-ordered list
    // already produced, since a rollback is registered before the lock it must
    // outlive. A delete issued while the chain still holds the object's lock is
    // answered 403.
    await unwind(undos);
    await unwind(rollbacks);
    // The same cast `answering` makes, for the same reason: a chain abandons
    // with whatever failure its failing step answered, and a step that had no
    // strategy answered the library's own `IAdtError` — which is what every `E`
    // extends. Nothing a caller sees is cast.
    return failed<T, E>(
      (error instanceof ChainAbandoned
        ? error.failure
        : recogniseFailure(error)) as E,
    );
  }
}
