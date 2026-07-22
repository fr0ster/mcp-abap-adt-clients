import { LockCapability } from '../../../../core/shared/capabilities/LockCapability';
import type {
  ICapabilityContext,
  ILockStrategy,
} from '../../../../core/shared/capabilities/types';

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
  it('lock sets stateful, acquires, returns the handle', async () => {
    const ctx = fakeCtx();
    const cap = new LockCapability<Cfg, State>(() => ctx, strategy);
    const handle = await cap.lock({ name: 'ZFOO' });
    expect(handle).toBe('H1');
    expect(ctx.calls).toEqual(['session:stateful', 'acquire:ZFOO']);
  });

  it('unlock is stateful during release, restores stateless, returns state', async () => {
    const ctx = fakeCtx();
    const cap = new LockCapability<Cfg, State>(() => ctx, strategy);
    const state = await cap.unlock({ name: 'ZFOO' }, 'H1');
    // stateful BEFORE the UNLOCK (older BASIS), stateless AFTER.
    expect(ctx.calls).toEqual([
      'session:stateful',
      'release:ZFOO:H1',
      'session:stateless',
    ]);
    // the ADT unlock response is preserved in state.
    expect(state.unlockResult).toBe('R:ZFOO');
  });

  it('lock rethrows a missing name from the strategy', async () => {
    const ctx = fakeCtx();
    const cap = new LockCapability<Cfg, State>(() => ctx, strategy);
    await expect(cap.lock({})).rejects.toThrow('name is required');
  });
});
