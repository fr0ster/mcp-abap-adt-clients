/**
 * Shared helper for resolving a pre-existing ABAP class that forces a runtime dump.
 * Used by integration tests that need a short dump (runtime dumps tests).
 *
 * The class must already exist on the SAP system — the test does NOT create or modify it.
 * Class name comes from test config params or uses a fixed default.
 */

const DEFAULT_CLASS_NAME = 'ZAC_SHR_DMP01';

/**
 * Resolve the dump class name from test config params.
 * Returns the uppercase class name — does NOT create or modify anything.
 */
export function resolveDumpClassName(
  params: Record<string, unknown>,
): string {
  return (
    typeof params.dump_class_name === 'string' && params.dump_class_name.trim()
      ? params.dump_class_name.trim()
      : DEFAULT_CLASS_NAME
  ).toUpperCase();
}
