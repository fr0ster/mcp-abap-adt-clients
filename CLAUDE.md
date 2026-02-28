# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Requirements

- All repository artifacts (source code, documentation, comments, commit messages) must be written in English
- Direct communication with the user must be in the user's language

## Project Overview

**mcp-abap-adt-clients** (`@mcp-abap-adt/adt-clients`) is a TypeScript library providing ADT (ABAP Development Tools) clients for SAP ABAP systems. It offers both read-only and CRUD operations for SAP ABAP ADT objects through REST API. Node.js >=18, CommonJS output, strict TypeScript.

## Common Commands

```bash
# Build
npm run build           # Clean, lint check, and compile TypeScript
npm run build:fast      # TypeScript compile only (skip linting)

# Lint & Format (Biome, not ESLint)
npm run lint            # Lint and auto-fix with Biome
npm run lint:check      # Lint check only (no fixes)
npm run format          # Format code with Biome

# Test (requires .env with SAP credentials + src/__tests__/helpers/test-config.yaml)
npm test                        # Run all tests sequentially (maxWorkers=1)
npm test -- integration/class   # Run tests for specific object type
npm test -- e2e                 # Run end-to-end tests (excluded from default run)
DEBUG_TESTS=true npm test -- integration/class   # With connection debug logs
DEBUG_ADT_TESTS=true npm test -- integration/view # With ADT operation logs

# Type-check tests without running
npm run test:check              # All test tsconfigs
npm run test:check:integration  # Integration tests only (runs as pretest)
```

## Architecture

### Client Classes (`src/clients/`)

- **AdtClient** (`AdtClient.ts`): High-level CRUD operations via factory methods (`getClass()`, `getProgram()`, `getPackage()`, `getView()`, `getTable()`, etc.). Each method returns an `IAdtObject<Config, State>` handler. Also: `getUtils()` for shared operations, `getLocalTestClass()`/`getLocalTypes()`/`getLocalDefinitions()`/`getLocalMacros()` for class includes.
- **AdtRuntimeClient** (`AdtRuntimeClient.ts`): Runtime operations — profiler traces, cross-traces, debugger, application logs, ATC logs, runtime dumps, feeds, DDIC activation graph.
- **AdtExecutor** (`AdtExecutor.ts`): Program/class execution with optional profiling — `getClassExecutor()`, `getProgramExecutor()`.
- **AdtClientsWS** (`AdtClientsWS.ts`): WebSocket facade (request/response + event model) wrapping `IWebSocketTransport`.
- **Batch clients** (`AdtClientBatch`, `AdtRuntimeClientBatch`): Mirror main clients but collect requests into `multipart/mixed` batch via `BatchRecordingConnection`.

All clients accept `IAbapConnection` + `ILogger`. Optional: `options.enableAcceptCorrection` for automatic `Accept` header negotiation on HTTP 406.

### Core Modules (`src/core/`)

22 object-type modules (class, program, interface, view, table, structure, domain, dataElement, package, functionGroup, functionModule, accessControl, serviceDefinition, service, behaviorDefinition, behaviorImplementation, metadataExtension, enhancement, tabletype, transport, unitTest). Each follows this structure:

- `AdtXxx.ts` — High-level class implementing `IAdtObject<Config, State>`
- `types.ts` — `IXxxConfig` (camelCase, public API) and `IXxxState` (operation results, errors array) and `ICreateXxxParams` (snake_case, low-level internal)
- `create.ts`, `read.ts`, `update.ts`, `delete.ts` — Low-level CRUD functions that build XML, set headers, call `connection.makeAdtRequest()`
- `lock.ts`, `unlock.ts` — Session management (lock returns `LOCK_HANDLE`)
- `activation.ts`, `check.ts`, `validation.ts` — Supporting operations
- `index.ts` — Re-exports public API of the module

