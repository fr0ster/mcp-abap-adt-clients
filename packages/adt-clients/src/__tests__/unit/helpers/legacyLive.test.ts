import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import {
  type LegacyDeletable,
  type LegacyObject,
  removeCreated,
  requireAbsent,
  withLock,
} from '../../helpers/legacyLive';

// The stubs below are no handler class `integrationHeadersOf` knows; the pair
// is not this test's subject, so any pair does.
jest.mock('../../helpers/adtHeaders', () => ({
  integrationHeadersOf: () => ({ accept: 'x/test', contentType: 'x/test' }),
}));

const ok = <T>(value: T): IAdtResponse<T> => ({
  ok: true,
  getResult: () => ({ value }),
});
const fail = (message: string, status?: number): IAdtResponse<never> => ({
  ok: false,
  getError: () => ({
    origin: 'connection',
    message,
    ...(status !== undefined && {
      response: { status } as never,
    }),
  }),
});

/** A handler whose answers are given, recording what was called. */
function handler(answers: {
  present?: boolean;
  unlock?: () => Promise<IAdtResponse<void>>;
  delete?: () => Promise<IAdtResponse<unknown>>;
}) {
  const calls: string[] = [];
  const h = {
    readMetadata: async () => {
      calls.push('read');
      return answers.present === false ? fail('gone', 404) : ok('<doc/>');
    },
    lock: async () => {
      calls.push('lock');
      return ok('HANDLE');
    },
    unlock: async () => {
      calls.push('unlock');
      return answers.unlock ? answers.unlock() : ok(undefined);
    },
    delete: async () => {
      calls.push('delete');
      return answers.delete ? answers.delete() : ok('');
    },
  };
  return { calls, handler: h as unknown as LegacyDeletable<object> };
}

function object(name: string, h: LegacyDeletable<object>): LegacyObject {
  return { label: 'class', name, handler: () => h, config: {} };
}

describe('legacy live helpers', () => {
  it('withLock reports a failed unlock after a body that succeeded', async () => {
    const { handler: h } = handler({
      unlock: async () => fail('still locked'),
    });
    await expect(
      withLock(h, {}, 'class ZX', async () => ok('done')),
    ).rejects.toThrow('unlock class ZX failed [connection]: still locked');
  });

  it('withLock names what the body answered when the unlock failed too', async () => {
    const { handler: h } = handler({
      unlock: async () => fail('still locked'),
    });
    await expect(
      withLock(h, {}, 'class ZX', async () => fail('delete refused')),
    ).rejects.toThrow(
      /still locked.*the call under the lock answered \[connection\]: delete refused/,
    );
  });

  it('withLock keeps the body error and attaches a failed unlock to it', async () => {
    const { handler: h } = handler({
      unlock: async () => {
        throw new Error('wire down');
      },
    });
    const bodyError = new Error('write failed');
    const thrown = await withLock(h, {}, 'class ZX', async () => {
      throw bodyError;
    }).catch((e: unknown) => e);
    expect(thrown).toBe(bodyError);
    expect(bodyError.message).toContain('write failed');
    expect(bodyError.message).toContain('unlock class ZX threw: wire down');
  });

  it('requireAbsent fails on an existing object and deletes nothing', async () => {
    const { calls, handler: h } = handler({ present: true });
    await expect(
      requireAbsent('legacy_deletes', [object('ZX', h)]),
    ).rejects.toThrow(
      'legacy_740/legacy_deletes: class ZX already exists; name one that does not',
    );
    expect(calls).toEqual(['read']);
  });

  it('removeCreated attempts every object and names every one left behind', async () => {
    const first = handler({ delete: async () => fail('refused', 400) });
    const second = handler({ present: false });
    const third = handler({});
    const fourth = handler({ unlock: async () => fail('still locked') });

    const thrown = await removeCreated('legacy_deletes', [
      object('ZA', first.handler),
      object('ZB', second.handler),
      object('ZC', third.handler),
      object('ZD', fourth.handler),
    ]).catch((e: unknown) => e as Error);

    expect(first.calls).toEqual(['read', 'lock', 'delete', 'unlock']);
    expect(second.calls).toEqual(['read']);
    expect(third.calls).toEqual(['read', 'lock', 'delete', 'unlock']);
    expect(fourth.calls).toEqual(['read', 'lock', 'delete', 'unlock']);
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain('cleanup left 2 object(s) behind');
    expect(message).toContain('class ZA: delete class ZA failed');
    expect(message).toContain('class ZD: unlock class ZD failed');
    expect(message).not.toContain('class ZB');
    expect(message).not.toContain('class ZC');
  });
});
