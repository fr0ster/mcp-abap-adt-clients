# Legacy System Support (BASIS < 7.50)

## Overview

Legacy SAP systems (BASIS versions older than 7.50) lack many ADT endpoints available on modern systems. The library provides `AdtClientLegacy` — a subclass of `AdtClient` that blocks unsupported operations and uses legacy-compatible alternatives where possible.

System detection is automatic: `createAdtClient()` asks `/sap/bc/adt/core/discovery` and returns `AdtClient` only when the answer is XML, `AdtClientLegacy` otherwise. "Absent" is not one answer on a legacy system: BASIS 7.40 answers `404` "No application class found for URI" over RFC and `200 text/html` with an empty body over HTTP — which is why `isModernAdtSystem()` reads the content type rather than the status. Measured on premise, BASIS 7.40, 2026-10-01: over RFC `isModernAdtSystem()` answers `false` and `createAdtClient()` returns `AdtClientLegacy`.

## Connection: RFC vs HTTP

Legacy systems do not support the `x-sap-adt-sessiontype: stateful` HTTP header (introduced in BASIS 7.50). Without stateful sessions, lock handles are lost between HTTP requests — making updates, which are written under a lock, impossible. Create and delete need no lock.

Measured on premise, BASIS 7.40, 2026-10-01, three session shapes over HTTP: no header at all; the header on `LOCK`/`UNLOCK` only; the header and the context cookie on every request. In each, `LOCK` answers `200` with a `LOCK_HANDLE` but sets no `sap-contextid`, and the next `PUT` under that handle answers `423` "Resource … is not locked (invalid lock handle: …)". No session shape a client chooses changes it: **over HTTP a legacy system cannot update an object, and updates go over RFC.** See [Measured on BASIS 7.40](#measured-on-basis-740).

**RFC transport** solves this by using SAP's `SADT_REST_RFC_ENDPOINT` function module (the same mechanism Eclipse ADT uses via JCo). RFC connections are inherently stateful — one ABAP session per connection — so lock handles persist across calls.

| Aspect | HTTP | RFC |
|--------|------|-----|
| Session model | Toggle stateful/stateless via header | Always stateful |
| Lock handles | Lost on legacy (no stateful header) | Preserved |
| Content negotiation | Standard HTTP Accept | Some endpoints only accept `*/*` |
| sap-client | URL query parameter | Set in RFC connection params |
| Authentication | Basic / JWT / XSUAA | Username + password only |
| Dependencies | axios | @mcp-abap-adt/sap-rfc-lite + SAP NW RFC SDK |
| Systems | Modern (>= 7.50) | All (primary use: legacy) |

See [RFC_CONNECTION.md](../usage/RFC_CONNECTION.md) for setup and configuration.

## Architecture

```text
createAdtClient(connection)
  │
  ├── /sap/bc/adt/core/discovery answers XML? → AdtClient (modern, full CRUD)
  │
  └── 404, or anything but XML? → AdtClientLegacy
        ├── Supported types: *Legacy handlers (direct DELETE, v1 content types)
        ├── Unsupported types: throw error with missing endpoint name
        └── Content types: AdtContentTypesBase (versionless headers)
```

### Key differences in AdtClientLegacy

| Component | Modern (AdtClient) | Legacy (AdtClientLegacy) |
|-----------|-------------------|--------------------------|
| Content types | `AdtContentTypesModern` (v2+/v3+/v4+) | `AdtContentTypesBase` (v1 / versionless) |
| Delete | `POST /sap/bc/adt/deletion/check` + `/delete` | Direct `DELETE {objectUrl}` — no lock is needed; a `lockHandle` is passed through only when the caller gives one |
| Transport | `/sap/bc/adt/cts/transportrequests` | `/sap/bc/cts/transportrequests` |
| Source content type | `text/plain; charset=utf-8` | `text/plain` (requires `SAP_UNICODE=false` in `.env`) |

## Object Type Support Matrix

### Fully supported (CRUD)

These types have dedicated `*Legacy` handler classes with legacy-compatible delete, content types, and lock handling.

| Object Type | Getter | Endpoint | validate | create | read | update | delete | activate | check |
|-------------|--------|----------|----------|--------|------|--------|--------|----------|-------|
| Program | `getProgram()` | `/sap/bc/adt/programs/programs` | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
| Class | `getClass()` | `/sap/bc/adt/oo/classes` | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
| Interface | `getInterface()` | `/sap/bc/adt/oo/interfaces` | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
| Function Group | `getFunctionGroup()` | `/sap/bc/adt/functions/groups` | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
| Function Module | `getFunctionModule()` | `/sap/bc/adt/functions/groups/.../fmodules` | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
| Function Include | `getFunctionInclude()` | `/sap/bc/adt/functions/groups/.../includes` | ✅ | ❌⁴ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
| DDL Source (CDS view, AMDP table function) | `getDdl()` | `/sap/bc/adt/ddic/ddl/sources` | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
| Package | `getPackage()` | `/sap/bc/adt/packages` | ❌² | ❌³ | ✅ | ✅ | ✅¹ | — | — |

¹ Delete uses direct `DELETE` on the object (no `/sap/bc/adt/deletion/check` + `/delete` API); it needs no lock
² `/sap/bc/adt/packages/validation` not present in legacy discovery
³ Package creation on legacy systems is only possible via SAP GUI (SE80/SE21)
⁴ `create` sends `application/vnd.sap.adt.functions.fincludes.v2+xml` straight from `constants/contentTypes.ts`, past `IAdtContentTypes`, and BASIS 7.40 answers `400` "No content handler found for content type 'application/vnd.sap.adt.functions.fincludes.v2+xml'" (measured on premise, 2026-10-01). The discovery document of that system names no function-include type at all, so the type it does accept is still to be measured

### Not supported (endpoints absent from discovery)

The getter still hands out a handler, so code written against `AdtClient` keeps
running on a legacy system. Every member of that handler answers a refusal
without sending a request: `ok: false`, `origin: 'refusal'`,
`code: UNSUPPORTED_OPERATION`, and a message naming the missing endpoint. Until
this release the getter threw before any request.

abapGit is the exception in this table: it is a separate client, not a getter,
and nothing in it is blocked — its requests reach a legacy system and are
answered there.

| Object Type | Getter | Missing Endpoint |
|-------------|--------|------------------|
| Domain | `getDomain()` | `/sap/bc/adt/ddic/domains` |
| Data Element | `getDataElement()` | `/sap/bc/adt/ddic/dataelements` |
| Table | `getTable()` | `/sap/bc/adt/ddic/tables` |
| Structure | `getStructure()` | `/sap/bc/adt/ddic/structures` |
| Table Type | `getTableType()` | `/sap/bc/adt/ddic/tabletypes` |
| Access Control | `getAccessControl()` | `/sap/bc/adt/acm/dcl/sources` |
| Service Definition | `getServiceDefinition()` | `/sap/bc/adt/ddic/srvd/sources` |
| Service Binding | `getServiceBinding()` | `/sap/bc/adt/businessservices/bindings` |
| Behavior Definition | `getBehaviorDefinition()` | `/sap/bc/adt/bo/behaviordefinitions` |
| Behavior Implementation | `getBehaviorImplementation()` | `/sap/bc/adt/bo/behaviordefinitions` |
| Metadata Extension | `getMetadataExtension()` | `/sap/bc/adt/ddic/ddlx/sources` |
| Enhancement | `getEnhancement()` | `/sap/bc/adt/enhancements/*` |
| Authorization Field | `getAuthorizationField()` | `/sap/bc/adt/aps/iam/auth` (modern kernel only; absent on legacy) |
| Feature Toggle | `getFeatureToggle()` | `/sap/bc/adt/sfw/featuretoggles` (modern kernel only; absent on legacy) |
| abapGit (ADT-integrated) | `new AdtAbapGitClient()` | `/sap/bc/adt/abapgit/*` (ships with ABAP Platform 2022+ / Steampunk; absent on legacy) |

### Unblocked but endpoint is absent

| Object Type | Getter | Note |
|-------------|--------|------|
| ABAP Unit run | `AdtExecutorLegacy.getClassTestRunner()` | `/sap/bc/adt/abapunit/testruns` IS present on legacy — `run` answers the finished result; `getStatus`/`getResult` refuse without a request |
| ABAP Unit run of a function group or module | `AdtExecutorLegacy.getFunctionGroupTestRunner()`, `getFunctionModuleTestRunner()` | refused without a request — no legacy endpoint measured to find them |
| ABAP Unit run of a report | `AdtExecutorLegacy.getProgramTestRunner()` | refused without a request — `/abapunit/testruns` given a report's URI answered an empty result where `/abapunit/runs` found the tests |
| CDS test-doubles check | `getDdl().checkCdsTestDoubles()` | `/sap/bc/adt/aunit/dbtestdoubles/cds/validation` absent — refused without a request |
| Transport Request | `getRequest()` | Uses `/sap/bc/cts/` — `read()`/`list()` work, `create()`/`update()`/`delete()` answer a refusal. `list()` takes no `configUri` (the endpoint is no saved search, and one that is passed is refused rather than ignored) and answers the document as it came; its payload has never been captured, so `transportTree` from adt-strategies may not read it — inject a reading for your system |

## Shared Utilities (AdtUtils) Support

### Available on legacy

| Utility | Method | Endpoint |
|---------|--------|----------|
| Search objects | `search()` | `/sap/bc/adt/repository/informationsystem/search` |
| Node structure | `fetchNodeStructure()` | `/sap/bc/adt/repository/nodestructure` |
| Package hierarchy | removed in 19.0.0 — the caller walks `fetchNodeStructure()` | (uses nodeStructure) |
| Package contents | removed in 19.0.0 — the caller walks `fetchNodeStructure()` | (uses nodeStructure) |
| Object structure | `getObjectStructure()` | `/sap/bc/adt/repository/objectstructure` |
| Read metadata | `readObjectMetadata()` | `/sap/bc/adt/repository/informationsystem/metadata` |
| Inactive objects | `getInactiveObjects()` | `/sap/bc/adt/activation/inactiveobjects` |
| Discovery | `getDiscovery()` | `/sap/bc/adt/discovery` |
| Single activation | (used internally) | `POST /sap/bc/adt/activation?method=activate` |
| Group activation | `activateObjectsGroup()` (`AdtUtilsLegacy`) | `POST /sap/bc/adt/activation?method=activate` — synchronous, no `/activation/runs`; a success answers `200` with an empty body ([Measured on BASIS 7.40](#measured-on-basis-740)) |
| Check runs | (used internally) | `/sap/bc/adt/checkruns` |

### Not available on legacy

| Utility | Method | Missing Endpoint | Legacy Alternative |
|---------|--------|------------------|--------------------|
| Where-used | `getWhereUsedScope()`, `modifyWhereUsedScope()`, `getWhereUsed()` | `/sap/bc/adt/repository/informationsystem/usageReferences` | Old API exists: `POST .../whereused?RIS_REQUEST_TYPE=WHERE_USED_LAZY` + `.../fullnamemapping` — not yet implemented |
| Group deletion | `checkDeletionGroup()`, `deleteObjectsGroup()` | `/sap/bc/adt/deletion/check` + `/delete` | Direct `DELETE` per object (used by Legacy handlers) |
| Table contents | `getTableContents()` | `/sap/bc/adt/datapreview/ddic` | None |
| SQL query | `getSqlQuery()` | `/sap/bc/adt/datapreview/freestyle` | None |
| Virtual folders | `getVirtualFoldersContents()` | `.../virtualfolders` | None |
| Object properties | *(removed — see below)* | `.../objectproperties/values` | None |

`getTypeInfo()` and `getTransaction()` were the two members that reached
`objectproperties/values`, and both were removed as uncalled — the
endpoint is still absent on legacy, there is simply nothing left here that asks
for it. `AdtUtils` records what a replacement would have to call.

## Validation Endpoints on Legacy

These validation endpoints **are** present on legacy systems:

| Endpoint | Used by |
|----------|---------|
| `/sap/bc/adt/oo/validation/objectname` | Class, Interface validation |
| `/sap/bc/adt/programs/validation` | Program validation |
| `/sap/bc/adt/functions/validation` | Function Group, Function Module validation |
| `/sap/bc/adt/ddic/views/$validation` | View validation |
| `/sap/bc/adt/ddic/ddl/validation` | DDL Source validation |
| `/sap/bc/adt/includes/validation` | Include validation |

These validation endpoints **are not** present:

| Endpoint | Would be used by |
|----------|-----------------|
| `/sap/bc/adt/packages/validation` | Package validation |
| `/sap/bc/adt/ddic/domains/validation` | Domain validation |
| `/sap/bc/adt/ddic/dataelements/validation` | DataElement validation |
| `/sap/bc/adt/ddic/tables/validation` | Table validation |
| `/sap/bc/adt/ddic/structures/validation` | Structure validation |
| `/sap/bc/adt/ddic/tabletypes/validation` | TableType validation |

## Measured on BASIS 7.40

On premise, BASIS 7.40, 2026-10-01, over RFC and over HTTP.

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

## Content Type Versioning

Legacy systems do not support versioned content types. The `AdtContentTypesBase` class provides v1/versionless headers:

| Operation | Legacy (Base) | Modern |
|-----------|--------------|--------|
| Class create | `application/vnd.sap.adt.oo.classes+xml` | `application/vnd.sap.adt.oo.classes.v4+xml` |
| Program create | `application/vnd.sap.adt.programs.programs+xml` | `application/vnd.sap.adt.programs.programs.v2+xml` |
| Function group create | `application/vnd.sap.adt.functions.groups+xml` | `application/vnd.sap.adt.functions.groups.v3+xml` |
| Source artifact | `text/plain` | `text/plain; charset=utf-8` |

## Discovery Reference

Measured catalogue sizes — collections advertised by `/sap/bc/adt/discovery`:

| System | Collections |
|---|---|
| Legacy on-prem (BASIS ~7.40) | 124 |
| Modern on-prem (S/4 HANA) | 818 |
| ABAP Cloud (trial and a production tenant, separately) | 918 each |

The legacy system advertises **15%** of what the modern one does, and the two
cloud captures were functionally identical — their only differences were their
own base URLs.

**Advertised is not available.** The legacy catalogue lists
`/sap/bc/adt/atc/customizing`, and a `GET` of it answers
`404 No suitable resource found`. Two derived analyses of the same capture
disagreed about exactly this — one calling ATC and the debugger absent from that
system, the other marking them present — and neither was checkable without the
raw document and a live request. So a hit from `fetchDiscoveryEndpoints` means
the system says it has the resource; a miss is the stronger signal.

This section previously pointed at `scripts/endpoints_e77.txt` and
`scripts/endpoints_e19.txt` with "~100" and "~500+". Neither file has ever
existed at that path and neither figure was right.

The raw catalogues are not kept in the tree — 1.4 MB of four systems' endpoint
listings, re-fetchable from any of them in one request, and in git history for
anyone who wants the exact bytes.

Use `fetchDiscoveryEndpoints(connection)` from the public API to read a specific system's catalogue at runtime.
