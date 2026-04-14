# ServiceBinding Variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace separate `bindingType`/`bindingVersion`/`bindingCategory` with a single required `ServiceBindingVariant` constant that maps to all resolved values.

**Architecture:** Define `ServiceBindingVariant` type and `SERVICE_BINDING_VARIANT_MAP` in `@mcp-abap-adt/interfaces`. Update `adt-clients` types and `AdtService.ts` to use variant as the sole input path. Add `resolveBindingVariant()` helper for normalization.

**Tech Stack:** TypeScript, two npm packages (`@mcp-abap-adt/interfaces`, `@mcp-abap-adt/adt-clients`)

**Spec:** `docs/superpowers/specs/2026-04-14-service-binding-variant-design.md`

---

### Task 1: Add ServiceBindingVariant to `@mcp-abap-adt/interfaces`

**Files:**
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-interfaces/src/adt/IAdtServiceBinding.ts`
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-interfaces/src/index.ts`

- [ ] **Step 1: Add ServiceBindingVariant type and mapping to IAdtServiceBinding.ts**

After line 8 (`export type DesiredPublicationState = ...`), add:

```typescript
export type ServiceBindingVariant =
  | 'ODATA_V2_UI'
  | 'ODATA_V2_WEB_API'
  | 'ODATA_V4_UI'
  | 'ODATA_V4_WEB_API';
// Future: INA_UI, SQL_WEB_API — see fr0ster/mcp-abap-adt-clients#18

export const SERVICE_BINDING_VARIANT_MAP: Record<
  ServiceBindingVariant,
  {
    bindingType: ServiceBindingType;
    bindingVersion: ServiceBindingVersion;
    bindingCategory: '0' | '1';
    serviceType: GeneratedServiceType;
  }
> = {
  ODATA_V2_UI: { bindingType: 'ODATA', bindingVersion: 'V2', bindingCategory: '0', serviceType: 'odatav2' },
  ODATA_V2_WEB_API: { bindingType: 'ODATA', bindingVersion: 'V2', bindingCategory: '1', serviceType: 'odatav2' },
  ODATA_V4_UI: { bindingType: 'ODATA', bindingVersion: 'V4', bindingCategory: '0', serviceType: 'odatav4' },
  ODATA_V4_WEB_API: { bindingType: 'ODATA', bindingVersion: 'V4', bindingCategory: '1', serviceType: 'odatav4' },
};
```

- [ ] **Step 2: Update ICreateServiceBindingParams in IAdtServiceBinding.ts**

Replace `binding_type`, `binding_version`, `binding_category` with `binding_variant`:

```typescript
export interface ICreateServiceBindingParams {
  binding_name: string;
  package_name: string;
  description: string;
  service_definition_name: string;
  service_name: string;
  service_version: string;
  binding_variant: ServiceBindingVariant;
  master_language?: string;
  master_system?: string;
  responsible?: string;
  transport_request?: string;
}
```

- [ ] **Step 3: Add exports to index.ts**

In `/home/okyslytsia/prj/mcp-abap-adt-interfaces/src/index.ts`, find the existing exports from `./adt/IAdtServiceBinding` and add:

```typescript
export { SERVICE_BINDING_VARIANT_MAP } from './adt/IAdtServiceBinding';
export type { ServiceBindingVariant } from './adt/IAdtServiceBinding';
```

- [ ] **Step 4: Build interfaces package**

Run from `/home/okyslytsia/prj/mcp-abap-adt-interfaces`:
```bash
npm run build
```
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
git add src/adt/IAdtServiceBinding.ts src/index.ts
git commit -m "feat: add ServiceBindingVariant type and mapping constant"
```

---

### Task 2: Lint, changelog, release interfaces and update adt-clients dependency

- [ ] **Step 1: Lint interfaces with Biome**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
npm run lint
```
Expected: No errors (or auto-fixed)

- [ ] **Step 2: Add changelog entry**

Add entry to `CHANGELOG.md` in `@mcp-abap-adt/interfaces` for the new version:

