/**
 * The chain runs cleanup on every path.
 *
 * This is the sharpest edge in the migration: the old chains cleaned up from a
 * `catch`, which worked only because a refused request threw. A refusal is a
 * returned value now, so an unguarded early return would leave the object locked
 * on the server and the session stateful, and nothing would say so.
 */
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { ADT_SESSION_ERROR } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { chain } from '../../../core/shared/chain';
import { failed, succeeded } from '../../../utils/adtResponse';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

const refusal = <T>(): IAdtResponse<T> =>
  failed<T>({ origin: 'refusal', message: 'SAP said no' });

describe('chain', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs cleanup on the happy path, in reverse order', async () => {
    const order: string[] = [];

    const answer = await chain(logger, async ({ onScopeEnd }) => {
      onScopeEnd(async () => {
        order.push('stateless');
      });
      onScopeEnd(async () => {
        order.push('unlock');
      });
      return 'done';
    });

    expect(answer.ok).toBe(true);
    // Unlock first, then stateless: on older BASIS a lock handle is only valid
    // inside a stateful request, so going stateless first breaks the unlock.
    expect(order).toEqual(['unlock', 'stateless']);
  });

  it('runs cleanup when a step returns a failure, and answers that failure', async () => {
    const cleaned: string[] = [];

    const answer = await chain(logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        cleaned.push('unlock');
      });
      await step(Promise.resolve(refusal<string>()));
      throw new Error('unreachable — the step abandons the chain');
    });

    expect(cleaned).toEqual(['unlock']);
    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    // The reason the chain stopped is what the caller gets, not a cleanup error.
    expect(answer.getError().message).toBe('SAP said no');
  });

  it('runs cleanup when the body throws, and classifies the exception', async () => {
    const cleaned: string[] = [];

    const answer = await chain(logger, async ({ onScopeEnd }) => {
      onScopeEnd(async () => {
        cleaned.push('unlock');
      });
      throw new Error('connect ECONNREFUSED');
    });

    expect(cleaned).toEqual(['unlock']);
    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().origin).toBe('connection');
  });

  it('does not unlock twice when the chain unlocked as its own step', async () => {
    let unlocks = 0;

    await chain(logger, async ({ onScopeEnd }) => {
      const release = onScopeEnd(async () => {
        unlocks += 1;
      });
      unlocks += 1; // the chain's own unlock step
      release();
      return 'done';
    });

    expect(unlocks).toBe(1);
  });

  it('never lets a failing cleanup replace the reason the chain failed', async () => {
    const answer = await chain(logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        throw new Error('the unlock itself failed');
      });
      await step(Promise.resolve(refusal<string>()));
      return 'unreachable';
    });

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().message).toBe('SAP said no');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('answers the body value when every step succeeded', async () => {
    const answer = await chain(logger, async ({ step }) => {
      const first = await step(Promise.resolve(succeeded('one')));
      const second = await step(Promise.resolve(succeeded('two')));
      return `${first}+${second}`;
    });

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    expect(answer.getResult().value).toBe('one+two');
  });
});

describe('chain: the session mark', () => {
  /**
   * After a marked answer connection 23.0.0 rejects every later request of
   * the instance `ADT_NOT_CONNECTED`, so a chain that succeeds after a marked
   * step has it as the last request it judged; a chain that fails answers the
   * facts of the failing request.
   */
  const REPLACED = ADT_SESSION_ERROR.SESSION_REPLACED;

  beforeEach(() => jest.clearAllMocks());

  it("a marked last step: the chain's success carries the mark", async () => {
    const answer = await chain(logger, async ({ step }) => {
      await step(Promise.resolve(succeeded('locked')));
      return step(Promise.resolve(succeeded('written', REPLACED)));
    });

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a success');
    expect(answer.getResult()).toEqual({
      value: 'written',
      sessionLost: REPLACED,
    });
  });

  it("no marked step: no key on the chain's result", async () => {
    const answer = await chain(logger, async ({ step }) =>
      step(Promise.resolve(succeeded('written'))),
    );

    if (!answer.ok) throw new Error('expected a success');
    expect('sessionLost' in answer.getResult()).toBe(false);
  });

  it("a marked step, then a step refused ADT_NOT_CONNECTED: the failing request's facts", async () => {
    const answer = await chain(logger, async ({ step }) => {
      await step(Promise.resolve(succeeded('locked', REPLACED)));
      return step(
        Promise.resolve(
          failed<string>({
            origin: 'connection',
            message: 'the session is gone',
            sessionError: ADT_SESSION_ERROR.NOT_CONNECTED,
          }),
        ),
      );
    });

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().sessionError).toBe(
      ADT_SESSION_ERROR.NOT_CONNECTED,
    );
    expect('sessionLost' in answer.getError()).toBe(false);
  });

  it('a cleanup refused ADT_NOT_CONNECTED after a successful chain: the success as it was, the cleanup logged', async () => {
    const answer = await chain(logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        throw Object.assign(new Error('the session is gone'), {
          code: ADT_SESSION_ERROR.NOT_CONNECTED,
        });
      });
      return step(Promise.resolve(succeeded('written', REPLACED)));
    });

    if (!answer.ok) throw new Error('expected a success');
    expect(answer.getResult()).toEqual({
      value: 'written',
      sessionLost: REPLACED,
    });
    expect(logger.warn).toHaveBeenCalledWith('cleanup failed', {
      error: 'the session is gone',
    });
  });
});
