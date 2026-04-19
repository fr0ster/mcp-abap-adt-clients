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
| View (DDL Source) | `getView()` | `/sap/bc/adt/ddic/views` | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
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

### Unblocked but endpoint is absent

| Object Type | Getter | Note |
|-------------|--------|------|
| CDS Unit Test | `getCdsUnitTest()` | `/sap/bc/adt/abapunit/testruns` IS present on legacy — not blocked |
| Unit Test | `getUnitTest()` | Same endpoint — works |
| Transport Request | `getRequest()` | Uses `/sap/bc/cts/` — works |

## Shared Utilities (AdtUtils) Support

### Available on legacy

| Utility | Method | Endpoint |
|---------|--------|----------|
| Search objects | `searchObjects()` | `/sap/bc/adt/repository/informationsystem/search` |
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
| Type info | `getTypeInfo()` | `.../objectproperties/values` | None |
| Transaction info | `getTransaction()` | `.../objectproperties/values` | None |

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

Discovery catalogs are stored in `scripts/` for reference:

| File | System | Endpoints |
|------|--------|-----------|
| `scripts/endpoints_e77.txt` | Legacy (BASIS ~7.40) | ~100 endpoints |
| `scripts/endpoints_e19.txt` | Modern (S/4 HANA) | ~500+ endpoints |

Use `fetchDiscoveryEndpoints(connection)` from the public API to check a specific system's available endpoints at runtime.
