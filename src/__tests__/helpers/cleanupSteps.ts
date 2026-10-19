/**
 * The steps of an `afterAll` (or a `finally`) that must all run, and whose
 * failures must all be reported.
 *
 * A cleanup that throws at its first failure skips every step after it — the
 * log-off of the session it opened included, which then sits on the server
 * until its idle timeout. A cleanup that swallows its failures hides exactly
 * that. So each step runs whatever the one before did, a failure is
 * recorded, and `finish()` throws them all at the end, each named.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { closeOwnTestConnection } from './sessionConfig';

type Answer = { ok: boolean; getError(): { message?: string } };

function isRefused(value: unknown): value is Answer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as { ok: unknown }).ok === false &&
    typeof (value as { getError?: unknown }).getError === 'function'
  );
}

export class CleanupSteps {
  private readonly failures: { step: string; error: unknown }[] = [];

  /**
   * Run one step. With `checkAnswer`, an answer with `ok: false` is a failure
   * too; without it only a throw is.
   */
  async run(
    step: string,
    action: () => unknown,
    options: { checkAnswer?: boolean } = {},
  ): Promise<void> {
    try {
      const answer = await action();
      if (options.checkAnswer && isRefused(answer)) {
        throw new Error(answer.getError().message ?? 'refused');
      }
    } catch (error) {
      this.failures.push({ step, error });
    }
  }

  /** Log off a session this test opened (`ownSession: true`). */
  async logOff(
    step: string,
    connection:
      | (IAbapConnection & { setSessionType?(type: string): void })
      | undefined
      | null,
  ): Promise<void> {
    if (!connection) return;
    await this.run(`log off ${step}`, async () => {
      connection.setSessionType?.('stateless');
      await closeOwnTestConnection(connection);
    });
  }

  /** Record a failure that happened outside a step (a test's own error). */
  record(step: string, error: unknown): void {
    this.failures.push({ step, error });
  }

  /** Throw every recorded failure, each named by its step. */
  finish(): void {
    if (this.failures.length === 0) return;
    const describe = ({ step, error }: { step: string; error: unknown }) =>
      `${step}: ${error instanceof Error ? error.message : String(error)}`;
    if (this.failures.length === 1) {
      const [only] = this.failures;
      throw new Error(`cleanup failed — ${describe(only)}`, {
        cause: only.error,
      });
    }
    throw new AggregateError(
      this.failures.map((failure) => failure.error),
      `cleanup failed in ${this.failures.length} steps — ${this.failures.map(describe).join('; ')}`,
    );
  }
}

/**
 * Run `work`, then `cleanup` whatever `work` did. A failure of `work` is
 * thrown as it is when the cleanup succeeded, and beside the cleanup's
 * failures when it did not — neither hides the other.
 */
export async function withCleanup<T>(
  work: () => Promise<T>,
  cleanup: (steps: CleanupSteps) => Promise<void>,
): Promise<T> {
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await work() };
  } catch (error) {
    outcome = { ok: false, error };
  }
  const steps = new CleanupSteps();
  await cleanup(steps);
  if (outcome.ok) {
    steps.finish();
    return outcome.value;
  }
  try {
    steps.finish();
  } catch (cleanupError) {
    throw new AggregateError(
      [outcome.error, cleanupError],
      `the test failed and so did its cleanup — ${
        outcome.error instanceof Error
          ? outcome.error.message
          : String(outcome.error)
      }; ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
    );
  }
  throw outcome.error;
}
