# The legacy client on 7.40 SP04: what every member sends

**Status:** proposed. Delete this file when it is implemented or abandoned.

Prescriptive. Where it disagrees with the code, the code is what changes.

Authority: the goal, `docs/superpowers/2026-10-23-legacy-740-goal.md`. Its
invariants bind every decision here; where this spec could not ground a decision
in a measurement, it says so and argues it from those invariants (§12).

## 1. Scope and evidence

**In scope:** every member that `AdtClientLegacy` and `AdtExecutorLegacy` hand
out, through every getter, whether the handler is a `*Legacy` class, an
`absentOnLegacy` stand-in or a modern handler inherited as it is.

**One wire: RFC.** The legacy client is supported, and measured, over RFC only;
its consumer, the legacy MCP server, is RFC-only (the owner's decision). HTTP is
not a supported legacy wire, and §3 records why, with the measurements. Nothing
in the library branches on the wire: every decision below is the RFC decision.

**Out of scope, with a decision of its own (§10):** the clients with no legacy
variant — `AdtRuntimeClient`, the debuggers, memory snapshots,
`AdtBatchConnection`, `AdtAbapGitClient`, `AdtClientsWS` — and the exported
system probes.

**Evidence.** Every claim "measured" below names the probe record it comes from.
The records are JSONL, one line per step, kept beside the probe scripts outside
this repository; the spec names them by file and step id:

| record | what it ran | wire |
|---|---|---|
| `B2-reads-20261023-1749` | the library's reads through `AdtClientLegacy`, raw GETs of the absent families, `isModernAdtSystem` | RFC |
| `B3-cycle-20261023-1544` | a class life cycle through the library, unit tests, deletion check, delete | RFC |
| `B3-deletes-20261023-1601` | program, interface, function group, function module, DDL: delete without a lock, then with one | RFC |
| `B3-deletes-lock-20261023-1612` | function group, function module, DDL: lock → delete with the handle → unlock | RFC |
| `B3-unmeasured-20261023-1631` | unit tests of a program, function group, module; packages; transport list and create | RFC |
| `B3-fugr-v1-20261023-1632` | the function group run again with a v1 function include holding tests | RFC |
| `B3-cycle-options-20261023-1730` | the class life cycle again, with a raw testruns POST carrying `<options>` | RFC |
| `H3-cycle-20261023-1723`, `H3-cycle-20261023-1724` | the class life cycle over `legacy-http`, without and with the CSRF endpoint override | HTTP |
| `H3-cycle-stateful-20261023-1725` | the same, with the source writes sent in the stateful session | HTTP |
| `B1-summary.md` (`B1-20261022-1736`), `B1b-gaps-20261023-1358` | the library's reads and raw requests to the gap report's endpoints | HTTP |

All measurements are from one SAP_BASIS 7.40 SP04 system. **Every decision
rests on an RFC record.** The HTTP records (`H3`, `B1`, `B1b`) appear only in
§3, as the reason HTTP is unsupported. The static inventory
of every endpoint the library sends, with file and line, is the gap report
(`legacy-gap-report.md`, beside the records); its classification of an
endpoint as *both*, *newOnly*, *legacyOnly* or *unlisted* (whether 7.40's
`/sap/bc/adt/discovery` lists the collection the path belongs to) is used below
as "advertised" / "not advertised". `docs/architecture/LEGACY.md`, "Measured on
BASIS 7.40", holds earlier measurements on a BASIS 7.40 system whose support
package it does not state; they are cited as such and never as "7.40 SP04".

Two pieces of SAP's own code were read, locally: the class resource
controller's `delete` takes the lock handle from the URL and refuses without a
valid one, and reads `corrNr` from the URL unless the object is not
transportable (`CL_OO_ADT_RC_CLASS`); the newer resource base takes a transient
lock when a delete brings none (`CL_WB_ADT_REST_RESOURCE`). Which controllers
on 7.40 derive from which base was not read; nothing below depends on it.

## 2. How each member is decided

Four outcomes, and the order they are tried in:

1. **Measured served** — a run on 7.40 SP04 accepted the request the member
   sends (or a request the member will send after this change). The member
   sends exactly that. If it is the modern handler's request, the member is
   **works as inherited**; if it differs, it is **fixed in a legacy override**.
2. **Measured not served** — over RFC, 7.40 SP04 answered `404` (or `405`, or
   a `400` that refuses the request kind itself) for the endpoint. The member is
   **refused without a request**.
3. **Not measured, advertised** — the request's path belongs to a collection
   7.40's discovery lists. The member keeps the request (**not measured, kept**):
   the system says it has the resource, and refusing would take away a function
   7.40 may well serve. If it does not, the answer is SAP's `404` — over RFC an
   absent resource answered `404` every time it was measured (§10.1, §10.2) —
   which the strict default reads as a failure, never as success; the live check
   (§11.2) then turns it into a refusal.
4. **Not measured, not advertised** — the member is **refused without a
   request until measured**: absent from the system's discovery and never shown
   to be served is "not served" until a run says otherwise. Every
   not-advertised family that was measured over RFC answered `404` (`B2-reads`
   s11-*, `B3-cycle` s7-checkDeletion).

**Why a refusal, and not SAP's `404`.** A member whose endpoint 7.40 does not
serve is refused by the library without a request (the goal), in the existing
legacy refusal shape (§2.1). The consumer then reads "not on this system"
(`UNSUPPORTED_OPERATION`) instead of a `404` it would have to interpret, and
the legacy MCP server, which builds its tools from what the legacy client
offers, exposes no tool for it — fewer handlers, none that can only fail.
Reading and changing what ADT does not offer on 7.40 is that server's later
work through local reports on the system, not this library's.

A measurement overrides the discovery catalogue in both directions: `/deletion/*`
is not advertised and is measured absent (`B3-cycle` s7-checkDeletion);
`/packages/{name}` is advertised and measured absent over RFC
(`B3-unmeasured` b1-2, b2-0).

### 2.1 The refusal

Every refusal here takes the shape the existing legacy refusals already have
(`absentOnLegacy`, `AdtPackageLegacy`, `AdtRequestLegacy`, `AdtUtilsLegacy.refuse`,
`refusedBelow750`): answered, never thrown, through `failed()`, with

- `origin: 'refusal'`,
- `code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION`,
- a message that names the operation, the endpoint 7.40 lacks or answers
  without content, and — where there is one — what to use instead.

No request leaves, so `options.analyse` has nothing to read; it is accepted for
the contract's shape, as today. One code for every refusal: a consumer branches
on `UNSUPPORTED_OPERATION`, and the message is for people. No new error code.

### 2.2 Where the differences live

Only in legacy classes: `*Legacy` subclasses that override the members that
differ, `absentOnLegacy` for a type 7.40 does not have, and the legacy client's
and executor's getters that hand them out. Nothing in a main handler, in
`src/core/shared/*` functions the modern handlers call, in the connection, or in
a header pair. The pairs stay the caller's (`options.headers`, since 36.0.0).

New legacy classes this spec needs: `AdtIncludeLegacy`,
`AdtFunctionIncludeLegacy`, `AdtMessageClassLegacy`, `ClassExecutorLegacy`,
`ProgramExecutorLegacy`. Each is a subclass that overrides only the members
below; `AdtClientLegacy` and `AdtExecutorLegacy` override the getters that
return them.

## 3. HTTP is not a supported legacy wire

Measured on 7.40 SP04 through the library over `legacy-http`:

- **No logon without a workaround.** `connect()` threw (`H3-cycle-20261023-1723`
  connect): no CSRF token in the response headers. 7.40 answers
  `core/discovery` with `200 text/html`, empty and without a token (`B1`
  R-CORE). With the CSRF endpoint overridden to `/sap/bc/adt/discovery`, the
  logon succeeds (`H3-cycle-20261023-1724` connect; `B1-summary.md`). That is
  `@mcp-abap-adt/connection` issue #91, not this library's.
- **No source write.** With that override, `LOCK` answered `200` with a handle and
  the `PUT …/source/main?lockHandle=` answered `423` "Resource … is not locked
  (invalid lock handle: …)" (`H3-cycle-20261023-1724` s2-update; the test-class
  include, s3-update) — and the same when the `PUT` went in the stateful session
  (`H3-cycle-stateful-20261023-1725` s2-update, s3-update). This repeats the
  earlier BASIS 7.40 measurement in `LEGACY.md`.
