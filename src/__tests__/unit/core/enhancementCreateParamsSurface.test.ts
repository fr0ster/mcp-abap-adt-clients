/**
 * Guard on a deprecated field this package still relies on.
 *
 * `ICreateEnhancementParams.source_code` is a no-op kept for backward
 * compatibility: removing it would break TS consumers. The guard survives, but
 * it now points at `@mcp-abap-adt/interfaces`, which owns the type — this
 * package stopped re-exporting types it does not own, so importing it from the
 * barrel would be asserting a contract that is no longer ours to make.
 */
import type { ICreateEnhancementParams } from '@mcp-abap-adt/interfaces';

// Compile-time guards (checked by ts-jest at build):
// 1. The field still exists on the exported type.
type _FieldExists = ICreateEnhancementParams['source_code'];
// 2. It is still optional (undefined is assignable to it).
const _optional: _FieldExists = undefined;

describe('ICreateEnhancementParams public surface', () => {
  it('keeps source_code as an optional field on the published type', () => {
    // The real assertion is the compile-time type index above; this runtime
    // body exists so Jest registers a passing test once the file type-checks.
    expect(_optional).toBeUndefined();
  });
});