**Shared module** (`src/core/shared/AdtUtils.ts`): Large utility class (~1000 lines) — search, where-used, package hierarchy, SQL queries, inactive objects, group activation/deletion, discovery, type info, virtual folders, etc.

### Design Patterns

**Factory + Handler Pattern**: `AdtClient` creates object-specific handlers that manage operation chains automatically.

**Operation Chains**: Handlers orchestrate multi-step operations:
- Create: validate → create → check → lock → update → unlock → activate
- Update: lock → check → update → unlock → activate
- Delete: check(deletion) → delete

Error handling in chains: automatic unlock + `setSessionType('stateless')` on any failure. `lockHandle` is always preserved for cleanup.

**Session Management**: Handlers toggle between stateful (during lock) and stateless modes automatically via `connection.setSessionType()`.

**Interface-Only Communication**: All code depends on `IAbapConnection` interface, not concrete implementations. `@mcp-abap-adt/connection` (dev dependency) provides the concrete implementation, used only in tests.

### Supporting Layers

- **Batch** (`src/batch/`): `BatchRecordingConnection` proxies `IAbapConnection`, collects requests, builds `multipart/mixed` payload, parses batch response and resolves deferred promises.
- **Accept Negotiation** (`src/utils/acceptNegotiation.ts`): On HTTP 406, extracts supported content types from response, caches correct `Accept` per URL, retries. Wraps `connection.makeAdtRequest`.
- **Runtime** (`src/runtime/`): Debugger, memory snapshots, profiler traces, application logs, runtime dumps — each in its own subfolder.
- **Executors** (`src/executors/`): Class/program execution with profiling support.
- **Cloud vs On-premise** (`src/utils/systemInfo.ts`): `getSystemInformation()` and `isCloudEnvironment()` — some operations differ between SAP Cloud and on-premise systems.

## Code Standards

- All code, comments, error messages in English
- Comments explain "why" not "what"
- Never change `package.json` version without explicit user request
- When updating CHANGELOG, ask user which version to use
- Biome config: single quotes, semicolons always, indent 2 spaces
- `noExplicitAny: warn` in production code, relaxed in tests

## Testing Notes

- All tests are integration tests against real SAP systems (no mocks); unit tests exist but are minimal (`src/__tests__/unit/`)
- Tests require `.env` with SAP credentials (`SAP_URL`, `SAP_USERNAME`, `SAP_PASSWORD`, `SAP_CLIENT`) and `src/__tests__/helpers/test-config.yaml` with object names and parameters
- `TestConfigResolver` resolves params with priority: `testCase.params` > `environment.default_*` > `SAP_*` env vars
- Tests are idempotent: CREATE tests delete existing objects first; other tests create missing objects
- Only user-defined objects (Z_/Y_ prefix) can be modified in tests
- Tests run sequentially (`maxWorkers: 1`, `maxConcurrency: 1`) to avoid conflicts with shared SAP objects; timeout is 15 minutes
- E2E tests (`src/__tests__/e2e/`) focus on session/lock persistence and crash recovery; excluded from default test run
- Test structure mirrors core: `src/__tests__/integration/core/{objectType}/`

## Key Dependencies

- `@mcp-abap-adt/interfaces` — All interfaces (`IAbapConnection`, `IAdtObject`, `IAdtResponse`, `IWebSocketTransport`, etc.)
- `@mcp-abap-adt/logger` — Logging interface
- `fast-xml-parser` — XML parsing for ADT responses
- `axios` — HTTP client (used internally by connection layer)
- `@mcp-abap-adt/connection` — **dev only** — concrete `IAbapConnection` implementation for tests

## Public API (`src/index.ts`)

Exports all client classes, batch classes, all `IXxxConfig`/`IXxxState` types for every object type, shared types (`AdtObjectType`, `ObjectReference`, `PackageHierarchyNode`, `WhereUsedListResult`, `SearchObjectsParams`, etc.), and `AdtService`/`AdtServiceBinding` classes.
