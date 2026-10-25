/**
 * A run a debugger test started has to come back, and its answer is judged:
 * a run that does not settle in the wait, one that rejects and one with an
 * answer the expected end does not accept all fail.
 */
import { settleRun } from '../../helpers/runSettlement';

const ok = (value: unknown = 'output') =>
  ({ ok: true, getResult: () => ({ value }) }) as never;
const refused = (message: string, status?: number) =>
  ({
    ok: false,
    getError: () => ({
      origin: status ? 'refusal' : 'connection',
      message,
      ...(status ? { response: { status } } : {}),
    }),
  }) as never;

describe('settleRun', () => {
  it('answers a run that completed', async () => {
    const answer = ok();
    await expect(
      settleRun(Promise.resolve(answer), 100, 'the run', 'completed'),
    ).resolves.toBe(answer);
  });

  it('fails a run that does not settle within the wait', async () => {
    await expect(
      settleRun(
        new Promise(() => {}),
        20,
        'the run',
        'completed-or-terminated',
      ),
    ).rejects.toThrow('the run did not settle within 20 ms');
  });

  it('fails a run that rejects', async () => {
    await expect(
      settleRun(
        Promise.reject(new Error('ECONNRESET')),
        100,
        'the run',
        'completed-or-terminated',
      ),
    ).rejects.toThrow('ECONNRESET');
  });

  it('accepts the 500 of a termination only where a termination is expected', async () => {
    await expect(
      settleRun(
        Promise.resolve(refused('runtime error', 500)),
        100,
        'the run',
        'completed-or-terminated',
      ),
    ).resolves.toBeDefined();
    await expect(
      settleRun(
        Promise.resolve(refused('runtime error', 500)),
        100,
        'the run',
        'completed',
      ),
    ).rejects.toThrow(/runtime error/);
  });

  it('fails any other refusal, and a connection failure', async () => {
    await expect(
      settleRun(
        Promise.resolve(refused('not authorized', 403)),
        100,
        'the run',
        'completed-or-terminated',
      ),
    ).rejects.toThrow(/not authorized/);
    await expect(
      settleRun(
        Promise.resolve(refused('socket closed')),
        100,
        'the run',
        'completed-or-terminated',
      ),
    ).rejects.toThrow(/socket closed/);
  });
});
