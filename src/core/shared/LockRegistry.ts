/**
 * Session-scoped registry of held object locks.
 *
 * One registry per stateful session (owned by AdtClient). Handlers record a lock
 * when they acquire it and remove it on a clean unlock. `unlockAll()` is the
 * last-resort cleanup: it releases any lock still held (e.g. the consumer forgot
 * to unlock, or a managed flow threw before its unlock), so a session is never
 * abandoned with dangling enqueue locks.
 *
 * This is a safety net, NOT the primary defense. Preventing a timeout from
 * interrupting the lock→unlock critical section is the caller's responsibility.
 */

/**
 * Releases a single held lock. Provided by the handler that acquired it.
 *
 * The thunk MUST NOT toggle the connection session type — `unlockAll()` keeps
 * the session stateful for the whole batch and restores stateless once at the
 * end (see {@link LockRegistry.unlockAll}).
 */
export type UnlockThunk = () => Promise<unknown>;

/** A lock that `unlockAll()` failed to release, kept for reporting / retry. */
export interface LockFailure {
  key: string;
  error: unknown;
}

/** Minimal session control the registry needs to run an unlock batch. */
export interface ISessionController {
  setSessionType(type: 'stateful' | 'stateless'): void;
}

export class LockRegistry {
  private readonly locks = new Map<string, UnlockThunk>();

  /**
   * @param session Controls the shared connection's session type. `unlockAll()`
   *   uses it to keep the session stateful for the whole batch — some
   *   connections (RFC) clear the stateful cookie when switched to stateless,
   *   which would invalidate the remaining lock handles mid-batch.
   */
  constructor(private readonly session?: ISessionController) {}

  /** Record a held lock under a stable object key (e.g. `DOMA/ZFOO`). */
  track(key: string, unlock: UnlockThunk): void {
    this.locks.set(key, unlock);
  }

  /** Drop a lock after it has been released cleanly. */
  untrack(key: string): void {
    this.locks.delete(key);
  }

  /** Keys of locks still held. */
  get pending(): string[] {
    return [...this.locks.keys()];
  }

  /**
   * Release every lock still held. Successfully released locks are dropped;
   * locks whose unlock throws are kept and returned as failures.
   *
   * The whole batch runs under a single stateful→stateless transition so that a
   * per-unlock switch to stateless can't clear the session mid-batch and break
   * the remaining lock handles.
   */
  async unlockAll(): Promise<LockFailure[]> {
    const failures: LockFailure[] = [];
    if (this.locks.size === 0) return failures;

    this.session?.setSessionType('stateful');
    try {
      for (const [key, unlock] of [...this.locks]) {
        try {
          await unlock();
          this.locks.delete(key);
        } catch (error) {
          failures.push({ key, error });
        }
      }
    } finally {
      this.session?.setSessionType('stateless');
    }
    return failures;
  }
}

/**
 * Per-handler view over a {@link LockRegistry}: records/removes locks under a
 * stable, type-prefixed key. A no-op when no registry is present, so handlers
 * work unchanged whether or not a registry was injected.
 */
export interface LockTracker {
  /** Record a held lock for `objectName`. */
  track(objectName: string, lockHandle: string): void;
  /** Drop the lock for `objectName` after a clean unlock. */
  untrack(objectName: string): void;
}

/**
 * Build a {@link LockTracker} for one object type.
 *
 * @param registry   Session registry to record into (undefined → no-op tracker).
 * @param objectType Stable type prefix for the key (e.g. `Domain`).
 * @param unlock     Raw release of a held lock, invoked by `unlockAll()` for
 *                   abandoned locks. MUST NOT toggle the session type —
 *                   `unlockAll()` manages the session for the whole batch.
 */
export function createLockTracker(
  registry: LockRegistry | undefined,
  objectType: string,
  unlock: (objectName: string, lockHandle: string) => Promise<unknown>,
): LockTracker {
  const keyOf = (objectName: string): string =>
    `${objectType}/${objectName.toUpperCase()}`;
  return {
    track(objectName, lockHandle) {
      registry?.track(keyOf(objectName), () => unlock(objectName, lockHandle));
    },
    untrack(objectName) {
      registry?.untrack(keyOf(objectName));
    },
  };
}