```markdown
## [X.Y.Z] - 2026-04-14

### Added
- `ServiceBindingVariant` type — 4 ODATA variants (`ODATA_V2_UI`, `ODATA_V2_WEB_API`, `ODATA_V4_UI`, `ODATA_V4_WEB_API`)
- `SERVICE_BINDING_VARIANT_MAP` — maps variant to `bindingType`, `bindingVersion`, `bindingCategory`, `serviceType`

### Changed
- `ICreateServiceBindingParams.binding_variant` replaces `binding_type`, `binding_version`, `binding_category`
```

Ask the user which version number to use.

- [ ] **Step 3: Bump version in package.json**

Update version in `package.json`, then:
```bash
npm install --package-lock-only
```

- [ ] **Step 4: Commit and publish**

```bash
git add -A
git commit -m "feat: add ServiceBindingVariant, bump version to X.Y.Z"
npm publish
```

- [ ] **Step 5: Update adt-clients dependency**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
npm install @mcp-abap-adt/interfaces@latest
```

- [ ] **Step 3: Verify no link: true in package-lock.json**

```bash
grep -c '"link": true' package-lock.json
```
Expected: 0

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: update @mcp-abap-adt/interfaces with ServiceBindingVariant"
```

---

### Task 3: Update adt-clients types

**Files:**
- Modify: `src/core/service/types.ts`
- Modify: `src/core/service/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Update types.ts**

Import `ServiceBindingVariant` and `SERVICE_BINDING_VARIANT_MAP` from interfaces. Replace old fields with `bindingVariant` in `ICreateServiceBindingParams`, `IServiceBindingConfig`, `ICreateAndGenerateServiceBindingParams`.

In `src/core/service/types.ts`:

Remove lines 8-9 (`ServiceBindingType`, `ServiceBindingVersion` type exports) — they now come from `@mcp-abap-adt/interfaces` and are internal to the mapping. Keep them as local imports for use in the mapping value type.

Add at top:

```typescript
import {
  SERVICE_BINDING_VARIANT_MAP,
  type ServiceBindingVariant,
  type ServiceBindingType,
  type ServiceBindingVersion,
  type GeneratedServiceType,
} from '@mcp-abap-adt/interfaces';
```

Update `IServiceBindingConfig`:

```typescript
export interface IServiceBindingConfig {
  bindingName: string;
  packageName?: string;
  description?: string;
  serviceDefinitionName?: string;
  serviceName?: string;
  serviceVersion?: string;
  bindingVariant?: ServiceBindingVariant;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
  desiredPublicationState?: DesiredPublicationState;
  transportRequest?: string;
  runTransportCheck?: boolean;
}
```

Update `ICreateServiceBindingParams`:

```typescript
export interface ICreateServiceBindingParams {
  bindingName: string;
  packageName: string;
  description: string;
  serviceDefinitionName: string;
  serviceName: string;
  serviceVersion: string;
  bindingVariant: ServiceBindingVariant;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
  transportRequest?: string;
  runTransportCheck?: boolean;
  activateAfterCreate?: boolean;
}
```

Update `ICreateAndGenerateServiceBindingParams` — remove `serviceType`:

```typescript
export interface ICreateAndGenerateServiceBindingParams
  extends ICreateServiceBindingParams {}
