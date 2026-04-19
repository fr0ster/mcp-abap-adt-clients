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
# IMPORTANT: Always save full log first, then analyze. Never pipe through grep/tail/head.
npm test 2>&1 | tee test-run.log                  # Run all tests, save log
npm test -- integration/class 2>&1 | tee test-run.log   # Tests for specific object type
npm test -- e2e 2>&1 | tee test-run.log            # End-to-end tests (excluded from default run)
npm run shared:setup 2>&1 | tee shared-setup.log   # Create shared dependencies
DEBUG_TESTS=true npm test -- integration/class 2>&1 | tee test-run.log   # With connection debug logs
DEBUG_ADT_TESTS=true npm test -- integration/view 2>&1 | tee test-run.log # With ADT operation logs

# Type-check tests without running
npm run test:check              # All test tsconfigs
npm run test:check:integration  # Integration tests only (runs as pretest)
```

## Architecture

### Client Classes (`src/clients/`)

- **AdtClient** (`AdtClient.ts`): High-level CRUD operations via factory methods (`getClass()`, `getProgram()`, `getPackage()`, `getView()`, `getTable()`, etc.). Each method returns an `IAdtObject<Config, State>` handler. Also: `getUtils()` for shared operations, `getLocalTestClass()`/`getLocalTypes()`/`getLocalDefinitions()`/`getLocalMacros()` for class includes.
- **AdtRuntimeClient** (`AdtRuntimeClient.ts`): Runtime operations exposed via factory accessors — `getProfiler()`, `getCrossTrace()`, `getSt05Trace()`, `getDebugger()` (composite: `getAbap()`, `getAmdp()`, `getMemorySnapshots()`), `getApplicationLog()`, `getAtcLog()`, `getDdicActivation()`, `getDumps()`, `getFeeds()` (FeedRepository), `getSystemMessages()`, `getGatewayErrorLog()`.
- **AdtExecutor** (`AdtExecutor.ts`): Program/class execution with optional profiling — `getClassExecutor()`, `getProgramExecutor()`.
- **AdtClientsWS** (`AdtClientsWS.ts`): WebSocket facade (request/response + event model) wrapping `IWebSocketTransport`.
- **AdtAbapGitClient** (`AdtAbapGitClient.ts`): Standalone client for SAP-official ADT-integrated abapGit (`/sap/bc/adt/abapgit/*`). Seven public methods — link, pull (async with abort/timeout + lastKnownStatus recovery), unlink (`/repos/{key}`), listRepos, getRepo, getErrorLog, checkExternalRepo. Not a factory on AdtClient — consumers `new` it directly per the "AdtClient = IAdtObject-only" architectural rule. Available on cloud + modern on-prem (ABAP Platform 2022+).
- **Batch clients** (`AdtClientBatch`, `AdtRuntimeClientBatch`): Mirror main clients but collect requests into `multipart/mixed` batch via `BatchRecordingConnection`.

All clients accept `IAbapConnection` + `ILogger`. Optional: `options.enableAcceptCorrection` for automatic `Accept` header negotiation on HTTP 406.

### Core Modules (`src/core/`)

25 object-type modules (class, program, interface, view, table, structure, domain, dataElement, package, functionGroup, functionModule, functionInclude, accessControl, serviceDefinition, service, behaviorDefinition, behaviorImplementation, metadataExtension, enhancement, tabletype, transport, unitTest, authorizationField, featureToggle). Each follows this structure:

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
- After changing the version in `package.json`, always run `npm install --package-lock-only` to update `package-lock.json` and include it in the same commit
- All dependencies must resolve from npm registry only. No local links or symlinks (`"link": true`) in `package-lock.json`. Sibling repos exist in parent directory — npm may auto-link them. Always verify after `npm install`.
- Biome config: single quotes, semicolons always, indent 2 spaces
- `noExplicitAny: warn` in production code, relaxed in tests

## Testing Notes

- All tests are integration tests against real SAP systems (no mocks); unit tests exist but are minimal (`src/__tests__/unit/`)
- Tests require `.env` with SAP credentials (`SAP_URL`, `SAP_USERNAME`, `SAP_PASSWORD`, `SAP_CLIENT`) and `src/__tests__/helpers/test-config.yaml` with object names and parameters. For non-unicode legacy systems add `SAP_UNICODE=false` (controls `text/plain` vs `text/plain; charset=utf-8` in checkRun payloads)
- **Test config setup**: `npm run test:init` (or `cp src/__tests__/helpers/test-config.yaml.template src/__tests__/helpers/test-config.yaml`). Template works out of the box — edit only lines marked `# ← CHANGE`: `default_package`, `default_transport`, `default_master_system`, `shared_dependencies.super_package`. On-prem package tests also need `transport_layer`.
- **Root package prerequisite**: The package specified in `default_package` (e.g., `ZADT_BLD_PKG03`) must be created manually in the SAP system before running tests. Tests do not create this package — they only create objects inside it.
- `TestConfigResolver` resolves params with priority: `testCase.params` > `environment.default_*` > `SAP_*` env vars
- Tests are idempotent: CREATE tests delete existing objects first; other tests create missing objects
- Only user-defined objects (Z_/Y_ prefix) can be modified in tests
- Tests run sequentially (`maxWorkers: 1`, `maxConcurrency: 1`) to avoid conflicts with shared SAP objects; timeout is 15 minutes
- E2E tests (`src/__tests__/e2e/`) focus on session/lock persistence and crash recovery; excluded from default test run
- Test structure mirrors core: `src/__tests__/integration/core/{objectType}/`

### Running Tests with RFC (Legacy Systems)

RFC connections are required for legacy SAP systems (BASIS < 7.50) where HTTP stateful sessions don't work. Example: E77 system.

**Prerequisites:**
1. SAP NW RFC SDK installed (download from SAP Support Portal, requires S-user)
2. RFC transport is provided by `@mcp-abap-adt/sap-rfc-lite` (transitive dependency via `@mcp-abap-adt/connection`) — nothing to install in this package
3. SAP user has `S_RFC` authorization for `SADT_REST_RFC_ENDPOINT` (SAP Note 3569684)

**Ensure `test-config.yaml` has `connection_type: "rfc"`:**

```yaml
environment:
  connection_type: "rfc"        # Use RFC transport instead of HTTP
  default_master_system: "E77"  # Match target system
```

**Run tests — pass `SAPNWRFC_HOME` and `PATH`/`LD_LIBRARY_PATH` inline:**

These vars CANNOT be in `.env` — `dotenv` doesn't expand `PATH`. Pass them at launch.

```bash
# Copy target system credentials first
cp e77.env .env
```

Windows (Git Bash):
```bash
SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk' PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH" npm test
SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk' PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH" npm test -- integration/core/class
SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk' PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH" DEBUG_ADT_TESTS=true npm test -- integration/core/class
```

macOS:
```bash
SAPNWRFC_HOME=~/nwrfcsdk PATH=$SAPNWRFC_HOME/lib:$PATH npm test
SAPNWRFC_HOME=~/nwrfcsdk PATH=$SAPNWRFC_HOME/lib:$PATH npm test -- integration/core/class
```

Linux:
```bash
SAPNWRFC_HOME=~/nwrfcsdk PATH=$SAPNWRFC_HOME/lib:$PATH LD_LIBRARY_PATH=$SAPNWRFC_HOME/lib:$LD_LIBRARY_PATH npm test
SAPNWRFC_HOME=~/nwrfcsdk PATH=$SAPNWRFC_HOME/lib:$PATH LD_LIBRARY_PATH=$SAPNWRFC_HOME/lib:$LD_LIBRARY_PATH npm test -- integration/core/class
```

**Available .env files:** `e77.env` (legacy), `e19.env`, `dev.env`, `trial.env`, `mdd-sk-dev.env`

See `docs/usage/RFC_CONNECTION.md` and `docs/development/RFC_TESTING.md` for full details.

## Key Dependencies

- `@mcp-abap-adt/interfaces` — All interfaces (`IAbapConnection`, `IAdtObject`, `IAdtResponse`, `IWebSocketTransport`, etc.)
- `@mcp-abap-adt/logger` — Logging interface
- `fast-xml-parser` — XML parsing for ADT responses
- `axios` — HTTP client (used internally by connection layer)
- `@mcp-abap-adt/connection` — **dev only** — concrete `IAbapConnection` implementation for tests

## Public API (`src/index.ts`)

Exports all client classes, batch classes, all `IXxxConfig`/`IXxxState` types for every object type, shared types (`AdtObjectType`, `ObjectReference`, `PackageHierarchyNode`, `WhereUsedListResult`, `SearchObjectsParams`, etc.), and `AdtService`/`AdtServiceBinding` classes.
