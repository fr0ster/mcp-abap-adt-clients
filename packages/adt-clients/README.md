# @mcp-abap-adt/adt-clients

[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://stand-with-ukraine.pp.ua)

TypeScript clients for SAP ABAP Development Tools (ADT).

> **Upgrading from 22.x?** 23.0.0 makes this package interpret nothing: every
> member answers the document SAP sent unless you give it a reading when you
> build it, and judges nothing unless you pass `analyse` with the call. Every
> reading and verdict it used to apply is a strategy in
> [`@mcp-abap-adt/adt-strategies`](../adt-strategies). The connection
> contract moved to `@mcp-abap-adt/interfaces-adt-connection`.
> [`docs/usage/MIGRATION-23.md`](docs/usage/MIGRATION-23.md) has the replacing
> code for every removed behaviour.
>
> **From 18.x?** Read [`docs/usage/MIGRATION-19.md`](docs/usage/MIGRATION-19.md)
> first: 19.0.0 is where members became one endpoint call each.
>
> **From 37.x?** 38.0.0 (on `interfaces-adt` ^23.1.0) is typed by the ADT type
> tables: a client is fixed to its release variant (`AdtClientOnPrem`,
> `AdtClientCloud`, `createAdtClient(connection, { variant })`), every type
> code is a code of the tables (the `AdtObjectType*` unions, friendly names,
> `FUNC` and the other codes no table holds are gone), an API with a parent
> takes it, and `updateMetadata` is there for fifteen more types. It also puts
> each contract where it is accepted: the result-set contracts (`IClassResults`,
> …) are imported from `@mcp-abap-adt/interfaces-adt`, and each factory answers
> its class — a consumer composes the contract it accepts from interfaces-adt.
> See [Release variants and type codes](#release-variants-and-type-codes),
> [The contract you accept is yours](#the-contract-you-accept-is-yours) and
> [`docs/usage/MIGRATION-38.md`](docs/usage/MIGRATION-38.md).
>
> **From 36.x?** 37.0.0 (on `interfaces-adt` ^20.1.0) makes
> `getSystemInformation` answer an `IAdtResponse` — present, absent (a `404`)
> or failed — and adds the required `objectProperties` slot to `IUtilResults`
> for the new `getUtils().getObjectProperties`. See
> [System-capability helpers](#system-capability-helpers) and
> [`docs/usage/MIGRATION-37.md`](docs/usage/MIGRATION-37.md).
>
> **From 35.x?** 36.0.0 (on `interfaces-adt` ^20.0.0) makes a request's
> `Accept` and `Content-Type` yours: 32 members take them as the required
> `options.headers` and send exactly that pair. See
> [A request's own headers](#a-requests-own-headers) and
> [`docs/usage/MIGRATION-36.md`](docs/usage/MIGRATION-36.md).

## Features

- ✅ **Client API** – simplified interface for common operations:
  - `AdtClient` – high-level CRUD API; one member, one ADT request
  - `AdtExecutor` – execution API via `IExecutor` contracts (class/program, with profiling)
  - `AdtRuntimeClient` – runtime operations (traces, logs, dumps, ATC check runs)
  - `AbapDebugger`, `AmdpDebugger`, `MemorySnapshots` – the ABAP and AMDP debuggers and memory snapshots, each on connections the caller opens
  - `AdtClientsWS` – realtime WebSocket facade for event-driven workflows
  - `AdtAbapGitClient` – standalone client for SAP-official ADT-integrated abapGit (`/sap/bc/adt/abapgit/*`); available on cloud and modern on-prem (ABAP Platform 2022+)
- ✅ **ABAP Unit test support** – run and manage ABAP Unit tests (class and CDS view tests)
- ✅ **Stateful session management** – maintains `sap-adt-connection-id` across operations
- ✅ **Lock registry** – persistent `.locks/active-locks.json` with CLI tools for recovery
- ✅ **TypeScript-first** – full type safety with comprehensive interfaces
- ✅ **Response headers are normalized** – ADT response headers can be non-string; normalize before parsing in contributors’ code
- ✅ **Public API is clients + supporting types** – internal builders and low-level utilities are not exported from the package root

## Responsibilities and Design Principles

### Core Development Principle

**Interface-Only Communication**: This package follows a fundamental development principle: **all interactions with external dependencies happen ONLY through interfaces**. The code knows **NOTHING beyond what is defined in the interfaces**.

This means:
- Does not know about concrete implementation classes from other packages
- Does not know about internal data structures or methods not defined in interfaces
- Does not make assumptions about implementation behavior beyond interface contracts
- Does not access properties or methods not explicitly defined in interfaces

This principle ensures:
- **Loose coupling**: Clients are decoupled from concrete implementations in other packages
- **Flexibility**: New implementations can be added without modifying clients
- **Testability**: Easy to mock dependencies for testing
- **Maintainability**: Changes to implementations don't affect clients

### Package Responsibilities

This package is responsible for:

1. **ADT operations**: Provides high-level and low-level client APIs for interacting with SAP ABAP Development Tools (ADT)
2. **Object management**: CRUD operations for ABAP objects (classes, interfaces, programs, etc.)
3. **Session management**: Maintains session state across operations using `sap-adt-connection-id`
4. **Lock management**: Handles object locking with persistent registry

#### What This Package Does

- **Provides ADT clients**: `AdtClient` and specialized clients for ADT operations
- **Manages locks**: Lock registry with persistent storage and CLI tools
- **Handles requests**: Makes HTTP requests to SAP ADT endpoints through connection interface — one request per member
- **Relays answers**: Hands back what SAP sent, read by the result strategy you built the implementation with and judged by the `analyse` you pass with the call

#### What This Package Does NOT Interpret

Nothing. Which part of a document you want, and whether an answer is a failure,
are decisions about your system and your task; since 23.0.0 no member takes
either on your behalf. The shipped result sets answer documents as they arrived;
the readings and verdicts that used to be applied here are strategies in
[`@mcp-abap-adt/adt-strategies`](../adt-strategies), which you pass by
name. See [Strategies](#strategies-what-an-answer-becomes-and-whether-it-failed).

#### What This Package Does NOT Do

- **Does NOT handle authentication**: Authentication is handled by `@mcp-abap-adt/connection`
- **Does NOT manage connections**: Connection management is handled by `@mcp-abap-adt/connection`
- **Does NOT validate headers**: Header validation is handled by `@mcp-abap-adt/header-validator`
- **Does NOT store tokens**: Token storage is handled by `@mcp-abap-adt/auth-stores`
- **Does NOT orchestrate authentication**: Token lifecycle is handled by `@mcp-abap-adt/auth-broker`

### External Dependencies

This package interacts with external packages **ONLY through interfaces**:

- **The contract packages** — the single definition site for every public type this package exposes (see [Type System](#type-system)). Their *types* are part of this package's public API; import them from the package that declares the name you need, not from the deprecated `@mcp-abap-adt/interfaces` facade:

  | package | what this package takes from it |
  |---|---|
  | [`@mcp-abap-adt/interfaces-adt`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-adt) `^23.1.0` | the ADT type tables (`ADT_TYPES_ONPREM`, `ADT_TYPES_CLOUD`, `ADT_TYPES_BASIS_740`) and their code types (`AdtTypeCode`, …), the ABAP Unit run registry (`ABAP_UNIT_RUN_TYPES`, `AbapUnitRunObjectType`, `AbapUnitRunTarget`), the capability atoms, every object's config, the result-set contracts, `IAdtAnsweredObject`, `IAdtResponse`, `IAnalyse`, `IAdtAnalyseOptions`, `IAdtHeaders`, `IResultStrategy`, `ADT_NO_FAILURE`, `ADT_TASK_TYPE` |
  | [`@mcp-abap-adt/interfaces-adt-connection`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-adt-connection) `^3.0.0` | `IAbapConnection`, `IAdtWireResponse`, `IAbapRequestOptions`, the connection capability atoms, `ADT_SESSION_ERROR` |
  | [`@mcp-abap-adt/interfaces-network`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-network) `^2.0.1` | `IWebSocketTransport` and its four companions, `HttpError` |
  | [`@mcp-abap-adt/interfaces-utils`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-utils) `^1.1.1` | `ILogger`, `LogLevel`, `XmlNode` |
  | [`@mcp-abap-adt/interfaces-auth`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-auth) `^7.5.0` — **dev only** | `IAuthProvider`, for the test helpers that open a session |
  | [`@mcp-abap-adt/interfaces-auth-sap`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-auth-sap) `^3.3.0` — **dev only** | `ISapConfig`, to build a connector in one unit test |

  Taking them by name is what keeps a consumer off one release rate for every contract: `interfaces-utils` has had two releases ever, and a package that needs only `ILogger` should move at that pace rather than at ADT's. The `@mcp-abap-adt/interfaces` facade is **deleted** — npm still serves 51.0.0 to anyone pinned to it and nothing further ships there.

  **The connection has its own package since 23.0.0.** `interfaces-adt` 11 moved the connection contract to `@mcp-abap-adt/interfaces-adt-connection` and does not re-export it: the object contracts had three majors in one day, none touching the connection, and a connector had to follow each of them or install a second copy. Import `IAbapConnection` from there.

  Earlier moves, still in force: `HttpError` is `-network`'s and `XmlNode` is `-utils`'s (both since `interfaces-adt` 9.0.0).
- **`@mcp-abap-adt/connection`**: Uses the `IAbapConnection` interface for HTTP requests — does not know about the concrete connection implementation. It is a **dev** dependency; consumers supply their own implementation.
- **`@mcp-abap-adt/adt-strategies`** (optional, same repository): the readings and verdicts, derived from recorded ADT answers. Not a dependency of this package — it depends on the contracts, and you pass its strategies into this package's members.
- **No other direct package dependencies**: all remaining interactions happen through well-defined interfaces

> **Coming from 17.x?** 18.0.0 is a breaking release — see
> [docs/usage/MIGRATION-18.0.md](docs/usage/MIGRATION-18.0.md) for what changes
> and why.

## Installation

### As npm Package

```bash
# Install globally for CLI tools
npm install -g @mcp-abap-adt/adt-clients

# Or install in project
npm install @mcp-abap-adt/adt-clients
```

## Architecture

### Public API

1. **AdtClient** (High-level, recommended)
   - CRUD operations, one ADT request per member
   - Factory pattern: `client.getClass()`, `client.getProgram()`, etc.
   - Every answer is a contract — a result or a failure, never a throw
   - Utility functions via `client.getUtils()`
   - Example: `await client.getClass().create({...}, { headers })` — the POST, and nothing else
   - **Fixed to a release variant** (since 38.0.0): `AdtClientOnPrem` (S/4HANA 2025, `ADT_TYPES_ONPREM`), `AdtClientCloud` (ABAP cloud, `ADT_TYPES_CLOUD`), or a plain `AdtClient` served what both serve. A factory or member the variant's table lacks does not compile — see [Release variants and type codes](#release-variants-and-type-codes)
   - **Legacy systems (SAP_BASIS 7.40, measured on 7.40 SP04) are a separate package**, [`@mcp-abap-adt/adt-clients-legacy`](https://github.com/fr0ster/mcp-abap-adt-clients/blob/main/packages/adt-clients-legacy/README.md): its `AdtClientLegacy` and `AdtExecutorLegacy` extend this package's classes. The consumer declares the system type by constructing them over an RFC connection (`new AdtClientLegacy(connection, logger)`); nothing here detects a system, and `createAdtClient(connection, { variant })` answers the declared modern variant's client and sends no request. They are **RFC clients**, supported and measured on SAP_BASIS 7.40 SP04 over RFC only — HTTP to a legacy system is unsupported. What each member does on 7.40 is in that package's [README](https://github.com/fr0ster/mcp-abap-adt-clients/blob/main/packages/adt-clients-legacy/README.md) and [LEGACY.md](https://github.com/fr0ster/mcp-abap-adt-clients/blob/main/packages/adt-clients-legacy/docs/LEGACY.md)

2. **AdtRuntimeClient**
   - Stable runtime operations for traces, dumps, logs, feeds, ATC check runs, and more
   - Factory accessors: `getProfiler()`, `getCrossTrace()`, `getSt05Trace()`, `getApplicationLog()`, `getAtc()`, `getAtcLog()`, `getDdicActivation()`, `getDumps()`, `getFeeds()`, `getSystemMessages()`, `getGatewayErrorLog()`
   - Each takes an optional result set (`getProfiler({ ...profilerDocuments, list: profilerTraceEntries })`) and builds a fresh implementation per call — nothing is cached, so one caller's readings never become another's
   - `getAtc()` runs ATC checks; `getAtcLog()` reads the execution and check-failure logs. Same subject, different resources — see [ATC check runs](docs/usage/CLIENT_API_REFERENCE.md#atc-check-runs)

3. **AdtExecutor**
   - Typed execution API based on `IExecutor`
   - Executors:
     - `getClassExecutor()` for `classrun`
     - `getClassTestRunner()` for a class's ABAP Unit tests: `run`, `getStatus`, `getResult` (asynchronous, the default), or `runSync` (synchronous)
     - `getProgramTestRunner()` for a report's ABAP Unit tests, in its source or its includes — `run` (asynchronous, the default) or `runSync`
     - `getFunctionGroupTestRunner()` / `getFunctionModuleTestRunner()` for a function group's tests, or a module's — `run` (asynchronous, the default) or `runSync`
     - `getAbapUnitTestRunner()`, the generic runner: `run` of an object target of any type the run registry `ABAP_UNIT_RUN_TYPES` lists (a class include, a CDS view's assigned tests, …) or of a package target, `runSync` of ADT URIs, `getStatus`, `getResult`
     - `getProgramExecutor()` for `programrun` (on-premise systems)
   - Methods: `run`, `runWithProfiler`, and trace scheduling (`scheduleTrace`, `listRequests`, `getRequestsByUri`, `listObjectTypes`, `listProcessTypes`)
   - Each executor factory takes an optional result set, like the runtime client's
   - `createAdtExecutor(connection)` returns `AdtExecutor`, like `createAdtClient` detecting nothing. The legacy executor, `AdtExecutorLegacy` of `@mcp-abap-adt/adt-clients-legacy` (SAP_BASIS 7.40 SP04, over RFC), runs ABAP Unit through the synchronous `/abapunit/testruns` request for every runner, and refuses without a request what 7.40 does not serve — the class run (`/oo/classrun`, measured `404`), `getStatus`/`getResult` (no run id) and a function module's `run` (it names no group) — and, until a run measures them, what 7.40 SP04 does not advertise: the program run (`programrun`) and the trace type lists — see [LEGACY.md](https://github.com/fr0ster/mcp-abap-adt-clients/blob/main/packages/adt-clients-legacy/docs/LEGACY.md#abap-unit-runners-and-executors)

4. **AdtAbapGitClient**
   - Standalone, not a factory on `AdtClient`: `AdtAbapGitClient.create(connection, { logger? })` answers the shipped documents (`abapGitDocuments`), `AdtAbapGitClient.create(connection, { logger?, results })` the caller's (since 38.0.0); `new AdtAbapGitClient(connection, { logger?, results })` takes its results always (the options argument, `contentTypeVersion`, was removed in 36.0.0)
   - `link`, `pull`, `unlink({ repositoryId })`, `listRepos`, `getErrorLog(logLink)`, `checkExternalRepo` — one request each; `pull` does not wait

5. **AdtClientsWS**
   - Realtime request/event facade over `IWebSocketTransport`
   - Example: `await wsClient.request('<operation>', { … })` against a backend that speaks its envelope

6. **AbapDebugger, AmdpDebugger, MemorySnapshots**
   - Standalone, from `@mcp-abap-adt/adt-clients/runtime` or the root: `AbapDebugger.create(connection, { logger?, onConflict? })` answers the shipped documents (`abapDebuggerDocuments`), `AbapDebugger.create(connection, { results, logger?, onConflict? })` the caller's; likewise `AmdpDebugger.create` and `MemorySnapshots.create` (`{ logger?, results? }`, since 38.0.0). `new AbapDebugger(connection, { results, logger?, onConflict? })` takes its results always
   - One member per request, contracts `IAbapDebugger`, `IAmdpDebugger`, `IMemorySnapshots` from `@mcp-abap-adt/interfaces-adt` (contract 18 pairs with clients 32)
   - **The identity states its mode.** `{ debuggingMode: 'user', requestUser, terminalId, ideId }`, or `{ debuggingMode: 'terminal', terminalId, ideId }`; `attach` takes the identity, not the user. A terminal-mode listener catches a run that carries its ids: `run(target, { debuggee: { terminalId, ideId } })` sends them in `SAP-PASSPORT` (since 29.1.0)
   - **Breakpoints are replaced, not added to.** `setBreakpoints` and `syncBreakpoints` replace the identity's set, and `stopListener` deletes it: arm the whole set in one call
   - **Two sessions.** The ABAP listener holds one stateful connection; each debuggee caught is attached on a new one, routed to its application server. The AMDP debugger answers events on one session and takes commands on another
   - See [Debugging](docs/usage/CLIENT_API_REFERENCE.md#debugging)

## Supported Object Types

What the library serves is declared by the ADT type tables of
`@mcp-abap-adt/interfaces-adt`, one per release variant; the factory is the
API, the codes are the tables'. ✅ the variant's table holds the API, — it does
not (the factory does not compile there). 7.40 is `AdtClientLegacy` of
`@mcp-abap-adt/adt-clients-legacy`, which serves less than its table lists
where 7.40 is not measured (its [LEGACY.md](https://github.com/fr0ster/mcp-abap-adt-clients/blob/main/packages/adt-clients-legacy/docs/LEGACY.md)).

| Object type | Factory | Codes | On premise | Cloud | 7.40 |
|---|---|---|---|---|---|
| Classes | `getClass()` | `CLAS/OC` | ✅ | ✅ | ✅ |
| Behavior implementations | `getBehaviorImplementation()` | `CLAS/OC` | ✅ | ✅ | — |
| Behavior definitions | `getBehaviorDefinition()` | `BDEF/BDO` | ✅ | ✅ | — |
| Interfaces | `getInterface()` | `INTF/OI` | ✅ | ✅ | ✅ |
| Programs | `getProgram()` | `PROG/P` | ✅ | ✅ | ✅ |
| Includes | `getInclude()` | `PROG/I` | ✅ | ✅ | ✅ |
| Enhancements | `getEnhancement()` | `ENHO/XHH`, `ENHO/XHB`, `ENHS/XSB` | ✅ | ✅ | — |
| Function groups | `getFunctionGroup()` | `FUGR/F` | ✅ | ✅ | ✅ |
| Function modules | `getFunctionModule()` | `FUGR/FF`, under its group | ✅ | ✅ | ✅ |
| Function includes | `getFunctionInclude()` | `FUGR/I`, under its group | ✅ | ✅ | ✅ |
| Domains | `getDomain()` | `DOMA/DD` | ✅ | ✅ | — |
| Data elements | `getDataElement()` | `DTEL/DE` | ✅ | ✅ | — |
| Structures | `getStructure()` | `TABL/DS` | ✅ | ✅ | — |
| Append structures | `getAppendStructure()` | `TABL/DS` | ✅ | ✅ | — |
| Tables | `getTable()` | `TABL/DT` | ✅ | ✅ | — |
| Table types | `getTableType()` | `TTYP/DA` | ✅ | ✅ | — |
| DDL sources (CDS views) | `getDdl()` | `DDLS/DF` | ✅ | ✅ | ✅ |
| Access controls | `getAccessControl()` | `DCLS/DL` | ✅ | ✅ | — |
| Metadata extensions | `getMetadataExtension()` | `DDLX/EX` | ✅ | ✅ | — |
| Service definitions | `getServiceDefinition()` | `SRVD/SRV` | ✅ | ✅ | — |
| Service bindings | `getServiceBinding()` | `SRVB/SVB` | ✅ | ✅ | — |
| Scalar functions | `getScalarFunction()` | `DSFD/SCF` | ✅ | ✅ | — |
| Scalar function implementations | `getScalarFunctionImplementation()` | `DSFI/SFI` | ✅ | ✅ | — |
| Transformations | `getTransformation()` | `XSLT/VT` | ✅ | ✅ | — |
| Message classes | `getMessageClass()` | `MSAG/N` | ✅ | ✅ | ✅ |
| Messages | `getMessageClassMessage()` | `MSAG/NN`, read from its class | ✅ | ✅ | ✅ |
| Packages | `getPackage()` | `DEVC/K` | ✅ | ✅ | — |
| Authorization fields | `getAuthorizationField()` | `AUTH` | ✅ | ✅ | — |
| Feature toggles | `getFeatureToggle()` | `FTG2/FT` | ✅ | ✅ | — |
| Local includes of a class | `getLocalTestClass()`, `getLocalTypes()`, `getLocalDefinitions()`, `getLocalMacros()` | — | ✅ | ✅ | ✅ |
| Transport requests | `getRequest()` | — | ✅ | ✅ | ✅ |

Which operations each code has — `source`, `updateMetadata`, `run`, … — is the
code's `operations` in the table; a member whose operation the variant's table
does not list for the code does not compile (`getProgram().updateMetadata()`
on a cloud client, say).

`getEnhancement().updateMetadata()` writes the whole object document from
`options.source` under the caller's lock, then the caller unlocks and activates.
This writes BAdI spot definitions and container implementations; the result slot
is `metadataUpdated`. See the [BAdI example](docs/usage/CLIENT_API_REFERENCE.md#enhancements-and-their-hosts).

Class, program and function-group handlers also expose `readEnhancementElements`
and `readEnhancementOptions` (`IAdtEnhancementHost`). `getInclude()` exposes
both through `IAdtIncludeEnhancementHost`, with `context` set to the main
program name. The default answers XML; custom result sets provide
`enhancementElements` and `enhancementOptions`. These reads live on the hosts,
not `AdtUtils`. See [enhancement examples](docs/usage/CLIENT_API_REFERENCE.md#enhancements-and-their-hosts).

## Quick Start

### Using AdtClient (Recommended - High-Level CRUD API)

```typescript
import { BasicAuthProvider } from '@mcp-abap-adt/auth-providers';
import {
  AdtOnPremConnector,
  OnPremHttpTransport,
} from '@mcp-abap-adt/connection';
import { AdtClientOnPrem, utilDocuments } from '@mcp-abap-adt/adt-clients';
import {
  utilSearchHits,
  utilWhereUsedReferences,
} from '@mcp-abap-adt/adt-strategies';

const config = {
  url: 'https://your-sap-system.example.com',
  client: '100',
  authType: 'basic' as const,
  username: process.env.SAP_USERNAME!,
  password: process.env.SAP_PASSWORD!,
};

// Three things, all stated by you: which system (the connector), which
// credential (the provider), and which wire (the transport). Since
// @mcp-abap-adt/connection 6.0.0 nothing is inferred — for ABAP Cloud take
// AdtCloudConnector + CloudHttpTransport instead; connection 16's
// createConnection({ system, transport, … }) states the same two facts. One
// instance is one SAP session: after disconnect() a new session is a new
// instance.
const connection = new AdtOnPremConnector(
  config,
  new BasicAuthProvider(config.username, config.password),
  new OnPremHttpTransport(() => ({}), console, {
    client: config.client,
    baseUrl: config.url,
  }),
  console,
);

// Required: a request on a connection nobody opened is refused before it is
// sent, and connect() fails if the server opened no session — rather than
// surfacing later as `400 Session not found` mid-edit.
await connection.connect();

// The release variant is yours to declare, like the system: an on-premise
// client is typed by ADT_TYPES_ONPREM (AdtClientCloud for ABAP cloud).
const client = new AdtClientOnPrem(connection, console);

// One member, one request: this is the POST that makes the class shell.
// Writing its source and activating it are calls of your own, below.
// The request's Accept and Content-Type are yours (see "A request's own
// headers" for the pairs).
await client.getClass().create(
  {
    className: 'ZCL_TEST',
    packageName: 'ZPACKAGE',
    description: 'Test class',
  },
  { headers: CLASS_DOCUMENT },
);

// The lock window is yours: lock, write, unlock, activate — in the order you
// choose, each answering its own contract. Deleting works the same way:
// `checkDeletion()` asks whether it can go, `delete()` does it.
const target = { className: 'ZCL_TEST' };
const locked = await client.getClass().lock(target);
if (locked.ok) {
  // The handle SAP sent — '' if it sent none, which is yours to judge.
  const lockHandle = locked.getResult().value;
  await client
    .getClass()
    .update(target, { headers: SOURCE, source, lockHandle });
  await client.getClass().unlock(target, lockHandle);
}
await client.getClass().activate(target, { headers: ACTIVATION });

// Every member answers a contract: a result or a failure, and the compiler
// makes you say which you are reading. What the result *is* was chosen when
// the implementation was built: the shipped set answers documents as they
// arrived, and a reading from @mcp-abap-adt/adt-strategies gives a shape.
const utils = client.getUtils({
  ...utilDocuments,
  search: utilSearchHits,
  whereUsed: utilWhereUsedReferences,
});

const found = await utils.search({ query: 'Z*', objectType: 'CLAS/OC' });
if (found.ok) {
  found.getResult().value;        // ISearchResult[] — the document, without utilSearchHits
} else {
  found.getError().origin;        // 'connection' | 'refusal'
  found.getError().message;       // what SAP said, verbatim
}

// Where-used: the scope, edited, then the search. Three calls since 19.0.0,
// because they are three requests — and what to do when a system has no
// /usageReferences/scope sub-resource (some S/4 releases 404 it) is a decision
// about your system, so it is yours rather than a fallback hidden in here.
const scope = await utils.getWhereUsedScope(
  { object_name: 'ZMY_TABLE', object_type: 'TABL/DT' },
  { headers: WHERE_USED_SCOPE },
);
if (!scope.ok) {
  // A refusal is an answer, not an exception flying past. `origin` says which
  // remedy applies: restore the channel, or ask the server something else —
  // two different problems that "something went wrong" hides.
  throw new Error(scope.getError().message);
}

// No request: it rewrites the document the call above returned.
const narrowed = utils.modifyWhereUsedScope(scope.getResult().value, {
  enableOnly: ['TABL/DS', 'TABL/DT'],  // or disable: ['CLAS/OC']
});

const answer = await utils.getWhereUsed(
  { object_name: 'ZMY_TABLE', object_type: 'TABL/DT', scopeXml: narrowed },
  { headers: WHERE_USED },
);

// `utilWhereUsedReferences` above is the shape the old member returned,
// offered by name rather than imposed. Without it, this is the document.
if (answer.ok) {
  const references = answer.getResult().value;
  console.log(`Found ${references.totalReferences} references`);
  for (const ref of references.references) {
    // `type` for a code of the tables, `unknownType` for any other text.
    console.log(`${ref.name} (${ref.type ?? ref.unknownType}) in ${ref.packageName}`);
  }
}
```

### Using AdtClientsWS (Realtime)

```typescript
import { AdtClientsWS } from '@mcp-abap-adt/adt-clients';
import type { IWebSocketTransport } from '@mcp-abap-adt/interfaces-network';

const transport: IWebSocketTransport = createYourTransport();
// No deadline unless you set one: a request waits for its correlated answer.
// `requestTimeoutMs` (client-wide) or `{ timeoutMs }` per request asks for one.
const wsClient = new AdtClientsWS(transport, console);

await wsClient.connect('wss://your-realtime-endpoint');

const answer = await wsClient.request('<operation>', { /* payload */ });
```

### Using AdtExecutor (Execution API)

```typescript
import { AdtExecutor, programExecutorDocuments } from '@mcp-abap-adt/adt-clients';
import { traceSchedulingProfilerId } from '@mcp-abap-adt/adt-strategies';

const executor = new AdtExecutor(connection, console);

// Class execution
await executor.getClassExecutor().run({ className: 'ZCL_MY_CLASSRUN' });

// Program execution (on-premise)
await executor.getProgramExecutor().run({ programName: 'ZMY_EXEC_REPORT' });

// Program execution under the profiler: schedule the trace, then run with the
// id it answered. Two requests, so two calls — the order is yours.
const programs = executor.getProgramExecutor({
  ...programExecutorDocuments,
  scheduled: traceSchedulingProfilerId,
});
const scheduled = await programs.scheduleTrace({
  headers: TRACE_PARAMETERS,
  allProceduralUnits: true,
  sqlTrace: true,
  allDbEvents: true,
});
if (scheduled.ok) {
  await programs.runWithProfiler(
    { programName: 'ZMY_EXEC_REPORT' },
    { profilerId: scheduled.getResult().value },
  );
}

// The run reports what it did, not what SAP will write afterwards: there is no
// trace id here. Find the trace with `runtime.getProfiler().list()` when you
// are ready — comparing against the ids you saw before the run, since position
// in the feed is not age.
```

### ABAP Unit

A unit test is not an object type: it is a local test class in a class's
`testclasses` include. So there is no unit-test handler — each part belongs to
the object it touches:

```typescript
import { classTestRunnerDocuments, createAdtExecutor } from '@mcp-abap-adt/adt-clients';
import { analyseUnitTest, analyseUnitTestStart, unitTestRunId } from '@mcp-abap-adt/adt-strategies';

// The tests: the class's testclasses include, under the class's lock.
const locked = await client.getClass().lock({ className: 'ZCL_UNDER_TEST' });
await client.getLocalTestClass().update(
  { className: 'ZCL_UNDER_TEST', source: testSource },
  { headers: SOURCE, lockHandle: locked.getResult().value },
);
await client.getClass().unlock({ className: 'ZCL_UNDER_TEST' }, locked.getResult().value);

// A CDS view's tests live in a class made for them. Whether the view can be
// tested with doubles is the view's question.
await client.getDdl().checkCdsTestDoubles('ZI_VIEW');

// Running is an executor's.
const runner = (await createAdtExecutor(connection)).getClassTestRunner({
  ...classTestRunnerDocuments,
  run: unitTestRunId,
});
const started = await runner.run('ZCL_UNDER_TEST', { analyse: analyseUnitTestStart });
const runId = started.getResult().value;
await runner.getStatus(runId, true);
const result = await runner.getResult(runId, { analyse: analyseUnitTest });
```

`run` takes a class name (every test class in it) or a list of
`{ containerClass, testClass }`. On a legacy system (`@mcp-abap-adt/adt-clients-legacy`,
measured on 7.40 SP04, over RFC) the runner's `run` sends the synchronous `/abapunit/testruns` request,
`<options>` included, and answers the finished result; `getStatus`/`getResult`
refuse without a request.

**The synchronous runner, `runSync`.** `run` starts a run on
`/sap/bc/adt/abapunit/runs`, which is then polled; that stays the default.
`runSync` is the other runner ADT has — one `POST /sap/bc/adt/abapunit/testruns`
answering the finished `aunit:runResult` — chosen explicitly by the caller.
Some systems have only this one (an on-prem S/4HANA 2023, SAP_BASIS 758, was
measured without `/abapunit/runs`); whether a system has `/runs` is in its
discovery, and reading that is the caller's — the library picks no runner by
release or by discovery.

```typescript
const result = await runner.runSync('ZCL_UNDER_TEST', { analyse: analyseUnitTest });
```

Its answer is read by the runner's `result` strategy, the one `getResult` uses:
on the measured systems (on premise and ABAP Cloud, 2026-10-22) both runners
answer the same document — `aunit:runResult` in `http://www.sap.com/adt/aunit`
— with the same methods and alerts. Two differences: the endpoint addresses
whole classes, so `{ containerClass, testClass }` targets run each distinct
container whole; and `title` and `context` are not sent. Scope, risk levels and
durations are, with `run`'s defaults. On a legacy system (`@mcp-abap-adt/adt-clients-legacy`) `run` and `runSync`
send this same request, `<options>` included — `run` read by the `run` strategy,
`runSync` by `result`.

A report's tests are local classes in its source or in an include it pulls in —
written through `getProgram().update()` or `getInclude().update()` — and run
through `executor.getProgramTestRunner().run(programName)`, with the same
`getStatus`/`getResult`. A function group's are written in an include of the
group (`getFunctionInclude()`) and run through `getFunctionGroupTestRunner()`
for the whole group or `getFunctionModuleTestRunner()` for one module. On a
legacy system (`@mcp-abap-adt/adt-clients-legacy`, measured on 7.40 SP04, over RFC) the report and group runners'
`run` and `runSync`, and the module runner's `runSync`, send the synchronous
request below, with `<options>`; the module runner's `run` refuses without a
request (it names no group, and the request needs the module's URI under its
group — use `runSync`), and so does every legacy `getStatus`/`getResult`.

All three have `runSync` as well — the same `/abapunit/testruns` request as a
class's, naming the object by its URI, read by `result` and judged by
`options.analyse`:

```typescript
await executor.getProgramTestRunner().runSync('ZREPORT', { analyse: analyseUnitTest });
await executor.getFunctionGroupTestRunner().runSync('ZGROUP', { analyse: analyseUnitTest });
await executor
  .getFunctionModuleTestRunner()
  .runSync({ functionGroupName: 'ZGROUP', functionModuleName: 'Z_MODULE' }, { analyse: analyseUnitTest });
```

Their run configuration always carries `<options>` (scope, risk levels and
durations, with `run`'s defaults). Measured on premise (SAP_BASIS 816,
2026-10-23): with it, a report (test class in its own source or in an include),
a function group and a function module each ran the same tests with the same
alerts as `run`; without it the endpoint answered `200` with an empty
`aunit:runResult`. Name the report, not the include: an include's own URI ran
nothing, its tests run through the report.

**A module's `runSync` runs its whole group's tests.** The module's URI lies
under its group's, so the target names both. On the measured system it ran
every test of the group — a test class that calls no module included — and so
did the run of a module that no test calls; the result names the group
(`FUGR/F`). `run` (`FUNC`) did the same there. The library filters nothing: a
caller who wants one module's tests reads them out of the result. With an ABAP
Doc test relation (`"! @testing FUNC:<module>`) on a test class, the default
scope answered the group's tests as a preview (`isForeign="true"`, nothing
executed) and `scope: { foreignTests: true }` ran them.

**The generic runner, `getAbapUnitTestRunner()`.** The four runners above each
fix the `osl:object type` they send (`CLAS`, `PROG`, `FUGR`, `FUNC`). The
generic one takes it from the caller, typed `AbapUnitRunObjectType` — every key
of `ABAP_UNIT_RUN_TYPES` in `@mcp-abap-adt/interfaces-adt`, and nothing else —
or runs a package:

```typescript
import { abapUnitTestRunnerDocuments } from '@mcp-abap-adt/adt-clients';

const generic = executor.getAbapUnitTestRunner({
  ...abapUnitTestRunnerDocuments,
  run: unitTestRunId,
});
// An object target: one osl:object in an osl:flatObjectSet.
await generic.run({ kind: 'object', name: 'ZCL_UNDER_TEST', type: 'CLAS/OC' });
// A CDS view's tests are assigned tests: they execute only with foreignTests.
await generic.run(
  { kind: 'object', name: 'ZI_VIEW', type: 'DDLS/DF' },
  { scope: { foreignTests: true }, analyse: analyseUnitTestStart },
);
// A package target: an osl:packageSet with one osl:package.
await generic.run({ kind: 'package', name: '$ZPKG', includeSubpackages: true });
// ADT URIs, on /abapunit/testruns, with the request's headers.
await generic.runSync(['/sap/bc/adt/oo/classes/zcl_under_test'], {
  headers: { accept: 'application/xml', contentType: 'application/xml' },
  analyse: analyseUnitTest,
});
```

Both targets go to `POST /sap/bc/adt/abapunit/runs` and are polled with
`getStatus` and `getResult`, as every runner's. **A CDS view holds no test
class**: its tests are local test classes elsewhere — a class's testclasses
include — marked `"! @testing <view>`, and they execute by `DDLS/DF` (or
`DDLS`) only when the scope sets `foreignTests: true`. Without it, the default
`addForeignTestsAsPreview: true` lists them in the result **without executing
them**: every method is there with no alert, so a failing test looks like a
pass; with the preview off too, the result is empty (measured 2026-10-29 on
S/4HANA 2025 and ABAP cloud). **A consumer reading a CDS run sets
`foreignTests: true`.** **A package** runs only as an `osl:packageSet` — `osl:object
type="DEVC/K"` answered empty (measured 2026-10-29, S/4HANA 2025 and ABAP
cloud). **A wrong type is not an error**: the endpoint answers the start `201`
and the result as an empty `<aunit:runResult/>`, which is why the type is the
compiler's to check. On a legacy system the generic runner keeps `runSync` and
refuses a target run, `getStatus` and `getResult` without a request (7.40 has
no `/abapunit/runs`).

**AdtUtils read type safety:**
`readObjectMetadata` and `readObjectSource` take the codes of the tables they
read (`AdtMetadataReadCode`, `AdtSourceReadCode`), so `'view'` or `'CLAS'` does
not compile, and a function module's group is required:

```typescript
await utils.readObjectMetadata('DDLS/DF', 'ZOK_I_CDS_TEST');
await utils.readObjectSource('DDLS/DF', 'ZOK_I_CDS_TEST');
await utils.readObjectSource('FUGR/FF', 'Z_MY_FM', 'ZMY_GROUP');
```

**Benefits:**
- ✅ One member, one ADT request — what went to the server is what you asked for
- ✅ The sequence is yours: you decide what happens between lock, write and activate, and you see every answer
- ✅ Consistent error handling — a refusal is in the answer, never a throw
- ✅ Separation of CRUD operations and utility functions
- ✅ Long polling support for object readiness

### Using Long Polling for Object Readiness

The `withLongPolling` parameter asks ADT to hold a read until the object is
available, instead of answering from whatever is there right now:

> **Measured caveat — do not rely on it for readiness.** On the ABAP Cloud system the
> parameter changes nothing on an object read. Reading a message class straight
> after creating it returned `404` in ~650ms **with** the flag — the same
> latency as without it — and the server did not hold the request. The system's
> own discovery document declares `withLongPolling` for exactly one resource out
> of 601 templates: `/sap/bc/adt/activation/runs/{run_id}`, background activation
> runs. Other systems may honour it more widely; this one does not, so treat it
> as a hint and not a guarantee. **No ADT operation that changes system state
> guarantees when the change becomes visible** — where readiness matters, poll
> with a bound.

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection);

await client.getClass().create(
  { className: 'ZCL_TEST', packageName: 'ZPACKAGE', description: 'Test class' },
  { headers: CLASS_DOCUMENT },
);

// Ask the server to hold the read until the object is available. Where the
// system honours it, this replaces an arbitrary sleep; where it does not, it
// answers at once — so read what came back rather than assuming.
const read = await client.getClass().read(
  { className: 'ZCL_TEST' },
  'active',
  { withLongPolling: true }
);
```

**What it is intended to do**, where a system honours it: avoid an arbitrary
timeout by letting the server decide when the object is ready.

**What it does not do:** guarantee the object is there when the call returns.
See the caveat above — on the system measured, the flag had no effect on object
reads at all.

**Note:** long polling is a flag on a read you make. `create()` and `update()`
issue one request each and make no follow-up read of their own since 19.0.0.

### `update()` writes the whole content

**Every type, every time: `update` replaces. It never merges.** Read the object,
change what you mean to change, pass the result. Anything you leave out is gone,
because nothing is read on your behalf to keep it.

For a class, a program or a DDL source the whole content is the **full source**.
For domain, package, dataElement, tableType, transport and message class it is
the object's own **document**, passed as `options.source` to `updateMetadata` —
the first five and the function group fetched and patched it for you until
19.0.0, the message class until 23.0.0, and none of them does now. Every type
that has both — a class, a function group, a table, … (38.0.0 added
`updateMetadata` to fifteen of them) — writes its metadata document the same way:
read it, change it, pass the whole document back.

```typescript
const cls = client.getClass();
const target = { className: 'ZCL_TEST' };

const current = await cls.read(target, 'active');
if (!current.ok) throw new Error(current.getError().message);
const edited = addAMethod(String(current.getResult().value));

const locked = await cls.lock(target);
if (!locked.ok) throw new Error(locked.getError().message);
const lockHandle = locked.getResult().value;
await cls.update(target, { headers: SOURCE, source: edited, lockHandle });
await cls.unlock(target, lockHandle);
```

Watch the read. ADT answers a read of a not-yet-ready object with **HTTP 200 and
an empty body**, never a 404, so what you edit may be nothing at all.

This package does not check what you pass, and cannot: whether a document is
complete is a question only your system can answer, and it answers it — in its
own words, on the write. That is why the rule above is worth knowing rather than
relying on being caught.

**No error strategy ships in this package**, and that is the design: whether an
answer is a failure depends on which object types you touch and what you were
doing. If you have no opinion yet,
[`@mcp-abap-adt/adt-strategies`](../adt-strategies) has one — defaults
derived from recorded ADT answers, each tested against the refusal it came from
and the success it must be told apart from.

Full detail: [`docs/usage/MIGRATION-19.md`](docs/usage/MIGRATION-19.md) for the
write rule, [`docs/usage/MIGRATION-23.md`](docs/usage/MIGRATION-23.md) for the
readings and verdicts that became strategies. Every
sequence 19.0.0 handed back to the consumer is written out under
[`examples/`](examples), one file per removed member.

### Creating Behavior Implementation Classes

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection);

await client.getBehaviorImplementation().create(
  {
    className: 'ZBP_OK_I_CDS_TEST',
    packageName: 'ZOK_TEST_PKG_01',
    behaviorDefinition: 'ZOK_I_CDS_TEST',
    description: 'Behavior Implementation for ZOK_I_CDS_TEST',
    transportRequest: 'DEVK900001'
  },
  { headers: CLASS_DOCUMENT },
);
// The class shell exists. Its `source/main` — the generated binding to the
// behavior definition — is `updateMain()`, and activation is `activate()`.
await client
  .getBehaviorImplementation()
  .activate({ className: 'ZBP_OK_I_CDS_TEST' }, { headers: ACTIVATION });
```

## Developer Tools

### ADT Discovery Script

The package includes a tool for generating documentation from the ADT discovery endpoint, which lists all available ADT API endpoints.

**Purpose:** Explore available ADT API endpoints and generate markdown documentation.

**Usage:**
```bash
# Generate discovery documentation (default output: docs/architecture/discovery.md)
npm run discovery:markdown

# Custom output file
npm run discovery:markdown -- --output custom-discovery.md

# Custom SAP system URL
npm run discovery:markdown -- --url https://your-system.com

# Custom .env file
npm run discovery:markdown -- --env /path/to/.env
```

**What it does:**
1. Connects to the SAP system using credentials from `.env` file
2. Fetches the discovery endpoint: `GET /sap/bc/adt/discovery` (via `AdtUtils.discovery()`)
3. Parses the XML response
4. Converts it to readable markdown with endpoint categories, HTTP methods, URLs, content types, and descriptions
5. Saves the pretty-printed discovery XML next to the markdown output

**Output:** 
- Default: `docs/architecture/discovery.md` and `docs/architecture/discovery.xml`
- Custom: Path specified via `--output` option, plus `discovery.xml` in the same directory

**Environment Variables:**
The script uses the same environment variables as the main package:
- `SAP_URL` - SAP system URL (required)
- `SAP_AUTH_TYPE` - Authentication type: `'basic'`, `'jwt'` or `'xsuaa'` (required: a missing or other value is refused, naming the key)
- `SAP_USERNAME` - Username for basic auth
- `SAP_PASSWORD` - Password for basic auth
- `SAP_JWT_TOKEN` - JWT token for JWT auth
- `SAP_CLIENT` - Client number (optional)

**When to use:**
- To explore available ADT API endpoints on your SAP system
- To generate up-to-date documentation for ADT API
- To understand the structure of ADT discovery responses
- To verify endpoint availability on a specific SAP system

See [Tools Documentation](tools/README.md) for complete details and options.

### The type tables' conformance check

The ADT type tables of `@mcp-abap-adt/interfaces-adt` (`ADT_TYPES_ONPREM`,
`ADT_TYPES_CLOUD`, `ADT_TYPES_BASIS_740`) are held to what each release
answers: its `typestructure`, its `discovery` and, per sample object, its
`urimapper` and metadata answers. The answers are recorded in `corpus/adt/`
(`typestructure/`, `discovery/`, `conformance/<release>/`; see
[`corpus/README.md`](corpus/README.md)).

- **In CI** — `src/__tests__/unit/conformance/typeTablesConformance.test.ts`
  runs the check against the recorded answers. What it finds is committed
  beside it: the known divergences with their reasons, the list of creates
  without `CREATE` and the collections that advertise no `app:accept` for an
  `updateMetadata` (`recorded.ts`), and the coverage (`coverage.json`). A
  change that changes what the check finds is an edit of those lists.
- **On a live system** — `src/__tests__/integration/shared/typeTablesConformance.test.ts`
  reads the same endpoints for the configured variant (`environment.system`)
  and runs the same check. It prints the system's identity and writes it
  nowhere:

  ```bash
  MCP_ENV_PATH=<env> MCP_TEST_OVERLAY=<overlay> \
    npm test -- src/__tests__/integration/shared/typeTablesConformance.test.ts
  ```

**Refreshing a release's answers.** Run the live check with
`CONFORMANCE_WRITE_DIR=<dir>` (refused when `CI` is set). It writes the
answers, scrubbed with the corpus placeholders, under `<dir>` in the corpus
layout: `typestructure/system-description-<release>--07-typestructure.*`,
`discovery/system-description-<release>--03-discovery.*` and
`conformance/<release>/` with its `_index.json`. Then:

1. Review the written files: no host, user, system id or token may be left
   (`src/__tests__/unit/corpusCarriesNoIdentity.test.ts` checks the corpus).
2. Copy them over the release's files in `corpus/adt/`. A written
   `_index.json` carries the sample, statuses, both addresses and the files;
   keep the recorded index's notes and reasons where they still hold.
3. Run `npm run corpus:format`, then the unit tests; edit `recorded.ts` and
   `coverage.json` for what the check now finds, with a reason for each
   divergence.

## API Reference

### AdtClient Overview

### What a call answers with

**Every** member answers `IAdtResponse` — a result or a failure, never both and
never neither. `client.getUtils()` did since 17.0.0; the per-type handlers do
now:

```typescript
const answer = await client.getClass().create(
  { className: 'ZCL_X', packageName: 'ZP', description: 'x' },
  { headers: CLASS_DOCUMENT },
);

if (answer.ok) {
  answer.getResult().value;   // whatever the reading makes of it
} else {
  answer.getError().origin;   // 'connection' | 'refusal'
  answer.getError().message;  // the server's own words
  answer.getError().request;  // the call that failed: method and URL
  answer.getError().response; // the document, and the status it came on
}
```

`ok` is what makes the check compulsory. `answer.getResult()` does not compile
until you have asked which half you hold — an exception is invisible to the type
system, and the caller who never learns a failure path exists is who this is for.

The state bags are gone with it. `IClassState`, `IProgramState` and the other
twenty-six were an errors array a caller had to remember to look at, next to a
handful of stored envelopes; a member answers one value now, and the failure is
in the other half of the answer.

**Two origins, and both describe the server.** `'refusal'` is SAP answering no;
`'connection'` is no answer arriving at all. A refusal SAP delivers inside a
`200` — a refused activation, a deletion the check declined — is an answer like
any other until your `analyse` says it is a failure: that is the one decision
this package leaves wholly to you.

**What throws, and what does not.** The boundary is the cause. A failure caused
by SAP's answer comes back through the strategies, with the response attached —
never as an exception, and never rewrapped into one that drops the response.
A member throws only for a cause inside the library: an argument you left out,
found before any request was built (a function include without its group, a
where-used type no vocabulary knows), or a defect. A reading that throws — your
own, or one from `adt-strategies` — surfaces as itself, not as a connection
failure, because a parser's bug is not advice to reauthenticate.

**A refused credential.** The connection raises one refusal
(`AuthRefusedError`) for two different things, and they come back differently:

- **SAP refused the credential** — a `401` the credential provider could not
  renew. That is SAP's answer: a failure with `origin: 'connection'`, the
  refusal's message and SAP's `401` response. `analyse` sees it but cannot
  clear it.
- **The provider refused before SAP was asked** — a login that ended, a token
  the identity provider will not renew. There is no answer to come back, and
  every further request would only ask the provider again, so the member
  **rejects** with the refusal as it came, the same object. Catch it where you
  walk many objects: it is your signal to stop.

A refusal is recognised by its shape — own data properties `refusal` (with
string `kind` and `reason`) and `at`, and no `response` of its own — not by
`instanceof`, since this package does not depend on the connection. That is a
passthrough convention: anything carrying the shape is passed on as it came.
SAP answered only when the refusal's cause, one level down, carries a response
of status `401` (`cause.response.status === 401`); any other status there — an
identity provider's `400 invalid_grant` a provider threw — is not SAP's, and
the refusal rejects.

No part of this library converts, wraps or swallows a refusal SAP never saw.
A multi-step member (a lock, a write, an unlock) still runs its unlocks and
rollbacks, then rejects with the same object; a rollback that did not complete
is logged, not added to it. `unlockAll()` and `await using` stop at it, the
locks not yet released staying in `pendingLocks`. An `AdtBatchConnection`
whose envelope is refused rejects every part — sent, unsent or recorded while
settling — with that same object, not with the "not sent" error.

The transport frame is `IAdtWireResponse`. It is the shape the connection layer
speaks and lives at that boundary; `IAdtResponse` names what a member answers
with.

### Strategies: what an answer becomes, and whether it failed

Two strategies shape every answer, and neither is this package's:

- the **result strategy** — what the answer *becomes* — is given **once, when
  you build the implementation**: one result set per object type, one slot per
  member;
- the **error strategy** — whether the answer is a *failure* — is given **with
  every call**, as `options.analyse`.

The shipped result sets (`classDocuments`, `transportDocuments`,
`utilDocuments`, `profilerDocuments`, … — one per implementation) answer the
document as it arrived (`rawDocument`), or nothing (`nothing`) where there is
nothing to read. No member supplies an `analyse` of its own. Every reading and
verdict this package used to apply is a named strategy in
[`@mcp-abap-adt/adt-strategies`](../adt-strategies):

```typescript
import { transportDocuments } from '@mcp-abap-adt/adt-clients';
import {
  analyseDeletion,
  transportSearchConfigurations,
  transportTree,
} from '@mcp-abap-adt/adt-strategies';

// Result strategies: once, at construction.
const requests = client.getRequest({
  ...transportDocuments,
  list: transportTree,
  searchConfigurations: transportSearchConfigurations,
});

// Error strategy: per call.
await client
  .getPackage()
  .delete(
    { packageName: 'ZPKG' },
    { headers: DELETION, analyse: analyseDeletion },
  );
```

### The reading is yours, and you choose it once

What a member's result *becomes* is a strategy — `(answer: IAdtWireResponse) => T`
— and you give it to the implementation when you build it, not at the call:

```typescript
import { AdtClient, classDocuments, rawDocument } from '@mcp-abap-adt/adt-clients';

// The shipped reading: each member answers the document as it arrived.
client.getClass();

// Your own, for every member of this class implementation.
const parsed = client.getClass({
  ...classDocuments,
  source: (answer) => myParser(String(answer.data)),
});

const answer = await parsed.read({ className: 'ZCL_X' });
answer.ok && answer.getResult().value;   // whatever myParser returns
```

Once, not per call: a backup tool wants documents whole for everything it
touches, a script wants two fields from every read, an MCP server picks by what
its model is about to do — and none of them changes its mind between `create`
and `read` of the same object. So there are no `parse` parameters, no
`readWith`, and no second member that differs only in how far it read: `search`
and `searchObjects` were one endpoint under two names, and so were
`list`/`listNodes` and eight service-binding pairs. One endpoint, one member.

The other half of the same idea is `analyse`, per call, because *whether* an
answer is a failure can depend on what you are doing:

```typescript
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';

// An empty read is absence here, and the caller says so.
await client.getClass().read(
  { className: 'ZCL_X' },
  'active',
  {
    analyse: (verdict, answer) =>
      verdict === ADT_NO_FAILURE && String(answer?.data ?? '') === ''
        ? { origin: 'refusal', message: 'ZCL_X does not exist' }
        : verdict,
  },
);
```

- Factory accessors for ADT objects: `client.getClass()`, `client.getProgram()`, `client.getDdl()` (DDL sources — CDS views, AMDP table functions; formerly `getView()`), `client.getTable()`, `client.getScalarFunction()`, `client.getScalarFunctionImplementation()`, `client.getAppendStructure()`, `client.getRequest()`, `client.getUtils()`, etc.
- Each accessor returns its `Adt*` class, typed to its **honest capability set** (since 8.0.0, completed in 12.0.0): the class implements only the capability atoms that object actually supports, written positively — there is no composite at all, and none named for what an object lacks. Since 38.0.0 the accessor answers the class itself (`AdtClass<R>`, …), not a composition of its atoms. Calling a capability a handler lacks — e.g. `client.getDomain().getVersions(...)` — is a **compile error** rather than a runtime throw. See the [Type System](#type-system) section.
- See `src/index.ts` for the full type exports and object configs.

### AdtObject Methods (with Long Polling Support)

All `AdtObject` implementations accept the `withLongPolling` parameter on read operations (whether the server acts on it is another matter — see the caveat above):

```typescript
// Read with long polling - waits for object to be ready
await adtObject.read(config, 'active', { withLongPolling: true });

// Read metadata with long polling
await adtObject.readMetadata(config, { withLongPolling: true });

// Read metadata with explicit version
await adtObject.readMetadata(config, { version: 'active' });

// Read transport info with long polling
await adtObject.readTransport(config, { withLongPolling: true });
```

**When to use long polling:**
- After `create()` operations - wait for object to be available
- After `update()` operations - wait for changes to be persisted
- After `activate()` operations - wait for object to be available in active version
- In tests - replace fixed `setTimeout` delays with long polling for better reliability

A member answers one value — what the reading made of the answer — and a failure
in the other half:

```typescript
const answer = await client.getFunctionModule().create(
  {
    functionGroupName: 'ZFGROUP',
    functionModuleName: 'ZFM_TEST',
    description: 'Test FM',
  },
  { headers: FUNCTION_MODULE_DOCUMENT },
);

if (!answer.ok) throw new Error(answer.getError().message);
console.log(answer.getResult().value);   // the create's document, by default
```

There is no chain behind it: `create()` is the POST, and the lock, write,
unlock and activation around it are calls of your own, each with its own answer.

### A request's own headers

Since 36.0.0 (`@mcp-abap-adt/interfaces-adt` 19.0.0) a member whose request
sets both `Accept` and `Content-Type` takes them from you, as
`options.headers: IAdtHeaders` (`{ accept, contentType }`, both required). The
member sends exactly that pair: it keeps no type of its own for that request,
and nothing is merged in, defaulted or replaced. The options are required with
it, and a positional parameter before them that was optional is now
`T | undefined` — pass `undefined` explicitly.

The 32 members: `link`, `pull`, `checkExternalRepo` (abapGit); `create`,
`update`, `updateMetadata`, `delete`, `checkDeletion`, `check`, `activate` (the
object handlers); `checkState` (feature toggle); `removeObject`, `addObject`,
`createTask`, `changeTaskType`, `moveObjects` (transport request);
`getWhereUsed`, `getWhereUsedScope`, `getVirtualFoldersContents`,
`fetchNodeStructure`, `activateObjectsGroup`, `checkDeletionGroup`,
`deleteObjectsGroup`, `getSqlQuery`, `getTableContents` (`getUtils()`);
`scheduleTrace` (executors); `setBreakpoints`, `getChildVariables`,
`getVariables`, `syncBreakpoints`, `setDebuggerSettings` (`AbapDebugger`);
`getDataPreview` (`AmdpDebugger`). Every other member is unchanged, and a read
still takes an optional `accept` (`IReadOptions`).

- Members that sent only one of the two before — `create` of a function group,
  message class and message class message, `update` of a feature toggle and a
  message class message, `updateMetadata` of a message class, `delete` of a
  metadata extension and a transport request — send the whole pair now. So do
  the requests that sent neither: a transport request's `checkDeletion`, and
  the direct `DELETE` of the legacy client's class, interface, program, DDL
  source, function group and function module (now in `@mcp-abap-adt/adt-clients-legacy`).
- A message class message's `create`, `update` and `delete` are a chain (read,
  two locks, the `PUT`, two unlocks): the pair is the `PUT`'s; the chain's own
  requests keep their types.
- `AdtContentTypesBase` / `AdtContentTypesModern` still answer pairs for some
  creates (`classCreate()`, `programCreate()`, …), which you can pass as
  `headers`; the members themselves no longer read the `contentTypes` option
  for them. It (and `unicode`) still decides the artifact type inside a
  check-run document and a class's `readMetadata` `Accept`. abapGit's
  `contentTypeVersion` option is removed.
- An enhancement's `check` takes the `CHECK_RUN` pair below, as every other
  `check` does (since 36.0.2). 35.0.0 sent
  `application/vnd.sap.adt.checkrun.v1+xml` for both, which SAP refuses `415`;
  see [the corrected pairs](docs/usage/MIGRATION-36.md#the-corrected-pairs-measured).

The pairs 35.0.0 chose for itself, for the samples below (a modern system):

```typescript
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';

const CLASS_DOCUMENT: IAdtHeaders = {
  accept: 'application/vnd.sap.adt.oo.classes.v4+xml',
  contentType: 'application/vnd.sap.adt.oo.classes.v4+xml',
};
const SOURCE: IAdtHeaders = {
  accept: 'text/plain',
  contentType: 'text/plain; charset=utf-8',
};
const ACTIVATION: IAdtHeaders = {
  accept: 'application/xml',
  contentType: 'application/vnd.sap.adt.activation+xml',
};
const CHECK_RUN: IAdtHeaders = {
  accept: 'application/vnd.sap.adt.checkmessages+xml',
  contentType: 'application/vnd.sap.adt.checkobjects+xml',
};
const DELETION: IAdtHeaders = {
  accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
  contentType: 'application/vnd.sap.adt.deletion.request.v1+xml',
};
const WHERE_USED_SCOPE: IAdtHeaders = {
  accept: 'application/vnd.sap.adt.repository.usagereferences.scope.response.v1+xml',
  contentType: 'application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml',
};
const WHERE_USED: IAdtHeaders = {
  accept: 'application/vnd.sap.adt.repository.usagereferences.result.v1+xml',
  contentType: 'application/vnd.sap.adt.repository.usagereferences.request.v1+xml',
};
const TRACE_PARAMETERS: IAdtHeaders = {
  accept: 'application/xml',
  contentType: 'application/xml',
};
const FUNCTION_MODULE_DOCUMENT: IAdtHeaders = {
  accept: 'application/vnd.sap.adt.functions.fmodules+xml',
  contentType: 'application/vnd.sap.adt.functions.fmodules+xml',
};
```

### Accept Negotiation (removed in 36.0.0)

A refused request is the call's answer: SAP's `406` (its `Accept` not served)
or `415` (its `Content-Type` not accepted) comes back like any other status,
and nothing is corrected, sent again or remembered for a later request.
**Accept negotiation was removed in 36.0.0** — the retry, the per-connection
caches, the `enableAcceptCorrection` option, `setAcceptCorrectionEnabled` /
`getAcceptCorrectionEnabled`, `ADT_ACCEPT_CORRECTION`, `clearAcceptCache`,
`cachedAccept`, `rememberAccept`, `exemptFromAcceptNegotiation` and
`getBaseRequest`. A member sends exactly the request it was given, `headers`
included.

To correct a request yourself, read what SAP named and send it again with the
pair you choose. When SAP checks each header, and what a request has already
done when it answers `406` or `415` (a `406` on a write may come after the
work, which may or may not have been rolled back), is in [When SAP checks `Accept` and `Content-Type`](docs/usage/SAP_HEADER_CHECKS.md). Two pure functions over the error are exported:

- `extractSupportedAccept(error)` — the list SAP writes into its `406` body,
  `Accepted content types: …` (often empty; measured on an on-premise system).
  It reads no header and no other text.
- `extractSupportedContentType(error)` — the list SAP writes into its `415`
  body, `Supported Media Types: …` (absent from a bare `Unsupported Media
  Type`; measured on an on-premise system). It reads no header — the `415`'s
  own `content-type` is its error document's — and no other text (36.0.1).

```typescript
import { extractSupportedAccept } from '@mcp-abap-adt/adt-clients';

const first = await cls.check(config, undefined, { headers: CHECK_RUN });
if (!first.ok && first.getError().response?.status === 406) {
  const accepted = extractSupportedAccept(first.getError());
  if (accepted.length > 0) {
    await cls.check(config, undefined, {
      headers: { ...CHECK_RUN, accept: accepted.join(', ') },
    });
  }
}
```

What you learn is yours to keep: nothing in this package stores it.

### Handler classes exported directly

The documented route to a handler is a factory — `client.getScalarFunction()` —
which wires the connection, logger and system context for you. The classes are
also exported for the rarer case of constructing one against a connection you
hold yourself:

<!-- surface:begin -->
`AdtAppendStructure`, `AdtMessageClass`, `AdtMessageClassMessage`,
`AdtScalarFunction`, `AdtScalarFunctionImplementation`, `AdtServiceBinding`.
<!-- surface:end -->

### System-capability helpers

<!-- surface:begin -->
`getSystemInformation`, `isModernAdtSystem`, `resolveContentTypes`,
`fetchDiscoveryEndpoints`, `isEndpointInDiscovery`, `createAdtClient`
<!-- surface:end -->

- `getSystemInformation(connection, options?)` — an `IAdtResponse` of
  `{ present: true, info }` (the system record), or `{ present: false }` for a
  `404` (the endpoint absent, as on premise). Any other status, no answer, or a
  `2xx` whose body is no JSON object is a failure, through `options.analyse`
  like any member's.
- `isModernAdtSystem(connection)` — whether `/sap/bc/adt/core/discovery` is
  served. S/4 HANA and BTP expose it; BASIS 7.40 and below only have
  `/sap/bc/adt/discovery`.
- `resolveContentTypes(connection)` — picks `AdtContentTypesModern` (v2+
  headers) or `AdtContentTypesBase` (v1, universal) from that answer.
- `fetchDiscoveryEndpoints(connection)` / `isEndpointInDiscovery(...)` — the
  discovery document and a membership test over it.
- `createAdtClient(connection, { variant, logger?, …options })` —
  `AdtClientOnPrem` for `variant: 'onprem'`, `AdtClientCloud` for `'cloud'`
  (since 38.0.0; it took `(connection, logger?, options?)` before). It detects
  nothing and sends no request (since 37.4.0): the consumer declares the system
  type, and a legacy system is served by `AdtClientLegacy` of
  `@mcp-abap-adt/adt-clients-legacy`, an RFC client constructed by the consumer.
  What it serves and what it refuses is in
  [LEGACY.md](https://github.com/fr0ster/mcp-abap-adt-clients/blob/main/packages/adt-clients-legacy/docs/LEGACY.md).

**A probe answers only for an absent endpoint.** For `isModernAdtSystem` and
`fetchDiscoveryEndpoints` a `404`, `405` or `501` is the answer `false` or an
empty set stands for. Any other failure — no network, an expired session, a
`401`, a `500` — is raised, since 23.0.0: it says nothing about the system, and
swallowing it handed a legacy client to a modern system reached over a broken
connection (the factory no longer calls it).

`getSystemInformation` answers rather than raises, and only a `404` is the
endpoint absent. A malformed answer is not a system without the endpoint:

```typescript
import { getSystemInformation } from '@mcp-abap-adt/adt-clients';

const answer = await getSystemInformation(connection);
if (!answer.ok) {
  // Another status, no answer, or a 2xx that is not the record.
  throw new Error(answer.getError().message);
}
const found = answer.getResult().value;
const user = found.present ? found.info.userName : undefined; // absent: a 404
```

A caller whose system must have the endpoint names a `404` a failure with its
own `analyse`; one that read a `405` or `501` as absent (23.0.0–36.x) clears
them with `analyse` and gets `{ present: false }`.

The parsers that used to sit here — `parseSearchResults`, `parseTransportTree`,
`parseCreatedTransport` — are readings, and are in `@mcp-abap-adt/adt-strategies`
as `readSearchHits`, `transportTree` and `transportCreated`. A reading takes a
wire response, so a document you already hold (a batch result, a fixture, a
capture) is read with `transportTree({ status: 200, statusText: 'OK', headers: {}, data: xml })`.

`src/index.ts` is the full surface; everything reachable from it is public and
everything else is not.

## Type System

### Single Definition Site: the contract packages

Since **7.5.0**, every contract type is **defined once**, in the contract packages — today `@mcp-abap-adt/interfaces-adt` (`^23.1.0`) for the ADT contracts and `@mcp-abap-adt/interfaces-adt-connection` (`^3.0.0`) for the connection. This package declares no copies of its own — every `IXxxConfig`, the capability atoms, the result-set contracts a factory accepts (`IClassResults`, …, since 38.0.0), the option and response types and the cross-cutting shared types all live there.

**Import them from the package that owns them:**

```typescript
import type { IClassConfig, IProgramConfig } from '@mcp-abap-adt/interfaces-adt';
```

The `IXxxState` half of every pair is gone: a member answers a value and a
failure, and neither is a state bag. What a *reading* produces is not a contract
type either — it belongs beside the reading that builds it, and since 23.0.0 the
readings are in `@mcp-abap-adt/adt-strategies`:

```typescript
import type {
  IObjectVersion,
  ISearchResult,
  ITransportTree,
} from '@mcp-abap-adt/adt-strategies';
```

A contract carries what is needed to use it or to replace it. `ITransportTree`
is neither: swap in your own reading and it is your shape that comes back, so
the contract naming one would be describing an implementation.

Since **9.0.0** this is the only route: the package no longer re-exports types it does not own. It used to republish 145 of them, which was more than half its public surface — so a consumer could hold `IClassConfig` believing it came from this client, and a type would appear to change whenever this client released, for reasons that had nothing to do with it. Types now travel on the contract package's release cycle, which is where they are actually decided.

What this package exports is what it owns: the clients, the handler classes, the batch and runtime facades, the default result sets each implementation is built with (`<x>Documents`; the client result-set contracts they satisfy are interfaces-adt's since 38.0.0, the executor, runtime and abapGit ones are still here), the building blocks `rawDocument`, `nothing`, `wireItself` and `nothingIsARefusal`, and a few helpers.

### Honest capability types (since 8.0.0)

`@mcp-abap-adt/interfaces-adt` has **capability atoms and nothing above them** — `IAdtCreatable`, `IAdtReadable`, `IAdtMetadataReadable`, `IAdtUpdatable`, `IAdtMetadataUpdatable`, `IAdtDeletable`, `IAdtValidatable`, `IAdtCheckable`, `IAdtActivatable`, `IAdtLockable`, `IAdtVersionable`, `IAdtTransportAware`, `IAdtEnhancementHost`, `IAdtIncludeEnhancementHost` — each covering one operation against one resource. **There is no composite.** `IAdtObject`, `IAdtCrud`, `IAdtModifiable` and `IAdtSourceObject` were removed in interfaces 29.0.0: they forced one result type on members that answer different things, and a create does not answer what a read answers. `IAdtSearchable` went in 30.0.0 — searching is not something an object does to itself, and the question already had a home in `IAdtInformationSystem.search`. A handler declares the atoms it honours, so there is nothing a composite could drift from.

Since **8.0.0**, each handler `implements` only the atoms it genuinely supports, and `AdtClient.getXxx()` return types are narrowed to match:

```typescript
client.getClass().getVersions({ className: 'ZCL_X' });   // ✅ classes have version history
client.getDomain().getVersions({ domainName: 'ZD_X' });  // ❌ compile error — domains have no /source/main
```

Previously the second call compiled and threw `ADT_UNSUPPORTED_OPERATION` at runtime; now the type system rejects it. This is why 8.0.0 is a major: it is breaking **only** for code that called a capability a handler never had (i.e. code that always threw).

`IAdtObject` was that later major: it and the other composites are **gone as of interfaces 29.0.0**. A consumer holding one writes the intersection they need, spelled from atoms.

Since **9.0.0** no accessor returns the wide type, and since **12.0.0** none returns a type carrying a method that throws — including `getRequest()`, `getFeatureToggle()` and `getServiceBinding()`, which were the last three.

Since **24.0.0** there is no unit-test handler at all: every member `getUnitTest()` and `getCdsUnitTest()` had was another handler's request under a second name — the class's create, the local test class's read, update and delete. What was left, running, is `AdtExecutor.getClassTestRunner()` (`IAdtRunnable` plus `ITestRunInformation`), and the CDS test-doubles check is `getDdl().checkCdsTestDoubles()`. See [MIGRATION-24.md](docs/usage/MIGRATION-24.md).

Since **25.0.0** ATC takes programs and every kind of include, `interfaces-adt` is `^12.0.0`, group operations refuse a reference they cannot address before any request, and a legacy client (since 37.4.0 in `@mcp-abap-adt/adt-clients-legacy`) answers a refusal for an object type the system lacks instead of throwing. See [MIGRATION-25.md](docs/usage/MIGRATION-25.md).

The runtime client narrows the same way. `AdtRuntimeClient.getAtc()` implements `IAtcRunStatusReadable & IAtcFindings`, plus `resolveCheckVariant`, `listCheckVariants`, `createWorklist` and `startRun` — a check run is three requests, started and then read, never created, locked, activated or versioned, and the type says so rather than offering the rest and throwing. It is not `IAdtRunnable` since 19.0.0: that atom's `run` is one call.

**A guard keeps this true.** `src/__tests__/unit/capabilities/` compares what every factory answers (its class, since 38.0.0) against the atoms in both directions at compile time, refuses a public method of `AdtUtils`, `AdtFeatureToggle` or `AdtServiceBinding` that no interfaces-adt atom declares, calls every method of every declared capability against a recording connection to check it issues the request its capability names, and fails if a new factory appears without an entry. Adding a throwing method back to a narrowed handler stops compiling. The guard walks `AdtClient`; the legacy package runs the same guard over `AdtClientLegacy`; the runtime accessors are pinned by `src/__tests__/unit/clients/AdtRuntimeClient.factory.test.ts`.

One category deliberately remains local, because it is code, not contract:

- Runtime (value) exports:
  <!-- surface:begin -->
  `resolveBindingVariant`
  <!-- surface:end -->
  `SERVICE_BINDING_VARIANT_MAP` is **not** among them since 9.0.0 — it is defined in
  `@mcp-abap-adt/interfaces-adt` and is imported from there, like every other type and constant that package owns.
  `ENHANCEMENT_TYPE_CODES` and the enhancement URL helpers (`getEnhancementBaseUrl`, `getEnhancementUri`,
  `supportsSourceCode`, `isImplementationType`, `isSpotType`) were listed here but never exported; they are
  internal to `core/enhancement` and stay that way. Nothing outside this package asked for them, and an export
  is a promise to keep.

**Contract consolidation (since 11.0.0).** `IAdtClientOptions` and `IAdtSystemContext` —
this client's constructor options and system context — used to be declared here on the
theory that they describe *this client* rather than the wire contract. That reasoning did
not survive contact with the package's own purpose: a consumer must import them to
configure the client at all, so they belong with everything else a consumer imports to use
the library. They now live in `@mcp-abap-adt/interfaces-adt`, alongside `IAdtContentTypes` /
`IAdtHeaders` (the header-provider contract — `AdtContentTypesBase` and
`AdtContentTypesModern`, the two shipped implementations, stay here), the three `IBatch*`
shapes, the twelve abapGit types, the ten executor types, and the debugger and memory-snapshot
contracts (`IAbapDebugger`, `IAmdpDebugger`, `IMemorySnapshots`, 13.1.0). This
package no longer declares or exports any contract type — every contract name it uses is
sourced from the contract packages.

> **Version pairing.** `adt-clients` 32 pairs with `interfaces-adt` 18 and `interfaces-adt-connection` 3 (the enhancement subtype and host contracts), and `adt-strategies` 0.12.0 declares the same ranges. Because the types are sourced rather than copied, `@mcp-abap-adt/interfaces-adt` and `@mcp-abap-adt/interfaces-adt-connection` are hard peers of this package's public API. A major bump there implies a bump here; keep the two in step rather than letting a resolver pick a mismatched pair.

### Release variants and type codes

Since **38.0.0** the library is typed by the ADT type tables of
`@mcp-abap-adt/interfaces-adt`: `ADT_TYPES_ONPREM` (S/4HANA 2025),
`ADT_TYPES_CLOUD` (ABAP cloud) and `ADT_TYPES_BASIS_740` (SAP_BASIS 7.40). Each
names the APIs the library offers on that release — one per factory — with
their codes, and for each code its parent API, its name length and the
operations the library performs there. The tables are the library's
declaration; the [conformance check](#the-type-tables-conformance-check) holds
them to what each release answers.

- **The variant is declared, never detected.** `AdtClient<V>` is fixed to one:
  `AdtClientOnPrem`, `AdtClientCloud`, or the plain `AdtClient`, served what
  both modern tables serve. `createAdtClient(connection, { variant, logger })`
  answers the declared one. A SAP_BASIS 7.40 system is `AdtClientLegacy`
  (`AdtClient<'basis740'>`) of `@mcp-abap-adt/adt-clients-legacy`.
- **The gates are types.** A factory takes `this: this & AdtServedBy<'<api>'>`
  and a member whose availability differs by variant `this: this &
  AdtPerformedBy<'<api>', '<operation>'>`: a factory or operation the variant's
  table lacks is a compile error naming it. The executors and ABAP Unit runners
  (`AdtExecutor<V>`) are gated the same way.
- **A code is a code of the tables.** Every code taken or answered is an
  `AdtTypeCode` (`'CLAS/OC'`, `'FUGR/FF'`, `'TABL/DT'`, …) or a subset of it
  (`AdtSourceTypeCode`, `AdtCodeOf<V>`, the `getUtils()` code sets). No
  friendly name, bare R3TR type or lower-case spelling is taken. `VIEW/DV` is
  a group-only code: group activation, group deletion and where-used address
  it, and no factory serves it.
- **An API with a parent takes it.** A function module and a function include
  are addressed under their function group: their members, a
  `readObjectSource('FUGR/FF', name, group)` and an
  `IObjectReference<'FUGR/FF'>` require the group.
- **What an answer names is `type` or `unknownType`.** A reading of
  `@mcp-abap-adt/adt-strategies` that takes a code from an answer answers an
  `IAdtAnsweredObject`: `type` for a code a table holds, `unknownType` — the
  text as ADT sent it — for any other.

`src/__tests__/unit/typeCodeLiterals.test.ts` (one per package) holds the
source to it: a code literal passes only where the compiler types it by the
tables, and a code named in a comment or inside a longer string (a message,
an XML template's span) is a code of the tables.

### The contract you accept is yours

Since **38.0.0** a contract lives in the package that accepts it. A factory
accepts a result set, so the result-set contracts are
`@mcp-abap-adt/interfaces-adt`'s; a consumer accepts the client, so the client
contract is the consumer's. This package declares no composition: each factory
answers its own class, and the class's members are what the factory offers.

A consumer composes the contract it accepts from interfaces-adt alone — the
factories it calls, each answering the atoms whose members it calls, generic
over the result-set contract it is given — and types its code against it. The
compiler checks, where the client is taken, that `AdtClient`,
`AdtClientLegacy` or the consumer's own implementation satisfies it:

```typescript
import type {
  IAdtLockable,
  IAdtReadable,
  IAdtUpdatable,
  IClassConfig,
  IClassResults,
} from '@mcp-abap-adt/interfaces-adt';
import { classDocuments, createAdtClient } from '@mcp-abap-adt/adt-clients';

interface IMyClient {
  getClass<R extends IClassResults>(
    results: R,
  ): IAdtReadable<IClassConfig, ReturnType<R['source']>> &
    IAdtLockable<IClassConfig> &
    IAdtUpdatable<Partial<IClassConfig>, ReturnType<R['updated']>>;
}

const client: IMyClient = await createAdtClient(connection, {
  variant: 'onprem',
  logger,
});
const classes = client.getClass(classDocuments); // read answers a string
```

`src/__tests__/unit/clients/consumerContract.test.ts` holds this package to it:
such a contract accepts `AdtClient` and an object written by hand, and refuses
one missing a member it names; the legacy package proves the same of
`AdtClientLegacy`.

### Naming Conventions

The package uses **dual naming conventions** to distinguish API layers:

#### Low-Level Parameters (snake_case)

Used by internal ADT API functions.

#### AdtObject Configuration (camelCase)

Used by `AdtClient` and `Adt*` object configs:

```typescript
interface IClassConfig {
  className: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  source?: string;
}
```

This dual convention:
- Makes low-level/high-level distinction clear
- Matches SAP ADT XML parameter naming (`class_name` in ADT requests)
- Provides familiar camelCase for JavaScript/TypeScript consumers
- Enables proper type checking at each layer

See [Architecture Documentation](docs/architecture/ARCHITECTURE.md#type-system-and-exports) for details.

## Migration Guide

One document per breaking release, each written for a consumer on the contract
before it:

- **[37.x → 38.0.0](docs/usage/MIGRATION-38.md)** — the ADT type tables decide: a client is fixed to its release variant, every type code is a code of the tables, an API with a parent takes it, answered objects are `type` / `unknownType`, and `updateMetadata` covers fifteen more types; the result-set contracts are imported from `@mcp-abap-adt/interfaces-adt`, and each factory answers its class, so a consumer composes the contract it accepts from interfaces-adt.
- **[36.x → 37.0.0](docs/usage/MIGRATION-37.md)** — `getSystemInformation` answers an `IAdtResponse` (present, absent for a `404`, or a failure, through `options.analyse`), and `IUtilResults` has the required `objectProperties` slot.
- **[35.x → 36.0.0](docs/usage/MIGRATION-36.md)** — a request's `Accept` and `Content-Type` are the caller's: 32 members take the required `options.headers` and send exactly that pair.
- **[34.x → 35.0.0](docs/usage/MIGRATION-35.md)** — accept negotiation is off by default: a `406`/`415` is the call's answer unless you switch it on.
- **[33.x → 34.0.0](docs/usage/MIGRATION-34.md)** — a batch corrects and resends nothing: a part's `406`/`415` is that call's answer.
- **[32.x → 33.0.0](docs/usage/MIGRATION-33.md)** — a credential the provider refused before SAP was asked rejects with the connection's refusal as it came; a `401` SAP refused it with comes back carrying that response.
- **[31.x → 32.0.0](docs/usage/MIGRATION-32.md)** — interfaces-adt 18, three enhancement subtypes, subtype-specific create fields, two new result slots for enhancement hosts, and `metadataUpdated` for enhancement document writes.
- **[30.x → 31.0.0](docs/usage/MIGRATION-31.md)** — `interfaces-adt` 16 and
  `interfaces-adt-connection` 3: the per-request `signal`, `ADT_REQUEST_ERROR`
  and `IAdtError.refusal` are gone; code written for 30.x compiles unchanged.
- **[29.x → 30.0.0](docs/usage/MIGRATION-30.md)** — `getRequest()` gains
  `sortAndCompress` and `moveObjects`; `ITransportResults` has two more
  required slots, `sortedAndCompressed` and `movedObjects`.
- **[22.x → 23.0.0](docs/usage/MIGRATION-23.md)** — readings and verdicts became
  strategies in `@mcp-abap-adt/adt-strategies`; the connection contract moved
  to `@mcp-abap-adt/interfaces-adt-connection`; `list` takes a `configUri`;
  abapGit, unit tests and versions answer what SAP sent.
- **[18.x → 19.0.0](docs/usage/MIGRATION-19.md)** — one member, one endpoint
  call; `update` takes the whole content.
- **[17.x → 18.0.0](docs/usage/MIGRATION-18.0.md)** — the sequence around a
  write is yours.

### From timeouts to long polling

`withLongPolling` on a read you make is the better default than a fixed sleep —
but it is **not** a readiness guarantee: see the measured caveat above. No
member uses it on your behalf; `create()` and `update()` issue one request each.

### Builderless API

- `CrudClient`, `ReadOnlyClient`, and Builder classes are removed in the builderless API.
- Use `AdtClient` and the `Adt*` objects (`client.getClass()`, `client.getDdl()`, etc.).

## Documentation

- **[Documentation index](docs/README.md)**
- **[Migrating to 23.0.0](docs/usage/MIGRATION-23.md)** – the replacing code for every removed behaviour
- **[Client API reference](docs/usage/CLIENT_API_REFERENCE.md)** – every client, member and result set
- **[SAP ADT errata](docs/usage/ERRATA.md)** – what SAP ADT answers that a caller would misread: a `403` on a service binding's LOCK, which Eclipse ignores, and why `analysePublicationLock` exists. Ships in this package under `docs/usage/`, and in `@mcp-abap-adt/adt-strategies`
- **[Architecture](docs/architecture/ARCHITECTURE.md)** – package structure and design decisions
- **[Decisions](docs/architecture/DECISIONS.md)** – the choices that could have gone the other way, and why
- **[Operation Delays](docs/usage/OPERATION_DELAYS.md)** – configurable delays for SAP operations in tests
- **[Test Configuration Schema](docs/development/TEST_CONFIG_SCHEMA.md)** – YAML test configuration reference

## Logging and Debugging

The library uses a **5-tier granular debug flag system** for different code layers:

### Debug Environment Variables

```bash
# Connection package logs (HTTP, sessions, CSRF tokens)
DEBUG_CONNECTORS=true npm test

# Core library logs
DEBUG_ADT_LIBS=true npm test

# Integration test execution logs
DEBUG_ADT_TESTS=true npm test

# E2E integration test logs
DEBUG_ADT_E2E_TESTS=true npm test

# Test helper function logs
DEBUG_ADT_HELPER_TESTS=true npm test

# Enable ALL ADT scopes at once
DEBUG_ADT_TESTS=true npm test
```

### Logger Interface

All clients accept a unified `ILogger` interface:

```typescript
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtClient } from '@mcp-abap-adt/adt-clients';

// Custom logger example
const logger: ILogger = {
  debug: (msg, ...args) => console.debug(msg, ...args),
  info: (msg, ...args) => console.info(msg, ...args),
  warn: (msg, ...args) => console.warn(msg, ...args),
  error: (msg, ...args) => console.error(msg, ...args),
};

const client = new AdtClient(connection, logger);
```

**Note:** All logger methods are optional. Lock handles are always logged in full (not truncated).

See [docs/usage/DEBUG.md](docs/usage/DEBUG.md) for detailed debugging guide.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for package-specific release notes.

## Tests

Integration tests use YAML configuration — the tracked base `src/__tests__/helpers/test-config.yaml.template` plus your local, gitignored overlay `test-config.overlay.yaml` (`npm run test:init -- onprem|cloud`; see [Test Config Schema](docs/development/TEST_CONFIG_SCHEMA.md)) — and the `BaseTester` pattern.  
Some ADT endpoints are system-specific; 406 is treated as an Accept/header support issue and can be explicitly allowed via `test_settings.allow_406` or per-test `params.allow_406` (e.g., objectstructure/nodestructure).

## License

**GNU Lesser General Public License v3.0 only** (`LGPL-3.0-only`), since 17.0.0.
Before that, MIT — versions already published under MIT stay MIT.

Copyright © 2025–2026 Oleksii Kyslytsia

This library is free software: you can redistribute it and/or modify it under the
terms of the GNU Lesser General Public License as published by the Free Software
Foundation, version 3.

It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
PURPOSE. See the GNU Lesser General Public License for more details.

The licence texts ship with the package: [`LICENSE`](LICENSE) is the LGPL, and
[`COPYING`](COPYING) is the GPL it is built on — the LGPL is written as a set of
additional permissions over the GPL, so both are needed to read it.

**What this means if you depend on this package.** The LGPL is the library
licence of the GNU family: linking it into your own program — importing it, as
every consumer of an npm package does — does not put your program under the LGPL.
What the licence asks is that changes *to this library* stay free, and that your
users can replace it with their own build.

## Author

Oleksii Kyslytsia <oleksij.kyslytsja@gmail.com>

### Recording batches

`AdtBatchConnection` records calls from the existing clients. Start the member
calls, execute the queue, then await their results. Group creates before locks,
then queue writes with the returned lock handles before unlocks;
activate all objects with one plain `activateObjectsGroup` call. At a debugger
stop, record step + stack + variables on the attached stateful connection.
See [domain and debugger examples](docs/usage/BATCH.md).

`execute()` also sends follow-up envelopes for requests member continuations
record during settlement (up to 100 envelopes, then all remaining requests
reject). Nothing in a batch is corrected or sent again — nothing anywhere is,
since 36.0.0 — so a part's `401`, `406` or `415` is that call's answer, and a
`406`/`415` to the envelope reaches `execute()` as it came. The
connection's own handling of the envelope request — credential renewal, CSRF
recovery, session — stays. Explicit session switches apply to the next recording;
LOCK/UNLOCK run in stateful envelopes; other ordinary members run stateless.
Consecutive LOCKs, consecutive UNLOCKs, and consecutive stateless requests each
form separate envelopes sent in queue order.
Execution returns the last outer response. An envelope failure stops sending and
rejects unsent requests with a clear library error; inner HTTP failures remain
per-part failures. The wrapped session mode is restored after execution.

```typescript
import { AdtBatchConnection, AdtClient } from '@mcp-abap-adt/adt-clients';

const batch = new AdtBatchConnection(connection, { endpoint: 'communication' });
const pending = new AdtClient(batch).getDomain().readMetadata({ domainName: 'Z_DOMAIN' });
await batch.execute();
const answer = await pending;
```