```

Add the resolver helper function:

```typescript
export function resolveBindingVariant(variant: ServiceBindingVariant): {
  bindingType: ServiceBindingType;
  bindingVersion: ServiceBindingVersion;
  bindingCategory: '0' | '1';
  serviceType: GeneratedServiceType;
} {
  return SERVICE_BINDING_VARIANT_MAP[variant];
}
```

Remove `ServiceBindingType`, `ServiceBindingVersion`, `GeneratedServiceType` from the public type exports (they are now internal). Remove `serviceType` from `IServiceBindingConfig`. Keep `DesiredPublicationState` as is.

- [ ] **Step 2: Update index.ts exports**

In `src/core/service/index.ts`, remove `ServiceBindingType`, `ServiceBindingVersion`, `GeneratedServiceType` from type exports. Add:

```typescript
export { resolveBindingVariant } from './types';
```

Re-export from interfaces:

```typescript
export { SERVICE_BINDING_VARIANT_MAP } from '@mcp-abap-adt/interfaces';
export type { ServiceBindingVariant } from '@mcp-abap-adt/interfaces';
```

- [ ] **Step 3: Update src/index.ts exports**

In `src/index.ts`, in the service exports section, remove `ServiceBindingType`, `ServiceBindingVersion`, `GeneratedServiceType`. Add:

```typescript
export { SERVICE_BINDING_VARIANT_MAP } from './core/service';
export type { ServiceBindingVariant } from './core/service';
export { resolveBindingVariant } from './core/service';
```

- [ ] **Step 4: Build to check for type errors**

Run: `npm run build:fast`
Expected: Compilation errors in `AdtService.ts` (references to removed fields) — this is expected, fixed in Task 4.

- [ ] **Step 5: Commit types**

```bash
git add src/core/service/types.ts src/core/service/index.ts src/index.ts
git commit -m "feat(service): update types to use ServiceBindingVariant"
```

---

### Task 4: Update AdtService.ts

**Files:**
- Modify: `src/core/service/AdtService.ts`

- [ ] **Step 1: Update buildServiceBindingCreateXml()**

Replace line 66 (`const bindingCategory = params.bindingCategory ?? '1';`) and line 91 (the `srvb:binding` line that references `params.bindingType` and `params.bindingVersion`) to use `resolveBindingVariant`:

```typescript
  private buildServiceBindingCreateXml(
    params: ICreateServiceBindingParams,
  ): string {
    const { bindingType, bindingVersion, bindingCategory } = resolveBindingVariant(params.bindingVariant);
    const masterLanguage = params.masterLanguage ?? 'EN';
    // ... rest unchanged, but use local bindingType/bindingVersion/bindingCategory
    // instead of params.bindingType/params.bindingVersion/params.bindingCategory
```

In the XML template line 91, replace:
- `${params.bindingType}` → `${bindingType}`
- `${params.bindingVersion}` → `${bindingVersion}`
- `${bindingCategory}` already uses the local variable

- [ ] **Step 2: Update validate()**

Replace lines 255-260 (checks for `bindingType` and `bindingVersion`) with check for `bindingVariant`:

```typescript
    if (!config.bindingVariant) {
      throw new Error('bindingVariant is required for validation');
    }

    const { bindingType, bindingVersion } = resolveBindingVariant(config.bindingVariant);
```

Then use these local variables in `getBindingTypeAvailabilityKey(bindingType, bindingVersion)` (line 268-271).

- [ ] **Step 3: Update create()**

Replace lines 315-319 (checks for `bindingType` and `bindingVersion`) with check for `bindingVariant`:

```typescript
    if (!config.bindingVariant) {
      throw new Error('bindingVariant is required');
    }
```

Replace lines 328-336 (availability check) to use resolved values:

```typescript
    const { bindingType, bindingVersion, serviceType: resolvedServiceType } = resolveBindingVariant(config.bindingVariant);
    const availabilityKey = this.getBindingTypeAvailabilityKey(bindingType, bindingVersion);
    if (!availableBindingTypes.has(availabilityKey)) {
      throw new Error(
        `Binding type ${bindingType}/${bindingVersion} is not available on current ADT system`,
      );
    }
```

Update lines 347-361 (createServiceBinding call) to pass `bindingVariant`:

```typescript
    state.createResult = await this.createServiceBinding({
      bindingName: config.bindingName,
      packageName: config.packageName,
      description: config.description,
      serviceDefinitionName: config.serviceDefinitionName,
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      bindingVariant: config.bindingVariant,
      masterLanguage: config.masterLanguage,
      masterSystem: config.masterSystem,
      responsible: config.responsible,
      transportRequest: config.transportRequest,
    });
```

Replace lines 383-387 (serviceType derivation) with resolved value:

```typescript
    state.generatedInfoResult = await this.generateServiceBinding({
      serviceType: resolvedServiceType,
      bindingName: config.bindingName,
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      serviceDefinitionName: config.serviceDefinitionName,
    });
```

- [ ] **Step 4: Update createAndGenerateServiceBinding()**

Replace lines 917-931 to pass `bindingVariant` instead of old fields:

```typescript
    const state = await this.create(
      {
        bindingName: params.bindingName,
        packageName: params.packageName,
        description: params.description,
        serviceDefinitionName: params.serviceDefinitionName,
        serviceName: params.serviceName,
        serviceVersion: params.serviceVersion,
        bindingVariant: params.bindingVariant,
        masterLanguage: params.masterLanguage,
        masterSystem: params.masterSystem,
        responsible: params.responsible,
        runTransportCheck: params.runTransportCheck,
      },
      { activateOnCreate: true },
    );
```

- [ ] **Step 5: Add import for resolveBindingVariant**

At top of `AdtService.ts`, add:

```typescript
import { resolveBindingVariant } from './types';
```

- [ ] **Step 6: Build**

Run: `npm run build:fast`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/core/service/AdtService.ts
git commit -m "feat(service): use resolveBindingVariant in all create-flow APIs"
```

---

### Task 5: Update tests

**Files:**
- Modify: `src/__tests__/integration/core/serviceBinding/ServiceBinding.test.ts`
- Modify: `src/__tests__/helpers/test-config.yaml.template`

- [ ] **Step 1: Update test buildConfig**

In `ServiceBinding.test.ts`, replace lines 116-134 in `buildConfig`:

```typescript
        buildConfig: (testCase: any, resolver?: TestConfigResolver) => {
          const params = testCase?.params || {};
          const parentPackage =
            resolver?.getPackageName?.() ||
            resolvePackageName(
              params.parent_package_name || params.package_name,
            );
          if (!parentPackage)
            throw new Error('parent_package_name/package_name not configured');
          const packageName =
            params.test_subpackage_name || `${parentPackage}_SRVB`;

          return {
            bindingName: params.binding_name,
            packageName,
            transportRequest:
              resolver?.getTransportRequest?.() ||
              resolveTransportRequest(params.transport_request),
            description: params.description,
            serviceDefinitionName: params.service_definition_name,
            serviceName: params.service_name || params.service_definition_name,
            serviceVersion: params.service_version || '0001',
            bindingVariant: params.binding_variant || 'ODATA_V4_WEB_API',
            desiredPublicationState:
              params.desired_publication_state || 'unchanged',
          } as IServiceBindingConfig;
        },
```

- [ ] **Step 2: Update test-config.yaml.template**

In the `create_service_binding` section, replace `binding_type`, `binding_version`, `binding_category`, `service_type` with `binding_variant`:

```yaml
      params:
        binding_name: "ZAC_SRVB01"
        service_definition_name: "ZAC_SRVD01"
        service_name: "ZAC_SRVD01"
        service_version: "0001"
        binding_variant: "ODATA_V4_WEB_API"
        desired_publication_state: "published"
        description: "AdtServiceBinding workflow service binding"
```

- [ ] **Step 3: Update test-config.yaml if it exists**

Apply same changes to `src/__tests__/helpers/test-config.yaml` if present.

- [ ] **Step 4: Run type-check on tests**

Run: `npm run test:check:integration`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/integration/core/serviceBinding/ServiceBinding.test.ts src/__tests__/helpers/test-config.yaml.template
git commit -m "test(service): update tests to use bindingVariant"
```

---

### Task 6: Full build, lint, and verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No errors (or auto-fixed)

- [ ] **Step 3: Type-check tests**

Run: `npm run test:check`
Expected: No errors

- [ ] **Step 4: Run service binding tests (if SAP available)**

Run: `npm test -- integration/core/serviceBinding 2>&1 | tee test-run.log`
Expected: Tests pass with `bindingVariant`

- [ ] **Step 5: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(service): lint fixes for ServiceBindingVariant"
```
