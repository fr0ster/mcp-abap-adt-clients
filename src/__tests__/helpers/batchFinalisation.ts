import type { ILogger } from '@mcp-abap-adt/interfaces-utils';

/** Every step must run, even when writing diagnostics or the logger fails. */
export async function finaliseBatch(
  failures: unknown[],
  steps: readonly (() => unknown | Promise<unknown>)[],
  logger: ILogger,
): Promise<void> {
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
    }
  }
  for (const failure of failures.slice(1)) {
    try {
      logger.error?.(`Batch cleanup/finalisation failed: ${String(failure)}`);
    } catch {
      // A broken logger must not replace the primary failure.
    }
  }
  if (failures.length) throw failures[0];
}
