# Transformation Module Design Spec

## Overview

Add a new core module `src/core/transformation/` to support CRUD operations for SAP ABAP XSLT transformations via ADT REST API. Supports both Simple Transformations and XSLT Programs through a single unified module.

## Transformation Types

| Type | `trans:transformationType` | `adtcore:type` |
|------|---------------------------|----------------|
| Simple Transformation | `SimpleTransformation` | `XSLT/VT` |
| XSLT Program | `XSLTProgram` | `XSLT/VT` |

Both types share the same endpoint, XML namespace, and `adtcore:type`. The only difference is the `trans:transformationType` attribute.

## ADT Endpoint

**Base URL:** `/sap/bc/adt/xslt/transformations`

**Content-Type (metadata):** `application/vnd.sap.adt.transformations+xml`

**XML namespace:** `trans` / `http://www.sap.com/adt/transformation`

### URL Patterns

| Operation | Method | URL |
|-----------|--------|-----|
| Create | POST | `/sap/bc/adt/xslt/transformations[?corrNr=...]` |
| Read metadata | GET | `/sap/bc/adt/xslt/transformations/{name}` |
| Read source | GET | `/sap/bc/adt/xslt/transformations/{name}/source/main` |
| Update source | PUT | `/sap/bc/adt/xslt/transformations/{name}/source/main?lockHandle=...` |
| Lock | POST | `/sap/bc/adt/xslt/transformations/{name}?_action=LOCK&accessMode=MODIFY` |
| Unlock | POST | `/sap/bc/adt/xslt/transformations/{name}?_action=UNLOCK&lockHandle=...` |
| Delete | POST | `/sap/bc/adt/deletion/delete` (shared) |
| Check deletion | POST | `/sap/bc/adt/deletion/check` (shared) |
| Activate | POST | `/sap/bc/adt/activation?method=activate&preauditRequested=true` (shared) |
| Check | POST | shared checkRun |
| Validate | POST | `/sap/bc/adt/xslt/validation?objname=...` |
| Read transport | GET | `/sap/bc/adt/xslt/transformations/{name}/transport` |

## Types (`types.ts`)

```typescript
type TransformationType = 'SimpleTransformation' | 'XSLTProgram';

// Low-level function parameters (snake_case)
interface ICreateTransformationParams {
  transformation_name: string;
  transformation_type: TransformationType;
  description?: string;
  package_name: string;
  transport_request?: string;
  masterSystem?: string;
  responsible?: string;
}

interface IUpdateTransformationParams {
  transformation_name: string;
  source_code: string;
  transport_request?: string;
}

interface IDeleteTransformationParams {
  transformation_name: string;
  transport_request?: string;
}

// High-level configuration (camelCase)
interface ITransformationConfig {
  transformationName: string;
  transformationType: TransformationType;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

// State
interface ITransformationState extends IAdtObjectState {
  readSourceResult?: IAdtResponse;
}
```

## Create XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<trans:transformation xmlns:trans="http://www.sap.com/adt/transformation"
                      xmlns:adtcore="http://www.sap.com/adt/core"
                      adtcore:description="{description}"
                      adtcore:language="EN"
                      adtcore:name="{NAME_UPPERCASE}"
                      adtcore:type="XSLT/VT"
                      adtcore:masterLanguage="EN"
                      adtcore:masterSystem="{masterSystem}"
                      adtcore:responsible="{responsible}"
                      trans:transformationType="{SimpleTransformation|XSLTProgram}">
  <adtcore:packageRef adtcore:name="{PACKAGE_UPPERCASE}"/>
</trans:transformation>
```

- `masterSystem` and `responsible` from `systemContext`, omitted if not provided
- `description` limited via `limitDescription()` (60 chars)
- `name` and `package` — uppercase
- `transformationType` — taken directly from config

## File Structure

```
src/core/transformation/
├── AdtTransformation.ts    # Main class implementing IAdtObject<ITransformationConfig, ITransformationState>
├── types.ts                # ITransformationConfig, ITransformationState, ICreate/Update/DeleteTransformationParams
├── create.ts               # POST creation with XML body
├── read.ts                 # GET metadata + source code + transport
├── update.ts               # PUT source code with lockHandle
├── delete.ts               # Shared deletion (checkDeletion + delete)
├── lock.ts                 # POST _action=LOCK
├── unlock.ts               # POST _action=UNLOCK
├── activation.ts           # Shared activation
├── check.ts                # Shared checkRun
├── validation.ts           # POST validation
└── index.ts                # Re-exports + AdtTransformationType alias
```

## Class `AdtTransformation`

Follows the exact same pattern as `AdtAccessControl`:

- Constructor: `connection`, `logger?`, `systemContext?`
- `objectType = 'Transformation'`
- All methods from `IAdtObject`: validate, create, read, readMetadata, readTransport, update, delete, activate, check, lock, unlock

### Operation Chains

- **Create:** validate → create → check → lock → update (source) → unlock → activate (optional)
- **Update:** lock → check(inactive) → update → read(longPolling) → unlock → check → activate (optional)
- **Delete:** checkDeletion → delete

### Session Management

- Stateful only during lock/unlock
- Always restore stateless after operations and on error cleanup
- Automatic unlock on error with `setSessionType('stateless')`

## Client Registration

In `AdtClient.ts`:

```typescript
getTransformation(): IAdtObject<ITransformationConfig, ITransformationState> {
  return new AdtTransformation(this.connection, this.logger, this.systemContext);
}
```

## Exports

In `src/core/transformation/index.ts`:

```typescript
export { AdtTransformation } from './AdtTransformation';
export * from './types';
export type AdtTransformationType = IAdtObject<ITransformationConfig, ITransformationState>;
```

In `src/index.ts`:

```typescript
export type { AdtTransformationType, ITransformationConfig, ITransformationState } from './core/transformation';
```

## Content Types

Add to `src/constants/contentTypes.ts`:

```typescript
export const CT_TRANSFORMATION = 'application/vnd.sap.adt.transformations+xml';
```

Source code read/write, lock, unlock, check, activation, deletion, validation — use existing shared content type constants.

## Object Names

- Support both flat names (`ZOK_TRANS_0001`) and namespace names (`/RRR/XML_TEST`)
- Use existing `encodeSapObjectName()` for URL encoding
- Uppercase in XML payloads

## Environment Support

- Works on Cloud, On-Premise, and Legacy systems
- No environment-specific branching initially (may be added later)

## Testing (TDD)

Tests in `src/__tests__/integration/core/transformation/` — written **before** implementation of each operation.

- Test-first for each CRUD operation
- Cover both `SimpleTransformation` and `XSLTProgram` types
- Support namespace names in test objects
- Config section `transformation` in `test-config.yaml`
- Idempotent: CREATE tests delete existing objects first
- Sequential execution (maxWorkers: 1)

## Approach

Single module with `transformationType` parameter (Approach A). Both types share the same endpoint, XML namespace, and logic. The only difference is the `trans:transformationType` XML attribute value.
