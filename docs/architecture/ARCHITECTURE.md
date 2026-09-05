# Architecture

## Overview

`@mcp-abap-adt/adt-clients` is a TypeScript package that provides ADT client APIs over a shared `IAbapConnection` abstraction.

Primary public entry points:
- `AdtClient` - high-level CRUD-style object operations.
- `AdtClientLegacy` - extends `AdtClient` for legacy systems (BASIS < 7.50): blocks unsupported types, uses legacy deletion and versionless content types.
- `createAdtClient()` - factory that auto-detects system version and returns `AdtClient` or `AdtClientLegacy`.
- `AdtRuntimeClient` - stable runtime operations (debugger, traces, dumps, logs, feeds, ATC check runs, DDIC runtime helpers).
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

### 2) `AdtRuntimeClient`

Runtime clients are facades over pure runtime functions in `src/runtime/*`.
- `AdtRuntimeClient`: stable APIs.

Runtime accessors return handlers narrowed to what the subject actually
supports, rather than a uniform object interface. `getAtc()` is the clearest
case: a check run is run and then read, never created, locked, activated or
versioned, so `AdtAtc` declares `IAdtRunnable` plus `IAtcRunStatusReadable` and
`IAtcFindings` — three capabilities and no more. `src/runtime/atc/` holds both
it and `AtcLog`, which reads the execution and check-failure logs: the same
subject at different resources, and neither takes the other's identifier.

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

Every member answers `IAdtResponse<T>` — a result or a failure, never both and
never neither. Two strategies decide what that is, and the order is fixed:

1. **The error strategy** (`analyse`, per call) decides whether the answer is a
   failure at all. It is asked first, so a reading is never handed a refusal to
   make a value out of. The shipped defaults read what ADT delivers inside a 200
   — `deletionRefusal`, `activationRefusal`, `validationUnsupported`,
   `validationSeverity`, `testDoublesVerdict`, `startedRun` — because nothing
   below the contract can tell those from a success.
2. **The result strategy** (injected into the implementation once, at
   construction) decides what a non-failure becomes. Defaults ship per object
   type as `<type>Documents`.

`IAdtError.origin` has two values and both describe the server: `'refusal'` (SAP
answered no) and `'connection'` (no answer arrived). A document *this library*
cannot read is neither — it throws `AdtParseError` as itself, because calling it
a verdict about SAP points a caller at a system that answered correctly. A
consumer's own reading throwing is the same case and is left untouched.

Common behaviors in implementations:
- Preserve raw ADT responses for caller inspection — the failure half carries
  `response` whole, and the shipped readings default to the document.
- Parse XML responses where lock handles/run states are needed.
- A caller error — a missing required name, a view a family does not have —
  throws before any request. It is not a verdict about a server that was never
  asked anything.
- `chain()` is the resource scope for multi-step operations: `onScopeEnd` runs
  cleanup on every path (success included), `onFailure` runs a rollback only
  when the chain fails, and both unwind in reverse order of registration.

## Type System and Exports

**Types are defined once, in `@mcp-abap-adt/interfaces` (`^17.1.0`).** As of 7.5.0 this package declares no type it shares with the contract package. Each `src/core/<object>/types.ts` is a re-export surface:

```ts
export type { ICreateClassParams, IClassConfig } from '@mcp-abap-adt/interfaces';
```

The `IXxxState` half of every pair is gone: a member answers one value and a
failure, and neither is a state bag. Each `types.ts` now also declares what the
contract does **not** carry — the module's `IXxxResults` strategy set and the
`<type>Documents` default that satisfies it, next to the shapes those readings
build. A contract carries what is needed to use or replace it; a shape a
replacement reading would not produce is neither.

Rationale: the two packages previously held independent copies of the same interfaces, and they drifted silently — a field required on one side and optional on the other produced no error anywhere. A single definition site makes that class of bug impossible.

**Honest capability types (8.0.0, finished in 12.0.0).** The fat `IAdtObject` contract is split into capability atoms in `@mcp-abap-adt/interfaces` (`IAdtCreatable`, `IAdtReadable`, `IAdtUpdatable`, `IAdtDeletable`, `IAdtValidatable`, `IAdtCheckable`, `IAdtActivatable`, `IAdtLockable`, `IAdtVersionable`, `IAdtTransportAware`), with `IAdtModifiable`/`IAdtCrud` as composites and `IAdtSourceObject` as the one named full set. Each `Adt<Object>` class `implements` only the atoms it genuinely supports, and `AdtClient.getXxx()` return types are narrowed to that honest set, so calling a capability a handler lacks (`getDomain().getVersions()`) is a compile error rather than a runtime throw.

Since **12.0.0** the claim is enforced rather than asserted. Every stub that threw is gone — not narrowed, deleted — including the last three handlers whose composites lived in the interfaces package (`transport`, `featureToggle`, `serviceBinding`). Four class-include handlers lost `create()`, because an include is not created: it exists because its class does, and writing source into it is `update`. They no longer extend `AdtClass` either — a shared `AdtClassMemberBase` gives them the container's lock, activation, metadata, transport and include version history and nothing else, so their declared type and their runtime shape agree.

A guard under `src/__tests__/unit/capabilities/` holds the line: a manifest authored from ADT rather than from the code, a compile-time comparison of all 36 factory return types against the 10 atoms **in both directions**, a completeness check over both clients' prototype chains, and a behavioural pass that calls every method of every claimed capability against a recording connection and asserts it issues the request its capability names — the verb included, since a chain that locks, reads and unlocks without ever writing issues three requests and none of them the one that matters.

Package root (`src/index.ts`) exports:
- client classes (`AdtClient`, runtime/ws/executor clients),
- selected runtime/debugger types,
- object config/type definitions (re-exported from interfaces),
- the injection surface (`src/index.readings.ts`): the strategy implementations,
  one `IXxxResults` + `<type>Documents` pair per object type, and the shapes the
  shipped readings build,
- shared utility type unions (`AdtObjectType`, `AdtSourceObjectType`, ...) — likewise re-exported,
- core interfaces re-exported from `@mcp-abap-adt/interfaces`.

What stays declared locally, and why:
- **Runtime (value) exports** — these are code, not contract: `ENHANCEMENT_TYPE_CODES` and the enhancement URL helpers (`src/core/enhancement/types.ts`), `resolveBindingVariant` / `SERVICE_BINDING_VARIANT_MAP` (`src/core/service/types.ts`).
- **`AdtContentTypesBase` / `AdtContentTypesModern`** — the two shipped header-set implementations (354 lines, 38 methods). They `implements IAdtContentTypes` from `@mcp-abap-adt/interfaces`; the interface itself is not declared here.

**Contract consolidation (11.0.0).** As of 11.0.0 adt-clients declares no contract type at all, not even the ones a consumer needs only to configure or call this package's own clients: `IAdtClientOptions`, `IAdtSystemContext`, `IAdtContentTypes`, `IAdtHeaders`, the three `IBatch*` shapes, the twelve abapGit types, the ten executor types, and the five debugger types all moved to `@mcp-abap-adt/interfaces`. Import them from there; the names and shapes are unchanged. Internal low-level helpers are intentionally not part of root API.

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
2. Expose via `AdtRuntimeClient`.
3. Add unit/integration tests depending on endpoint safety and availability.
