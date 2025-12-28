# Architecture

## Overview

`@mcp-abap-adt/adt-clients` provides a builderless API for SAP ADT operations:

- `AdtClient` for object CRUD and utility access.
- `AdtRuntimeClient` for runtime/debug/traces/logs.
- `AdtUtils` for cross-cutting utilities (search, where-used, discovery, etc.).

All external interactions are through interfaces from `@mcp-abap-adt/interfaces`.

## High-Level Flow

1. Consumers create a connection via `@mcp-abap-adt/connection`.
2. `AdtClient` exposes `getClass()`, `getProgram()`, `getView()`, etc.
3. Each getter returns an `Adt*` object implementing `IAdtObject`.
4. `Adt*` objects call low-level functions in `src/core/*` which call ADT endpoints.
5. Shared utilities are accessed via `client.getUtils()` (AdtUtils).

## Project Structure

```
src/
  clients/
    AdtClient.ts
    AdtRuntimeClient.ts
  core/
    class/                  # AdtClass + low-level functions
    program/
    interface/
    functionGroup/
    functionModule/
    table/
    structure/
    view/
    domain/
    dataElement/
    package/
    serviceDefinition/
    behaviorDefinition/
    behaviorImplementation/
    metadataExtension/
    transport/
    unitTest/
    shared/                 # AdtUtils + shared utilities
  utils/
```

## Clients

### AdtClient

- High-level CRUD operations for ADT objects.
- Factory accessors: `client.getClass()`, `client.getProgram()`, `client.getView()`, etc.
- Utilities: `client.getUtils()`.

### AdtRuntimeClient

- Runtime-only operations (debugger, logs, traces, memory analysis, etc.).

## Adt Objects

Each `Adt*` object implements `IAdtObject<TConfig, TState>` with methods:

- `validate`, `create`, `read`, `readMetadata`, `readTransport`, `update`, `delete`, `activate`, `check`.
- Long polling is supported in read operations with `withLongPolling` where applicable.
- Operation results are stored in the returned state (`validationResponse`, `createResult`, `updateResult`, `checkResult`, etc.).

## Shared Utilities (AdtUtils)

`AdtUtils` provides cross-cutting endpoints that are not per-object CRUD:

- Discovery, search, where-used, object structure, node structure.
- SQL query, table contents, virtual folders.
- Group activation/deletion, inactive objects.
- Object metadata/source helpers for internal use.

Where-used flow in `AdtUtils`:
- Step 1: `getWhereUsedScope` fetches scope XML (available object types + defaults).
- Optional: `modifyWhereUsedScope` tweaks the XML locally (no ADT call).
- Step 2: `getWhereUsed` executes the search using the scope (defaults if omitted).

## Accept Negotiation

ADT endpoints can return different `Accept` requirements across systems. To reduce 406 failures, the client can optionally
negotiate `Accept` headers by retrying with supported values returned in the 406 response.

Behavior:
- Disabled by default.
- When enabled, `makeAdtRequest` is wrapped to intercept 406 responses and retry once with supported `Accept` values.
- The supported values are cached per method+URL to avoid repeated 406s.
- The retry is scoped to the same endpoint and request; other errors are rethrown.

Configuration:
- Constructor option: `enableAcceptCorrection` on `AdtClient` and `AdtRuntimeClient`.
- Environment override: `ADT_ACCEPT_CORRECTION=true` (applied when no explicit option is provided).

Per-call overrides:
- Read operations accept `ReadOptions` with `accept?: string` to override the default `Accept` for a specific request.

## Testing

- Integration tests live in `src/__tests__/integration/*`.
- `BaseTester` provides standardized workflows for create/update/delete and read.
- Read-only coverage is in `integration/readonly` and shared utilities in `integration/shared`.

## Logging

- `DEBUG_CONNECTORS` for connection-level logs.
- `DEBUG_ADT_LIBS` for library-level logs.
- `DEBUG_ADT_TESTS` for integration test logs.

See `docs/usage/DEBUG.md` for details.
