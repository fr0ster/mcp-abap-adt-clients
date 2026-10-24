/**
 * The helpers that read a release's or a cleanup's answer: a refusal fails the
 * test, and a refusal after a failed body is added to that failure instead of
 * being dropped or replacing it.
 */
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import {
  cleanupRefusal,
  noteCleanupRefusal,
  raiseAfterCleanup,
  releasing,
  saysAbsent,
} from '../../helpers/contract';
import { expectRemovedOrAbsent } from '../../helpers/objectPresence';

const ok = (value: unknown = ''): IAdtResponse<unknown> =>
  ({ ok: true, getResult: () => ({ value }) }) as IAdtResponse<unknown>;
const refused = (message: string, status?: number): IAdtResponse<unknown> =>
  ({
    ok: false,
    getError: () => ({
      origin: 'refusal',
      message,
      ...(status ? { response: { status } } : {}),
    }),
  }) as unknown as IAdtResponse<unknown>;

describe('releasing', () => {
  it('answers the body when both answered ok', async () => {
    const release = jest.fn(async () => ok());
    await expect(releasing(async () => 42, release, 'unlock')).resolves.toBe(
      42,
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('fails on a refused release after a body that worked', async () => {
    await expect(
      releasing(
        async () => 42,
        async () => refused('handle unknown'),
        'unlock',
      ),
    ).rejects.toThrow('unlock failed [refusal]: handle unknown');
  });

  it('fails on a release that throws', async () => {
    await expect(
      releasing(
        async () => 42,
        async () => {
          throw new Error('socket closed');
        },
        'unlock',
      ),
    ).rejects.toThrow('unlock threw: socket closed');
  });

  it('keeps the body failure first and adds the refused release to it', async () => {
    const release = jest.fn(async () => refused('handle unknown'));
    await expect(
      releasing(
        async () => {
          throw new Error('update failed');
        },
        release,
        'unlock',
      ),
    ).rejects.toThrow(
      'update failed; then unlock failed [refusal]: handle unknown',
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases after a failed body that released fine, and rethrows it as it was', async () => {
    const release = jest.fn(async () => ok());
    await expect(
      releasing(
        async () => {
          throw new Error('update failed');
        },
        release,
        'unlock',
      ),
    ).rejects.toThrow(/^update failed$/);
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe('cleanupRefusal, noteCleanupRefusal and raiseAfterCleanup', () => {
  it('answers nothing for a removal, and for an object already absent', async () => {
    await expect(cleanupRefusal(async () => ok(), 'delete')).resolves.toBe('');
    await expect(
      cleanupRefusal(async () => refused('gone', 404), 'delete'),
    ).resolves.toBe('');
    await expect(
      cleanupRefusal(async () => refused('ZX does not exist'), 'delete'),
    ).resolves.toBe('');
  });

  it('answers what any other refusal or throw said', async () => {
    await expect(
      cleanupRefusal(async () => refused('locked by ZOTHER', 403), 'delete X'),
    ).resolves.toBe('delete X failed [refusal]: locked by ZOTHER');
    await expect(
      cleanupRefusal(async () => {
        throw new Error('socket closed');
      }, 'delete X'),
    ).resolves.toBe('delete X threw: socket closed');
  });

  it('adds a refused cleanup to the failure in flight', async () => {
    const failure = new Error('assertion failed');
    await noteCleanupRefusal(
      failure,
      async () => refused('locked'),
      'delete X',
    );
    expect(failure.message).toBe(
      'assertion failed; then delete X failed [refusal]: locked',
    );
  });

  it('fails a passing body on its refused cleanups, and leaves a clean one alone', () => {
    expect(() => raiseAfterCleanup(undefined, ['', 'delete X failed'])).toThrow(
      'cleanup failed: delete X failed',
    );
    expect(() => raiseAfterCleanup(undefined, ['', ''])).not.toThrow();
  });

  it('rethrows a failed body with its refused cleanups added', () => {
    const error = new Error('assertion failed');
    expect(() => raiseAfterCleanup({ error }, ['delete X failed'])).toThrow(
      'assertion failed; then delete X failed',
    );
  });
});

describe('expectRemovedOrAbsent', () => {
  it('reads a removal and an absence apart', () => {
    expect(expectRemovedOrAbsent(ok(), 'delete X')).toBe('removed');
    expect(expectRemovedOrAbsent(refused('gone', 404), 'delete X')).toBe(
      'absent',
    );
  });

  it('fails on any other refusal, naming it', () => {
    expect(() =>
      expectRemovedOrAbsent(refused('locked by ZOTHER', 403), 'delete X'),
    ).toThrow('delete X failed [refusal]: locked by ZOTHER');
  });

  it('calls absence what a 404 or "does not exist" says, and nothing else', () => {
    const errorOf = (answer: IAdtResponse<unknown>) =>
      (answer as unknown as { getError(): never }).getError();
    expect(saysAbsent(errorOf(refused('x', 404)))).toBe(true);
    expect(saysAbsent(errorOf(refused('ZX does not exist')))).toBe(true);
    expect(saysAbsent(errorOf(refused('x', 500)))).toBe(false);
  });
});
