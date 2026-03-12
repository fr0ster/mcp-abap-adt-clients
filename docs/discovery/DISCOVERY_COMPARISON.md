# SAP ADT Discovery Endpoint Comparison

Comparison of ADT discovery endpoints across four SAP systems.

## Systems

| ID | System | Type | Collections | File |
|----|--------|------|-------------|------|
| **trial** | ABAP Trial on BTP (AP21) | Cloud | 918 | `discovery_trial_raw.xml` |
| **mdd** | Medartis BTUS DEV (EU10) | Cloud (production) | 918 | `discovery_cloud_mdd_raw.xml` |
| **e19** | E19 | On-premise (modern, BASIS ≥ 7.50) | 818 | `discovery_e19_raw.xml` |
| **e77** | E77 | On-premise (legacy, BASIS < 7.50) | 124 | `discovery_e77_raw.xml` |

**Total unique endpoints across all systems: 941**

---

## Summary

| Metric | Count |
|--------|-------|
| Present in ALL 4 systems | 113 |
| Cloud-only (trial+mdd, not in e19/e77) | 111 |
| On-prem-only (e19 or e77, not in cloud) | 22 |
| Missing from E77 vs E19 | 705 |
| Trial vs MDD differences | 0 (2 are just system-specific base URLs) |

### Trial vs MDD
Functionally **identical** — 918 collections each, zero functional differences.
The only two "differences" are system-specific base URL entries embedded in the XML:
- `https://302ba387-...abap-web.ap21.hana.ondemand.com:443/sap/bc/adt` (trial)
- `https://19fff6b8-...abap-web.eu10.hana.ondemand.com:443/sap/bc/adt` (mdd)

### E19 vs Cloud
E19 is missing 111 cloud-specific endpoints — all are cloud-platform features not applicable to on-premise.

### E77 vs E19
E77 is missing **705 endpoints** that E19 has — essentially all modern ADT features introduced after BASIS 7.50.

---

## Project-Relevant Endpoint Matrix

| Endpoint | trial | mdd | e19 | e77 | Notes |
|----------|:-----:|:---:|:---:|:---:|-------|
| `/sap/bc/adt/programs/programs` | Y | Y | Y | Y | |
| `/sap/bc/adt/programs/includes` | Y | Y | Y | Y | |
| `/sap/bc/adt/programs/programrun` | Y | Y | Y | — | Executor not on legacy |
| `/sap/bc/adt/oo/classes` | Y | Y | Y | Y | |
| `/sap/bc/adt/oo/interfaces` | Y | Y | Y | Y | |
| `/sap/bc/adt/oo/classrun` | Y | Y | Y | — | Executor not on legacy |
| `/sap/bc/adt/functions/groups` | Y | Y | Y | Y | |
| `/sap/bc/adt/packages` | Y | Y | Y | Y | |
| `/sap/bc/adt/packages/validation` | Y | Y | Y | — | |
| `/sap/bc/adt/ddic/domains` | Y | Y | Y | — | |
| `/sap/bc/adt/ddic/dataelements` | Y | Y | Y | — | |
| `/sap/bc/adt/ddic/tables` | Y | Y | Y | — | |
| `/sap/bc/adt/ddic/structures` | Y | Y | Y | — | |
| `/sap/bc/adt/ddic/tabletypes` | Y | Y | Y | — | |
| `/sap/bc/adt/ddic/views` | Y | Y | Y | Y | External views (SE11) |
| `/sap/bc/adt/ddic/ddl/sources` | Y | Y | Y | Y | CDS views present on all |
| `/sap/bc/adt/acm/dcl/sources` | Y | Y | Y | — | Access controls |
| `/sap/bc/adt/ddic/srvd/sources` | Y | Y | Y | — | Service definitions |
| `/sap/bc/adt/businessservices/bindings` | Y | Y | Y | — | Service bindings |
| `/sap/bc/adt/bo/behaviordefinitions` | Y | Y | Y | — | RAP |
| `/sap/bc/adt/ddic/ddlx/sources` | Y | Y | Y | — | Metadata extensions |
| `/sap/bc/adt/cts/transportrequests` | Y | Y | Y | — | Modern CTS path |
| `/sap/bc/cts/transportrequests` | — | — | — | Y | Legacy CTS path (E77 only) |
| `/sap/bc/adt/activation` | Y | Y | Y | Y | Sync activation |
| `/sap/bc/adt/activation/runs` | Y | Y | Y | — | Async activation with polling |
| `/sap/bc/adt/activation/inactiveobjects` | Y | Y | Y | Y | |
| `/sap/bc/adt/abapunit/testruns` | Y | Y | Y | Y | Classic unit test runs |
| `/sap/bc/adt/abapunit/runs` | Y | Y | Y | — | New-style unit runs |
| `/sap/bc/adt/datapreview/ddic` | Y | Y | Y | — | Table contents |
| `/sap/bc/adt/datapreview/freestyle` | Y | Y | Y | — | SQL query |
| `/sap/bc/adt/checkruns` | Y | Y | Y | Y | |
| `/sap/bc/adt/repository/informationsystem/search` | Y | Y | Y | Y | |
| `/sap/bc/adt/repository/informationsystem/whereused` | Y | Y | Y | Y | |
| `/sap/bc/adt/repository/informationsystem/virtualfolders` | Y | Y | Y | — | |
| `/sap/bc/adt/repository/informationsystem/objectproperties/values` | Y | Y | Y | — | |
| `/sap/bc/adt/debugger` | Y | Y | Y | Y | Basic on E77 |
| `/sap/bc/adt/runtime/traces/abaptraces` | Y | Y | Y | Y | |
| `/sap/bc/adt/atc/runs` | Y | Y | Y | Y | |

