import { LockCapability } from '../../../../core/shared/capabilities/LockCapability';
import type {
  ICapabilityContext,
  ILockStrategy,
} from '../../../../core/shared/capabilities/types';
import { expectResult } from '../../../helpers/contract';

type Cfg = { name?: string };

function fakeCtx(): ICapabilityContext & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    connection: {
      setSessionType: (t: string) => calls.push(`session:${t}`),
    } as any,
    logger: undefined,
  };
}

type State = { unlockResult?: string; errors: string[] };

const strategy: ILockStrategy<Cfg, State> = {
  nameOf: (c) => {
    if (!c.name) throw new Error('name is required');
    return c.name;
  },
  acquire: async (ctx, name) => {
    (ctx as any).calls.push(`acquire:${name}`);
    return { lockHandle: 'H1', corrNr: 'C1' };
  },
  release: async (ctx, name, h) => {
    (ctx as any).calls.push(`release:${name}:${h}`);
    return { unlockResult: `R:${name}`, errors: [] };
  },
};

describe('LockCapability', () => {
  it('lock is stateful for the acquire and stateless after it', async () => {
    const ctx = fakeCtx();
    const cap = new LockCapability<Cfg, State>(() => ctx, strategy);
    const handle = expectResult(await cap.lock({ name: 'ZFOO' }), 'lock');
    expect(handle).toBe('H1');
    // This used to end at `acquire`, leaving the session stateful for the whole
    // window, so every write between lock and unlock ran inside it. Eclipse
    // keeps its stateful session for LOCK and UNLOCK alone — measured on E19,
    // its source PUT goes out stateless with only `lockHandle` and `corrNr` —
    // and a request that runs inside the session leaves what it takes there:
    // an activation sent that way strands `E_ABAP_GENPH` for the connection's
    // lifetime.
    expect(ctx.calls).toEqual([
      'session:stateful',
      'acquire:ZFOO',
      'session:stateless',
    ]);
  });

  it('unlock is stateful during release and restores stateless', async () => {
    const ctx = fakeCtx();
    const cap = new LockCapability<Cfg, State>(() => ctx, strategy);
    // Nothing to read from an unlock, and the contract says so — what it
    // answers is that it happened. The order of the session toggles is the
    // whole claim, and it is what #106 measured.
    expectResult(await cap.unlock({ name: 'ZFOO' }, 'H1'), 'unlock');

    // stateful BEFORE the UNLOCK (older BASIS), stateless AFTER.
    expect(ctx.calls).toEqual([
      'session:stateful',
      'release:ZFOO:H1',
      'session:stateless',
    ]);
  });

  it('lock rethrows a missing name from the strategy', async () => {
    const ctx = fakeCtx();
    const cap = new LockCapability<Cfg, State>(() => ctx, strategy);
    await expect(cap.lock({})).rejects.toThrow('name is required');
  });
});
