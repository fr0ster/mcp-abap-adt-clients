# ServiceBinding Variant Design Spec

Closes: fr0ster/mcp-abap-adt-clients#17
Related: fr0ster/mcp-abap-adt#60

## Overview

Replace separate `bindingType`/`bindingVersion`/`bindingCategory` parameters with a single `ServiceBindingVariant` constant that maps to all three values plus `serviceType`. Backward compatible — old parameters still work as fallback.

## ServiceBindingVariant Type

```typescript
type ServiceBindingVariant =
  | 'ODATA_V2_UI'       // ODATA, V2, category 0
  | 'ODATA_V2_WEB_API'  // ODATA, V2, category 1
  | 'ODATA_V4_UI'       // ODATA, V4, category 0
  | 'ODATA_V4_WEB_API'; // ODATA, V4, category 1
// Future: INA_UI, SQL_WEB_API — see issue to be created
```

## Variant Mapping

```typescript
const SERVICE_BINDING_VARIANT_MAP: Record<ServiceBindingVariant, {
  bindingType: ServiceBindingType;
  bindingVersion: ServiceBindingVersion;
  bindingCategory: '0' | '1';
  serviceType: GeneratedServiceType;
}> = {
  ODATA_V2_UI:       { bindingType: 'ODATA', bindingVersion: 'V2', bindingCategory: '0', serviceType: 'odatav2' },
  ODATA_V2_WEB_API:  { bindingType: 'ODATA', bindingVersion: 'V2', bindingCategory: '1', serviceType: 'odatav2' },
  ODATA_V4_UI:       { bindingType: 'ODATA', bindingVersion: 'V4', bindingCategory: '0', serviceType: 'odatav4' },
  ODATA_V4_WEB_API:  { bindingType: 'ODATA', bindingVersion: 'V4', bindingCategory: '1', serviceType: 'odatav4' },
};
```

The mapping object is exported from `types.ts` so consumers can inspect it if needed.

## Interface Changes

### ICreateServiceBindingParams

```typescript
export interface ICreateServiceBindingParams {
  bindingName: string;
  packageName: string;
  description: string;
  serviceDefinitionName: string;
  serviceName: string;
  serviceVersion: string;
  bindingVariant?: ServiceBindingVariant;   // NEW — preferred path
  bindingType?: ServiceBindingType;         // was required, now optional (legacy fallback)
  bindingVersion?: ServiceBindingVersion;   // was required, now optional (legacy fallback)
  bindingCategory?: '0' | '1' | string;    // already optional
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
  transportRequest?: string;
  runTransportCheck?: boolean;
  activateAfterCreate?: boolean;
}
```

### IServiceBindingConfig

Add `bindingVariant?: ServiceBindingVariant`. All existing fields remain.

### ICreateAndGenerateServiceBindingParams

Inherits `bindingVariant` from `ICreateServiceBindingParams`. `serviceType` becomes optional — derived from variant when variant is provided.

```typescript
export interface ICreateAndGenerateServiceBindingParams
  extends ICreateServiceBindingParams {
  serviceType?: GeneratedServiceType;  // was required, now optional (derived from variant)
}
```

## Resolution Logic

In `buildServiceBindingCreateXml()` and `createAndGenerate()`:

1. If `bindingVariant` is provided — resolve from `SERVICE_BINDING_VARIANT_MAP`
2. Else if `bindingType` + `bindingVersion` are provided — use them directly, `bindingCategory` defaults to `'1'`
3. Else — throw Error: `'Either bindingVariant or bindingType+bindingVersion is required'`

For `serviceType` in `createAndGenerate()`:
1. If `bindingVariant` is provided — derive from map
2. Else — use `params.serviceType` (required in legacy path)

## Files Changed

- `src/core/service/types.ts` — add `ServiceBindingVariant`, `SERVICE_BINDING_VARIANT_MAP`, update interfaces
- `src/core/service/AdtService.ts` — update `buildServiceBindingCreateXml()` and `createAndGenerate()` with resolution logic
- `src/core/service/index.ts` — export new type and map
- `src/index.ts` — export `ServiceBindingVariant` type

## Backward Compatibility

- All existing code passing `bindingType`/`bindingVersion` continues to work unchanged
- `bindingType` and `bindingVersion` change from required to optional in `ICreateServiceBindingParams` — this is not a breaking change (callers providing them still compile)
- `serviceType` becomes optional in `ICreateAndGenerateServiceBindingParams` — existing callers providing it still compile
- Default behavior when no variant: same as before (category defaults to `'1'`)

## Testing

- Existing tests with `bindingType`/`bindingVersion` remain unchanged
- Add test case with `bindingVariant: 'ODATA_V4_UI'` to verify new path and category `0`
- Optional: additional test cases for other variants if system supports them

## Follow-up Issues

- Create issue in `adt-clients` for INA/SQL binding type analysis (which version/category values they use)
- fr0ster/mcp-abap-adt#60 — update MCP tool handlers to use `ServiceBindingVariant`
