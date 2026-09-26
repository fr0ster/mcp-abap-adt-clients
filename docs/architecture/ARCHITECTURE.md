# Architecture

## Overview

`@mcp-abap-adt/adt-clients` is a TypeScript package that provides ADT client APIs over a shared `IAbapConnection` abstraction.

Primary public entry points:
- `AdtClient` - high-level CRUD-style object operations.
- `AdtClientLegacy` - extends `AdtClient` for legacy systems (BASIS < 7.50): blocks unsupported types, uses legacy deletion and versionless content types.
- `createAdtClient()` - factory that auto-detects system version and returns `AdtClient` or `AdtClientLegacy`.
- `AdtRuntimeClient` - stable runtime operations (traces, dumps, logs, feeds, ATC check runs, DDIC runtime helpers).
- `AdtClientsWS` - WebSocket request/event facade.
- `AdtExecutor` - execution-oriented facade (class and program execution, run under the profiler, trace scheduling).
- `AdtAbapGitClient` - standalone client (not a factory on `AdtClient`) wrapping the SAP-official ADT-integrated abapGit (`/sap/bc/adt/abapgit/*`); available on cloud and modern on-prem (ABAP Platform 2022+).

Design constraint:
- External integrations are interface-driven, and the contracts come from the packages that declare them: the capability atoms, configs, `IAdtResponse`, `IAnalyse` and `IResultStrategy` from `@mcp-abap-adt/interfaces-adt` (`^11`); `IAbapConnection`, `IAdtWireResponse`, `IAbapRequestOptions`, `ITimeoutConfig` and the connection capability atoms from `@mcp-abap-adt/interfaces-adt-connection` (`^1`, since 23.0.0); `ILogger`/`LogLevel`/`XmlNode` from `-utils`; `IWebSocketTransport` and `HttpError` from `-network`. `IAuthProvider` (`-auth`) and `ISapConfig` (`-auth-sap`) are dev-only, for the test helpers.
- **The library interprets nothing.** Every member makes one ADT request. What the answer becomes is the result strategy the implementation was built with; whether it is a failure is the `analyse` the caller passes with the call. The shipped result sets answer documents as they arrived; the readings and verdicts are in `@mcp-abap-adt/adt-strategies` (`packages/adt-strategies`). Decision 15 in [DECISIONS.md](DECISIONS.md).

## Layered Structure

```text
Consumer code  ── result sets (at construction), analyse (per call)
  |               └─ @mcp-abap-adt/adt-strategies, or the consumer's own
  -> AdtClient / AdtRuntimeClient / AdtClientsWS / AdtExecutor / AdtAbapGitClient
    -> core/* object modules + core/shared (AdtUtils)
    -> runtime/* endpoint functions
    -> executors/* (execution, trace scheduling)
      -> utils/* cross-cutting helpers (answering, timeouts, accept negotiation, lock handle)
        -> IAbapConnection.makeAdtRequest(...) / IWebSocketTransport
          -> SAP ADT endpoints
```

`utils/adtResponse.ts`'s `answering(run, read, analyse)` is the one place a
request, its reading and the caller's verdict meet: it runs the request, lets
`analyse` decide whether the answer is a failure, and only then applies the
reading. The reading runs outside the failure classification, so a parser that
throws surfaces as itself.

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
    AdtExecutor.ts
    AdtAbapGitClient.ts
    abapGit/                  # one low-level function per abapGit endpoint + result set

  core/
    <object>/                 # class, program, package, table, ...
      Adt<Object>.ts          # implements the capability atoms the type supports
      Adt<Object>Legacy.ts    # Legacy override (optional, for supported types)
      create.ts/read.ts/...   # low-level endpoint helpers
      types.ts                # I<Object>Results + <object>Documents
    shared/
      AdtUtils.ts             # cross-cutting non-CRUD utilities
      utilResultSet.ts        # IUtilResults + utilDocuments
      contentTypes.ts         # AdtContentTypesBase / AdtContentTypesModern
      deleteLegacy.ts         # direct DELETE for legacy systems
      *.ts                    # discovery, search, where-used, etc.

  runtime/
    applicationLog/  atc/  ddic/  dumps/  feeds/
    gatewayErrorLog/  systemMessages/  traces/

  executors/
    class/ClassExecutor.ts
    program/ProgramExecutor.ts
    traceScheduling.ts

  utils/
    adtResponse.ts            # answering(): request + reading + analyse
    resultStrategy.ts         # rawDocument, nothing, wireItself
    lockHandle.ts             # lockHandleOf: the handle a LOCK answered, '' if none
    acceptNegotiation.ts      # 406 recovery, state per connection
    activationUtils.ts        # buildObjectUri, shared by group activation, deletion, where-used
    systemInfo.ts, discoveryEndpoints.ts
    requestTrace.ts, callTimeout.ts, timeouts.ts, ...
