# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Requirements

- All repository artifacts (source code, documentation, comments, commit messages) must be written in English
- Direct communication with the user must be in the user's language

## Project Overview

**mcp-abap-adt-clients** (`@mcp-abap-adt/adt-clients`) is a TypeScript library providing ADT (ABAP Development Tools) clients for SAP ABAP systems. It offers both read-only and CRUD operations for SAP ABAP ADT objects through REST API. Node.js >=18, CommonJS output, strict TypeScript.

The repository is a private root (`"private": true`, `"workspaces": ["packages/*"]`) around its packages: `packages/adt-clients` (this library) and `packages/adt-strategies` (`@mcp-abap-adt/adt-strategies`). Every path in this file is relative to `packages/adt-clients`, and its npm scripts run there, unless it names a root file (`package.json`, `package-lock.json`, `.npmrc`, `biome.json`, `tsconfig.base.json`, `tools/`, `.github/`, `.husky/`, `docs/superpowers/`). At the root: `npm run build|test:check|lint:check` for every package, `npm test` the unit suites of every package (no SAP system), `npm run check` the release gate, and `npm run release:publish` (`tools/publish-changed.js`, copied from mcp-abap-adt-interfaces) publishes the packages whose version is not on the registry, in `publishOrder`; `-- --dry-run` publishes nothing. Tags are `<package directory>-v<version>` (`adt-clients-v<version>`, `adt-strategies-v<version>`); `release.yml` has a job per package.

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

# Test (MCP_ENV_PATH=~/.config/mcp-abap-adt/sessions/<system>.env + the overlay MCP_TEST_OVERLAY names; no .env in the repository)
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
# The second-session proof that each UNLOCK released its lock is the overlay's `environment.verify_lock_released` (required; true on premise, false on cloud, where a second session may land on another application server)

# Ask SAP directly: one request to several systems, every answer printed whole
# (status, headers, body). Targets are session files under ~/.config/mcp-abap-adt/sessions/;
# the system kind is stated (:onprem|:cloud|:legacy or SAP_SYSTEM_TYPE), never inferred.
../../node_modules/.bin/ts-node scripts/adt-nc.ts --to <system>-tunnel --to trial:cloud GET /sap/bc/adt/programs/programs/rsparam -H 'Accept: application/vnd.sap.adt.programs.programs.v2+xml'

# Unit tests only (no SAP system)
npm run test:unit

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

All clients accept `IAbapConnection` (from `@mcp-abap-adt/interfaces-adt-connection`) + `ILogger`. No request is corrected, sent again or remembered: a `406`/`415` is the call's answer (Accept negotiation was removed in 36.0.0). A caller that knows a system's media types passes them per call: `options.headers` (`{ accept, contentType }`) on the object members, `options.accept` on the `getUtils` reads.

### Core Modules (`src/core/`)

30 object-type modules (class, program, include, interface, ddl, table, structure, domain, dataElement, package, functionGroup, functionModule, functionInclude, accessControl, serviceDefinition, service, behaviorDefinition, behaviorImplementation, metadataExtension, enhancement, tabletype, transport, transformation, unitTest, authorizationField, featureToggle, messageClass, scalarFunction, scalarFunctionImplementation, appendStructure) plus `shared/`. Each follows this structure:

- `AdtXxx.ts` — High-level class implementing the capability atoms the type supports, generic over its result set
- `types.ts` — the `IXxxResults` result set and its `xxxDocuments` default; configs (`IXxxConfig`) come from `@mcp-abap-adt/interfaces-adt`; `ICreateXxxParams` (snake_case, low-level internal)
- `create.ts`, `read.ts`, `update.ts`, `delete.ts` — Low-level CRUD functions that build XML, set headers, call `connection.makeAdtRequest()`
- `lock.ts`, `unlock.ts` — Session management; the handle is read by `lockHandleOf` (`src/utils/lockHandle.ts`), `''` when SAP sent none
- `activation.ts`, `check.ts`, `validation.ts` — Supporting operations
- `index.ts` — Re-exports public API of the module

**Enhancement hosts**: class, program and function group implement `IAdtEnhancementHost`; include implements `IAdtIncludeEnhancementHost`. Both expose `readEnhancementElements` and `readEnhancementOptions`, with result slots `enhancementElements` and `enhancementOptions`. Include `context` is the main program name on both reads. `getEnhancement()` supports `enhoxhb`, `enhoxhh` and `enhsxsb` only.

**Shared module** (`src/core/shared/AdtUtils.ts`): Large utility class — search, where-used, SQL queries, inactive objects, group activation/deletion, discovery, type info, virtual folders, etc. Result set `IUtilResults` / `utilDocuments`.