---

## Cloud-Only Endpoints (111 total)

Features available on cloud (trial + mdd) but absent from both on-premise systems:

| Category | Endpoints |
|----------|-----------|
| **abapgit** | `/sap/bc/adt/abapgit/repos`, `/sap/bc/adt/abapgit/externalrepoinfo` |
| **APACK** | `/sap/bc/adt/apack/manifests`, `/sap/bc/adt/apack/gitmanifests` |
| **Cloud IAM / Communication** | `/sap/bc/adt/aps/cloud/com/sco1` (30+ subpaths) |
| **Cloud IAM / IAM objects** | `/sap/bc/adt/aps/cloud/iam/sia*` (10+ subpaths) |
| **Cloud IAM / Service usage** | `/sap/bc/adt/aps/iam/suco` |
| **ATC exemptions view** | `/sap/bc/adt/atc/checkexemptionsview` |
| **Data Type Script** | `/sap/bc/adt/ddic/dtsc/sources` (5 subpaths) |
| **Email templates** | `/sap/bc/adt/emailtemplates/templates` (5 subpaths) |
| **ABAP Unit AI** | `/sap/bc/adt/abapunit/ai/chat/action`, `/sap/bc/adt/abapunit/explain` |

---

## On-Premise-Only Endpoints (22 total)

Present in E19 or E77 but absent from cloud:

| Endpoint | E19 | E77 | Notes |
|----------|:---:|:---:|-------|
| `/sap/bc/cts/transportrequests` | — | Y | Legacy CTS |
| `/sap/bc/cts/transportrequests/reference` | — | Y | Legacy CTS |
| `/sap/bc/cts/transports` | — | Y | Legacy CTS |
| `/sap/bc/cts/transportchecks` | — | Y | Legacy CTS |
| `/sap/bc/adt/sscr/registration/objects` | Y | — | SSCR key registration |
| `/sap/bc/adt/sscr/registration/objects/validation` | Y | — | |
| `/sap/bc/adt/sscr/registration/developers/validation` | Y | — | |
| `/sap/bc/adt/compatibility/graph` | Y | — | |
| `/sap/bc/adt/oo/linenumber` | Y | — | |
| `/sap/bc/adt/repository/informationsystem/messagesearch` | Y | — | |
| `/sap/bc/adt/abapsource/syntax/configurations` | Y | Y | |
| `/sap/bc/adt/atc/exemptions/atcexemption` | Y | — | |
| `/sap/bc/adt/sit/sitotyp` | Y | — | Situation types |
| `/sap/bc/adt/development/handler/*` | Y | — | |
| `/sap/bc/adt/ui_flex_dta_folder/` | Y | — | |

