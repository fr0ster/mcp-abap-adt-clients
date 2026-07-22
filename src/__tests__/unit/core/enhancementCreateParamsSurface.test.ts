/**
 * Public API-surface guard: ICreateEnhancementParams is publicly exported
 * (src/index.core.ts -> src/index.ts). Its `source_code` field is a deprecated
 * no-op that is intentionally KEPT for backward compatibility (removing it would
 * break TS consumers). This test imports from the published barrel — not from
 * core/enhancement/types — so it guards the real exported surface, including the
 * barrel re-export. If the field or its export is removed, the type index below
 * stops compiling and this suite fails to build.
 */
import type { ICreateEnhancementParams } from '../../../index';

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
