# Legacy System Support (BASIS < 7.50)

## Overview

Legacy SAP systems (BASIS versions older than 7.50) lack many ADT endpoints available on modern systems. The library provides `AdtClientLegacy` — a subclass of `AdtClient` — and `AdtExecutorLegacy` — a subclass of `AdtExecutor`. They hand out the same getters; each member sends the request measured accepted on SAP_BASIS 7.40 SP04, or keeps an unmeasured request under a collection 7.40 advertises (listed under [Not measured on 7.40 SP04](#not-measured-on-740-sp04)), or answers the library's refusal **without sending a request**.

**What this covers, and what it does not.** The goal is to implement what 7.40 SP04 serves through ADT and to refuse the rest without a request. What ADT does not offer on 7.40 — where-used outside RIS, DDIC sources, transport changes, … — is not this library's: reading and changing it is the work of a separate legacy MCP server, which goes through local reports on the system.

**The basis of every claim is SAP_BASIS 7.40 SP04, over RFC.** "Measured on 7.40 SP04" below names the probe record and step it comes from. The records are JSONL, one line per step, kept beside the probe scripts outside this repository. Nothing here is inferred for another release. A member no run has measured is marked **not measured**, with the decision the code ships (kept, or refused until measured). The earlier measurements on a BASIS 7.40 system whose support package was not recorded stay in [Measured on BASIS 7.40](#measured-on-basis-740-support-package-not-recorded) and are cited as such.

System detection is automatic: `createAdtClient()` asks `/sap/bc/adt/core/discovery` and returns `AdtClient` only when the answer is XML, `AdtClientLegacy` otherwise (`createAdtExecutor()` likewise). "Absent" is not one answer on a legacy system: 7.40 answers `404` "No application class found for URI" over RFC and `200 text/html` with an empty body over HTTP — which is why `isModernAdtSystem()` reads the content type rather than the status. Measured on 7.40 SP04 over RFC: `isModernAdtSystem()` answers `false` (`B2-reads-20261023-1749` s12-isModern).

### The probe records

| record | what it ran | wire |
|---|---|---|
| `B2-reads-20261023-1749` | the library's reads through `AdtClientLegacy`, raw GETs of the absent families, `isModernAdtSystem` | RFC |
| `B3-cycle-20261023-1544` | a class life cycle through the library, unit tests, deletion check, delete | RFC |
| `B3-deletes-20261023-1601` | program, interface, function group, function module, DDL: delete without a lock, then with one | RFC |
| `B3-deletes-lock-20261023-1612` | function group, function module, DDL: lock → delete with the handle → unlock | RFC |
| `B3-unmeasured-20261023-1631` | unit tests of a program, function group, module; packages; transport list and create | RFC |
| `B3-fugr-v1-20261023-1632` | the function group again, with a v1 function include holding tests | RFC |
| `B3-cycle-options-20261023-1730` | the class life cycle again, with a raw testruns POST carrying `<options>` | RFC |
| `H3-cycle-20261023-1723`, `H3-cycle-20261023-1724` | the class life cycle over `legacy-http`, without and with the CSRF endpoint override | HTTP |
| `H3-cycle-stateful-20261023-1725` | the same, with the source writes sent in the stateful session | HTTP |
| `B1-20261022-1736` (`B1-summary.md`), `B1b-gaps-20261023-1358` | the library's reads, and raw requests to the endpoints the legacy client sent | HTTP |

Every decision rests on an RFC record. The HTTP records appear only in [HTTP is not a supported legacy wire](#http-is-not-a-supported-legacy-wire), as the reason.

## The legacy client is an RFC client

The legacy client is supported, and was measured, **over RFC only**. Its consumer, the legacy MCP server, is RFC-only. The library does not detect the wire and does not branch on it: there is no wire option, no HTTP guard, and no member behaves differently by wire. A consumer that builds a legacy client over HTTP gets the RFC behaviour and SAP's HTTP answers — unsupported, for the reasons below.

**RFC transport** uses SAP's `SADT_REST_RFC_ENDPOINT` function module (the same mechanism Eclipse ADT uses via JCo). A stateful request runs in one persistent conversation — one ABAP session — so a lock handle taken there stays valid for the writes under it. See [RFC_CONNECTION.md](../usage/RFC_CONNECTION.md) for setup and configuration.

| Aspect | HTTP | RFC |
|--------|------|-----|
| Legacy client | **unsupported** (below) | supported, measured on 7.40 SP04 |
| Session model | Toggle stateful/stateless via header | Stateful requests share one conversation; the rest run in their own |
| Content negotiation | Standard HTTP Accept | Some endpoints only accept `*/*` |
| sap-client | URL query parameter | Set in RFC connection params |
| Authentication | Basic / JWT / XSUAA | Username + password only |
| Dependencies | axios | @mcp-abap-adt/sap-rfc-lite + SAP NW RFC SDK |
| Systems | Modern (>= 7.50) | All (the legacy client's only wire) |

### HTTP is not a supported legacy wire

Measured on 7.40 SP04 through the library over `legacy-http`:

- **No logon without a workaround.** `connect()` threw: no CSRF token in the response headers (`H3-cycle-20261023-1723` connect). 7.40 answers `core/discovery` with `200 text/html`, empty and without a token (`B1` R-CORE). With the CSRF endpoint overridden to `/sap/bc/adt/discovery`, the logon succeeds (`H3-cycle-20261023-1724` connect). That is `@mcp-abap-adt/connection` issue #91, not this library's, and nothing here works around it.
- **No source write.** With that override, `LOCK` answered `200` with a handle and the `PUT …/source/main?lockHandle=` answered `423` "Resource … is not locked (invalid lock handle: …)" (`H3-cycle-20261023-1724` s2-update; the test-class include, s3-update) — and the same when the `PUT` went in the stateful session (`H3-cycle-stateful-20261023-1725` s2-update, s3-update). This repeats the earlier [BASIS 7.40 measurement](#measured-on-basis-740-support-package-not-recorded).
- **Reads that disagree with RFC.** A class that exists — RFC reads its metadata `200` — read `404` "does not exist" over HTTP (`H3-cycle-20261023-1724` s9-read, after s1-create `200`); the class's test run answered no methods (s6a-run, s6b-runSync) where RFC answered two (`B3-cycle-20261023-1544` s6a-run).
- **Empty answers read as success.** `deletion/check` answered `200`, empty (`H3-cycle-20261023-1724` s7-checkDeletion), and the library said `ok: true`. So did families 7.40 does not have, which answer `404` over RFC: ten requests answered an empty `200` (`B1b` TR-6, DEL-1, DDIC-1, DDIC-2, ENH-1; `B1` R-GET-XSLT, R-GET-DSFD ×2, R-GET-APPS ×2).
- **No transports.** Every `/sap/bc/cts/*` path answered the ICF `404` before any logon (`B1b` TR-1 … TR-5); over RFC the list is served.

**The HTTP lock note (GitHub #11).** The 37.2 class handler's `update` override claimed to keep lock → update → unlock in one stateful HTTP session, because on a legacy system switching to stateless between the lock and the update invalidated the lock handle (GitHub #11). Over HTTP no session shape a client chooses gets a write through (above, and the earlier measurement). Over RFC the measured write is the inherited stateless `PUT ?lockHandle=` under a lock taken in the stateful conversation (`B3-cycle-20261023-1544` s2-update), so the override, which only called the inherited `update`, and its comment are gone.

## Architecture

```text
createAdtClient(connection)
  │
  ├── /sap/bc/adt/core/discovery answers XML? → AdtClient (modern, full CRUD)
  │
  └── 404, or anything but XML? → AdtClientLegacy (over RFC)
        ├── Served types: *Legacy handlers (direct DELETE under the caller's lock, v1 content types)
        ├── Members 7.40 does not serve, or does not advertise and nobody measured: a refusal, no request
        ├── Types 7.40 lacks: absentOnLegacy — every member answers a refusal, no request
        └── Content types: AdtContentTypesBase (versionless headers)

createAdtExecutor(connection) → AdtExecutorLegacy on the same answer
        ├── ABAP Unit runners: the synchronous /abapunit/testruns request, <options> sent
        └── Class/program executors: class run refused (measured), program run and trace type lists refused until measured; trace schedule kept
```

### The refusal

Every refusal takes one shape: answered, never thrown, through `failed()`, with `ok: false`, `origin: 'refusal'`, `code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION`, and a message naming the operation, the endpoint 7.40 lacks and — where there is one — what to use instead. A member refused until measured (rule 4 below) says only what 7.40 SP04's discovery shows: the endpoint is not advertised and not measured there. No request leaves, so `options.analyse` has nothing to read. A consumer branches on `UNSUPPORTED_OPERATION`; the message is for people.

**Why a refusal, and not SAP's `404`.** The consumer reads "not on this system" instead of a `404` it would have to interpret, and the legacy MCP server, which builds its tools from what the legacy client offers, exposes no tool that can only fail.

### How each member was decided

1. **Measured served** — a run on 7.40 SP04 accepted the request; the member sends exactly that.
2. **Measured not served** — over RFC, 7.40 SP04 answered `404`, `405` or a `400` refusing the request kind; the member is refused.
3. **Not measured, advertised** — the path belongs to a collection 7.40's `/sap/bc/adt/discovery` lists; the member keeps its request (**not measured, kept**). If 7.40 does not serve it, the answer is SAP's `404`, which the strict default reads as a failure, never as success.
4. **Not measured, not advertised** — **refused until measured**.

A measurement overrides the discovery catalogue both ways: `/deletion/*` is not advertised and measured absent; `/packages/{name}` is advertised and measured absent over RFC.

### Key differences in AdtClientLegacy

| Component | Modern (AdtClient) | Legacy (AdtClientLegacy) |
|-----------|-------------------|--------------------------|
| Content types | `AdtContentTypesModern` (v2+/v3+/v4+) | `AdtContentTypesBase` (v1 / versionless) |
| Delete | `POST /sap/bc/adt/deletion/check` + `/delete` | One `DELETE {objectUrl}?lockHandle=…` under the caller's lock — see [Delete](#delete-lock-delete-with-the-handle-unlock) |
| Deletion check | `POST /sap/bc/adt/deletion/check` | refused: 7.40 has no deletion API |
| Transport | `/sap/bc/adt/cts/transportrequests` | `/sap/bc/cts/transportrequests` — list and read only |
| Source content type | `text/plain; charset=utf-8` | `text/plain` (requires `SAP_UNICODE=false` in `.env`) |

## Delete: lock, delete with the handle, unlock

Measured on 7.40 SP04 over RFC:

- `DELETE <object>` **without** a lock handle answered `400` "Parameter lockHandle could not be found." for a class (`B3-cycle-20261023-1544` s8-delete), a program (`B3-deletes-20261023-1601` p2c), an interface (i2c) and a function group (g2c).
- Without a handle, a function module (m2c) and a DDL source (d2c) answered `200` and were gone.
- `LOCK` (stateful) → `DELETE <object>?lockHandle=…` (stateless) → `UNLOCK` (stateful) deleted all six: class (`B3-cycle-20261023-1544` c1–c4), program (`B3-deletes-20261023-1601` p2e), interface (i2e), function group (g2e; `B3-deletes-lock-20261023-1612` g2e), function module (`B3-deletes-lock-20261023-1612` m2e, `B3-fugr-v1-20261023-1632` a2-9), DDL source (`B3-deletes-lock-20261023-1612` d2e); the read afterwards answered `404` each time. The `UNLOCK` after a successful delete answered `200`.

So the six legacy `delete` members — class, program, interface, function group, function module, DDL source — send **one request**: `DELETE <object URI>?lockHandle=<options.lockHandle>`, plus `&corrNr=<transportRequest>` when the config's `transportRequest` is given, stateless, with the caller's header pair and the caller's `options.timeout`. The handle is **yours**, from `lock()`; the member does not lock, does not unlock and does not retry. Without a handle the request still goes, and SAP's `400` reaches you as the failure it is (`ok: false`, `origin: 'connection'`, status `400`).

```typescript
const program = client.getProgram();          // AdtClientLegacy, over RFC
const config = { programName: 'ZREPORT' };

const locked = await program.lock(config);    // stateful
if (!locked.ok) throw new Error(locked.getError().message);
const lockHandle = locked.getResult().value;

try {
  const deleted = await program.delete(config, { headers, lockHandle });   // one DELETE, stateless
  if (!deleted.ok) throw new Error(deleted.getError().message);
} finally {
  await program.unlock(config, lockHandle);   // stateful; answered 200 after the delete
}
```

**Not measured:** a delete with `corrNr` — every probe ran in a local package. Kept: SAP's class resource controller reads `corrNr` from the URL. `LegacyTransportable.test.ts` measures it when it is run.

### The other deletes

| member | decision |
|---|---|
| `getInclude().delete`, `getFunctionInclude().delete`, `getMessageClass().delete` | **refused**: they went through `/sap/bc/adt/deletion/*`, which 7.40 does not serve. A direct `DELETE ?lockHandle=` on these three is **not measured** and is not implemented on inference: refused until measured |
| `getUtils().deleteObjectsGroup` | **refused** — `/deletion/*` |
| `getPackage().delete`, `getRequest().delete` | refused |
| `getMessageClassMessage().delete` | **not measured, kept**: read, two locks, the `PUT` of the class, two unlocks — no `/deletion/*`; its endpoints are advertised |
| `getLocalTestClass/Types/Definitions/Macros().delete` | kept: an `update` with empty source; the write is the include `PUT`, measured for the test-class include (`B3-cycle-20261023-1544` s3-update) |

### No deletion check

7.40 SP04 has no deletion API: `POST /sap/bc/adt/deletion/check` answered `404` "No application class found for URI" over RFC (`B3-cycle-20261023-1544` s7-checkDeletion; again `B3-cycle-options-20261023-1730` s7-checkDeletion). Every `checkDeletion` the legacy client hands out — class, program, interface, function group, function module, DDL source, package, include, function include, message class, transport request — and `getUtils().checkDeletionGroup` is **refused**. The message says that `delete` with the object's lock handle is the delete.

## Object Type Support Matrix

"Measured" means measured on 7.40 SP04 over RFC, with the record and step; "kept" means not measured, the request kept; "refused" means answered without a request. Deletes and deletion checks are in [Delete](#delete-lock-delete-with-the-handle-unlock).

| Handler (getter) | Measured on 7.40 SP04 | Not measured, kept | Refused |
|---|---|---|---|
| Class (`getClass()`, `AdtClassLegacy`) | `create` (`B3-cycle-20261023-1544` s1), `lock`/`unlock` (s2), `update` — stateless `PUT ?lockHandle=` (s2-update), `activate` (s4), `check` (s5), `read`/`readMetadata` (`B2-reads-20261023-1749` s8), `getVersions` — `includes/main/versions` (s9-class-versions), `delete` | `validate`, `getVersionSource`, `readTransport`, `activateTestClasses`, `readEnhancementElements`, `readEnhancementOptions` | `checkDeletion` |
| Local test class, types, definitions, macros (`getLocalTestClass()` …) — own members | `read` ×4 (`B2-reads-20261023-1749` s7-*), test class `update` (`B3-cycle-20261023-1544` s3-update) and `check` (s5-check-testclasses) | the other three's `update`/`check`; `validate`; `getVersions` (each include's own `includes/<type>/versions`) | — |
| the same four — members inherited from `AdtClassMemberBase` | `lock`/`unlock`, `activate`, `readMetadata` — **of the container class** (below) | `readTransport`, `getVersionSource` | — |
| Program (`getProgram()`, `AdtProgramLegacy`) | `create`, `lock`, `update`, `unlock` (`B3-deletes-20261023-1601` p1), `activate` (`B3-unmeasured-20261023-1631` a1-3), `read`/`readMetadata` (`B2-reads-20261023-1749` s1), `getVersions` (s9-prog-versions), `delete` | `validate`, `check`, `getVersionSource`, `readTransport`, enhancement readers | `checkDeletion` |
| Interface (`getInterface()`, `AdtInterfaceLegacy`) | `create` (`B3-deletes-20261023-1601` i1), `lock`/`unlock` (i2e), `read`/`readMetadata` (`B2-reads-20261023-1749` s2), `getVersions` (s9-intf-versions), `delete` | `update`, `activate`, `check`, `validate`, `getVersionSource`, `readTransport` | `checkDeletion` |
| Function group (`getFunctionGroup()`, `AdtFunctionGroupLegacy`) | `create`, `lock`/`unlock`, `readMetadata` (`B3-deletes-20261023-1601` g1, g2e, g2d; `B2-reads-20261023-1749` s3-fg-meta), `activate` (`B3-unmeasured-20261023-1631` a2-6), `delete` | `updateMetadata`, `check`, `validate`, `readTransport`, enhancement readers | `checkDeletion` |
| Function module (`getFunctionModule()`, `AdtFunctionModuleLegacy`) | `create`, `lock`, `update`, `unlock` (`B3-deletes-20261023-1601` m1), `activate` (`B3-fugr-v1-20261023-1632` a2-6), `read`/`readMetadata` (`B2-reads-20261023-1749` s3), `delete` | `check`, `validate`, `getVersions`, `getVersionSource`, `readTransport` | `checkDeletion` |
| DDL source (`getDdl()`, `AdtDdlLegacy`) | `create`, `lock`, `update`, `unlock` (`B3-deletes-20261023-1601` d1), `read`/`readMetadata` (`B2-reads-20261023-1749` s4), `delete` | `activate`, `check`, `validate`, `getVersions`, `getVersionSource`, `readTransport` | `checkDeletion`, `checkCdsTestDoubles` (`/sap/bc/adt/aunit/dbtestdoubles/cds/validation` absent) |
| Function include (`getFunctionInclude()`, `AdtFunctionIncludeLegacy`) | `create` with the v1 pair (below), `lock`, `update`, `unlock` (`B3-fugr-v1-20261023-1632` a2-5), `activate` (a2-6), `read` (`B2-reads-20261023-1749` s5-finc-read) | `readMetadata`, `updateMetadata`, `check`, `validate` (a GET of its group), `getVersions`, `getVersionSource` | `delete`, `checkDeletion` |
| Include (`getInclude()`, `AdtIncludeLegacy`) | `read` (`B2-reads-20261023-1749` s5-incl-read) | `create`, `update`, `lock`, `unlock`, `activate`, `validate`, `readMetadata`, enhancement readers | `delete`, `checkDeletion` |
| Message class (`getMessageClass()`, `AdtMessageClassLegacy`) | `readMetadata` (`B2-reads-20261023-1749` s6-msag-meta) | `create`, `updateMetadata`, `lock`, `unlock`, `validate` | `delete`, `checkDeletion` |
| Message class message (`getMessageClassMessage()`) | `read` — the whole class document, the message present in it (`B2-reads-20261023-1749` s6-msg-read) | `create`, `update`, `delete`, `readMetadata` | — |
| Package (`getPackage()`, `AdtPackageLegacy`) | — | — | every member — [Packages](#packages) |
| Transport request (`getRequest()`, `AdtRequestLegacy`) | `list`, `readMetadata` | — | every other member — [Transports](#transports) |

**The local includes' inherited members act on the container class.** The four local-include handlers inherit six public members from `AdtClassMemberBase` — `lock`, `unlock`, `activate`, `readMetadata`, `readTransport`, `getVersionSource` — and every one addresses the *container class*, not the include. So `getLocalTestClass().activate()` activates the whole class, `getLocalTypes().readMetadata()` reads the class's metadata, and the include's `lock` is the class's lock — which is what the include `PUT` needs, measured (`B3-cycle-20261023-1544` s3-lock → s3-update → s3-unlock). They answer exactly as the same members of `getClass()`.

**Enhancement readers** (`readEnhancementElements`, `readEnhancementOptions` on a class, program, include, function group) are kept, not measured: 7.40 advertises no enhancement collection, but their path lies under the object's own advertised collection, and an absent resource answers `404` over RFC.

### Function include create: the v1 pair

7.40 SP04 refused the v2 type — `400` "No content handler found for content type 'application/vnd.sap.adt.functions.fincludes.v2+xml'" (`B3-unmeasured-20261023-1631` a2-4) — and created the include with **`application/vnd.sap.adt.functions.fincludes+xml` both ways** (`B3-fugr-v1-20261023-1632` a2-4, `200`). The pair is the caller's (`options.headers`, since 36.0.0), so `create` sends what you pass: on 7.40, pass the v1 pair.

```typescript
await client.getFunctionInclude().create(config, {
  headers: {
    accept: 'application/vnd.sap.adt.functions.fincludes+xml',
    contentType: 'application/vnd.sap.adt.functions.fincludes+xml',
  },
});
```

### Types 7.40 does not serve, or does not advertise: `absentOnLegacy`

The getter still hands out a handler, so code written against `AdtClient` keeps running on a legacy system. Every member of that handler answers the refusal without a request.

| Object Type | Getter | Endpoint | Evidence (RFC) |
|-------------|--------|----------|------------------|
| Transformation | `getTransformation()` | `/sap/bc/adt/xslt/transformations` | the library's `read` answered `404` (`B2-reads-20261023-1749` s11-xslt-read) |
| Scalar function | `getScalarFunction()` | `/sap/bc/adt/ddic/dsfd/sources` | the collection answered `404` (s11-dsfd-collection) |
| Scalar function implementation | `getScalarFunctionImplementation()` | `/sap/bc/adt/ddic/dsfi` | **not measured**, not advertised: refused until measured |
| Append structure | `getAppendStructure()` | `/sap/bc/adt/ddic/structures` | the collection answered `404` (s11-append-collection) |
| Structure | `getStructure()` | `/sap/bc/adt/ddic/structures` | the same collection, `404` |
| Enhancement | `getEnhancement()` | `/sap/bc/adt/enhancements/*` | `404` (s11-enho-read-raw) |
| Table | `getTable()` | `/sap/bc/adt/ddic/tables` | a table's source `404` (s11-table-read-raw) |
| Domain | `getDomain()` | `/sap/bc/adt/ddic/domains` | `404` (s11-domain-meta-raw) |
| Data Element | `getDataElement()` | `/sap/bc/adt/ddic/dataelements` | `404` (s11-dtel-meta-raw) |
| Table Type | `getTableType()` | `/sap/bc/adt/ddic/tabletypes` | not measured; not advertised |
| Access Control | `getAccessControl()` | `/sap/bc/adt/acm/dcl/sources` | not measured; not advertised |
| Service Definition | `getServiceDefinition()` | `/sap/bc/adt/ddic/srvd/sources` | not measured; not advertised |
| Service Binding | `getServiceBinding()` | `/sap/bc/adt/businessservices/bindings` | not measured; not advertised |
| Behavior Definition | `getBehaviorDefinition()` | `/sap/bc/adt/bo/behaviordefinitions` | not measured; not advertised |
| Behavior Implementation | `getBehaviorImplementation()` | `/sap/bc/adt/bo/behaviordefinitions` | not measured; not advertised |
| Metadata Extension | `getMetadataExtension()` | `/sap/bc/adt/ddic/ddlx/sources` | not measured; not advertised |
| Authorization Field | `getAuthorizationField()` | `/sap/bc/adt/aps/iam/auth` | not measured; not advertised |
| Feature Toggle | `getFeatureToggle()` | `/sap/bc/adt/sfw/featuretoggles` | not measured; not advertised |

## Packages

7.40 SP04 over RFC: `GET /sap/bc/adt/packages/{name}` answered `404` "No suitable resource found" (`B3-unmeasured-20261023-1631` b1-2, b2-0); `POST /sap/bc/adt/packages` answered `405` "Resource controller does not support method Create" (b2-1). The item resource is not served, although the collection is advertised. Package contents come through `repository/nodestructure` with `parent_type=DEVC/K` (b1-3, `200`) — `getUtils().fetchNodeStructure('DEVC/K', name)`, not `getPackage()`.

| `AdtPackageLegacy` member | decision |
|---|---|
| `create`, `readMetadata` | refused — measured |
| `updateMetadata`, `delete`, `validate` | refused — not measured |
| `lock`, `unlock`, `readTransport` | refused: the item resource answered `404` to the read; its `?_action=LOCK` and `/transport` are on the same resource. **Not measured** themselves |
| `check` | refused: a check of an object 7.40 cannot address through ADT. **Not measured** |
| `checkDeletion` | refused — measured (no deletion API) |
| `read` (declared only here) | kept, refused: removing it would change a public type |

## Transports

7.40 SP04 over RFC: `GET /sap/bc/cts/transportrequests` answered `200` with a `tm:root` document, with and without `?user=` (`B3-unmeasured-20261023-1631` c1-1, c1-2); `POST /sap/bc/cts/transportrequests` with the modern create's document answered `400` "user action is not supported" (c2-1). `/sap/bc/adt/cts/*`, which the modern members use, is not advertised.

| `AdtRequestLegacy` member | decision |
|---|---|
| `list` | measured: `GET /sap/bc/cts/transportrequests`; `configUri` is not a saved search there and is refused when given |
| `readMetadata` | measured: the same GET as `list` — the user's list |
| `create` | refused — measured |
| `updateMetadata`, `delete` | refused (not measured; changes are refused) |
| `searchConfigurations`, `checkDeletion`, `readObjects`, `readActionLog` | refused: `/sap/bc/adt/cts/*` is not advertised |
| `addObject`, `removeObject`, `moveObjects`, `sortAndCompress`, `createTask`, `changeTaskType` | refused, for the same reason, and because they change a request |

So a legacy client lists and reads its user's requests and does nothing else with transports. The list is answered as it arrived. **Not measured:** a populated list — the measured user had no requests — and so whether `transportTree` from adt-strategies reads it; inject a reading for your system if it does not.

## ABAP Unit runners and executors

7.40 SP04 has no `/abapunit/runs`; `POST /sap/bc/adt/abapunit/testruns` (`application/xml` both ways) runs the tests and answers the finished result. Measured over RFC:

- a class: without `<options>`, two methods, one passed, one failed (`B3-cycle-20261023-1544` s6a-run, s6b-runSync); with `<options>`, the same result (`B3-cycle-options-20261023-1730` s6b-raw-testruns);
- a program, with `<options>`: two methods, one alert (`B3-unmeasured-20261023-1631` a1-6);
- a function group and a function module, with `<options>`: two methods, one alert (`B3-fugr-v1-20261023-1632` a2-7, a2-8) once the group held a test include; without one, `noTestClasses` (`B3-unmeasured-20261023-1631` a2-7, a2-8). The module's URI ran the group's tests.

| Runner member (`AdtExecutorLegacy`) | decision |
|---|---|
| class, program, function group `runSync` | measured — the modern `runSync`, inherited: one testruns POST with `<options>`, read by the `result` strategy |
| class, program, function group `run` | the same request, read by the `run` strategy: on 7.40 the testruns POST is the run |
| function module `runSync` | measured — inherited |
| function module `run` | refused: `run(functionModuleName)` names no group, and the measured request needs the module's URI under its group. Use `runSync({ functionGroupName, functionModuleName })` |
| every `getStatus`, `getResult` | refused: a legacy run answers finished; there is no run id |

`<options>` is always sent — the caller's scope, risk levels and durations, with `run`'s defaults.

| Executor member | endpoint | decision |
|---|---|---|
| class `run`, `runWithProfiler` (`ClassExecutorLegacy`) | `/sap/bc/adt/oo/classrun/{c}` | refused: 7.40 has neither `IF_OO_ADT_CLASSRUN` nor `/oo/classrun` |
| program `run`, `runWithProfiler` (`ProgramExecutorLegacy`) | `/sap/bc/adt/programs/programrun/{p}` | refused until measured: **not measured**, not advertised |
| class/program `listObjectTypes`, `listProcessTypes` | `…/abaptraces/objecttypes`, `/processtypes` | refused until measured: **not measured**, not advertised |
| class/program `listRequests`, `getRequestsByUri`, `scheduleTrace` | `…/abaptraces/requests`, `/parameters` | **not measured, kept**: both collections are advertised |

## Shared Utilities (`getUtils()`, `AdtUtilsLegacy`)

| member | decision |
|---|---|
| `search` | measured (`B2-reads-20261023-1749` s10-search, `B3-cycle-20261023-1544` s0-search) — `/repository/informationsystem/search` |
| `fetchNodeStructure` | measured (`B3-unmeasured-20261023-1631` b1-3) — `/repository/nodestructure`; package contents with `DEVC/K` |
| `getObjectStructure` | measured (`B2-reads-20261023-1749` s10-objstruct) |
| `discovery` | measured — 125 collections (s10-discovery) |
| `getInactiveObjects` | measured (s10-inactive); 7.40 answers the older `adtcore:objectReferences` document |
| `readObjectMetadata`, `readObjectSource` for the served types (program, class, interface, function group and module, DDL source, …) | measured through the handlers, which send the same request (`B2-reads-20261023-1749` s1–s4, s8) |
| `readObjectMetadata` for `domain`, `dataelement`, `structure`, `table`, `tabletype`, `package` (and their type codes, any case) | refused (answered, not thrown): their families answered `404` or are not advertised; an unknown type is still thrown |
| `readObjectSource` for `structure`, `table`, `tabletype` | refused, the same way |
| `activateObjectsGroup` | kept (legacy override): synchronous `POST /activation?method=activate`, no `/activation/runs`. Measured earlier on BASIS 7.40; **not measured** on 7.40 SP04 |
| `getInclude` | not measured, kept (`/programs/includes` advertised) |
| `getWhereUsed`, `getWhereUsedScope` | refused — measured: `usageReferences` answered `404` (s11-usage). 7.40 serves where-used only through RIS (`fullnamemapping` → `metadata` → `whereused?RIS_REQUEST_TYPE=WHERE_USED_LAZY`), another family; the message names it |
| `modifyWhereUsedScope` | kept: edits XML you hold, sends nothing |
| `getVirtualFoldersContents` | refused — measured: `404` (s11-vfolders); package contents are `fetchNodeStructure` with `DEVC/K` |
| `getAllTypes` | refused — measured: `objecttypes` answered `404` (s11-objecttypes); 7.40 has `repository/typestructure`, another family |
| `getActivationRun`, `getActivationResults` | refused: a legacy group activation yields no run id; `/activation/runs` is not advertised |
| `checkDeletionGroup`, `deleteObjectsGroup` | refused — measured (no deletion API) |
| `getTableColumns`, `getTableContents`, `getSqlQuery`, `getObjectProperties` | refused (`/datapreview/*`, `objectproperties/values` absent) |
| `supportsSourceCode`, `getObjectSourceUri` | kept: pure, send nothing |

## The clients' own members

`AdtClientLegacy` inherits `unlockAll()`, `pendingLocks` and `[Symbol.asyncDispose]()` from `AdtClient`. They send nothing of their own: `unlockAll` (and the dispose) sends, for every lock still tracked, the `UNLOCK` of the handler that took it. That `UNLOCK` is measured for a class, program, interface, function group, function module, DDL source and function include; it is **not measured** for an include and a message class (their `lock`/`unlock` are kept, not measured). A handler whose `lock` is refused (package) tracks nothing. `AdtExecutorLegacy` has only getters.

## Outside the legacy client: no legacy variant

`AdtRuntimeClient`, `AbapDebugger`, `AmdpDebugger`, `MemorySnapshots`, `AdtBatchConnection`, `AdtAbapGitClient` and `AdtClientsWS` have no legacy variant: on a 7.40 system they send their modern requests and nothing refuses them. **None of these families was measured over RFC on 7.40 SP04.** On a legacy system, call only what is measured — which, today, is none of them. "Advertised" is whether 7.40's `/sap/bc/adt/discovery` lists the collection, which is not a measurement (see [Discovery Reference](#discovery-reference)).

| Family | Client | Endpoint | Advertised by 7.40 |
|---|---|---|---|
| Cross trace | `AdtRuntimeClient.getCrossTrace()` | `/sap/bc/adt/crosstrace/*` | no |
| ST05 trace | `getSt05Trace()` | `/sap/bc/adt/st05/trace/*` | no |
| Application log | `getApplicationLog()` | `/sap/bc/adt/applicationlog/objects` | no |
| ATC check variants, worklists, findings, logs | `getAtc()`, `getAtcLog()` | `/sap/bc/adt/atc/variants`, `/worklists`, `/checkfailures/logs`, `/results/{id}/log` | no |
| ATC run, run status, check variant | `getAtc()` | `/sap/bc/adt/atc/runs`, `/atc/customizing` | yes — `/atc/customizing` answered `404` in the earlier BASIS 7.40 measurement |
| DDIC activation graph | `getDdicActivation()` | `/sap/bc/adt/ddic/logs/activationgraph` | no |
| Profiler traces | `getProfiler()` | `/sap/bc/adt/runtime/traces/abaptraces/*` | yes |
| Feeds | `getFeeds()` | `/sap/bc/adt/feeds` | yes |
| Runtime dumps | `getDumps()` | `/sap/bc/adt/runtime/dumps` | no |
| System messages | `getSystemMessages()` | `/sap/bc/adt/runtime/systemmessages` | no |
| Gateway error log | `getGatewayErrorLog()` | `/sap/bc/adt/gw/errorlog` | no |
| Memory snapshots | `MemorySnapshots` | `/sap/bc/adt/runtime/memory/snapshots` | no |
| ABAP debugger — root, breakpoints, listeners | `AbapDebugger` | `/sap/bc/adt/debugger/*` | yes |
| ABAP debugger — watchpoints, batch | `AbapDebugger`, `AdtBatchConnection('debugger')` | `/sap/bc/adt/debugger/watchpoints`, `/debugger/batch` | no |
| AMDP debugger | `AmdpDebugger` | `/sap/bc/adt/amdp/debugger/main`, `/datapreview/amdpdebugger` | no |
| Communication batch | `AdtBatchConnection('communication')` | `/sap/bc/adt/communication/batch` | no |
| abapGit (ADT-integrated) | `AdtAbapGitClient` | `/sap/bc/adt/abapgit/*` | no (ABAP Platform 2022+ / Steampunk) |
| WebSocket | `AdtClientsWS` | the URL you give | — |

`getSystemInformation` and `isModernAdtSystem` are unchanged. The second's reading of `core/discovery` is measured over RFC: `404`, `false` (`B2-reads-20261023-1749` s12-isModern).

## Not measured on 7.40 SP04

Each row ships as decided until a run on 7.40 SP04 measures it. The live checks (below) measure several of them when they are run.

| member(s) | shipped decision | argued from |
|---|---|---|
| delete with `corrNr` (`transportRequest` given) | kept | SAP's class controller reads it; a transportable delete likely works |
| `delete` of include, function include, message class (a direct `DELETE ?lockHandle=`) | refused until measured | `/deletion/*` is measured absent; a direct DELETE would be an inference |
| package `lock`, `unlock`, `readTransport`, `check` | refused | the item resource answered `404` to a read |
| `programrun`; trace `objecttypes`, `processtypes` | refused until measured | not advertised |
| `getScalarFunctionImplementation()` (`/sap/bc/adt/ddic/dsfi`) | refused until measured | not advertised; its sibling's collection answered `404` |
| `readObjectMetadata`/`readObjectSource` for table types | refused | not advertised; the other DDIC families answered `404` |
| a populated transport list, and `readMetadata` over it | kept | the measured user had no requests |
| enhancement readers; `readTransport`; versions other than those measured; `validate`; the `check`s and `activate`s not listed as measured | kept | under advertised collections; at worst a `404`, read strictly |
| the local includes' `readTransport`, `getVersionSource`, `getVersions`, `validate`, and the non-test-class includes' `update`/`check` | kept | `/oo/classes` advertised; the inherited members address the container class |
| message class `create`, `updateMetadata`, `lock`, `unlock`, `validate`; message class message `create`, `update`, `delete`, `readMetadata` | kept | advertised |
| trace `listRequests`, `getRequestsByUri`, `scheduleTrace` | kept | advertised |
| `activateObjectsGroup` | kept | measured earlier on BASIS 7.40, not in a 7.40 SP04 record |
| function module runner `run` | refused | not a 7.40 statement: `run(functionModuleName)` names no group, and the measured request needs the module's URI under its group |
| `getUtils()` `getActivationRun`, `getActivationResults` | refused | a legacy group activation yields no run id; `/activation/runs` is not advertised |
| `getRequest()` `updateMetadata`, `delete` | refused | changes to a request are refused on legacy |
| the other `getRequest()` members (`searchConfigurations`, `checkDeletion`, `readObjects`, `readActionLog`, `addObject`, `removeObject`, `moveObjects`, `sortAndCompress`, `createTask`, `changeTaskType`) | refused | not advertised (`/sap/bc/adt/cts/*`) |
| HTTP as a legacy wire | unsupported, documented; no branch in the library | the HTTP measurements above; the legacy MCP server is RFC-only |
| the runtime, debugger, batch, abapGit and WS families | no legacy variant | outside the legacy client |

## Live checks on a 7.40 SP04 system

The live checks under `src/__tests__/integration/legacy/` are written; how to run them, and the test environment they use (prefix `ZLG7`, the environment classes run through ABAP Unit, `npm run legacy:setup` / `legacy:status` / `legacy:teardown`, the configuration `test-config.legacy-740.yaml.template` loaded through `MCP_TEST_CONFIG_PATH`), is in [RFC_TESTING.md](../development/RFC_TESTING.md#the-740-system-a-configuration-and-an-environment-of-its-own). They run only on a configuration with `is_legacy: true` and `connection_type: "rfc"`, and skip with the reason elsewhere — a legacy configuration over HTTP included ("the legacy client is supported over RFC only"). No result of theirs is recorded here yet.

## What changes on 7.40 for a consumer of 37.2

37.3.0 is a minor. The public types are 37.2's, with one exception: the legacy runners' `run` / `runSync` that refused in 37.2 (the program and function group runners' `run` and `runSync`, the function module runner's `runSync`) declared no parameters there; they now send, and declare the base runner's parameters, so a call without arguments — refused at run time in 37.2 — no longer compiles. On a 7.40 system:

- **Use the legacy client over RFC.** HTTP to a legacy system is unsupported ([why](#http-is-not-a-supported-legacy-wire)).
- **Lock before `delete`.** A class, program, interface or function group delete without the object's lock handle answers SAP's `400`. Lock, pass the handle as `options.lockHandle`, unlock ([Delete](#delete-lock-delete-with-the-handle-unlock)). 37.2's documentation said a delete needs no lock; on 7.40 SP04 that is wrong.
- **No `checkDeletion`.** Every `checkDeletion`, and `checkDeletionGroup`, answers the refusal; 37.2 sent `POST /deletion/check`, which 7.40 answers `404`.
- **Where-used, virtual folders and object types are refused** — `getWhereUsed`, `getWhereUsedScope`, `getVirtualFoldersContents`, `getAllTypes`.
- **Members that sent a request in 37.2 and now refuse without one:**
  - every `checkDeletion` (above);
  - `delete` of an include, a function include and a message class, and `getUtils().deleteObjectsGroup`;
  - the handlers `getTransformation()`, `getScalarFunction()`, `getScalarFunctionImplementation()`, `getAppendStructure()` — now `absentOnLegacy`;
  - `getUtils()`: `getWhereUsed`, `getWhereUsedScope`, `getVirtualFoldersContents`, `getAllTypes`, `getActivationRun`, `getActivationResults`, `checkDeletionGroup`, `deleteObjectsGroup`, and `readObjectMetadata`/`readObjectSource` for the DDIC and package types listed above;
  - `getRequest()`: `searchConfigurations`, `checkDeletion`, `readObjects`, `readActionLog`, `addObject`, `removeObject`, `moveObjects`, `sortAndCompress`, `createTask`, `changeTaskType`;
  - `getPackage()`: `lock`, `unlock`, `readTransport`, `check`;
  - `getClassExecutor()` and `getProgramExecutor()`: `run`, `runWithProfiler`, `listObjectTypes`, `listProcessTypes`.
- **Runners that refused in 37.2 and now send:** the program and function group runners' `run` and `runSync`, and the function module runner's `runSync` — one `POST /abapunit/testruns` with `<options>`. The class runner's request now carries `<options>` too, so a caller's scope, risk levels and durations reach SAP (37.2 dropped them silently); the measured answer is the same.
- **Function include create:** pass the v1 pair `application/vnd.sap.adt.functions.fincludes+xml` ([above](#function-include-create-the-v1-pair)).

## Measured on 7.40 SP04

The measurements this document cites, in one place; each names its record and step (over RFC unless marked HTTP).

- **Delete:** without a lock handle `400` for class, program, interface, function group; `200` for function module and DDL source; lock → delete with the handle → unlock deleted all six, the read afterwards `404` ([Delete](#delete-lock-delete-with-the-handle-unlock)).
- **No deletion API:** `POST /deletion/check` `404` (`B3-cycle-20261023-1544` s7-checkDeletion, `B3-cycle-options-20261023-1730` s7-checkDeletion).
- **ABAP Unit:** `/abapunit/testruns` answered the finished result for a class (with and without `<options>`), a program, a function group and a function module ([runners](#abap-unit-runners-and-executors)).
- **Function include:** v2 `400`, v1 created (`B3-unmeasured-20261023-1631` a2-4, `B3-fugr-v1-20261023-1632` a2-4).
- **Transports:** list `200`, create `400` (`B3-unmeasured-20261023-1631` c1-1, c1-2, c2-1).
- **Packages:** item `404`, create `405`, `nodestructure` `200` (`B3-unmeasured-20261023-1631` b1-2, b2-0, b2-1, b1-3).
- **Absent families:** transformations, scalar functions, structures, enhancements, tables, domains, data elements, `usageReferences`, virtual folders, `objecttypes` — `404` (`B2-reads-20261023-1749` s11-*).
- **Served reads:** search, node structure, object structure, discovery (125 collections), inactive objects, and every handler read in the matrix (`B2-reads-20261023-1749` s1–s10).
- **`core/discovery`:** `404`, so `isModernAdtSystem()` is `false` (`B2-reads-20261023-1749` s12-isModern).
- **HTTP:** logon only with the CSRF endpoint overridden; writes `423`; reads that disagree with RFC; empty `200`s read as success; `/sap/bc/cts/*` unreachable ([HTTP](#http-is-not-a-supported-legacy-wire)).

## Measured on BASIS 7.40 (support package not recorded)

On premise, BASIS 7.40, 2026-10-01, over RFC and over HTTP. **These measurements do not state the system's support package**, so they are not 7.40 SP04 claims; where they and a 7.40 SP04 record speak to the same thing, the 7.40 SP04 record is the one cited. They also do not state whether the delete in the RFC cycle carried a lock handle — "create and delete need no lock", which earlier versions of this document derived, is contradicted by the 7.40 SP04 measurement for four of six types.

- **No update over HTTP.** In three session shapes — no `x-sap-adt-sessiontype`
  header; the header on `LOCK`/`UNLOCK` only; the header and the full cookie jar
  on every request — `LOCK` answered `200` with a `LOCK_HANDLE` and set no
  `sap-contextid`, and the next `PUT` under that handle answered `423`
  "Resource … is not locked (invalid lock handle: …)". Over RFC on the same
  system create → lock → two writes → unlock → activate → delete were all
  accepted.
- **`/sap/bc/adt/activation/inactiveobjects` answers the older document**, a flat
  `adtcore:objectReferences` with one `adtcore:objectReference` per object
  (`adtcore:uri`, `adtcore:type`, `adtcore:name`; a function module carries its
  group as `adtcore:parentUri`), not `ioc:inactiveObjects`. `getInactiveObjects()`
  keeps the document (`inactive: rawDocument`); a reading of the newer shape
  alone answers an empty list over objects that are inactive.
- **A group activation answers `200` with an empty body on success** — no
  checklist, no messages, no run id. Six objects activated that way; the
  inactive-objects list read afterwards named none of them.
- **`/sap/bc/adt/core/discovery`** answers `404` "No application class found
  for URI" over RFC and `200 text/html`, empty, over HTTP — see
  [Overview](#overview).

## Validation Endpoints on Legacy

Advertised by the legacy discovery document; `validate` itself is **not measured** on 7.40 SP04 for any type (kept):

| Endpoint | Used by |
|----------|---------|
| `/sap/bc/adt/oo/validation/objectname` | Class, Interface validation |
| `/sap/bc/adt/programs/validation` | Program validation |
| `/sap/bc/adt/functions/validation` | Function Group, Function Module validation |
| `/sap/bc/adt/ddic/views/$validation` | View validation |
| `/sap/bc/adt/ddic/ddl/validation` | DDL Source validation |
| `/sap/bc/adt/includes/validation` | Include validation |

Not advertised (their handlers are refused on legacy):

| Endpoint | Would be used by |
|----------|-----------------|
| `/sap/bc/adt/packages/validation` | Package validation |
| `/sap/bc/adt/ddic/domains/validation` | Domain validation |
| `/sap/bc/adt/ddic/dataelements/validation` | DataElement validation |
| `/sap/bc/adt/ddic/tables/validation` | Table validation |
| `/sap/bc/adt/ddic/structures/validation` | Structure validation |
| `/sap/bc/adt/ddic/tabletypes/validation` | TableType validation |

## Content Type Versioning

Legacy systems do not support versioned content types. The `AdtContentTypesBase` class provides v1/versionless headers:

| Operation | Legacy (Base) | Modern |
|-----------|--------------|--------|
| Class create | `application/vnd.sap.adt.oo.classes+xml` | `application/vnd.sap.adt.oo.classes.v4+xml` |
| Program create | `application/vnd.sap.adt.programs.programs+xml` | `application/vnd.sap.adt.programs.programs.v2+xml` |
| Function group create | `application/vnd.sap.adt.functions.groups+xml` | `application/vnd.sap.adt.functions.groups.v3+xml` |
| Function include create | `application/vnd.sap.adt.functions.fincludes+xml` (measured on 7.40 SP04; pass it as `headers`) | `application/vnd.sap.adt.functions.fincludes.v2+xml` |
| Source artifact | `text/plain` | `text/plain; charset=utf-8` |

## Discovery Reference

Measured catalogue sizes — collections advertised by `/sap/bc/adt/discovery`:

| System | Collections |
|---|---|
| Legacy on-prem, SAP_BASIS 7.40 SP04 (`B2-reads-20261023-1749` s10-discovery) | 125 |
| Legacy on-prem (BASIS ~7.40, support package not recorded) | 124 |
| Modern on-prem (S/4 HANA) | 818 |
| ABAP Cloud (a trial account and a production tenant, separately) | 918 each |

The legacy system advertises **15%** of what the modern one does, and the two
cloud captures were functionally identical — their only differences were their
own base URLs.

**Advertised is not available.** The legacy catalogue lists
`/sap/bc/adt/atc/customizing`, and a `GET` of it answers
`404 No suitable resource found`; on 7.40 SP04 the packages collection is
advertised and its item resource answers `404` over RFC. So a hit from
`fetchDiscoveryEndpoints` means the system says it has the resource; a miss is
the stronger signal.

The raw catalogues are not kept in the tree — re-fetchable from any system in
one request, and in git history for anyone who wants the exact bytes.

Use `fetchDiscoveryEndpoints(connection)` from the public API to read a specific system's catalogue at runtime.
