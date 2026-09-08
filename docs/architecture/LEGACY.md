# Legacy System Support (BASIS < 7.50)

## Overview

Legacy SAP systems (BASIS versions older than 7.50) lack many ADT endpoints available on modern systems. The library provides `AdtClientLegacy` — a subclass of `AdtClient` that blocks unsupported operations and uses legacy-compatible alternatives where possible.

System detection is automatic: `createAdtClient()` checks `/sap/bc/adt/core/discovery` (present only on modern systems) and returns either `AdtClient` or `AdtClientLegacy`.

## Connection: RFC vs HTTP

Legacy systems do not support the `x-sap-adt-sessiontype: stateful` HTTP header (introduced in BASIS 7.50). Without stateful sessions, lock handles are lost between HTTP requests — making create/update/delete operations impossible.

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
  ├── /sap/bc/adt/core/discovery available? → AdtClient (modern, full CRUD)
  │
  └── not available? → AdtClientLegacy
        ├── Supported types: *Legacy handlers (direct DELETE, v1 content types)
        ├── Unsupported types: throw error with missing endpoint name
        └── Content types: AdtContentTypesBase (versionless headers)
```

### Key differences in AdtClientLegacy

| Component | Modern (AdtClient) | Legacy (AdtClientLegacy) |
|-----------|-------------------|--------------------------|
| Content types | `AdtContentTypesModern` (v2+/v3+/v4+) | `AdtContentTypesBase` (v1 / versionless) |
| Delete | `POST /sap/bc/adt/deletion/check` + `/delete` | Direct `DELETE {objectUrl}?lockHandle=...` |
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
| Function Include | `getFunctionInclude()` | `/sap/bc/adt/functions/groups/.../includes` | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
| DDL Source (CDS view, AMDP table function) | `getDdl()` | `/sap/bc/adt/ddic/ddl/sources` | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
| Package | `getPackage()` | `/sap/bc/adt/packages` | ❌² | ❌³ | ✅ | ✅ | ✅¹ | — | — |

¹ Delete uses direct `DELETE` with lockHandle (no `/sap/bc/adt/deletion/check` + `/delete` API)
² `/sap/bc/adt/packages/validation` not present in legacy discovery
³ Package creation on legacy systems is only possible via SAP GUI (SE80/SE21)

### Not supported (endpoints absent from discovery)

These types throw an error with the exact missing endpoint when the getter is called.

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
| CDS Unit Test | `getCdsUnitTest()` | `/sap/bc/adt/abapunit/testruns` IS present on legacy — not blocked |
| Unit Test | `getUnitTest()` | Same endpoint — works |
| Transport Request | `getRequest()` | Uses `/sap/bc/cts/` — `read()`/`list()` work, `create()`/`update()`/`delete()` answer a refusal; `list()`'s payload has never been captured, so the shipped reading may not recognise it and will say so — inject your own |

## Shared Utilities (AdtUtils) Support

### Available on legacy

| Utility | Method | Endpoint |
|---------|--------|----------|
| Search objects | `search()` | `/sap/bc/adt/repository/informationsystem/search` |
| Node structure | `fetchNodeStructure()` | `/sap/bc/adt/repository/nodestructure` |
| Package hierarchy | `getPackageHierarchy()` | (uses nodeStructure) |
| Package contents | `getPackageContentsList()` | (uses nodeStructure) |
| Object structure | `getObjectStructure()` | `/sap/bc/adt/repository/objectstructure` |
| Read metadata | `readObjectMetadata()` | `/sap/bc/adt/repository/informationsystem/metadata` |
| Inactive objects | `getInactiveObjects()` | `/sap/bc/adt/activation/inactiveobjects` |
| Discovery | `getDiscovery()` | `/sap/bc/adt/discovery` |
| Single activation | (used internally) | `POST /sap/bc/adt/activation?method=activate` |
| Check runs | (used internally) | `/sap/bc/adt/checkruns` |

### Not available on legacy

| Utility | Method | Missing Endpoint | Legacy Alternative |
|---------|--------|------------------|--------------------|
| Where-used | `getWhereUsed()`, `getWhereUsedList()` | `/sap/bc/adt/repository/informationsystem/usageReferences` | Old API exists: `POST .../whereused?RIS_REQUEST_TYPE=WHERE_USED_LAZY` + `.../fullnamemapping` — not yet implemented |
| Group activation | `activateObjectsGroup()` | `/sap/bc/adt/activation/runs` | Sync API exists: `POST /sap/bc/adt/activation?method=activate` — not yet adapted for group use |
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