### Object addresses (`src/endpoints/objects.ts`)

The one place an object's ADT address is built: a record per kind (`PROGRAM`, `PROGRAM_INCLUDE`, `FUNCTION_INCLUDE`, `CLASS_INCLUDE`, …) with its full paths and a `uri(...)` taking exactly what the address needs. Never write `/sap/bc/adt/<collection>/…` in a module; `noHardcodedObjectAddresses.test.ts` enforces it with the TypeScript parser. `scripts/address-matrix.ts` checks every record against real systems.

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

**Session Management**: only the `LOCK` and the `UNLOCK` request are stateful. `lock` sets stateful for its own request and is back to stateless as soon as that request answers; `unlock` does the same for its `UNLOCK`. Everything between them — the write included — goes stateless, as Eclipse sends it. The `UNLOCK` must be stateful: the connector (`@mcp-abap-adt/connection` ≥ 9.3.1) sends the context cookie `sap-contextid` with stateful requests only, and a stateless `UNLOCK` runs in a fresh ABAP context, answers 200 and releases nothing — the next activation or delete is refused with `EU/510` "currently editing". No other member touches `connection.setSessionType()`. Both rules are asserted by `src/__tests__/unit/capabilities/behaviour.test.ts` ("LOCK and UNLOCK are the stateful requests", "a member leaves the session alone"). The one exception is `AdtMessageClassMessage`, whose write holds two locks and manages its own window.

**Interface-Only Communication**: All code depends on `IAbapConnection` interface, not concrete implementations. `@mcp-abap-adt/connection` (dev dependency) provides the concrete implementation, used only in tests.

### Supporting Layers

