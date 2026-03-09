/**
 * Shared helper for resolving a pre-existing runnable ABAP class (if_oo_adt_classrun).
 * Used by integration tests that need to execute a class (profiler, executor, etc.).
 *
 * The class must already exist on the SAP system — the test does NOT create or modify it.
 * Class name comes from test config params or uses a fixed default.
 */

const DEFAULT_CLASS_NAME = 'ZAC_SHR_RUN01';

/**
 * Resolve the runnable class name from test config params.
 * Returns the uppercase class name — does NOT create or modify anything.
 */
export function resolveRunnableClassName(
  params: Record<string, unknown>,
): string {
  return (
    typeof params.class_name === 'string' && params.class_name.trim()
      ? params.class_name.trim()
      : DEFAULT_CLASS_NAME
  ).toUpperCase();
}
