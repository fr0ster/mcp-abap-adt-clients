/**
 * A rollback that failed is not a private matter.
 *
 * `deleteOnFailure` removes what a create made when a later step in the same
 * call fails. When that removal itself fails — the object is locked, the
 * transport is gone, the session died — the system is left holding a name, and
 * that is precisely the state nothing else can clear up.
 *
 * It used to end in `logger.warn` and nowhere else. The answer carried the
 * original failure alone, so a caller reading it had every reason to believe
 * the create had left nothing behind. These say it reaches them.
 *
 * Said in the message rather than in a field on the failure: a contract that
 * grows a field per special case is worse than one that doesn't, and a consumer
 * who wants this structured supplies their own `analyse`.
 */
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { chain } from '../../../core/shared/chain';
import { failed } from '../../../utils/adtResponse';

const silent: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as unknown as ILogger;

const failingStep = () =>
  Promise.resolve(
    failed<string>({ origin: 'refusal', message: 'the source was rejected' }),
  );

describe('a chain whose rollback could not finish', () => {
  it('says so in the failure, next to the reason the chain failed', async () => {
    const answer = await chain<string>(silent, async ({ step, onFailure }) => {
      onFailure(async () => {
        throw new Error('the object is locked by another user');
      });
      return await step(failingStep());
    });

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');

    const failure = answer.getError();
    // Both halves: what went wrong, and that the cleanup for it did not work.
    expect(failure.message).toContain('the source was rejected');
    expect(failure.message).toContain('rollback did not complete');
    expect(failure.message).toContain('the object is locked by another user');
    // The verdict itself is untouched — this is an addition, not a rewrite.
    expect(failure.origin).toBe('refusal');
  });

  it('says nothing extra when the rollback worked', async () => {
    let rolledBack = false;
    const answer = await chain<string>(silent, async ({ step, onFailure }) => {
      onFailure(async () => {
        rolledBack = true;
      });
      return await step(failingStep());
    });

    if (answer.ok) throw new Error('expected a failure');
    expect(rolledBack).toBe(true);
    expect(answer.getError().message).toBe('the source was rejected');
  });

  it('reports every rollback that failed, not just the first', async () => {
    const answer = await chain<string>(silent, async ({ step, onFailure }) => {
      onFailure(async () => {
        throw new Error('first undo failed');
      });
      onFailure(async () => {
        throw new Error('second undo failed');
      });
      return await step(failingStep());
    });

    if (answer.ok) throw new Error('expected a failure');
    const message = answer.getError().message;
    expect(message).toContain('first undo failed');
    expect(message).toContain('second undo failed');
  });

  it('does not confuse a scope-end cleanup with a rollback', async () => {
    // `onScopeEnd` runs on every path — an unlock, a session restored. Its
    // failing is worth a log line, but it does not mean an object was left
    // behind, so it must not claim one was.
    const answer = await chain<string>(silent, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        throw new Error('the unlock did not go through');
      });
      return await step(failingStep());
    });

    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().message).toBe('the source was rejected');
  });
});