- **Reads that disagree with RFC.** A class that exists — RFC reads its metadata
  `200` — read `404` "does not exist" over HTTP (`H3-cycle-20261023-1724` s9-read
  after s1-create `200`); the class's test run answered no methods (s6a-run,
  s6b-runSync) where RFC answered two (`B3-cycle` s6a-run).
- **Empty answers read as success.** `deletion/check` answered `200`, empty
  (`H3-cycle-20261023-1724` s7-checkDeletion), and the library said `ok: true`.
  So did the families 7.40 does not have, which answer `404` over RFC: ten
  requests answered an empty `200` (`B1b` TR-6, DEL-1, DDIC-1, DDIC-2, ENH-1;
  `B1` R-GET-XSLT, R-GET-DSFD ×2, R-GET-APPS ×2), and the library read the
  transformation, scalar function and append structure reads as `ok: true`.
- **No transports.** Every `/sap/bc/cts/*` path answered the ICF `404` before
  any logon (`B1b` TR-1 … TR-5); over RFC the list is served (§7).

**Decision.** The legacy client is documented as an RFC client. The library does
not detect the wire and does not branch on it: there is no wire option, no
HTTP guard, and no member behaves differently by wire. A consumer that builds a
legacy client over HTTP gets the RFC behaviour and SAP's HTTP answers; the docs
say it is unsupported and why. Nothing here works around #91.

## 4. Delete

### 4.1 What 7.40 SP04 does

- `DELETE <object>` **without** a lock handle answers `400`
  "Parameter lockHandle could not be found." for a class (`B3-cycle` s8-delete), a
  program (`B3-deletes-1601` p2c), an interface (i2c) and a function group (g2c).
- Without a handle, a function module (m2c) and a DDL source (d2c) answered `200`
  and were gone.
- `LOCK` (stateful) → `DELETE <object>?lockHandle=…` (stateless) → `UNLOCK`
  (stateful) deleted all six: class (`B3-cycle` c1–c4), program (p2e), interface
  (i2e), function group (`B3-deletes-1601` g2e, `B3-deletes-lock-1612` g2e), function module
  (`B3-deletes-lock-1612` m2e, `B3-fugr-v1` a2-9), DDL (`B3-deletes-lock-1612` d2e);
  the read afterwards answered `404` each time. The `UNLOCK` after a successful
  delete answered `200`.

### 4.2 Decision: the consumer's lock handle, one request

The six legacy `delete` overrides (`AdtClassLegacy`, `AdtProgramLegacy`,
`AdtInterfaceLegacy`, `AdtFunctionGroupLegacy`, `AdtFunctionModuleLegacy`,
`AdtDdlLegacy`) keep sending what they send today, which is the measured
request: `DELETE <object URI>?lockHandle=<options.lockHandle>[&corrNr=<transportRequest>]`,
stateless, the caller's header pair, the caller's `options.timeout` and no
deadline of the library's. **Works as overridden — measured**; the change is
to their documentation and tests.

