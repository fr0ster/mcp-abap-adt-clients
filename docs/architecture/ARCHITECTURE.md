# Architecture

## Overview

`@mcp-abap-adt/adt-clients` is a TypeScript package that provides ADT client APIs over a shared `IAbapConnection` abstraction.

Primary public entry points:
- `AdtClient` - high-level CRUD-style object operations.
- `AdtClientLegacy` - extends `AdtClient` for legacy systems (BASIS < 7.50): blocks unsupported types, uses legacy deletion and versionless content types.
- `createAdtClient()` - factory that auto-detects system version and returns `AdtClient` or `AdtClientLegacy`.
- `AdtRuntimeClient` - stable runtime operations (debugger, traces, dumps, logs, feeds, DDIC runtime helpers).
- `AdtRuntimeClientExperimental` - runtime APIs in progress (currently AMDP debugger/data preview).
- `AdtClientsWS` - WebSocket request/event facade.
- `AdtExecutor` - execution-oriented facade (currently class execution with optional profiling helpers).
- `AdtAbapGitClient` - standalone client (not a factory on `AdtClient`) wrapping the SAP-official ADT-integrated abapGit (`/sap/bc/adt/abapgit/*`); available on cloud and modern on-prem (ABAP Platform 2022+).

Design constraint:
- External integrations are interface-driven via `@mcp-abap-adt/interfaces` (`IAbapConnection`, `ILogger`, `IAdtObject`, `IWebSocketTransport`, etc.).

## Layered Structure

```text
Consumer code
  -> AdtClient / AdtRuntimeClient / AdtClientsWS / AdtExecutor
    -> core/* object modules + core/shared (AdtUtils)
    -> runtime/* endpoint functions
    -> executors/* orchestration helpers
      -> utils/* cross-cutting helpers (timeouts, accept negotiation, parsers)
        -> IAbapConnection.makeAdtRequest(...) / IWebSocketTransport
          -> SAP ADT endpoints
```

## Legacy System Support

Legacy SAP systems (BASIS < 7.50) are supported through `AdtClientLegacy` and per-object `*Legacy` handler classes. The factory `createAdtClient()` auto-detects the system version and returns the appropriate client.

Key differences: versionless content types, direct DELETE (no `/deletion/` API), limited object type support (no DDIC dedicated endpoints).

See [LEGACY.md](LEGACY.md) for the complete support matrix and RFC transport details.

## Source Layout

```text
src/
  clients/
    AdtClient.ts
    AdtClientLegacy.ts
    createAdtClient.ts
    AdtRuntimeClient.ts
    AdtRuntimeClientExperimental.ts
    AdtClientsWS.ts
    DebuggerSessionClient.ts
    AdtExecutor.ts

  core/
    <object>/                 # class, program, package, table, ...
      Adt<Object>.ts          # IAdtObject implementation
      Adt<Object>Legacy.ts    # Legacy override (optional, for supported types)
      create.ts/read.ts/...   # low-level endpoint helpers
      types.ts
    shared/
      AdtUtils.ts             # cross-cutting non-CRUD utilities
      contentTypes.ts         # AdtContentTypesBase / AdtContentTypesModern
      deleteLegacy.ts         # direct DELETE for legacy systems
      *.ts                    # discovery, search, where-used, etc.

  runtime/
    debugger/
    traces/
    memory/
    dumps/
    feeds/
    applicationLog/
    atc/
    ddic/

  executors/
    class/ClassExecutor.ts

  utils/
    acceptNegotiation.ts
    readOperations.ts
    validation.ts
    managementOperations.ts
    internalUtils.ts
    ...
```

## Public API Architecture

### 1) `AdtClient` (object facade)

