# Error corpus: what the system named, per endpoint

## Not authorized for this user

Recorded with `--record-unauthorized`, not judged: no header verdict, never sent again on an object.

- POST /sap/bc/adt/sfw/featuretoggles/validation
- POST /sap/bc/adt/sfw/featuretoggles
- GET /sap/bc/adt/sfw/featuretoggles/{name}
- PUT /sap/bc/adt/sfw/featuretoggles/{name}
- PUT /sap/bc/adt/sfw/featuretoggles/{name}/source/main
- POST /sap/bc/adt/sfw/featuretoggles/{name}?_action=UNLOCK
- POST /sap/bc/adt/sfw/featuretoggles/{name}/toggle
- GET /sap/bc/adt/sfw/featuretoggles/{name}/states
- POST /sap/bc/adt/sfw/featuretoggles/{name}/check
- GET /sap/bc/adt/sfw/featuretoggles/{name}/source/main
- GET /sap/bc/adt/bopf/businessobjects
- GET /sap/bc/adt/bopf/businessobjects/$validation
- GET /sap/bc/adt/bopf/businessobjects/$generation
- GET /sap/bc/adt/bopf/businessobjects/$contentassist
- GET /sap/bc/adt/bopf/businessobjects/$search
- GET /sap/bc/adt/bopf/businessobjects/$structurefields
- GET /sap/bc/adt/bopf/businessobjects/$constants
- GET /sap/bc/adt/bopf/businessobjects/$synchronize
- GET /sap/bc/adt/filestore/ui5-bsp/objects
- GET /sap/bc/adt/filestore/ui5-bsp/ui5-rt-version
- GET /sap/bc/adt/filestore/ui5-bsp/deploy-storage
- GET /sap/bc/adt/testcodegen/dependencies/doubledata
- GET /sap/bc/adt/abapdaemons/applications
- GET /sap/bc/adt/abapdaemons/applications/source/formatter
- GET /sap/bc/adt/abapdaemons/applications/$schema
- GET /sap/bc/adt/abapdaemons/applications/$configuration
- GET /sap/bc/adt/abapdaemons/applications/validation
- GET /sap/bc/adt/aif/check
- GET /sap/bc/adt/aif/check/source/formatter
- POST /sap/bc/adt/aif/check/source/formatter
- GET /sap/bc/adt/aif/check/$schema
- POST /sap/bc/adt/aif/check/$schema
- GET /sap/bc/adt/aif/check/$configuration
- POST /sap/bc/adt/aif/check/$configuration
- GET /sap/bc/adt/aif/check/validation
- GET /sap/bc/adt/aif/fixvalue
- GET /sap/bc/adt/aif/fixvalue/source/formatter
- POST /sap/bc/adt/aif/fixvalue/source/formatter
- GET /sap/bc/adt/aif/fixvalue/$schema
- POST /sap/bc/adt/aif/fixvalue/$schema
- GET /sap/bc/adt/aif/fixvalue/$configuration
- POST /sap/bc/adt/aif/fixvalue/$configuration
- GET /sap/bc/adt/aif/fixvalue/validation
- GET /sap/bc/adt/applicationobjects/objects
- GET /sap/bc/adt/applicationobjects/objects/source/formatter
- POST /sap/bc/adt/applicationobjects/objects/source/formatter
- GET /sap/bc/adt/applicationobjects/objects/$schema
- POST /sap/bc/adt/applicationobjects/objects/$schema
- GET /sap/bc/adt/applicationobjects/objects/$configuration
- POST /sap/bc/adt/applicationobjects/objects/$configuration
- GET /sap/bc/adt/applicationobjects/objects/validation
- GET /sap/bc/adt/aps/common/sbc1
- GET /sap/bc/adt/aps/common/sbc1/validation
- GET /sap/bc/adt/cmp_code_composer/cmpt
- GET /sap/bc/adt/cmp_code_composer/cmpt/validation
- GET /sap/bc/adt/customfields/objects
- GET /sap/bc/adt/customfields/objects/source/formatter
- POST /sap/bc/adt/customfields/objects/source/formatter
- GET /sap/bc/adt/customfields/objects/$schema
- POST /sap/bc/adt/customfields/objects/$schema
- GET /sap/bc/adt/customfields/objects/$configuration
- POST /sap/bc/adt/customfields/objects/$configuration
- GET /sap/bc/adt/customfields/objects/validation
- GET /sap/bc/adt/datacategories/objects
- GET /sap/bc/adt/datacategories/objects/source/formatter
- POST /sap/bc/adt/datacategories/objects/source/formatter
- GET /sap/bc/adt/datacategories/objects/$schema
- POST /sap/bc/adt/datacategories/objects/$schema
- GET /sap/bc/adt/datacategories/objects/$configuration
- POST /sap/bc/adt/datacategories/objects/$configuration
- GET /sap/bc/adt/datacategories/objects/validation
- GET /sap/bc/adt/ddic/drul/sources
- GET /sap/bc/adt/ddic/drul/sources/validation
- GET /sap/bc/adt/ddic/dtix/sources
- GET /sap/bc/adt/ddic/dtix/sources/$metadata
- GET /sap/bc/adt/ddic/dtix/sources/$navigation
- GET /sap/bc/adt/ddic/dtix/sources/$codecompletion/proposal
- GET /sap/bc/adt/ddic/dtix/sources/$codecompletion/insertion
- GET /sap/bc/adt/ddic/dtix/sources/$formatter
- POST /sap/bc/adt/ddic/dtix/sources/$formatter
- GET /sap/bc/adt/ddic/dtix/sources/$elementinfo
- GET /sap/bc/adt/ddic/dtix/sources/$outlineconfiguration
- GET /sap/bc/adt/ddic/dtix/sources/$occurrencemarkers
- GET /sap/bc/adt/ddic/dtix/sources/validation
- GET /sap/bc/adt/ddic/dtsc/sources
- GET /sap/bc/adt/ddic/dtsc/sources/$metadata
- GET /sap/bc/adt/ddic/dtsc/sources/$navigation
- GET /sap/bc/adt/ddic/dtsc/sources/$codecompletion/proposal
- GET /sap/bc/adt/ddic/dtsc/sources/$codecompletion/insertion
- GET /sap/bc/adt/ddic/dtsc/sources/$formatter
- POST /sap/bc/adt/ddic/dtsc/sources/$formatter
- GET /sap/bc/adt/ddic/dtsc/sources/$elementinfo
- GET /sap/bc/adt/ddic/dtsc/sources/$outlineconfiguration
- GET /sap/bc/adt/ddic/dtsc/sources/$occurrencemarkers
- GET /sap/bc/adt/ddic/dtsc/sources/validation
- GET /sap/bc/adt/dummygroup/wbttt1a
- GET /sap/bc/adt/dummygroup/wbttt1a/$metadata
- GET /sap/bc/adt/dummygroup/wbttt1a/white/yellow
- GET /sap/bc/adt/dummygroup/wbttt1a/validation
- GET /sap/bc/adt/dummygroup/wbttt2a
- GET /sap/bc/adt/dummygroup/wbttt2a/validation
- GET /sap/bc/adt/enhancements/enhoxh
- GET /sap/bc/adt/enhancements/enhoxh/validation
- GET /sap/bc/adt/enhancements/enhoxhh
- GET /sap/bc/adt/enhancements/enhoxhh/validation
- GET /sap/bc/adt/enhancements/enhsxs
- GET /sap/bc/adt/enhancements/enhsxs/validation
- GET /sap/bc/adt/hota/hotahdi
- GET /sap/bc/adt/hota/hotahdi/hoto/addlprops
- GET /sap/bc/adt/hota/hotahdi/hoto/checkin
- GET /sap/bc/adt/hota/hotahdi/hoto/checkout
- GET /sap/bc/adt/hota/hotahdi/hota/containername
- GET /sap/bc/adt/hota/hotahdi/hota/checknamespace
- GET /sap/bc/adt/hota/hotahdi/hota/checkout/hdiwizard
- GET /sap/bc/adt/hota/hotahdi/hoto/transportdetails
- GET /sap/bc/adt/hota/hotahdi/hota/featurecheck
- GET /sap/bc/adt/hota/hotahdi/validation
- GET /sap/bc/adt/hota/hotahto
- GET /sap/bc/adt/hota/hotahto/validation
- GET /sap/bc/adt/lifecycle_management/ftglaf
- GET /sap/bc/adt/lifecycle_management/ftglaf/releasestatus/values
- GET /sap/bc/adt/lifecycle_management/ftglaf/validation
- GET /sap/bc/adt/objtype_admin/sval
- GET /sap/bc/adt/objtype_admin/sval/configurations
- GET /sap/bc/adt/objtype_admin/sval/metadata
- GET /sap/bc/adt/objtype_admin/sval/assist/trscopes
- GET /sap/bc/adt/objtype_admin/sval/assist/wbobjlist
- GET /sap/bc/adt/objtype_admin/sval/assist/wbscopes
- GET /sap/bc/adt/objtype_admin/sval/validation
- GET /sap/bc/adt/objtype_admin/wgrp
- GET /sap/bc/adt/objtype_admin/wgrp/validation
- GET /sap/bc/adt/schema_definitions/amsdtyp
- GET /sap/bc/adt/schema_definitions/amsdtyp/validation
- GET /sap/bc/adt/sfw/featuretoggles
- GET /sap/bc/adt/sfw/featuretoggles/source/formatter
- POST /sap/bc/adt/sfw/featuretoggles/source/formatter
- GET /sap/bc/adt/sfw/featuretoggles/$schema
- POST /sap/bc/adt/sfw/featuretoggles/$schema
- GET /sap/bc/adt/sfw/featuretoggles/$configuration
- POST /sap/bc/adt/sfw/featuretoggles/$configuration
- GET /sap/bc/adt/sfw/featuretoggles/attributes/attributeKeys
- GET /sap/bc/adt/sfw/featuretoggles/attributes/attributeValues
- GET /sap/bc/adt/sfw/featuretoggles/objects/types
- GET /sap/bc/adt/sfw/featuretoggles/sfw/featuretoggles
- GET /sap/bc/adt/sfw/featuretoggles/referenceProduct/values
- GET /sap/bc/adt/sfw/featuretoggles/validation
- GET /sap/bc/adt/uc_object_type_group/samc
- GET /sap/bc/adt/uc_object_type_group/samc/messagetype/values
- GET /sap/bc/adt/uc_object_type_group/samc/scope/values
- GET /sap/bc/adt/uc_object_type_group/samc/virusscan/values
- GET /sap/bc/adt/uc_object_type_group/samc/activity/values
- GET /sap/bc/adt/uc_object_type_group/samc/progtype/values
- GET /sap/bc/adt/uc_object_type_group/samc/validation
- GET /sap/bc/adt/uc_object_type_group/sapc
- GET /sap/bc/adt/uc_object_type_group/sapc/connectiontypes/values
- GET /sap/bc/adt/uc_object_type_group/sapc/protocoltypes/values
- GET /sap/bc/adt/uc_object_type_group/sapc/virusscanout/values
- GET /sap/bc/adt/uc_object_type_group/sapc/virusscanin/values
- GET /sap/bc/adt/uc_object_type_group/sapc/superclass/values
- GET /sap/bc/adt/uc_object_type_group/sapc/classproperties/values
- GET /sap/bc/adt/uc_object_type_group/sapc/testurl/values
- GET /sap/bc/adt/uc_object_type_group/sapc/service_path/values
- GET /sap/bc/adt/uc_object_type_group/sapc/validation
- GET /sap/bc/adt/wmpc/applications
- GET /sap/bc/adt/wmpc/applications/source/formatter
- POST /sap/bc/adt/wmpc/applications/source/formatter
- GET /sap/bc/adt/wmpc/applications/$schema
- POST /sap/bc/adt/wmpc/applications/$schema
- GET /sap/bc/adt/wmpc/applications/$configuration
- POST /sap/bc/adt/wmpc/applications/$configuration
- GET /sap/bc/adt/wmpc/applications/validation
- GET /sap/bc/adt/ana/aqd
- POST /sap/bc/adt/ana/aqd
- GET /sap/bc/adt/dynpros/programs
- POST /sap/bc/adt/dynpros/programs
- GET /sap/bc/adt/dynpros/functiongroups
- POST /sap/bc/adt/dynpros/functiongroups
- GET /sap/bc/esproxy/semanticcontracts
- GET /sap/bc/esproxy/contracts
- GET /sap/bc/esproxy/contractimplementations
- GET /sap/bc/esproxy/integrationscenariodefns
- GET /sap/bc/esproxy/datatypes
- GET /sap/bc/esproxy/messagetypes
- GET /sap/bc/esproxy/serviceconsumers
- GET /sap/bc/esproxy/serviceproviders
- GET /sap/bc/esproxy/operationmappings
- GET /sap/bc/esproxy/consumermappings
- GET /sap/bc/esproxy/consumerfactories
- GET /sap/bc/esproxy/search
- GET /sap/bc/esproxy/proxysearch
- GET /sap/bc/esproxy/validate
- GET /sap/bc/esproxy/soamanager
- GET /sap/bc/esproxy/esrsearch
- GET /sap/bc/esproxy/esrscv
- GET /sap/bc/esproxy/srsearch
- GET /sap/bc/esproxy/rfcconsumers
- GET /sap/bc/esproxy/activation
- GET /sap/bc/adt/sadl/gw/annopush/prepare
- POST /sap/bc/adt/sadl/gw/annopush/prepare
- GET /sap/bc/adt/sadl/gw/annopush/push
- POST /sap/bc/adt/sadl/gw/annopush/push
- GET /sap/bc/adt/sadl/gw/annopush/finalize
- GET /sap/bc/adt/sadl/gw/annopush/validate
- GET /sap/bc/adt/sadl/gw/mde
- GET /sap/bc/adt/dataproviders
- GET /sap/bc/adt/sidebyside/configuration
- GET /sap/bc/adt/system/clients
- GET /sap/bc/adt/system/landscape/servers
- GET /sap/bc/adt/atc/ccstunnel
- GET /sap/bc/adt/businesslogicextensions/badis
- GET /sap/bc/adt/businesslogicextensions/badinameproposals
- GET /sap/bc/adt/ddic/drul/parser/info
- GET /sap/bc/adt/ddic/dbprocedureproxies
- GET /sap/bc/adt/ddic/views
- GET /sap/bc/adt/ddic/views/$validation
- GET /sap/bc/adt/oo/classrun
- GET /sap/bc/adt/vit/wb/object_type
- GET /sap/bc/adt/fpm/creationtools
- GET /sap/bc/adt/nhi/vendors
- GET /sap/bc/adt/nhi/deliveryunitproxies
- GET /sap/bc/adt/nhi/validation
- GET /sap/bc/adt/nhi/deliveryunits
- GET /sap/bc/adt/nhi/views
- GET /sap/bc/adt/nhi/dbprocedures
- GET /sap/bc/adt/sqlm/data
- GET /sap/bc/adt/runtime/workprocesses
- GET /sap/bc/adt/wdy/applications
- GET /sap/bc/adt/wdy/interfaceviews
- GET /sap/bc/adt/wdy/components
- GET /sap/bc/adt/wdy/componentinterfaces
- GET /sap/bc/adt/wdy/componentcontrollers
- GET /sap/bc/adt/wdy/windows
- GET /sap/bc/adt/wdy/abapsource/codecompletion/proposal
- GET /sap/bc/adt/wdy/abapsource/codecompletion/elementinfo
- GET /sap/bc/adt/wdy/abapsource/prettyprinter
- GET /sap/bc/adt/wdy/abapsource/codecompletion/insertion
- GET /sap/bc/adt/wdy/launchconfiguration
- GET /sap/bc/adt/wdy/viewdesigner/uielementlibrary
- GET /sap/bc/adt/wdy/views
- GET /sap/bc/adt/wdy/interfacecontrollers
- GET /sap/bc/adt/wdy/customcontrollers
- GET /sap/bc/adt/wdy/navigation/target
- GET /sap/bc/adt/wdy/search
- GET /sap/bc/adt/wdy/codetemplate
- GET /sap/bc/adt/wdy/componentconfig
- GET /sap/bc/adt/wdy/applicationconfig
- GET /sap/bc/adt/wdy/fpmapplications
- GET /sap/bc/adt/wdy/fpmfloorplans
- GET /sap/bc/adt/wdy/fpmadaptables
- GET /sap/bc/adt/wdy/fpmcomponents
- GET /sap/bc/adt/wdy/fpmguibbs
- GET /sap/bc/adt/wdy/fpmruibbs

Runs:

- clients, headers bogus, started 2026-10-28T15:27:50.735Z: 797 rows
- clients, headers corpus, started 2026-10-28T15:06:59.402Z: 603 rows
- clients, headers none, started 2026-10-28T15:17:51.925Z: 603 rows
- discovery, headers bogus, started 2026-10-28T15:00:03.379Z: 1673 rows
- discovery, headers corpus, started 2026-10-28T14:47:16.087Z: 1429 rows
- discovery, headers none, started 2026-10-28T14:53:59.458Z: 1311 rows