- **Supported media types** (`src/utils/supportedMediaTypes.ts`): `extractSupportedAccept` (a 406 body's accepted content types) and `extractSupportedContentType` (a 415): pure parsers for a consumer that chooses the next request's headers itself; the library retries nothing.
- **Runtime** (`src/runtime/`): profiler and cross/ST05 traces, application logs, ATC, DDIC activation graph, runtime dumps, feeds, system messages, gateway error log — each in its own subfolder, each with its result set.
- **Executors** (`src/executors/`): Class/program execution and trace scheduling.
- **System probes** (`src/utils/systemInfo.ts`, `src/utils/discoveryEndpoints.ts`): `getSystemInformation()`, `isModernAdtSystem()`, `fetchDiscoveryEndpoints()` answer 404/405/501 as an absent endpoint and raise any other failure.

## Code Standards

- All code, comments, error messages in English
- Comments explain "why" not "what"
- Never change `package.json` version without explicit user request
- When updating CHANGELOG, ask user which version to use
- After changing the version in a package's `package.json`, always run `npm install --package-lock-only` at the repository root to update the one `package-lock.json` and include it in the same commit
- All third-party dependencies must resolve from the npm registry only. In `package-lock.json`, `"link": true` is allowed only for the workspace siblings (`node_modules/@mcp-abap-adt/adt-clients` → `packages/adt-clients`, `node_modules/@mcp-abap-adt/adt-strategies` → `packages/adt-strategies`); any other link is a defect. Sibling repos exist in parent directory — npm may auto-link them. Always verify after `npm install`.
- Biome config: single quotes, semicolons always, indent 2 spaces
- `noExplicitAny: warn` in production code, relaxed in tests
- **All diagnostic output goes through an injected `ILogger` — never `console.*`.** This holds for test helpers and stubs as much as for library code: a logger stays silent unless the caller asks for output, so runs stay clean and one helper serves both quiet and verbose use, while a `console.*` call cannot be turned off by the caller. Give a helper an optional `logger?: ILogger` parameter and call `logger?.debug('message', { meta })`. Enforced by `noConsole` — `error` in production code, `warn` in tests (existing test occurrences are debt, not a precedent)

## Testing Notes

- All tests are integration tests against real SAP systems (no mocks); unit tests exist but are minimal (`src/__tests__/unit/`)
- Tests read SAP credentials (`SAP_URL`, `SAP_USERNAME`, `SAP_PASSWORD`, `SAP_CLIENT`) from the session file `MCP_ENV_PATH` names, and object names and parameters from the base template plus the overlay `MCP_TEST_OVERLAY` names. For non-unicode legacy systems add `SAP_UNICODE=false` (controls `text/plain` vs `text/plain; charset=utf-8` in checkRun payloads)
- **Where credentials come from**: `~/.config/mcp-abap-adt/sessions/<system>.env` on Linux/macOS, `~/Documents/mcp-abap-adt/sessions/<system>.env` on Windows (`<system>.env`, `<other-system>.env`, …) is the one source; a run names its file with `MCP_ENV_PATH`. The repository holds no `.env` and no per-system copy (they went stale as passwords rotated and produced 401s); the helpers read the repository's `.env` only when `MCP_ENV_PATH` is unset. The session files are not uniform: some carry the full set, some only `SAP_LOGIN` and `SAP_PASSWORD`; the file a run names must carry `SAP_URL`, `SAP_USERNAME` (not `SAP_LOGIN`), `SAP_PASSWORD` and `SAP_CLIENT` — keep such a copy in the session directory, mode 600.
- **Test config setup**: the tracked `src/__tests__/helpers/test-config.yaml.template` is the base. The system-specific keys go into the gitignored `src/__tests__/helpers/test-config.overlay.yaml`. To create it, run `npm run test:init -- onprem|cloud`, which copies the empty form from `helpers/overlays/` and never overwrites a file that is there. Then fill in every value: `environment.system` (`onprem` or `cloud`, which picks the connector and is stated, never inferred from `SAP_URL` or the auth type), the packages, transports, master system, software component and transport layers. The config is refused, naming the key, when an overlay key is unknown or its value is missing or a placeholder, or when a full `test-config.yaml` is left over. `npm run test-config:migrate` converts an old full `test-config.yaml` into the overlay once. The key list and the rules are in `docs/development/TEST_CONFIG_SCHEMA.md`. One overlay per system: `MCP_TEST_OVERLAY` names the overlay a run reads (`src/__tests__/helpers/test-config.overlay.<system>.yaml`, gitignored), relative to `packages/adt-clients` or absolute; a named overlay that does not exist is refused, never replaced by the default.
- **Root package prerequisite**: The package specified in `default_package` (e.g., `ZADT_BLD_PKG03`) must be created manually in the SAP system before running tests. Tests do not create this package — they only create objects inside it.
- `TestConfigResolver` resolves params with priority: `testCase.params` > `environment.default_*` > `SAP_*` env vars
- **Tests never build a connection themselves.** `createTestConnection(logger)` from `src/__tests__/helpers/sessionConfig.ts` reads the target system and the authentication from config, picks the connector accordingly, opens the session, and returns it ready to use; `await connection.disconnect()` in `afterAll` releases it. `createTestConnection(logger, { ownSession: true })` opens a session of its own instead of joining the run's — the caller closes it with `closeOwnTestConnection()`; `expectLockReleased` (`helpers/lockReleased.ts`) is its one user. `reset()` is gone as of `@mcp-abap-adt/connection` 5.0.0 — it dropped the cookie locally and left the session open on the server
- Tests are idempotent: CREATE tests delete existing objects first; other tests create missing objects
- Only user-defined objects (Z_/Y_ prefix) can be modified in tests
- Tests run sequentially (`maxWorkers: 1`, `maxConcurrency: 1`) to avoid conflicts with shared SAP objects; timeout is 15 minutes
- E2E tests (`src/__tests__/e2e/`) focus on session/lock persistence and crash recovery; excluded from default test run
- Test structure mirrors core: `src/__tests__/integration/core/{objectType}/`

### Running Tests with RFC (Legacy Systems)

RFC connections are required for legacy SAP systems (BASIS < 7.50) where HTTP stateful sessions don't work. Example: a legacy system.

**Prerequisites:**
1. SAP NW RFC SDK installed (download from SAP Support Portal, requires S-user)
2. **The RFC transport needs no build at install.** It is `@mcp-abap-adt/sap-rfc-lite`, reached
   through `@mcp-abap-adt/connection` (nested at
   `node_modules/@mcp-abap-adt/connection/node_modules/@mcp-abap-adt/sap-rfc-lite` of the
   repository root, where npm installs the workspace — never at the top level). It has no install script (0.3.x), so a plain `npm ci` compiles nothing and
   installs its prebuilt binding for linux-x64 (glibc), darwin-arm64 and win32-x64, which loads at run time with
   the SDK's libraries on the library path (below). On any other platform build the binding from sap-rfc-lite's own repository (its README,
   "Installation": `git checkout v0.3.x`, `npm ci`, `npm run prebuild:native` with `SAPNWRFC_HOME`
   and a C++ toolchain, `npm pack`) and install the package you built. On Linux with Homebrew
   Node, put the libuuid shim on the path too: `LD_LIBRARY_PATH=$HOME/.local/lib/sap-rfc-lite:$SAPNWRFC_HOME/lib`. Without a
   binding, `connection_type: "rfc"` fails in `globalSetup` with `@mcp-abap-adt/sap-rfc-lite is
   not available … Cannot find module`.
3. SAP user has `S_RFC` authorization for `SADT_REST_RFC_ENDPOINT` (SAP Note 3569684)

**Ensure `test-config.yaml` has `connection_type: "rfc"`:**

```yaml
environment:
  connection_type: "rfc"        # Use RFC transport instead of HTTP
  default_master_system: "SID"  # Match target system
```

**Run tests — pass `SAPNWRFC_HOME` and `PATH`/`LD_LIBRARY_PATH` inline:**

These vars CANNOT be in the session file — `dotenv` doesn't expand `PATH`. Pass them at launch.

Name the target system's session file with `MCP_ENV_PATH` — `~/.config/mcp-abap-adt/sessions/<system>.env` or, on Windows, `~/Documents/mcp-abap-adt/sessions/<system>.env` (see "Where credentials come from" above).

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

See `docs/usage/RFC_CONNECTION.md` and `docs/development/RFC_TESTING.md` for full details.

## No dependency runs an install script

Supply-chain worms (Shai-Hulud and its kind) spread through dependencies' install scripts. So:

- The root `package.json` `allowScripts` lists every package in the root lockfile that has an
  install script, each denied (`false`), and no package's `allowScripts` allows one; the root
  `.npmrc` has `strict-allow-scripts=true`, so a new dependency with an unreviewed install script
  fails the install. A new entry needs its reason; the default answer is deny.
- No `min-release-age`: it blocked installing a security fix while the gating audit failed CI.
- CI and the release workflow install the repository once, at the root, with
  `npm ci --ignore-scripts`, and `npm audit --audit-level=moderate` gates the one tree. An advisory
  with no fixed release gets an `overrides` entry with its reason in the CHANGELOG — never a
  non-gating audit.
- Never `npx`: scripts call the installed bins (`biome`, `tsc`, `jest`, `ts-node`), shell scripts
  the root's `../../node_modules/.bin/…`. `src/__tests__/unit/supplyChain.test.ts` holds all of this.

## Key Dependencies

- `@mcp-abap-adt/interfaces-adt` — ADT contracts (capability atoms, configs, `IAdtResponse`, `IAnalyse`, `IAdtAnalyseOptions`, `IResultStrategy`)
- `@mcp-abap-adt/interfaces-adt-connection` — the connection contract (`IAbapConnection`, `IAdtWireResponse`, `IAbapRequestOptions`, `ITimeoutConfig`, `ADT_SESSION_ERROR`)
- `@mcp-abap-adt/interfaces-network` — `IWebSocketTransport`, `HttpError`; `@mcp-abap-adt/interfaces-utils` — `ILogger`, `XmlNode`
- `@mcp-abap-adt/logger` — Logging implementation
- `fast-xml-parser` — XML parsing for ADT responses
- `ts-node` — **dev only** — runs the probe and read scripts in `scripts/` (`../../node_modules/.bin/ts-node`, installed at the repository root)
- `axios` — HTTP client (used internally by connection layer)
- `@mcp-abap-adt/connection` — **dev only** — concrete `IAbapConnection` implementation for tests; `@mcp-abap-adt/interfaces-auth` and `-auth-sap` are dev-only too
- `@mcp-abap-adt/adt-strategies` — lives in `packages/adt-strategies`, a workspace of the repository, published on its own. adt-clients' tests take it from npm as a devDependency (`^0.10.0`, which the workspace's 0.15.0 does not satisfy, so npm installs the published 0.10.x in `packages/adt-clients/node_modules`, not a link). Its build writes `ERRATA.md` (copied from `packages/adt-clients/docs/usage/`), because the release publishes with `--ignore-scripts`; its tests read adt-clients' `corpus/adt/`. A strategy change that adt-clients' tests need is published first.

## Public API (`src/index.ts`)

Exports the client classes, the handler classes exported directly, the result sets (`<x>Documents` + `I…Results`) for every implementation, the building blocks `rawDocument`/`nothing`/`wireItself`/`nothingIsARefusal`, `AdtSAPError`/`AdtParseError`, and the system probes. No contract type is re-exported — consumers import those from the contract packages — and no reading or verdict ships here. The exact value surface is pinned by `src/__tests__/unit/publicApiSurface.test.ts`.

## Plans and Specs

Plans under `docs/superpowers/plans/` and specs under `docs/superpowers/specs/` at the repository root (not part of any package) are kept in the tree only while active — i.e. not yet implemented and not cancelled. Once a plan/spec has been fully implemented OR cancelled, delete the file. History lives in git; these directories hold only work in progress.
