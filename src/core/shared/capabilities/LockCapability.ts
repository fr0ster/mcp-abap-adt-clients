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
 * DELIBERATELY byte-identical to the current handlers, including the failure
 * path: if `acquire`/`release` throws, the session is left as-is (stateful) and
 * the error propagates — exactly as today. Failure/abandonment handling is
 * DISTRIBUTED and this capability owns none of it:
 *   - the consumer largely owns lock/unlock atomicity (it decides when to lock
 *     and unlock);
 *   - adt-clients' `LockRegistry.unlockAll()` is a disposal safety net that
 *     raw-releases abandoned locks — deliberately WITHOUT toggling the session,
 *     because `unlockAll()` manages the session once for the whole batch;
 *   - the operation chain's create/update catch blocks also call
 *     setSessionType('stateless').
 * Adding a try/finally here would change behaviour and relocate responsibility
 * across those layers, so the atom-level "restore stateless on failure"
 * contract is deferred to the behavioural-conformance work (same bucket as
 * activate/check error unification), where all three layers are reconciled
 * rather than double-cleaned.
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
    return answering(
      async () => {
        const ctx = this.getCtx();
        const name = this.strategy.nameOf(config);
        // Stay stateful while the lock is held; the caller releases via unlock().
        ctx.connection.setSessionType('stateful');
        const { lockHandle } = await this.strategy.acquire(ctx, name);
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
    ctx.connection.setSessionType('stateful');
    const { lockHandle } = await this.strategy.acquire(ctx, name);
    return lockHandle;
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
    await this.strategy.release(ctx, name, lockHandle);
    ctx.connection.setSessionType('stateless');
  }
}