| endpoint | Accept named | Content-Type named | raw text | seen in |
|---|---|---|---|---|
| clients: GET /sap/bc/adt/abapunit/results/{name} | application/vnd.sap.adt.api.junit.run-result.v1+xml |  | Accepted content types: application/vnd.sap.adt.api.junit.run-result.v1+xml | bogus: 406 |
| clients: GET /sap/bc/adt/abapunit/runs/{name} | application/vnd.sap.adt.api.abapunit.run-status.v1+xml |  | Accepted content types: application/vnd.sap.adt.api.abapunit.run-status.v1+xml | bogus: 406 |
| clients: GET /sap/bc/adt/acm/dcl/sources/{name} | application/vnd.sap.adt.dclSource+xml |  | Accepted content types: application/vnd.sap.adt.dclSource+xml | bogus: 406 |
| clients: GET /sap/bc/adt/acm/dcl/sources/{name}/source/main | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/acm/dcl/sources/{name}/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/activation/results/{name} | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| clients: GET /sap/bc/adt/activation/runs/{name} | application/vnd.sap.adt.backgroundrun.v1+xml |  | Accepted content types: application/vnd.sap.adt.backgroundrun.v1+xml | bogus: 406 |
| clients: GET /sap/bc/adt/atc/customizing | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| clients: GET /sap/bc/adt/atc/runs/{name} | application/vnd.sap.atc.run.v1+xml |  | Accepted content types: application/vnd.sap.atc.run.v1+xml | bogus: 406 |
| clients: GET /sap/bc/adt/atc/variants | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| clients: GET /sap/bc/adt/atc/worklists/{name} | application/atc.worklist.v1+xml |  | Accepted content types: application/atc.worklist.v1+xml | bogus: 406 |
| clients: GET /sap/bc/adt/bo/behaviordefinitions/{name}/source/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/businessservices/bindings/bindingtypes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| clients: GET /sap/bc/adt/crosstrace/activations | application/vnd.sap.adt.crosstrace.activations.v1+xml |  | Accepted content types: application/vnd.sap.adt.crosstrace.activations.v1+xml | bogus: 406, corpus: 406 |
| clients: GET /sap/bc/adt/crosstrace/traces | application/vnd.sap.adt.crosstrace.traces.v1+xml |  | Accepted content types: application/vnd.sap.adt.crosstrace.traces.v1+xml | bogus: 406, corpus: 406 |
| clients: GET /sap/bc/adt/crosstrace/traces/{name} | application/vnd.sap.adt.crosstrace.traces.v1+xml |  | Accepted content types: application/vnd.sap.adt.crosstrace.traces.v1+xml | bogus: 406, corpus: 406 |
| clients: GET /sap/bc/adt/crosstrace/traces/{name}/records | application/vnd.sap.adt.crosstrace.records.v1+xml |  | Accepted content types: application/vnd.sap.adt.crosstrace.records.v1+xml | bogus: 406, corpus: 406 |
| clients: GET /sap/bc/adt/crosstrace/traces/{name}/records/{name}/content | text/plain |  | Accepted content types: text/plain | bogus: 406, corpus: 406 |
| clients: GET /sap/bc/adt/cts/transportrequests/{name}/actionlogs | application/vnd.sap.adt.logs+xml |  | Accepted content types: application/vnd.sap.adt.logs+xml | bogus: 406 |
| clients: GET /sap/bc/adt/cts/transportrequests/searchconfiguration/configurations | application/vnd.sap.adt.configurations.v1+xml |  | Accepted content types: application/vnd.sap.adt.configurations.v1+xml | bogus: 406 |
| clients: GET /sap/bc/adt/datapreview/ddic/{name}/metadata | application/vnd.sap.adt.datapreview.table.v1+xml |  | Accepted content types: application/vnd.sap.adt.datapreview.table.v1+xml | bogus: 406 |
| clients: GET /sap/bc/adt/ddic/ddl/sources/{name} | application/vnd.sap.adt.ddlSource+xml |  | Accepted content types: application/vnd.sap.adt.ddlSource+xml | bogus: 406 |
| clients: GET /sap/bc/adt/ddic/ddl/sources/{name}/source/main | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/ddic/ddl/sources/{name}/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/ddic/dsfd/sources/{name}/source/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/ddic/logs/activationgraph | application/vnd.sap.adt.ddic.acivationLog.v1+xml |  | Accepted content types: application/vnd.sap.adt.ddic.acivationLog.v1+xml | bogus: 406, corpus: 406 |
| clients: GET /sap/bc/adt/ddic/srvd/sources/{name}/source/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/ddic/structures/{name}/source/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/ddic/tables/{name}/source/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/ddic/tabletypes/{name}/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/discovery | application/atomsvc+xml |  | Accepted content types: application/atomsvc+xml | bogus: 406 |
| clients: GET /sap/bc/adt/feeds | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/functions/groups/{name} |  |  | Accepted content types: | bogus: 406 |
| clients: GET /sap/bc/adt/functions/groups/{name}/enhancements/options | application/vnd.sap.adt.enhancementoptions.v2+xml |  | Accepted content types: application/vnd.sap.adt.enhancementoptions.v2+xml | bogus: 406 |
| clients: GET /sap/bc/adt/functions/groups/{name}/fmodules/{name} | application/vnd.sap.adt.functions.fmodules.v3+xml |  | Accepted content types: application/vnd.sap.adt.functions.fmodules.v3+xml | bogus: 406 |
| clients: GET /sap/bc/adt/functions/groups/{name}/fmodules/{name}/source/main | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/functions/groups/{name}/fmodules/{name}/source/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/functions/groups/{name}/includes/{name} | application/vnd.sap.adt.functions.fincludes.v2+xml |  | Accepted content types: application/vnd.sap.adt.functions.fincludes.v2+xml | bogus: 406 |
| clients: GET /sap/bc/adt/functions/groups/{name}/includes/{name}/source/main | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/functions/groups/{name}/includes/{name}/source/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/functions/groups/{name}/source/main/enhancements/elements | application/vnd.sap.adt.enhancements.v3+xml |  | Accepted content types: application/vnd.sap.adt.enhancements.v3+xml | bogus: 406 |
| clients: GET /sap/bc/adt/gw/errorlog | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/messageclass/{name} | application/vnd.sap.adt.mc.messageclass+xml |  | Accepted content types: application/vnd.sap.adt.mc.messageclass+xml | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name} |  |  | Accepted content types: | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/enhancements/options | application/vnd.sap.adt.enhancementoptions.v2+xml |  | Accepted content types: application/vnd.sap.adt.enhancementoptions.v2+xml | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/includes/definitions | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/includes/definitions/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/includes/implementations | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/includes/implementations/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/includes/macros | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/includes/macros/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/includes/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/includes/testclasses | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/includes/testclasses/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/source/main | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/oo/classes/{name}/source/main/enhancements/elements | application/vnd.sap.adt.enhancements.v3+xml |  | Accepted content types: application/vnd.sap.adt.enhancements.v3+xml | bogus: 406 |
| clients: GET /sap/bc/adt/oo/interfaces/{name} |  |  | Accepted content types: | bogus: 406 |
| clients: GET /sap/bc/adt/oo/interfaces/{name}/source/main | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/oo/interfaces/{name}/source/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/repository/informationsystem/search | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| clients: GET /sap/bc/adt/repository/objectstructure | application/vnd.sap.adt.projectexplorer.objectstructure+xml |  | Accepted content types: application/vnd.sap.adt.projectexplorer.objectstructure+xml | bogus: 406 |
| clients: GET /sap/bc/adt/runtime/dumps | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/runtime/systemmessages | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: GET /sap/bc/adt/runtime/traces/abaptraces/objecttypes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| clients: GET /sap/bc/adt/runtime/traces/abaptraces/processtypes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| clients: GET /sap/bc/adt/st05/trace/directory | application/vnd.sap.adt.perf.trace.directory.v1+xml |  | Accepted content types: application/vnd.sap.adt.perf.trace.directory.v1+xml | bogus: 406, corpus: 406 |
| clients: GET /sap/bc/adt/st05/trace/state | application/vnd.sap.adt.perf.trace.state.v1+xml |  | Accepted content types: application/vnd.sap.adt.perf.trace.state.v1+xml | bogus: 406, corpus: 406 |
| clients: GET /sap/bc/adt/xslt/transformations/{name} | application/vnd.sap.adt.transformations+xml |  | Accepted content types: application/vnd.sap.adt.transformations+xml | bogus: 406 |
| clients: GET /sap/bc/adt/xslt/transformations/{name}/source/main | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: GET /sap/bc/adt/xslt/transformations/{name}/source/main/versions | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| clients: POST /sap/bc/adt/abapunit/runs |  | application/vnd.sap.adt.api.abapunit.run.v1+xml | Supported Media Types: application/vnd.sap.adt.api.abapunit.run.v1+xml | bogus: 415 |
| clients: POST /sap/bc/adt/abapunit/testruns | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| clients: POST /sap/bc/adt/acm/dcl/sources |  |  | Accepted content types: application/vnd.sap.adt.dclsource+xml | none: 400 |
| clients: POST /sap/bc/adt/acm/dcl/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/aps/iam/auth |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| clients: POST /sap/bc/adt/aps/iam/auth/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/aunit/dbtestdoubles/cds/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/bo/behaviordefinitions |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| clients: POST /sap/bc/adt/bo/behaviordefinitions/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/checkruns | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | Supported Media Types: application/vnd.sap.adt.checkobjects+xml / Accepted content types: application/vnd.sap.adt.checkmessages+xml | bogus: 415, bogus: 406, none: 415 |
| clients: POST /sap/bc/adt/cts/transportchecks | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/datapreview/ddic | application/vnd.sap.adt.datapreview.table.v1+xml |  | Accepted content types: application/vnd.sap.adt.datapreview.table.v1+xml | bogus: 406 |
| clients: POST /sap/bc/adt/ddic/dataelements |  |  | Accepted content types: application/vnd.sap.adt.dataelements.v2+xml | none: 400 |
| clients: POST /sap/bc/adt/ddic/dataelements/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/ddic/ddl/sources |  |  | Accepted content types: application/vnd.sap.adt.ddlsource+xml | none: 400 |
| clients: POST /sap/bc/adt/ddic/ddl/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/ddic/ddlx/sources |  |  | Accepted content types: application/vnd.sap.adt.ddic.ddlx.v1+xml | none: 400 |
| clients: POST /sap/bc/adt/ddic/ddlx/sources/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/ddic/domains |  |  | Accepted content types: application/vnd.sap.adt.domains.v2+xml | none: 400 |
| clients: POST /sap/bc/adt/ddic/domains/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/ddic/dsfd/sources |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| clients: POST /sap/bc/adt/ddic/dsfd/sources/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/ddic/dsfi |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| clients: POST /sap/bc/adt/ddic/dsfi/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/ddic/srvd/sources |  |  | Accepted content types: application/vnd.sap.adt.ddic.srvd.v1+xml | none: 400 |
| clients: POST /sap/bc/adt/ddic/srvd/sources/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/ddic/structures |  |  | Accepted content types: application/vnd.sap.adt.structures.v2+xml | none: 400 |
| clients: POST /sap/bc/adt/ddic/structures/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/ddic/tables |  |  | Accepted content types: application/vnd.sap.adt.tables.v2+xml | none: 400 |
| clients: POST /sap/bc/adt/ddic/tables/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/ddic/tabletypes |  |  | Accepted content types: application/vnd.sap.adt.tabletype.v1+xml | none: 400 |
| clients: POST /sap/bc/adt/ddic/tabletypes/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/deletion/check | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | Accepted content types: application/vnd.sap.adt.deletion.check.response.v1+xml / Supported Media Types: application/vnd.sap.adt.deletion.check.request.v1+xml | bogus: 406, bogus: 415 |
| clients: POST /sap/bc/adt/deletion/delete | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | Accepted content types: application/vnd.sap.adt.deletion.response.v1+xml / Supported Media Types: application/vnd.sap.adt.deletion.request.v1+xml | bogus: 406, bogus: 415 |
| clients: POST /sap/bc/adt/enhancements/enhoxhb |  |  | Accepted content types: application/vnd.sap.adt.enh.enhoxhb.v4+xml | none: 400 |
| clients: POST /sap/bc/adt/enhancements/enhoxhb/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/functions/groups/{name}?_action=LOCK | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/functions/groups/{name}/includes |  | application/vnd.sap.adt.functions.fincludes.v2+xml | Supported Media Types: application/vnd.sap.adt.functions.fincludes.v2+xml | bogus: 415 |
| clients: POST /sap/bc/adt/functions/groups/{name}/includes/{name}?_action=LOCK | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/functions/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/includes/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/messageclass/{name}/messages/001?_action=LOCK_MSG | application/vnd.sap.adt.mc.messageclass+xml |  | Accepted content types: application/vnd.sap.adt.mc.messageclass+xml | bogus: 406 |
| clients: POST /sap/bc/adt/oo/classes/{name}?_action=LOCK | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/oo/classrun/{name} | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: POST /sap/bc/adt/oo/interfaces/{name}?_action=LOCK | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/packages |  |  | Accepted content types: application/vnd.sap.adt.packages.v2+xml | none: 400 |
| clients: POST /sap/bc/adt/packages/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/programs/programrun/{name} | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| clients: POST /sap/bc/adt/programs/validation | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/repository/informationsystem/usageReferences |  | application/vnd.sap.adt.repository.usagereferences.request.v1+xml | Supported Media Types: application/vnd.sap.adt.repository.usagereferences.request.v1+xml | bogus: 415 |
| clients: POST /sap/bc/adt/repository/informationsystem/usageReferences/scope |  | application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml | Supported Media Types: application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml | bogus: 415 |
| clients: POST /sap/bc/adt/repository/informationsystem/virtualfolders/contents |  | application/vnd.sap.adt.repository.virtualfolders.request.v1+xml | Supported Media Types: application/vnd.sap.adt.repository.virtualfolders.request.v1+xml | bogus: 415 |
| clients: POST /sap/bc/adt/repository/nodestructure | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: POST /sap/bc/adt/xslt/transformations/{name}?_action=LOCK | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| clients: PUT /sap/bc/adt/functions/groups/{name}/fmodules/{name}/source/main |  | text/plain | Supported Media Types: text/plain | bogus: 415, corpus: 415, none: 415 |
| clients: PUT /sap/bc/adt/functions/groups/{name}/includes/{name}/source/main |  | text/plain | Supported Media Types: text/plain | bogus: 415, corpus: 415, none: 415 |
| clients: PUT /sap/bc/adt/oo/classes/{name}/source/main | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| discovery: GET /sap/bc/adt/abapsource/codecompletion/hanacatalogaccess | application/vnd.sap.adt.objectReferences.v1+xml |  | Accepted content types: application/vnd.sap.adt.objectReferences.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/abapsource/parsers/rnd/grammar | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| discovery: GET /sap/bc/adt/abapsource/prettyprinter/settings | application/vnd.sap.adt.ppsettings+xml |  | Accepted content types: application/vnd.sap.adt.ppsettings+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/abapunit/metadata | application/vnd.sap.adt.abapunit.metadata.result.v1+xml |  | Accepted content types: application/vnd.sap.adt.abapunit.metadata.result.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/acm/dcl/parser | application/vnd.sap.adt.dcl.dclParserInfo.v2+xml |  | Accepted content types: application/vnd.sap.adt.dcl.dclParserInfo.v2+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/acm/dcl/repositoryaccess | application/vnd.sap.adt.ddl.objectReferences.v2+xml |  | Accepted content types: application/vnd.sap.adt.ddl.objectReferences.v2+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aif/aifdtyp/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aif/aifdtyp/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aif/aifityp/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aif/aifityp/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aif/aifntyp/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aif/aifntyp/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aif/aifrtyp/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aif/aifrtyp/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/analytics/reviewbooklets/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/analytics/reviewbooklets/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/apack/manifests | application/apack.adt.manifest.response.v1+xml |  | Accepted content types: application/apack.adt.manifest.response.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/applicationjob/catalogs/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/applicationjob/catalogs/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/applicationjob/templates/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/applicationjob/templates/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/applicationlog/objects/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/applicationlog/objects/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/allowedinstances/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/auth/fields | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/auth/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/compressrequest/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/contenttype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/dataelement/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/httpversion/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/inboundprocesscode/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/inboundService/detail |  |  | Accepted content types: | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/inboundService/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/oAuth2Granttype/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/oAuth2Profile/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/outboundprocesscode/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/outboundService/detail |  |  | Accepted content types: | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/outboundService/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/outputmode/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/partnertype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/pfcgRole/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/porttype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/pse/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/scenariotype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco1/steampunkAllowedInst/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco2/ibstype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco3/cota/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco3/desdschema/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco3/obsspcreationtype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco3/obstype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/com/sco3/serviceinterface/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia1/businessCatalog/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia1/catalogdependencytype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia1/catalogRole/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia1/catalogtype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia1/restrictionType/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia2/aggregationcategory/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia2/authobjectextension/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia2/restrictionfield/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia2/restrictiontype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia5/authfield/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/app/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/appcreationtype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/apptype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/auth/fields | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/auth/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/proposal |  |  | Accepted content types: | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/service/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/servicetype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/tcode/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia6/ui5apps/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/sia8/fiorispaceid/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/siad/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aps/cloud/iam/siad/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aps/com/sod1/docuprogramobjtype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/com/sod1/packagetype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/com/sod1/sod1/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/com/sod1/tagcategory/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/com/sod1/tagvaluehelp/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/com/sod2/apiobjecttype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/com/sod2/consumptionbundlename/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/com/sod2/leadingbusinessobjecttype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/auth/authField/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/auth/checktable/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/auth/dataelement/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suco/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suco/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/applicationtype/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/authobjectfield/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/checkindicator/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/maintenancemode/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/maintenancestatus/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/nodefault/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/proposalstatus/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/su22authfield/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/su22authobject/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/su22hash/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/sush/su22newobject/values |  |  | Accepted content types: | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/susi/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aps/iam/susi/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/accesscategory/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/activity/listvalues |  |  | Accepted content types: | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/activity/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/authfield/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/authObject/valueHelp | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/criticality/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/objectclass/listvalues |  |  | Accepted content types: | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/objectclass/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/owncontext/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/privileged/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/searchhelp/list | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/suso/su22tracelevel/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aps/iam/tran/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aps/iam/tran/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/archivingobjects/objects/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/archivingobjects/objects/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/atc/aicapabilities | application/vnd.sap.atc.aicapabilities.v1+xml |  | Accepted content types: application/vnd.sap.atc.aicapabilities.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/atc/approvers | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/atc/configuration/configurations | application/vnd.sap.adt.configurations.v1+xml |  | Accepted content types: application/vnd.sap.adt.configurations.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/atc/configuration/metadata | application/vnd.sap.adt.configuration.metadata.v1+xml |  | Accepted content types: application/vnd.sap.adt.configuration.metadata.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/atc/customizing | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/atc/exemptions/atcexemption |  |  | Accepted content types: application/vnd.sap.adt.chkev1+xml. | bogus: 400 |
| discovery: GET /sap/bc/adt/atc/variants | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/atc/worklists | application/atc.worklist.v1+xml |  | Accepted content types: application/atc.worklist.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ato/notifications | application/vnd.sap.adt.ato.notifications.v1+xml, application/vnd.sap.adt.ato.notifications.v1+json |  | Accepted content types: application/vnd.sap.adt.ato.notifications.v1+xml,application/vnd.sap.adt.ato.notifications.v1+json | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ato/settings | application/vnd.sap.adt.ato.settings.v1+xml, application/vnd.sap.adt.ato.settings.v1+json |  | Accepted content types: application/vnd.sap.adt.ato.settings.v1+xml, application/vnd.sap.adt.ato.settings.v1+json | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/aunit/dbtestdoubles/cds/dependencies | application/vnd.sap.adt.aunit.cds.dependencymodel.v1+xml |  | Accepted content types: application/vnd.sap.adt.aunit.cds.dependencymodel.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/aunit/dbtestdoubles/cds/dependencies/info | application/vnd.sap.adt.aunit.cds.dependencies.info.v1+xml |  | Accepted content types: application/vnd.sap.adt.aunit.cds.dependencies.info.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/bct/scp1bcs/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/bct/scp1bcs/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/bct/smbctyp/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/bct/smbctyp/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/bgqc/bgprocessingcontexts/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/bgqc/bgprocessingcontexts/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/bo/behaviordefinitions/parser/info | application/vnd.sap.adt.bdef.parserinfo.v1+xml |  | Accepted content types: application/vnd.sap.adt.bdef.parserinfo.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/businessobjects/nontnot/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessobjects/nontnot/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessobjects/rontrot/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessobjects/rontrot/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessservices/bindings/bindingtypes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/businessservices/consmodels/consumers | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/businessservices/eeecevc/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessservices/eeecevc/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessservices/evtbevb/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessservices/evtbevb/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessservices/evtoevo/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessservices/evtoevo/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessservices/odatav2 | application/vnd.sap.adt.businessservices.odatav2.v3+xml |  | Accepted content types: application/vnd.sap.adt.businessservices.odatav2.v3+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/businessservices/servprovs/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/businessservices/servprovs/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/changedocuments/objects/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/changedocuments/objects/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/checkruns/reporters | application/vnd.sap.adt.reporters+xml |  | Accepted content types: application/vnd.sap.adt.reporters+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/conn/commtargets/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/conn/commtargets/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/crosstrace/activations | application/vnd.sap.adt.crosstrace.activations.v1+xml |  | Accepted content types: application/vnd.sap.adt.crosstrace.activations.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/crosstrace/components | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/crosstrace/request_types | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/crosstrace/traces | application/vnd.sap.adt.crosstrace.traces.v1+xml |  | Accepted content types: application/vnd.sap.adt.crosstrace.traces.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/crosstrace/urimapping | application/vnd.sap.adt.crosstrace.urimapping.v1+xml |  | Accepted content types: application/vnd.sap.adt.crosstrace.urimapping.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/csn/csnm/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/csn/csnm/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/cts/transportrequests | application/vnd.sap.adt.transportorganizertree.v1+xml |  | Accepted content types: application/vnd.sap.adt.transportorganizertree.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/cts/transportrequests/facets | application/vnd.sap.adt.transportorganizer.facets.v1+xml |  | Accepted content types: application/vnd.sap.adt.transportorganizer.facets.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/cts/transportrequests/searchconfiguration/configurations | application/vnd.sap.adt.configurations.v1+xml |  | Accepted content types: application/vnd.sap.adt.configurations.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/cts/transportrequests/searchconfiguration/metadata | application/vnd.sap.adt.configuration.metadata.v1+xml |  | Accepted content types: application/vnd.sap.adt.configuration.metadata.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/cts/transports | application/vnd.sap.as+xml |  | Accepted content types: application/vnd.sap.as+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/databrowser/objects/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/databrowser/objects/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ddic/cds/annotation/definitions | application/vnd.sap.adt.cds.annotation.definitions.v2+xml |  | Accepted content types: application/vnd.sap.adt.cds.annotation.definitions.v2+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/cds/annotation/elementinfo | application/vnd.sap.adt.elementinfo+xml |  | Accepted content types: application/vnd.sap.adt.elementinfo+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/cds/annotation/objref/proposal | application/vnd.sap.adt.codeCompletionProposals.v4+xml |  | Accepted content types: application/vnd.sap.adt.codeCompletionProposals.v4+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/dataelements/docu/supplements | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/db/indexes/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ddic/db/indexes/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ddic/db/settings/dataClass/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/db/settings/keyFields/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/db/settings/size/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddl/ddicrepositoryaccess | application/vnd.sap.adt.ddl.objectReferences.v2+xml |  | Accepted content types: application/vnd.sap.adt.ddl.objectReferences.v2+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddl/elementinfo | application/vnd.sap.adt.elementinfo+xml |  | Accepted content types: application/vnd.sap.adt.elementinfo+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddl/elementmappings | application/vnd.sap.adt.ddl.elementMappingsStrategies+xml |  | Accepted content types: application/vnd.sap.adt.ddl.elementMappingsStrategies+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddl/elementmappings/strategies | application/vnd.sap.adt.ddl.elementMappingsStrategies+xml |  | Accepted content types: application/vnd.sap.adt.ddl.elementMappingsStrategies+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddl/migration/logs | application/vnd.sap.adt.ddl.migrationlog.v3+xml |  | Accepted content types: application/vnd.sap.adt.ddl.migrationlog.v3+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddl/parser | application/vnd.sap.adt.ddl.ddlParserInfo.v1+xml |  | Accepted content types: application/vnd.sap.adt.ddl.ddlParserInfo.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddl/sources/validation | application/vnd.sap.adt.ddlSource+xml |  | Accepted content types: application/vnd.sap.adt.ddlSource+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddla/parser/info | application/vnd.sap.adt.ddla.parserinfo.v2+xml |  | Accepted content types: application/vnd.sap.adt.ddla.parserinfo.v2+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddla/textlengthcalc | application/vnd.sap.adt.ddla.textlengthcalc.v1+text |  | Accepted content types: application/vnd.sap.adt.ddla.textlengthcalc.v1+text | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddlx/annotation/chain | application/vnd.sap.adt.ddlx.annotation.chain.v2+xml |  | Accepted content types: application/vnd.sap.adt.ddlx.annotation.chain.v2+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddlx/parser/info | application/vnd.sap.adt.ddlx.parserinfo.v3+xml |  | Accepted content types: application/vnd.sap.adt.ddlx.parserinfo.v3+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/ddlx/sources/$metadata | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  | Accepted content types: application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/desd/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ddic/desd/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ddic/dras/sources/$metadata | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  | Accepted content types: application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/dras/sources/$outlineconfiguration | application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml |  | Accepted content types: application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/drty/sources/$metadata | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  | Accepted content types: application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/drty/sources/$outlineconfiguration | application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml |  | Accepted content types: application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/dsfd/sources/$metadata | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  | Accepted content types: application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/dsfd/sources/$outlineconfiguration | application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml |  | Accepted content types: application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/dsfi/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ddic/dsfi/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ddic/dtdc/parser/info | application/vnd.sap.adt.dtdc.parserinfo.v1+xml |  | Accepted content types: application/vnd.sap.adt.dtdc.parserinfo.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/dteb/parser/info | application/vnd.sap.adt.dteb.parserinfo.v1+xml |  | Accepted content types: application/vnd.sap.adt.dteb.parserinfo.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/extensionindexes/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ddic/extensionindexes/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ddic/lockobjects/lockmodes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/logs/activationgraph | application/vnd.sap.adt.ddic.acivationLog.v1+xml |  | Accepted content types: application/vnd.sap.adt.ddic.acivationLog.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/srvd/parser/info | application/vnd.sap.adt.srvd.parserinfo.v1+xml |  | Accepted content types: application/vnd.sap.adt.srvd.parserinfo.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/srvd/services | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/srvd/sourceTypes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/structures/parser/info | application/vnd.sap.adt.tabl.parserinfo.v1+xml |  | Accepted content types: application/vnd.sap.adt.tabl.parserinfo.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/ddic/tables/parser/info | application/vnd.sap.adt.tabl.parserinfo.v1+xml |  | Accepted content types: application/vnd.sap.adt.tabl.parserinfo.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/destructionobjects/objects/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/destructionobjects/objects/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/docu/abap/langu | application/vnd.sap.adt.docu.v1+html |  | Accepted content types: application/vnd.sap.adt.docu.v1+html | bogus: 406 |
| discovery: GET /sap/bc/adt/emailtemplates/templates/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/emailtemplates/templates/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/enhancements/enhsxsb/search | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/externaltools/bas/configurations | application/vnd.sap.adt.configurations.v1+xml |  | Accepted content types: application/vnd.sap.adt.configurations.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/externaltools/bas/metadata | application/vnd.sap.adt.configuration.metadata.v1+xml |  | Accepted content types: application/vnd.sap.adt.configuration.metadata.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/feeds | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| discovery: GET /sap/bc/adt/fiori/uiad/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/fiori/uiad/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/fiori/uipgtyp/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/fiori/uipgtyp/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/fiori/uisttop/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/fiori/uisttop/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/formobjects/sfpf5f/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/formobjects/sfpf5f/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ideactions/objects/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ideactions/objects/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ideactions/runtime | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| discovery: GET /sap/bc/adt/ilmobjects/objects/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/ilmobjects/objects/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/islm/intelligentmodel/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/islm/intelligentmodel/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/islm/intelligentscenario/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/islm/intelligentscenario/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/metricproviders/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/metricproviders/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/notebasic/assignments/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/notebasic/assignments/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/notebasic/notetypes/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/notebasic/notetypes/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/numberranges/objects/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/numberranges/objects/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/packages/settings |  |  | Accepted content types: | bogus: 406 |
| discovery: GET /sap/bc/adt/predefinedfields/objects/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/predefinedfields/objects/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/repository/generators | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| discovery: GET /sap/bc/adt/repository/informationsystem/abaplanguageversions | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/repository/informationsystem/executableobjecttypes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/repository/informationsystem/objecttypes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/repository/informationsystem/properties/values | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/repository/informationsystem/releasestates | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/repository/informationsystem/status | application/vnd.sap.adt.ris.status.v1+asjson |  | Accepted content types: application/vnd.sap.adt.ris.status.v1+asjson | bogus: 406 |
| discovery: GET /sap/bc/adt/repository/informationsystem/textsearch/objectnames | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/repository/informationsystem/textsearch/objecttypes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/repository/informationsystem/virtualfolders/facets | application/vnd.sap.adt.facets.v1+xml |  | Accepted content types: application/vnd.sap.adt.facets.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/runtime/memory/snapshots | application/vnd.sap.adt.runtime.memory.snapshots.v1+xml |  | Accepted content types: application/vnd.sap.adt.runtime.memory.snapshots.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/runtime/traces/abaptraces/objecttypes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/runtime/traces/abaptraces/processtypes | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: GET /sap/bc/adt/st05/trace/directory | application/vnd.sap.adt.perf.trace.directory.v1+xml |  | Accepted content types: application/vnd.sap.adt.perf.trace.directory.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/st05/trace/state | application/vnd.sap.adt.perf.trace.state.v1+xml |  | Accepted content types: application/vnd.sap.adt.perf.trace.state.v1+xml | bogus: 406 |
| discovery: GET /sap/bc/adt/swc/relations/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/swc/relations/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/system/components | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| discovery: GET /sap/bc/adt/system/information | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| discovery: GET /sap/bc/adt/system/users | application/atom+xml, application/atom+xml;type=feed |  | Accepted content types: application/atom+xml;type=feed | bogus: 406 |
| discovery: GET /sap/bc/adt/transportobject/objects/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/transportobject/objects/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/urifragmentmappings | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| discovery: GET /sap/bc/adt/wbobj/apictyp/$configuration | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: GET /sap/bc/adt/wbobj/apictyp/$schema | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | Accepted content types: application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | bogus: 406, corpus: 406, none: 406 |
| discovery: POST /sap/bc/adt/abapsource/abapdoc/exportjobs | application/vnd.sap.adt.abapsource.abapdoc.exportresults.v1+zip |  | Accepted content types: application/vnd.sap.adt.abapsource.abapdoc.exportresults.v1+zip | bogus: 406 |
| discovery: POST /sap/bc/adt/abapsource/codecompletion/elementinfo | application/vnd.sap.adt.elementinfo+xml |  | Accepted content types: application/vnd.sap.adt.elementinfo+xml | bogus: 406 |
| discovery: POST /sap/bc/adt/abapsource/typehierarchy | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: POST /sap/bc/adt/abapunit/explain | application/vnd.sap.adt.aunit.explain.result.v1+asjson |  | Accepted content types: application/vnd.sap.adt.aunit.explain.result.v1+asjson | bogus: 406 |
| discovery: POST /sap/bc/adt/abapunit/testruns | application/vnd.sap.adt.abapunit.testruns.result.v1+xml |  | Accepted content types: application/vnd.sap.adt.abapunit.testruns.result.v1+xml | bogus: 406 |
| discovery: POST /sap/bc/adt/abapunit/testruns/evaluation | application/vnd.sap.adt.abapunit.testruns.evaluation.result.v1+xml |  | Accepted content types: application/vnd.sap.adt.abapunit.testruns.evaluation.result.v1+xml | bogus: 406 |
| discovery: POST /sap/bc/adt/acm/dcl/sources |  |  | Accepted content types: application/vnd.sap.adt.dclsource+xml | none: 400 |
| discovery: POST /sap/bc/adt/aif/aifdtyp/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/aif/aifityp |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/aif/aifityp/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/aif/aifntyp |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/aif/aifntyp/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/aif/aifrtyp |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/aif/aifrtyp/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/analytics/reviewbooklets |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/analytics/reviewbooklets/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/applicationjob/catalogs |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/applicationjob/catalogs/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/applicationjob/templates |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/applicationjob/templates/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/applicationlog/objects |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/applicationlog/objects/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/aps/cloud/com/sco1 |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/cloud/iam/sia2 |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/cloud/iam/sia5 |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/cloud/iam/sia6 |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/cloud/iam/sia7 |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/cloud/iam/sia8 |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/cloud/iam/sia9 |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/cloud/iam/siad |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/cloud/iam/siad/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/aps/com/sod1 |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/iam/suco/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/aps/iam/sush |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/iam/susi |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/iam/susi/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/aps/iam/suso |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/iam/tran |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/aps/iam/tran/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/archivingobjects/objects |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/archivingobjects/objects/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/atc/checkcategories |  |  | Accepted content types: application/vnd.sap.adt.chkcv1+xml | none: 400 |
| discovery: POST /sap/bc/adt/atc/checkexemptions |  |  | Accepted content types: application/vnd.sap.adt.chkev2+xml | none: 400 |
| discovery: POST /sap/bc/adt/atc/checks |  |  | Accepted content types: application/vnd.sap.adt.chkov1+xml | none: 400 |
| discovery: POST /sap/bc/adt/atc/checkvariants |  |  | Accepted content types: application/vnd.sap.adt.chkvv4+xml | none: 400 |
| discovery: POST /sap/bc/adt/ato/notifications | application/vnd.sap.adt.ato.notification.v1+xml, application/vnd.sap.adt.ato.notification.v1+json |  | Accepted content types: application/vnd.sap.adt.ato.notification.v1+xml, application/vnd.sap.adt.ato.notification.v1+json | corpus: 406 |
| discovery: POST /sap/bc/adt/bct/scp1bcs |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/bct/scp1bcs/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/bct/smbctyp |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/bct/smbctyp/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/bgqc/bgprocessingcontexts |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/bgqc/bgprocessingcontexts/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/bo/behaviordefinitions |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/businessobjects/nontnot |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/businessobjects/nontnot/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/businessobjects/rontrot |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/businessservices/bindings |  |  | Accepted content types: application/vnd.sap.adt.businessservices.servicebi | none: 400 |
| discovery: POST /sap/bc/adt/businessservices/evtbevb |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/businessservices/evtbevb/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/businessservices/evtoevo |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/businessservices/evtoevo/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/businessservices/servprovs |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/businessservices/servprovs/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/changedocuments/objects |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/changedocuments/objects/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/classifications |  | application/vnd.sap.adt.classification+xml | Supported Media Types: application/vnd.sap.adt.classification+xml | bogus: 415 |
| discovery: POST /sap/bc/adt/conn/commtargets |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/conn/commtargets/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/crosstrace/traces | application/vnd.sap.adt.crosstrace.traces.v1+xml |  | Accepted content types: application/vnd.sap.adt.crosstrace.traces.v1+xml | bogus: 406 |
| discovery: POST /sap/bc/adt/csn/csnm |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/csn/csnm/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/databrowser/objects |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/databrowser/objects/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/ddic/dataelements |  |  | Accepted content types: application/vnd.sap.adt.dataelements.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/db/indexes |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/db/indexes/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/ddic/db/settings |  |  | Accepted content types: application/vnd.sap.adt.table.settings.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/ddl/sources |  |  | Accepted content types: application/vnd.sap.adt.ddlsource+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/ddlx/formatter/identifiers |  |  | Accepted content types: application/vnd.sap.adt.ddlx.parserinfo.v3+xml | bogus: 400 |
| discovery: POST /sap/bc/adt/ddic/ddlx/sources |  |  | Accepted content types: application/vnd.sap.adt.ddic.ddlx.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/desd |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/desd/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/ddic/domains |  |  | Accepted content types: application/vnd.sap.adt.domains.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/dras/sources |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/drty/sources |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/drty/sources/$formatter | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| discovery: POST /sap/bc/adt/ddic/dsfd/sources |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/dsfd/sources/$formatter | text/plain |  | Accepted content types: text/plain | bogus: 406 |
| discovery: POST /sap/bc/adt/ddic/dsfi |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/dsfi/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/ddic/dtdc/sources |  |  | Accepted content types: application/vnd.sap.adt.ddic.dtdc.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/dteb/sources |  |  | Accepted content types: application/vnd.sap.adt.ddic.dteb.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/extensionindexes |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/extensionindexes/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/ddic/lockobjects/sources |  |  | Accepted content types: application/vnd.sap.adt.lockobjects.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/srvd/sources |  |  | Accepted content types: application/vnd.sap.adt.ddic.srvd.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/structures |  |  | Accepted content types: application/vnd.sap.adt.structures.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/tables |  |  | Accepted content types: application/vnd.sap.adt.tables.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/ddic/tabletypes |  |  | Accepted content types: application/vnd.sap.adt.tabletype.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/deletion/check | application/vnd.sap.adt.deletion.check.response.v1+xml |  | Accepted content types: application/vnd.sap.adt.deletion.check.response.v1+xml | bogus: 406 |
| discovery: POST /sap/bc/adt/deletion/delete | application/vnd.sap.adt.deletion.response.v1+xml |  | Accepted content types: application/vnd.sap.adt.deletion.response.v1+xml | bogus: 406 |
| discovery: POST /sap/bc/adt/destructionobjects/objects |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/destructionobjects/objects/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/documentation/ktd/documents |  |  | Accepted content types: application/vnd.sap.adt.sktdv2+xml | none: 400 |
| discovery: POST /sap/bc/adt/emailtemplates/templates |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/emailtemplates/templates/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/enhancements/enhoxhb |  |  | Accepted content types: application/vnd.sap.adt.enh.enhoxhb.v4+xml | none: 400 |
| discovery: POST /sap/bc/adt/enhancements/enhsxsb |  |  | Accepted content types: application/vnd.sap.adt.enh.enhs.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/fiori/uiad |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/fiori/uiad/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/fiori/uipgtyp |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/fiori/uipgtyp/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/fiori/uisttop |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/fiori/uisttop/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/formobjects/sfpf5f |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/formobjects/sfpf5f/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/ideactions/objects |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/ideactions/objects/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/ilmobjects/objects |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/ilmobjects/objects/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/islm/intelligentmodel |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/islm/intelligentmodel/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/islm/intelligentscenario |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/islm/intelligentscenario/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/metricproviders |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/metricproviders/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/notebasic/assignments |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/notebasic/assignments/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/notebasic/notetypes |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/notebasic/notetypes/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/numberranges/objects |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/numberranges/objects/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/objectrelations | application/vnd.sap.adt.objectrelations.request.relations.v1+xml |  | Accepted content types: application/vnd.sap.adt.objectrelations.request.relations.v1+xml | bogus: 406 |
| discovery: POST /sap/bc/adt/objectrelations/components | application/vnd.sap.adt.objectrelations.response.components.v2+xml |  | Accepted content types: application/vnd.sap.adt.objectrelations.response.components.v2+xml | bogus: 406 |
| discovery: POST /sap/bc/adt/objectrelations/network | application/vnd.sap.adt.objectrelations.response.network.v1+xml |  | Accepted content types: application/vnd.sap.adt.objectrelations.response.network.v1+xml | bogus: 406 |
| discovery: POST /sap/bc/adt/objectrelations/references |  |  | Accepted content types: | bogus: 406 |
| discovery: POST /sap/bc/adt/packages |  |  | Accepted content types: application/vnd.sap.adt.packages.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/predefinedfields/objects |  |  | Accepted content types: application/vnd.sap.adt.blues.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/predefinedfields/objects/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/quickfixes/evaluation | application/xml |  | Accepted content types: application/xml | bogus: 406 |
| discovery: POST /sap/bc/adt/repository/informationsystem/virtualfolders |  | application/vnd.sap.adt.repository.virtualfolders.request.v1+xml | Supported Media Types: application/vnd.sap.adt.repository.virtualfolders.request.v1+xml | bogus: 415, corpus: 415 |
| discovery: POST /sap/bc/adt/repository/informationsystem/virtualfolders/contents |  | application/vnd.sap.adt.repository.virtualfolders.request.v1+xml | Supported Media Types: application/vnd.sap.adt.repository.virtualfolders.request.v1+xml | bogus: 415, corpus: 415 |
| discovery: POST /sap/bc/adt/swc/relations |  |  | Accepted content types: application/vnd.sap.adt.blues.v2+xml | none: 400 |
| discovery: POST /sap/bc/adt/swc/relations/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/transportobject/objects/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |
| discovery: POST /sap/bc/adt/ucon/httpservices |  |  | Accepted content types: application/vnd.sap.adt.uconn.http.v1+xml | none: 400 |
| discovery: POST /sap/bc/adt/wbobj/apictyp/source/formatter | application/json | application/json | Accepted content types: application/json / Supported Media Types: application/json | bogus: 406, bogus: 415 |

## The header corpus: discovery