`AdtClient` is a factory of `IAdtObject` implementations and returns a new instance per call:
- `getClass()`, `getProgram()`, `getInterface()`, `getDomain()`, `getDataElement()`, `getStructure()`, `getTable()`, `getTableType()`, `getDdl()` (DDL sources — CDS views, AMDP table functions; formerly `getView()`)
- `getFunctionGroup()`, `getFunctionModule()`, `getFunctionInclude()`, `getPackage()`, `getServiceDefinition()`
- `getScalarFunction()` (CDS scalar function, `DSFD/SCF`), `getScalarFunctionImplementation()` (scalar function implementation, `DSFI/SFI`), `getAppendStructure()` (append structure, `TABL/DS`)
- `getAuthorizationField()` for SUSO / AUTH authorization-field CRUD (modern on-prem and cloud only)
- `getFeatureToggle()` for FTG2/FT feature-toggle CRUD plus domain methods (switchOn, switchOff, getRuntimeState, checkState, readSource); modern on-prem and cloud only
- `getServiceBinding()` for RAP BO service binding CRUD + lifecycle
- `getBehaviorDefinition()`, `getBehaviorImplementation()`, `getMetadataExtension()`, `getEnhancement()`
- `getUnitTest()`, `getCdsUnitTest()`, `getRequest()`
- class include helpers: `getLocalTestClass()`, `getLocalTypes()`, `getLocalDefinitions()`, `getLocalMacros()`
- utilities: `getUtils()`

Each object module encapsulates its ADT endpoint specifics in `core/<object>/*.ts`, while `Adt<Object>.ts` provides an `IAdtObject` workflow API.

`ServiceBinding` follows the same factory pattern and exposes CRUD with ADT-specific lifecycle behavior:
- `create` includes binding-type discovery and generation flow
- `update` performs publish/unpublish transition with allowed-action validation
: publication endpoints are executed as `POST` jobs with ADT `objectReferences` payload
- `delete` uses ADT deletion API (`POST /sap/bc/adt/deletion/delete`)
: if binding is published, delete flow executes unpublish pre-step before deletion

### 2) `AdtRuntimeClient` / `AdtRuntimeClientExperimental`

Runtime clients are facades over pure runtime functions in `src/runtime/*`.
- `AdtRuntimeClient`: stable APIs.
- `AdtRuntimeClientExperimental`: extends stable runtime client and adds AMDP-in-progress APIs.

### 3) `AdtClientsWS`

WebSocket abstraction around `IWebSocketTransport`:
- request/response with correlation IDs and timeout-based pending map.
- event dispatch for unsolicited messages.
- debugger session convenience facade via `DebuggerSessionClient`.

### 4) `AdtExecutor`

Execution-oriented facade (`getClassExecutor()` currently):
- simple run of class execution target.
- run with existing profiler.
- run with profiling bootstrap + trace ID resolution flow.

## Object Workflow Pattern (`IAdtObject`)

Object implementations follow a common shape:
- `validate`, `create`, `read`, `readMetadata`, `readTransport`, `update`, `delete`, `activate`, `check`.
- typed `config` input + typed state/result object.
- low-level mode for update in many objects when `options.lockHandle` is supplied.

Typical update flow (object-dependent):
1. Lock object in stateful session.
2. Check inactive/source where required.
3. Update source/XML.
4. Unlock.
5. Optional post-check/activate depending on options and implementation.

## Session and Locking Model

Critical conventions used across object modules:
- Session type switches through `connection.setSessionType('stateful' | 'stateless')`.
- Lock endpoints return `lockHandle`, which must be passed to update/unlock/delete flows.
- Stateful mode is scoped to lock-sensitive operations; code resets to stateless in success/error paths.
- Long polling is supported on read-related endpoints where ADT supports `withLongPolling=true`.

## Cross-Cutting Utilities (`AdtUtils`)

`AdtUtils` (in `core/shared/AdtUtils.ts`) covers non-object CRUD operations:
- discovery, search, where-used (including scope workflow), object/node/package structures.
- SQL query and table contents.
- group activation/deletion and inactive objects.
- source/metadata helpers for supported object types.

Notably, where-used supports:
- scope fetch (`getWhereUsedScope`),
- local scope mutation (`modifyWhereUsedScope`),
- execution (`getWhereUsed`) and parsed convenience (`getWhereUsedList`),
- type filtering via `getWhereUsedList({ enableOnlyTypes, disableTypes })` — applied server-side through the `/usageReferences/scope` sub-resource where available, otherwise (some S/4 releases 404 that resource) the search falls back to unscoped and the filter is applied to the parsed references client-side. Either way the caller receives only the selected object types.

## Accept Negotiation (406 Recovery)

