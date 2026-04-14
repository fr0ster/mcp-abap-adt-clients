# ServiceBinding Variant Design Spec

Closes: fr0ster/mcp-abap-adt-clients#17
Related: fr0ster/mcp-abap-adt#60

## Overview

Replace separate `bindingType`/`bindingVersion`/`bindingCategory` parameters with a single required `ServiceBindingVariant` constant that maps to all three values plus `serviceType`. Breaking change — old parameters removed from public API.

Not a real breaking change in practice: in `mcp-abap-adt` those parameters existed but were never passed through; now consumers pass one of 4 currently supported variant constants, with 2 more reserved for future INA/SQL variants.

## ServiceBindingVariant Type

```typescript
type ServiceBindingVariant =
  | 'ODATA_V2_UI'       // ODATA, V2, category 0
  | 'ODATA_V2_WEB_API'  // ODATA, V2, category 1
  | 'ODATA_V4_UI'       // ODATA, V4, category 0
  | 'ODATA_V4_WEB_API'; // ODATA, V4, category 1
// Future: INA_UI, SQL_WEB_API — see follow-up issue
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

### Package Location

`ServiceBindingVariant` type and `SERVICE_BINDING_VARIANT_MAP` are defined in `@mcp-abap-adt/interfaces` so that consumers (e.g. MCP tool layer) can import them directly without depending on `adt-clients`. The `adt-clients` package re-exports them.

## Interface Changes

### ICreateServiceBindingParams

Remove `bindingType`, `bindingVersion`, `bindingCategory`. Add required `bindingVariant`:

```typescript
export interface ICreateServiceBindingParams {
  bindingName: string;
  packageName: string;
  description: string;
  serviceDefinitionName: string;
  serviceName: string;
  serviceVersion: string;
  bindingVariant: ServiceBindingVariant;    // REQUIRED — replaces bindingType/bindingVersion/bindingCategory
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
  transportRequest?: string;
  runTransportCheck?: boolean;
  activateAfterCreate?: boolean;
}
```

### IServiceBindingConfig

Replace `bindingType?`, `bindingVersion?`, `bindingCategory?` with `bindingVariant?: ServiceBindingVariant`.

`bindingVariant` remains optional at the raw config type level because `IServiceBindingConfig` is also used outside pure create input typing, but create-flow methods (`validate()`, `create()`, `createServiceBinding()`, `createAndGenerateServiceBinding()`) require it at runtime.

### ICreateAndGenerateServiceBindingParams

Remove `serviceType` — derived from variant automatically:

```typescript
export interface ICreateAndGenerateServiceBindingParams
  extends ICreateServiceBindingParams {}
```

### Internal Types

`ServiceBindingType`, `ServiceBindingVersion`, `GeneratedServiceType` remain as internal types used by the mapping and XML builder. They are no longer part of the public create API surface.

## Resolution Logic

Introduce a shared helper `resolveBindingVariant(variant: ServiceBindingVariant)` that returns `{ bindingType, bindingVersion, bindingCategory, serviceType }` from `SERVICE_BINDING_VARIANT_MAP`.

Apply this in all public create-flow APIs:

- `validate()`
- `create()`
- `createServiceBinding()`
- `createAndGenerateServiceBinding()`
- `buildServiceBindingCreateXml()`

No conflict handling needed — there is only one input path.

## Files Changed

### `@mcp-abap-adt/interfaces` (separate repo/package)
- Add `ServiceBindingVariant` type and `SERVICE_BINDING_VARIANT_MAP` constant
- Publish new version

### `@mcp-abap-adt/adt-clients` (this repo)
- `src/core/service/types.ts` — import from `@mcp-abap-adt/interfaces`, update interfaces (remove old fields, add `bindingVariant`)
- `src/core/service/AdtService.ts` — add `resolveBindingVariant()` helper, update all create-flow methods to use it
- `src/core/service/index.ts` — re-export type and map from interfaces
- `src/index.ts` — re-export `ServiceBindingVariant` type and `SERVICE_BINDING_VARIANT_MAP`

## Testing

- Update existing tests to use `bindingVariant` instead of `bindingType`/`bindingVersion`
- Add test case with `bindingVariant: 'ODATA_V4_UI'` to verify category `0`
- Add test cases for all 4 variants if system supports them
- Update `test-config.yaml.template` with `binding_variant` parameter

## Follow-up Issues

- Create issue in `adt-clients` for INA/SQL binding type analysis (which version/category values they use)
- fr0ster/mcp-abap-adt#60 — update MCP tool handlers to use `ServiceBindingVariant`