| endpoint | discovery lists | none: Accept named | none: Content-Type named | bogus: Accept named | bogus: Content-Type named | needs (bogus) |
|---|---|---|---|---|---|---|
| GET /sap/bc/adt/abapdaemons/applications |  |  |  |  |  |  |
| GET /sap/bc/adt/abapdaemons/applications/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/abapdaemons/applications/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/abapdaemons/applications/source/formatter | Content-Type application/json |  |  |  |  |  |
| GET /sap/bc/adt/abapdaemons/applications/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/abapgit/externalrepoinfo | Content-Type application/abapgit.adt.repo.info.ext.request.v1+xml; Content-Type application/abapgit.adt.repo.info.ext.request.v2+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapgit/repos | Content-Type application/abapgit.adt.repo.v1+xml; Content-Type application/abapgit.adt.repo.v2+xml; Content-Type application/abapgit.adt.repo.v3+xml; Content-Type application/abapgit.adt.repo.v4+xml |  |  |  |  | unknown (Accept: unknown (400 (no SAP exception)); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/abapdoc/exportjobs | Content-Type application/vnd.sap.adt.abapsource.abapdoc.exportjobs.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/cleanup/source |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/codecompletion/elementinfo | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/codecompletion/hanacatalogaccess |  |  |  | application/vnd.sap.adt.objectReferences.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/codecompletion/insertion |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/codecompletion/proposal |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/occurencemarkers |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/parsers/rnd/grammar |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/prettyprinter |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/prettyprinter/settings | Content-Type application/vnd.sap.adt.ppsettings.v2+xml; Content-Type application/vnd.sap.adt.ppsettings.v3+xml; Content-Type application/vnd.sap.adt.ppsettings.v4+xml; Content-Type application/vnd.sap.adt.ppsettings.v5+xml |  |  | application/vnd.sap.adt.ppsettings+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/abapsource/typehierarchy | Content-Type application/vnd.sap.adt.typehierachy.result.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapunit/explain | Content-Type application/vnd.sap.adt.aunit.explain.request.v1+asjson |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapunit/metadata |  |  |  | application/vnd.sap.adt.abapunit.metadata.result.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/abapunit/runs |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapunit/testruns | Content-Type application/vnd.sap.adt.abapunit.testruns.config.v1+xml; Content-Type application/vnd.sap.adt.abapunit.testruns.config.v2+xml; Content-Type application/vnd.sap.adt.abapunit.testruns.config.v3+xml; Content-Type application/vnd.sap.adt.abapunit.testruns.config.v4+xml; Content-Type application/xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/abapunit/testruns/evaluation | Content-Type application/vnd.sap.adt.abapunit.testruns.evaluation.config.v1+xml; Content-Type application/vnd.sap.adt.abapunit.testruns.evaluation.config.v2+xml; Content-Type application/vnd.sap.adt.abapunit.testruns.evaluation.config.v3+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/acm/dcl/elementinfo |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/acm/dcl/parser |  |  |  | application/vnd.sap.adt.dcl.dclParserInfo.v2+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/acm/dcl/repositoryaccess |  |  |  | application/vnd.sap.adt.ddl.objectReferences.v2+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/acm/dcl/sources | Content-Type application/vnd.sap.adt.dclSource+xml |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/acm/dcl/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/activation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/activation/inactiveobjects | Content-Type application/vnd.sap.adt.inactivectsobjects.v2+xml; Content-Type application/vnd.sap.adt.inactivectsobjects.v1+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/activation/results |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/activation/runs | Content-Type application/vnd.sap.adt.activationrun.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifdtyp | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifdtyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifdtyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifdtyp/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifdtyp/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifityp | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifityp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifityp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifityp/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifityp/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifntyp | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifntyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifntyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifntyp/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifntyp/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifrtyp | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifrtyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifrtyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifrtyp/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aif/aifrtyp/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aif/check |  |  |  |  |  |  |
| GET /sap/bc/adt/aif/check/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/aif/check/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/aif/check/source/formatter | Content-Type application/json |  |  |  |  |  |
| GET /sap/bc/adt/aif/check/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/aif/fixvalue |  |  |  |  |  |  |
| GET /sap/bc/adt/aif/fixvalue/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/aif/fixvalue/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/aif/fixvalue/source/formatter | Content-Type application/json |  |  |  |  |  |
| GET /sap/bc/adt/aif/fixvalue/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/amdp/debugger/main | Content-Type application/vnd.sap.adt.amdp.dbg.main.v4+xml |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/ana/aqd | Content-Type application/vnd.sap.adt.ddlSource+xml |  |  |  |  |  |
| GET /sap/bc/adt/analytics/reviewbooklets | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/analytics/reviewbooklets/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/analytics/reviewbooklets/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/analytics/reviewbooklets/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/analytics/reviewbooklets/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/apack/gitmanifests | Content-Type application/apack.adt.gitmanifest.request.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/apack/manifests |  |  |  | application/apack.adt.manifest.response.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/apireleases |  |  |  |  |  | unknown (Accept: unknown (500 dump or router: Access using a &#39;NULL&#39; object reference is not possible. (Message 20261028150207appserver SAPUSER01100)); Content-Type: no body) |
| GET /sap/bc/adt/applicationjob/catalogs | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/applicationjob/catalogs/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/applicationjob/catalogs/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/applicationjob/catalogs/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/applicationjob/catalogs/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/applicationjob/templates | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/applicationjob/templates/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/applicationjob/templates/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/applicationjob/templates/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/applicationjob/templates/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/applicationlog/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/applicationlog/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/applicationlog/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/applicationlog/objects/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/applicationlog/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/applicationobjects/objects |  |  |  |  |  |  |
| GET /sap/bc/adt/applicationobjects/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/applicationobjects/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/applicationobjects/objects/source/formatter | Content-Type application/json |  |  |  |  |  |
| GET /sap/bc/adt/applicationobjects/objects/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/actvt/detail | Content-Type application/vnd.sap.adt.aps.common.actvtdetail+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/allowedinstances/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/auth/detail | Content-Type application/vnd.sap.adt.aps.common.authdetail+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/auth/fields |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/auth/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/compressrequest/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/contenttype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/dataelement/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/httpversion/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/inboundService/detail | Content-Type application/vnd.sap.adt.com.ibsdetail+xml |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/inboundService/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/inboundprocesscode/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/oAuth2Granttype/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/oAuth2Profile/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/outboundService/detail | Content-Type application/vnd.sap.adt.com.obsdetail+xml |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/outboundService/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/outboundprocesscode/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/outputmode/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/partnertype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/pfcgRole/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/porttype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/pse/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/scenariotype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/steampunkAllowedInst/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco1/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco2 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco2/ibstype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco2/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco3 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco3/cota/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco3/desdschema/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco3/obsspcreationtype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco3/obstype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco3/serviceinterface/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/com/sco3/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia1 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia1/businessCatalog/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia1/catalogRole/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia1/catalogdependencytype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia1/catalogtype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia1/restrictionType/details | Content-Type application/vnd.sap.adt.common.restrictiontypedetails+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia1/restrictionType/valueHelp | Content-Type application/vnd.sap.adt.aps.common.restrictionsvh+xml |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia1/title/valueHelp |  |  |  |  |  | unknown (Accept: unknown (500 dump or router: Creation of handler class failed (class not found)); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia1/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia2 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia2/aggregationcategory/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia2/authobjectextension/details | Content-Type application/vnd.sap.adt.iam.sia2authfielddetails+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia2/authobjectextension/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia2/restrictionfield/details | Content-Type application/vnd.sap.adt.iam.sia2authfielddetails+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia2/restrictionfield/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia2/restrictiontype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia2/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia5 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia5/authfield/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia5/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/actvt/detail | Content-Type application/vnd.sap.adt.aps.common.actvtdetail+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/app/status | Content-Type application/vnd.sap.adt.iam.status+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/app/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/appcreationtype/values | Content-Type application/vnd.sap.adt.aps.iam.appcreationtypes+xml |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/apptype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/auth/detail | Content-Type application/vnd.sap.adt.aps.common.authdetail+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/auth/fields |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/auth/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/publish | Content-Type application/vnd.sap.adt.iam.publishing+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/details | Content-Type application/vnd.sap.adt.common.restrictiontypedetails+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/proposal | Content-Type application/vnd.sap.adt.sia6.restrictiontypeproposal+xml |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/valueHelp | Content-Type application/vnd.sap.adt.aps.common.restrictionsvh+xml |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/service/detail | Content-Type application/vnd.sap.adt.iam.servicedetail+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/service/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/servicetype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/tcode/detail | Content-Type application/vnd.sap.adt.iam.tcodedetail+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/tcode/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/ui5apps/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/uiad/detail | Content-Type application/vnd.sap.adt.iam.uiaddetail+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia6/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia7 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia7/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia8 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia8/fiorispaceid/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia8/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia9 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/sia9/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/siad | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/siad/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/siad/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/siad/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/cloud/iam/siad/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod1 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod1/docuprogramobjtype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod1/packagetype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod1/sod1/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod1/tagcategory/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod1/tagvaluehelp/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod1/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod2 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod2/apiobjecttype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod2/consumptionbundlename/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod2/consumptionbundletype/values |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod2/leadingbusinessobjecttype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod2/odatav4groupservice/values |  |  |  |  |  | unknown (Accept: unknown (500 dump or router: An exception has occurred that was not caught. (Message 20261028150057appserver SAPUSER01100)); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod2/tadir/values |  |  |  |  |  | unknown (Accept: unknown (500 dump or router: An exception has occurred that was not caught. (Message 20261028150055appserver SAPUSER01100)); Content-Type: no body) |
| GET /sap/bc/adt/aps/com/sod2/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/common/sbc1 |  |  |  |  |  |  |
| GET /sap/bc/adt/aps/common/sbc1/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/aps/iam/auth | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/auth/authField/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/auth/authcolsearchhelp | Content-Type application/vnd.sap.adt.auth.authcolsearchhelp+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/auth/authdtelallowed | Content-Type application/vnd.sap.adt.auth.authdtelallowed+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/auth/checktable/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/auth/dataelement/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/auth/objfldsearchhelp | Content-Type application/vnd.sap.adt.auth.objfldsearchhelp+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/auth/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suco | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suco/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suco/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suco/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suco/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/applicationtype/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/authobjectfield/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/checkindicator/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/maintenancemode/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/maintenancestatus/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/nodefault/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/proposalstatus/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/su22authfield/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/su22authobject/detail | Content-Type application/vnd.sap.adt.sush.authobjdetail+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/su22authobject/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/su22hash/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/su22newobject/values | Content-Type application/vnd.sap.adt.sush.newobjectlist+xml |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/sush/synchronize | Content-Type application/vnd.sap.adt.sush.synchronize+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/sush/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/susi | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/susi/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/susi/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/susi/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/susi/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/abaplanguageversion | Content-Type application/vnd.sap.adt.suso.abaplanguageversion+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/accesscategory/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/activity/details | Content-Type application/vnd.sap.adt.suso.activitydetails+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/activity/listvalues | Content-Type application/vnd.sap.adt.suso.activitylist+xml |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/activity/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/authObject/valueHelp |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/authfield/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/criticality/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/objectclass/listvalues | Content-Type application/vnd.sap.adt.suso.objectclasslist+xml |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/objectclass/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/owncontext/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/privileged/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/searchhelp | Content-Type application/vnd.sap.adt.suso.searchhelp+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/searchhelp/list |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/su22tracelevel/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/susobasisobject | Content-Type application/vnd.sap.adt.suso.susobasisobject+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/suso/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/tran | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/tran/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/tran/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/tran/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/aps/iam/tran/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/archivingobjects/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/archivingobjects/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/archivingobjects/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/archivingobjects/objects/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/archivingobjects/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/atc/aicapabilities |  |  |  | application/vnd.sap.atc.aicapabilities.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/atc/apprNotifi/subscriptions |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/atc/approvers |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/atc/autoqf/worklist | Content-Type application/vnd.sap.adt.atc.objectreferences.v1+xml; Content-Type application/vnd.sap.adt.atc.autoqf.proposal.v1+xml; Content-Type application/vnd.sap.adt.atc.autoqf.selection.v1+xml; Content-Type application/vnd.sap.adt.atc.genericrefactoring.v1+xml; Content-Type application/vnd.sap.adt.atc.autoqf.implement.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/atc/ccstunnel |  |  |  |  |  |  |
| GET /sap/bc/adt/atc/checkcategories | Content-Type application/vnd.sap.adt.chkcv1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/atc/checkcategories/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/atc/checkexemptions | Content-Type application/vnd.sap.adt.chkev2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/atc/checkexemptions/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/atc/checkexemptionsview |  |  |  |  |  | unknown (Accept: unknown (406 generic (T100 037): not necessarily the Accept); Content-Type: no body) |
| GET /sap/bc/adt/atc/checkfailures |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/atc/checkfailures/logs |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/atc/checks | Content-Type application/vnd.sap.adt.chkov1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/atc/checks/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/atc/checkvariants | Content-Type application/vnd.sap.adt.chkvv4+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/atc/checkvariants/codecompletion/templates |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/atc/checkvariants/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/atc/configuration/configurations |  |  |  | application/vnd.sap.adt.configurations.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/atc/configuration/metadata |  |  |  | application/vnd.sap.adt.configuration.metadata.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/atc/customizing |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/atc/exemptions/apply |  |  |  |  |  | accept (Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body) |
| GET /sap/bc/adt/atc/exemptions/atcexemption | Content-Type application/vnd.sap.adt.chkev1+xml |  |  |  |  | unknown (Accept: unknown (400 (no SAP exception)); Content-Type: no body) |
| GET /sap/bc/adt/atc/remarks | Content-Type application/vnd.sap.adt.atc.remarks.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/atc/result/worklist |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/atc/results |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/atc/runs |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/atc/variants |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/atc/worklists |  |  |  | application/atc.worklist.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ato/notifications | Content-Type application/vnd.sap.adt.ato.notification.v1+xml; Content-Type application/vnd.sap.adt.ato.notification.v1+json | application/vnd.sap.adt.ato.notifications.v1+xml, application/vnd.sap.adt.ato.notifications.v1+json |  | application/vnd.sap.adt.ato.notifications.v1+xml, application/vnd.sap.adt.ato.notifications.v1+json |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ato/settings |  | application/vnd.sap.adt.ato.settings.v1+xml, application/vnd.sap.adt.ato.settings.v1+json |  | application/vnd.sap.adt.ato.settings.v1+xml, application/vnd.sap.adt.ato.settings.v1+json |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aunit/dbtestdoubles/cds/dependencies |  |  |  | application/vnd.sap.adt.aunit.cds.dependencymodel.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aunit/dbtestdoubles/cds/dependencies/info |  |  |  | application/vnd.sap.adt.aunit.cds.dependencies.info.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/aunit/dbtestdoubles/cds/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/bct/scp1bcs | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/bct/scp1bcs/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/bct/scp1bcs/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/bct/scp1bcs/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/bct/scp1bcs/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/bct/smbctyp | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/bct/smbctyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/bct/smbctyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/bct/smbctyp/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/bct/smbctyp/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/bgqc/bgprocessingcontexts | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/bgqc/bgprocessingcontexts/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/bgqc/bgprocessingcontexts/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/bgqc/bgprocessingcontexts/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/bgqc/bgprocessingcontexts/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/bo/behaviordefinitions | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/bo/behaviordefinitions/parser/info | Content-Type application/vnd.sap.adt.bdef.parserinfo.v1+xml |  |  | application/vnd.sap.adt.bdef.parserinfo.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/bo/behaviordefinitions/source/formatter | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/bo/behaviordefinitions/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/bopf/businessobjects |  |  |  |  |  |  |
| GET /sap/bc/adt/bopf/businessobjects/$constants |  |  |  |  |  |  |
| GET /sap/bc/adt/bopf/businessobjects/$contentassist |  |  |  |  |  |  |
| GET /sap/bc/adt/bopf/businessobjects/$generation |  |  |  |  |  |  |
| GET /sap/bc/adt/bopf/businessobjects/$search |  |  |  |  |  |  |
| GET /sap/bc/adt/bopf/businessobjects/$structurefields |  |  |  |  |  |  |
| GET /sap/bc/adt/bopf/businessobjects/$synchronize |  |  |  |  |  |  |
| GET /sap/bc/adt/bopf/businessobjects/$validation |  |  |  |  |  |  |
| GET /sap/bc/adt/businesslogicextensions/badinameproposals |  |  |  |  |  |  |
| GET /sap/bc/adt/businesslogicextensions/badis |  |  |  |  |  |  |
| GET /sap/bc/adt/businessobjects/nontnot | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/businessobjects/nontnot/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessobjects/nontnot/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessobjects/nontnot/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessobjects/nontnot/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessobjects/rontrot | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/businessobjects/rontrot/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessobjects/rontrot/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessobjects/rontrot/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessobjects/rontrot/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/bindings | Content-Type application/vnd.sap.adt.businessservices.servicebinding.v2+xml; Content-Type text/html; Content-Type application/json; Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/bindings/bindingtypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/bindings/bindingtypes/ina1 | Content-Type application/vnd.sap.adt.businessservices.ina.v1+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/bindings/bindingtypes/sql1 | Content-Type application/vnd.sap.adt.businessservices.sql.v1+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/bindings/schema | Content-Type application/vnd.sap.adt.businessservices.schema.v1+json |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/bindings/uiconfig | Content-Type application/vnd.sap.adt.businessservices.uiconfig.v1+json |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/bindings/validate/servicedefinition |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/bindings/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/consmodels | Content-Type application/vnd.sap.adt.businessservices.serviceconsumptionmodel.v6+xml; Content-Type text/html; Content-Type application/json; Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/consmodels/codesample |  |  |  |  |  | unknown (Accept: unknown (500 dump or router: An exception has occurred that was not caught. (Message 20261028150135appserver SAPUSER01100)); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/consmodels/consdata/validate |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/consmodels/consumers |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/consmodels/getmapping |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/consmodels/validatemapping |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/consmodels/validaterfc |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/consmodels/validatewsdl |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/consmodels/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/eeecevc | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/eeecevc/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/eeecevc/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/eeecevc/generate |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/eeecevc/previewobjects |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/eeecevc/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/eeecevc/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/evtbevb | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/evtbevb/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/evtbevb/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/evtbevb/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/evtbevb/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/evtoevo | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/evtoevo/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/evtoevo/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/evtoevo/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/evtoevo/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/odatav2 | Content-Type application/vnd.sap.adt.businessservices.odatav2.v3+xml |  |  | application/vnd.sap.adt.businessservices.odatav2.v3+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/odatav4 | Content-Type application/vnd.sap.adt.businessservices.odatav4.v2+xml |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/release |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/servprovs | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/servprovs/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/servprovs/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/servprovs/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/businessservices/servprovs/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/changedocuments/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/changedocuments/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/changedocuments/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/changedocuments/objects/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/changedocuments/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/checkruns |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/checkruns/reporters |  |  |  | application/vnd.sap.adt.reporters+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/classifications | Content-Type application/vnd.sap.adt.classification+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/cmp_code_composer/cmpt |  |  |  |  |  |  |
| GET /sap/bc/adt/cmp_code_composer/cmpt/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/conn/commtargets | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/conn/commtargets/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/conn/commtargets/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/conn/commtargets/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/conn/commtargets/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/crosstrace/activations | Content-Type application/vnd.sap.adt.crosstrace.activations.v1+xml; Content-Type application/vnd.sap.adt.crosstrace.activations.v1.b+xml |  |  | application/vnd.sap.adt.crosstrace.activations.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/crosstrace/components |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/crosstrace/request_types |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/crosstrace/traces | Content-Type application/vnd.sap.adt.crosstrace.trace.full.v1+json |  |  | application/vnd.sap.adt.crosstrace.traces.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/crosstrace/urimapping |  |  |  | application/vnd.sap.adt.crosstrace.urimapping.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/csn/csnm | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/csn/csnm/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/csn/csnm/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/csn/csnm/files | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/csn/csnm/last-generation-run | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/csn/csnm/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/csn/csnm/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/cts/transportchecks |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/cts/transportrequests | Content-Type application/vnd.sap.adt.transportorganizer.v1+xml |  |  | application/vnd.sap.adt.transportorganizertree.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/cts/transportrequests/facets |  |  |  | application/vnd.sap.adt.transportorganizer.facets.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/cts/transportrequests/reference |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/cts/transportrequests/searchconfiguration/configurations |  |  |  | application/vnd.sap.adt.configurations.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/cts/transportrequests/searchconfiguration/metadata |  |  |  | application/vnd.sap.adt.configuration.metadata.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/cts/transports | Content-Type application/vnd.sap.as+xml;charset=utf-8;dataname=com.sap.adt.transport.service.checkData; Content-Type application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.CreateCorrectionRequest; Content-Type application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.CreateCorrectionRequest.v1; Content-Type application/vnd.sap.adt.transports.search.v1+xml |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/customfields/objects |  |  |  |  |  |  |
| GET /sap/bc/adt/customfields/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/customfields/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/customfields/objects/source/formatter | Content-Type application/json |  |  |  |  |  |
| GET /sap/bc/adt/customfields/objects/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/databrowser/objects | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/databrowser/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/databrowser/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/databrowser/objects/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/databrowser/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/datacategories/objects |  |  |  |  |  |  |
| GET /sap/bc/adt/datacategories/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/datacategories/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/datacategories/objects/source/formatter | Content-Type application/json |  |  |  |  |  |
| GET /sap/bc/adt/datacategories/objects/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/datapreview/amdp |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/datapreview/amdpdebugger |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/datapreview/cds |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionDataPreviewGeneral); Content-Type: no body) |
| GET /sap/bc/adt/datapreview/ddic |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionDataPreviewGeneral); Content-Type: no body) |
| GET /sap/bc/adt/datapreview/freestyle |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/dataproviders |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/cds/annotation/definitions |  |  |  | application/vnd.sap.adt.cds.annotation.definitions.v2+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/cds/annotation/elementinfo |  |  |  | application/vnd.sap.adt.elementinfo+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/cds/annotation/objref/proposal |  |  |  | application/vnd.sap.adt.codeCompletionProposals.v4+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/codecompletion |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dataelements | Content-Type application/vnd.sap.adt.dataelements.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dataelements/docu/status |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dataelements/docu/supplements |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dataelements/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/db/indexes | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | accept (Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body) |
| GET /sap/bc/adt/ddic/db/indexes/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/db/indexes/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/db/indexes/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/db/indexes/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/db/settings | Content-Type application/vnd.sap.adt.table.settings.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/db/settings/dataClass/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/db/settings/keyFields/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/db/settings/size/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/db/settings/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dbprocedureproxies |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/ddl/activeobject |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/createstatements |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/ddicrepositoryaccess |  |  |  | application/vnd.sap.adt.ddl.objectReferences.v2+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/dependencies/graphdata |  |  |  |  |  | unknown (Accept: unknown (400 NoDependencyGraphDataCalculationPossible); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/elementinfo | Content-Type text/plain |  |  | application/vnd.sap.adt.elementinfo+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/elementinfos |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/elementmappings |  |  |  | application/vnd.sap.adt.ddl.elementMappingsStrategies+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/elementmappings/strategies |  |  |  | application/vnd.sap.adt.ddl.elementMappingsStrategies+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/formatter/configurations |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/formatter/identifiers | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/migration/bgruns | Content-Type application/vnd.sap.adt.ddl.migrationobjects.v2+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/migration/logs |  |  |  | application/vnd.sap.adt.ddl.migrationlog.v3+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/migration/validation | Content-Type application/vnd.sap.adt.ddl.migrationobjects.v2+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/parser |  |  |  | application/vnd.sap.adt.ddl.ddlParserInfo.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/relatedObjects |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/sources |  |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/sources/validation |  |  |  | application/vnd.sap.adt.ddlSource+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddl/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddla/formatter/identifiers | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddla/parser/info |  |  |  | application/vnd.sap.adt.ddla.parserinfo.v2+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddla/repositoryaccess |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddla/sources |  |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddla/sources/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddla/textlengthcalc |  |  |  | application/vnd.sap.adt.ddla.textlengthcalc.v1+text |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddlx/annotation/chain |  |  |  | application/vnd.sap.adt.ddlx.annotation.chain.v2+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddlx/formatter/identifiers | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddlx/parser/info |  |  |  | application/vnd.sap.adt.ddlx.parserinfo.v3+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddlx/sources | Content-Type application/vnd.sap.adt.ddic.ddlx.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddlx/sources/$metadata |  |  |  | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/ddlx/sources/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/desd | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/desd/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/desd/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/desd/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/desd/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/domains | Content-Type application/vnd.sap.adt.domains.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/domains/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dras/sources | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dras/sources/$codecompletion/insertion |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dras/sources/$codecompletion/proposal |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dras/sources/$elementinfo |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dras/sources/$metadata |  |  |  | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dras/sources/$navigation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dras/sources/$outlineconfiguration |  |  |  | application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dras/sources/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drty/sources | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drty/sources/$codecompletion/insertion |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drty/sources/$codecompletion/proposal |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drty/sources/$elementinfo |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drty/sources/$formatter | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drty/sources/$metadata |  |  |  | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drty/sources/$navigation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drty/sources/$occurrencemarkers |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drty/sources/$outlineconfiguration |  |  |  | application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drty/sources/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/drul/parser/info |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/drul/sources |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/drul/sources/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfd/sources/$codecompletion/insertion |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfd/sources/$codecompletion/proposal |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfd/sources/$elementinfo |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfd/sources/$formatter | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfd/sources/$metadata |  |  |  | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfd/sources/$navigation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfd/sources/$occurrencemarkers |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfd/sources/$outlineconfiguration |  |  |  | application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfd/sources/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfi | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfi/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfi/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfi/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dsfi/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dtdc/createstatements |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dtdc/parser/info |  |  |  | application/vnd.sap.adt.dtdc.parserinfo.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dtdc/sources | Content-Type application/vnd.sap.adt.ddic.dtdc.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dtdc/sources/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dteb/codecompletion/proposal |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dteb/elementinfo |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dteb/formatter | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dteb/navigation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dteb/parser/info |  |  |  | application/vnd.sap.adt.dteb.parserinfo.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dteb/sources | Content-Type application/vnd.sap.adt.ddic.dteb.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dteb/sources/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dtix/sources |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtix/sources/$codecompletion/insertion |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtix/sources/$codecompletion/proposal |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtix/sources/$elementinfo |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtix/sources/$formatter | Content-Type text/plain |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtix/sources/$metadata |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtix/sources/$navigation |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtix/sources/$occurrencemarkers |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtix/sources/$outlineconfiguration |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtix/sources/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/createstatements |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| GET /sap/bc/adt/ddic/dtsc/sources |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/sources/$codecompletion/insertion |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/sources/$codecompletion/proposal |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/sources/$elementinfo |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/sources/$formatter | Content-Type text/plain |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/sources/$metadata |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/sources/$navigation |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/sources/$occurrencemarkers |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/sources/$outlineconfiguration |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/sources/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/elementinfo |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/ddic/extensionindexes | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | accept (Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body) |
| GET /sap/bc/adt/ddic/extensionindexes/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/extensionindexes/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/extensionindexes/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/extensionindexes/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/lockobjects/adjustment |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/lockobjects/lockmodes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/lockobjects/sources | Content-Type application/vnd.sap.adt.lockobjects.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/lockobjects/sources/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/lockobjects/tables |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/lockobjects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/logs/activationgraph |  |  |  | application/vnd.sap.adt.ddic.acivationLog.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/srvd/elementinfo |  |  |  |  |  | unknown (Accept: unknown (500 dump or router: The ASSERT condition was violated. (Message 20261028150230appserver SAPUSER01100)); Content-Type: no body) |
| GET /sap/bc/adt/ddic/srvd/formatter/identifiers | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/srvd/parser/info |  |  |  | application/vnd.sap.adt.srvd.parserinfo.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/srvd/services |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/srvd/sourceTypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/srvd/sources | Content-Type application/vnd.sap.adt.ddic.srvd.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/srvd/sources/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/structures | Content-Type application/vnd.sap.adt.structures.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/structures/parser/info | Content-Type application/vnd.sap.adt.tabl.parserinfo.v1+xml |  |  | application/vnd.sap.adt.tabl.parserinfo.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/structures/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/tables | Content-Type application/vnd.sap.adt.tables.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/tables/parser/info | Content-Type application/vnd.sap.adt.tabl.parserinfo.v1+xml |  |  | application/vnd.sap.adt.tabl.parserinfo.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ddic/tables/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/tabletypes | Content-Type application/vnd.sap.adt.tabletype.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ddic/tabletypes/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/typegroups |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/ddic/typegroups/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ddic/views |  |  |  |  |  |  |
| GET /sap/bc/adt/ddic/views/$validation |  |  |  |  |  |  |
| GET /sap/bc/adt/debugger |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/actions |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/batch |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/breakpoints |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/breakpoints/conditions |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/breakpoints/messagetypes |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/breakpoints/statements |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/breakpoints/validations |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/breakpoints/vit |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/listeners |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/memorysizes |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/stack |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/systemareas |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/variables |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/debugger/watchpoints |  |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| GET /sap/bc/adt/deletion/check | Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/deletion/delete | Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/destructionobjects/objects | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/destructionobjects/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/destructionobjects/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/destructionobjects/objects/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/destructionobjects/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/abap/langu |  |  |  | application/vnd.sap.adt.docu.v1+html |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/docu/dcl/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/ddl/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/ddla/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/ddlx/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/dras/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/drty/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/drul/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/dsfd/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/dtdc/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/dteb/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/docu/dtsc/langu |  |  |  |  |  | unknown (Accept: unknown (500 dump or router: Creation of handler class failed (class not found)); Content-Type: no body) |
| GET /sap/bc/adt/docu/srvd/langu |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/documentation/ktd/documents | Content-Type application/vnd.sap.adt.sktdv2+xml; Content-Type text/html; Content-Type application/json; Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/documentation/ktd/documents/$codecompletion/proposal |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/documentation/ktd/documents/codecompletion/links |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/documentation/ktd/documents/codecompletion/templates |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/documentation/ktd/documents/preview |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/documentation/ktd/documents/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/dummygroup/wbttt1a |  |  |  |  |  |  |
| GET /sap/bc/adt/dummygroup/wbttt1a/$metadata |  |  |  |  |  |  |
| GET /sap/bc/adt/dummygroup/wbttt1a/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/dummygroup/wbttt1a/white/yellow |  |  |  |  |  |  |
| GET /sap/bc/adt/dummygroup/wbttt2a |  |  |  |  |  |  |
| GET /sap/bc/adt/dummygroup/wbttt2a/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/dynpros/functiongroups | Content-Type application/vnd.sap.adt.dynpro.v1+xml |  |  |  |  |  |
| GET /sap/bc/adt/dynpros/programs | Content-Type application/vnd.sap.adt.dynpro.v1+xml |  |  |  |  |  |
| GET /sap/bc/adt/emailtemplates/templates | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/emailtemplates/templates/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/emailtemplates/templates/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/emailtemplates/templates/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/emailtemplates/templates/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/enhancements/enhoxh |  |  |  |  |  |  |
| GET /sap/bc/adt/enhancements/enhoxh/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/enhancements/enhoxhb | Content-Type application/vnd.sap.adt.enh.enhoxhb.v4+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/enhancements/enhoxhb/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/enhancements/enhoxhh |  |  |  |  |  |  |
| GET /sap/bc/adt/enhancements/enhoxhh/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/enhancements/enhsxs |  |  |  |  |  |  |
| GET /sap/bc/adt/enhancements/enhsxs/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/enhancements/enhsxsb | Content-Type application/vnd.sap.adt.enh.enhs.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/enhancements/enhsxsb/search |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/enhancements/enhsxsb/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/externaltools/bas/configurations |  |  |  | application/vnd.sap.adt.configurations.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/externaltools/bas/metadata |  |  |  | application/vnd.sap.adt.configuration.metadata.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/feeds |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/feeds/variants |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/filestore/ui5-bsp/deploy-storage |  |  |  |  |  |  |
| GET /sap/bc/adt/filestore/ui5-bsp/objects |  |  |  |  |  |  |
| GET /sap/bc/adt/filestore/ui5-bsp/ui5-rt-version |  |  |  |  |  |  |
| GET /sap/bc/adt/fiori/uiad | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uiad/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uiad/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uiad/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uiad/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uipgtyp | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uipgtyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uipgtyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uipgtyp/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uipgtyp/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uisttop | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uisttop/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uisttop/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uisttop/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/fiori/uisttop/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/formobjects/sfpf5f | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/formobjects/sfpf5f/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/formobjects/sfpf5f/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/formobjects/sfpf5f/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/formobjects/sfpf5f/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/fpm/creationtools |  |  |  |  |  |  |
| GET /sap/bc/adt/functions/groups | Content-Type application/vnd.sap.adt.functions.groups.v3+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/functions/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/hota/hotahdi |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahdi/hota/checknamespace |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahdi/hota/checkout/hdiwizard |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahdi/hota/containername |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahdi/hota/featurecheck |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahdi/hoto/addlprops |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahdi/hoto/checkin |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahdi/hoto/checkout |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahdi/hoto/transportdetails |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahdi/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahto |  |  |  |  |  |  |
| GET /sap/bc/adt/hota/hotahto/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/ideactions/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ideactions/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ideactions/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ideactions/objects/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ideactions/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ideactions/runtime | Content-Type application/vnd.sap.adt.ideactions.runtime.input.v1+xml |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ilmobjects/objects | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ilmobjects/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ilmobjects/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/ilmobjects/objects/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/ilmobjects/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/includes/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/islm/intelligentmodel | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/islm/intelligentmodel/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/islm/intelligentmodel/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/islm/intelligentmodel/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/islm/intelligentmodel/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/islm/intelligentscenario | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/islm/intelligentscenario/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/islm/intelligentscenario/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/islm/intelligentscenario/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/islm/intelligentscenario/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/lifecycle_management/ftglaf |  |  |  |  |  |  |
| GET /sap/bc/adt/lifecycle_management/ftglaf/releasestatus/values |  |  |  |  |  |  |
| GET /sap/bc/adt/lifecycle_management/ftglaf/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/messageclass |  |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/messageclass/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/metricproviders | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/metricproviders/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/metricproviders/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/metricproviders/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/metricproviders/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/navigation/indexupdate |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/navigation/target | Content-Type application/xml; Content-Type semantic.navigation.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/nhi/dbprocedures |  |  |  |  |  |  |
| GET /sap/bc/adt/nhi/deliveryunitproxies |  |  |  |  |  |  |
| GET /sap/bc/adt/nhi/deliveryunits |  |  |  |  |  |  |
| GET /sap/bc/adt/nhi/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/nhi/vendors |  |  |  |  |  |  |
| GET /sap/bc/adt/nhi/views |  |  |  |  |  |  |
| GET /sap/bc/adt/notebasic/assignments | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/notebasic/assignments/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/notebasic/assignments/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/notebasic/assignments/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/notebasic/assignments/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/notebasic/notetypes | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/notebasic/notetypes/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/notebasic/notetypes/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/notebasic/notetypes/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/notebasic/notetypes/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/numberranges/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/numberranges/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/numberranges/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/numberranges/objects/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/numberranges/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/objectrelations | Content-Type application/vnd.sap.adt.objectrelations.request.sets.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/objectrelations/components | Content-Type application/vnd.sap.adt.objectrelations.request.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/objectrelations/network | Content-Type application/vnd.sap.adt.objectrelations.request.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/objectrelations/references | Content-Type application/vnd.sap.adt.objectrelations.request.references.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/objtype_admin/sval |  |  |  |  |  |  |
| GET /sap/bc/adt/objtype_admin/sval/assist/trscopes |  |  |  |  |  |  |
| GET /sap/bc/adt/objtype_admin/sval/assist/wbobjlist |  |  |  |  |  |  |
| GET /sap/bc/adt/objtype_admin/sval/assist/wbscopes |  |  |  |  |  |  |
| GET /sap/bc/adt/objtype_admin/sval/configurations |  |  |  |  |  |  |
| GET /sap/bc/adt/objtype_admin/sval/metadata |  |  |  |  |  |  |
| GET /sap/bc/adt/objtype_admin/sval/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/objtype_admin/wgrp |  |  |  |  |  |  |
| GET /sap/bc/adt/objtype_admin/wgrp/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/oo/classes | Content-Type application/vnd.sap.adt.oo.classes.v4+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/oo/classrun |  |  |  |  |  |  |
| GET /sap/bc/adt/oo/interfaces | Content-Type application/vnd.sap.adt.oo.interfaces.v5+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/oo/validation/objectname |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/packages | Content-Type application/vnd.sap.adt.packages.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/packages/$constraints | Content-Type application/softwareComponent.v1+json; Content-Type application/packageConstraints.v1+json |  |  |  |  | unknown (Accept: unknown (406 generic (T100 037): not necessarily the Accept); Content-Type: no body) |
| GET /sap/bc/adt/packages/settings | Content-Type application/vnd.sap.adt.packages.settings.v2+xml |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/packages/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/predefinedfields/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/predefinedfields/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/predefinedfields/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/predefinedfields/objects/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/predefinedfields/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/programs/includes |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/programs/programrun |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/programs/programs |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/programs/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/quickfixes/evaluation | Content-Type application/vnd.sap.adt.quickfixes.evaluation+xml;version=1.0.0 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/refactoring/changepackage |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| GET /sap/bc/adt/refactorings |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/favorites/lists |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/generators |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/abaplanguageversions |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/elementinfo |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/executableobjecttypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/fullnamemapping |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/metadata |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/objectproperties/transports |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/objectproperties/values |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/objectsets/metrics |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/objectsets/references |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/objecttypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/properties/values |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/releasestates |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/search |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/status |  |  |  | application/vnd.sap.adt.ris.status.v1+asjson |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/textsearch |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/textsearch/objectnames |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/textsearch/objecttypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/usageReferences |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/usageSnippets |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/virtualfolders | Content-Type application/vnd.sap.adt.repository.virtualfolders.result.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/virtualfolders/contents | Content-Type application/vnd.sap.adt.repository.virtualfolders.result.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/virtualfolders/facets |  |  |  | application/vnd.sap.adt.facets.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/virtualfolders/facets/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/informationsystem/whereused |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/nodepath | Content-Type application/tdevc.v1+csv |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/nodestructure |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/objectstructure |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/repository/proxyurimappings |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/repository/typestructure |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/runtime/memory/snapshots |  |  |  | application/vnd.sap.adt.runtime.memory.snapshots.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/runtime/traces/abaptraces |  |  |  |  |  | accept (Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body) |
| GET /sap/bc/adt/runtime/traces/abaptraces/objecttypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/runtime/traces/abaptraces/parameters |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/runtime/traces/abaptraces/processtypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/runtime/traces/abaptraces/requests |  |  |  |  |  | accept (Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body) |
| GET /sap/bc/adt/runtime/workprocesses |  |  |  |  |  |  |
| GET /sap/bc/adt/sadl/gw/annopush/finalize | Content-Type application/xml |  |  |  |  |  |
| GET /sap/bc/adt/sadl/gw/annopush/prepare | Content-Type application/xml |  |  |  |  |  |
| GET /sap/bc/adt/sadl/gw/annopush/push | Content-Type application/xml |  |  |  |  |  |
| GET /sap/bc/adt/sadl/gw/annopush/validate | Content-Type application/xml; Content-Type application/xml |  |  |  |  |  |
| GET /sap/bc/adt/sadl/gw/mde | Content-Type application/xml |  |  |  |  |  |
| GET /sap/bc/adt/schema_definitions/amsdtyp |  |  |  |  |  |  |
| GET /sap/bc/adt/schema_definitions/amsdtyp/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/security/reentranceticket |  |  |  |  |  | unknown (Accept: unknown (skipped: answers a logon ticket, a secret the corpus must not hold); Content-Type: unknown (skipped: answers a logon ticket, a secret the corpus must not hold)) |
| GET /sap/bc/adt/sfw/featuretoggles |  |  |  |  |  |  |
| GET /sap/bc/adt/sfw/featuretoggles/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/sfw/featuretoggles/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/sfw/featuretoggles/attributes/attributeKeys |  |  |  |  |  |  |
| GET /sap/bc/adt/sfw/featuretoggles/attributes/attributeValues |  |  |  |  |  |  |
| GET /sap/bc/adt/sfw/featuretoggles/objects/types |  |  |  |  |  |  |
| GET /sap/bc/adt/sfw/featuretoggles/referenceProduct/values |  |  |  |  |  |  |
| GET /sap/bc/adt/sfw/featuretoggles/sfw/featuretoggles |  |  |  |  |  |  |
| GET /sap/bc/adt/sfw/featuretoggles/source/formatter | Content-Type application/json |  |  |  |  |  |
| GET /sap/bc/adt/sfw/featuretoggles/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/sidebyside/configuration |  |  |  |  |  |  |
| GET /sap/bc/adt/sqlm/data |  |  |  |  |  |  |
| GET /sap/bc/adt/st05/trace/directory |  |  |  | application/vnd.sap.adt.perf.trace.directory.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/st05/trace/state |  |  |  | application/vnd.sap.adt.perf.trace.state.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/swc/relations | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/swc/relations/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/swc/relations/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/swc/relations/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/swc/relations/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/system/clients |  |  |  |  |  |  |
| GET /sap/bc/adt/system/components |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/system/information |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/system/landscape/servers |  |  |  |  |  |  |
| GET /sap/bc/adt/system/users |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/testcodegen/dependencies/doubledata | Content-Type application/vnd.sap.adt.oo.cds.codgen.v1+xml |  |  |  |  |  |
| GET /sap/bc/adt/textelements/classes | Content-Type application/vnd.sap.adt.textelements.v1+xml |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| GET /sap/bc/adt/textelements/functiongroups | Content-Type application/vnd.sap.adt.textelements.v1+xml |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| GET /sap/bc/adt/textelements/programs | Content-Type application/vnd.sap.adt.textelements.v1+xml |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| GET /sap/bc/adt/transportobject/objects |  |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/transportobject/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/transportobject/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/transportobject/objects/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/transportobject/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/uc_object_type_group/samc |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/samc/activity/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/samc/messagetype/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/samc/progtype/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/samc/scope/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/samc/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/samc/virusscan/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/sapc |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/sapc/classproperties/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/sapc/connectiontypes/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/sapc/protocoltypes/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/sapc/service_path/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/sapc/superclass/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/sapc/testurl/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/sapc/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/sapc/virusscanin/values |  |  |  |  |  |  |
| GET /sap/bc/adt/uc_object_type_group/sapc/virusscanout/values |  |  |  |  |  |  |
| GET /sap/bc/adt/ucon/httpservices | Content-Type application/vnd.sap.adt.uconn.http.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/ucon/httpservices/HandlerClassesUri |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| GET /sap/bc/adt/ucon/httpservices/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/urifragmentmappings |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/vit/urimapper |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/adt/vit/wb/object_type |  |  |  |  |  |  |
| GET /sap/bc/adt/wbobj/apictyp |  |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: no body) |
| GET /sap/bc/adt/wbobj/apictyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/wbobj/apictyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  | accept (Accept: checked (406); Content-Type: no body) |
| GET /sap/bc/adt/wbobj/apictyp/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/wbobj/apictyp/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| GET /sap/bc/adt/wdy/abapsource/codecompletion/elementinfo |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/abapsource/codecompletion/insertion |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/abapsource/codecompletion/proposal |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/abapsource/prettyprinter |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/applicationconfig |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/applications |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/codetemplate |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/componentconfig |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/componentcontrollers |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/componentinterfaces |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/components |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/customcontrollers |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/fpmadaptables |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/fpmapplications |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/fpmcomponents |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/fpmfloorplans |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/fpmguibbs |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/fpmruibbs |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/interfacecontrollers |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/interfaceviews |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/launchconfiguration |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/navigation/target |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/search |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/viewdesigner/uielementlibrary |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/views |  |  |  |  |  |  |
| GET /sap/bc/adt/wdy/windows |  |  |  |  |  |  |
| GET /sap/bc/adt/wmpc/applications |  |  |  |  |  |  |
| GET /sap/bc/adt/wmpc/applications/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/wmpc/applications/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| GET /sap/bc/adt/wmpc/applications/source/formatter | Content-Type application/json |  |  |  |  |  |
| GET /sap/bc/adt/wmpc/applications/validation |  |  |  |  |  |  |
| GET /sap/bc/adt/xslt/transformations | Content-Type application/vnd.sap.adt.transformations+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body) |
| GET /sap/bc/esproxy/activation |  |  |  |  |  |  |
| GET /sap/bc/esproxy/consumerfactories |  |  |  |  |  |  |
| GET /sap/bc/esproxy/consumermappings |  |  |  |  |  |  |
| GET /sap/bc/esproxy/contractimplementations |  |  |  |  |  |  |
| GET /sap/bc/esproxy/contracts |  |  |  |  |  |  |
| GET /sap/bc/esproxy/datatypes |  |  |  |  |  |  |
| GET /sap/bc/esproxy/esrscv |  |  |  |  |  |  |
| GET /sap/bc/esproxy/esrsearch |  |  |  |  |  |  |
| GET /sap/bc/esproxy/integrationscenariodefns |  |  |  |  |  |  |
| GET /sap/bc/esproxy/messagetypes |  |  |  |  |  |  |
| GET /sap/bc/esproxy/operationmappings |  |  |  |  |  |  |
| GET /sap/bc/esproxy/proxysearch |  |  |  |  |  |  |
| GET /sap/bc/esproxy/rfcconsumers |  |  |  |  |  |  |
| GET /sap/bc/esproxy/search |  |  |  |  |  |  |
| GET /sap/bc/esproxy/semanticcontracts |  |  |  |  |  |  |
| GET /sap/bc/esproxy/serviceconsumers |  |  |  |  |  |  |
| GET /sap/bc/esproxy/serviceproviders |  |  |  |  |  |  |
| GET /sap/bc/esproxy/soamanager |  |  |  |  |  |  |
| GET /sap/bc/esproxy/srsearch |  |  |  |  |  |  |
| GET /sap/bc/esproxy/validate |  |  |  |  |  |  |
| GET https://abap-cloud.example/sap/bc/adt |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| POST /sap/bc/adt/abapdaemons/applications/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/abapdaemons/applications/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/abapdaemons/applications/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: unreadable 403); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable 403)) |
| POST /sap/bc/adt/abapgit/externalrepoinfo | Content-Type application/abapgit.adt.repo.info.ext.request.v1+xml; Content-Type application/abapgit.adt.repo.info.ext.request.v2+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/abapgit/repos | Content-Type application/abapgit.adt.repo.v1+xml; Content-Type application/abapgit.adt.repo.v2+xml; Content-Type application/abapgit.adt.repo.v3+xml; Content-Type application/abapgit.adt.repo.v4+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: unreadable 405); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable 405)) |
| POST /sap/bc/adt/abapsource/abapdoc/exportjobs | Content-Type application/vnd.sap.adt.abapsource.abapdoc.exportjobs.v1+xml |  |  | application/vnd.sap.adt.abapsource.abapdoc.exportresults.v1+zip |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/abapsource/codecompletion/elementinfo | Content-Type text/plain |  |  | application/vnd.sap.adt.elementinfo+xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/abapsource/prettyprinter/settings | Content-Type application/vnd.sap.adt.ppsettings.v2+xml; Content-Type application/vnd.sap.adt.ppsettings.v3+xml; Content-Type application/vnd.sap.adt.ppsettings.v4+xml; Content-Type application/vnd.sap.adt.ppsettings.v5+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/abapsource/typehierarchy | Content-Type application/vnd.sap.adt.typehierachy.result.v1+xml |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/abapunit/explain | Content-Type application/vnd.sap.adt.aunit.explain.request.v1+asjson |  |  | application/vnd.sap.adt.aunit.explain.result.v1+asjson |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/abapunit/testruns | Content-Type application/vnd.sap.adt.abapunit.testruns.config.v1+xml; Content-Type application/vnd.sap.adt.abapunit.testruns.config.v2+xml; Content-Type application/vnd.sap.adt.abapunit.testruns.config.v3+xml; Content-Type application/vnd.sap.adt.abapunit.testruns.config.v4+xml; Content-Type application/xml |  |  | application/vnd.sap.adt.abapunit.testruns.result.v1+xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/abapunit/testruns/evaluation | Content-Type application/vnd.sap.adt.abapunit.testruns.evaluation.config.v1+xml; Content-Type application/vnd.sap.adt.abapunit.testruns.evaluation.config.v2+xml; Content-Type application/vnd.sap.adt.abapunit.testruns.evaluation.config.v3+xml |  |  | application/vnd.sap.adt.abapunit.testruns.evaluation.result.v1+xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/acm/dcl/sources | Content-Type application/vnd.sap.adt.dclSource+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/activation/inactiveobjects | Content-Type application/vnd.sap.adt.inactivectsobjects.v2+xml; Content-Type application/vnd.sap.adt.inactivectsobjects.v1+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| POST /sap/bc/adt/activation/runs | Content-Type application/vnd.sap.adt.activationrun.v1+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| POST /sap/bc/adt/aif/aifdtyp | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/aif/aifdtyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aif/aifdtyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aif/aifdtyp/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/aif/aifityp | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/aif/aifityp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aif/aifityp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aif/aifityp/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/aif/aifntyp | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/aif/aifntyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aif/aifntyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aif/aifntyp/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/aif/aifrtyp | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/aif/aifrtyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aif/aifrtyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aif/aifrtyp/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/aif/check/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/aif/check/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/aif/check/source/formatter | Content-Type application/json |  |  |  |  |  |
| POST /sap/bc/adt/aif/fixvalue/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/aif/fixvalue/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/aif/fixvalue/source/formatter | Content-Type application/json |  |  |  |  |  |
| POST /sap/bc/adt/amdp/debugger/main | Content-Type application/vnd.sap.adt.amdp.dbg.main.v4+xml |  |  |  |  | unknown (Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling))) |
| POST /sap/bc/adt/ana/aqd | Content-Type application/vnd.sap.adt.ddlSource+xml |  |  |  |  |  |
| POST /sap/bc/adt/analytics/reviewbooklets | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/analytics/reviewbooklets/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/analytics/reviewbooklets/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/analytics/reviewbooklets/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/apack/gitmanifests | Content-Type application/apack.adt.gitmanifest.request.v1+xml |  |  |  |  | accept (Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/applicationjob/catalogs | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/applicationjob/catalogs/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/applicationjob/catalogs/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/applicationjob/catalogs/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/applicationjob/templates | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/applicationjob/templates/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/applicationjob/templates/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/applicationjob/templates/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/applicationlog/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/applicationlog/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/applicationlog/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/applicationlog/objects/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/applicationobjects/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/applicationobjects/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/applicationobjects/objects/source/formatter | Content-Type application/json |  |  |  |  |  |
| POST /sap/bc/adt/aps/cloud/com/sco1 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/com/sco1}sco1' System expected the element '{http://www.sap.com/com/sco1}sco1' 00 001 System expected the element '{http://www.sap.com/c om/sco1}sco1'); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/cloud/com/sco1/actvt/detail | Content-Type application/vnd.sap.adt.aps.common.actvtdetail+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/com/sco1/auth/detail | Content-Type application/vnd.sap.adt.aps.common.authdetail+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/com/sco1/inboundService/detail | Content-Type application/vnd.sap.adt.com.ibsdetail+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/com/sco1/outboundService/detail | Content-Type application/vnd.sap.adt.com.obsdetail+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/com/sco2 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/com/sco2}sco2' System expected the element '{http://www.sap.com/com/sco2}sco2' 00 001 System expected the element '{http://www.sap.com/c om/sco2}sco2'); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/cloud/com/sco3 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/com/sco3}sco3' System expected the element '{http://www.sap.com/com/sco3}sco3' 00 001 System expected the element '{http://www.sap.com/c om/sco3}sco3'); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/cloud/iam/sia1 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sia1}sia1' System expected the element '{http://www.sap.com/iam/sia1}sia1' 00 001 System expected the element '{http://www.sap.com/i am/sia1}sia1'); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/cloud/iam/sia1/restrictionType/details | Content-Type application/vnd.sap.adt.common.restrictiontypedetails+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/aps/cloud/iam/sia1/restrictionType/valueHelp | Content-Type application/vnd.sap.adt.aps.common.restrictionsvh+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/aps/cloud/iam/sia2 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/aps/cloud/iam/sia2/authobjectextension/details | Content-Type application/vnd.sap.adt.iam.sia2authfielddetails+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/aps/cloud/iam/sia2/restrictionfield/details | Content-Type application/vnd.sap.adt.iam.sia2authfielddetails+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/aps/cloud/iam/sia5 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sia6}sia6' System expected the element '{http://www.sap.com/iam/sia6}sia6' 00 001 System expected the element '{http://www.sap.com/i am/sia6}sia6'); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/actvt/detail | Content-Type application/vnd.sap.adt.aps.common.actvtdetail+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/app/status | Content-Type application/vnd.sap.adt.iam.status+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/appcreationtype/values | Content-Type application/vnd.sap.adt.aps.iam.appcreationtypes+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/auth/detail | Content-Type application/vnd.sap.adt.aps.common.authdetail+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/publish | Content-Type application/vnd.sap.adt.iam.publishing+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/details | Content-Type application/vnd.sap.adt.common.restrictiontypedetails+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/proposal | Content-Type application/vnd.sap.adt.sia6.restrictiontypeproposal+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/valueHelp | Content-Type application/vnd.sap.adt.aps.common.restrictionsvh+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/service/detail | Content-Type application/vnd.sap.adt.iam.servicedetail+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/tcode/detail | Content-Type application/vnd.sap.adt.iam.tcodedetail+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/sia6/uiad/detail | Content-Type application/vnd.sap.adt.iam.uiaddetail+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/sia7 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sia7}sia7' System expected the element '{http://www.sap.com/iam/sia7}sia7' 00 001 System expected the element '{http://www.sap.com/i am/sia7}sia7'); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/cloud/iam/sia8 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sia8}sia8' System expected the element '{http://www.sap.com/iam/sia8}sia8' 00 001 System expected the element '{http://www.sap.com/i am/sia8}sia8'); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/cloud/iam/sia9 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sia9}sia9' System expected the element '{http://www.sap.com/iam/sia9}sia9' 00 001 System expected the element '{http://www.sap.com/i am/sia9}sia9'); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/cloud/iam/siad | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/cloud/iam/siad/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/siad/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/cloud/iam/siad/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/com/sod1 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/aps/com/sod2 | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/aps/iam/auth | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/aps/iam/auth/authcolsearchhelp | Content-Type application/vnd.sap.adt.auth.authcolsearchhelp+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/auth/authdtelallowed | Content-Type application/vnd.sap.adt.auth.authdtelallowed+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/auth/objfldsearchhelp | Content-Type application/vnd.sap.adt.auth.objfldsearchhelp+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/suco | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/iam/suco/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/suco/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/suco/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/iam/sush | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sush}sush' System expected the element '{http://www.sap.com/iam/sush}sush' 00 001 System expected the element '{http://www.sap.com/i am/sush}sush'); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/iam/sush/su22authobject/detail | Content-Type application/vnd.sap.adt.sush.authobjdetail+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/sush/su22newobject/values | Content-Type application/vnd.sap.adt.sush.newobjectlist+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/sush/sush/synchronize | Content-Type application/vnd.sap.adt.sush.synchronize+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/susi | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/iam/susi/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/susi/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/susi/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/iam/suso | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/suso}suso' System expected the element '{http://www.sap.com/iam/suso}suso' 00 001 System expected the element '{http://www.sap.com/i am/suso}suso'); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/iam/suso/abaplanguageversion | Content-Type application/vnd.sap.adt.suso.abaplanguageversion+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/suso/activity/details | Content-Type application/vnd.sap.adt.suso.activitydetails+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/suso/activity/listvalues | Content-Type application/vnd.sap.adt.suso.activitylist+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/suso/objectclass/listvalues | Content-Type application/vnd.sap.adt.suso.objectclasslist+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/suso/searchhelp | Content-Type application/vnd.sap.adt.suso.searchhelp+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/suso/susobasisobject | Content-Type application/vnd.sap.adt.suso.susobasisobject+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/tran | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/aps/iam/tran/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/tran/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/aps/iam/tran/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/archivingobjects/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/archivingobjects/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/archivingobjects/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/archivingobjects/objects/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/atc/autoqf/worklist | Content-Type application/vnd.sap.adt.atc.objectreferences.v1+xml; Content-Type application/vnd.sap.adt.atc.autoqf.proposal.v1+xml; Content-Type application/vnd.sap.adt.atc.autoqf.selection.v1+xml; Content-Type application/vnd.sap.adt.atc.genericrefactoring.v1+xml; Content-Type application/vnd.sap.adt.atc.autoqf.implement.v1+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/atc/checkcategories | Content-Type application/vnd.sap.adt.chkcv1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/atc/checkexemptions | Content-Type application/vnd.sap.adt.chkev2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/atc/checks | Content-Type application/vnd.sap.adt.chkov1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/atc/checkvariants | Content-Type application/vnd.sap.adt.chkvv4+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/atc/exemptions/atcexemption | Content-Type application/vnd.sap.adt.chkev1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/atc/remarks | Content-Type application/vnd.sap.adt.atc.remarks.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ato/notifications | Content-Type application/vnd.sap.adt.ato.notification.v1+xml; Content-Type application/vnd.sap.adt.ato.notification.v1+json |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/bct/scp1bcs | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/bct/scp1bcs/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/bct/scp1bcs/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/bct/scp1bcs/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/bct/smbctyp | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/bct/smbctyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/bct/smbctyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/bct/smbctyp/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/bgqc/bgprocessingcontexts | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/bgqc/bgprocessingcontexts/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/bgqc/bgprocessingcontexts/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/bgqc/bgprocessingcontexts/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/bo/behaviordefinitions | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/bo/behaviordefinitions/parser/info | Content-Type application/vnd.sap.adt.bdef.parserinfo.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/bo/behaviordefinitions/source/formatter | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (400 ExceptionResourceBadRequest); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/businessobjects/nontnot | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/businessobjects/nontnot/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessobjects/nontnot/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessobjects/nontnot/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/businessobjects/rontrot | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/businessobjects/rontrot/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/businessobjects/rontrot/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/businessobjects/rontrot/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/businessservices/bindings | Content-Type application/vnd.sap.adt.businessservices.servicebinding.v2+xml; Content-Type text/html; Content-Type application/json; Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/businessservices/bindings/bindingtypes/ina1 | Content-Type application/vnd.sap.adt.businessservices.ina.v1+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/businessservices/bindings/bindingtypes/sql1 | Content-Type application/vnd.sap.adt.businessservices.sql.v1+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/businessservices/bindings/schema | Content-Type application/vnd.sap.adt.businessservices.schema.v1+json |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: unreadable 500); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable 500)) |
| POST /sap/bc/adt/businessservices/bindings/uiconfig | Content-Type application/vnd.sap.adt.businessservices.uiconfig.v1+json |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: unreadable 500); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable 500)) |
| POST /sap/bc/adt/businessservices/consmodels | Content-Type application/vnd.sap.adt.businessservices.serviceconsumptionmodel.v6+xml; Content-Type text/html; Content-Type application/json; Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/businessservices/eeecevc | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/businessservices/eeecevc/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessservices/eeecevc/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/businessservices/eeecevc/source/formatter | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/businessservices/evtbevb | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/businessservices/evtbevb/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessservices/evtbevb/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessservices/evtbevb/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/businessservices/evtoevo | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/businessservices/evtoevo/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessservices/evtoevo/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessservices/evtoevo/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/businessservices/odatav2 | Content-Type application/vnd.sap.adt.businessservices.odatav2.v3+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessservices/odatav4 | Content-Type application/vnd.sap.adt.businessservices.odatav4.v2+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessservices/servprovs | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/businessservices/servprovs/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessservices/servprovs/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/businessservices/servprovs/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/changedocuments/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/changedocuments/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/changedocuments/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/changedocuments/objects/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/classifications | Content-Type application/vnd.sap.adt.classification+xml |  |  |  | application/vnd.sap.adt.classification+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/conn/commtargets | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/conn/commtargets/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/conn/commtargets/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/conn/commtargets/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/crosstrace/activations | Content-Type application/vnd.sap.adt.crosstrace.activations.v1+xml; Content-Type application/vnd.sap.adt.crosstrace.activations.v1.b+xml |  |  |  |  | unknown (Accept: unknown (skipped: a POST here switches a trace on or schedules one, under a key the server assigns); Content-Type: unknown (skipped: a POST here switches a trace on or schedules one, under a key the server assigns)) |
| POST /sap/bc/adt/crosstrace/traces | Content-Type application/vnd.sap.adt.crosstrace.trace.full.v1+json |  |  | application/vnd.sap.adt.crosstrace.traces.v1+xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionSXTADTGeneral)) |
| POST /sap/bc/adt/csn/csnm | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/csn/csnm/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/csn/csnm/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/csn/csnm/files | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/csn/csnm/last-generation-run | Content-Type application/json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/csn/csnm/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/cts/transportrequests | Content-Type application/vnd.sap.adt.transportorganizer.v1+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| POST /sap/bc/adt/cts/transports | Content-Type application/vnd.sap.as+xml;charset=utf-8;dataname=com.sap.adt.transport.service.checkData; Content-Type application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.CreateCorrectionRequest; Content-Type application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.CreateCorrectionRequest.v1; Content-Type application/vnd.sap.adt.transports.search.v1+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionDataTypeNotFound)) |
| POST /sap/bc/adt/customfields/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/customfields/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/customfields/objects/source/formatter | Content-Type application/json |  |  |  |  |  |
| POST /sap/bc/adt/databrowser/objects | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/databrowser/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/databrowser/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/databrowser/objects/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/datacategories/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/datacategories/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/datacategories/objects/source/formatter | Content-Type application/json |  |  |  |  |  |
| POST /sap/bc/adt/ddic/dataelements | Content-Type application/vnd.sap.adt.dataelements.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/db/indexes | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/db/indexes/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ddic/db/indexes/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ddic/db/indexes/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/db/settings | Content-Type application/vnd.sap.adt.table.settings.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/ddl/elementinfo | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (400 ElementInfoBadRequest); Content-Type: unknown (400 ElementInfoBadRequest)) |
| POST /sap/bc/adt/ddic/ddl/formatter/identifiers | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (400 NoIdentifierFormattingPossible); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/ddic/ddl/migration/bgruns | Content-Type application/vnd.sap.adt.ddl.migrationobjects.v2+xml |  |  |  |  | unknown (Accept: unknown (406 generic (T100 037): not necessarily the Accept); Content-Type: unknown (406 ExceptionResourceNotAcceptable)) |
| POST /sap/bc/adt/ddic/ddl/migration/validation | Content-Type application/vnd.sap.adt.ddl.migrationobjects.v2+xml |  |  |  |  | unknown (Accept: unknown (406 generic (T100 037): not necessarily the Accept); Content-Type: unknown (406 ExceptionResourceNotAcceptable)) |
| POST /sap/bc/adt/ddic/ddl/sources | Content-Type application/vnd.sap.adt.ddlSource+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/ddla/formatter/identifiers | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (400 NoIdentifierFormattingPossible); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/ddic/ddlx/formatter/identifiers | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (400 NoIdentifierFormattingPossible); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/ddic/ddlx/sources | Content-Type application/vnd.sap.adt.ddic.ddlx.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/desd | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/desd/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ddic/desd/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ddic/desd/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/domains | Content-Type application/vnd.sap.adt.domains.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/dras/sources | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/drty/sources | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/drty/sources/$formatter | Content-Type text/plain |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/ddic/dsfd/sources | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/dsfd/sources/$formatter | Content-Type text/plain |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/ddic/dsfi | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/dsfi/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ddic/dsfi/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ddic/dsfi/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/dtdc/sources | Content-Type application/vnd.sap.adt.ddic.dtdc.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/dteb/formatter | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/ddic/dteb/sources | Content-Type application/vnd.sap.adt.ddic.dteb.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/dtix/sources/$formatter | Content-Type text/plain |  |  |  |  |  |
| POST /sap/bc/adt/ddic/dtsc/sources/$formatter | Content-Type text/plain |  |  |  |  |  |
| POST /sap/bc/adt/ddic/extensionindexes | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/extensionindexes/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ddic/extensionindexes/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ddic/extensionindexes/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/lockobjects/sources | Content-Type application/vnd.sap.adt.lockobjects.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/srvd/formatter/identifiers | Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/ddic/srvd/sources | Content-Type application/vnd.sap.adt.ddic.srvd.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/structures | Content-Type application/vnd.sap.adt.structures.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/structures/parser/info | Content-Type application/vnd.sap.adt.tabl.parserinfo.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ddic/tables | Content-Type application/vnd.sap.adt.tables.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ddic/tables/parser/info | Content-Type application/vnd.sap.adt.tabl.parserinfo.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ddic/tabletypes | Content-Type application/vnd.sap.adt.tabletype.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/deletion/check | Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/deletion/delete | Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/destructionobjects/objects | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/destructionobjects/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/destructionobjects/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/destructionobjects/objects/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/documentation/ktd/documents | Content-Type application/vnd.sap.adt.sktdv2+xml; Content-Type text/html; Content-Type application/json; Content-Type text/plain |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/dynpros/functiongroups | Content-Type application/vnd.sap.adt.dynpro.v1+xml |  |  |  |  |  |
| POST /sap/bc/adt/dynpros/programs | Content-Type application/vnd.sap.adt.dynpro.v1+xml |  |  |  |  |  |
| POST /sap/bc/adt/emailtemplates/templates | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/emailtemplates/templates/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/emailtemplates/templates/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/emailtemplates/templates/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/enhancements/enhoxhb | Content-Type application/vnd.sap.adt.enh.enhoxhb.v4+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/enhancements/enhsxsb | Content-Type application/vnd.sap.adt.enh.enhs.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/fiori/uiad | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/fiori/uiad/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/fiori/uiad/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/fiori/uiad/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/fiori/uipgtyp | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/fiori/uipgtyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/fiori/uipgtyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/fiori/uipgtyp/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/fiori/uisttop | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/fiori/uisttop/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/fiori/uisttop/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/fiori/uisttop/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/formobjects/sfpf5f | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/formobjects/sfpf5f/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/formobjects/sfpf5f/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/formobjects/sfpf5f/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/functions/groups | Content-Type application/vnd.sap.adt.functions.groups.v3+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| POST /sap/bc/adt/ideactions/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ideactions/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ideactions/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ideactions/objects/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/ideactions/runtime | Content-Type application/vnd.sap.adt.ideactions.runtime.input.v1+xml |  |  |  |  | accept (Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent)) |
| POST /sap/bc/adt/ilmobjects/objects | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/ilmobjects/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ilmobjects/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/ilmobjects/objects/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/islm/intelligentmodel | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/islm/intelligentmodel/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/islm/intelligentmodel/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/islm/intelligentmodel/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/islm/intelligentscenario | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/islm/intelligentscenario/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/islm/intelligentscenario/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/islm/intelligentscenario/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/metricproviders | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/metricproviders/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/metricproviders/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/metricproviders/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/navigation/target | Content-Type application/xml; Content-Type semantic.navigation.v1 |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterNotFound); Content-Type: unknown (400 ExceptionParameterNotFound)) |
| POST /sap/bc/adt/notebasic/assignments | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/notebasic/assignments/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/notebasic/assignments/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/notebasic/assignments/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/notebasic/notetypes | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/notebasic/notetypes/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/notebasic/notetypes/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/notebasic/notetypes/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/numberranges/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/numberranges/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/numberranges/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/numberranges/objects/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/objectrelations | Content-Type application/vnd.sap.adt.objectrelations.request.sets.v1+xml |  |  | application/vnd.sap.adt.objectrelations.request.relations.v1+xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/objectrelations/components | Content-Type application/vnd.sap.adt.objectrelations.request.v1+xml |  |  | application/vnd.sap.adt.objectrelations.response.components.v2+xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/objectrelations/network | Content-Type application/vnd.sap.adt.objectrelations.request.v1+xml |  |  | application/vnd.sap.adt.objectrelations.response.network.v1+xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/objectrelations/references | Content-Type application/vnd.sap.adt.objectrelations.request.references.v1+xml |  |  |  |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/oo/classes | Content-Type application/vnd.sap.adt.oo.classes.v4+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| POST /sap/bc/adt/oo/interfaces | Content-Type application/vnd.sap.adt.oo.interfaces.v5+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| POST /sap/bc/adt/packages | Content-Type application/vnd.sap.adt.packages.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/packages/$constraints | Content-Type application/softwareComponent.v1+json; Content-Type application/packageConstraints.v1+json |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/packages/settings | Content-Type application/vnd.sap.adt.packages.settings.v2+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (inferred from the contrast: 406 without a working Content-Type, 400 with one)) |
| POST /sap/bc/adt/predefinedfields/objects | Content-Type application/vnd.sap.adt.blues.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/predefinedfields/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/predefinedfields/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/predefinedfields/objects/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/quickfixes/evaluation | Content-Type application/vnd.sap.adt.quickfixes.evaluation+xml;version=1.0.0 |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest)) |
| POST /sap/bc/adt/repository/informationsystem/virtualfolders | Content-Type application/vnd.sap.adt.repository.virtualfolders.result.v1+xml |  |  |  | application/vnd.sap.adt.repository.virtualfolders.request.v1+xml | content-type (Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: checked (415)) |
| POST /sap/bc/adt/repository/informationsystem/virtualfolders/contents | Content-Type application/vnd.sap.adt.repository.virtualfolders.result.v1+xml |  |  |  | application/vnd.sap.adt.repository.virtualfolders.request.v1+xml | content-type (Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: checked (415)) |
| POST /sap/bc/adt/repository/nodepath | Content-Type application/tdevc.v1+csv |  |  |  |  | unknown (Accept: unknown (400 uriMappingError); Content-Type: unknown (400 uriMappingError)) |
| POST /sap/bc/adt/sadl/gw/annopush/finalize | Content-Type application/xml |  |  |  |  |  |
| POST /sap/bc/adt/sadl/gw/annopush/prepare | Content-Type application/xml |  |  |  |  |  |
| POST /sap/bc/adt/sadl/gw/annopush/push | Content-Type application/xml |  |  |  |  |  |
| POST /sap/bc/adt/sadl/gw/annopush/validate | Content-Type application/xml; Content-Type application/xml |  |  |  |  |  |
| POST /sap/bc/adt/sadl/gw/mde | Content-Type application/xml |  |  |  |  |  |
| POST /sap/bc/adt/sfw/featuretoggles/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/sfw/featuretoggles/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/sfw/featuretoggles/source/formatter | Content-Type application/json |  |  |  |  |  |
| POST /sap/bc/adt/swc/relations | Content-Type application/vnd.sap.adt.blues.v2+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/swc/relations/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/swc/relations/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/swc/relations/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/testcodegen/dependencies/doubledata | Content-Type application/vnd.sap.adt.oo.cds.codgen.v1+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: unreadable 403); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable 403)) |
| POST /sap/bc/adt/textelements/classes | Content-Type application/vnd.sap.adt.textelements.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/textelements/functiongroups | Content-Type application/vnd.sap.adt.textelements.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/textelements/programs | Content-Type application/vnd.sap.adt.textelements.v1+xml |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/transportobject/objects/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/transportobject/objects/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/transportobject/objects/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/ucon/httpservices | Content-Type application/vnd.sap.adt.uconn.http.v1+xml; Content-Type text/html |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| POST /sap/bc/adt/wbobj/apictyp/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/wbobj/apictyp/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented)) |
| POST /sap/bc/adt/wbobj/apictyp/source/formatter | Content-Type application/json |  |  | application/json | application/json | both (Accept: checked (406); Content-Type: checked (415)) |
| POST /sap/bc/adt/wmpc/applications/$configuration | Content-Type application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/wmpc/applications/$schema | Content-Type application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |  |  |  |
| POST /sap/bc/adt/wmpc/applications/source/formatter | Content-Type application/json |  |  |  |  |  |
| POST /sap/bc/adt/xslt/transformations | Content-Type application/vnd.sap.adt.transformations+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |

## The header corpus: clients

| endpoint | the pair table lists | none: Accept named | none: Content-Type named | bogus: Accept named | bogus: Content-Type named | needs (bogus) |
|---|---|---|---|---|---|---|
| AdtAbapGitClient.checkExternalRepo — POST /sap/bc/adt/abapgit/externalrepoinfo | Accept application/abapgit.adt.repo.info.ext.response.v2+xml; Content-Type application/abapgit.adt.repo.info.ext.request.v2+xml |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object))) |
| AdtAbapGitClient.link — POST /sap/bc/adt/abapgit/repos | Accept application/abapgit.adt.repo.v3+xml; Content-Type application/abapgit.adt.repo.v3+xml |  |  |  |  | unknown (Accept: unknown (skipped: needs an external Git repository to link); Content-Type: unknown (skipped: needs an external Git repository to link)) |
| AdtAbapGitClient.listRepos — GET /sap/bc/adt/abapgit/repos |  |  |  |  |  | unknown (Accept: unknown (400 (no SAP exception)); Content-Type: no body) |
| AdtAbapGitClient.pull — POST | Accept application/abapgit.adt.repo.v3+xml; Content-Type application/abapgit.adt.repo.v3+xml |  |  |  |  | unknown (Accept: unknown (skipped: needs an external Git repository to link); Content-Type: unknown (skipped: needs an external Git repository to link)) |
| AdtAbapGitClient.unlink — DELETE /sap/bc/adt/abapgit/repos/{name} |  |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)); Content-Type: no body) |
| getAccessControl().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getAccessControl().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getAccessControl().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getAccessControl().create — POST /sap/bc/adt/acm/dcl/sources | Accept application/vnd.sap.adt.dclSource+xml; Content-Type application/vnd.sap.adt.dclSource+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getAccessControl().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getAccessControl().getVersions — GET /sap/bc/adt/acm/dcl/sources/{name}/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getAccessControl().lock — POST /sap/bc/adt/acm/dcl/sources/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getAccessControl().read — GET /sap/bc/adt/acm/dcl/sources/{name}/source/main |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getAccessControl().readMetadata — GET /sap/bc/adt/acm/dcl/sources/{name} |  |  |  | application/vnd.sap.adt.dclSource+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getAccessControl().readTransport — GET /sap/bc/adt/acm/dcl/sources/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getAccessControl().unlock — POST /sap/bc/adt/acm/dcl/sources/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getAccessControl().update — PUT /sap/bc/adt/acm/dcl/sources/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body) |
| getAccessControl().validate — POST /sap/bc/adt/acm/dcl/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getAppendStructure().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().getVersions — GET /sap/bc/adt/ddic/structures/{name}/source/main/versions |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().lock — POST /sap/bc/adt/ddic/structures/{name}?_action=LOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().read — GET /sap/bc/adt/ddic/structures/{name}/source/main |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().readMetadata — GET /sap/bc/adt/ddic/structures/{name} |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().readTransport — GET /sap/bc/adt/ddic/structures/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().unlock — POST /sap/bc/adt/ddic/structures/{name}?_action=UNLOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().update — PUT /sap/bc/adt/ddic/structures/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404)) |
| getAppendStructure().validate — POST /sap/bc/adt/ddic/structures/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getApplicationLog().getObject — GET /sap/bc/adt/applicationlog/objects/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getApplicationLog().getSource — GET /sap/bc/adt/applicationlog/objects/{name}/source/main |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getApplicationLog().validateName — GET /sap/bc/adt/applicationlog/objects/validation |  |  |  |  |  | unknown (Accept: unknown (405 method not implemented); Content-Type: no body) |
| getAtc().createWorklist — POST /sap/bc/adt/atc/worklists |  |  |  |  |  | unknown (Accept: unknown (skipped: the server assigns the worklist id, so a worklist a probe made could not be found and removed); Content-Type: unknown (skipped: the server assigns the worklist id, so a worklist a probe made could not be found and removed)) |
| getAtc().getFindings — GET /sap/bc/adt/atc/worklists/{name} |  |  |  | application/atc.worklist.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getAtc().getRunStatus — GET /sap/bc/adt/atc/runs/{name} |  |  |  | application/vnd.sap.atc.run.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getAtc().listCheckVariants — GET /sap/bc/adt/atc/variants |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getAtc().resolveCheckVariant — GET /sap/bc/adt/atc/customizing |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getAtcLog().getCheckFailureLogs — GET /sap/bc/adt/atc/checkfailures/logs |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getAtcLog().getExecutionLog — GET /sap/bc/adt/atc/results/{name}/log |  |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| getAuthorizationField().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getAuthorizationField().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getAuthorizationField().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getAuthorizationField().create — POST /sap/bc/adt/aps/iam/auth | Accept application/vnd.sap.adt.blues.v1+xml; Content-Type application/vnd.sap.adt.blues.v1+xml |  |  |  |  | content-type (Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/auth}auth' System expected the element '{http://www.sap.com/iam/auth}auth' 00 001 System expected the element '{http://www.sap.com/i am/auth}auth'); Content-Type: checked (415)) |
| getAuthorizationField().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getAuthorizationField().lock — POST /sap/bc/adt/aps/iam/auth/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getAuthorizationField().readMetadata — GET /sap/bc/adt/aps/iam/auth/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getAuthorizationField().unlock — POST /sap/bc/adt/aps/iam/auth/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getAuthorizationField().updateMetadata — PUT /sap/bc/adt/aps/iam/auth/{name} | Accept application/vnd.sap.adt.blues.v1+xml; Content-Type application/vnd.sap.adt.blues.v1+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getAuthorizationField().validate — POST /sap/bc/adt/aps/iam/auth/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getBehaviorDefinition().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getBehaviorDefinition().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getBehaviorDefinition().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getBehaviorDefinition().create — POST /sap/bc/adt/bo/behaviordefinitions | Accept application/vnd.sap.adt.blues.v1+xml; Content-Type application/vnd.sap.adt.blues.v1+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getBehaviorDefinition().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getBehaviorDefinition().getVersions — GET /sap/bc/adt/bo/behaviordefinitions/{name}/source/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getBehaviorDefinition().lock — POST /sap/bc/adt/bo/behaviordefinitions/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: not checked (200)) |
| getBehaviorDefinition().read — GET /sap/bc/adt/bo/behaviordefinitions/{name}/source/main |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getBehaviorDefinition().readMetadata — GET /sap/bc/adt/bo/behaviordefinitions/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getBehaviorDefinition().readTransport — GET /sap/bc/adt/bo/behaviordefinitions/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getBehaviorDefinition().unlock — POST /sap/bc/adt/bo/behaviordefinitions/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getBehaviorDefinition().update — PUT /sap/bc/adt/bo/behaviordefinitions/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body) |
| getBehaviorDefinition().validate — POST /sap/bc/adt/bo/behaviordefinitions/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getBehaviorImplementation().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getBehaviorImplementation().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getBehaviorImplementation().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getBehaviorImplementation().create — POST /sap/bc/adt/oo/classes | Accept application/vnd.sap.adt.oo.classes.v4+xml; Content-Type application/vnd.sap.adt.oo.classes.v4+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getBehaviorImplementation().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getBehaviorImplementation().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/implementations/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getBehaviorImplementation().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getBehaviorImplementation().read — GET /sap/bc/adt/oo/classes/{name}/source/main |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getBehaviorImplementation().readMetadata — GET /sap/bc/adt/oo/classes/{name} |  |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| getBehaviorImplementation().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getBehaviorImplementation().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getBehaviorImplementation().update — PUT /sap/bc/adt/oo/classes/{name}/includes/implementations | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getBehaviorImplementation().validate — POST /sap/bc/adt/oo/validation/objectname |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getClass().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getClass().activateTestClasses — POST /sap/bc/adt/activation |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getClass().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getClass().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getClass().create — POST /sap/bc/adt/oo/classes | Accept application/vnd.sap.adt.oo.classes.v4+xml; Content-Type application/vnd.sap.adt.oo.classes.v4+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getClass().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getClass().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getClass().includeVersions — GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getClass().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getClass().read — GET /sap/bc/adt/oo/classes/{name}/source/main |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getClass().readEnhancementElements — GET /sap/bc/adt/oo/classes/{name}/source/main/enhancements/elements |  |  |  | application/vnd.sap.adt.enhancements.v3+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getClass().readEnhancementOptions — GET /sap/bc/adt/oo/classes/{name}/enhancements/options |  |  |  | application/vnd.sap.adt.enhancementoptions.v2+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getClass().readMetadata — GET /sap/bc/adt/oo/classes/{name} |  |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| getClass().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getClass().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getClass().update — PUT /sap/bc/adt/oo/classes/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getClass().validate — POST /sap/bc/adt/oo/validation/objectname |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getClassExecutor().listObjectTypes — GET /sap/bc/adt/runtime/traces/abaptraces/objecttypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getClassExecutor().listProcessTypes — GET /sap/bc/adt/runtime/traces/abaptraces/processtypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getClassExecutor().listRequests — GET /sap/bc/adt/runtime/traces/abaptraces/requests |  |  |  |  |  | accept (Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body) |
| getClassExecutor().run — POST /sap/bc/adt/oo/classrun/{name} |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getClassExecutor().runWithProfiler — POST /sap/bc/adt/oo/classrun/{name} |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getClassExecutor().scheduleTrace — POST /sap/bc/adt/runtime/traces/abaptraces/parameters | Accept application/xml; Content-Type application/xml |  |  |  |  | unknown (Accept: unknown (skipped: the server assigns the trace request id, so a schedule a probe made could not be found and removed); Content-Type: unknown (skipped: the server assigns the trace request id, so a schedule a probe made could not be found and removed)) |
| getClassTestRunner().getResult — GET /sap/bc/adt/abapunit/results/{name} |  |  |  | application/vnd.sap.adt.api.junit.run-result.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getClassTestRunner().getStatus — GET /sap/bc/adt/abapunit/runs/{name} |  |  |  | application/vnd.sap.adt.api.abapunit.run-status.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getClassTestRunner().startByObject — POST /sap/bc/adt/abapunit/runs |  |  |  |  | application/vnd.sap.adt.api.abapunit.run.v1+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getCrossTrace().getActivations — GET /sap/bc/adt/crosstrace/activations |  |  |  | application/vnd.sap.adt.crosstrace.activations.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getCrossTrace().getById — GET /sap/bc/adt/crosstrace/traces/{name} |  |  |  | application/vnd.sap.adt.crosstrace.traces.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getCrossTrace().getRecordContent — GET /sap/bc/adt/crosstrace/traces/{name}/records/{name}/content |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getCrossTrace().getRecords — GET /sap/bc/adt/crosstrace/traces/{name}/records |  |  |  | application/vnd.sap.adt.crosstrace.records.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getCrossTrace().list — GET /sap/bc/adt/crosstrace/traces |  |  |  | application/vnd.sap.adt.crosstrace.traces.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getDataElement().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getDataElement().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getDataElement().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getDataElement().create — POST /sap/bc/adt/ddic/dataelements | Accept application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml; Content-Type application/vnd.sap.adt.dataelements.v2+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getDataElement().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getDataElement().lock — POST /sap/bc/adt/ddic/dataelements/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getDataElement().readMetadata — GET /sap/bc/adt/ddic/dataelements/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getDataElement().readTransport — GET /sap/bc/adt/ddic/dataelements/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getDataElement().unlock — POST /sap/bc/adt/ddic/dataelements/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getDataElement().updateMetadata — PUT /sap/bc/adt/ddic/dataelements/{name} | Accept application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml; Content-Type application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8 |  |  |  |  | both (Accept: checked (037, inferred from the contrast); Content-Type: checked (415)) |
| getDataElement().validate — POST /sap/bc/adt/ddic/dataelements/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getDdicActivation().getGraph — GET /sap/bc/adt/ddic/logs/activationgraph |  |  |  | application/vnd.sap.adt.ddic.acivationLog.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getDdl().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getDdl().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getDdl().checkCdsTestDoubles — POST /sap/bc/adt/aunit/dbtestdoubles/cds/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getDdl().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getDdl().create — POST /sap/bc/adt/ddic/ddl/sources | Accept application/vnd.sap.adt.ddlSource.v2+xml, application/vnd.sap.adt.ddlSource+xml; Content-Type application/vnd.sap.adt.ddlSource+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getDdl().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getDdl().getVersions — GET /sap/bc/adt/ddic/ddl/sources/{name}/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getDdl().lock — POST /sap/bc/adt/ddic/ddl/sources/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getDdl().read — GET /sap/bc/adt/ddic/ddl/sources/{name}/source/main |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getDdl().readMetadata — GET /sap/bc/adt/ddic/ddl/sources/{name} |  |  |  | application/vnd.sap.adt.ddlSource+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getDdl().readTransport — GET /sap/bc/adt/ddic/ddl/sources/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getDdl().unlock — POST /sap/bc/adt/ddic/ddl/sources/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getDdl().update — PUT /sap/bc/adt/ddic/ddl/sources/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | content-type (Accept: unknown (404 Error); Content-Type: checked (415)) |
| getDdl().validate — POST /sap/bc/adt/ddic/ddl/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getDomain().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getDomain().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getDomain().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getDomain().create — POST /sap/bc/adt/ddic/domains | Accept application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml; Content-Type application/vnd.sap.adt.domains.v2+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getDomain().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getDomain().lock — POST /sap/bc/adt/ddic/domains/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getDomain().readMetadata — GET /sap/bc/adt/ddic/domains/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getDomain().readTransport — GET /sap/bc/adt/ddic/domains/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getDomain().unlock — POST /sap/bc/adt/ddic/domains/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getDomain().updateMetadata — PUT /sap/bc/adt/ddic/domains/{name} | Accept application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml; Content-Type application/vnd.sap.adt.domains.v2+xml; charset=utf-8 |  |  |  |  | both (Accept: checked (037, inferred from the contrast); Content-Type: checked (415)) |
| getDomain().validate — POST /sap/bc/adt/ddic/domains/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getDumps().getById — GET /sap/bc/adt/runtime/dump/{name} |  |  |  |  |  | unknown (Accept: unknown (404 notFound); Content-Type: no body) |
| getDumps().list — GET /sap/bc/adt/runtime/dumps |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getDumps().listByUser — GET /sap/bc/adt/runtime/dumps |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getEnhancement().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getEnhancement().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  |  |  | application/vnd.sap.adt.checkobjects+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getEnhancement().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getEnhancement().create — POST /sap/bc/adt/enhancements/enhoxhb | Accept application/vnd.sap.adt.enh.enhoxhh.v3+xml; Content-Type application/vnd.sap.adt.enh.enhoxhh.v3+xml |  |  |  |  | content-type (Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: checked (415)) |
| getEnhancement().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getEnhancement().getVersions — GET /sap/bc/adt/enhancements/enhoxhb/{name}/source/main/versions |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getEnhancement().lock — POST /sap/bc/adt/enhancements/enhoxhb/{name}?_action=LOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: sends a LOCK, and SAP grants a lock on the probe name although no object of that name exists (measured); the corpus takes no locks); Content-Type: unknown (skipped: sends a LOCK, and SAP grants a lock on the probe name although no object of that name exists (measured); the corpus takes no locks)) |
| getEnhancement().readMetadata — GET /sap/bc/adt/enhancements/enhoxhb/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getEnhancement().readTransport — GET /sap/bc/adt/enhancements/enhoxhb/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getEnhancement().unlock — POST /sap/bc/adt/enhancements/enhoxhb/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getEnhancement().updateMetadata — PUT /sap/bc/adt/enhancements/enhoxhb/{name} | Accept application/vnd.sap.adt.enh.enhoxhh.v3+xml; Content-Type application/vnd.sap.adt.enh.enhoxhh.v3+xml |  |  |  |  | unknown (Accept: unknown (423 ExceptionResourceInvalidLockHandle); Content-Type: no body) |
| getEnhancement().validate — POST /sap/bc/adt/enhancements/enhoxhb/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFeatureToggle().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getFeatureToggle().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  |  |  | application/vnd.sap.adt.checkobjects+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getFeatureToggle().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFeatureToggle().checkState — POST /sap/bc/adt/sfw/featuretoggles/{name}/check | Accept application/vnd.sap.adt.toggle.check.result.v1+asjson; Content-Type application/vnd.sap.adt.toggle.check.parameters.v1+asjson |  |  |  |  |  |
| getFeatureToggle().create — POST /sap/bc/adt/sfw/featuretoggles | Accept application/vnd.sap.adt.blues.v1+xml; Content-Type application/vnd.sap.adt.blues.v1+xml |  |  |  |  |  |
| getFeatureToggle().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFeatureToggle().getRuntimeState — GET /sap/bc/adt/sfw/featuretoggles/{name}/states |  |  |  |  |  |  |
| getFeatureToggle().lock — POST /sap/bc/adt/sfw/featuretoggles/{name}?_action=LOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: sends a LOCK, and SAP grants a lock on the probe name although no object of that name exists (measured); the corpus takes no locks); Content-Type: unknown (skipped: sends a LOCK, and SAP grants a lock on the probe name although no object of that name exists (measured); the corpus takes no locks)) |
| getFeatureToggle().read — GET /sap/bc/adt/sfw/featuretoggles/{name} |  |  |  |  |  |  |
| getFeatureToggle().readMetadata — GET /sap/bc/adt/sfw/featuretoggles/{name} |  |  |  |  |  |  |
| getFeatureToggle().readSource — GET /sap/bc/adt/sfw/featuretoggles/{name}/source/main |  |  |  |  |  |  |
| getFeatureToggle().switchOff — POST /sap/bc/adt/sfw/featuretoggles/{name}/toggle |  |  |  |  |  |  |
| getFeatureToggle().switchOn — POST /sap/bc/adt/sfw/featuretoggles/{name}/toggle |  |  |  |  |  |  |
| getFeatureToggle().switchTo — POST /sap/bc/adt/sfw/featuretoggles/{name}/toggle |  |  |  |  |  |  |
| getFeatureToggle().unlock — POST /sap/bc/adt/sfw/featuretoggles/{name}?_action=UNLOCK |  |  |  |  |  |  |
| getFeatureToggle().update — PUT /sap/bc/adt/sfw/featuretoggles/{name}/source/main | Accept application/vnd.sap.adt.toggle.content.v2+json; Content-Type application/vnd.sap.adt.toggle.content.v2+json |  |  |  |  |  |
| getFeatureToggle().updateMetadata — PUT /sap/bc/adt/sfw/featuretoggles/{name} | Accept application/vnd.sap.adt.blues.v1+xml; Content-Type application/vnd.sap.adt.blues.v1+xml |  |  |  |  |  |
| getFeatureToggle().validate — POST /sap/bc/adt/sfw/featuretoggles/validation |  |  |  |  |  |  |
| getFeeds().dumps — GET /sap/bc/adt/runtime/dumps |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getFeeds().gatewayErrors — GET /sap/bc/adt/gw/errorlog |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getFeeds().list — GET /sap/bc/adt/feeds |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getFeeds().systemMessages — GET /sap/bc/adt/runtime/systemmessages |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getFeeds().variants — GET /sap/bc/adt/feeds/variants |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getFunctionGroup().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getFunctionGroup().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFunctionGroup().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFunctionGroup().create — POST /sap/bc/adt/functions/groups | Accept application/vnd.sap.adt.functions.groups.v3+xml; Content-Type application/vnd.sap.adt.functions.groups.v3+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getFunctionGroup().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFunctionGroup().lock — POST /sap/bc/adt/functions/groups/{name}?_action=LOCK |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionGroup().readEnhancementElements — GET /sap/bc/adt/functions/groups/{name}/source/main/enhancements/elements |  |  |  | application/vnd.sap.adt.enhancements.v3+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionGroup().readEnhancementOptions — GET /sap/bc/adt/functions/groups/{name}/enhancements/options |  |  |  | application/vnd.sap.adt.enhancementoptions.v2+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionGroup().readMetadata — GET /sap/bc/adt/functions/groups/{name} |  |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionGroup().readTransport — GET /sap/bc/adt/functions/groups/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getFunctionGroup().unlock — POST /sap/bc/adt/functions/groups/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getFunctionGroup().updateMetadata — PUT /sap/bc/adt/functions/groups/{name} | Accept application/vnd.sap.adt.functions.groups.v3+xml; Content-Type application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8 |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getFunctionGroup().validate — POST /sap/bc/adt/functions/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionGroupTestRunner().getResult — GET /sap/bc/adt/abapunit/results/{name} |  |  |  | application/vnd.sap.adt.api.junit.run-result.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionGroupTestRunner().getStatus — GET /sap/bc/adt/abapunit/runs/{name} |  |  |  | application/vnd.sap.adt.api.abapunit.run-status.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionGroupTestRunner().run — POST /sap/bc/adt/abapunit/runs |  |  |  |  | application/vnd.sap.adt.api.abapunit.run.v1+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getFunctionGroupTestRunner().runSync — POST /sap/bc/adt/abapunit/testruns |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionInvalidData)) |
| getFunctionGroupTestRunner().startByObject — POST /sap/bc/adt/abapunit/runs |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object))) |
| getFunctionInclude().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getFunctionInclude().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFunctionInclude().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFunctionInclude().create — POST /sap/bc/adt/functions/groups/{name}/includes | Accept application/vnd.sap.adt.functions.fincludes.v2+xml, application/vnd.sap.adt.functions.fincludes+xml; Content-Type application/vnd.sap.adt.functions.fincludes.v2+xml |  |  |  | application/vnd.sap.adt.functions.fincludes.v2+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getFunctionInclude().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFunctionInclude().getVersions — GET /sap/bc/adt/functions/groups/{name}/includes/{name}/source/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionInclude().lock — POST /sap/bc/adt/functions/groups/{name}/includes/{name}?_action=LOCK |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionInclude().read — GET /sap/bc/adt/functions/groups/{name}/includes/{name}/source/main |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionInclude().readMetadata — GET /sap/bc/adt/functions/groups/{name}/includes/{name} |  |  |  | application/vnd.sap.adt.functions.fincludes.v2+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionInclude().unlock — POST /sap/bc/adt/functions/groups/{name}/includes/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getFunctionInclude().update — PUT /sap/bc/adt/functions/groups/{name}/includes/{name}/source/main | Accept text/plain; Content-Type text/plain |  | text/plain |  | text/plain | unknown (Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body) |
| getFunctionInclude().validate — GET /sap/bc/adt/functions/groups/{name} |  |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| getFunctionModule().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getFunctionModule().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFunctionModule().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFunctionModule().create — POST /sap/bc/adt/functions/groups/{name}/fmodules | Accept application/vnd.sap.adt.functions.fmodules+xml; Content-Type application/vnd.sap.adt.functions.fmodules+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getFunctionModule().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getFunctionModule().getVersions — GET /sap/bc/adt/functions/groups/{name}/fmodules/{name}/source/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionModule().lock — POST /sap/bc/adt/functions/groups/{name}/fmodules/{name}?_action=LOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getFunctionModule().read — GET /sap/bc/adt/functions/groups/{name}/fmodules/{name}/source/main |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionModule().readMetadata — GET /sap/bc/adt/functions/groups/{name}/fmodules/{name} |  |  |  | application/vnd.sap.adt.functions.fmodules.v3+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionModule().readTransport — GET /sap/bc/adt/functions/groups/{name}/fmodules/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getFunctionModule().unlock — POST /sap/bc/adt/functions/groups/{name}/fmodules/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getFunctionModule().update — PUT /sap/bc/adt/functions/groups/{name}/fmodules/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  | text/plain |  | text/plain | unknown (Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body) |
| getFunctionModule().validate — POST /sap/bc/adt/functions/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionModuleTestRunner().getResult — GET /sap/bc/adt/abapunit/results/{name} |  |  |  | application/vnd.sap.adt.api.junit.run-result.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionModuleTestRunner().getStatus — GET /sap/bc/adt/abapunit/runs/{name} |  |  |  | application/vnd.sap.adt.api.abapunit.run-status.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getFunctionModuleTestRunner().run — POST /sap/bc/adt/abapunit/runs |  |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object))) |
| getFunctionModuleTestRunner().runSync — POST /sap/bc/adt/abapunit/testruns |  |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object))) |
| getFunctionModuleTestRunner().startByObject — POST /sap/bc/adt/abapunit/runs |  |  |  |  |  | unknown (Accept: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object))) |
| getGatewayErrorLog().getById — GET /sap/bc/adt/gw/errorlog/{name}/{name} |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getGatewayErrorLog().list — GET /sap/bc/adt/gw/errorlog |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getInclude().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getInclude().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getInclude().create — POST /sap/bc/adt/programs/includes | Accept application/vnd.sap.adt.programs.includes.v2+xml; Content-Type application/vnd.sap.adt.programs.includes.v2+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getInclude().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getInclude().lock — POST /sap/bc/adt/programs/includes/{name}?_action=LOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getInclude().read — GET /sap/bc/adt/programs/includes/{name}/source/main |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getInclude().readEnhancementElements — GET /sap/bc/adt/programs/includes/{name}/source/main/enhancements/elements |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getInclude().readEnhancementOptions — GET /sap/bc/adt/programs/includes/{name}/enhancements/options |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getInclude().readMetadata — GET /sap/bc/adt/programs/includes/{name} |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getInclude().unlock — POST /sap/bc/adt/programs/includes/{name}?_action=UNLOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getInclude().update — PUT /sap/bc/adt/programs/includes/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getInclude().validate — POST /sap/bc/adt/includes/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getInterface().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getInterface().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getInterface().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getInterface().create — POST /sap/bc/adt/oo/interfaces | Accept application/vnd.sap.adt.oo.interfaces.v5+xml; Content-Type application/vnd.sap.adt.oo.interfaces.v5+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getInterface().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getInterface().getVersions — GET /sap/bc/adt/oo/interfaces/{name}/source/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getInterface().lock — POST /sap/bc/adt/oo/interfaces/{name}?_action=LOCK |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getInterface().read — GET /sap/bc/adt/oo/interfaces/{name}/source/main |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getInterface().readMetadata — GET /sap/bc/adt/oo/interfaces/{name} |  |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| getInterface().readTransport — GET /sap/bc/adt/oo/interfaces/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getInterface().unlock — POST /sap/bc/adt/oo/interfaces/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getInterface().update — PUT /sap/bc/adt/oo/interfaces/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (400 ExceptionResourceScanDuringSaveFailure); Content-Type: no body) |
| getInterface().validate — POST /sap/bc/adt/oo/validation/objectname |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getLocalDefinitions().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getLocalDefinitions().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getLocalDefinitions().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/definitions/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalDefinitions().includeVersions — GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalDefinitions().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalDefinitions().read — GET /sap/bc/adt/oo/classes/{name}/includes/definitions |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalDefinitions().readMetadata — GET /sap/bc/adt/oo/classes/{name} |  |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalDefinitions().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getLocalDefinitions().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getLocalDefinitions().update — PUT /sap/bc/adt/oo/classes/{name}/includes/definitions | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getLocalDefinitions().validate — POST /sap/bc/adt/checkruns |  |  |  |  | application/vnd.sap.adt.checkobjects+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getLocalMacros().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getLocalMacros().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getLocalMacros().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/macros/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalMacros().includeVersions — GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalMacros().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalMacros().read — GET /sap/bc/adt/oo/classes/{name}/includes/macros |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalMacros().readMetadata — GET /sap/bc/adt/oo/classes/{name} |  |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalMacros().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getLocalMacros().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getLocalMacros().update — PUT /sap/bc/adt/oo/classes/{name}/includes/macros | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getLocalMacros().validate — POST /sap/bc/adt/checkruns |  |  |  |  | application/vnd.sap.adt.checkobjects+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getLocalTestClass().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getLocalTestClass().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getLocalTestClass().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/testclasses/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalTestClass().includeVersions — GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalTestClass().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalTestClass().read — GET /sap/bc/adt/oo/classes/{name}/includes/testclasses |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalTestClass().readMetadata — GET /sap/bc/adt/oo/classes/{name} |  |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalTestClass().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getLocalTestClass().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getLocalTestClass().update — PUT /sap/bc/adt/oo/classes/{name}/includes/testclasses | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getLocalTestClass().validate — POST /sap/bc/adt/checkruns |  |  |  |  | application/vnd.sap.adt.checkobjects+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getLocalTypes().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getLocalTypes().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getLocalTypes().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/implementations/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalTypes().includeVersions — GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalTypes().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalTypes().read — GET /sap/bc/adt/oo/classes/{name}/includes/implementations |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalTypes().readMetadata — GET /sap/bc/adt/oo/classes/{name} |  |  |  |  |  | accept (Accept: checked (406); Content-Type: no body) |
| getLocalTypes().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getLocalTypes().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getLocalTypes().update — PUT /sap/bc/adt/oo/classes/{name}/includes/implementations | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getLocalTypes().validate — POST /sap/bc/adt/checkruns |  |  |  |  | application/vnd.sap.adt.checkobjects+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getMessageClass().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getMessageClass().create — POST /sap/bc/adt/messageclass | Accept application/xml; Content-Type application/xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getMessageClass().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getMessageClass().lock — POST /sap/bc/adt/messageclass/{name}?_action=LOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getMessageClass().readMetadata — GET /sap/bc/adt/messageclass/{name} |  |  |  | application/vnd.sap.adt.mc.messageclass+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getMessageClass().unlock — POST /sap/bc/adt/messageclass/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getMessageClass().updateMetadata — PUT /sap/bc/adt/messageclass/{name} | Accept application/vnd.sap.adt.mc.messageclass+xml; Content-Type application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8 |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getMessageClass().validate — POST /sap/bc/adt/messageclass/validation |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getMessageClassMessage().create — POST /sap/bc/adt/messageclass/{name}/messages/001?_action=LOCK_MSG | Accept application/vnd.sap.adt.mc.messageclass+xml; Content-Type application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| getMessageClassMessage().delete — POST /sap/bc/adt/messageclass/{name}/messages/001?_action=LOCK_MSG | Accept application/vnd.sap.adt.mc.messageclass+xml; Content-Type application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8 |  |  | application/vnd.sap.adt.mc.messageclass+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getMessageClassMessage().read — GET /sap/bc/adt/messageclass/{name} |  |  |  | application/vnd.sap.adt.mc.messageclass+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getMessageClassMessage().readMetadata — GET /sap/bc/adt/messageclass/{name} |  |  |  | application/vnd.sap.adt.mc.messageclass+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getMessageClassMessage().update — POST /sap/bc/adt/messageclass/{name}/messages/001?_action=LOCK_MSG | Accept application/vnd.sap.adt.mc.messageclass+xml; Content-Type application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8 |  |  | application/vnd.sap.adt.mc.messageclass+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getMessageClassMessage().writeClass — POST /sap/bc/adt/messageclass/{name}/messages/001?_action=LOCK_MSG |  |  |  | application/vnd.sap.adt.mc.messageclass+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getMetadataExtension().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getMetadataExtension().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getMetadataExtension().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getMetadataExtension().create — POST /sap/bc/adt/ddic/ddlx/sources | Accept application/vnd.sap.adt.ddic.ddlx.v1+xml; Content-Type application/vnd.sap.adt.ddic.ddlx.v1+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getMetadataExtension().delete — DELETE /sap/bc/adt/ddic/ddlx/sources/{name} | Accept application/xml; Content-Type application/xml |  |  |  |  | unknown (Accept: unknown (blocked by our own lock); Content-Type: no body) |
| getMetadataExtension().getVersions — GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getMetadataExtension().lock — POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getMetadataExtension().read — GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getMetadataExtension().readMetadata — GET /sap/bc/adt/ddic/ddlx/sources/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getMetadataExtension().readTransport — GET /sap/bc/adt/ddic/ddlx/sources/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getMetadataExtension().unlock — POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getMetadataExtension().update — PUT /sap/bc/adt/ddic/ddlx/sources/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body) |
| getMetadataExtension().validate — POST /sap/bc/adt/ddic/ddlx/sources/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getPackage().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409)) |
| getPackage().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409)) |
| getPackage().create — POST /sap/bc/adt/packages | Accept application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml; Content-Type application/vnd.sap.adt.packages.v2+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getPackage().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409)) |
| getPackage().lock — POST /sap/bc/adt/packages/{name}?_action=LOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409)) |
| getPackage().readMetadata — GET /sap/bc/adt/packages/{name} |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409)) |
| getPackage().readTransport — GET /sap/bc/adt/packages/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409)) |
| getPackage().unlock — POST /sap/bc/adt/packages/{name}?_action=UNLOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409)) |
| getPackage().updateMetadata — PUT /sap/bc/adt/packages/{name} | Accept application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml; Content-Type application/vnd.sap.adt.packages.v2+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409)) |
| getPackage().validate — POST /sap/bc/adt/packages/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getProfiler().delete — DELETE /sap/bc/adt/runtime/traces/abaptraces/{name} |  |  |  |  |  | unknown (Accept: unknown (404 AdtFailed); Content-Type: no body) |
| getProfiler().list — GET /sap/bc/adt/runtime/traces/abaptraces |  |  |  |  |  | accept (Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body) |
| getProgram().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().create — POST /sap/bc/adt/programs/programs | Accept application/vnd.sap.adt.programs.programs.v2+xml; Content-Type application/vnd.sap.adt.programs.programs.v2+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getProgram().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().getVersions — GET /sap/bc/adt/programs/programs/{name}/source/main/versions |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().lock — POST /sap/bc/adt/programs/programs/{name}?_action=LOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().read — GET /sap/bc/adt/programs/programs/{name}/source/main |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().readEnhancementElements — GET /sap/bc/adt/programs/programs/{name}/source/main/enhancements/elements |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().readEnhancementOptions — GET /sap/bc/adt/programs/programs/{name}/enhancements/options |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().readMetadata — GET /sap/bc/adt/programs/programs/{name} |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().readTransport — GET /sap/bc/adt/programs/programs/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().unlock — POST /sap/bc/adt/programs/programs/{name}?_action=UNLOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().update — PUT /sap/bc/adt/programs/programs/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403)) |
| getProgram().validate — POST /sap/bc/adt/programs/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getProgramExecutor().listObjectTypes — GET /sap/bc/adt/runtime/traces/abaptraces/objecttypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getProgramExecutor().listProcessTypes — GET /sap/bc/adt/runtime/traces/abaptraces/processtypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getProgramExecutor().listRequests — GET /sap/bc/adt/runtime/traces/abaptraces/requests |  |  |  |  |  | accept (Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body) |
| getProgramExecutor().run — POST /sap/bc/adt/programs/programrun/{name} |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getProgramExecutor().runWithProfiler — POST /sap/bc/adt/programs/programrun/{name} |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getProgramExecutor().scheduleTrace — POST /sap/bc/adt/runtime/traces/abaptraces/parameters | Accept application/xml; Content-Type application/xml |  |  |  |  | unknown (Accept: unknown (skipped: the server assigns the trace request id, so a schedule a probe made could not be found and removed); Content-Type: unknown (skipped: the server assigns the trace request id, so a schedule a probe made could not be found and removed)) |
| getProgramTestRunner().getResult — GET /sap/bc/adt/abapunit/results/{name} |  |  |  | application/vnd.sap.adt.api.junit.run-result.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getProgramTestRunner().getStatus — GET /sap/bc/adt/abapunit/runs/{name} |  |  |  | application/vnd.sap.adt.api.abapunit.run-status.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getProgramTestRunner().run — POST /sap/bc/adt/abapunit/runs |  |  |  |  | application/vnd.sap.adt.api.abapunit.run.v1+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getProgramTestRunner().runSync — POST /sap/bc/adt/abapunit/testruns |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionInvalidData)) |
| getProgramTestRunner().startByObject — POST /sap/bc/adt/abapunit/runs |  |  |  |  | application/vnd.sap.adt.api.abapunit.run.v1+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getRequest().changeTaskType — PUT /sap/bc/adt/cts/transportrequests/{name} | Accept application/vnd.sap.adt.transportorganizer.v1+xml; Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getRequest().checkDeletion — GET /sap/bc/adt/cts/transportrequests/{name} | Accept application/vnd.sap.adt.transportorganizer.v1+xml; Content-Type application/vnd.sap.adt.transportorganizer.v1+xml |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| getRequest().create — POST /sap/bc/adt/cts/transportrequests | Accept application/vnd.sap.adt.transportorganizer.v1+xml; Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (skipped: the server assigns the request number, so a request a probe made could not be found by name and removed); Content-Type: unknown (skipped: the server assigns the request number, so a request a probe made could not be found by name and removed)) |
| getRequest().delete — DELETE /sap/bc/adt/cts/transportrequests/{name} | Accept application/vnd.sap.adt.transportorganizer.v1+xml; Content-Type application/vnd.sap.adt.transportorganizer.v1+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getRequest().moveObjects — POST /sap/bc/adt/cts/transportrequests/{name}/moveobjects | Accept application/vnd.sap.adt.transportorganizer.v1+xml; Content-Type text/plain |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getRequest().readActionLog — GET /sap/bc/adt/cts/transportrequests/{name}/actionlogs |  |  |  | application/vnd.sap.adt.logs+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getRequest().readMetadata — GET /sap/bc/adt/cts/transportrequests/{name} |  |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| getRequest().readObjects — GET /sap/bc/adt/cts/transportrequests/{name} |  |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| getRequest().searchConfigurations — GET /sap/bc/adt/cts/transportrequests/searchconfiguration/configurations |  |  |  | application/vnd.sap.adt.configurations.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getRequest().sortAndCompress — POST /sap/bc/adt/cts/transportrequests/{name}/sortandcompress |  |  |  |  |  | unknown (Accept: unknown (400 ADT_TM_COMMON_EXCEPTION); Content-Type: no body) |
| getRequest().updateMetadata — PUT /sap/bc/adt/cts/transportrequests/{name} | Accept application/vnd.sap.adt.transportorganizer.v1+xml; Content-Type application/vnd.sap.adt.transportorganizer.v1+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: no body) |
| getScalarFunction().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getScalarFunction().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getScalarFunction().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getScalarFunction().create — POST /sap/bc/adt/ddic/dsfd/sources | Accept application/vnd.sap.adt.blues.v1+xml; Content-Type application/vnd.sap.adt.blues.v1+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getScalarFunction().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getScalarFunction().getVersions — GET /sap/bc/adt/ddic/dsfd/sources/{name}/source/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getScalarFunction().lock — POST /sap/bc/adt/ddic/dsfd/sources/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getScalarFunction().read — GET /sap/bc/adt/ddic/dsfd/sources/{name}/source/main |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getScalarFunction().readMetadata — GET /sap/bc/adt/ddic/dsfd/sources/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getScalarFunction().readTransport — GET /sap/bc/adt/ddic/dsfd/sources/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getScalarFunction().unlock — POST /sap/bc/adt/ddic/dsfd/sources/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getScalarFunction().update — PUT /sap/bc/adt/ddic/dsfd/sources/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body) |
| getScalarFunction().validate — POST /sap/bc/adt/ddic/dsfd/sources/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getScalarFunctionImplementation().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().create — POST /sap/bc/adt/ddic/dsfi | Accept application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml; Content-Type application/vnd.sap.adt.blues.v2+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getScalarFunctionImplementation().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().getVersions — GET /sap/bc/adt/ddic/dsfi/{name}/source/main/versions |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().lock — POST /sap/bc/adt/ddic/dsfi/{name}?_action=LOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().read — GET /sap/bc/adt/ddic/dsfi/{name}/source/main |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().readMetadata — GET /sap/bc/adt/ddic/dsfi/{name} |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().readTransport — GET /sap/bc/adt/ddic/dsfi/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().unlock — POST /sap/bc/adt/ddic/dsfi/{name}?_action=UNLOCK |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().update — PUT /sap/bc/adt/ddic/dsfi/{name}/source/main | Accept application/json; Content-Type application/json |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().updateMetadata — PUT /sap/bc/adt/ddic/dsfi/{name} | Accept application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml; Content-Type application/vnd.sap.adt.blues.v2+xml; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422)) |
| getScalarFunctionImplementation().validate — POST /sap/bc/adt/ddic/dsfi/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getServiceBinding().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getServiceBinding().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getServiceBinding().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getServiceBinding().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getServiceBinding().getServiceBindingTypes — GET /sap/bc/adt/businessservices/bindings/bindingtypes |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getServiceBinding().getServiceGroup — GET /sap/bc/adt/businessservices/undefined/undefined |  |  |  |  |  | unknown (Accept: unknown (skipped: builds no address from the probe name alone (/sap/bc/adt/businessservices/undefined/undefined)); Content-Type: unknown (skipped: builds no address from the probe name alone (/sap/bc/adt/businessservices/undefined/undefined))) |
| getServiceBinding().lock — POST /sap/bc/adt/businessservices/bindings/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getServiceBinding().publishByServiceType — POST /sap/bc/adt/businessservices/{name}/publishjobs |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: unknown (404 (no SAP exception))) |
| getServiceBinding().read — GET /sap/bc/adt/businessservices/bindings/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getServiceBinding().readMetadata — GET /sap/bc/adt/businessservices/bindings/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getServiceBinding().readTransport — POST /sap/bc/adt/cts/transportchecks |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: not checked (200)) |
| getServiceBinding().unlock — POST /sap/bc/adt/businessservices/bindings/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getServiceBinding().unpublishByServiceType — POST /sap/bc/adt/businessservices/{name}/unpublishjobs |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: unknown (404 (no SAP exception))) |
| getServiceBinding().updateRequest — POST /sap/bc/adt/businessservices/undefined/unpublishjobs |  |  |  |  |  | unknown (Accept: unknown (skipped: builds no address from the probe name alone (/sap/bc/adt/businessservices/undefined/unpublishjobs)); Content-Type: unknown (skipped: builds no address from the probe name alone (/sap/bc/adt/businessservices/undefined/unpublishjobs))) |
| getServiceBinding().validate — POST /sap/bc/adt/cts/transportchecks |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: unknown (400 ExceptionDataTypeNotFound)) |
| getServiceDefinition().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getServiceDefinition().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getServiceDefinition().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getServiceDefinition().create — POST /sap/bc/adt/ddic/srvd/sources | Accept application/vnd.sap.adt.ddic.srvd.v1+xml; Content-Type application/vnd.sap.adt.ddic.srvd.v1+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getServiceDefinition().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getServiceDefinition().getVersions — GET /sap/bc/adt/ddic/srvd/sources/{name}/source/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getServiceDefinition().lock — POST /sap/bc/adt/ddic/srvd/sources/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getServiceDefinition().read — GET /sap/bc/adt/ddic/srvd/sources/{name}/source/main |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getServiceDefinition().readMetadata — GET /sap/bc/adt/ddic/srvd/sources/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getServiceDefinition().readTransport — GET /sap/bc/adt/ddic/srvd/sources/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getServiceDefinition().unlock — POST /sap/bc/adt/ddic/srvd/sources/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getServiceDefinition().update — PUT /sap/bc/adt/ddic/srvd/sources/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body) |
| getServiceDefinition().validate — POST /sap/bc/adt/ddic/srvd/sources/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getSt05Trace().getDirectory — GET /sap/bc/adt/st05/trace/directory |  |  |  | application/vnd.sap.adt.perf.trace.directory.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getSt05Trace().getState — GET /sap/bc/adt/st05/trace/state |  |  |  | application/vnd.sap.adt.perf.trace.state.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getStructure().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getStructure().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getStructure().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getStructure().create — POST /sap/bc/adt/ddic/structures | Accept application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml; Content-Type application/vnd.sap.adt.structures.v2+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getStructure().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getStructure().getVersions — GET /sap/bc/adt/ddic/structures/{name}/source/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getStructure().lock — POST /sap/bc/adt/ddic/structures/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getStructure().read — GET /sap/bc/adt/ddic/structures/{name}/source/main |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getStructure().readMetadata — GET /sap/bc/adt/ddic/structures/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getStructure().readTransport — GET /sap/bc/adt/ddic/structures/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getStructure().unlock — POST /sap/bc/adt/ddic/structures/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getStructure().update — PUT /sap/bc/adt/ddic/structures/{name}/source/main | Accept application/xml, application/json, text/plain, */*; Content-Type text/plain; charset=utf-8 |  |  |  |  | content-type (Accept: unknown (404 Error); Content-Type: checked (415)) |
| getStructure().validate — POST /sap/bc/adt/ddic/structures/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getSystemMessages().getById — GET /sap/bc/adt/runtime/systemmessages/{name} |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getSystemMessages().list — GET /sap/bc/adt/runtime/systemmessages |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getTable().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getTable().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getTable().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getTable().create — POST /sap/bc/adt/ddic/tables | Accept application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.tables.v2+xml; Content-Type application/vnd.sap.adt.tables.v2+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getTable().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getTable().getVersions — GET /sap/bc/adt/ddic/tables/{name}/source/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getTable().lock — POST /sap/bc/adt/ddic/tables/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getTable().read — GET /sap/bc/adt/ddic/tables/{name}/source/main |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getTable().readMetadata — GET /sap/bc/adt/ddic/tables/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getTable().readTransport — GET /sap/bc/adt/ddic/tables/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getTable().unlock — POST /sap/bc/adt/ddic/tables/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getTable().update — PUT /sap/bc/adt/ddic/tables/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | content-type (Accept: unknown (404 Error); Content-Type: checked (415)) |
| getTable().validate — POST /sap/bc/adt/ddic/tables/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getTableType().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/vnd.sap.adt.activation+xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getTableType().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getTableType().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getTableType().create — POST /sap/bc/adt/ddic/tabletypes | Accept application/vnd.sap.adt.tabletype.v1+xml; Content-Type application/vnd.sap.adt.tabletype.v1+xml |  |  |  |  | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getTableType().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getTableType().getVersions — GET /sap/bc/adt/ddic/tabletypes/{name}/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getTableType().lock — POST /sap/bc/adt/ddic/tabletypes/{name}?_action=LOCK |  |  |  |  |  | accept (Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body) |
| getTableType().readMetadata — GET /sap/bc/adt/ddic/tabletypes/{name} |  |  |  |  |  | accept (Accept: checked (037, inferred from the contrast); Content-Type: no body) |
| getTableType().readTransport — GET /sap/bc/adt/ddic/tabletypes/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getTableType().unlock — POST /sap/bc/adt/ddic/tabletypes/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getTableType().updateMetadata — PUT /sap/bc/adt/ddic/tabletypes/{name} | Accept application/vnd.sap.adt.tabletype.v1+xml; Content-Type application/vnd.sap.adt.tabletype.v1+xml |  |  |  |  | both (Accept: checked (037, inferred from the contrast); Content-Type: checked (415)) |
| getTableType().validate — POST /sap/bc/adt/ddic/tabletypes/validation |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getTransformation().activate — POST /sap/bc/adt/activation | Accept application/xml; Content-Type application/xml |  |  |  |  | neither (Accept: not checked (200); Content-Type: not checked (200)) |
| getTransformation().check — POST /sap/bc/adt/checkruns | Accept application/vnd.sap.adt.checkmessages+xml; Content-Type application/vnd.sap.adt.checkobjects+xml |  | application/vnd.sap.adt.checkobjects+xml | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getTransformation().checkDeletion — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getTransformation().create — POST /sap/bc/adt/xslt/transformations | Accept application/vnd.sap.adt.transformations+xml; Content-Type application/vnd.sap.adt.transformations+xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getTransformation().delete — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getTransformation().getVersions — GET /sap/bc/adt/xslt/transformations/{name}/source/main/versions |  |  |  | application/atom+xml, application/atom+xml;type=feed |  | accept (Accept: checked (406); Content-Type: no body) |
| getTransformation().lock — POST /sap/bc/adt/xslt/transformations/{name}?_action=LOCK |  |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getTransformation().read — GET /sap/bc/adt/xslt/transformations/{name}/source/main |  |  |  | text/plain |  | accept (Accept: checked (406); Content-Type: no body) |
| getTransformation().readMetadata — GET /sap/bc/adt/xslt/transformations/{name} |  |  |  | application/vnd.sap.adt.transformations+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getTransformation().readTransport — GET /sap/bc/adt/xslt/transformations/{name}/transport |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getTransformation().unlock — POST /sap/bc/adt/xslt/transformations/{name}?_action=UNLOCK |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getTransformation().update — PUT /sap/bc/adt/xslt/transformations/{name}/source/main | Accept text/plain; Content-Type text/plain; charset=utf-8 |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getTransformation().validate — POST /sap/bc/adt/xslt/validation |  |  |  |  |  | unknown (Accept: unknown (404 (no SAP exception)); Content-Type: no body) |
| getUtils().activateObjectsGroup — POST /sap/bc/adt/activation/runs | Accept application/xml; Content-Type application/xml |  |  |  |  | unknown (Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData)) |
| getUtils().checkDeletionGroup — POST /sap/bc/adt/deletion/check | Accept application/vnd.sap.adt.deletion.check.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.check.request.v1+xml |  |  | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getUtils().deleteObjectsGroup — POST /sap/bc/adt/deletion/delete | Accept application/vnd.sap.adt.deletion.response.v1+xml; Content-Type application/vnd.sap.adt.deletion.request.v1+xml |  |  | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml | both (Accept: checked (406); Content-Type: checked (415)) |
| getUtils().discovery — GET /sap/bc/adt/discovery |  |  |  | application/atomsvc+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getUtils().fetchNodeStructure — POST /sap/bc/adt/repository/nodestructure | Accept application/vnd.sap.as+xml;dataname=com.sap.adt.RepositoryObjectTreeContent, application/vnd.sap.adt.repository.nodestructure.v1+xml, application/xml; Content-Type application/vnd.sap.as+xml; charset=UTF-8; dataname=null |  |  | application/vnd.sap.as+xml |  | accept (Accept: checked (406); Content-Type: not checked (200)) |
| getUtils().getActivationResults — GET /sap/bc/adt/activation/results/{name} |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getUtils().getActivationRun — GET /sap/bc/adt/activation/runs/{name} |  |  |  | application/vnd.sap.adt.backgroundrun.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getUtils().getAllTypes — GET /sap/bc/adt/repository/informationsystem/objecttypes |  |  |  |  |  | unknown (Accept: unknown (400 ExceptionParameterValueInvalid); Content-Type: no body) |
| getUtils().getInactiveObjects — GET /sap/bc/adt/activation/inactiveobjects |  |  |  |  |  | neither (Accept: not checked (200); Content-Type: no body) |
| getUtils().getInclude — GET /sap/bc/adt/programs/includes/{name}/source/main |  |  |  |  |  | unknown (Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403)) |
| getUtils().getObjectStructure — GET /sap/bc/adt/repository/objectstructure |  |  |  | application/vnd.sap.adt.projectexplorer.objectstructure+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getUtils().getSqlQuery — POST /sap/bc/adt/datapreview/freestyle | Accept application/xml, application/vnd.sap.adt.datapreview.table.v1+xml; Content-Type text/plain; charset=utf-8 |  |  |  |  | unknown (Accept: unknown (400 ExceptionDataPreviewGeneral); Content-Type: no body) |
| getUtils().getTableColumns — GET /sap/bc/adt/datapreview/ddic/{name}/metadata |  |  |  | application/vnd.sap.adt.datapreview.table.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getUtils().getTableContents — POST /sap/bc/adt/datapreview/ddic | Accept application/xml, application/vnd.sap.adt.datapreview.table.v1+xml; Content-Type text/plain; charset=utf-8 |  |  | application/vnd.sap.adt.datapreview.table.v1+xml |  | accept (Accept: checked (406); Content-Type: no body) |
| getUtils().getVirtualFoldersContents — POST /sap/bc/adt/repository/informationsystem/virtualfolders/contents | Accept application/vnd.sap.adt.repository.virtualfolders.result.v1+xml; Content-Type application/vnd.sap.adt.repository.virtualfolders.request.v1+xml |  |  |  | application/vnd.sap.adt.repository.virtualfolders.request.v1+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getUtils().getWhereUsed — POST /sap/bc/adt/repository/informationsystem/usageReferences | Accept application/vnd.sap.adt.repository.usagereferences.result.v1+xml; Content-Type application/vnd.sap.adt.repository.usagereferences.request.v1+xml |  |  |  | application/vnd.sap.adt.repository.usagereferences.request.v1+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getUtils().getWhereUsedScope — POST /sap/bc/adt/repository/informationsystem/usageReferences/scope | Accept application/vnd.sap.adt.repository.usagereferences.scope.response.v1+xml; Content-Type application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml |  |  |  | application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml | content-type (Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415)) |
| getUtils().readObjectMetadata — GET /sap/bc/adt/programs/programs/{name} |  |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| getUtils().readObjectSource — GET /sap/bc/adt/programs/programs/{name}/source/main |  |  |  |  |  | unknown (Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body) |
| getUtils().search — GET /sap/bc/adt/repository/informationsystem/search |  |  |  | application/xml |  | accept (Accept: checked (406); Content-Type: no body) |

## What each endpoint needs: clients

| needs | endpoints |
|---|---|
| accept | 179 |
| content-type | 33 |
| both | 74 |
| neither | 70 |
| unknown | 234 |

#### needs: accept

| endpoint | detail | Accept named | Content-Type named | the pair table |
|---|---|---|---|---|
| getAccessControl().getVersions — GET /sap/bc/adt/acm/dcl/sources/{name}/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getAccessControl().lock — POST /sap/bc/adt/acm/dcl/sources/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getAccessControl().read — GET /sap/bc/adt/acm/dcl/sources/{name}/source/main | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getAccessControl().readMetadata — GET /sap/bc/adt/acm/dcl/sources/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.dclSource+xml |  |  |
| getAccessControl().validate — POST /sap/bc/adt/acm/dcl/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getAppendStructure().validate — POST /sap/bc/adt/ddic/structures/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getApplicationLog().getObject — GET /sap/bc/adt/applicationlog/objects/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getApplicationLog().getSource — GET /sap/bc/adt/applicationlog/objects/{name}/source/main | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getAtc().getFindings — GET /sap/bc/adt/atc/worklists/{name} | Accept: checked (406); Content-Type: no body | application/atc.worklist.v1+xml |  |  |
| getAtc().getRunStatus — GET /sap/bc/adt/atc/runs/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.atc.run.v1+xml |  |  |
| getAtc().listCheckVariants — GET /sap/bc/adt/atc/variants | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| getAtc().resolveCheckVariant — GET /sap/bc/adt/atc/customizing | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| getAuthorizationField().lock — POST /sap/bc/adt/aps/iam/auth/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getAuthorizationField().readMetadata — GET /sap/bc/adt/aps/iam/auth/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getAuthorizationField().validate — POST /sap/bc/adt/aps/iam/auth/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getBehaviorDefinition().getVersions — GET /sap/bc/adt/bo/behaviordefinitions/{name}/source/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getBehaviorDefinition().lock — POST /sap/bc/adt/bo/behaviordefinitions/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: not checked (200) |  |  |  |
| getBehaviorDefinition().read — GET /sap/bc/adt/bo/behaviordefinitions/{name}/source/main | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getBehaviorDefinition().readMetadata — GET /sap/bc/adt/bo/behaviordefinitions/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getBehaviorDefinition().validate — POST /sap/bc/adt/bo/behaviordefinitions/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getBehaviorImplementation().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/implementations/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getBehaviorImplementation().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getBehaviorImplementation().read — GET /sap/bc/adt/oo/classes/{name}/source/main | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getBehaviorImplementation().readMetadata — GET /sap/bc/adt/oo/classes/{name} | Accept: checked (406); Content-Type: no body |  |  |  |
| getClass().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getClass().includeVersions — GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getClass().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getClass().read — GET /sap/bc/adt/oo/classes/{name}/source/main | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getClass().readEnhancementElements — GET /sap/bc/adt/oo/classes/{name}/source/main/enhancements/elements | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.enhancements.v3+xml |  |  |
| getClass().readEnhancementOptions — GET /sap/bc/adt/oo/classes/{name}/enhancements/options | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.enhancementoptions.v2+xml |  |  |
| getClass().readMetadata — GET /sap/bc/adt/oo/classes/{name} | Accept: checked (406); Content-Type: no body |  |  |  |
| getClass().update — PUT /sap/bc/adt/oo/classes/{name}/source/main | Accept: checked (406); Content-Type: no body | text/plain |  | the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getClassExecutor().listObjectTypes — GET /sap/bc/adt/runtime/traces/abaptraces/objecttypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| getClassExecutor().listProcessTypes — GET /sap/bc/adt/runtime/traces/abaptraces/processtypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| getClassExecutor().listRequests — GET /sap/bc/adt/runtime/traces/abaptraces/requests | Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body |  |  |  |
| getClassExecutor().run — POST /sap/bc/adt/oo/classrun/{name} | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getClassExecutor().runWithProfiler — POST /sap/bc/adt/oo/classrun/{name} | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getClassTestRunner().getResult — GET /sap/bc/adt/abapunit/results/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.api.junit.run-result.v1+xml |  |  |
| getClassTestRunner().getStatus — GET /sap/bc/adt/abapunit/runs/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.api.abapunit.run-status.v1+xml |  |  |
| getCrossTrace().getActivations — GET /sap/bc/adt/crosstrace/activations | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.crosstrace.activations.v1+xml |  |  |
| getCrossTrace().getById — GET /sap/bc/adt/crosstrace/traces/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.crosstrace.traces.v1+xml |  |  |
| getCrossTrace().getRecordContent — GET /sap/bc/adt/crosstrace/traces/{name}/records/{name}/content | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getCrossTrace().getRecords — GET /sap/bc/adt/crosstrace/traces/{name}/records | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.crosstrace.records.v1+xml |  |  |
| getCrossTrace().list — GET /sap/bc/adt/crosstrace/traces | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.crosstrace.traces.v1+xml |  |  |
| getDataElement().lock — POST /sap/bc/adt/ddic/dataelements/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getDataElement().readMetadata — GET /sap/bc/adt/ddic/dataelements/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getDataElement().validate — POST /sap/bc/adt/ddic/dataelements/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getDdicActivation().getGraph — GET /sap/bc/adt/ddic/logs/activationgraph | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddic.acivationLog.v1+xml |  |  |
| getDdl().checkCdsTestDoubles — POST /sap/bc/adt/aunit/dbtestdoubles/cds/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getDdl().getVersions — GET /sap/bc/adt/ddic/ddl/sources/{name}/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getDdl().lock — POST /sap/bc/adt/ddic/ddl/sources/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getDdl().read — GET /sap/bc/adt/ddic/ddl/sources/{name}/source/main | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getDdl().readMetadata — GET /sap/bc/adt/ddic/ddl/sources/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddlSource+xml |  |  |
| getDdl().validate — POST /sap/bc/adt/ddic/ddl/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getDomain().lock — POST /sap/bc/adt/ddic/domains/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getDomain().readMetadata — GET /sap/bc/adt/ddic/domains/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getDomain().validate — POST /sap/bc/adt/ddic/domains/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getDumps().list — GET /sap/bc/adt/runtime/dumps | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getDumps().listByUser — GET /sap/bc/adt/runtime/dumps | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getEnhancement().readMetadata — GET /sap/bc/adt/enhancements/enhoxhb/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getEnhancement().validate — POST /sap/bc/adt/enhancements/enhoxhb/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getFeeds().dumps — GET /sap/bc/adt/runtime/dumps | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getFeeds().gatewayErrors — GET /sap/bc/adt/gw/errorlog | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getFeeds().list — GET /sap/bc/adt/feeds | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getFeeds().systemMessages — GET /sap/bc/adt/runtime/systemmessages | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getFunctionGroup().lock — POST /sap/bc/adt/functions/groups/{name}?_action=LOCK | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getFunctionGroup().readEnhancementElements — GET /sap/bc/adt/functions/groups/{name}/source/main/enhancements/elements | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.enhancements.v3+xml |  |  |
| getFunctionGroup().readEnhancementOptions — GET /sap/bc/adt/functions/groups/{name}/enhancements/options | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.enhancementoptions.v2+xml |  |  |
| getFunctionGroup().readMetadata — GET /sap/bc/adt/functions/groups/{name} | Accept: checked (406); Content-Type: no body |  |  |  |
| getFunctionGroup().validate — POST /sap/bc/adt/functions/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getFunctionGroupTestRunner().getResult — GET /sap/bc/adt/abapunit/results/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.api.junit.run-result.v1+xml |  |  |
| getFunctionGroupTestRunner().getStatus — GET /sap/bc/adt/abapunit/runs/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.api.abapunit.run-status.v1+xml |  |  |
| getFunctionGroupTestRunner().runSync — POST /sap/bc/adt/abapunit/testruns | Accept: checked (406); Content-Type: unknown (400 ExceptionInvalidData) | application/xml |  |  |
| getFunctionInclude().getVersions — GET /sap/bc/adt/functions/groups/{name}/includes/{name}/source/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getFunctionInclude().lock — POST /sap/bc/adt/functions/groups/{name}/includes/{name}?_action=LOCK | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getFunctionInclude().read — GET /sap/bc/adt/functions/groups/{name}/includes/{name}/source/main | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getFunctionInclude().readMetadata — GET /sap/bc/adt/functions/groups/{name}/includes/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.functions.fincludes.v2+xml |  |  |
| getFunctionModule().getVersions — GET /sap/bc/adt/functions/groups/{name}/fmodules/{name}/source/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getFunctionModule().read — GET /sap/bc/adt/functions/groups/{name}/fmodules/{name}/source/main | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getFunctionModule().readMetadata — GET /sap/bc/adt/functions/groups/{name}/fmodules/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.functions.fmodules.v3+xml |  |  |
| getFunctionModule().validate — POST /sap/bc/adt/functions/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getFunctionModuleTestRunner().getResult — GET /sap/bc/adt/abapunit/results/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.api.junit.run-result.v1+xml |  |  |
| getFunctionModuleTestRunner().getStatus — GET /sap/bc/adt/abapunit/runs/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.api.abapunit.run-status.v1+xml |  |  |
| getGatewayErrorLog().list — GET /sap/bc/adt/gw/errorlog | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getInclude().validate — POST /sap/bc/adt/includes/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getInterface().getVersions — GET /sap/bc/adt/oo/interfaces/{name}/source/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getInterface().lock — POST /sap/bc/adt/oo/interfaces/{name}?_action=LOCK | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getInterface().read — GET /sap/bc/adt/oo/interfaces/{name}/source/main | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getInterface().readMetadata — GET /sap/bc/adt/oo/interfaces/{name} | Accept: checked (406); Content-Type: no body |  |  |  |
| getLocalDefinitions().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/definitions/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getLocalDefinitions().includeVersions — GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getLocalDefinitions().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getLocalDefinitions().read — GET /sap/bc/adt/oo/classes/{name}/includes/definitions | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getLocalDefinitions().readMetadata — GET /sap/bc/adt/oo/classes/{name} | Accept: checked (406); Content-Type: no body |  |  |  |
| getLocalMacros().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/macros/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getLocalMacros().includeVersions — GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getLocalMacros().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getLocalMacros().read — GET /sap/bc/adt/oo/classes/{name}/includes/macros | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getLocalMacros().readMetadata — GET /sap/bc/adt/oo/classes/{name} | Accept: checked (406); Content-Type: no body |  |  |  |
| getLocalTestClass().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/testclasses/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getLocalTestClass().includeVersions — GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getLocalTestClass().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getLocalTestClass().read — GET /sap/bc/adt/oo/classes/{name}/includes/testclasses | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getLocalTestClass().readMetadata — GET /sap/bc/adt/oo/classes/{name} | Accept: checked (406); Content-Type: no body |  |  |  |
| getLocalTypes().getVersions — GET /sap/bc/adt/oo/classes/{name}/includes/implementations/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getLocalTypes().includeVersions — GET /sap/bc/adt/oo/classes/{name}/includes/{name}/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getLocalTypes().lock — POST /sap/bc/adt/oo/classes/{name}?_action=LOCK | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getLocalTypes().read — GET /sap/bc/adt/oo/classes/{name}/includes/implementations | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getLocalTypes().readMetadata — GET /sap/bc/adt/oo/classes/{name} | Accept: checked (406); Content-Type: no body |  |  |  |
| getMessageClass().readMetadata — GET /sap/bc/adt/messageclass/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.mc.messageclass+xml |  |  |
| getMessageClassMessage().delete — POST /sap/bc/adt/messageclass/{name}/messages/001?_action=LOCK_MSG | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.mc.messageclass+xml |  | the pair table lists Content-Type application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8 for a request without a body |
| getMessageClassMessage().read — GET /sap/bc/adt/messageclass/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.mc.messageclass+xml |  |  |
| getMessageClassMessage().readMetadata — GET /sap/bc/adt/messageclass/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.mc.messageclass+xml |  |  |
| getMessageClassMessage().update — POST /sap/bc/adt/messageclass/{name}/messages/001?_action=LOCK_MSG | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.mc.messageclass+xml |  | the pair table lists Content-Type application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8 for a request without a body |
| getMessageClassMessage().writeClass — POST /sap/bc/adt/messageclass/{name}/messages/001?_action=LOCK_MSG | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.mc.messageclass+xml |  |  |
| getMetadataExtension().getVersions — GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getMetadataExtension().lock — POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getMetadataExtension().read — GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getMetadataExtension().readMetadata — GET /sap/bc/adt/ddic/ddlx/sources/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getMetadataExtension().validate — POST /sap/bc/adt/ddic/ddlx/sources/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getPackage().validate — POST /sap/bc/adt/packages/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getProfiler().list — GET /sap/bc/adt/runtime/traces/abaptraces | Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body |  |  |  |
| getProgram().validate — POST /sap/bc/adt/programs/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getProgramExecutor().listObjectTypes — GET /sap/bc/adt/runtime/traces/abaptraces/objecttypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| getProgramExecutor().listProcessTypes — GET /sap/bc/adt/runtime/traces/abaptraces/processtypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| getProgramExecutor().listRequests — GET /sap/bc/adt/runtime/traces/abaptraces/requests | Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body |  |  |  |
| getProgramExecutor().run — POST /sap/bc/adt/programs/programrun/{name} | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getProgramExecutor().runWithProfiler — POST /sap/bc/adt/programs/programrun/{name} | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getProgramTestRunner().getResult — GET /sap/bc/adt/abapunit/results/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.api.junit.run-result.v1+xml |  |  |
| getProgramTestRunner().getStatus — GET /sap/bc/adt/abapunit/runs/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.api.abapunit.run-status.v1+xml |  |  |
| getProgramTestRunner().runSync — POST /sap/bc/adt/abapunit/testruns | Accept: checked (406); Content-Type: unknown (400 ExceptionInvalidData) | application/xml |  |  |
| getRequest().readActionLog — GET /sap/bc/adt/cts/transportrequests/{name}/actionlogs | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.logs+xml |  |  |
| getRequest().searchConfigurations — GET /sap/bc/adt/cts/transportrequests/searchconfiguration/configurations | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.configurations.v1+xml |  |  |
| getScalarFunction().getVersions — GET /sap/bc/adt/ddic/dsfd/sources/{name}/source/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getScalarFunction().lock — POST /sap/bc/adt/ddic/dsfd/sources/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getScalarFunction().read — GET /sap/bc/adt/ddic/dsfd/sources/{name}/source/main | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getScalarFunction().readMetadata — GET /sap/bc/adt/ddic/dsfd/sources/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getScalarFunction().validate — POST /sap/bc/adt/ddic/dsfd/sources/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getScalarFunctionImplementation().validate — POST /sap/bc/adt/ddic/dsfi/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getServiceBinding().getServiceBindingTypes — GET /sap/bc/adt/businessservices/bindings/bindingtypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| getServiceBinding().lock — POST /sap/bc/adt/businessservices/bindings/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getServiceBinding().read — GET /sap/bc/adt/businessservices/bindings/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getServiceBinding().readMetadata — GET /sap/bc/adt/businessservices/bindings/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getServiceBinding().readTransport — POST /sap/bc/adt/cts/transportchecks | Accept: checked (406); Content-Type: not checked (200) | application/vnd.sap.as+xml |  |  |
| getServiceBinding().validate — POST /sap/bc/adt/cts/transportchecks | Accept: checked (406); Content-Type: unknown (400 ExceptionDataTypeNotFound) | application/vnd.sap.as+xml |  |  |
| getServiceDefinition().getVersions — GET /sap/bc/adt/ddic/srvd/sources/{name}/source/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getServiceDefinition().lock — POST /sap/bc/adt/ddic/srvd/sources/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getServiceDefinition().read — GET /sap/bc/adt/ddic/srvd/sources/{name}/source/main | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getServiceDefinition().readMetadata — GET /sap/bc/adt/ddic/srvd/sources/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getServiceDefinition().validate — POST /sap/bc/adt/ddic/srvd/sources/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getSt05Trace().getDirectory — GET /sap/bc/adt/st05/trace/directory | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.perf.trace.directory.v1+xml |  |  |
| getSt05Trace().getState — GET /sap/bc/adt/st05/trace/state | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.perf.trace.state.v1+xml |  |  |
| getStructure().getVersions — GET /sap/bc/adt/ddic/structures/{name}/source/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getStructure().lock — POST /sap/bc/adt/ddic/structures/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getStructure().read — GET /sap/bc/adt/ddic/structures/{name}/source/main | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getStructure().readMetadata — GET /sap/bc/adt/ddic/structures/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getStructure().validate — POST /sap/bc/adt/ddic/structures/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getSystemMessages().list — GET /sap/bc/adt/runtime/systemmessages | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getTable().getVersions — GET /sap/bc/adt/ddic/tables/{name}/source/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getTable().lock — POST /sap/bc/adt/ddic/tables/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getTable().read — GET /sap/bc/adt/ddic/tables/{name}/source/main | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getTable().readMetadata — GET /sap/bc/adt/ddic/tables/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getTable().validate — POST /sap/bc/adt/ddic/tables/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getTableType().getVersions — GET /sap/bc/adt/ddic/tabletypes/{name}/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getTableType().lock — POST /sap/bc/adt/ddic/tabletypes/{name}?_action=LOCK | Accept: checked (406 without a list (T100 SADT_RESOURCE 039), inferred from the contrast); Content-Type: no body |  |  |  |
| getTableType().readMetadata — GET /sap/bc/adt/ddic/tabletypes/{name} | Accept: checked (037, inferred from the contrast); Content-Type: no body |  |  |  |
| getTableType().validate — POST /sap/bc/adt/ddic/tabletypes/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getTransformation().getVersions — GET /sap/bc/adt/xslt/transformations/{name}/source/main/versions | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| getTransformation().lock — POST /sap/bc/adt/xslt/transformations/{name}?_action=LOCK | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| getTransformation().read — GET /sap/bc/adt/xslt/transformations/{name}/source/main | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| getTransformation().readMetadata — GET /sap/bc/adt/xslt/transformations/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.transformations+xml |  |  |
| getUtils().discovery — GET /sap/bc/adt/discovery | Accept: checked (406); Content-Type: no body | application/atomsvc+xml |  |  |
| getUtils().fetchNodeStructure — POST /sap/bc/adt/repository/nodestructure | Accept: checked (406); Content-Type: not checked (200) | application/vnd.sap.as+xml |  | the pair table lists Content-Type application/vnd.sap.as+xml; charset=UTF-8; dataname=null; the resource does not check Content-Type (a bogus one got 200) |
| getUtils().getActivationResults — GET /sap/bc/adt/activation/results/{name} | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| getUtils().getActivationRun — GET /sap/bc/adt/activation/runs/{name} | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.backgroundrun.v1+xml |  |  |
| getUtils().getObjectStructure — GET /sap/bc/adt/repository/objectstructure | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.projectexplorer.objectstructure+xml |  |  |
| getUtils().getTableColumns — GET /sap/bc/adt/datapreview/ddic/{name}/metadata | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.datapreview.table.v1+xml |  |  |
| getUtils().getTableContents — POST /sap/bc/adt/datapreview/ddic | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.datapreview.table.v1+xml |  | the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getUtils().search — GET /sap/bc/adt/repository/informationsystem/search | Accept: checked (406); Content-Type: no body | application/xml |  |  |

#### needs: content-type

| endpoint | detail | Accept named | Content-Type named | the pair table |
|---|---|---|---|---|
| getAccessControl().create — POST /sap/bc/adt/acm/dcl/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getAuthorizationField().create — POST /sap/bc/adt/aps/iam/auth | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/auth}auth' System expected the element '{http://www.sap.com/iam/auth}auth' 00 001 System expected the element '{http://www.sap.com/i am/auth}auth'); Content-Type: checked (415) |  |  |  |
| getAuthorizationField().updateMetadata — PUT /sap/bc/adt/aps/iam/auth/{name} | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getBehaviorDefinition().create — POST /sap/bc/adt/bo/behaviordefinitions | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getClassTestRunner().startByObject — POST /sap/bc/adt/abapunit/runs | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.api.abapunit.run.v1+xml |  |
| getDataElement().create — POST /sap/bc/adt/ddic/dataelements | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getDdl().create — POST /sap/bc/adt/ddic/ddl/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getDdl().update — PUT /sap/bc/adt/ddic/ddl/sources/{name}/source/main | Accept: unknown (404 Error); Content-Type: checked (415) |  |  |  |
| getDomain().create — POST /sap/bc/adt/ddic/domains | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getEnhancement().check — POST /sap/bc/adt/checkruns | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.checkobjects+xml |  |
| getEnhancement().create — POST /sap/bc/adt/enhancements/enhoxhb | Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: checked (415) |  |  |  |
| getFeatureToggle().check — POST /sap/bc/adt/checkruns | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.checkobjects+xml |  |
| getFunctionGroupTestRunner().run — POST /sap/bc/adt/abapunit/runs | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.api.abapunit.run.v1+xml |  |
| getFunctionInclude().create — POST /sap/bc/adt/functions/groups/{name}/includes | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.functions.fincludes.v2+xml |  |
| getLocalDefinitions().validate — POST /sap/bc/adt/checkruns | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.checkobjects+xml |  |
| getLocalMacros().validate — POST /sap/bc/adt/checkruns | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.checkobjects+xml |  |
| getLocalTestClass().validate — POST /sap/bc/adt/checkruns | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.checkobjects+xml |  |
| getLocalTypes().validate — POST /sap/bc/adt/checkruns | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.checkobjects+xml |  |
| getMetadataExtension().create — POST /sap/bc/adt/ddic/ddlx/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getPackage().create — POST /sap/bc/adt/packages | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getProgramTestRunner().run — POST /sap/bc/adt/abapunit/runs | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.api.abapunit.run.v1+xml |  |
| getProgramTestRunner().startByObject — POST /sap/bc/adt/abapunit/runs | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.api.abapunit.run.v1+xml |  |
| getScalarFunction().create — POST /sap/bc/adt/ddic/dsfd/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getScalarFunctionImplementation().create — POST /sap/bc/adt/ddic/dsfi | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getServiceDefinition().create — POST /sap/bc/adt/ddic/srvd/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getStructure().create — POST /sap/bc/adt/ddic/structures | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getStructure().update — PUT /sap/bc/adt/ddic/structures/{name}/source/main | Accept: unknown (404 Error); Content-Type: checked (415) |  |  |  |
| getTable().create — POST /sap/bc/adt/ddic/tables | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getTable().update — PUT /sap/bc/adt/ddic/tables/{name}/source/main | Accept: unknown (404 Error); Content-Type: checked (415) |  |  |  |
| getTableType().create — POST /sap/bc/adt/ddic/tabletypes | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| getUtils().getVirtualFoldersContents — POST /sap/bc/adt/repository/informationsystem/virtualfolders/contents | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.repository.virtualfolders.request.v1+xml |  |
| getUtils().getWhereUsed — POST /sap/bc/adt/repository/informationsystem/usageReferences | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.repository.usagereferences.request.v1+xml |  |
| getUtils().getWhereUsedScope — POST /sap/bc/adt/repository/informationsystem/usageReferences/scope | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml |  |

#### needs: both

| endpoint | detail | Accept named | Content-Type named | the pair table |
|---|---|---|---|---|
| getAccessControl().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getAccessControl().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getAccessControl().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getAuthorizationField().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getAuthorizationField().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getAuthorizationField().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getBehaviorDefinition().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getBehaviorDefinition().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getBehaviorDefinition().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getBehaviorImplementation().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getBehaviorImplementation().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getBehaviorImplementation().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getClass().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getClass().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getClass().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getDataElement().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getDataElement().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getDataElement().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getDataElement().updateMetadata — PUT /sap/bc/adt/ddic/dataelements/{name} | Accept: checked (037, inferred from the contrast); Content-Type: checked (415) |  |  |  |
| getDdl().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getDdl().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getDdl().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getDomain().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getDomain().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getDomain().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getDomain().updateMetadata — PUT /sap/bc/adt/ddic/domains/{name} | Accept: checked (037, inferred from the contrast); Content-Type: checked (415) |  |  |  |
| getEnhancement().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getEnhancement().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getFeatureToggle().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getFeatureToggle().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getFunctionGroup().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getFunctionGroup().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getFunctionGroup().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getFunctionInclude().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getFunctionInclude().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getFunctionInclude().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getFunctionModule().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getFunctionModule().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getFunctionModule().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getInterface().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getInterface().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getInterface().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getLocalDefinitions().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getLocalMacros().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getLocalTestClass().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getLocalTypes().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getMessageClass().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getMessageClass().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getMetadataExtension().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getMetadataExtension().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getScalarFunction().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getScalarFunction().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getScalarFunction().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getServiceBinding().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getServiceBinding().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getServiceBinding().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getServiceDefinition().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getServiceDefinition().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getServiceDefinition().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getStructure().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getStructure().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getStructure().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getTable().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getTable().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getTable().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getTableType().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getTableType().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getTableType().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getTableType().updateMetadata — PUT /sap/bc/adt/ddic/tabletypes/{name} | Accept: checked (037, inferred from the contrast); Content-Type: checked (415) |  |  |  |
| getTransformation().check — POST /sap/bc/adt/checkruns | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.checkmessages+xml | application/vnd.sap.adt.checkobjects+xml |  |
| getTransformation().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getTransformation().delete — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |
| getUtils().checkDeletionGroup — POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.check.response.v1+xml | application/vnd.sap.adt.deletion.check.request.v1+xml |  |
| getUtils().deleteObjectsGroup — POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: checked (415) | application/vnd.sap.adt.deletion.response.v1+xml | application/vnd.sap.adt.deletion.request.v1+xml |  |

#### needs: neither

| endpoint | detail | Accept named | Content-Type named | the pair table |
|---|---|---|---|---|
| getAccessControl().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/xml; the resource does not check Content-Type (a bogus one got 200) |
| getAccessControl().unlock — POST /sap/bc/adt/acm/dcl/sources/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getAtcLog().getCheckFailureLogs — GET /sap/bc/adt/atc/checkfailures/logs | Accept: not checked (200); Content-Type: no body |  |  |  |
| getAuthorizationField().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/xml; the resource does not check Content-Type (a bogus one got 200) |
| getAuthorizationField().unlock — POST /sap/bc/adt/aps/iam/auth/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getBehaviorDefinition().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getBehaviorDefinition().unlock — POST /sap/bc/adt/bo/behaviordefinitions/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getBehaviorImplementation().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getBehaviorImplementation().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getBehaviorImplementation().update — PUT /sap/bc/adt/oo/classes/{name}/includes/implementations | Accept: not checked (200); Content-Type: no body |  |  | the pair table lists Accept text/plain; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getBehaviorImplementation().validate — POST /sap/bc/adt/oo/validation/objectname | Accept: not checked (200); Content-Type: no body |  |  |  |
| getClass().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getClass().activateTestClasses — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  |  |
| getClass().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getClass().validate — POST /sap/bc/adt/oo/validation/objectname | Accept: not checked (200); Content-Type: no body |  |  |  |
| getDataElement().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/xml; the resource does not check Content-Type (a bogus one got 200) |
| getDataElement().unlock — POST /sap/bc/adt/ddic/dataelements/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getDdl().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getDdl().unlock — POST /sap/bc/adt/ddic/ddl/sources/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getDomain().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getDomain().unlock — POST /sap/bc/adt/ddic/domains/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getEnhancement().unlock — POST /sap/bc/adt/enhancements/enhoxhb/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getFeeds().variants — GET /sap/bc/adt/feeds/variants | Accept: not checked (200); Content-Type: no body |  |  |  |
| getFunctionGroup().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/xml; the resource does not check Content-Type (a bogus one got 200) |
| getFunctionGroup().unlock — POST /sap/bc/adt/functions/groups/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getFunctionGroup().updateMetadata — PUT /sap/bc/adt/functions/groups/{name} | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/vnd.sap.adt.functions.groups.v3+xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8; the resource does not check Content-Type (a bogus one got 200) |
| getFunctionInclude().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getFunctionInclude().unlock — POST /sap/bc/adt/functions/groups/{name}/includes/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getFunctionModule().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getFunctionModule().lock — POST /sap/bc/adt/functions/groups/{name}/fmodules/{name}?_action=LOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getFunctionModule().unlock — POST /sap/bc/adt/functions/groups/{name}/fmodules/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getGatewayErrorLog().getById — GET /sap/bc/adt/gw/errorlog/{name}/{name} | Accept: not checked (200); Content-Type: no body |  |  |  |
| getInterface().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getInterface().unlock — POST /sap/bc/adt/oo/interfaces/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: not checked (200) |  |  |  |
| getInterface().validate — POST /sap/bc/adt/oo/validation/objectname | Accept: not checked (200); Content-Type: no body |  |  |  |
| getLocalDefinitions().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getLocalDefinitions().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getLocalDefinitions().update — PUT /sap/bc/adt/oo/classes/{name}/includes/definitions | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept text/plain; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type text/plain; charset=utf-8; the resource does not check Content-Type (a bogus one got 200) |
| getLocalMacros().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getLocalMacros().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getLocalMacros().update — PUT /sap/bc/adt/oo/classes/{name}/includes/macros | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept text/plain; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type text/plain; charset=utf-8; the resource does not check Content-Type (a bogus one got 200) |
| getLocalTestClass().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getLocalTestClass().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getLocalTestClass().update — PUT /sap/bc/adt/oo/classes/{name}/includes/testclasses | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept text/plain; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type text/plain; charset=utf-8; the resource does not check Content-Type (a bogus one got 200) |
| getLocalTypes().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getLocalTypes().unlock — POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getLocalTypes().update — PUT /sap/bc/adt/oo/classes/{name}/includes/implementations | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept text/plain; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type text/plain; charset=utf-8; the resource does not check Content-Type (a bogus one got 200) |
| getMessageClass().lock — POST /sap/bc/adt/messageclass/{name}?_action=LOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getMessageClass().unlock — POST /sap/bc/adt/messageclass/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getMessageClass().updateMetadata — PUT /sap/bc/adt/messageclass/{name} | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/vnd.sap.adt.mc.messageclass+xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8; the resource does not check Content-Type (a bogus one got 200) |
| getMessageClass().validate — POST /sap/bc/adt/messageclass/validation | Accept: not checked (200); Content-Type: no body |  |  |  |
| getMetadataExtension().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getMetadataExtension().unlock — POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getRequest().delete — DELETE /sap/bc/adt/cts/transportrequests/{name} | Accept: not checked (200); Content-Type: no body |  |  | the pair table lists Accept application/vnd.sap.adt.transportorganizer.v1+xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.transportorganizer.v1+xml for a request without a body |
| getScalarFunction().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/xml; the resource does not check Content-Type (a bogus one got 200) |
| getScalarFunction().unlock — POST /sap/bc/adt/ddic/dsfd/sources/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getServiceBinding().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/xml; the resource does not check Content-Type (a bogus one got 200) |
| getServiceBinding().unlock — POST /sap/bc/adt/businessservices/bindings/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getServiceDefinition().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/xml; the resource does not check Content-Type (a bogus one got 200) |
| getServiceDefinition().unlock — POST /sap/bc/adt/ddic/srvd/sources/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getStructure().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getStructure().unlock — POST /sap/bc/adt/ddic/structures/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getTable().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getTable().unlock — POST /sap/bc/adt/ddic/tables/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getTableType().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/vnd.sap.adt.activation+xml; the resource does not check Content-Type (a bogus one got 200) |
| getTableType().unlock — POST /sap/bc/adt/ddic/tabletypes/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getTransformation().activate — POST /sap/bc/adt/activation | Accept: not checked (200); Content-Type: not checked (200) |  |  | the pair table lists Accept application/xml; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type application/xml; the resource does not check Content-Type (a bogus one got 200) |
| getTransformation().unlock — POST /sap/bc/adt/xslt/transformations/{name}?_action=UNLOCK | Accept: not checked (200); Content-Type: no body |  |  |  |
| getTransformation().update — PUT /sap/bc/adt/xslt/transformations/{name}/source/main | Accept: not checked (200); Content-Type: no body |  |  | the pair table lists Accept text/plain; the resource does not check Accept (a bogus one got 200); the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getUtils().getInactiveObjects — GET /sap/bc/adt/activation/inactiveobjects | Accept: not checked (200); Content-Type: no body |  |  |  |

#### needs: unknown

| endpoint | detail | Accept named | Content-Type named | the pair table |
|---|---|---|---|---|
| AbapDebugger.attach — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.checkListener — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.createMemorySnapshot — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.createWatchpoint — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.deleteBreakpoint — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.deleteWatchpoint — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.detachDebugger — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.getChildVariables — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.getMemorySizes — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.getStack — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.getVariables — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.listen — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.listWatchpoints — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.reading — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.setBreakpoints — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.setDebuggerSettings — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.setStackPosition — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.setVariableValue — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.step — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.stepToLine — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.stopListener — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.syncBreakpoints — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.terminateDebuggee — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AbapDebugger.terminateDebugger — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AdtAbapGitClient.checkExternalRepo — POST /sap/bc/adt/abapgit/externalrepoinfo | Accept: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)) |  |  |  |
| AdtAbapGitClient.getErrorLog — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (logLink)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (logLink)) |  |  |  |
| AdtAbapGitClient.link — POST /sap/bc/adt/abapgit/repos | Accept: unknown (skipped: needs an external Git repository to link); Content-Type: unknown (skipped: needs an external Git repository to link) |  |  |  |
| AdtAbapGitClient.listRepos — GET /sap/bc/adt/abapgit/repos | Accept: unknown (400 (no SAP exception)); Content-Type: no body |  |  |  |
| AdtAbapGitClient.pull — POST | Accept: unknown (skipped: needs an external Git repository to link); Content-Type: unknown (skipped: needs an external Git repository to link) |  |  |  |
| AdtAbapGitClient.unlink — DELETE /sap/bc/adt/abapgit/repos/{name} | Accept: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)); Content-Type: no body |  |  |  |
| AmdpDebugger.deleteDebuggee — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AmdpDebugger.getDataPreview — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AmdpDebugger.getEvents — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AmdpDebugger.reading — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AmdpDebugger.start — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AmdpDebugger.step — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AmdpDebugger.stop — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| AmdpDebugger.syncBreakpoints — (no request) | Accept: unknown (skipped: needs a live debugging session attached to a debuggee); Content-Type: unknown (skipped: needs a live debugging session attached to a debuggee) |  |  |  |
| getAccessControl().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getAccessControl().readTransport — GET /sap/bc/adt/acm/dcl/sources/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getAccessControl().update — PUT /sap/bc/adt/acm/dcl/sources/{name}/source/main | Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body |  |  | the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getAppendStructure().activate — POST /sap/bc/adt/activation | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().check — POST /sap/bc/adt/checkruns | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().create — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Missing required parameters: append_structure_name, base_object, package_name); Content-Type: unknown (skipped: builds no request from the probe name alone: Missing required parameters: append_structure_name, base_object, package_name) |  |  |  |
| getAppendStructure().delete — POST /sap/bc/adt/deletion/delete | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().getVersions — GET /sap/bc/adt/ddic/structures/{name}/source/main/versions | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().getVersionSource — (no request) | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().lock — POST /sap/bc/adt/ddic/structures/{name}?_action=LOCK | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().read — GET /sap/bc/adt/ddic/structures/{name}/source/main | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().readMetadata — GET /sap/bc/adt/ddic/structures/{name} | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().readTransport — GET /sap/bc/adt/ddic/structures/{name}/transport | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().unlock — POST /sap/bc/adt/ddic/structures/{name}?_action=UNLOCK | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getAppendStructure().update — PUT /sap/bc/adt/ddic/structures/{name}/source/main | Accept: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404); Content-Type: unknown (skipped: the temporary appendStructure could not be made: its source write answered 404) |  |  |  |
| getApplicationLog().validateName — GET /sap/bc/adt/applicationlog/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| getAtc().assertMaximumVerdicts — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: maximumVerdicts must be a positive integer, got Z_HPEC_PROBE. The server answers 0 with a 400, and a client that can name the problem should not spend a round trip being told.); Content-Type: unknown (skipped: builds no request from the probe name alone: maximumVerdicts must be a positive integer, got Z_HPEC_PROBE. The server answers 0 with a 400, and a client that can name the problem should not spend a round trip being told.) |  |  |  |
| getAtc().assertTarget — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: ATC run needs at least one object to check.); Content-Type: unknown (skipped: builds no request from the probe name alone: ATC run needs at least one object to check.) |  |  |  |
| getAtc().createWorklist — POST /sap/bc/adt/atc/worklists | Accept: unknown (skipped: the server assigns the worklist id, so a worklist a probe made could not be found and removed); Content-Type: unknown (skipped: the server assigns the worklist id, so a worklist a probe made could not be found and removed) |  |  |  |
| getAtc().startRun — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: ATC run needs at least one object to check.); Content-Type: unknown (skipped: builds no request from the probe name alone: ATC run needs at least one object to check.) |  |  |  |
| getAtcLog().getExecutionLog — GET /sap/bc/adt/atc/results/{name}/log | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  |  |
| getBehaviorDefinition().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getBehaviorDefinition().readTransport — GET /sap/bc/adt/bo/behaviordefinitions/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getBehaviorDefinition().update — PUT /sap/bc/adt/bo/behaviordefinitions/{name}/source/main | Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body |  |  | the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getBehaviorImplementation().create — POST /sap/bc/adt/oo/classes | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getBehaviorImplementation().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getBehaviorImplementation().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getClass().create — POST /sap/bc/adt/oo/classes | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getClass().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getClass().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getClassExecutor().getRequestsByUri — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (uri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (uri)) |  |  |  |
| getClassExecutor().scheduleTrace — POST /sap/bc/adt/runtime/traces/abaptraces/parameters | Accept: unknown (skipped: the server assigns the trace request id, so a schedule a probe made could not be found and removed); Content-Type: unknown (skipped: the server assigns the trace request id, so a schedule a probe made could not be found and removed) |  |  |  |
| getClassTestRunner().run — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: tests.map is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: tests.map is not a function) |  |  |  |
| getClassTestRunner().runSync — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: target.map is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: target.map is not a function) |  |  |  |
| getClassTestRunner().startSync — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: objectUris.map is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: objectUris.map is not a function) |  |  |  |
| getDataElement().readTransport — GET /sap/bc/adt/ddic/dataelements/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getDdl().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getDdl().readTransport — GET /sap/bc/adt/ddic/ddl/sources/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getDomain().readTransport — GET /sap/bc/adt/ddic/domains/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getDumps().getById — GET /sap/bc/adt/runtime/dump/{name} | Accept: unknown (404 notFound); Content-Type: no body |  |  |  |
| getEnhancement().activate — POST /sap/bc/adt/activation | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getEnhancement().getVersions — GET /sap/bc/adt/enhancements/enhoxhb/{name}/source/main/versions | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getEnhancement().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getEnhancement().lock — POST /sap/bc/adt/enhancements/enhoxhb/{name}?_action=LOCK | Accept: unknown (skipped: sends a LOCK, and SAP grants a lock on the probe name although no object of that name exists (measured); the corpus takes no locks); Content-Type: unknown (skipped: sends a LOCK, and SAP grants a lock on the probe name although no object of that name exists (measured); the corpus takes no locks) |  |  |  |
| getEnhancement().read — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Enhancement type 'enhoxhb' does not support source code operations. Only 'enhoxhh' supports source code.); Content-Type: unknown (skipped: builds no request from the probe name alone: Enhancement type 'enhoxhb' does not support source code operations. Only 'enhoxhh' supports source code.) |  |  |  |
| getEnhancement().readTransport — GET /sap/bc/adt/enhancements/enhoxhb/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getEnhancement().update — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Enhancement type 'enhoxhb' does not support source code update. Only 'enhoxhh' supports source code.); Content-Type: unknown (skipped: builds no request from the probe name alone: Enhancement type 'enhoxhb' does not support source code update. Only 'enhoxhh' supports source code.) |  |  |  |
| getEnhancement().updateMetadata — PUT /sap/bc/adt/enhancements/enhoxhb/{name} | Accept: unknown (423 ExceptionResourceInvalidLockHandle); Content-Type: no body |  |  | the pair table lists Content-Type application/vnd.sap.adt.enh.enhoxhh.v3+xml for a request without a body |
| getFeatureToggle().activate — POST /sap/bc/adt/activation | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getFeatureToggle().lock — POST /sap/bc/adt/sfw/featuretoggles/{name}?_action=LOCK | Accept: unknown (skipped: sends a LOCK, and SAP grants a lock on the probe name although no object of that name exists (measured); the corpus takes no locks); Content-Type: unknown (skipped: sends a LOCK, and SAP grants a lock on the probe name although no object of that name exists (measured); the corpus takes no locks) |  |  |  |
| getFeeds().byUrl — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (feedUrl)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (feedUrl)) |  |  |  |
| getFeeds().gatewayErrorDetail — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (feedUrl)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (feedUrl)) |  |  |  |
| getFunctionGroup().create — POST /sap/bc/adt/functions/groups | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getFunctionGroup().readTransport — GET /sap/bc/adt/functions/groups/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getFunctionGroupTestRunner().startByObject — POST /sap/bc/adt/abapunit/runs | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)) |  |  |  |
| getFunctionGroupTestRunner().startSync — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: objectUris.map is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: objectUris.map is not a function) |  |  |  |
| getFunctionInclude().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getFunctionInclude().update — PUT /sap/bc/adt/functions/groups/{name}/includes/{name}/source/main | Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body |  |  | the pair table lists Content-Type text/plain for a request without a body |
| getFunctionInclude().updateMetadata — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'toLowerCase')); Content-Type: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'toLowerCase')) |  |  |  |
| getFunctionInclude().validate — GET /sap/bc/adt/functions/groups/{name} | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  |  |
| getFunctionModule().create — POST /sap/bc/adt/functions/groups/{name}/fmodules | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getFunctionModule().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getFunctionModule().readTransport — GET /sap/bc/adt/functions/groups/{name}/fmodules/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getFunctionModule().update — PUT /sap/bc/adt/functions/groups/{name}/fmodules/{name}/source/main | Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body |  |  | the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getFunctionModuleTestRunner().run — POST /sap/bc/adt/abapunit/runs | Accept: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)) |  |  |  |
| getFunctionModuleTestRunner().runSync — POST /sap/bc/adt/abapunit/testruns | Accept: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)) |  |  |  |
| getFunctionModuleTestRunner().startByObject — POST /sap/bc/adt/abapunit/runs | Accept: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable (no read of the object)) |  |  |  |
| getFunctionModuleTestRunner().startSync — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: objectUris.map is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: objectUris.map is not a function) |  |  |  |
| getInclude().activate — POST /sap/bc/adt/activation | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getInclude().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getInclude().create — POST /sap/bc/adt/programs/includes | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getInclude().delete — POST /sap/bc/adt/deletion/delete | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getInclude().lock — POST /sap/bc/adt/programs/includes/{name}?_action=LOCK | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getInclude().read — GET /sap/bc/adt/programs/includes/{name}/source/main | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getInclude().readEnhancementElements — GET /sap/bc/adt/programs/includes/{name}/source/main/enhancements/elements | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getInclude().readEnhancementOptions — GET /sap/bc/adt/programs/includes/{name}/enhancements/options | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getInclude().readMetadata — GET /sap/bc/adt/programs/includes/{name} | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getInclude().unlock — POST /sap/bc/adt/programs/includes/{name}?_action=UNLOCK | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getInclude().update — PUT /sap/bc/adt/programs/includes/{name}/source/main | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getInterface().create — POST /sap/bc/adt/oo/interfaces | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getInterface().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getInterface().readTransport — GET /sap/bc/adt/oo/interfaces/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getInterface().update — PUT /sap/bc/adt/oo/interfaces/{name}/source/main | Accept: unknown (400 ExceptionResourceScanDuringSaveFailure); Content-Type: no body |  |  | the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getLocalDefinitions().delete — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'toLowerCase')); Content-Type: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'toLowerCase')) |  |  |  |
| getLocalDefinitions().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getLocalDefinitions().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getLocalMacros().delete — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'toLowerCase')); Content-Type: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'toLowerCase')) |  |  |  |
| getLocalMacros().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getLocalMacros().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getLocalTestClass().delete — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'toLowerCase')); Content-Type: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'toLowerCase')) |  |  |  |
| getLocalTestClass().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getLocalTestClass().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getLocalTypes().delete — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'toLowerCase')); Content-Type: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'toLowerCase')) |  |  |  |
| getLocalTypes().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getLocalTypes().readTransport — GET /sap/bc/adt/oo/classes/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getMessageClass().create — POST /sap/bc/adt/messageclass | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getMessageClassMessage().create — POST /sap/bc/adt/messageclass/{name}/messages/001?_action=LOCK_MSG | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  | the pair table lists Content-Type application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8 for a request without a body |
| getMetadataExtension().delete — DELETE /sap/bc/adt/ddic/ddlx/sources/{name} | Accept: unknown (blocked by our own lock); Content-Type: no body |  |  | the pair table lists Content-Type application/xml for a request without a body |
| getMetadataExtension().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getMetadataExtension().readTransport — GET /sap/bc/adt/ddic/ddlx/sources/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getMetadataExtension().update — PUT /sap/bc/adt/ddic/ddlx/sources/{name}/source/main | Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body |  |  | the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getPackage().check — POST /sap/bc/adt/checkruns | Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409) |  |  |  |
| getPackage().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409) |  |  |  |
| getPackage().delete — POST /sap/bc/adt/deletion/delete | Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409) |  |  |  |
| getPackage().lock — POST /sap/bc/adt/packages/{name}?_action=LOCK | Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409) |  |  |  |
| getPackage().readMetadata — GET /sap/bc/adt/packages/{name} | Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409) |  |  |  |
| getPackage().readTransport — GET /sap/bc/adt/packages/{name}/transport | Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409) |  |  |  |
| getPackage().unlock — POST /sap/bc/adt/packages/{name}?_action=UNLOCK | Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409) |  |  |  |
| getPackage().updateMetadata — PUT /sap/bc/adt/packages/{name} | Accept: unknown (skipped: the temporary package could not be made: the create answered 409); Content-Type: unknown (skipped: the temporary package could not be made: the create answered 409) |  |  |  |
| getProfiler().delete — DELETE /sap/bc/adt/runtime/traces/abaptraces/{name} | Accept: unknown (404 AdtFailed); Content-Type: no body |  |  |  |
| getProfiler().read — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Unknown trace view: Z_HPEC_PROBE); Content-Type: unknown (skipped: builds no request from the probe name alone: Unknown trace view: Z_HPEC_PROBE) |  |  |  |
| getProfiler().viewResponse — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Unknown trace view: Z_HPEC_PROBE); Content-Type: unknown (skipped: builds no request from the probe name alone: Unknown trace view: Z_HPEC_PROBE) |  |  |  |
| getProgram().activate — POST /sap/bc/adt/activation | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().check — POST /sap/bc/adt/checkruns | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().create — POST /sap/bc/adt/programs/programs | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getProgram().delete — POST /sap/bc/adt/deletion/delete | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().getVersions — GET /sap/bc/adt/programs/programs/{name}/source/main/versions | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().getVersionSource — (no request) | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().lock — POST /sap/bc/adt/programs/programs/{name}?_action=LOCK | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().read — GET /sap/bc/adt/programs/programs/{name}/source/main | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().readEnhancementElements — GET /sap/bc/adt/programs/programs/{name}/source/main/enhancements/elements | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().readEnhancementOptions — GET /sap/bc/adt/programs/programs/{name}/enhancements/options | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().readMetadata — GET /sap/bc/adt/programs/programs/{name} | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().readTransport — GET /sap/bc/adt/programs/programs/{name}/transport | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().unlock — POST /sap/bc/adt/programs/programs/{name}?_action=UNLOCK | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgram().update — PUT /sap/bc/adt/programs/programs/{name}/source/main | Accept: unknown (skipped: the temporary program could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary program could not be made: the create answered 403) |  |  |  |
| getProgramExecutor().getRequestsByUri — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (uri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (uri)) |  |  |  |
| getProgramExecutor().scheduleTrace — POST /sap/bc/adt/runtime/traces/abaptraces/parameters | Accept: unknown (skipped: the server assigns the trace request id, so a schedule a probe made could not be found and removed); Content-Type: unknown (skipped: the server assigns the trace request id, so a schedule a probe made could not be found and removed) |  |  |  |
| getProgramTestRunner().startSync — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: objectUris.map is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: objectUris.map is not a function) |  |  |  |
| getRequest().addObject — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'replace')); Content-Type: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'replace')) |  |  |  |
| getRequest().changeTaskType — PUT /sap/bc/adt/cts/transportrequests/{name} | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getRequest().checkDeletion — GET /sap/bc/adt/cts/transportrequests/{name} | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  | the pair table lists Content-Type application/vnd.sap.adt.transportorganizer.v1+xml for a request without a body |
| getRequest().create — POST /sap/bc/adt/cts/transportrequests | Accept: unknown (skipped: the server assigns the request number, so a request a probe made could not be found by name and removed); Content-Type: unknown (skipped: the server assigns the request number, so a request a probe made could not be found by name and removed) |  |  |  |
| getRequest().createTask — (no request) | Accept: unknown (skipped: the server assigns the task number, so a task a probe made could not be found by name and removed); Content-Type: unknown (skipped: the server assigns the task number, so a task a probe made could not be found by name and removed) |  |  |  |
| getRequest().list — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: listTransports requires configUri: the transport list is a saved-configuration search. Obtain an href from /sap/bc/adt/cts/transportrequests/searchconfiguration/configurations); Content-Type: unknown (skipped: builds no request from the probe name alone: listTransports requires configUri: the transport list is a saved-configuration search. Obtain an href from /sap/bc/adt/cts/transportrequests/searchconfiguration/configurations) |  |  |  |
| getRequest().moveObjects — POST /sap/bc/adt/cts/transportrequests/{name}/moveobjects | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getRequest().readMetadata — GET /sap/bc/adt/cts/transportrequests/{name} | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  |  |
| getRequest().readObjects — GET /sap/bc/adt/cts/transportrequests/{name} | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  |  |
| getRequest().removeObject — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'replace')); Content-Type: unknown (skipped: builds no request from the probe name alone: Cannot read properties of undefined (reading 'replace')) |  |  |  |
| getRequest().sortAndCompress — POST /sap/bc/adt/cts/transportrequests/{name}/sortandcompress | Accept: unknown (400 ADT_TM_COMMON_EXCEPTION); Content-Type: no body |  |  |  |
| getRequest().updateMetadata — PUT /sap/bc/adt/cts/transportrequests/{name} | Accept: unknown (400 ExceptionInvalidData); Content-Type: no body |  |  | the pair table lists Content-Type application/vnd.sap.adt.transportorganizer.v1+xml for a request without a body |
| getScalarFunction().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getScalarFunction().readTransport — GET /sap/bc/adt/ddic/dsfd/sources/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getScalarFunction().update — PUT /sap/bc/adt/ddic/dsfd/sources/{name}/source/main | Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body |  |  | the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getScalarFunctionImplementation().activate — POST /sap/bc/adt/activation | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().check — POST /sap/bc/adt/checkruns | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().checkDeletion — POST /sap/bc/adt/deletion/check | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().delete — POST /sap/bc/adt/deletion/delete | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().getVersions — GET /sap/bc/adt/ddic/dsfi/{name}/source/main/versions | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().getVersionSource — (no request) | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().lock — POST /sap/bc/adt/ddic/dsfi/{name}?_action=LOCK | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().read — GET /sap/bc/adt/ddic/dsfi/{name}/source/main | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().readMetadata — GET /sap/bc/adt/ddic/dsfi/{name} | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().readTransport — GET /sap/bc/adt/ddic/dsfi/{name}/transport | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().unlock — POST /sap/bc/adt/ddic/dsfi/{name}?_action=UNLOCK | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().update — PUT /sap/bc/adt/ddic/dsfi/{name}/source/main | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getScalarFunctionImplementation().updateMetadata — PUT /sap/bc/adt/ddic/dsfi/{name} | Accept: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422); Content-Type: unknown (skipped: the temporary scalarFunctionImplementation could not be made: the create answered 422) |  |  |  |
| getServiceBinding().activateRequest — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function) |  |  |  |
| getServiceBinding().bindingTypesRequest — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function) |  |  |  |
| getServiceBinding().buildServiceBindingCreateXml — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Cannot destructure property 'bindingType' of '(0 , types_1.resolveBindingVariant)(...)' as it is undefined.); Content-Type: unknown (skipped: builds no request from the probe name alone: Cannot destructure property 'bindingType' of '(0 , types_1.resolveBindingVariant)(...)' as it is undefined.) |  |  |  |
| getServiceBinding().checkRequest — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function) |  |  |  |
| getServiceBinding().create — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Cannot destructure property 'bindingType' of '(0 , types_1.resolveBindingVariant)(...)' as it is undefined.); Content-Type: unknown (skipped: builds no request from the probe name alone: Cannot destructure property 'bindingType' of '(0 , types_1.resolveBindingVariant)(...)' as it is undefined.) |  |  |  |
| getServiceBinding().createRequest — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: Cannot destructure property 'bindingType' of '(0 , types_1.resolveBindingVariant)(...)' as it is undefined.); Content-Type: unknown (skipped: builds no request from the probe name alone: Cannot destructure property 'bindingType' of '(0 , types_1.resolveBindingVariant)(...)' as it is undefined.) |  |  |  |
| getServiceBinding().deleteRequest — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function) |  |  |  |
| getServiceBinding().deletionCheckRequest — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function) |  |  |  |
| getServiceBinding().getServiceGroup — GET /sap/bc/adt/businessservices/undefined/undefined | Accept: unknown (skipped: builds no address from the probe name alone (/sap/bc/adt/businessservices/undefined/undefined)); Content-Type: unknown (skipped: builds no address from the probe name alone (/sap/bc/adt/businessservices/undefined/undefined)) |  |  |  |
| getServiceBinding().publishByServiceType — POST /sap/bc/adt/businessservices/{name}/publishjobs | Accept: unknown (404 (no SAP exception)); Content-Type: unknown (404 (no SAP exception)) |  |  |  |
| getServiceBinding().readRequest — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function) |  |  |  |
| getServiceBinding().serviceGroupRequest — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function) |  |  |  |
| getServiceBinding().transportCheckRequest — (no request) | Accept: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function); Content-Type: unknown (skipped: builds no request from the probe name alone: connection.makeAdtRequest is not a function) |  |  |  |
| getServiceBinding().unpublishByServiceType — POST /sap/bc/adt/businessservices/{name}/unpublishjobs | Accept: unknown (404 (no SAP exception)); Content-Type: unknown (404 (no SAP exception)) |  |  |  |
| getServiceBinding().update — (no request) | Accept: unknown (skipped: answers without a request on the probe name alone (it reads its input from a server answer it was not given)); Content-Type: unknown (skipped: answers without a request on the probe name alone (it reads its input from a server answer it was not given)) |  |  |  |
| getServiceBinding().updateRequest — POST /sap/bc/adt/businessservices/undefined/unpublishjobs | Accept: unknown (skipped: builds no address from the probe name alone (/sap/bc/adt/businessservices/undefined/unpublishjobs)); Content-Type: unknown (skipped: builds no address from the probe name alone (/sap/bc/adt/businessservices/undefined/unpublishjobs)) |  |  |  |
| getServiceDefinition().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getServiceDefinition().readTransport — GET /sap/bc/adt/ddic/srvd/sources/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getServiceDefinition().update — PUT /sap/bc/adt/ddic/srvd/sources/{name}/source/main | Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: no body |  |  | the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getStructure().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getStructure().readTransport — GET /sap/bc/adt/ddic/structures/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getSystemMessages().getById — GET /sap/bc/adt/runtime/systemmessages/{name} | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getTable().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getTable().readTransport — GET /sap/bc/adt/ddic/tables/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getTableType().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getTableType().readTransport — GET /sap/bc/adt/ddic/tabletypes/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getTransformation().create — POST /sap/bc/adt/xslt/transformations | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getTransformation().getVersionSource — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (contentUri)) |  |  |  |
| getTransformation().readTransport — GET /sap/bc/adt/xslt/transformations/{name}/transport | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getTransformation().validate — POST /sap/bc/adt/xslt/validation | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| getUtils().activateObjectsGroup — POST /sap/bc/adt/activation/runs | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| getUtils().getAllTypes — GET /sap/bc/adt/repository/informationsystem/objecttypes | Accept: unknown (400 ExceptionParameterValueInvalid); Content-Type: no body |  |  |  |
| getUtils().getInclude — GET /sap/bc/adt/programs/includes/{name}/source/main | Accept: unknown (skipped: the temporary include could not be made: the create answered 403); Content-Type: unknown (skipped: the temporary include could not be made: the create answered 403) |  |  |  |
| getUtils().getObjectProperties — (no request) | Accept: unknown (skipped: needs a URI the system handed out in an earlier answer (objectUri)); Content-Type: unknown (skipped: needs a URI the system handed out in an earlier answer (objectUri)) |  |  |  |
| getUtils().getSqlQuery — POST /sap/bc/adt/datapreview/freestyle | Accept: unknown (400 ExceptionDataPreviewGeneral); Content-Type: no body |  |  | the pair table lists Content-Type text/plain; charset=utf-8 for a request without a body |
| getUtils().readObjectMetadata — GET /sap/bc/adt/programs/programs/{name} | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  |  |
| getUtils().readObjectSource — GET /sap/bc/adt/programs/programs/{name}/source/main | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  |  |

## What each endpoint needs: discovery

| needs | endpoints |
|---|---|
| accept | 296 |
| content-type | 86 |
| both | 46 |
| neither | 14 |
| unknown | 615 |

#### needs: accept

| endpoint | detail | Accept named | Content-Type named | the pair table |
|---|---|---|---|---|
| GET /sap/bc/adt/abapsource/codecompletion/hanacatalogaccess | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.objectReferences.v1+xml |  |  |
| GET /sap/bc/adt/abapsource/parsers/rnd/grammar | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| GET /sap/bc/adt/abapsource/prettyprinter/settings | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ppsettings+xml |  |  |
| GET /sap/bc/adt/abapunit/metadata | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.abapunit.metadata.result.v1+xml |  |  |
| GET /sap/bc/adt/acm/dcl/parser | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.dcl.dclParserInfo.v2+xml |  |  |
| GET /sap/bc/adt/acm/dcl/repositoryaccess | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddl.objectReferences.v2+xml |  |  |
| GET /sap/bc/adt/aif/aifdtyp/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aif/aifdtyp/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aif/aifityp/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aif/aifityp/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aif/aifntyp/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aif/aifntyp/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aif/aifrtyp/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aif/aifrtyp/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/analytics/reviewbooklets/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/analytics/reviewbooklets/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/apack/manifests | Accept: checked (406); Content-Type: no body | application/apack.adt.manifest.response.v1+xml |  |  |
| GET /sap/bc/adt/applicationjob/catalogs/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/applicationjob/catalogs/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/applicationjob/templates/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/applicationjob/templates/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/applicationlog/objects/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/applicationlog/objects/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/allowedinstances/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/auth/fields | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/auth/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/compressrequest/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/contenttype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/dataelement/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/httpversion/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/inboundprocesscode/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/inboundService/detail | Accept: checked (406); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/inboundService/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/oAuth2Granttype/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/oAuth2Profile/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/outboundprocesscode/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/outboundService/detail | Accept: checked (406); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/outboundService/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/outputmode/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/partnertype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/pfcgRole/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/porttype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/pse/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/scenariotype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/steampunkAllowedInst/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco2/ibstype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco3/cota/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco3/desdschema/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco3/obsspcreationtype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco3/obstype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco3/serviceinterface/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia1/businessCatalog/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia1/catalogdependencytype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia1/catalogRole/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia1/catalogtype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia1/restrictionType/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia2/aggregationcategory/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia2/authobjectextension/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia2/restrictionfield/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia2/restrictiontype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia5/authfield/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/app/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/appcreationtype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/apptype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/auth/fields | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/auth/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/proposal | Accept: checked (406); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/service/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/servicetype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/tcode/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/ui5apps/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia8/fiorispaceid/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/cloud/iam/siad/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aps/cloud/iam/siad/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aps/com/sod1/docuprogramobjtype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/com/sod1/packagetype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/com/sod1/sod1/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/com/sod1/tagcategory/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/com/sod1/tagvaluehelp/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/com/sod2/apiobjecttype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/com/sod2/consumptionbundlename/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/com/sod2/leadingbusinessobjecttype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/auth/authField/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/auth/checktable/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/auth/dataelement/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/suco/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aps/iam/suco/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aps/iam/sush/applicationtype/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/sush/authobjectfield/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/sush/checkindicator/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/sush/maintenancemode/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/sush/maintenancestatus/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/sush/nodefault/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/sush/proposalstatus/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/sush/su22authfield/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/sush/su22authobject/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/sush/su22hash/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/sush/su22newobject/values | Accept: checked (406); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/susi/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aps/iam/susi/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aps/iam/suso/accesscategory/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/suso/activity/listvalues | Accept: checked (406); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suso/activity/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/suso/authfield/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/suso/authObject/valueHelp | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/suso/criticality/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/suso/objectclass/listvalues | Accept: checked (406); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suso/objectclass/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/suso/owncontext/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/suso/privileged/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/suso/searchhelp/list | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/suso/su22tracelevel/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/aps/iam/tran/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/aps/iam/tran/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/archivingobjects/objects/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/archivingobjects/objects/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/atc/aicapabilities | Accept: checked (406); Content-Type: no body | application/vnd.sap.atc.aicapabilities.v1+xml |  |  |
| GET /sap/bc/adt/atc/approvers | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/atc/configuration/configurations | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.configurations.v1+xml |  |  |
| GET /sap/bc/adt/atc/configuration/metadata | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.configuration.metadata.v1+xml |  |  |
| GET /sap/bc/adt/atc/customizing | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/atc/exemptions/apply | Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/variants | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/atc/worklists | Accept: checked (406); Content-Type: no body | application/atc.worklist.v1+xml |  |  |
| GET /sap/bc/adt/ato/notifications | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ato.notifications.v1+xml, application/vnd.sap.adt.ato.notifications.v1+json |  |  |
| GET /sap/bc/adt/ato/settings | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ato.settings.v1+xml, application/vnd.sap.adt.ato.settings.v1+json |  |  |
| GET /sap/bc/adt/aunit/dbtestdoubles/cds/dependencies | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.aunit.cds.dependencymodel.v1+xml |  |  |
| GET /sap/bc/adt/aunit/dbtestdoubles/cds/dependencies/info | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.aunit.cds.dependencies.info.v1+xml |  |  |
| GET /sap/bc/adt/bct/scp1bcs/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/bct/scp1bcs/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/bct/smbctyp/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/bct/smbctyp/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/bgqc/bgprocessingcontexts/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/bgqc/bgprocessingcontexts/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/bo/behaviordefinitions/parser/info | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.bdef.parserinfo.v1+xml |  |  |
| GET /sap/bc/adt/businessobjects/nontnot/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessobjects/nontnot/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessobjects/rontrot/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessobjects/rontrot/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessservices/bindings/bindingtypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/businessservices/consmodels/consumers | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/businessservices/eeecevc/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessservices/eeecevc/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessservices/evtbevb/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessservices/evtbevb/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessservices/evtoevo/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessservices/evtoevo/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessservices/odatav2 | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.businessservices.odatav2.v3+xml |  |  |
| GET /sap/bc/adt/businessservices/servprovs/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/businessservices/servprovs/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/changedocuments/objects/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/changedocuments/objects/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/checkruns/reporters | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.reporters+xml |  |  |
| GET /sap/bc/adt/conn/commtargets/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/conn/commtargets/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/crosstrace/activations | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.crosstrace.activations.v1+xml |  |  |
| GET /sap/bc/adt/crosstrace/components | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/crosstrace/request_types | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/crosstrace/traces | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.crosstrace.traces.v1+xml |  |  |
| GET /sap/bc/adt/crosstrace/urimapping | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.crosstrace.urimapping.v1+xml |  |  |
| GET /sap/bc/adt/csn/csnm/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/csn/csnm/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/cts/transportrequests | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.transportorganizertree.v1+xml |  |  |
| GET /sap/bc/adt/cts/transportrequests/facets | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.transportorganizer.facets.v1+xml |  |  |
| GET /sap/bc/adt/cts/transportrequests/searchconfiguration/configurations | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.configurations.v1+xml |  |  |
| GET /sap/bc/adt/cts/transportrequests/searchconfiguration/metadata | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.configuration.metadata.v1+xml |  |  |
| GET /sap/bc/adt/cts/transports | Accept: checked (406); Content-Type: no body | application/vnd.sap.as+xml |  |  |
| GET /sap/bc/adt/databrowser/objects/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/databrowser/objects/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ddic/cds/annotation/definitions | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.cds.annotation.definitions.v2+xml |  |  |
| GET /sap/bc/adt/ddic/cds/annotation/elementinfo | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.elementinfo+xml |  |  |
| GET /sap/bc/adt/ddic/cds/annotation/objref/proposal | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.codeCompletionProposals.v4+xml |  |  |
| GET /sap/bc/adt/ddic/dataelements/docu/supplements | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/ddic/db/indexes | Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/db/indexes/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ddic/db/indexes/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ddic/db/settings/dataClass/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/ddic/db/settings/keyFields/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/ddic/db/settings/size/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/ddic/ddl/ddicrepositoryaccess | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddl.objectReferences.v2+xml |  |  |
| GET /sap/bc/adt/ddic/ddl/elementinfo | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.elementinfo+xml |  |  |
| GET /sap/bc/adt/ddic/ddl/elementmappings | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddl.elementMappingsStrategies+xml |  |  |
| GET /sap/bc/adt/ddic/ddl/elementmappings/strategies | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddl.elementMappingsStrategies+xml |  |  |
| GET /sap/bc/adt/ddic/ddl/migration/logs | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddl.migrationlog.v3+xml |  |  |
| GET /sap/bc/adt/ddic/ddl/parser | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddl.ddlParserInfo.v1+xml |  |  |
| GET /sap/bc/adt/ddic/ddl/sources/validation | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddlSource+xml |  |  |
| GET /sap/bc/adt/ddic/ddla/parser/info | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddla.parserinfo.v2+xml |  |  |
| GET /sap/bc/adt/ddic/ddla/textlengthcalc | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddla.textlengthcalc.v1+text |  |  |
| GET /sap/bc/adt/ddic/ddlx/annotation/chain | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddlx.annotation.chain.v2+xml |  |  |
| GET /sap/bc/adt/ddic/ddlx/parser/info | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddlx.parserinfo.v3+xml |  |  |
| GET /sap/bc/adt/ddic/ddlx/sources/$metadata | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  |  |
| GET /sap/bc/adt/ddic/desd/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ddic/desd/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ddic/dras/sources/$metadata | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  |  |
| GET /sap/bc/adt/ddic/dras/sources/$outlineconfiguration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml |  |  |
| GET /sap/bc/adt/ddic/drty/sources/$metadata | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  |  |
| GET /sap/bc/adt/ddic/drty/sources/$outlineconfiguration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources/$metadata | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.generic.SourceEditorMetadata.v1+xml |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources/$outlineconfiguration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.outlineconfiguration.transformation.v1+xml |  |  |
| GET /sap/bc/adt/ddic/dsfi/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ddic/dsfi/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ddic/dtdc/parser/info | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.dtdc.parserinfo.v1+xml |  |  |
| GET /sap/bc/adt/ddic/dteb/parser/info | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.dteb.parserinfo.v1+xml |  |  |
| GET /sap/bc/adt/ddic/extensionindexes | Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/extensionindexes/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ddic/extensionindexes/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ddic/lockobjects/lockmodes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/ddic/logs/activationgraph | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ddic.acivationLog.v1+xml |  |  |
| GET /sap/bc/adt/ddic/srvd/parser/info | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.srvd.parserinfo.v1+xml |  |  |
| GET /sap/bc/adt/ddic/srvd/services | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/ddic/srvd/sourceTypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/ddic/structures/parser/info | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.tabl.parserinfo.v1+xml |  |  |
| GET /sap/bc/adt/ddic/tables/parser/info | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.tabl.parserinfo.v1+xml |  |  |
| GET /sap/bc/adt/destructionobjects/objects/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/destructionobjects/objects/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/docu/abap/langu | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.docu.v1+html |  |  |
| GET /sap/bc/adt/emailtemplates/templates/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/emailtemplates/templates/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/enhancements/enhsxsb/search | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/externaltools/bas/configurations | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.configurations.v1+xml |  |  |
| GET /sap/bc/adt/externaltools/bas/metadata | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.configuration.metadata.v1+xml |  |  |
| GET /sap/bc/adt/feeds | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| GET /sap/bc/adt/fiori/uiad/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/fiori/uiad/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/fiori/uipgtyp/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/fiori/uipgtyp/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/fiori/uisttop/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/fiori/uisttop/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/formobjects/sfpf5f/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/formobjects/sfpf5f/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ideactions/objects/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ideactions/objects/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ideactions/runtime | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| GET /sap/bc/adt/ilmobjects/objects/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/ilmobjects/objects/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/islm/intelligentmodel/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/islm/intelligentmodel/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/islm/intelligentscenario/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/islm/intelligentscenario/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/metricproviders/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/metricproviders/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/notebasic/assignments/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/notebasic/assignments/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/notebasic/notetypes/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/notebasic/notetypes/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/numberranges/objects/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/numberranges/objects/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/packages/settings | Accept: checked (406); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/predefinedfields/objects/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/predefinedfields/objects/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/repository/generators | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| GET /sap/bc/adt/repository/informationsystem/abaplanguageversions | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/repository/informationsystem/executableobjecttypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/repository/informationsystem/objecttypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/repository/informationsystem/properties/values | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/repository/informationsystem/releasestates | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/repository/informationsystem/status | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.ris.status.v1+asjson |  |  |
| GET /sap/bc/adt/repository/informationsystem/textsearch/objectnames | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/repository/informationsystem/textsearch/objecttypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/repository/informationsystem/virtualfolders/facets | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.facets.v1+xml |  |  |
| GET /sap/bc/adt/runtime/memory/snapshots | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.runtime.memory.snapshots.v1+xml |  |  |
| GET /sap/bc/adt/runtime/traces/abaptraces | Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/runtime/traces/abaptraces/objecttypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/runtime/traces/abaptraces/processtypes | Accept: checked (406); Content-Type: no body | application/xml |  |  |
| GET /sap/bc/adt/runtime/traces/abaptraces/requests | Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/st05/trace/directory | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.perf.trace.directory.v1+xml |  |  |
| GET /sap/bc/adt/st05/trace/state | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.perf.trace.state.v1+xml |  |  |
| GET /sap/bc/adt/swc/relations/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/swc/relations/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/system/components | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| GET /sap/bc/adt/system/information | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| GET /sap/bc/adt/system/users | Accept: checked (406); Content-Type: no body | application/atom+xml, application/atom+xml;type=feed |  |  |
| GET /sap/bc/adt/transportobject/objects/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/transportobject/objects/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/urifragmentmappings | Accept: checked (406); Content-Type: no body | text/plain |  |  |
| GET /sap/bc/adt/wbobj/apictyp/$configuration | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.configuration.v1+json, application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1 |  |  |
| GET /sap/bc/adt/wbobj/apictyp/$schema | Accept: checked (406); Content-Type: no body | application/vnd.sap.adt.serverdriven.schema.v1+json, application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1 |  |  |
| POST /sap/bc/adt/abapsource/abapdoc/exportjobs | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/vnd.sap.adt.abapsource.abapdoc.exportresults.v1+zip |  |  |
| POST /sap/bc/adt/abapsource/codecompletion/elementinfo | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/vnd.sap.adt.elementinfo+xml |  |  |
| POST /sap/bc/adt/abapsource/typehierarchy | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/xml |  |  |
| POST /sap/bc/adt/abapunit/explain | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/vnd.sap.adt.aunit.explain.result.v1+asjson |  |  |
| POST /sap/bc/adt/abapunit/testruns | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/vnd.sap.adt.abapunit.testruns.result.v1+xml |  |  |
| POST /sap/bc/adt/abapunit/testruns/evaluation | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/vnd.sap.adt.abapunit.testruns.evaluation.result.v1+xml |  |  |
| POST /sap/bc/adt/apack/gitmanifests | Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/crosstrace/traces | Accept: checked (406); Content-Type: unknown (400 ExceptionSXTADTGeneral) | application/vnd.sap.adt.crosstrace.traces.v1+xml |  |  |
| POST /sap/bc/adt/ddic/drty/sources/$formatter | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | text/plain |  |  |
| POST /sap/bc/adt/ddic/dsfd/sources/$formatter | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | text/plain |  |  |
| POST /sap/bc/adt/deletion/check | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/vnd.sap.adt.deletion.check.response.v1+xml |  |  |
| POST /sap/bc/adt/deletion/delete | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/vnd.sap.adt.deletion.response.v1+xml |  |  |
| POST /sap/bc/adt/ideactions/runtime | Accept: checked (400 acceptHeaderMissing without Accept); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/objectrelations | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/vnd.sap.adt.objectrelations.request.relations.v1+xml |  |  |
| POST /sap/bc/adt/objectrelations/components | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/vnd.sap.adt.objectrelations.response.components.v2+xml |  |  |
| POST /sap/bc/adt/objectrelations/network | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/vnd.sap.adt.objectrelations.response.network.v1+xml |  |  |
| POST /sap/bc/adt/objectrelations/references | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) |  |  |  |
| POST /sap/bc/adt/quickfixes/evaluation | Accept: checked (406); Content-Type: unknown (400 ExceptionResourceBadRequest) | application/xml |  |  |

#### needs: content-type

| endpoint | detail | Accept named | Content-Type named | the pair table |
|---|---|---|---|---|
| POST /sap/bc/adt/acm/dcl/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aif/aifdtyp | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aif/aifityp | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aif/aifntyp | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aif/aifrtyp | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/analytics/reviewbooklets | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/applicationjob/catalogs | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/applicationjob/templates | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/applicationlog/objects | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/cloud/com/sco1 | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/com/sco1}sco1' System expected the element '{http://www.sap.com/com/sco1}sco1' 00 001 System expected the element '{http://www.sap.com/c om/sco1}sco1'); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/cloud/com/sco2 | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/com/sco2}sco2' System expected the element '{http://www.sap.com/com/sco2}sco2' 00 001 System expected the element '{http://www.sap.com/c om/sco2}sco2'); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/cloud/com/sco3 | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/com/sco3}sco3' System expected the element '{http://www.sap.com/com/sco3}sco3' 00 001 System expected the element '{http://www.sap.com/c om/sco3}sco3'); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia1 | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sia1}sia1' System expected the element '{http://www.sap.com/iam/sia1}sia1' 00 001 System expected the element '{http://www.sap.com/i am/sia1}sia1'); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia5 | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6 | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sia6}sia6' System expected the element '{http://www.sap.com/iam/sia6}sia6' 00 001 System expected the element '{http://www.sap.com/i am/sia6}sia6'); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia7 | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sia7}sia7' System expected the element '{http://www.sap.com/iam/sia7}sia7' 00 001 System expected the element '{http://www.sap.com/i am/sia7}sia7'); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia8 | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sia8}sia8' System expected the element '{http://www.sap.com/iam/sia8}sia8' 00 001 System expected the element '{http://www.sap.com/i am/sia8}sia8'); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia9 | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sia9}sia9' System expected the element '{http://www.sap.com/iam/sia9}sia9' 00 001 System expected the element '{http://www.sap.com/i am/sia9}sia9'); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/siad | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/iam/suco | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/iam/sush | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/sush}sush' System expected the element '{http://www.sap.com/iam/sush}sush' 00 001 System expected the element '{http://www.sap.com/i am/sush}sush'); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/iam/susi | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/iam/suso | Accept: unknown (500 dump or router: System expected the element '{http://www.sap.com/iam/suso}suso' System expected the element '{http://www.sap.com/iam/suso}suso' 00 001 System expected the element '{http://www.sap.com/i am/suso}suso'); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/aps/iam/tran | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/archivingobjects/objects | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/atc/checkcategories | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/atc/checkexemptions | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/atc/checks | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/atc/checkvariants | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/bct/scp1bcs | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/bct/smbctyp | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/bgqc/bgprocessingcontexts | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/bo/behaviordefinitions | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/businessobjects/nontnot | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/businessobjects/rontrot | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/businessservices/evtbevb | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/businessservices/evtoevo | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/businessservices/servprovs | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/changedocuments/objects | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/classifications | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  | application/vnd.sap.adt.classification+xml |  |
| POST /sap/bc/adt/conn/commtargets | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/csn/csnm | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/databrowser/objects | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/dataelements | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/db/indexes | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/db/settings | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/ddl/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/ddlx/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/desd | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/domains | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/dras/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/drty/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/dsfd/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/dsfi | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/dtdc/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/dteb/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/extensionindexes | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/lockobjects/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/srvd/sources | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/structures | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/tables | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ddic/tabletypes | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/destructionobjects/objects | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/documentation/ktd/documents | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/emailtemplates/templates | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/enhancements/enhoxhb | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/enhancements/enhsxsb | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/fiori/uiad | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/fiori/uipgtyp | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/fiori/uisttop | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/formobjects/sfpf5f | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ideactions/objects | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ilmobjects/objects | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/islm/intelligentmodel | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/islm/intelligentscenario | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/metricproviders | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/notebasic/assignments | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/notebasic/notetypes | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/numberranges/objects | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/packages | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/packages/settings | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (inferred from the contrast: 406 without a working Content-Type, 400 with one) |  |  |  |
| POST /sap/bc/adt/predefinedfields/objects | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/repository/informationsystem/virtualfolders | Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: checked (415) |  | application/vnd.sap.adt.repository.virtualfolders.request.v1+xml |  |
| POST /sap/bc/adt/repository/informationsystem/virtualfolders/contents | Accept: unknown (415 ExceptionUnsupportedMediaType); Content-Type: checked (415) |  | application/vnd.sap.adt.repository.virtualfolders.request.v1+xml |  |
| POST /sap/bc/adt/swc/relations | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |
| POST /sap/bc/adt/ucon/httpservices | Accept: unknown (400 ExceptionInvalidData); Content-Type: checked (415) |  |  |  |

#### needs: both

| endpoint | detail | Accept named | Content-Type named | the pair table |
|---|---|---|---|---|
| POST /sap/bc/adt/aif/aifdtyp/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/aif/aifityp/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/aif/aifntyp/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/aif/aifrtyp/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/analytics/reviewbooklets/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/applicationjob/catalogs/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/applicationjob/templates/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/applicationlog/objects/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/aps/cloud/iam/siad/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/aps/iam/suco/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/aps/iam/susi/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/aps/iam/tran/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/archivingobjects/objects/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/bct/scp1bcs/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/bct/smbctyp/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/bgqc/bgprocessingcontexts/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/businessobjects/nontnot/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/businessservices/evtbevb/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/businessservices/evtoevo/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/businessservices/servprovs/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/changedocuments/objects/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/conn/commtargets/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/csn/csnm/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/databrowser/objects/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/ddic/db/indexes/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/ddic/desd/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/ddic/dsfi/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/ddic/extensionindexes/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/destructionobjects/objects/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/emailtemplates/templates/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/fiori/uiad/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/fiori/uipgtyp/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/fiori/uisttop/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/formobjects/sfpf5f/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/ideactions/objects/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/ilmobjects/objects/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/islm/intelligentmodel/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/islm/intelligentscenario/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/metricproviders/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/notebasic/assignments/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/notebasic/notetypes/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/numberranges/objects/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/predefinedfields/objects/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/swc/relations/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/transportobject/objects/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |
| POST /sap/bc/adt/wbobj/apictyp/source/formatter | Accept: checked (406); Content-Type: checked (415) | application/json | application/json |  |

#### needs: neither

| endpoint | detail | Accept named | Content-Type named | the pair table |
|---|---|---|---|---|
| GET /sap/bc/adt/activation/inactiveobjects | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/com/sod2/consumptionbundletype/values | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/apprNotifi/subscriptions | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checkfailures | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checkfailures/logs | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checkvariants/codecompletion/templates | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/bindings/bindingtypes/ina1 | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/bindings/bindingtypes/sql1 | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/bindings/validate/servicedefinition | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/activeobject | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddla/repositoryaccess | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/documentation/ktd/documents/codecompletion/links | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/documentation/ktd/documents/codecompletion/templates | Accept: not checked (200); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ucon/httpservices/HandlerClassesUri | Accept: not checked (200); Content-Type: no body |  |  |  |

#### needs: unknown

| endpoint | detail | Accept named | Content-Type named | the pair table |
|---|---|---|---|---|
| GET /sap/bc/adt/abapgit/externalrepoinfo | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapgit/repos | Accept: unknown (400 (no SAP exception)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapsource/abapdoc/exportjobs | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapsource/cleanup/source | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapsource/codecompletion/elementinfo | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapsource/codecompletion/insertion | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapsource/codecompletion/proposal | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapsource/occurencemarkers | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapsource/prettyprinter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapsource/typehierarchy | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapunit/explain | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapunit/runs | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapunit/testruns | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/abapunit/testruns/evaluation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/acm/dcl/elementinfo | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/acm/dcl/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/acm/dcl/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/activation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/activation/results | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/activation/runs | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifdtyp | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifdtyp/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifdtyp/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifityp | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifityp/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifityp/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifntyp | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifntyp/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifntyp/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifrtyp | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifrtyp/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aif/aifrtyp/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/amdp/debugger/main | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/analytics/reviewbooklets | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/analytics/reviewbooklets/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/analytics/reviewbooklets/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/apack/gitmanifests | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/apireleases | Accept: unknown (500 dump or router: Access using a &#39;NULL&#39; object reference is not possible. (Message 20261028150207appserver SAPUSER01100)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/applicationjob/catalogs | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/applicationjob/catalogs/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/applicationjob/catalogs/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/applicationjob/templates | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/applicationjob/templates/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/applicationjob/templates/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/applicationlog/objects | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/applicationlog/objects/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/applicationlog/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/actvt/detail | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/auth/detail | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco1/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco2 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco2/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco3 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/com/sco3/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia1 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia1/restrictionType/details | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia1/title/valueHelp | Accept: unknown (500 dump or router: Creation of handler class failed (class not found)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia1/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia2 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia2/authobjectextension/details | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia2/restrictionfield/details | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia2/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia5 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia5/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/actvt/detail | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/app/status | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/auth/detail | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/publish | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/details | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/service/detail | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/tcode/detail | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/uiad/detail | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia6/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia7 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia7/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia8 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia8/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia9 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/sia9/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/siad | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/siad/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/cloud/iam/siad/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/com/sod1 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/com/sod1/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/com/sod2 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/com/sod2/odatav4groupservice/values | Accept: unknown (500 dump or router: An exception has occurred that was not caught. (Message 20261028150057appserver SAPUSER01100)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/com/sod2/tadir/values | Accept: unknown (500 dump or router: An exception has occurred that was not caught. (Message 20261028150055appserver SAPUSER01100)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/com/sod2/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/auth | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/auth/authcolsearchhelp | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/auth/authdtelallowed | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/auth/objfldsearchhelp | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/auth/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suco | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suco/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suco/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/sush | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/sush/su22authobject/detail | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/sush/sush/synchronize | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/sush/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/susi | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/susi/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/susi/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suso | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suso/abaplanguageversion | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suso/activity/details | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suso/searchhelp | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suso/susobasisobject | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/suso/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/tran | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/tran/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aps/iam/tran/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/archivingobjects/objects | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/archivingobjects/objects/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/archivingobjects/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/autoqf/worklist | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checkcategories | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checkcategories/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checkexemptions | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checkexemptions/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checkexemptionsview | Accept: unknown (406 generic (T100 037): not necessarily the Accept); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checks | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checks/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checkvariants | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/checkvariants/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/exemptions/atcexemption | Accept: unknown (400 (no SAP exception)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/remarks | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/result/worklist | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/results | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/atc/runs | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/aunit/dbtestdoubles/cds/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bct/scp1bcs | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bct/scp1bcs/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bct/scp1bcs/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bct/smbctyp | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bct/smbctyp/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bct/smbctyp/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bgqc/bgprocessingcontexts | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bgqc/bgprocessingcontexts/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bgqc/bgprocessingcontexts/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bo/behaviordefinitions | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bo/behaviordefinitions/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/bo/behaviordefinitions/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessobjects/nontnot | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessobjects/nontnot/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessobjects/nontnot/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessobjects/rontrot | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessobjects/rontrot/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessobjects/rontrot/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/bindings | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/bindings/schema | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/bindings/uiconfig | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/bindings/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/consmodels | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/consmodels/codesample | Accept: unknown (500 dump or router: An exception has occurred that was not caught. (Message 20261028150135appserver SAPUSER01100)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/consmodels/consdata/validate | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/consmodels/getmapping | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/consmodels/validatemapping | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/consmodels/validaterfc | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/consmodels/validatewsdl | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/consmodels/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/eeecevc | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/eeecevc/generate | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/eeecevc/previewobjects | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/eeecevc/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/eeecevc/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/evtbevb | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/evtbevb/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/evtbevb/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/evtoevo | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/evtoevo/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/evtoevo/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/odatav4 | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/release | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/servprovs | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/servprovs/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/businessservices/servprovs/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/changedocuments/objects | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/changedocuments/objects/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/changedocuments/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/checkruns | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/classifications | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/conn/commtargets | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/conn/commtargets/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/conn/commtargets/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/csn/csnm | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/csn/csnm/files | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/csn/csnm/last-generation-run | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/csn/csnm/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/csn/csnm/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/cts/transportchecks | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/cts/transportrequests/reference | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/databrowser/objects | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/databrowser/objects/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/databrowser/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/datapreview/amdp | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/datapreview/amdpdebugger | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/datapreview/cds | Accept: unknown (400 ExceptionDataPreviewGeneral); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/datapreview/ddic | Accept: unknown (400 ExceptionDataPreviewGeneral); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/datapreview/freestyle | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/codecompletion | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dataelements | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dataelements/docu/status | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dataelements/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/db/indexes/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/db/indexes/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/db/settings | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/db/settings/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/createstatements | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/dependencies/graphdata | Accept: unknown (400 NoDependencyGraphDataCalculationPossible); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/elementinfos | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/formatter/configurations | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/formatter/identifiers | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/migration/bgruns | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/migration/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/relatedObjects | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddl/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddla/formatter/identifiers | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddla/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddla/sources/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddlx/formatter/identifiers | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddlx/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/ddlx/sources/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/desd | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/desd/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/desd/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/domains | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/domains/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dras/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dras/sources/$codecompletion/insertion | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dras/sources/$codecompletion/proposal | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dras/sources/$elementinfo | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dras/sources/$navigation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dras/sources/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/drty/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/drty/sources/$codecompletion/insertion | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/drty/sources/$codecompletion/proposal | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/drty/sources/$elementinfo | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/drty/sources/$formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/drty/sources/$navigation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/drty/sources/$occurrencemarkers | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/drty/sources/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources/$codecompletion/insertion | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources/$codecompletion/proposal | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources/$elementinfo | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources/$formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources/$navigation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources/$occurrencemarkers | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfd/sources/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfi | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfi/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dsfi/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dtdc/createstatements | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dtdc/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dtdc/sources/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dteb/codecompletion/proposal | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dteb/elementinfo | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dteb/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dteb/navigation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dteb/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dteb/sources/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/dtsc/createstatements | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/elementinfo | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/extensionindexes/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/extensionindexes/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/lockobjects/adjustment | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/lockobjects/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/lockobjects/sources/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/lockobjects/tables | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/lockobjects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/srvd/elementinfo | Accept: unknown (500 dump or router: The ASSERT condition was violated. (Message 20261028150230appserver SAPUSER01100)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/srvd/formatter/identifiers | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/srvd/sources | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/srvd/sources/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/structures | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/structures/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/tables | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/tables/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/tabletypes | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/tabletypes/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/typegroups | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/typegroups/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ddic/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/debugger | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/actions | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/batch | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/breakpoints | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/breakpoints/conditions | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/breakpoints/messagetypes | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/breakpoints/statements | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/breakpoints/validations | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/breakpoints/vit | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/listeners | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/memorysizes | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/stack | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/systemareas | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/variables | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/debugger/watchpoints | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| GET /sap/bc/adt/deletion/check | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/deletion/delete | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/destructionobjects/objects | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/destructionobjects/objects/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/destructionobjects/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/dcl/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/ddl/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/ddla/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/ddlx/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/dras/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/drty/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/drul/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/dsfd/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/dtdc/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/dteb/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/dtsc/langu | Accept: unknown (500 dump or router: Creation of handler class failed (class not found)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/docu/srvd/langu | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/documentation/ktd/documents | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/documentation/ktd/documents/$codecompletion/proposal | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/documentation/ktd/documents/preview | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/documentation/ktd/documents/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/emailtemplates/templates | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/emailtemplates/templates/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/emailtemplates/templates/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/enhancements/enhoxhb | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/enhancements/enhoxhb/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/enhancements/enhsxsb | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/enhancements/enhsxsb/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/feeds/variants | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/fiori/uiad | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/fiori/uiad/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/fiori/uiad/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/fiori/uipgtyp | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/fiori/uipgtyp/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/fiori/uipgtyp/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/fiori/uisttop | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/fiori/uisttop/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/fiori/uisttop/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/formobjects/sfpf5f | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/formobjects/sfpf5f/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/formobjects/sfpf5f/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/functions/groups | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/functions/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ideactions/objects | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ideactions/objects/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ideactions/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ilmobjects/objects | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ilmobjects/objects/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ilmobjects/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/includes/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/islm/intelligentmodel | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/islm/intelligentmodel/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/islm/intelligentmodel/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/islm/intelligentscenario | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/islm/intelligentscenario/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/islm/intelligentscenario/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/messageclass | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/messageclass/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/metricproviders | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/metricproviders/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/metricproviders/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/navigation/indexupdate | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/navigation/target | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/notebasic/assignments | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/notebasic/assignments/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/notebasic/assignments/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/notebasic/notetypes | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/notebasic/notetypes/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/notebasic/notetypes/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/numberranges/objects | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/numberranges/objects/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/numberranges/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/objectrelations | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/objectrelations/components | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/objectrelations/network | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/objectrelations/references | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/oo/classes | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/oo/interfaces | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/oo/validation/objectname | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/packages | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/packages/$constraints | Accept: unknown (406 generic (T100 037): not necessarily the Accept); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/packages/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/predefinedfields/objects | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/predefinedfields/objects/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/predefinedfields/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/programs/includes | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/programs/programrun | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/programs/programs | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/programs/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/quickfixes/evaluation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/refactoring/changepackage | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/refactorings | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/favorites/lists | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/elementinfo | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/fullnamemapping | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/metadata | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/objectproperties/transports | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/objectproperties/values | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/objectsets/metrics | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/objectsets/references | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/search | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/textsearch | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/usageReferences | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/usageSnippets | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/virtualfolders | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/virtualfolders/contents | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/virtualfolders/facets/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/informationsystem/whereused | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/nodepath | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/nodestructure | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/objectstructure | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/proxyurimappings | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/repository/typestructure | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/runtime/traces/abaptraces/parameters | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/security/reentranceticket | Accept: unknown (skipped: answers a logon ticket, a secret the corpus must not hold); Content-Type: unknown (skipped: answers a logon ticket, a secret the corpus must not hold) |  |  |  |
| GET /sap/bc/adt/swc/relations | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/swc/relations/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/swc/relations/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/textelements/classes | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/textelements/functiongroups | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/textelements/programs | Accept: unknown (404 ExceptionResourceNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/transportobject/objects | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/transportobject/objects/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/transportobject/objects/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ucon/httpservices | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/ucon/httpservices/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/vit/urimapper | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/wbobj/apictyp | Accept: unknown (400 uriMappingError); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/wbobj/apictyp/source/formatter | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/wbobj/apictyp/validation | Accept: unknown (405 method not implemented); Content-Type: no body |  |  |  |
| GET /sap/bc/adt/xslt/transformations | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: no body |  |  |  |
| GET https://abap-cloud.example/sap/bc/adt | Accept: unknown (404 (no SAP exception)); Content-Type: no body |  |  |  |
| POST /sap/bc/adt/abapdaemons/applications/source/formatter | Accept: unknown (no answer: poisoned, not resent: write; after: unreadable 403); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable 403) |  |  |  |
| POST /sap/bc/adt/abapgit/externalrepoinfo | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/abapgit/repos | Accept: unknown (no answer: poisoned, not resent: write; after: unreadable 405); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable 405) |  |  |  |
| POST /sap/bc/adt/abapsource/prettyprinter/settings | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/activation/inactiveobjects | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| POST /sap/bc/adt/activation/runs | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| POST /sap/bc/adt/aif/aifdtyp/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aif/aifdtyp/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aif/aifityp/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aif/aifityp/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aif/aifntyp/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aif/aifntyp/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aif/aifrtyp/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aif/aifrtyp/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/amdp/debugger/main | Accept: unknown (skipped: the debugger attaches to or listens for another session (long polling)); Content-Type: unknown (skipped: the debugger attaches to or listens for another session (long polling)) |  |  |  |
| POST /sap/bc/adt/analytics/reviewbooklets/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/analytics/reviewbooklets/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/applicationjob/catalogs/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/applicationjob/catalogs/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/applicationjob/templates/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/applicationjob/templates/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/applicationlog/objects/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/applicationlog/objects/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/com/sco1/actvt/detail | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/com/sco1/auth/detail | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/com/sco1/inboundService/detail | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/com/sco1/outboundService/detail | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia1/restrictionType/details | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia1/restrictionType/valueHelp | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia2 | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia2/authobjectextension/details | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia2/restrictionfield/details | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/actvt/detail | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/app/status | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/appcreationtype/values | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/auth/detail | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/publish | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: unknown (400 ExceptionResourceBadRequest) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/details | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/proposal | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/restrictionType/valueHelp | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/service/detail | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/tcode/detail | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/sia6/uiad/detail | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/siad/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/cloud/iam/siad/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/com/sod1 | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/aps/com/sod2 | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/aps/iam/auth | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/aps/iam/auth/authcolsearchhelp | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/auth/authdtelallowed | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/auth/objfldsearchhelp | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/suco/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/suco/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/sush/su22authobject/detail | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/sush/su22newobject/values | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/sush/sush/synchronize | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/susi/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/susi/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/suso/abaplanguageversion | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/suso/activity/details | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/suso/activity/listvalues | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/suso/objectclass/listvalues | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/suso/searchhelp | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/suso/susobasisobject | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/tran/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/aps/iam/tran/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/archivingobjects/objects/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/archivingobjects/objects/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/atc/autoqf/worklist | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/atc/exemptions/atcexemption | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/atc/remarks | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ato/notifications | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/bct/scp1bcs/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/bct/scp1bcs/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/bct/smbctyp/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/bct/smbctyp/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/bgqc/bgprocessingcontexts/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/bgqc/bgprocessingcontexts/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/bo/behaviordefinitions/parser/info | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/bo/behaviordefinitions/source/formatter | Accept: unknown (400 ExceptionResourceBadRequest); Content-Type: unknown (400 ExceptionResourceBadRequest) |  |  |  |
| POST /sap/bc/adt/businessobjects/nontnot/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/businessobjects/nontnot/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/businessobjects/rontrot/$configuration | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/businessobjects/rontrot/$schema | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/businessobjects/rontrot/source/formatter | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/businessservices/bindings | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/businessservices/bindings/bindingtypes/ina1 | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/businessservices/bindings/bindingtypes/sql1 | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/businessservices/bindings/schema | Accept: unknown (no answer: poisoned, not resent: write; after: unreadable 500); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable 500) |  |  |  |
| POST /sap/bc/adt/businessservices/bindings/uiconfig | Accept: unknown (no answer: poisoned, not resent: write; after: unreadable 500); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable 500) |  |  |  |
| POST /sap/bc/adt/businessservices/consmodels | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/businessservices/eeecevc | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/businessservices/eeecevc/$configuration | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/businessservices/eeecevc/$schema | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/businessservices/eeecevc/source/formatter | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/businessservices/evtbevb/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/businessservices/evtbevb/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/businessservices/evtoevo/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/businessservices/evtoevo/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/businessservices/odatav2 | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/businessservices/odatav4 | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/businessservices/servprovs/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/businessservices/servprovs/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/changedocuments/objects/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/changedocuments/objects/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/conn/commtargets/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/conn/commtargets/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/crosstrace/activations | Accept: unknown (skipped: a POST here switches a trace on or schedules one, under a key the server assigns); Content-Type: unknown (skipped: a POST here switches a trace on or schedules one, under a key the server assigns) |  |  |  |
| POST /sap/bc/adt/csn/csnm/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/csn/csnm/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/csn/csnm/files | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/csn/csnm/last-generation-run | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/cts/transportrequests | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| POST /sap/bc/adt/cts/transports | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionDataTypeNotFound) |  |  |  |
| POST /sap/bc/adt/databrowser/objects/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/databrowser/objects/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ddic/db/indexes/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ddic/db/indexes/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ddic/ddl/elementinfo | Accept: unknown (400 ElementInfoBadRequest); Content-Type: unknown (400 ElementInfoBadRequest) |  |  |  |
| POST /sap/bc/adt/ddic/ddl/formatter/identifiers | Accept: unknown (400 NoIdentifierFormattingPossible); Content-Type: unknown (400 ExceptionResourceBadRequest) |  |  |  |
| POST /sap/bc/adt/ddic/ddl/migration/bgruns | Accept: unknown (406 generic (T100 037): not necessarily the Accept); Content-Type: unknown (406 ExceptionResourceNotAcceptable) |  |  |  |
| POST /sap/bc/adt/ddic/ddl/migration/validation | Accept: unknown (406 generic (T100 037): not necessarily the Accept); Content-Type: unknown (406 ExceptionResourceNotAcceptable) |  |  |  |
| POST /sap/bc/adt/ddic/ddla/formatter/identifiers | Accept: unknown (400 NoIdentifierFormattingPossible); Content-Type: unknown (400 ExceptionResourceBadRequest) |  |  |  |
| POST /sap/bc/adt/ddic/ddlx/formatter/identifiers | Accept: unknown (400 NoIdentifierFormattingPossible); Content-Type: unknown (400 ExceptionResourceBadRequest) |  |  |  |
| POST /sap/bc/adt/ddic/desd/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ddic/desd/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ddic/dsfi/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ddic/dsfi/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ddic/dteb/formatter | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/ddic/extensionindexes/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ddic/extensionindexes/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ddic/srvd/formatter/identifiers | Accept: unknown (no answer: poisoned, not resent: write; after: absent); Content-Type: unknown (no answer: poisoned, not resent: write; after: absent) |  |  |  |
| POST /sap/bc/adt/ddic/structures/parser/info | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ddic/tables/parser/info | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/destructionobjects/objects/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/destructionobjects/objects/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/emailtemplates/templates/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/emailtemplates/templates/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/fiori/uiad/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/fiori/uiad/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/fiori/uipgtyp/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/fiori/uipgtyp/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/fiori/uisttop/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/fiori/uisttop/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/formobjects/sfpf5f/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/formobjects/sfpf5f/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/functions/groups | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| POST /sap/bc/adt/ideactions/objects/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ideactions/objects/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ilmobjects/objects/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/ilmobjects/objects/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/islm/intelligentmodel/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/islm/intelligentmodel/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/islm/intelligentscenario/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/islm/intelligentscenario/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/metricproviders/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/metricproviders/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/navigation/target | Accept: unknown (400 ExceptionParameterNotFound); Content-Type: unknown (400 ExceptionParameterNotFound) |  |  |  |
| POST /sap/bc/adt/notebasic/assignments/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/notebasic/assignments/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/notebasic/notetypes/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/notebasic/notetypes/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/numberranges/objects/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/numberranges/objects/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/oo/classes | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| POST /sap/bc/adt/oo/interfaces | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
| POST /sap/bc/adt/packages/$constraints | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/predefinedfields/objects/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/predefinedfields/objects/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/repository/nodepath | Accept: unknown (400 uriMappingError); Content-Type: unknown (400 uriMappingError) |  |  |  |
| POST /sap/bc/adt/swc/relations/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/swc/relations/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/testcodegen/dependencies/doubledata | Accept: unknown (no answer: poisoned, not resent: write; after: unreadable 403); Content-Type: unknown (no answer: poisoned, not resent: write; after: unreadable 403) |  |  |  |
| POST /sap/bc/adt/textelements/classes | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/textelements/functiongroups | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/textelements/programs | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/transportobject/objects/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/transportobject/objects/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/wbobj/apictyp/$configuration | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/wbobj/apictyp/$schema | Accept: unknown (405 method not implemented); Content-Type: unknown (405 method not implemented) |  |  |  |
| POST /sap/bc/adt/xslt/transformations | Accept: unknown (400 ExceptionInvalidData); Content-Type: unknown (400 ExceptionInvalidData) |  |  |  |
