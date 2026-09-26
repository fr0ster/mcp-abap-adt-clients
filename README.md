# @mcp-abap-adt/adt-clients

[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://stand-with-ukraine.pp.ua)

TypeScript clients for SAP ABAP Development Tools (ADT).

> **Upgrading from 22.x?** 23.0.0 makes this package interpret nothing: every
> member answers the document SAP sent unless you give it a reading when you
> build it, and judges nothing unless you pass `analyse` with the call. Every
> reading and verdict it used to apply is a strategy in
> [`@mcp-abap-adt/adt-strategies`](packages/adt-strategies). The connection
> contract moved to `@mcp-abap-adt/interfaces-adt-connection`.
> [`docs/usage/MIGRATION-23.md`](docs/usage/MIGRATION-23.md) has the replacing
> code for every removed behaviour.
>
> **From 18.x?** Read [`docs/usage/MIGRATION-19.md`](docs/usage/MIGRATION-19.md)
> first: 19.0.0 is where members became one endpoint call each.

## Features

- ✅ **Client API** – simplified interface for common operations:
  - `AdtClient` – high-level CRUD API; one member, one ADT request
  - `AdtExecutor` – execution API via `IExecutor` contracts (class/program, with profiling)
  - `AdtRuntimeClient` – runtime operations (ABAP debugger, traces, logs, dumps, ATC check runs)
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
[`@mcp-abap-adt/adt-strategies`](packages/adt-strategies), which you pass by
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
  | [`@mcp-abap-adt/interfaces-adt`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-adt) `^11.0.0` | the capability atoms, every object's config, `IAdtResponse`, `IAnalyse`, `IAdtAnalyseOptions`, `IResultStrategy`, `ADT_NO_FAILURE`, `ADT_TASK_TYPE` |
  | [`@mcp-abap-adt/interfaces-adt-connection`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-adt-connection) `^1.0.0` | `IAbapConnection`, `IAdtWireResponse`, `IAbapRequestOptions`, `ITimeoutConfig`, the connection capability atoms, `ADT_SESSION_ERROR` |
  | [`@mcp-abap-adt/interfaces-network`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-network) `^2.0.0` | `IWebSocketTransport` and its four companions, `HttpError` |
  | [`@mcp-abap-adt/interfaces-utils`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-utils) `^1.1.0` | `ILogger`, `LogLevel`, `XmlNode` |
  | [`@mcp-abap-adt/interfaces-auth`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-auth) — **dev only** | `IAuthProvider`, for the test helpers that open a session |
  | [`@mcp-abap-adt/interfaces-auth-sap`](https://www.npmjs.com/package/@mcp-abap-adt/interfaces-auth-sap) `^1.0.0` — **dev only** | `ISapConfig`, to build a connector in one unit test |

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
   - Example: `await client.getClass().create({...})` — the POST, and nothing else

2. **AdtRuntimeClient**
   - Stable runtime operations for ABAP debugging, traces, dumps, logs, feeds, ATC check runs, and more
   - Factory accessors: `getProfiler()`, `getCrossTrace()`, `getSt05Trace()`, `getApplicationLog()`, `getAtc()`, `getAtcLog()`, `getDdicActivation()`, `getDumps()`, `getFeeds()`, `getSystemMessages()`, `getGatewayErrorLog()`
   - Each takes an optional result set (`getProfiler({ ...profilerDocuments, list: profilerTraceEntries })`) and builds a fresh implementation per call — nothing is cached, so one caller's readings never become another's
   - `getAtc()` runs ATC checks; `getAtcLog()` reads the execution and check-failure logs. Same subject, different resources — see [ATC check runs](docs/usage/CLIENT_API_REFERENCE.md#atc-check-runs)

3. **AdtExecutor**
   - Typed execution API based on `IExecutor`
   - Executors:
     - `getClassExecutor()` for `classrun`
     - `getProgramExecutor()` for `programrun` (on-premise systems)
   - Methods: `run`, `runWithProfiler`, and trace scheduling (`scheduleTrace`, `listRequests`, `getRequestsByUri`, `listObjectTypes`, `listProcessTypes`)
   - Each executor factory takes an optional result set, like the runtime client's

4. **AdtAbapGitClient**
   - Standalone: `new AdtAbapGitClient(connection, logger, options?, results?)`
   - `link`, `pull`, `unlink({ repositoryId })`, `listRepos`, `getErrorLog(logLink)`, `checkExternalRepo` — one request each; `pull` does not wait

5. **AdtClientsWS**
   - Realtime request/event facade over `IWebSocketTransport`
   - Includes debugger-session facade: listen, attach, step, stack, variables
   - Example: `await wsClient.request('debugger.listen', { timeoutSeconds: 30 })`

## Supported Object Types

| Object Type | AdtClient |
|------------|-----------|
| Classes (CLAS) | ✅ |
| Behavior Implementations (CLAS) | ✅ |
| Behavior Definitions (BDEF) | ✅ |
| Interfaces (INTF) | ✅ |
| Programs (PROG) | ✅ |
| Function Groups (FUGR) | ✅ |
| Function Modules (FUGR/FF) | ✅ |
| Function Includes (FUGR/I) | ✅ |
| Domains (DOMA) | ✅ |
| Data Elements (DTEL) | ✅ |
| Structures (TABL/DS) | ✅ |
| Tables (TABL/DT) | ✅ |
| Views (DDLS) | ✅ |
| Metadata Extensions (DDLX) | ✅ |
| Packages (DEVC) | ✅ |
| Authorization Fields (SUSO / AUTH) | ✅ |
| Feature Toggles (FTG2/FT) | ✅ |
| Transports (TRNS) | ✅ |

## Quick Start

### Using AdtClient (Recommended - High-Level CRUD API)

```typescript
import {
  AdtOnPremConnector,
  BasicAuthProvider,
  OnPremHttpTransport,
} from '@mcp-abap-adt/connection';
import { AdtClient, utilDocuments } from '@mcp-abap-adt/adt-clients';
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
// @mcp-abap-adt/connection 6.0.0 nothing is inferred and there is no factory —
// for ABAP Cloud take AdtCloudConnector + CloudHttpTransport instead.
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

const client = new AdtClient(connection, console);

// One member, one request: this is the POST that makes the class shell.
// Writing its source and activating it are calls of your own, below.
await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test class'
});

// The lock window is yours: lock, write, unlock, activate — in the order you
// choose, each answering its own contract. Deleting works the same way:
// `checkDeletion()` asks whether it can go, `delete()` does it.
const target = { className: 'ZCL_TEST' };
const locked = await client.getClass().lock(target);
if (locked.ok) {
  // The handle SAP sent — '' if it sent none, which is yours to judge.
  const lockHandle = locked.getResult().value;
  await client.getClass().update(target, { source, lockHandle });
  await client.getClass().unlock(target, lockHandle);
}
await client.getClass().activate(target);

// Every member answers a contract: a result or a failure, and the compiler
// makes you say which you are reading. What the result *is* was chosen when
// the implementation was built: the shipped set answers documents as they
// arrived, and a reading from @mcp-abap-adt/adt-strategies gives a shape.
const utils = client.getUtils({
  ...utilDocuments,
  search: utilSearchHits,
  whereUsed: utilWhereUsedReferences,
});

const found = await utils.search({ query: 'Z*', objectType: 'CLAS' });
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
const scope = await utils.getWhereUsedScope({
  object_name: 'ZMY_TABLE',
  object_type: 'table',
});
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

const answer = await utils.getWhereUsed({
  object_name: 'ZMY_TABLE',
  object_type: 'table',
  scopeXml: narrowed,
});

// `utilWhereUsedReferences` above is the shape the old member returned,
// offered by name rather than imposed. Without it, this is the document.
if (answer.ok) {
  const references = answer.getResult().value;
  console.log(`Found ${references.totalReferences} references`);
  for (const ref of references.references) {
    console.log(`${ref.name} (${ref.type}) in ${ref.packageName}`);
  }
}
```

### Using AdtClientsWS (Realtime)

```typescript
import { AdtClientsWS } from '@mcp-abap-adt/adt-clients';
import type { IWebSocketTransport } from '@mcp-abap-adt/interfaces-network';

const transport: IWebSocketTransport = createYourTransport();
const wsClient = new AdtClientsWS(transport, console, {
  requestTimeoutMs: 30000,
});

await wsClient.connect('wss://your-realtime-endpoint');

await debuggerSession.listen({ timeoutSeconds: 60 });
await debuggerSession.step({ action: 'step_over' });
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

**AdtUtils read type safety:**
`readObjectMetadata` and `readObjectSource` accept strict object type unions to prevent invalid inputs like `view:ZOBJ`.

```typescript
import type { AdtObjectType, AdtSourceObjectType } from '@mcp-abap-adt/interfaces-adt';

await utils.readObjectMetadata('DDLS/DF' satisfies AdtObjectType, 'ZOK_I_CDS_TEST');
await utils.readObjectSource('view' satisfies AdtSourceObjectType, 'ZOK_I_CDS_TEST');
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

> **Measured caveat — do not rely on it for readiness.** On an SAP BTP trial the
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

await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test class'
});

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
For domain, package, dataElement, tableType, transport, functionGroup and
message class it is the object's own **document**, passed as `options.source` to
`updateMetadata` — the first six fetched and patched it for you until 19.0.0,
the message class until 23.0.0, and none of them does now.

```typescript
const cls = client.getClass();
const target = { className: 'ZCL_TEST' };

const current = await cls.read(target, 'active');
if (!current.ok) throw new Error(current.getError().message);
const edited = addAMethod(String(current.getResult().value));

const locked = await cls.lock(target);
if (!locked.ok) throw new Error(locked.getError().message);
const lockHandle = locked.getResult().value;
await cls.update(target, { source: edited, lockHandle });
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
[`@mcp-abap-adt/adt-strategies`](packages/adt-strategies) has one — defaults
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
    transportRequest: 'E19K900001'
  }
);
// The class shell exists. Its `source/main` — the generated binding to the
// behavior definition — is `updateMain()`, and activation is `activate()`.
await client.getBehaviorImplementation().activate({ className: 'ZBP_OK_I_CDS_TEST' });
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
- `SAP_AUTH_TYPE` - Authentication type: `'basic'` or `'jwt'` (default: `'basic'`)
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

## API Reference

### AdtClient Overview

### What a call answers with

**Every** member answers `IAdtResponse` — a result or a failure, never both and
never neither. `client.getUtils()` did since 17.0.0; the per-type handlers do
now:

```typescript
const answer = await client.getClass().create({
  className: 'ZCL_X',
  packageName: 'ZP',
  description: 'x',
});

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
[`@mcp-abap-adt/adt-strategies`](packages/adt-strategies):

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
  .delete({ packageName: 'ZPKG' }, { analyse: analyseDeletion });
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
- Each accessor returns an `Adt*` object typed to its **honest capability set** (since 8.0.0, completed in 12.0.0). Every accessor returns the intersection of the capability atoms that object actually supports, written positively — there is no composite at all, and none named for what an object lacks. Calling a capability a handler lacks — e.g. `client.getDomain().getVersions(...)` — is a **compile error** rather than a runtime throw. See the [Type System](#type-system) section.
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
const answer = await client.getFunctionModule().create({
  functionGroupName: 'ZFGROUP',
  functionModuleName: 'ZFM_TEST',
  description: 'Test FM',
});

if (!answer.ok) throw new Error(answer.getError().message);
console.log(answer.getResult().value);   // the create's document, by default
```

There is no chain behind it: `create()` is the POST, and the lock, write,
unlock and activation around it are calls of your own, each with its own answer.

### Accept Negotiation

Some ADT endpoints return `406` when the `Accept` header does not match the
system's supported media types. The client retries once with a type the `406`
names, and remembers it for that endpoint.

**It is on unless you turn it off** — per client, or for the process:

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection, console, {
  enableAcceptCorrection: false,
});
```

```bash
ADT_ACCEPT_CORRECTION=false npm test
```

**The state is the connection's** since 23.0.0: the remembered types and the
switch live on the connection object. They used to be module globals, so a
header learned on one system was sent to every other, and one client's switch
changed it for all. Two connections to two systems in one process no longer
share anything.

### Handler classes exported directly

The documented route to a handler is a factory — `client.getScalarFunction()` —
which wires the connection, logger and system context for you. The classes are
also exported for the rarer case of constructing one against a connection you
hold yourself:

<!-- surface:begin -->
`AdtAppendStructure`, `AdtMessageClass`, `AdtMessageClassMessage`,
`AdtScalarFunction`, `AdtScalarFunctionImplementation`, `AdtService`.
<!-- surface:end -->

### System-capability helpers

<!-- surface:begin -->
`getSystemInformation`, `isModernAdtSystem`, `resolveContentTypes`,
`fetchDiscoveryEndpoints`, `isEndpointInDiscovery`, `createAdtClient`
<!-- surface:end -->

- `getSystemInformation(connection)` — the ADT system record, or `null` when
  the endpoint is absent.
- `isModernAdtSystem(connection)` — whether `/sap/bc/adt/core/discovery` is
  served. S/4 HANA and BTP expose it; BASIS 7.40 and below only have
  `/sap/bc/adt/discovery`.
- `resolveContentTypes(connection)` — picks `AdtContentTypesModern` (v2+
  headers) or `AdtContentTypesBase` (v1, universal) from that answer.
- `fetchDiscoveryEndpoints(connection)` / `isEndpointInDiscovery(...)` — the
  discovery document and a membership test over it.
- `createAdtClient(connection, logger?, options?)` — `AdtClient` or
  `AdtClientLegacy`, from `isModernAdtSystem`.

**A probe answers only for an absent endpoint.** A `404`, `405` or `501` is the
answer `false`, `null` or an empty set stands for. Any other failure — no
network, an expired session, a `401`, a `500` — is raised, since 23.0.0: it
says nothing about the system, and swallowing it handed a legacy client to a
modern system reached over a broken connection.

The parsers that used to sit here — `parseSearchResults`, `parseTransportTree`,
`parseCreatedTransport` — are readings, and are in `@mcp-abap-adt/adt-strategies`
as `readSearchHits`, `transportTree` and `transportCreated`. A reading takes a
wire response, so a document you already hold (a batch result, a fixture, a
capture) is read with `transportTree({ status: 200, statusText: 'OK', headers: {}, data: xml })`.

`src/index.ts` is the full surface; everything reachable from it is public and
everything else is not.

## Type System

### Single Definition Site: the contract packages

Since **7.5.0**, every contract type is **defined once**, in the contract packages — today `@mcp-abap-adt/interfaces-adt` (`^11.0.0`) for the ADT contracts and `@mcp-abap-adt/interfaces-adt-connection` (`^1.0.0`) for the connection. This package declares no copies of its own — every `IXxxConfig`, the capability atoms, the option and response types and the cross-cutting shared types all live there.

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

What this package exports is what it owns: the clients, the handler classes, the batch and runtime facades, the result sets each implementation is built with (`<x>Documents` and their `I…Results` types), the building blocks `rawDocument`, `nothing`, `wireItself` and `nothingIsARefusal`, and a few helpers.

### Honest capability types (since 8.0.0)

`@mcp-abap-adt/interfaces-adt` has **capability atoms and nothing above them** — `IAdtCreatable`, `IAdtReadable`, `IAdtMetadataReadable`, `IAdtUpdatable`, `IAdtMetadataUpdatable`, `IAdtDeletable`, `IAdtValidatable`, `IAdtCheckable`, `IAdtActivatable`, `IAdtLockable`, `IAdtVersionable`, `IAdtTransportAware` — each covering one operation against one resource. **There is no composite.** `IAdtObject`, `IAdtCrud`, `IAdtModifiable` and `IAdtSourceObject` were removed in interfaces 29.0.0: they forced one result type on members that answer different things, and a create does not answer what a read answers. `IAdtSearchable` went in 30.0.0 — searching is not something an object does to itself, and the question already had a home in `IAdtInformationSystem.search`. A handler declares the atoms it honours, so there is nothing a composite could drift from.

Since **8.0.0**, each handler `implements` only the atoms it genuinely supports, and `AdtClient.getXxx()` return types are narrowed to match:

```typescript
client.getClass().getVersions({ className: 'ZCL_X' });   // ✅ classes have version history
client.getDomain().getVersions({ domainName: 'ZD_X' });  // ❌ compile error — domains have no /source/main
```

Previously the second call compiled and threw `ADT_UNSUPPORTED_OPERATION` at runtime; now the type system rejects it. This is why 8.0.0 is a major: it is breaking **only** for code that called a capability a handler never had (i.e. code that always threw).

`IAdtObject` was that later major: it and the other composites are **gone as of interfaces 29.0.0**. A consumer holding one writes the intersection they need, spelled from atoms.

Since **9.0.0** no accessor returns the wide type, and since **12.0.0** none returns a type carrying a method that throws — including `getRequest()`, `getFeatureToggle()` and `getServiceBinding()`, which were the last three.

`getUnitTest()` and `getCdsUnitTest()` changed meaning rather than shape: a unit test's subject is the container class and its `testclasses` include, so `create()` creates that class and writes the tests into it, `update`/`delete`/`read` manage the include, `lock`/`unlock` take the container's lock, and running is `IAdtRunnable` — one method, with `getStatus`/`getResult` on `ITestRunInformation` because asking about a run is not running it.

The runtime client narrows the same way. `AdtRuntimeClient.getAtc()` implements `IAtcRunStatusReadable & IAtcFindings`, plus `resolveCheckVariant`, `createWorklist` and `startRun` — a check run is three requests, started and then read, never created, locked, activated or versioned, and the type says so rather than offering the rest and throwing. It is not `IAdtRunnable` since 19.0.0: that atom's `run` is one call.

**A guard keeps this true.** `src/__tests__/unit/capabilities/` compares all 37 factory return types against the 12 atoms in both directions at compile time, calls every method of every declared capability against a recording connection to check it issues the request its capability names, and fails if a new factory appears without an entry. Adding a throwing method back to a narrowed handler stops compiling. The guard walks `AdtClient` and `AdtClientLegacy` only; the runtime accessors are pinned by `src/__tests__/unit/clients/AdtRuntimeClient.factory.test.ts`.

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
shapes, the twelve abapGit types, the ten executor types, and the five debugger types. This
package no longer declares or exports any contract type — every contract name it uses is
sourced from the contract packages.

> **Version pairing.** Because the types are sourced rather than copied, `@mcp-abap-adt/interfaces-adt` and `@mcp-abap-adt/interfaces-adt-connection` are hard peers of this package's public API. A major bump there implies a bump here; keep the two in step rather than letting a resolver pick a mismatched pair.

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

Integration tests use YAML configuration (`src/__tests__/helpers/test-config.yaml`) and the `BaseTester` pattern.  
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
