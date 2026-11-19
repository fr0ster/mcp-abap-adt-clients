/**
 * The registry follows the wire: a release that SAP answered with a status
 * outside 2xx — resolved by a connection, not thrown — keeps its lock, so the
 * next `unlockAll()` tries it again. Every handler's tracker shares this
 * registry, so it holds for all of them.
 */
import { LockRegistry } from '../../../core/shared/LockRegistry';

const answered = (status: number) => ({
  status,
  statusText: '',
  headers: {},
  data: '',
});

describe('LockRegistry: a release resolved with a failed status', () => {
  it.each([403, 500])(
    'keeps a lock whose UNLOCK resolved %i, reports it, and releases it on the next unlockAll()',
    async (status) => {
      const registry = new LockRegistry();
      const answers = [answered(status), answered(200)];
      registry.track('TableSettings/ZT', async () => answers.shift());
      const first = await registry.unlockAll();
      expect(first.map((failure) => failure.key)).toEqual(['TableSettings/ZT']);
      expect(registry.pending).toEqual(['TableSettings/ZT']);
      expect(await registry.unlockAll()).toEqual([]);
      expect(registry.pending).toEqual([]);
    },
  );

  it('drops a lock whose UNLOCK resolved 2xx, or resolved with no status at all', async () => {
    const registry = new LockRegistry();
    registry.track('A', async () => answered(204));
    registry.track('B', async () => undefined);
    expect(await registry.unlockAll()).toEqual([]);
    expect(registry.pending).toEqual([]);
  });
});
