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

## API Contract

### High-level methods

- `create()` requires: `transformationName`, `transformationType`, `packageName`
- `update()` requires: `transformationName`, `sourceCode`
- `delete()` requires: `transformationName`
- `validate()` requires: `transformationName`

### `sourceCode` behavior

High-level `create()` must define one explicit contract:

- **Preferred:** `sourceCode` is required for high-level `create()` because the create flow includes source update
- **Fallback option:** if `sourceCode` is omitted, `create()` performs only metadata creation (`POST`) and skips `lock → update → check → activate`

Implementation should choose one behavior and keep it consistent across docs, runtime code, and tests. Preferred option is to require `sourceCode` for high-level `create()`.

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

Follows the same overall architectural pattern as `AdtAccessControl`, but the exact high-level create/update flow must be defined explicitly in this module spec and not inferred from the current `AdtAccessControl` implementation:

- Constructor: `connection`, `logger?`, `systemContext?`
- `objectType = 'Transformation'`
- All methods from `IAdtObject`: validate, create, read, readMetadata, readTransport, update, delete, activate, check, lock, unlock

### Operation Chains

- **Create:** validate → create → check (optional, if source exists) → lock → update (source) → read(longPolling) → unlock → check → activate (optional)
- **Update:** lock → check(inactive) → update → read(longPolling) → unlock → check → activate (optional)
- **Delete:** checkDeletion → delete

Notes:

- If `create()` allows missing `sourceCode`, it must stop after `create` and skip the source-related steps
- Pre-update check should run against the inactive version and may include the new source payload
- Final check should run after unlock
- If activation is enabled, an additional `read(longPolling)` after activation is recommended to wait until the object is ready

### Session Management

- Stateful only during lock/unlock
- Always restore stateless after operations and on error cleanup
- On error, if `lockHandle` exists, attempt explicit unlock first
- `setSessionType('stateless')` restores connection mode but does **not** replace an explicit unlock request

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
export const ACCEPT_TRANSFORMATION = 'application/vnd.sap.adt.transformations+xml';
export const CT_TRANSFORMATION = 'application/vnd.sap.adt.transformations+xml';
```

Source code read/write, lock, unlock, check, activation, deletion, validation — use existing shared content type constants.

If metadata reads need compatibility across system versions, `ACCEPT_TRANSFORMATION` may later be extended with fallback media types. `CT_TRANSFORMATION` should remain a single concrete media type.

If this module participates in negotiated header handling like other object types, follow the existing split between:

- `src/constants/contentTypes.ts` for low-level CRUD constants
- `src/core/shared/contentTypes.ts` for pluggable content-type providers

## Object Names

- Support both flat names (`ZOK_TRANS_0001`) and namespace names (`/RRR/XML_TEST`)
- Use existing `encodeSapObjectName()` for URL encoding
- Encode URL names as `encodeSapObjectName(name.toLowerCase())`
- Uppercase in XML payloads
- Preserve enum literal value of `transformationType` exactly as provided by config

## Environment Support

- Works on Cloud, On-Premise, and Legacy systems
- No environment-specific branching initially (may be added later)

## Read Semantics

- `read()` returns source code from `/source/main`
- `readMetadata()` returns object metadata from the base object URL
- `readTransport()` returns transport information from `/transport`
- Default read version is `inactive` unless a caller explicitly requests `active`
- `read()` should return `undefined` on `404 Not Found` instead of throwing

## Check and Validation Contract

- `check.ts` uses the shared `checkRun` infrastructure
- The spec must define which repository object type / URI is passed into the shared check payload for transformations
- Pre-update check runs against the inactive version
- Final check runs after unlock
- `validation.ts` uses `POST /sap/bc/adt/xslt/validation?objname=...`
- Validation request/response headers must be aligned with existing shared validation constants unless transformation-specific headers are proven necessary

Low-level helper signatures should document:

- input object name normalization rules
- whether source payload is included in pre-update check
- expected response shape for validation and check operations

## Testing (TDD)

Tests in `src/__tests__/integration/core/transformation/` — written **before** implementation of each operation.

- Test-first for each CRUD operation
- Cover both `SimpleTransformation` and `XSLTProgram` types
- Support namespace names in test objects
- Config section `transformations` in `test-config.yaml` to match existing plural object registries
- Idempotent: CREATE tests delete existing objects first
- Sequential execution (maxWorkers: 1)
- Add at least one standard flat-name test object and one namespace test object
- Add explicit test cases for:
  - create/update/read/delete of `SimpleTransformation`
  - create/update/read/delete of `XSLTProgram`
  - metadata read
  - transport read
  - validation
  - check flow before and after update

## State Contract

Prefer the existing `IAdtObjectState` conventions already used by other modules:

- `readResult` for source reads
- `metadataResult` for metadata reads
- `transportResult` for transport reads
- `checkResult`, `activateResult`, `deleteResult`, `unlockResult`, `createResult`, `updateResult`

`readSourceResult` should be added only if the module really needs a second, source-specific field beyond `readResult`. Otherwise, omit it to stay consistent with other object modules.

## Open Questions / Assumptions

- Assume `adtcore:type="XSLT/VT"` is valid for both `SimpleTransformation` and `XSLTProgram`
- Assume both transformation kinds share the same base endpoint and XML namespace
- Confirm whether validation endpoint and media-type behavior are identical on Cloud, On-Premise, and Legacy systems
- Confirm whether metadata read needs Accept negotiation or version fallback
- Confirm the exact shared-check object reference payload required by ADT for transformations

## Approach

Single module with `transformationType` parameter (Approach A). Both types share the same endpoint, XML namespace, and logic. The only difference is the `trans:transformationType` XML attribute value.
