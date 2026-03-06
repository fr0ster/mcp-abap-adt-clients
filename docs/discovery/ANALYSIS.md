# ADT Discovery Endpoint Analysis

Comparison of ADT endpoints across three system types.

## Systems

| System | Type | Discovery | Endpoints |
|--------|------|-----------|-----------|
| MDD-SK-DEV | BTP ABAP Cloud | `/sap/bc/adt/core/discovery` + `/sap/bc/adt/discovery` | 918 |
| E19 | S/4 HANA on-premise | `/sap/bc/adt/core/discovery` + `/sap/bc/adt/discovery` | 818 |
| E77 | Older BASIS 7.40 | `/sap/bc/adt/discovery` only | 124 |

## Overlap

### Cloud vs E19 (on-premise modern)
- Shared: 807 endpoints
- Only in Cloud: 111
- Only in E19: 11

### E19 vs E77 (on-premise old)
- Shared: 113 endpoints
- Only in E77: 11 (mostly legacy paths like `/sap/bc/cts/...`)
- Only in E19: 705

### Cloud vs E77
- Shared: 113 endpoints
- Only in Cloud: 805

## Key Differences for AdtClient

### Deletion

- E19: `/sap/bc/adt/deletion/check` + `/sap/bc/adt/deletion/delete` (POST with XML payload)
- E77: Direct `DELETE /sap/bc/adt/programs/programs/{name}?lockHandle=...` (lock required)

### Transport Requests

- E19: `/sap/bc/adt/cts/transportrequests`
- E77: `/sap/bc/cts/transportrequests` (different base path, no `/adt/`)

### DDIC Objects (domains, data elements, structures, tables, table types)

- E19: Dedicated endpoints (`/sap/bc/adt/ddic/domains`, `/sap/bc/adt/ddic/dataelements`, etc.) with `/validation`
- E77: **Not available** as separate endpoints

### Modern Object Types (absent on E77)

- Behavior Definitions: `/sap/bc/adt/bo/behaviordefinitions`
- Access Control (DCL): `/sap/bc/adt/acm/dcl/sources`
- Service Definitions: `/sap/bc/adt/ddic/srvd/sources`
- Service Bindings: `/sap/bc/adt/businessservices/bindings`
- Metadata Extensions: `/sap/bc/adt/ddic/ddlx/sources`
- Enhancements: `/sap/bc/adt/enhancements/...`

### Runtime & Debugging (absent on E77)

- Debugger: `/sap/bc/adt/debugger/...`
- Profiler traces: `/sap/bc/adt/runtime/traces/...`
- Memory snapshots: `/sap/bc/adt/runtime/memory/...`
- Runtime dumps: `/sap/bc/adt/runtime/dumps`
- Cross-traces: `/sap/bc/adt/crosstrace/...`
- Data preview / SQL: `/sap/bc/adt/datapreview/...`

### Other Missing on E77

- Package validation: `/sap/bc/adt/packages/validation`
- Interface validation: `/sap/bc/adt/oo/interfaces/validation`
- Function group validation: `/sap/bc/adt/functions/groups/validation`
- DDIC activation graph: `/sap/bc/adt/ddic/logs/activationgraph`
- System information: `/sap/bc/adt/core/http/systeminformation`

### Programs on Cloud

- Cloud (BTP ABAP): Programs (`/sap/bc/adt/programs/programs`) endpoint exists but programs are not a supported object type in ABAP Cloud (RAP-only model). Create/update operations will fail.
- E19 (on-premise): Full program support with v2/v3 content types
- E77 (legacy): Full program support with v1 content types

### Content-Type Versions

- E19: Supports v2+/v3+ content types (e.g. `application/vnd.sap.adt.programs.programs.v2+xml`)
- E77: Only supports v1/unversioned (e.g. `application/vnd.sap.adt.programs.programs+xml`)

## Shared Endpoints (work on both)

- Programs: `/sap/bc/adt/programs/programs`, `/sap/bc/adt/programs/validation`
- Classes: `/sap/bc/adt/oo/classes`
- Interfaces: `/sap/bc/adt/oo/interfaces`
- Function Groups: `/sap/bc/adt/functions/groups`
- Packages: `/sap/bc/adt/packages`
- Activation: `/sap/bc/adt/activation`, `/sap/bc/adt/activation/inactiveobjects`
- CDS views: `/sap/bc/adt/ddic/ddl/sources`
- DDIC views: `/sap/bc/adt/ddic/views`
- Search: `/sap/bc/adt/repository/informationsystem/search`
- Repository structure: `/sap/bc/adt/repository/nodestructure`, `/objectstructure`

## Conclusion

The difference is significant enough to warrant separate client implementations:
- E77 supports ~15% of E19's endpoints
- Deletion, transport, DDIC, and validation use completely different mechanisms
- Runtime/debugging is entirely absent on E77
- Content-Type versioning differs
