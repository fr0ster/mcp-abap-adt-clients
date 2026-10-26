/**
 * Shared helper for resolving a pre-existing runnable ABAP program (REPORT).
 * Used by integration tests that need to execute a program (executor, profiler).
 *
 * The program must already exist on the SAP system — the test does NOT create or
 * modify it. Program name comes from test config params or uses a fixed default.
 *
 * Mirrors runnableClassHelper, which does the same for if_oo_adt_classrun classes.
 */

const DEFAULT_PROGRAM_NAME = 'ZAC_SHR_RUNPROG';

/**
 * Resolve the runnable program name from test config params.
 * Returns the uppercase program name — does NOT create or modify anything.
 */
export function resolveRunnableProgramName(
  params: Record<string, unknown>,
): string {
  return (
    typeof params.program_name === 'string' && params.program_name.trim()
      ? params.program_name.trim()
      : DEFAULT_PROGRAM_NAME
  ).toUpperCase();
}
