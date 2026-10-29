# @mcp-abap-adt/adt-clients-legacy

Clients for legacy SAP ABAP systems (SAP_BASIS 7.40, measured on 7.40 SP04), built on
[`@mcp-abap-adt/adt-clients`](https://github.com/fr0ster/mcp-abap-adt-clients/blob/main/packages/adt-clients/README.md). `AdtClientLegacy` and
`AdtExecutorLegacy` `extend` that package's `AdtClient` and `AdtExecutor` and only
override: each member sends the request **measured accepted on SAP_BASIS 7.40
SP04**, or keeps an unmeasured request under a collection 7.40 advertises, or
answers a refusal **without sending a request**.

The basis of every claim in this package is SAP_BASIS 7.40 SP04 over RFC, the 7.40
test system. Nothing here is inferred for another release. The probe records
behind each claim, and what is not measured, are in
[docs/LEGACY.md](docs/LEGACY.md).

## Install and construct

```bash
npm install @mcp-abap-adt/adt-clients-legacy @mcp-abap-adt/adt-clients
```

`@mcp-abap-adt/adt-clients` is a peer dependency (`^38.0.0`): the consumer installs it, and the
legacy classes extend that one copy, so `AdtClientLegacy` is an `AdtClient` of the consumer's own
version. npm warns when the installed version is outside the range.

```typescript
import { AdtClientLegacy, AdtExecutorLegacy } from '@mcp-abap-adt/adt-clients-legacy';

const client = new AdtClientLegacy(connection, logger);       // connection: an RFC connection
const executor = new AdtExecutorLegacy(connection, logger);

const program = client.getProgram();                          // the same getters as AdtClient
```

- **The consumer declares the system type.** Nothing here detects a legacy system
  and no factory chooses a legacy class: `createAdtClient()` of
  `@mcp-abap-adt/adt-clients` always returns the modern `AdtClient`.
- **RFC only.** The legacy client is supported, and was measured, over RFC; HTTP to
  a 7.40 system is not a supported wire (no logon without a workaround, a write
  under a lock answers `423`, some reads disagree with RFC; the records are in
  LEGACY.md). The package does not detect the wire and has no branch for it.
- The package depends on `@mcp-abap-adt/adt-clients` `^38.0.0`. It also exports
  `AdtRequestLegacy`.
- **Each getter answers a class** (since 0.2.0): its legacy class
  (`getProgram(): AdtProgramLegacy<…>`, `getInclude(): AdtIncludeLegacy<…>`, …)
  or, for a type 7.40 does not have, the base class answering refusals. Each is
  assignable to the `AdtClient` getter it overrides. A consumer that names the
  type of the client it accepts composes that contract from
  `@mcp-abap-adt/interfaces-adt` alone (the atoms, the result-set contracts and
  the config types), as for `AdtClient`; the compiler checks there that
  `AdtClientLegacy` satisfies it. The result-set contracts (`IClassResults`, …)
  are imported from `@mcp-abap-adt/interfaces-adt`.

The package does not engineer around a consumer who ignores what follows: it
states what 7.40 SP04 does and passes the request through.

## How to read the tables

| Word | Means |
|---|---|
| **sends** | The member sends the request shown; measured accepted on 7.40 SP04 (the record is named in LEGACY.md). |
| **refused** | The member answers the library's refusal (`ok: false`, `origin: 'refusal'`, `code: UNSUPPORTED_OPERATION`) **without a request**; it is answered, never thrown. A consumer branches on the code; the message is for people. |
| **kept, not measured** | The request is the modern one, under a collection 7.40 advertises; no run has measured it. If 7.40 does not serve it, the answer is SAP's own `404`, which the strict default reads as a failure, never as success. |

Where a row says "sends" and its record is a read of a *system* object (a system
program, class, function module or include) rather than of an object a cycle
created, LEGACY.md says so; the cycle suites
(`src/__tests__/integration/legacy/cycles/`) measure the read of a created object
and `T6-20261027` ran them whole on 7.40 SP04 (2026-10-27): the reads of created objects, and the free-name `validate` of a function group and module are measured there; the DDL source's `readTransport` `404` by one raw read in the same record (`t6-ddl-readTransport`).

## What a consumer must know

### Headers are the caller's

The library passes a request's `Accept` / `Content-Type` through unchanged
(`options.headers`, `options.accept`) and chooses none for 7.40. The measured pairs:

| Member | Pair 7.40 SP04 accepts |
|---|---|
| Include `create` | **only** `application/vnd.sap.adt.programs.includes+xml`, both ways. The v2 pair answers `400 ExceptionContentHandlerNotFound` |
| Class `readMetadata` (`getClass()` and `getUtils().readObjectMetadata('class' …)`) | **only** `Accept: application/vnd.sap.adt.oo.classes+xml`. Every versioned type, a list naming one (`v4, unversioned`), and `application/xml` answer `400 ExceptionContentHandlerNotFound` — not the `406` a modern system answers |
| Function include `create` | `application/vnd.sap.adt.functions.fincludes+xml` both ways; v2 answers `400` |
| Message class `create` | `application/xml` both ways (`201`) |
| Every other type | the library's default pairs work (class create: `application/vnd.sap.adt.oo.classes+xml`; program, function group and module creates: the unversioned types; interface create: the v5 pair; DDL create: `application/vnd.sap.adt.ddlSource+xml`; a source write: `text/plain`) |

The measured pairs are passed by the tests as a consumer would pass them
(`integrationHeadersOf`).

### Empty `200` is not success

- A message class that does not exist reads `200` with an **empty body**, not `404`
  — and still does after its `delete`. Check the body.
- Over HTTP, families 7.40 does not have answer an empty `200` too (over RFC they
  answer `404`). The legacy classes refuse those families, so none of them reads an
  empty `200` as success. A consumer calling `getUtils().readObjectMetadata` must
  check the body.

### The rest

- **Local class includes' `check` and `validate` need the `source`** in the config
  (`getLocalTestClass()`, `getLocalTypes()`, `getLocalDefinitions()`,
  `getLocalMacros()`). Without it the library throws before it sends. With it
  both are a check run (`POST /checkruns`, `200`).
- **A function module's source on 7.40:** a parameter comment block is refused
  (`500 ExceptionResourceSaveFailure`, "Parameter comment blocks are not
  allowed"); a plain `FUNCTION … ENDFUNCTION` body is accepted.
- **`validate` of an existing name answers `400`** (`InvalidClifName`,
  `InvalidProgramName`, `InvalidMcName`, "already exists") for a class, interface,
  program, include and message class. That is the answer for an existing object,
  not a failure of the request; a name that is free answers `200`. For a function
  group and a function module, `validate` answers `200` (measured for an existing
  name).
- **`delete` is yours to lock.** 7.40 has no `/sap/bc/adt/deletion/*`, so there is
  no `checkDeletion` (every one is refused), and `delete` is one request:
  `DELETE <object URI>?lockHandle=<handle>` (plus `&corrNr=` when the config's
  `transportRequest` is given), stateless. The handle is from your own `lock()`;
  the member does not lock, unlock or retry. Without a handle the request still
  goes and SAP's `400` reaches you.

  ```typescript
  const include = client.getInclude();
  const config = { includeName: 'ZINCL' };
  const locked = await include.lock(config);                   // stateful
  if (!locked.ok) throw new Error(locked.getError().message);
  const lockHandle = locked.getResult().value;
  try {
    const deleted = await include.delete(config, { headers, lockHandle });
    if (!deleted.ok) throw new Error(deleted.getError().message);
  } finally {
    await include.unlock(config, lockHandle);
  }
  ```

  A delete with `corrNr` in a transportable package is measured (the 2026-10-26
  live run, `LegacyTransportable`): lock, `DELETE ?lockHandle=&corrNr=`, unlock,
  then `404` on read.
- **What ADT does not serve on 7.40 is the user's, one level up.** Where-used
  outside RIS, DDIC sources, transport changes, and the like are not ADT there: a
  consumer that needs them goes through the legacy MCP server, whose LLM writes
  ABAP (classes, reports) that does it. This package refuses those members without
  a request, so no tool can only fail.

## The members, per handler

The records `B2`, `B3` (earlier runs) and `B4` (the 2026-10-26 cycles) are listed in
LEGACY.md. Every handler hands out the same getter as `AdtClient`.

### Class — `getClass()`

| Member | On 7.40 SP04 |
|---|---|
| `create` | sends `POST /oo/classes`, the unversioned pair |
| `lock`, `unlock` | sends (`?_action=LOCK` / `UNLOCK`, stateful) |
| `update` | sends the stateless `PUT …/source/main?lockHandle=`, `text/plain` |
| `activate`, `check` | sends |
| `validate` | sends `POST /oo/validation/objectname`: free `200`, existing `400` |
| `read`, `readMetadata` | sends (read of a system class); `readMetadata` only with the unversioned `Accept` (above) |
| `getVersions`, `getVersionSource` | sends `GET …/includes/<main\|…>/versions`, then `GET <contentUri>` |
| `delete` | sends one `DELETE ?lockHandle=` under your lock |
| `readTransport` | **refused** — `GET …/transport` answered `404` |
| `checkDeletion` | **refused** — no deletion API |
| `activateTestClasses`, `readEnhancementElements`, `readEnhancementOptions` | kept, not measured |

### Class includes — `getLocalTestClass()`, `getLocalTypes()`, `getLocalDefinitions()`, `getLocalMacros()`

| Member | On 7.40 SP04 |
|---|---|
| `read` | sends (`GET …/includes/<name>`, a system class) |
| `update` | sends the include `PUT` under the class's lock |
| `check`, `validate` | sends a check run — **needs `source`** in the config |
| `getVersions`, `getVersionSource` | sends `includes/<name>/versions`, `GET <contentUri>` |
| `delete` | kept: an `update` with empty source; the write is the include `PUT` |
| `lock`, `unlock`, `activate`, `readMetadata` | sends — **of the container class**, as `getClass()`'s |
| `readTransport` | **refused** — the container class's `GET …/transport` answered `404` (`B4-cycles-20261026-2019` c6-readTransport) |

### Program — `getProgram()`

| Member | On 7.40 SP04 |
|---|---|
| `create` | sends `POST /programs/programs`, the unversioned pair |
| `lock`, `unlock`, `update`, `activate`, `check` | sends |
| `validate` | sends `/programs/validation`: free `200`, existing `400` |
| `read`, `readMetadata` | sends (a system program) |
| `getVersions`, `getVersionSource` | sends |
| `delete` | sends one `DELETE ?lockHandle=` under your lock |
| `readTransport` | **refused** — `404` |
| `checkDeletion` | **refused** |
| `readEnhancementElements`, `readEnhancementOptions` | kept, not measured |

### Interface — `getInterface()`

| Member | On 7.40 SP04 |
|---|---|
| `create` | sends `POST /oo/interfaces`, the v5 pair (`201`) |
| `lock`, `unlock`, `update`, `activate`, `check` | sends |
| `validate` | sends: free `200`, existing `400` |
| `read`, `readMetadata`, `getVersions`, `getVersionSource` | sends (`getVersions`: `source/main/versions`) |
| `delete` | sends one `DELETE ?lockHandle=` under your lock |
| `readTransport` | **refused** — `404` |
| `checkDeletion` | **refused** |

### Function group — `getFunctionGroup()`

| Member | On 7.40 SP04 |
|---|---|
| `create`, `lock`, `unlock`, `activate`, `check` | sends |
| `validate` | sends `/functions/validation` (`200`) |
| `readMetadata` | sends (a system group) |
| `delete` | sends one `DELETE ?lockHandle=` under your lock |
| `readTransport` | **refused** — `404` |
| `checkDeletion` | **refused** |
| `updateMetadata`, `readEnhancementElements`, `readEnhancementOptions` | kept, not measured |

A function group has no version members.

### Function module — `getFunctionModule()`

| Member | On 7.40 SP04 |
|---|---|
| `create` | sends `POST …/fmodules` (`201`) |
| `lock`, `unlock`, `update`, `activate`, `check` | sends — the source is a plain `FUNCTION … ENDFUNCTION` body (a parameter comment block is refused, above) |
| `read`, `getVersions`, `getVersionSource` | sends |
| `readMetadata` | sends (a system module) |
| `validate` | sends (`200`) |
| `delete` | sends one `DELETE ?lockHandle=` under your lock |
| `readTransport` | **refused** — `404` |
| `checkDeletion` | **refused** |

### Function include — `getFunctionInclude()`

| Member | On 7.40 SP04 |
|---|---|
| `create` | sends — pass the v1 pair `application/vnd.sap.adt.functions.fincludes+xml` |
| `lock`, `unlock`, `update`, `activate` | sends |
| `read` | sends (a system include) |
| `readMetadata`, `updateMetadata`, `check`, `getVersions`, `getVersionSource` | kept, not measured |
| `validate` | kept, not measured: a `GET` of its function group |
| `delete`, `checkDeletion` | **refused** — a direct `DELETE` of it is not measured and is not offered; delete the include through its function group |

### Include — `getInclude()`

| Member | On 7.40 SP04 |
|---|---|
| `create` | sends `POST /programs/includes` — **the unversioned pair only** |
| `lock`, `unlock`, `update`, `activate`, `read`, `readMetadata` | sends |
| `validate` | sends: free `200`, existing `400 InvalidProgramName` |
| `delete` | sends one `DELETE /programs/includes/<name>?lockHandle=` under your lock (`200`; the read afterwards `404`) |
| `checkDeletion` | **refused** |
| `readEnhancementElements`, `readEnhancementOptions` | kept, not measured |

### DDL source — `getDdl()`

| Member | On 7.40 SP04 |
|---|---|
| `create`, `lock`, `unlock`, `update`, `activate`, `check`, `read`, `readMetadata` | sends (a `define view` over `T000` with its `sqlViewName` activated) |
| `validate` | sends: a free name `200` |
| `delete` | sends one `DELETE ?lockHandle=` under your lock |
| `getVersions`, `getVersionSource` | **refused** — `GET …/ddic/ddl/sources/<name>/versions` answered `404` |
| `readTransport` | **refused** — `GET …/transport` answered `404` for a class, program, interface, function group, function module and (`T6-20261027`) DDL source |
| `checkDeletion`, `checkCdsTestDoubles` | **refused** |

### Message class — `getMessageClass()`, and a message — `getMessageClassMessage()`

| Member | On 7.40 SP04 |
|---|---|
| `create` | sends `POST /messageclass`, `application/xml` both ways (`201`) |
| `lock`, `unlock`, `readMetadata` | sends — `readMetadata` of an absent class is `200`, **empty** |
| `validate` | sends: free `200`, existing `400 InvalidMcName` |
| `updateMetadata` | **refused** — the `PUT` of the class document answered `400 ExceptionInvalidData` (7.40 expects another root element); not sent until that document is measured |
| `delete` | sends one `DELETE /messageclass/<name>?lockHandle=` under your lock (`200`; the read afterwards `200`, empty) |
| `checkDeletion` | **refused** |
| message `create`, `read`, `update`, `delete` | sends — a message is a row in its class's document: a read of the class, two locks, the `PUT`, two unlocks |
| message `readMetadata` | kept, not measured |

### Package — `getPackage()`

Every member **refused**: the item resource `/packages/<name>` answers `404` (the
collection is advertised, the item is not served) and `POST /packages` `405`.
Package contents come through `getUtils().fetchNodeStructure('DEVC/K', name)`, one level per request: the root node answers the subpackages and one node per object type with its `NODE_ID`, and the objects come with that `NODE_ID` as `nodeId` (`T6-20261027`).

### Transport request — `getRequest()`

| Member | On 7.40 SP04 |
|---|---|
| `list`, `readMetadata` | sends `GET /sap/bc/cts/transportrequests` (the user's list; a `configUri` is refused when given) |
| `create` | **refused** (`400`) |
| every other member | **refused** — `/sap/bc/adt/cts/*` is not advertised, and changes to a request are refused |

A populated list is measured (the 2026-10-26 live run, `LegacyTransportable`):
after a write under the lock with `corrNr`, the list and `readMetadata` name the
request.

### Utilities — `getUtils()`

Served: `search`, `fetchNodeStructure`, `getObjectStructure`, `discovery`,
`getInactiveObjects` (7.40 answers the older `adtcore:objectReferences`
document), `readObjectMetadata` / `readObjectSource` for the served types.
Refused: where-used (7.40 serves it only through RIS), virtual folders, object
types, activation runs, group deletion, data preview, and the DDIC and package
types' reads. Member by member: LEGACY.md.

### Executors — `AdtExecutorLegacy`

| Member | On 7.40 SP04 |
|---|---|
| class, program, function group `run` / `runSync`; function module `runSync` | sends one `POST /abapunit/testruns` with `<options>`, the finished result |
| function module `run` | **refused** — it names no group; use `runSync({ functionGroupName, functionModuleName })` |
| every `getStatus`, `getResult` | **refused** — a legacy run answers finished; there is no run id |
| class `run`, `runWithProfiler` | **refused** — no `/oo/classrun` (`404`) |
| program `run`, trace type lists | **refused until measured** — not advertised |
| trace `listRequests`, `getRequestsByUri`, `scheduleTrace` | kept, not measured |

### Types 7.40 does not have

`getDomain()`, `getDataElement()`, `getStructure()`, `getTable()`,
`getTableType()`, `getAppendStructure()`, `getTransformation()`,
`getScalarFunction()`, `getScalarFunctionImplementation()`, `getEnhancement()`,
`getAccessControl()`, `getServiceDefinition()`, `getServiceBinding()`,
`getBehaviorDefinition()`, `getBehaviorImplementation()`,
`getMetadataExtension()`, `getAuthorizationField()`, `getFeatureToggle()`: the
getter hands out a handler, so code written against `AdtClient` keeps running, and
every member of it is **refused**.

## Development

Unit tests need no SAP system: `npm test` (here, or at the repository root).
Live checks need a 7.40 system and its own overlay: see
[docs/LIVE_TESTING.md](docs/LIVE_TESTING.md).

- `npm run check:config` checks an overlay that holds **both** the root package's
  keys and the legacy keys (`environment.is_legacy`, `legacy_env.*`,
  `legacy_740.*`). The root package's `check:config` knows the modern overlays'
  keys only and refuses an overlay that has legacy keys.
- `npm run header:discovery` runs the root package's error corpus with the legacy
  clients probed beside the modern ones; it needs the root package built first
  (`npm run build` at the repository root).

## License

LGPL-3.0-only
