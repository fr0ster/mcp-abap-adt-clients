/**
 * The chain runs cleanup on every path.
 *
 * This is the sharpest edge in the migration: the old chains cleaned up from a
 * `catch`, which worked only because a refused request threw. A refusal is a
 * returned value now, so an unguarded early return would leave the object locked
 * on the server and the session stateful, and nothing would say so.
 */
import type { IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
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