```

## Public API Architecture

### 1) `AdtClient` (object facade)

`AdtClient` is a factory of capability-contract implementations and returns a new instance per call. Every factory takes an optional result set — `getClass({ ...classDocuments, versions: objectVersions })` — and without one answers documents as they arrived:
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

Each object module encapsulates its ADT endpoint specifics in `core/<object>/*.ts`, while `Adt<Object>.ts` implements the capability atoms, one request per member.

`ServiceBinding` follows the same factory pattern. Its `update` is its publication: one `POST` job to the publish or unpublish endpoint with an ADT `objectReferences` payload, `serviceType` and the desired state given by the caller. Whether SAP refused the publication inside its `200` is `analysePublication`'s to say, passed as `analyse`. `delete` is the deletion API and nothing before it: unpublishing a published binding first is the caller's call.

### 2) `AdtRuntimeClient`

Runtime clients are facades over pure runtime functions in `src/runtime/*`.
Every accessor takes an optional result set and builds a fresh implementation
per call; until 23.0.0 they cached the first instance, which kept the first
caller's readings for every caller after.

Runtime accessors return handlers narrowed to what the subject actually
supports, rather than a uniform object interface. `getAtc()` is the clearest
case: a check run is started and then read, never created, locked, activated or
versioned, so `AdtAtc` declares `IAtcRunStatusReadable` and `IAtcFindings`, plus
`resolveCheckVariant`, `createWorklist` and `startRun` — the three requests a run
is. It is not `IAdtRunnable` since 19.0.0, because that atom's `run` is one call. `src/runtime/atc/` holds both
it and `AtcLog`, which reads the execution and check-failure logs: the same
subject at different resources, and neither takes the other's identifier.

### 3) `AdtClientsWS`

WebSocket abstraction around `IWebSocketTransport`:
- request/response with correlation IDs and timeout-based pending map.
- event dispatch for unsolicited messages.

### 4) `AdtExecutor`

Execution-oriented facade — `getClassExecutor(results?)`, `getProgramExecutor(results?)`:
- `run` of the execution target.
- `runWithProfiler` with a profiler id the caller already holds.
- trace scheduling (`scheduleTrace`, `listRequests`, `getRequestsByUri`, `listObjectTypes`, `listProcessTypes`); `scheduleTrace` answers the document, and `traceSchedulingProfilerId` reads the id out of it.

Scheduling a trace and running under it are two requests and two calls; the
member that joined them (`runWithProfiling`) left in 19.0.0.

## Object Workflow Pattern (capability atoms)

Object implementations follow a common shape:
- `validate`, `create`, `read`, `readMetadata`, `readTransport`, `update`, `delete`, `checkDeletion`, `activate`, `check`, `lock`, `unlock`, and `getVersions`/`getVersionSource` where the type has version history — each an atom, each one request.
- typed `config` input; the answer is `IAdtResponse<T, E>`, `T` from the result set, `E` from the `analyse` passed.
- `update` carries `options.lockHandle` as given.

An update is the caller's sequence:
1. `lock` — answers the handle SAP sent (`''` when it sent none, never a throw).
2. `update` with that handle — the whole content, never a merge.
3. `unlock` — answers SAP's reply.
4. `activate`, when the caller wants it.

## Session and Locking Model

Critical conventions used across object modules:
- `lock` sets the session stateful and `unlock` restores stateless; no other member calls `connection.setSessionType`.
- `lockHandleOf` (`utils/lockHandle.ts`) reads the handle from the `sap-adt-lm-handle` header (function groups) or `LOCK_HANDLE` in the body; it is the one reading the implementation owns, because the contract fixes `lock`'s answer as the handle.
- Long polling is a flag on reads the caller makes, where ADT supports `withLongPolling=true`.

## Cross-Cutting Utilities (`AdtUtils`)

`AdtUtils` (in `core/shared/AdtUtils.ts`) covers non-object CRUD operations:
- discovery, search, where-used (including scope workflow), object/node/package structures.
- SQL query and table contents.
- group activation/deletion and inactive objects.
- source/metadata helpers for supported object types.

Notably, where-used is three calls, in the caller's order:
- scope fetch (`getWhereUsedScope`) — a sub-resource some S/4 releases answer `404`; what to do then is the caller's decision,
- local scope mutation (`modifyWhereUsedScope`) — no request,
- execution (`getWhereUsed`) — the document by default; `utilWhereUsedReferences` in adt-strategies reads it into references.

Both requests address the object with `buildObjectUri`, the address group
activation and deletion use, so the three cannot disagree (#173). Friendly names
(`class`, `interface`, `table`, `view`, `functionmodule`, …) map onto type codes;
a type neither vocabulary knows is thrown before any request.

## Accept Negotiation (406 Recovery)

`src/utils/acceptNegotiation.ts` provides optional request retry for ADT `406 Not Acceptable` cases:
- Can wrap `connection.makeAdtRequest` once per connection.
- Extracts supported accept values from headers/body.
- Retries once with corrected `Accept` and caches per `METHOD + URL`.
- On unless the constructor option `enableAcceptCorrection` is `false` or the env var `ADT_ACCEPT_CORRECTION=false`.
- The caches and the switch are the connection's (kept on it under a symbol, forwarded by the call-timeout proxy). Until 23.0.0 they were module globals, so a correction learned on one system was sent to every other.

## Error and Response Handling

Every member answers `IAdtResponse<T>` — a result or a failure, never both and
never neither. Two strategies decide what that is, and the order is fixed:

1. **The error strategy** (`analyse`, per call) decides whether the answer is a
   failure at all. It is asked first, so a reading is never handed a refusal to
   make a value out of. **This package ships none.** ADT delivers some refusals
   inside a `200`, and which documents count as one depends on the system and
   the task — so the decision is the consumer's, taken from a corpus of their
   own responses. Omit `analyse` and a transport failure still reaches you with
   its response attached; nothing here reads a body.
2. **The result strategy** (injected into the implementation once, at
   construction) decides what a non-failure becomes. Defaults ship per object
   type as `<type>Documents`, and every default is the document as it arrived
   (`rawDocument`) or `nothing`. No member substitutes a reading of its own for
   the caller's, and none falls back from the caller's `analyse` to a verdict of
   its own — `src/__tests__/unit/onlyCorpusStrategiesShip.test.ts` fails on any
   `analyse ??` under `src/`.

`IAdtError.origin` has two values and both describe the server: `'refusal'` (SAP
answered no) and `'connection'` (no answer arrived).

**The throw boundary is the cause.** A failure caused by SAP's answer — a
refusal, a missing lock handle, a `404` on a versions resource, `isDeleted=false`
— comes back through the strategies with the response attached: never thrown,
never rewrapped in an `Error` that drops the response. A member throws only for
a cause inside the library: an argument the caller left out, found before any
request is built (a function include without its group, an enhancement without
its subtype, a where-used type nobody knows), or a defect. A reading that throws
— the consumer's own, or one from `adt-strategies` — surfaces as itself, because
calling it a verdict about SAP points a caller at a system that answered
correctly.

Common behaviors in implementations:
- Preserve raw ADT responses for caller inspection — the failure half carries
  `response` whole, and the shipped readings are the document.
- The one reading an implementation owns is `lockHandleOf`, because the
  contract fixes what `lock` answers.
- `chain()` survives in one place, `AdtMessageClassMessage`, the approved
  exception to one-request-per-member: `onScopeEnd` runs cleanup on every path,
  `onFailure` a rollback only when the chain fails, both in reverse order.

## Type System and Exports

**Types are defined once, in the contract packages** — `@mcp-abap-adt/interfaces-adt` `^11.0.0`, `@mcp-abap-adt/interfaces-adt-connection` `^1.0.0` and their siblings. As of 7.5.0 this package declares no type it shares with them, and since 22.0.0 it imports from each by name instead of through the facade, which is now deleted. Since 23.0.0 the connection names (`IAbapConnection`, `IAdtWireResponse`, `IAbapRequestOptions`, `ITimeoutConfig`, the connection capability atoms, `ADT_SESSION_ERROR`) come from `-adt-connection`: `interfaces-adt` 11 no longer exports them. Each `src/core/<object>/types.ts` is a re-export surface:

```ts
export type { IClassConfig, ICreateClassParams } from '@mcp-abap-adt/interfaces-adt';
```

The `IXxxState` half of every pair is gone: a member answers one value and a
failure, and neither is a state bag. Each `types.ts` now also declares what the
contract does **not** carry — the module's `IXxxResults` strategy set and the
`<type>Documents` default that satisfies it. The shapes readings build live
beside those readings, in `@mcp-abap-adt/adt-strategies`. A contract carries
what is needed to use or replace it; a shape a replacement reading would not
produce is neither.

Rationale: the two packages previously held independent copies of the same interfaces, and they drifted silently — a field required on one side and optional on the other produced no error anywhere. A single definition site makes that class of bug impossible.

**Honest capability types (8.0.0, finished in 12.0.0).** The fat `IAdtObject` contract is split into capability atoms in `@mcp-abap-adt/interfaces-adt` (`IAdtCreatable`, `IAdtReadable`, `IAdtMetadataReadable`, `IAdtUpdatable`, `IAdtMetadataUpdatable`, `IAdtDeletable`, `IAdtValidatable`, `IAdtCheckable`, `IAdtActivatable`, `IAdtLockable`, `IAdtVersionable`, `IAdtTransportAware`) — and since interfaces 29.0.0 there is nothing above them: `IAdtObject`, `IAdtCrud`, `IAdtModifiable` and `IAdtSourceObject` were removed for forcing one result type on members that answer different things. Each `Adt<Object>` class `implements` only the atoms it genuinely supports, and `AdtClient.getXxx()` return types are narrowed to that honest set, so calling a capability a handler lacks (`getDomain().getVersions()`) is a compile error rather than a runtime throw.

Since **12.0.0** the claim is enforced rather than asserted. Every stub that threw is gone — not narrowed, deleted — including the last three handlers whose composites lived in the interfaces package (`transport`, `featureToggle`, `serviceBinding`). Four class-include handlers lost `create()`, because an include is not created: it exists because its class does, and writing source into it is `update`. They no longer extend `AdtClass` either — a shared `AdtClassMemberBase` gives them the container's lock, activation, metadata, transport and include version history and nothing else, so their declared type and their runtime shape agree.

A guard under `src/__tests__/unit/capabilities/` holds the line: a manifest authored from ADT rather than from the code, a compile-time comparison of all 37 factory return types against the 12 atoms **in both directions**, a completeness check over both clients' prototype chains, and a behavioural pass that calls every method of every claimed capability against a recording connection and asserts it issues the request its capability names — the verb included, since a chain that locks, reads and unlocks without ever writing issues three requests and none of them the one that matters.

Package root (`src/index.ts`) exports:
- client classes (`AdtClient`, `AdtClientLegacy`, `createAdtClient`, runtime/ws/executor/abapGit clients) and the handler classes exported directly,
- the injection surface (`src/index.readings.ts` and the runtime/executor/abapGit barrels): one `IXxxResults` + `<type>Documents` pair per implementation, and the building blocks `rawDocument`, `nothing`, `wireItself`, `nothingIsARefusal`,
- `AdtSAPError`, `AdtParseError`, the content-type sets and the system probes.

No contract type is re-exported, and no reading or verdict ships: those are in
the contract packages and in `@mcp-abap-adt/adt-strategies`.

What stays declared locally, and why:
- **Runtime (value) exports** — these are code, not contract: `ENHANCEMENT_TYPE_CODES` and the enhancement URL helpers (`src/core/enhancement/types.ts`), `resolveBindingVariant` / `SERVICE_BINDING_VARIANT_MAP` (`src/core/service/types.ts`).
- **`AdtContentTypesBase` / `AdtContentTypesModern`** — the two shipped header-set implementations (354 lines, 38 methods). They `implements IAdtContentTypes` from `@mcp-abap-adt/interfaces-adt`; the interface itself is not declared here.

**Contract consolidation (11.0.0).** As of 11.0.0 adt-clients declares no contract type at all, not even the ones a consumer needs only to configure or call this package's own clients: `IAdtClientOptions`, `IAdtSystemContext`, `IAdtContentTypes`, `IAdtHeaders`, the three `IBatch*` shapes, the twelve abapGit types, the ten executor types, and the five debugger types all moved to the contract packages — `@mcp-abap-adt/interfaces-adt` for all of these. Import them from there; the names and shapes are unchanged. Internal low-level helpers are intentionally not part of root API.

## Testing Architecture

Current test setup:
- Jest + `ts-jest`, roots at `src/`.
- Integration-heavy strategy against real SAP ADT system.
- Sequential execution enforced (`maxWorkers: 1`, `maxConcurrency: 1`) to avoid shared-object contention.
- `src/__tests__/helpers/BaseTester.ts` provides reusable flow/read test orchestration.
- Integration type-check is part of `pretest`.

Runtime coverage: unit tests per runtime implementation under
`src/__tests__/unit/runtime/` (one file each, plus `analysePassThrough.test.ts`,
which checks every runtime member hands the caller's `analyse` on), the factory
contract in `src/__tests__/unit/clients/AdtRuntimeClient.factory.test.ts`, and
integration tests under `src/__tests__/integration/runtime/{atc,dumps,feeds,logs,traces}`.

## Extension Rules for New Features

When adding a new ADT object type:
1. **Define the types in the contract package first** — `@mcp-abap-adt/interfaces-adt`, or the sibling that owns them — release it, then consume it here. Do not declare params/config/state locally — that is what caused the drift resolved in 7.5.0. `src/core/<object>/types.ts` should contain only re-exports (plus any genuine runtime helpers).
2. Create `src/core/<object>/` low-level endpoint modules.
3. Implement `Adt<Object>.ts` against the capability atoms the type supports, generic over an `I<Object>Results` set whose `<object>Documents` default is `rawDocument` (or `nothing`) in every slot. Every member takes `options.analyse` and hands it to `answering()` untouched.
4. Add factory method in `AdtClient`, with the no-argument and the result-set overloads.
5. Export the result set and its default from `src/index.readings.ts`. A reading of the document belongs in `packages/adt-strategies`, tested against the corpus — not here.
6. Add integration tests under `src/__tests__/integration/core/<object>/`.
7. Keep stateful/lock cleanup semantics consistent.

When adding runtime APIs:
1. Add pure functions in `src/runtime/<domain>/`, and a class taking a result set.
2. Expose via `AdtRuntimeClient` as a factory taking that result set, building a fresh instance per call.
3. Add unit/integration tests depending on endpoint safety and availability.