The handle is **the consumer's**, from `lock()`, passed as `options.lockHandle`.
The handler does not lock on its own:

- *One endpoint, one member.* `delete` is the DELETE; `lock`/`unlock` are the
  lock window; nothing composes them for the caller (CLAUDE.md, "One endpoint,
  one member"). A delete that locked, deleted and unlocked would be three
  requests in one member and a lock window the consumer cannot see.
- *The session rule.* Only `LOCK` and `UNLOCK` are stateful; the measured
  sequence had the DELETE stateless between them. A self-locking delete would
  have to manage that window inside a member.
- *No fallback.* The goal: "the delete with a lock is the delete, not a
  fallback after a failed one". A delete that retried with a lock after a `400`
  is exactly that fallback.

**Without a handle the request still goes**, unchanged. SAP's `400` reaches the
consumer through the strategy as the failure it is (measured: `ok: false`,
`origin: 'connection'`, status `400`), and a function module or DDL source is
deleted as 7.40 deletes it. Refusing a handle-less delete in the library would
add a rule 7.40 itself contradicts for two of the six types, and the answer is
not empty, so no invariant asks for a refusal.

**`corrNr`.** Sent when `transportRequest` is given, as today. The class
controller reads it from the URL (SAP code), but every probe ran in a local
package, so a delete with `corrNr` is **not measured**; kept (§12).

### 4.3 The other deletes

| member | today | decision |
|---|---|---|
| `getInclude().delete` | `POST /deletion/delete` | **refused without a request** — `/deletion/*` is not served (§5) |
| `getFunctionInclude().delete` | `POST /deletion/check`, then `/deletion/delete` | **refused without a request** |
| `getMessageClass().delete` | `POST /deletion/check`, then `/deletion/delete` | **refused without a request** |
| `getUtils().deleteObjectsGroup` | `POST /deletion/check`, then `/deletion/delete` | **refused without a request** |
| `getPackage().delete` | refused | refused (§8) |
| `getRequest().delete` | refused | refused (§7) |
| `getMessageClassMessage().delete` | read, two locks, `PUT` of the class, two unlocks | **not measured, kept**: no `/deletion/*`; its endpoints are advertised |
| `getLocalTestClass/Types/Definitions/Macros().delete` | `update` with empty source | **kept**: the write is the include `PUT`, measured for the test-class include (`B3-cycle` s3-update) |

A direct `DELETE <object>?lockHandle=` on an include, a function include or a
message class is the obvious candidate replacement and is **not measured**. It
is not implemented on inference: the goal's "only what was measured". The live
check in §11.2 measures it; if it is measured to work before the release, the
three refusals become overrides of the §4.2 kind in `AdtIncludeLegacy`,
`AdtFunctionIncludeLegacy` and `AdtMessageClassLegacy`, and this table is
amended. Not measured by the release, they ship refused.

## 5. `checkDeletion`

7.40 SP04 has no deletion API: `POST /sap/bc/adt/deletion/check` answered
`404` "No application class found for URI" over RFC (`B3-cycle` s7-checkDeletion)
(and again in `B3-cycle-options-20261023-1730` s7-checkDeletion). Today every
legacy `checkDeletion` sends it.

**Decision: refused without a request**, on every handler the legacy client
hands out that has the member: class, program, interface, function group,
function module, DDL source, package, include, function include, message
class; and `getUtils().checkDeletionGroup`. The message says that 7.40 has no
deletion check and that `delete` with the object's lock handle is the delete.
`getRequest().checkDeletion` is refused with the transport members (§7).

## 6. ABAP Unit runners and executors

### 6.1 What 7.40 SP04 does

- `POST /sap/bc/adt/abapunit/testruns`, `application/xml` both ways:
  - for a class, **without** `<options>` (the body `ClassTestRunnerLegacy` sends),
    answered the finished result: two methods, one passed, one failed
    (`B3-cycle` s6a-run, s6b-runSync); **with** `<options>`, the same result
    (`B3-cycle-options-20261023-1730` s6b-raw-testruns);
  - for a program, **with** `<options>` (the body `startUnitTestRunSync` builds
    when given options, defaults filled), answered two methods, one alert
    (`B3-unmeasured` a1-6);
  - for a function group and for a function module, with `<options>`, answered
    two methods, one alert (`B3-fugr-v1` a2-7, a2-8) once the group held a test
    include; without one, `noTestClasses` and no methods (`B3-unmeasured` a2-7,
    a2-8) — the right answer for a group without tests. The module's URI ran the
    group's tests, as the modern runner's JSDoc records for SAP_BASIS 816.
- `/abapunit/runs` and `/abapunit/results` are not advertised; nothing polls.

### 6.2 Decisions

| runner.member | today | decision |
|---|---|---|
| class `runSync` | testruns without `<options>` | **works as inherited — measured**: remove the override; the modern `runSync` sends `startClassUnitTestRunSync(containers, options)`, with `<options>` |
| class `run` | testruns without `<options>`, read by `run` | **fixed in the legacy override**: the same request as `runSync`, with `<options>`, read by the `run` strategy |
| class `getStatus`, `getResult` | refused | refused, unchanged |
| program `runSync` | refused | **works as inherited — measured**: remove the override; the modern `runSync` sends `startSync([PROGRAM.uri(name)], options)`, the measured body |
| program `run` | refused | **fixed in the legacy override**: the same request as `runSync`, read by the `run` strategy — as the class runner's `run`, because on 7.40 the testruns POST is the run |
| function group `runSync` | refused | **works as inherited — measured**: remove the override |
| function group `run` | refused | **fixed in the legacy override**, as program `run` |
| function module `runSync` | refused | **works as inherited — measured**: remove the override |
| function module `run` | refused | **refused**, with a new reason: `run(functionModuleName: string)` takes no function group (checked in `FunctionModuleTestRunner.run`), and the measured request needs the module's URI, which lies under its group. The message points to `runSync({ functionGroupName, functionModuleName })` |
| program, group, module `getStatus`, `getResult` | refused | refused, with the class runner's reason — a legacy run is answered finished; there is no run id |

So all four legacy runners send the modern synchronous request, with
`<options>`, and a caller's scope, risk levels and durations reach SAP. The
class, program and group `run` overrides belong in the legacy classes: the
modern `run` is the asynchronous `/runs` request, which is right on modern
systems, and the difference is 7.40's. `refusedBelow750`'s message ("answered no tests
where there are some") was measured without `<options>` and is now wrong for
these runners; it stays only if some member still uses it with a true reason,
otherwise it goes.

The class runner's comment ("the `<options>` element `runSync` sends is
unmeasured there") goes with its body: `<options>` is measured for a class.

### 6.3 Executors

`AdtExecutorLegacy` gets `getClassExecutor` and `getProgramExecutor` overrides
returning `ClassExecutorLegacy` and `ProgramExecutorLegacy`.

| member | endpoint | decision |
|---|---|---|
| class `run`, `runWithProfiler` | `/sap/bc/adt/oo/classrun/{c}` | **refused without a request**: 7.40 has neither `IF_OO_ADT_CLASSRUN` nor `/oo/classrun` (the goal, measurement 7), and `/oo/classrun` is not advertised (rule 4) |
| program `run`, `runWithProfiler` | `/sap/bc/adt/programs/programrun/{p}` | **refused until measured**: not advertised (rule 4) |
| class/program `listObjectTypes`, `listProcessTypes` | `…/abaptraces/objecttypes`, `/processtypes` | **refused until measured**: not advertised (rule 4) |
| class/program `listRequests`, `getRequestsByUri`, `scheduleTrace` | `…/abaptraces/requests`, `/parameters` | **not measured, kept** (rule 3): both collections are advertised by 7.40; nothing measured them over RFC |

`programrun` is refused only because nothing measured it; the live check in
§11.2 can flip it.

## 7. Transports

### 7.1 What 7.40 SP04 does over RFC

- `GET /sap/bc/cts/transportrequests` answered `200` with a `tm:root` document,
  with and without `?user=` (`B3-unmeasured` c1-1, c1-2).
- `POST /sap/bc/cts/transportrequests` with the modern create's document
  answered `400` "user action is not supported" (c2-1).
- Updating and deleting a request were not reached: nothing was created to act
  on.
- `/sap/bc/adt/cts/*`, which the modern members use, is not advertised and was
  not measured over RFC.

### 7.2 Decisions (`AdtRequestLegacy`)

| member | decision |
|---|---|
| `list` | **works as overridden — measured** (`GET /sap/bc/cts/transportrequests`; `configUri` still refused) |
| `readMetadata` | **works as overridden** — the same GET as `list`, measured; it answers the user's list, as its JSDoc says |
| `create` | refused — **measured** |
| `updateMetadata`, `delete` | refused — not measured; the goal: create and modify refused |
| `searchConfigurations`, `checkDeletion`, `readObjects`, `readActionLog` | **refused without a request** (rule 4): `/sap/bc/adt/cts/*` is not advertised. Today they send it |
| `addObject`, `removeObject`, `moveObjects`, `sortAndCompress`, `createTask`, `changeTaskType` | **refused without a request**, for the same reason, and because they modify |

So a legacy client lists and reads its user's requests and does nothing else
with transports. The list's content is answered as it arrived; the measured user
had no requests, so how a populated list looks — and whether `transportTree`
reads it — is not measured (§12).

## 8. Packages (`AdtPackageLegacy`)

7.40 SP04: `GET /sap/bc/adt/packages/{name}` answered `404` "No suitable
resource found" over RFC (`B3-unmeasured` b1-2, b2-0);
`POST /sap/bc/adt/packages` answered `405` "Resource controller does not support
method Create" (b2-1). The item resource is not served, although the collection
is advertised. Package contents come through `repository/nodestructure` with
`parent_type=DEVC/K` (b1-3, `200`, sixteen nodes) — another endpoint family, so
`getPackage()` does not offer them (the goal).

| member | today | decision |
|---|---|---|
| `create`, `readMetadata`, `updateMetadata`, `delete`, `validate` | refused | refused — measured for read and create |
| `lock`, `unlock`, `readTransport` | sent to `/packages/{name}` | **refused without a request**: the item resource answered `404` to the read; its `?_action=LOCK` and `/transport` are on the same resource. Not measured themselves (§12) |
| `check` | `POST /checkruns` naming `/packages/{name}` | **refused without a request**, with the handler: a check of an object 7.40 cannot address through ADT. Not measured (§12) |
| `checkDeletion` | `POST /deletion/check` | **refused — measured** (§5) |
| `read` (declared only here; `AdtPackage` has none) | refused | **kept, refused**: removing it would change a public type for no gain on 7.40 |

The class header is corrected: what is refused and why, on the measurements
above, instead of "all package operations … do not return usable results over
RFC".

## 9. Writes

No write is refused for the wire's sake: the client is an RFC client (§3), and
over RFC every write family of the supported types was measured (§10.3). Writes
are refused only where this spec refuses the member on its own grounds.

## 10. Every other member the legacy client hands out

### 10.1 Types 7.40 does not serve: `absentOnLegacy`

Measured over RFC (`B2-reads-20261023-1749`): each family below answered `404`.
Today four of these getters hand out a modern handler that sends the request.

| getter | endpoint | evidence (RFC) | decision |
|---|---|---|---|
| `getTransformation()` | `/sap/bc/adt/xslt/transformations` | the library's `read` answered `404` (s11-xslt-read) | **refused — absentOnLegacy** |
| `getScalarFunction()` | `/sap/bc/adt/ddic/dsfd/sources` | the collection answered `404` (s11-dsfd-collection, raw GET with the handler's Accept) | **refused — absentOnLegacy** |
| `getScalarFunctionImplementation()` | `/sap/bc/adt/ddic/dsfi` | not measured; not advertised | **refused until measured — absentOnLegacy** (rule 4) |
| `getAppendStructure()` | `/sap/bc/adt/ddic/structures` | the collection answered `404` (s11-append-collection, raw) | **refused — absentOnLegacy**; `getStructure()`, on the same collection, already is — now measured |
| `getEnhancement()` | `/sap/bc/adt/enhancements/*` | `404` (s11-enho-read-raw); the 37.2.0 handler refused without a request (s11-enho-read) | already `absentOnLegacy`; now measured |
| `getTable()` | `/sap/bc/adt/ddic/tables` | a table's source `404` (s11-table-read-raw); refused unsent (s11-table-read) | already `absentOnLegacy`; now measured |
| `getDomain()` | `/sap/bc/adt/ddic/domains` | `404` (s11-domain-meta-raw); refused unsent (s11-domain-meta) | already `absentOnLegacy`; now measured |
| `getDataElement()` | `/sap/bc/adt/ddic/dataelements` | `404` (s11-dtel-meta-raw); refused unsent (s11-dtel-meta) | already `absentOnLegacy`; now measured |
| `getTableType()` and the other nine | — | not measured; not advertised | already `absentOnLegacy`, unchanged (rule 4) |

### 10.2 `getUtils()` — `AdtUtilsLegacy`

| member | decision |
|---|---|
| `search`, `fetchNodeStructure`, `getObjectStructure`, `discovery`, `getInactiveObjects` | **works as inherited — measured** over RFC: `search` (`B2-reads` s10-search, `B3-cycle` s0-search), `nodestructure` (`B3-unmeasured` b1-3), `getObjectStructure` (s10-objstruct), `discovery` — 125 collections (s10-discovery), `getInactiveObjects` (s10-inactive) |
| `activateObjectsGroup` (legacy override) | works as overridden — measured earlier on BASIS 7.40 (`LEGACY.md`); not in a 7.40 SP04 record (§12) |
| `getInclude` | not measured, kept (`/programs/includes`, advertised; the include's own read is measured, `B2-reads` s5-incl-read) |
| `getWhereUsed`, `getWhereUsedScope` | **refused — measured**: `usageReferences` answered `404` (`B2-reads` s11-usage). 7.40 serves where-used only through RIS (`fullnamemapping` → `metadata` → `whereused?RIS_REQUEST_TYPE=WHERE_USED_LAZY`), another endpoint family; the message names it |
| `modifyWhereUsedScope` | **kept**: it edits XML the caller holds and sends nothing |
| `getVirtualFoldersContents` | **refused — measured**: `404` (`B2-reads` s11-vfolders); package contents are `fetchNodeStructure` with `DEVC/K` |
| `getAllTypes` | **refused — measured**: `objecttypes` answered `404` (`B2-reads` s11-objecttypes); 7.40 has `repository/typestructure`, another family |
| `getActivationRun`, `getActivationResults` | **refused**: a legacy group activation is synchronous and yields no run id (the override; `LEGACY.md`), and `/activation/runs`, `/results` are not advertised |
| `checkDeletionGroup`, `deleteObjectsGroup` | **refused — measured** (§5, §4.3) |
| `readObjectMetadata` for `domain`, `dataelement`, `structure`, `table`, `tabletype`, `package` | **refused for those types**, answered rather than thrown (a known type 7.40 lacks is a normal case; an unknown type stays the caller's mistake and is thrown as today): `404` for domain and data element (`B2-reads` s11-domain-meta-raw, s11-dtel-meta-raw), the structures collection (s11-append-collection), package (§8); tables and table types by their families (§10.1) |
| `readObjectSource` for `structure`, `table`, `tabletype` | **refused for those types**: a table's source `404` (`B2-reads` s11-table-read-raw); the structures collection `404`; table types not measured, not advertised |
| `readObjectMetadata`/`readObjectSource` for the other types | works as inherited — measured through the handlers, which send the same request (`objectWire`): `B2-reads` s1–s4, s8 |
| `getTableColumns`, `getTableContents`, `getSqlQuery`, `getObjectProperties` | refused, unchanged |
| `supportsSourceCode`, `getObjectSourceUri` | kept: pure, they describe ADT's addressing and send nothing |

### 10.3 Object handlers, member by member

"Measured" cites the RFC record; "kept" is rule 3. Deletes and deletion checks
are §4 and §5 and are not repeated.

| handler | works — measured over RFC | not measured, kept |
|---|---|---|
| class (`AdtClassLegacy`) | `create` (`B3-cycle` s1), `lock`/`unlock` (s2), `update` — stateless `PUT ?lockHandle=` (s2-update), `activate` (s4), `check` (s5), `read`/`readMetadata` (`B2-reads` s8), `getVersions` — `includes/main/versions` (s9-class-versions) | `validate`, `getVersionSource`, `readTransport`, `activateTestClasses`, `readEnhancementElements`, `readEnhancementOptions` |
| local test class, types, definitions, macros | `read` ×4 (`B2-reads` s7-*), test class `update` (`B3-cycle` s3-update) and `check` (s5-check-testclasses) | the others' `update`/`check`, `validate`, `getVersions` |
| program (`AdtProgramLegacy`) | `create`, `lock`, `update`, `unlock` (`B3-deletes` p1), `activate` (`B3-unmeasured` a1-3), `read`/`readMetadata` (`B2-reads` s1), `getVersions` (s9-prog-versions) | `validate`, `check`, `getVersionSource`, `readTransport`, enhancement readers |
| interface (`AdtInterfaceLegacy`) | `create` (`B3-deletes` i1), `lock`/`unlock` (i2e), `read`/`readMetadata` (`B2-reads` s2), `getVersions` (s9-intf-versions) | `update`, `activate`, `check`, `validate`, `getVersionSource`, `readTransport` |
| function group (`AdtFunctionGroupLegacy`) | `create`, `lock`/`unlock`, `readMetadata` (`B3-deletes` g1, g2e, g2d; `B2-reads` s3-fg-meta), `activate` (`B3-unmeasured` a2-6) | `updateMetadata`, `check`, `validate`, `readTransport`, enhancement readers |
| function module (`AdtFunctionModuleLegacy`) | `create`, `lock`, `update`, `unlock` (`B3-deletes` m1), `activate` (`B3-fugr-v1` a2-6), `read`/`readMetadata` (`B2-reads` s3) | `check`, `validate`, versions, `readTransport` |
| DDL source (`AdtDdlLegacy`) | `create`, `lock`, `update`, `unlock` (`B3-deletes` d1), `read`/`readMetadata` (`B2-reads` s4) | `activate`, `check`, `validate`, versions, `readTransport`; `checkCdsTestDoubles` stays refused |
| function include (`AdtFunctionIncludeLegacy`, new) | `create` with the v1 pair (§10.4), `lock`, `update`, `unlock` (`B3-fugr-v1` a2-5), `activate` (a2-6), `read` (`B2-reads` s5-finc-read) | `readMetadata`, `updateMetadata`, `check`, `validate`, versions |
| include (`AdtIncludeLegacy`, new) | `read` (`B2-reads` s5-incl-read) | `create`, `update`, `lock`, `unlock`, `activate`, `validate`, `readMetadata`, enhancement readers |
| message class (`AdtMessageClassLegacy`, new) | `readMetadata` (`B2-reads` s6-msag-meta) | `create`, `updateMetadata`, `lock`, `unlock`, `validate` |
| message class message | `read` (`B2-reads` s6-msg-read: the whole class document, the message present in it) | `create`, `update`, `delete`, `readMetadata` |

`AdtClassLegacy.update` is an override that only calls `super.update` while its
JSDoc says it holds one stateful session. The measured `PUT` is the inherited
stateless one, so the override and its comment are **deleted**; the note about
HTTP locks (GitHub #11) moves to `LEGACY.md`, beside §3's measurements.

The enhancement readers are kept by rule 3 although 7.40 advertises no
enhancement collection at all: their path is under the object's own advertised
collection, and an absent resource answers `404` over RFC. §12 lists them for
measurement first; a `404` there makes them refusals.

### 10.4 Function include create: the caller's v1 pair

7.40 SP04 refused the v2 type — `400` "No content handler found for content type
'application/vnd.sap.adt.functions.fincludes.v2+xml'" (`B3-unmeasured` a2-4) — and
created the include with `application/vnd.sap.adt.functions.fincludes+xml` both
ways (`B3-fugr-v1` a2-4, `200`).

**The library sends what the caller passes** (36.0.0: the pair is the
caller's), so `create` needs no override for it, and the header pairs get no
legacy branch. What changes:

- `AdtFunctionIncludeLegacy` exists (for §4.3 and §5), so the integration helper
  `src/__tests__/helpers/adtHeaders.ts` records `AdtFunctionIncludeLegacy.create`
  with the v1 pair, as it records the other `*Legacy` members; a legacy run
  then passes what 7.40 accepts.
- `LEGACY.md` states the measured pair; its footnote 4, which still says the
  create sends v2 "straight from constants/contentTypes.ts", is replaced.

### 10.5 Outside the legacy client

`AdtRuntimeClient`, `AbapDebugger`, `AmdpDebugger`, `MemorySnapshots`,
`AdtBatchConnection`, `AdtAbapGitClient` and `AdtClientsWS` have no legacy
variant, and the goal binds the legacy client and executors only. **Decision:
no legacy variant in this work.** None of these families is measured over RFC,
and most are not advertised (the gap report's section 2.8). `LEGACY.md`
gets a table of these families with what was measured and what was not, and
says that on a legacy system a consumer calls only the measured ones. A legacy
runtime client that refuses the rest would be its own goal; it is reported to
the owner, not built here (§13).

`getSystemInformation` and `isModernAdtSystem` are unchanged: the second's
reading of `core/discovery` is measured over RFC: `404`, `false`
(`B2-reads` s12-isModern).

## 11. Tests

### 11.1 Unit tests (no SAP) — each pins one decision

All on a recording connection, the pattern of `legacyDeleteTimeout.test.ts`:
they assert what leaves the wire (method, URL, query, body, headers) or that
nothing does.

- **Delete:** the six legacy deletes send exactly one `DELETE <uri>?lockHandle=<h>`,
  plus `&corrNr=` when a transport is given, and no `lockHandle` when none is;
  none calls `setSessionType`; none sends a `LOCK`. Extends
  `legacyDeleteTimeout.test.ts`.
- **Refusals:** one table-driven test over every member this spec refuses —
  per handler and member, `ok: false`, `origin: 'refusal'`,
  `UNSUPPORTED_OPERATION`, zero requests. The table *is* the list in §4–§10, so
  a refused member removed from the code fails it. `REFUSED_WITHOUT_REQUEST` in
  `adtHeaders.ts` is extended to the same members, and
  `integrationHeadersOf.test.ts` keeps proving each one sends nothing.
- **absentOnLegacy:** `legacyAbsentTypes.test.ts` gains transformation, scalar
  function, scalar function implementation and append structure.
- **Runners:** `programTestRunner.test.ts`, `functionTestRunners.test.ts`,
  `syncTestRunners.test.ts`: the legacy program and group `run` and `runSync`
  send one `POST /abapunit/testruns` with `<options>`, byte for byte the
  modern `runSync` body for that URI; `run` is read by `run`, `runSync` by
  `result`; the module's `run`, and every `getStatus`/`getResult`, refuse.
  `classTestRunner.test.ts`: the legacy class `run` and `runSync` send the
  modern `runSync` body, `<options>` included, and a caller's scope reaches it.
- **Executors:** the legacy executor hands out `ClassExecutorLegacy` and
  `ProgramExecutorLegacy`; their refused members send nothing; `listRequests`,
  `getRequestsByUri`, `scheduleTrace` send what the modern ones send.
- **Transports:** `legacyList.test.ts`: `list`/`readMetadata` send
  `GET /sap/bc/cts/transportrequests`; every other member refuses.
- **Utilities:** `readObjectMetadata`/`readObjectSource` refuse for the listed
  types and send for the rest; an unknown type still throws.
- **No legacy branch in main code:** a source test (TypeScript parser, like
  `noHardcodedObjectAddresses.test.ts`) that no file outside the `*Legacy`
  classes, `absentOnLegacy` and the two legacy clients mentions `Legacy` or
  `/sap/bc/cts` (the factories `createAdtClient`/`createAdtExecutor` excepted,
  which choose the legacy client by `isModernAdtSystem` as today).
- **Capabilities:** `capabilities/completeness.test.ts` and `behaviour.test.ts`
  cover the new legacy classes like the existing ones (every member issues the
  request its capability names, or is listed as refused).

### 11.2 Live checks on a 7.40 SP04 system

Each states where it runs: it runs when `test-config.yaml` says
`is_legacy: true` and `connection_type: "rfc"`, and skips elsewhere with that
reason — a legacy configuration over HTTP included, with "the legacy client is
supported over RFC only".

Confirming what is measured (regressions):

- the six deletes: lock → delete with the handle → unlock → read `404`; and a
  delete without a handle answering `400` for class, program, interface,
  function group;
- `checkDeletion` and the other refused members send nothing (asserted on the
  wire recorder, not on a log);
- the class, program and group `run`/`runSync` and the module `runSync`
  answer the methods of an object with tests, with `<options>` sent;
- the function include created with the v1 pair, written, activated;
- transports: `list` and `readMetadata`;
- the `absentOnLegacy` handlers and the other refused members send nothing.

Measuring what is not (each can flip a decision before the release; a probe
script under `scripts/` holds the request, as the repo's rule for measurements
asks):

- direct `DELETE ?lockHandle=` of an include, a function include, a message
  class (§4.3);
- a delete with `corrNr` in a transportable package (§4.2);
- package `lock`, `readTransport`, `check` (§8);
- `programrun`, trace `objecttypes`/`processtypes` (§6.3);
- the enhancement readers on a program and a class (§10.3);
- a populated transport list and `readMetadata` (§7.2);
- `activateObjectsGroup` on 7.40 SP04 (§10.2).

## 12. Not measured — the decisions taken without a measurement

| member(s) | decision | argued from |
|---|---|---|
| delete with `corrNr` | kept: sent when `transportRequest` is given | SAP's class controller reads it; removing it would break a transportable delete that likely works; rule 3 |
| include, function include, message class `delete` | refused until measured | "only what was measured"; today's `/deletion/*` is measured absent, and a direct DELETE is an inference |
| package `lock`, `unlock`, `readTransport`, `check` | refused | the item resource they address answered `404` to a read; the handler is refused as a whole on 7.40 |
| function module `run` | refused | not a 7.40 statement: the member's argument cannot address the measured request |
| `programrun`, `objecttypes`, `processtypes` | refused until measured | rule 4: not advertised |
| `getScalarFunctionImplementation()` | refused until measured | rule 4: not advertised; its sibling's collection answered `404` over RFC |
| `readObjectMetadata`/`Source` for table type | refused | rule 4: not advertised; the other DDIC families answered `404` over RFC |
| `getActivationRun`, `getActivationResults` | refused | the legacy group activation has no run id (code); not advertised |
| enhancement readers, `readTransport`, versions other than program's, `validate`, the unmeasured `check`s and `activate`s | kept | rule 3: under advertised collections; worst case a `404` read strictly |
| `getRequest()` `updateMetadata`, `delete` | refused | the goal: over RFC create and modify are refused |
| the other `getRequest()` members | refused | rule 4 (not advertised) |
| `listRequests`, `getRequestsByUri`, `scheduleTrace` | kept | rule 3: advertised collections |
| HTTP as a legacy wire | unsupported, documented; no branch in the library | §3's measurements; the owner's decision that the legacy server is RFC-only |
| runtime, debuggers, batch, abapGit, WS | no legacy variant; documented | outside the goal |
| `activateObjectsGroup` | kept | measured on BASIS 7.40 earlier; not in a 7.40 SP04 record |

## 13. Found while writing this

- **Stale documentation, corrected by this work:** `deleteLegacy.ts` and
  `LEGACY.md` ("a delete needs no lock", "Create and delete need no lock") —
  four of six types refuse a delete without one; the `getRequest` JSDoc in
  `AdtClientLegacy` refuses a `listNodes` that `AdtRequest` does not have and
  omits ten inherited members; the `AdtPackageLegacy` header; the
  `AdtClassLegacy` header and `update` JSDoc; `AdtExecutorLegacy`'s header and
  `refusedBelow750`'s message; `LEGACY.md`'s support matrix (package read,
  update and delete marked ✅; function include create ❌ with an outdated cause;
  `readObjectMetadata` given an informationsystem path it does not use; the
  architecture sketch's "throw error"), its "Unblocked but endpoint is absent"
  table, and README's "the legacy one differs only in the test runner".
- **The class runner dropped caller options** (`scope`, risk levels,
  durations) on a legacy system, silently. Fixed by §6.2 now that `<options>` is
  measured for a class.
- **The legacy runtime is unguarded:** `AdtRuntimeClient` and the debuggers on
  a 7.40 system send modern requests to families 7.40 mostly does not advertise.
  Outside this goal; for the owner to decide whether it is a goal of its own.
- **The HTTP logon needs a connection fix** (#91): `connect()` over
  `legacy-http` fails without the CSRF endpoint override. Not this library's,
  and moot for an RFC-only client; recorded so nobody reads §3's failures as
  this library's.
- **"No timeouts" and `options.timeout`:** the legacy deletes carry the
  caller's `options.timeout` (`withCallTimeout`, pinned by
  `legacyDeleteTimeout.test.ts`). Read as the goal intends — no deadline of the
  library's choosing — this stays; the caller's own deadline is the caller's.

## 14. Docs

- `docs/architecture/LEGACY.md` — rewritten around this spec: the legacy client
  is an RFC client, and HTTP is unsupported, with §3's measurements (replacing
  the "Connection: RFC vs HTTP" table's "read-only on legacy"); the support matrix per handler and member with "measured on 7.40 SP04",
  "not measured" or "refused"; the delete sequence (lock → delete with the
  handle → unlock) with an example; the measured function include pair; the
  transport table; the runtime families table (§10.5); a "Measured on
  7.40 SP04" section next to the earlier "Measured on BASIS 7.40", kept as it is
  and labelled with what it does not state.
- `README.md` — the executor bullet, the unit-test runner paragraphs (legacy
  `run`/`runSync` for all four runners, `<options>` sent), and that the legacy
  client is for RFC.
- `docs/usage/RFC_CONNECTION.md` and `src/clients/createAdtClient.ts`'s header —
  the legacy client over RFC; HTTP to a legacy system unsupported (the header
  now says "HTTP works … read-only on legacy").
- `docs/usage/OBJECT_LIFECYCLE.md` — the legacy delete needs the object's lock
  handle; no `checkDeletion` on legacy.
- `docs/usage/CLIENT_API_REFERENCE.md` and `docs/usage/ADT_OBJECT_ENTITIES.md`
  — wherever they list legacy support per type.
- `docs/development/RFC_TESTING.md`, `TEST_CONFIG_SCHEMA.md` — the live checks
  and that a legacy run needs `connection_type: "rfc"`.
- `docs/usage/LEGACY.md` (or the legacy section that replaces it) carries what a
  consumer on 37.2 does differently on 7.40: use the legacy client over RFC; lock
  before `delete`; no `checkDeletion` on legacy; where-used, virtual folders and
  object types are refused; the members that sent a request and now refuse, and
  the runners that refused and now send. No migration guide: a minor.
- `CHANGELOG.md` — one entry: the measured basis ("on 7.40 SP04"), the
  refusals, the fixes, RFC as the legacy wire; version 37.3.0 (a minor, §15).

## 15. Versioning

**A minor.** No public type changes: the constructors stay, the getters return
subclasses assignable to the old types, and `AdtPackageLegacy.read` stays
(refused). The behaviour changes are fixes for 7.40 SP04: the members that now
answer a refusal without a request — every legacy `checkDeletion`, three
deletes, four handlers, nine utilities, ten transport members, four package
members, six executor members — sent requests that 7.40 does not serve (SAP's
`404` over RFC, §10); they never worked there, so no consumer relied on them. The program and function group runners
go the other way, refused before and served now, which is a new capability. The
class runner's body gains `<options>`, measured to answer the same result.

The CHANGELOG lists each behaviour change under the minor, as fixes for 7.40.
No dependency moves: nothing here needs a contract change in `interfaces-adt`
or `interfaces-adt-connection`, and no `adt-strategies` reading changes.

## 16. Done means

- Every member `AdtClientLegacy` and `AdtExecutorLegacy` hand out is in exactly
  one row of §4–§10, and the refusal table test (§11.1) is that list.
- No legacy branch outside the legacy classes, pinned by the source test.
- `npm run build`, `lint:check`, `test:check` and the unit suite green; the live
  checks of §11.2 run on a 7.40 SP04 system over RFC, and every
  "measured" claim in `LEGACY.md` names the run behind it.
- Each "not measured" row of §12 is either measured before the release, with
  its decision amended here and in `LEGACY.md`, or ships as decided above and
  is listed as not measured in `LEGACY.md`.
