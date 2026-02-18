# Architecture

## Overview

`@mcp-abap-adt/adt-clients` is a TypeScript package that provides ADT client APIs over a shared `IAbapConnection` abstraction.

Primary public entry points:
- `AdtClient` - high-level CRUD-style object operations.
- `AdtRuntimeClient` - stable runtime operations (debugger, traces, memory, dumps, logs, feeds, DDIC runtime helpers).
- `AdtRuntimeClientExperimental` - runtime APIs in progress (currently AMDP debugger/data preview).
- `AdtClientsWS` - WebSocket request/event facade.
- `AdtExecutor` - execution-oriented facade (currently class execution with optional profiling helpers).

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

## Source Layout

```text
src/
  clients/
    AdtClient.ts
    AdtRuntimeClient.ts
    AdtRuntimeClientExperimental.ts
    AdtClientsWS.ts
    DebuggerSessionClient.ts
    AdtExecutor.ts

  core/
    <object>/                 # class, program, package, table, ...
      Adt<Object>.ts          # IAdtObject implementation
      create.ts/read.ts/...   # low-level endpoint helpers
      types.ts
    shared/
      AdtUtils.ts             # cross-cutting non-CRUD utilities
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
- `getClass()`, `getProgram()`, `getInterface()`, `getDomain()`, `getDataElement()`, `getStructure()`, `getTable()`, `getTableType()`, `getView()`
- `getFunctionGroup()`, `getFunctionModule()`, `getPackage()`, `getServiceDefinition()`
- `getBehaviorDefinition()`, `getBehaviorImplementation()`, `getMetadataExtension()`, `getEnhancement()`
- `getUnitTest()`, `getCdsUnitTest()`, `getRequest()`
- class include helpers: `getLocalTestClass()`, `getLocalTypes()`, `getLocalDefinitions()`, `getLocalMacros()`
- utilities: `getUtils()`

Each object module encapsulates its ADT endpoint specifics in `core/<object>/*.ts`, while `Adt<Object>.ts` provides an `IAdtObject` workflow API.

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
- execution (`getWhereUsed`) and parsed convenience (`getWhereUsedList`).

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

Package root (`src/index.ts`) exports:
- client classes (`AdtClient`, runtime/ws/executor clients),
- selected runtime/debugger types,
- object config/state/type definitions,
- shared utility type unions (`AdtObjectType`, `AdtSourceObjectType`, ...),
- core interfaces re-exported from `@mcp-abap-adt/interfaces`.

Internal low-level helpers are intentionally not part of root API.

## Testing Architecture

Current test setup:
- Jest + `ts-jest`, roots at `src/`.
- Integration-heavy strategy against real SAP ADT system.
- Sequential execution enforced (`maxWorkers: 1`, `maxConcurrency: 1`) to avoid shared-object contention.
- `src/__tests__/helpers/BaseTester.ts` provides reusable flow/read test orchestration.
- Integration type-check is part of `pretest`.

## Extension Rules for New Features

When adding a new ADT object type:
1. Create `src/core/<object>/` low-level endpoint modules and types.
2. Implement `Adt<Object>.ts` as `IAdtObject` facade.
3. Add factory method in `AdtClient`.
4. Export public types in `src/index.ts`.
5. Add integration tests under `src/__tests__/integration/core/<object>/`.
6. Keep stateful/lock cleanup semantics consistent.

When adding runtime APIs:
1. Add pure functions in `src/runtime/<domain>/`.
2. Expose via `AdtRuntimeClient` (stable) or `AdtRuntimeClientExperimental` (in-progress).
3. Add unit/integration tests depending on endpoint safety and availability.
