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
npm run lint:check      # Lint check + check:docs (no fixes)
npm run check:docs      # Every name the docs import must exist
npm run format          # Format code with Biome

# Test (requires .env with SAP credentials + src/__tests__/helpers/test-config.yaml)
# IMPORTANT: Always save full log first, then analyze. Never pipe through grep/tail/head.
#
# RUNNING FROM AN LLM CLI: use `npm run test:detached`. A full run is ~27 minutes,
# and an agent CLI supervises what its tool calls start — it stops long background
# commands when it judges the machine short of memory, judging from the whole
# machine rather than from this run. Measured: three runs killed that way in one
# session while jest held 338 MB and 11 GB were free, with no OOM entry in the
# kernel log at all. `test:detached` reparents the run to init, so it finishes on
# its own and there is nothing left to stop. Read `test-run.log` afterwards.
npm run test:detached                             # RECOMMENDED from an agent; writes test-run.log
npm run test:detached -- integration/core/class   # …one directory
npm test 2>&1 | tee test-run.log                  # Interactive shell: fine, you are watching it
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

- **AdtClient** (`AdtClient.ts`): High-level CRUD operations via factory methods (`getClass()`, `getProgram()`, `getPackage()`, `getDdl()` (DDL sources — formerly `getView()`), `getTable()`, `getScalarFunction()`, `getScalarFunctionImplementation()`, `getAppendStructure()`, `getRequest()`, etc.). Each factory takes an optional result set (`getClass({ ...classDocuments, versions: objectVersions })`) and returns the intersection of the capability atoms that object supports. Also: `getUtils()` for shared operations, `getLocalTestClass()`/`getLocalTypes()`/`getLocalDefinitions()`/`getLocalMacros()` for class includes. `AdtClientLegacy` and `createAdtClient()` cover BASIS < 7.50.
- **AdtRuntimeClient** (`AdtRuntimeClient.ts`): Runtime operations exposed via factory accessors — `getProfiler()`, `getCrossTrace()`, `getSt05Trace()`, `getApplicationLog()`, `getAtc()`, `getAtcLog()`, `getDdicActivation()`, `getDumps()`, `getFeeds()` (FeedRepository), `getSystemMessages()`, `getGatewayErrorLog()`. Each takes an optional result set and builds a fresh implementation per call — nothing is cached.
- **AdtExecutor** (`AdtExecutor.ts`): Program/class execution — `getClassExecutor(results?)`, `getProgramExecutor(results?)`: `run`, `runWithProfiler`, and trace scheduling (`scheduleTrace` and the listings).
- **AdtClientsWS** (`AdtClientsWS.ts`): WebSocket facade (request/response + event model) wrapping `IWebSocketTransport`.
- **AdtAbapGitClient** (`AdtAbapGitClient.ts`): Standalone client for SAP-official ADT-integrated abapGit (`/sap/bc/adt/abapgit/*`). Six members, one request each — `link`, `pull({ package, pullLink })` (starts the pull and does not wait; polling `listRepos` is the caller's), `unlink({ repositoryId })`, `listRepos`, `getErrorLog(logLink)`, `checkExternalRepo`. The key, pull link and log link come from `listRepos`; there is no `getRepo`. Result set as the fourth constructor argument (`abapGitDocuments` by default). Not a factory on AdtClient — consumers `new` it directly. Available on cloud + modern on-prem (ABAP Platform 2022+).

All clients accept `IAbapConnection` (from `@mcp-abap-adt/interfaces-adt-connection`) + `ILogger`. Optional: `options.enableAcceptCorrection` — `Accept` negotiation on HTTP 406 is on unless it is `false` or `ADT_ACCEPT_CORRECTION=false`; its state lives on the connection.

### Core Modules (`src/core/`)

30 object-type modules (class, program, include, interface, ddl, table, structure, domain, dataElement, package, functionGroup, functionModule, functionInclude, accessControl, serviceDefinition, service, behaviorDefinition, behaviorImplementation, metadataExtension, enhancement, tabletype, transport, transformation, unitTest, authorizationField, featureToggle, messageClass, scalarFunction, scalarFunctionImplementation, appendStructure) plus `shared/`. Each follows this structure:

- `AdtXxx.ts` — High-level class implementing the capability atoms the type supports, generic over its result set
- `types.ts` — the `IXxxResults` result set and its `xxxDocuments` default; configs (`IXxxConfig`) come from `@mcp-abap-adt/interfaces-adt`; `ICreateXxxParams` (snake_case, low-level internal)
- `create.ts`, `read.ts`, `update.ts`, `delete.ts` — Low-level CRUD functions that build XML, set headers, call `connection.makeAdtRequest()`
- `lock.ts`, `unlock.ts` — Session management; the handle is read by `lockHandleOf` (`src/utils/lockHandle.ts`), `''` when SAP sent none
- `activation.ts`, `check.ts`, `validation.ts` — Supporting operations
- `index.ts` — Re-exports public API of the module

**Shared module** (`src/core/shared/AdtUtils.ts`): Large utility class — search, where-used, SQL queries, inactive objects, group activation/deletion, discovery, type info, virtual folders, etc. Result set `IUtilResults` / `utilDocuments`.

### Design Patterns

**Factory pattern**: `AdtClient` creates object-specific implementations of the capability contracts in `@mcp-abap-adt/interfaces-adt`.

**Interprets nothing**: the result strategy is given when the implementation is built (a result set per object type; the shipped `<x>Documents` answer the document as it arrived via `rawDocument`, or `nothing`); the error strategy (`options.analyse`, `IAdtAnalyseOptions`) is given with every call. No member substitutes its own reading or verdict (`analyse ??` fallbacks are banned by `src/__tests__/unit/onlyCorpusStrategiesShip.test.ts`). Every reading and verdict lives in `@mcp-abap-adt/adt-strategies` (`packages/adt-strategies`). A failure caused by SAP's answer comes back through the strategy — never a throw, never a rewrap that drops the response; a member throws only for a cause inside the library (a caller argument missing before a request is built, a defect). Decision 15 in `docs/architecture/DECISIONS.md`.

**One endpoint, one member**: every member issues exactly one ADT request. `create` is the POST; `update` is the write and carries `options.lockHandle` as given; `delete` is the DELETE; `checkDeletion` is the approval ADT wants first; `lock`/`unlock` are the lock window. Nothing composes them for the caller.

A multi-step operation is therefore the consumer's sequence, in the order it chooses:

```typescript
const locked = await cls.lock(config);
if (!locked.ok) throw new Error(locked.getError().message);
const handle = locked.getResult().value;
await cls.update(config, { source, lockHandle: handle });
await cls.unlock(config, handle);
await cls.activate(config);
```

The one exception is `AdtMessageClassMessage`, where a message is a row inside its class's document: the write is one PUT, but it needs two lock handles and a read-modify-write of XML this library assembles.

**Session Management**: `lock` sets stateful and `unlock` restores stateless. No other member touches `connection.setSessionType()` — asserted by `src/__tests__/unit/capabilities/behaviour.test.ts`.

**Interface-Only Communication**: All code depends on `IAbapConnection` interface, not concrete implementations. `@mcp-abap-adt/connection` (dev dependency) provides the concrete implementation, used only in tests.

### Supporting Layers

- **Accept Negotiation** (`src/utils/acceptNegotiation.ts`): On HTTP 406, extracts supported content types from response, caches the correct `Accept` per URL, retries once. Wraps `connection.makeAdtRequest`; the caches and the switch are per connection.
- **Runtime** (`src/runtime/`): profiler and cross/ST05 traces, application logs, ATC, DDIC activation graph, runtime dumps, feeds, system messages, gateway error log — each in its own subfolder, each with its result set.
- **Executors** (`src/executors/`): Class/program execution and trace scheduling.
- **System probes** (`src/utils/systemInfo.ts`, `src/utils/discoveryEndpoints.ts`): `getSystemInformation()`, `isModernAdtSystem()`, `fetchDiscoveryEndpoints()` answer 404/405/501 as an absent endpoint and raise any other failure.

## Code Standards

- All code, comments, error messages in English
- Comments explain "why" not "what"
- Never change `package.json` version without explicit user request
- When updating CHANGELOG, ask user which version to use
- After changing the version in `package.json`, always run `npm install --package-lock-only` to update `package-lock.json` and include it in the same commit
- All dependencies must resolve from npm registry only. No local links or symlinks (`"link": true`) in `package-lock.json`. Sibling repos exist in parent directory — npm may auto-link them. Always verify after `npm install`.
- Biome config: single quotes, semicolons always, indent 2 spaces
- `noExplicitAny: warn` in production code, relaxed in tests
- **All diagnostic output goes through an injected `ILogger` — never `console.*`.** This holds for test helpers and stubs as much as for library code: a logger stays silent unless the caller asks for output, so runs stay clean and one helper serves both quiet and verbose use, while a `console.*` call cannot be turned off by the caller. Give a helper an optional `logger?: ILogger` parameter and call `logger?.debug('message', { meta })`. Enforced by `noConsole` — `error` in production code, `warn` in tests (existing test occurrences are debt, not a precedent)

## Testing Notes

- All tests are integration tests against real SAP systems (no mocks); unit tests exist but are minimal (`src/__tests__/unit/`)
- Tests require `.env` with SAP credentials (`SAP_URL`, `SAP_USERNAME`, `SAP_PASSWORD`, `SAP_CLIENT`) and `src/__tests__/helpers/test-config.yaml` with object names and parameters. For non-unicode legacy systems add `SAP_UNICODE=false` (controls `text/plain` vs `text/plain; charset=utf-8` in checkRun payloads)
- **Test config setup**: `npm run test:init` (or `cp src/__tests__/helpers/test-config.yaml.template src/__tests__/helpers/test-config.yaml`). Template works out of the box — edit only lines marked `# ← CHANGE`: `system` (`"onprem"` or `"cloud"` — this is what picks the connector, and it is stated, never inferred from `SAP_URL` or the auth type), `default_package`, `default_transport`, `default_master_system`, `shared_dependencies.super_package`. On-prem package tests also need `transport_layer`.
- **Root package prerequisite**: The package specified in `default_package` (e.g., `ZADT_BLD_PKG03`) must be created manually in the SAP system before running tests. Tests do not create this package — they only create objects inside it.
- `TestConfigResolver` resolves params with priority: `testCase.params` > `environment.default_*` > `SAP_*` env vars
- **Tests never build a connection themselves.** `createTestConnection(logger)` from `src/__tests__/helpers/sessionConfig.ts` reads the target system and the authentication from config, picks the connector accordingly, opens the session, and returns it ready to use; `await connection.disconnect()` in `afterAll` releases it. `reset()` is gone as of `@mcp-abap-adt/connection` 5.0.0 — it dropped the cookie locally and left the session open on the server
- Tests are idempotent: CREATE tests delete existing objects first; other tests create missing objects
- Only user-defined objects (Z_/Y_ prefix) can be modified in tests
- Tests run sequentially (`maxWorkers: 1`, `maxConcurrency: 1`) to avoid conflicts with shared SAP objects; timeout is 15 minutes
- E2E tests (`src/__tests__/e2e/`) focus on session/lock persistence and crash recovery; excluded from default test run
- Test structure mirrors core: `src/__tests__/integration/core/{objectType}/`

### Running Tests with RFC (Legacy Systems)

RFC connections are required for legacy SAP systems (BASIS < 7.50) where HTTP stateful sessions don't work. Example: E77 system.

**Prerequisites:**
1. SAP NW RFC SDK installed (download from SAP Support Portal, requires S-user)
2. **Install dependencies with the SDK visible** — the RFC transport is
   `@mcp-abap-adt/sap-rfc-lite`, reached through `@mcp-abap-adt/connection`,
   and there is nothing to add to `package.json`. But it is an
   `optionalDependencies` entry with a native build, and **npm drops an optional
   dependency whose build fails, silently** — so it must be installed with the
   same variables the test run uses:

   ```bash
   # Windows (Git Bash) — the SDK path is wherever it was unpacked
   SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk' PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH" npm ci

   # macOS
   SAPNWRFC_HOME=~/nwrfcsdk PATH=$SAPNWRFC_HOME/lib:$PATH npm ci

   # Linux
   SAPNWRFC_HOME=~/nwrfcsdk PATH=$SAPNWRFC_HOME/lib:$PATH LD_LIBRARY_PATH=$SAPNWRFC_HOME/lib:$LD_LIBRARY_PATH npm ci
   ```

   Measured on the same lockfile: `npm ci` alone installs 1675 packages and no
   binding; with the variables, 1678, and it lands at
   `node_modules/@mcp-abap-adt/connection/node_modules/@mcp-abap-adt/sap-rfc-lite`
   — nested, never at the top level, which is where looking for it misleads.
   Without it `connection_type: "rfc"` fails in `globalSetup` with
   `@mcp-abap-adt/sap-rfc-lite is not available … Cannot find module`, which
   names the package rather than the SDK that was missing at install time.
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

- `@mcp-abap-adt/interfaces-adt` — ADT contracts (capability atoms, configs, `IAdtResponse`, `IAnalyse`, `IAdtAnalyseOptions`, `IResultStrategy`)
- `@mcp-abap-adt/interfaces-adt-connection` — the connection contract (`IAbapConnection`, `IAdtWireResponse`, `IAbapRequestOptions`, `ITimeoutConfig`, `ADT_SESSION_ERROR`)
- `@mcp-abap-adt/interfaces-network` — `IWebSocketTransport`, `HttpError`; `@mcp-abap-adt/interfaces-utils` — `ILogger`, `XmlNode`
- `@mcp-abap-adt/logger` — Logging implementation
- `fast-xml-parser` — XML parsing for ADT responses
- `axios` — HTTP client (used internally by connection layer)
- `@mcp-abap-adt/connection` — **dev only** — concrete `IAbapConnection` implementation for tests; `@mcp-abap-adt/interfaces-auth` and `-auth-sap` are dev-only too
- `@mcp-abap-adt/adt-strategies` — workspace package in `packages/adt-strategies`, not a dependency of adt-clients: the readings and verdicts consumers (and the tests) pass in

## Public API (`src/index.ts`)

Exports the client classes, the handler classes exported directly, the result sets (`<x>Documents` + `I…Results`) for every implementation, the building blocks `rawDocument`/`nothing`/`wireItself`/`nothingIsARefusal`, `AdtSAPError`/`AdtParseError`, and the system probes. No contract type is re-exported — consumers import those from the contract packages — and no reading or verdict ships here. The exact value surface is pinned by `src/__tests__/unit/publicApiSurface.test.ts`.

## Plans and Specs

Plans under `docs/superpowers/plans/` and specs under `docs/superpowers/specs/` are kept in the tree only while active — i.e. not yet implemented and not cancelled. Once a plan/spec has been fully implemented OR cancelled, delete the file. History lives in git; these directories hold only work in progress.