`src/utils/acceptNegotiation.ts` provides optional request retry for ADT `406 Not Acceptable` cases:
- Can wrap `connection.makeAdtRequest` once per connection.
- Extracts supported accept values from headers/body.
- Retries once with corrected `Accept` and caches per `METHOD + URL`.
- Enabled by constructor option `enableAcceptCorrection` or env var `ADT_ACCEPT_CORRECTION=true`.

## Error and Response Handling

Common behaviors in implementations:
- Preserve raw ADT responses for caller inspection.
- Parse XML responses where lock handles/run states are needed.
- Enrich thrown errors with operation context/status in many modules.
- Some `read` methods return `undefined` for `404` (object-not-found semantics).

## Type System and Exports

**Types are defined once, in `@mcp-abap-adt/interfaces` (`^11.0.0`).** As of 7.5.0 this package declares no type it shares with the contract package. Each `src/core/<object>/types.ts` is a re-export surface:

```ts
export type {
  ICreateClassParams,
  IClassConfig,
  IClassState,
} from '@mcp-abap-adt/interfaces';
```

Rationale: the two packages previously held independent copies of the same interfaces, and they drifted silently — a field required on one side and optional on the other produced no error anywhere. A single definition site makes that class of bug impossible.

Package root (`src/index.ts`) exports:
- client classes (`AdtClient`, runtime/ws/executor clients),
- selected runtime/debugger types,
- object config/state/type definitions (re-exported from interfaces),
- shared utility type unions (`AdtObjectType`, `AdtSourceObjectType`, ...) — likewise re-exported,
- core interfaces re-exported from `@mcp-abap-adt/interfaces`.

What stays declared locally, and why:
- **Runtime (value) exports** — these are code, not contract: `ENHANCEMENT_TYPE_CODES` and the enhancement URL helpers (`src/core/enhancement/types.ts`), `resolveBindingVariant` / `SERVICE_BINDING_VARIANT_MAP` (`src/core/service/types.ts`).
- **`IAdtClientOptions`** — describes this client's constructor, not the wire contract.

Internal low-level helpers are intentionally not part of root API.

## Testing Architecture

Current test setup:
- Jest + `ts-jest`, roots at `src/`.
- Integration-heavy strategy against real SAP ADT system.
- Sequential execution enforced (`maxWorkers: 1`, `maxConcurrency: 1`) to avoid shared-object contention.
- `src/__tests__/helpers/BaseTester.ts` provides reusable flow/read test orchestration.
- Integration type-check is part of `pretest`.

Runtime coverage snapshot:
- `runtime/dumps`:
  - unit: `src/__tests__/unit/runtime/dumps/read.test.ts`
  - client delegation unit: `src/__tests__/unit/clients/AdtRuntimeClient.dumps.test.ts`
  - integration: `src/__tests__/integration/runtime/dumps/RuntimeDumps.test.ts`
- `runtime/traces/profiler`:
  - unit: `src/__tests__/unit/runtime/traces/profiler.test.ts`
  - integration (execution + trace analysis path): `src/__tests__/integration/executors/class/ClassExecutor.test.ts`
- `runtime/memory/snapshots`:
  - unit: `src/__tests__/unit/runtime/memory/snapshots.test.ts`
  - note: public client exposure is deferred pending additional ADT compatibility validation
- `runtime/debugger`:
  - unit: `src/__tests__/unit/runtime/debugger/abap.batch.test.ts`
  - integration WS/session: `src/__tests__/integration/runtime/debugger/DebuggerSessionWS.test.ts`

## Extension Rules for New Features

When adding a new ADT object type:
1. **Define the types in `@mcp-abap-adt/interfaces` first**, release it, then consume it here. Do not declare params/config/state locally — that is what caused the drift resolved in 7.5.0. `src/core/<object>/types.ts` should contain only re-exports (plus any genuine runtime helpers).
2. Create `src/core/<object>/` low-level endpoint modules.
3. Implement `Adt<Object>.ts` as `IAdtObject` facade.
4. Add factory method in `AdtClient`.
5. Export public types in `src/index.ts`.
6. Add integration tests under `src/__tests__/integration/core/<object>/`.
7. Keep stateful/lock cleanup semantics consistent.

When adding runtime APIs:
1. Add pure functions in `src/runtime/<domain>/`.
2. Expose via `AdtRuntimeClient` (stable) or `AdtRuntimeClientExperimental` (in-progress).
3. Add unit/integration tests depending on endpoint safety and availability.
