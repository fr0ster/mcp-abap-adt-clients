# ServiceBinding Variant Design Spec

Closes: fr0ster/mcp-abap-adt-clients#17
Related: fr0ster/mcp-abap-adt#60

## Overview

Replace separate `bindingType`/`bindingVersion`/`bindingCategory` parameters with a single required `ServiceBindingVariant` constant that maps to all three values plus `serviceType`. Breaking change — old parameters removed from public API.

Not a real breaking change in practice: in `mcp-abap-adt` those parameters existed but were never passed through; now consumers pass one of 6 variant constants instead.

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

The mapping object is exported as part of the public service API so consumers can inspect it if needed.

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

- `src/core/service/types.ts` — add `ServiceBindingVariant`, `SERVICE_BINDING_VARIANT_MAP`, update interfaces (remove old fields, add `bindingVariant`)
- `src/core/service/AdtService.ts` — add `resolveBindingVariant()` helper, update all create-flow methods to use it
- `src/core/service/index.ts` — export new type and map
- `src/index.ts` — export `ServiceBindingVariant` type and `SERVICE_BINDING_VARIANT_MAP`

## Testing

- Update existing tests to use `bindingVariant` instead of `bindingType`/`bindingVersion`
- Add test case with `bindingVariant: 'ODATA_V4_UI'` to verify category `0`
- Add test cases for all 4 variants if system supports them
- Update `test-config.yaml.template` with `binding_variant` parameter

## Follow-up Issues

- Create issue in `adt-clients` for INA/SQL binding type analysis (which version/category values they use)
- fr0ster/mcp-abap-adt#60 — update MCP tool handlers to use `ServiceBindingVariant`