---

## E77 (Legacy) — What's Missing vs E19

**705 endpoints** missing from E77 that are present in E19. Key categories for this project:

### Object Types (absent from E77)
- DDIC types via ADT: `domains`, `dataelements`, `tables`, `structures`, `tabletypes`
- RAP: `behaviordefinitions`, `ddic/srvd/sources`, `businessservices/bindings`, `ddic/ddlx/sources`
- `acm/dcl/sources` (access controls)
- All enhancement endpoints (`enhoxh`, `enhsxs`, etc.)
- ABAP Daemon applications
- AIF types, Situation types, Email templates
- Lock objects, Message classes, Text elements, Type groups

### Operations (absent from E77)
- `activation/runs` — async activation with polling (uses sync `/sap/bc/adt/activation` instead)
- `abapunit/runs` — new-style unit test runs (uses legacy `testruns` instead)
- `packages/validation`
- `cts/transportrequests` (modern) — uses `/sap/bc/cts/` path instead
- `datapreview/*` — no table contents, no SQL query, no CDS preview
- `programs/programrun`, `oo/classrun` — executors
- `repository/informationsystem/virtualfolders`
- `repository/informationsystem/objectproperties/values`
- `repository/informationsystem/usageReferences`
- Advanced debugger: actions, batch, watchpoints, memory, stack, conditions

### What E77 DOES Have (124 endpoints)
Classes, interfaces, programs, function groups, function modules (via groups), packages, external views, CDS/DDL sources, basic activation (sync), checkruns, ABAP Unit testruns (legacy), ATC runs, profiler traces, debugger (basic: breakpoints, variables, listeners), search, where-used, code completion, pretty printer, navigation, Web Dynpro, Enterprise Services, feeds, HANA integration, legacy CTS transports.

---

## Impact on AdtClient Modules

| Module | trial/mdd | e19 | e77 |
|--------|:---------:|:---:|:---:|
| Class | Full | Full | Full |
| Interface | Full | Full | Full |
| Program | Full | Full | Full |
| FunctionGroup | Full | Full | Full |
| FunctionModule | Full | Full | Full |
| Package | Full | Full | **Blocked** (read via RFC broken) |
| Domain | Full | Full | **Not available** |
| DataElement | Full | Full | **Not available** |
| Table | Full | Full | **Not available** |
| Structure | Full | Full | **Not available** |
| TableType | Full | Full | **Not available** |
| View (SE11) | Full | Full | Full |
| View (CDS/DDL) | Full | Full | Full |
| AccessControl | Full | Full | **Not available** |
| ServiceDefinition | Full | Full | **Not available** |
| ServiceBinding | Full | Full | **Not available** |
| BehaviorDefinition | Full | Full | **Not available** |
| MetadataExtension | Full | Full | **Not available** |
| Enhancement | Full | Full | **Not available** |
| Transport (modern) | Full | Full | **Not available** → uses `/sap/bc/cts/` |
| Activation | Full (async) | Full (async) | Partial (sync only) |
| UnitTest | Full | Full | Partial (testruns only) |
| CdsUnitTest | Full | Full | **Not available** |
| DataPreview / SQL | Full | Full | **Not available** |
| ClassExecutor | Full | Full | **Not available** |
| ProgramExecutor | Full | Full | **Not available** |
| Search / WhereUsed | Full | Full | Full |
| VirtualFolders | Full | Full | **Not available** |
| Debugger | Full | Full | Basic only |
| Profiler / ATC | Full | Full | Full |
