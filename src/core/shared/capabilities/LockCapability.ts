import type { IAdtLockable, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { answering } from '../../../utils/adtResponse';
import { nothing } from '../../../utils/resultStrategy';
import type { ICapabilityContext, ILockStrategy } from './types';

/**
 * Shared lock/unlock for handlers whose lock differs only by endpoint and
 * name field. `lock` leaves the session stateful (the caller must unlock).
 * `unlock` runs the release inside a stateful request — older BASIS (#106)
 * only accepts UNLOCK while stateful — then restores stateless. The handler's
 * state shape (including the ADT `unlockResult`) is built by `strategy.release`
 * and returned unchanged. See the spec's IAdtLockable obligations — idempotent
 * unlock is a TARGET, not implemented here, and is left to the per-endpoint
 * probe + adaptation rule of the full-migration plan.
 *
 * **The restore runs in a `finally`, and it has to.** This used to be written
 * success-only — set stateful, call, set stateless — on the argument that
 * failure handling was distributed: the consumer owns lock/unlock atomicity,
 * `LockRegistry.unlockAll()` is a disposal safety net, and the operation
 * chain's create/update catch blocks also called `setSessionType('stateless')`.
 *
 * That third layer no longer exists. This release unwound the chains — every
 * member is one request now — so nothing downstream restores the session, and
 * a refused `LOCK` left the connection stateful for whoever held it next. The
 * connection is shared: one caller's failed acquire silently changed the
 * session type for every other user of it, and the next unrelated request went
 * out inside a session it never asked for.
 *
 * The other two layers do not cover this either. The consumer cannot restore
 * what it did not set — this capability sets the session type, so this
 * capability puts it back — and `unlockAll()` manages the session once for a
 * whole batch, deliberately not per lock.
 *
 * `finally` and not `catch`: the error still propagates untouched, which is the
 * part of the old behaviour worth keeping.
 */
export class LockCapability<TConfig, TReadResult = void>
  implements IAdtLockable<TConfig>
{
  constructor(
    // LAZY: read at method-call time, so the handler can build this capability
    // as a class field before its constructor assigns this.connection.
    private readonly getCtx: () => ICapabilityContext,
    private readonly strategy: ILockStrategy<TConfig, TReadResult>,
  ) {}

  async lock(config: Partial<TConfig>): Promise<IAdtResponse<string>> {
    // Outside `answering`, and deliberately: a config with no name is a caller
    // error, not a verdict about the server. Classified inside, it would come
    // back as `origin: 'connection'` and send them to look at a system that was
    // never asked anything.
    const name = this.strategy.nameOf(config);

    return answering(
      async () => {
        const ctx = this.getCtx();
        // Stateful for THIS request and no longer.
        //
        // It used to stay stateful for the whole lock window, so every write
        // between lock and unlock ran inside the session. Eclipse does not:
        // measured its stateful session carries `LOCK` and `UNLOCK` and
        // nothing else — the source `PUT` goes out stateless on a session of
        // its own, carrying only `lockHandle` and `corrNr`.
        //
        // The difference is not cosmetic. Anything the server takes during a
        // request that runs inside the session is held by that session: an
        // activation sent this way leaves its `E_ABAP_GENPH` on the generated
        // program for as long as the connection lives, and a test run's
        // connection lives for the whole run.
        //
        // #106 is preserved: what it requires is that LOCK and UNLOCK
        // themselves run stateful, which they still do — see `release()`, whose
        // note says exactly that.
        ctx.connection.setSessionType('stateful');
        let lockHandle: string;
        try {
          ({ lockHandle } = await this.strategy.acquire(ctx, name));
        } finally {
          // A refused acquire must not leave the shared connection stateful.
          ctx.connection.setSessionType('stateless');
        }
        // The handle is what the caller needs, and the strategy hands it over
        // without the wire it came on — so the answer is built around it.
        return { data: lockHandle, status: 200, statusText: 'OK', headers: {} };
      },
      (answer) => String(answer.data),
    );
  }

  /** The handle alone, for callers inside this package that hold a chain open. */
  async lockHandle(config: Partial<TConfig>): Promise<string> {
    const ctx = this.getCtx();
    const name = this.strategy.nameOf(config);
    // Same window as `lock()`: stateful for the acquire, stateless after it.
    ctx.connection.setSessionType('stateful');
    try {
      const { lockHandle } = await this.strategy.acquire(ctx, name);
      return lockHandle;
    } finally {
      ctx.connection.setSessionType('stateless');
    }
  }

  async unlock(
    config: Partial<TConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    return answering(async () => {
      await this.release(config, lockHandle);
      return { data: '', status: 200, statusText: 'OK', headers: {} };
    }, nothing);
  }

  /** The release itself, for a chain that owns its own cleanup. */
  async release(config: Partial<TConfig>, lockHandle: string): Promise<void> {
    const ctx = this.getCtx();
    const name = this.strategy.nameOf(config);
    // UNLOCK must run stateful (older BASIS #106); restore stateless after.
    ctx.connection.setSessionType('stateful');
    try {
      await this.strategy.release(ctx, name, lockHandle);
    } finally {
      ctx.connection.setSessionType('stateless');
    }
  }
}
