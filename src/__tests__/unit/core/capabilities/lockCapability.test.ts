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
  it('lock sets stateful, acquires, answers the handle', async () => {
    const ctx = fakeCtx();
    const cap = new LockCapability<Cfg, State>(() => ctx, strategy);
    const handle = expectResult(await cap.lock({ name: 'ZFOO' }), 'lock');
    expect(handle).toBe('H1');
    expect(ctx.calls).toEqual(['session:stateful', 'acquire:ZFOO']);
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
