# ADT Discovery Endpoints

Generated from: https://5bff2ab7-3ad1-48e3-8980-53a354a1b276.abap.us10.hana.ondemand.com/sap/bc/adt/discovery
Generated at: 2025-12-26T08:04:14.794Z

## BOPF

### Business Objects

**URL:** `/sap/bc/adt/bopf/businessobjects`

**Operations:**

- **http://www.sap.com/adt/categories/businessobjects/newAttributeBinding**
  - Method: `POST`
  - Template: `/sap/bc/adt/bopf/newAttributeBinding`

- **http://www.sap.com/adt/categories/businessobjects/actionExportingParameter**
  - Method: `GET`
  - Template: `/sap/bc/adt/bopf/actionExportingParameter`

- **http://www.sap.com/adt/categories/businessobjects/draftObject**
  - Method: `GET`
  - Template: `/sap/bc/adt/bopf/draftObject`

- **http://www.sap.com/adt/categories/businessobjects/nodeProperty**
  - Method: `GET`
  - Template: `/sap/bc/adt/bopf/nodeProperty`

### Validation

**URL:** `/sap/bc/adt/bopf/businessobjects/$validation`

**Operations:**

- **http://www.sap.com/adt/categories/businessobjects/validation**
  - Method: `GET`
  - Template: `/sap/bc/adt/bopf/businessobjects/$validation{?context,objname,baseobjname,nodename,persistent,transient,entitytype,classname,datatype,paramtype,resulttype,queryName}`

### Generation

**URL:** `/sap/bc/adt/bopf/businessobjects/$generation`

**Operations:**

- **http://www.sap.com/adt/categories/businessobjects/generation**
  - Method: `GET`
  - Template: `/sap/bc/adt/bopf/businessobjects/$generation{?context,objname,packagename,transportrequest,actioncategory,boname}`

### Contentassist

**URL:** `/sap/bc/adt/bopf/businessobjects/$contentassist`

**Operations:**

- **http://www.sap.com/adt/categories/businessobjects/contentassist**
  - Method: `GET`
  - Template: `/sap/bc/adt/bopf/businessobjects/$contentassist{?context,objname}`

### Class Search

**URL:** `/sap/bc/adt/bopf/businessobjects/$search`

**Operations:**

- **http://www.sap.com/adt/categories/businessobjects/search**
  - Method: `GET`
  - Template: `/sap/bc/adt/bopf/businessobjects/$search{?query,maxResults,objectType,superClass,interface,filter,actionCategory,boName}`

### BO Node Structure Fields

**URL:** `/sap/bc/adt/bopf/businessobjects/$structurefields`

**Operations:**

- **http://www.sap.com/adt/categories/businessobjects/structurefields**
  - Method: `GET`
  - Template: `/sap/bc/adt/bopf/businessobjects/$structurefields{?persistent,transient,combined,boName,nodeName}`

### Interface constants

**URL:** `/sap/bc/adt/bopf/businessobjects/$constants`

**Operations:**

- **http://www.sap.com/adt/categories/businessobjects/constants**
  - Method: `GET`
  - Template: `/sap/bc/adt/bopf/businessobjects/$constants{?clifName}`

### Synchronize Behaviour Definition

**URL:** `/sap/bc/adt/bopf/businessobjects/$synchronize`

**Operations:**

- **http://www.sap.com/adt/categories/businessobjects/synchronize**
  - Method: `GET`
  - Template: `/sap/bc/adt/bopf/businessobjects/$synchronize/{bo_name}{?corrNr}`

## ABAP SAPUI5 Filestore

### SAPUI5 Filestore based on BSP

**URL:** `/sap/bc/adt/filestore/ui5-bsp/objects`

### SAPUI5 Runtime Version

**URL:** `/sap/bc/adt/filestore/ui5-bsp/ui5-rt-version`

### SAPUI5 Filestore Marker for Deploy storage support

**URL:** `/sap/bc/adt/filestore/ui5-bsp/deploy-storage`

## abapGit Repositories

### Repositories

**URL:** `/sap/bc/adt/abapgit/repos`

**Accept:**

- `application/abapgit.adt.repo.v1+xml`
- `application/abapgit.adt.repo.v2+xml`
- `application/abapgit.adt.repo.v3+xml`
- `application/abapgit.adt.repo.v4+xml`

### External Repository Info

**URL:** `/sap/bc/adt/abapgit/externalrepoinfo`

**Accept:**

- `application/abapgit.adt.repo.info.ext.request.v1+xml`
- `application/abapgit.adt.repo.info.ext.request.v2+xml`

## Data Preview

### Modelled Data Preview for DDIC

**URL:** `/sap/bc/adt/datapreview/ddic`

**Operations:**

- **http://www.sap.com/adt/categories/datapreview/ddic/metadata**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/ddic/{object_name}/metadata`

- **http://www.sap.com/adt/categories/datapreview/ddic**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/ddic{?rowNumber,ddicEntityName}`

- **http://www.sap.com/adt/categories/datapreview/ddic/colcount**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/ddic{?rowNumber,ddicEntityName,colNumber}`

- **http://www.sap.com/adt/categories/datapreview/ddic/hana**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/ddic{?action,hanaSchemaName,hanaViewName,columnName}`

- **http://www.sap.com/adt/categories/datapreview/ddic/colmetadata**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/ddic{?action,ddicEntityName}`

- **http://www.sap.com/adt/categories/datapreview/ddic/launchfreestyle**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/ddic`

### Data Preview for CDS

**URL:** `/sap/bc/adt/datapreview/cds`

**Operations:**

- **http://www.sap.com/adt/categories/datapreview/cds/metadata**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds/{object_name}/metadata`

- **http://www.sap.com/adt/categories/datapreview/cds**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds{?rowNumber,ddlSourceName}`

- **http://www.sap.com/adt/categories/datapreview/cds/colmetadata**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds{?action,ddlSourceName}`

- **http://www.sap.com/adt/categories/datapreview/cds/associationlist**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds{?action,cdsEntityName,ddlSourceName}`

- **http://www.sap.com/adt/categories/datapreview/cds/associationnavigation**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds{?action,rowNumber,ddlSourceName}`

- **http://www.sap.com/adt/categories/datapreview/cds/followassociation**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds{?action,rowNumber,ddlSourceName}`

- **http://www.sap.com/adt/categories/datapreview/cds/associationrefresh**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds{?action,rowNumber,targetType,ddlSourceName}`

- **http://www.sap.com/adt/categories/datapreview/cds/assocrefreshcamelcase**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds{?action,rowNumber,targetType,cdsEntityName,ddlSourceName}`

- **http://www.sap.com/adt/categories/datapreview/cds/associationinopensql**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds{?action,rowNumber,targetType,cdsEntityName,ddlSourceName}`

- **http://www.sap.com/adt/categories/datapreview/cds/launchfreestyle**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds`

- **http://www.sap.com/adt/categories/datapreview/cds/enum**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/cds/enum{?cdsEntityName,parameter}`

### Freestyle Data Preview for DDIC

**URL:** `/sap/bc/adt/datapreview/freestyle`

**Operations:**

- **http://www.sap.com/adt/categories/datapreview/freestyle**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/freestyle{?rowNumber}`

- **http://www.sap.com/adt/categories/datapreview/freestyle/check**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/freestyle{?action,uniqueURI}`

- **http://www.sap.com/adt/categories/datapreview/freestyle/prettyPrinter**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/freestyle{?action,uniqueURI}`

### Data Preview for AMDP

**URL:** `/sap/bc/adt/datapreview/amdp`

**Operations:**

- **http://www.sap.com/adt/categories/datapreview/amdp/execute**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/amdp{?maxRows,uri}`

- **http://www.sap.com/adt/categories/datapreview/amdp/navigation**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/amdp/navigation/target{?uri}`

### Data Preview for AMDP Debugger

**URL:** `/sap/bc/adt/datapreview/amdpdebugger`

**Operations:**

- **http://www.sap.com/adt/categories/datapreview/amdpdebugger**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/amdpdebugger{?rowNumber,colNumber,sessionId,debuggerId,debuggeeId,variableName,schema,provideRowId,action}`

- **http://www.sap.com/adt/categories/datapreview/amdpdebugger/cellsubstring**
  - Method: `GET`
  - Template: `/sap/bc/adt/datapreview/amdpdebugger/cellsubstring{?rowNumber,columnName,sessionId,debuggerId,debuggeeId,variableName,valueOffset,valueLength,schema,action}`

## Performance Trace

### Performance Trace State

**URL:** `/sap/bc/adt/st05/trace/state`

### Performance Trace Drirectory

**URL:** `/sap/bc/adt/st05/trace/directory`

## Test CodeGeneration for CDS

### Get DDL Dependency

**URL:** `/sap/bc/adt/testcodegen/dependencies/doubledata`

**Accept:**

- `application/vnd.sap.adt.oo.cds.codgen.v1+xml`

**Operations:**

- **http://www.sap.com/adt/categories/cdstestcodegeneration/doubledata**
  - Method: `GET`
  - Template: `/sap/bc/adt/testcodegen/dependencies/doubledata{?ddlsourceName}`

### Generate TestCode for CDS

**URL:** `/sap/bc/adt/testcodegen/dependencies/doubledata`

## ADT IDE Actions

### ADT IDE ACTIONS

**URL:** `/sap/bc/adt/ideactions/runtime`

**Accept:**

- `application/vnd.sap.adt.ideactions.runtime.input.v1+xml`

## AMDP Debugger for ADT

### AMDP Debugger Main

**URL:** `/sap/bc/adt/amdp/debugger/main`

**Accept:**

- `application/vnd.sap.adt.amdp.dbg.main.v4+xml`

**Operations:**

- **http://www.sap.com/adt/amdp/debugger/relations/resume**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}`

- **http://www.sap.com/adt/amdp/debugger/relations/start**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main{?stopExisting,requestUser,cascadeMode}`

- **http://www.sap.com/adt/amdp/debugger/relations/terminate**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}{?hardStop}`

- **http://www.sap.com/adt/amdp/debugger/relations/debuggee**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}`

- **http://www.sap.com/adt/amdp/debugger/relations/vars**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}/variables/{varname}{?offset,length}`

- **http://www.sap.com/adt/amdp/debugger/relations/setvars**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}/variables/{varname}{?setNull}`

- **http://www.sap.com/adt/amdp/debugger/relations/lookup**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}/lookup{?name}`

- **http://www.sap.com/adt/amdp/debugger/relations/step/over**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}?step=over`

- **http://www.sap.com/adt/amdp/debugger/relations/step/continue**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}?step=continue`

- **http://www.sap.com/adt/amdp/debugger/relations/breakpoints**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/breakpoints`

- **http://www.sap.com/adt/amdp/debugger/relations/breakpoints/llang**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/breakpoints`

- **http://www.sap.com/adt/amdp/debugger/relations/breakpoints/tablefunctions**
  - Method: `GET`
  - Template: `/sap/bc/adt/amdp/debugger/main/{mainId}/breakpoints`

## ABAP Package and Dependency Manager (APACK)

### Manifests hosted on a Git repository

**URL:** `/sap/bc/adt/apack/gitmanifests`

**Accept:**

- `application/apack.adt.gitmanifest.request.v1+xml`

### APACK manifests of installed repositories on this system

**URL:** `/sap/bc/adt/apack/manifests`

## Adaptation Transport Organizer (ATO)

### Settings

**URL:** `/sap/bc/adt/ato/settings`

### Notifications

**URL:** `/sap/bc/adt/ato/notifications`

**Accept:**

- `application/vnd.sap.adt.ato.notification.v1+xml`
- `application/vnd.sap.adt.ato.notification.v1+json`

## ABAP Profiler

### Trace files

**URL:** `/sap/bc/adt/runtime/traces/abaptraces`

### Trace parameters

**URL:** `/sap/bc/adt/runtime/traces/abaptraces/parameters`

### Trace parameters for callstack aggregation

**URL:** `/sap/bc/adt/runtime/traces/abaptraces/parameters`

### Trace parameters for amdp trace

**URL:** `/sap/bc/adt/runtime/traces/abaptraces/parameters`

### Trace requests

**URL:** `/sap/bc/adt/runtime/traces/abaptraces/requests`

### Trace requests with uri

**URL:** `/sap/bc/adt/runtime/traces/abaptraces/requests`

### List of object types

**URL:** `/sap/bc/adt/runtime/traces/abaptraces/objecttypes`

### List of process types

**URL:** `/sap/bc/adt/runtime/traces/abaptraces/processtypes`

## Others

### ABAP Daemon

**URL:** `/sap/bc/adt/abapdaemons/applications`

**Operations:**

- **http://www.sap.com/wbobj/abapdaemons/dmon/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/abapdaemons/applications/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/abapdaemons/dmon/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/abapdaemons/applications/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/abapdaemons/applications/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/abapdaemons/applications/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/abapdaemons/applications/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/abapdaemons/applications/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### ABAP Daemon Name Validation

**URL:** `/sap/bc/adt/abapdaemons/applications/validation`

## Application Interface Framework

### Deployment Scenario

**URL:** `/sap/bc/adt/aif/aifdtyp`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifdtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifdtyp/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifdtyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifdtyp/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/aif/aifdtyp/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/aif/aifdtyp/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/aif/aifdtyp/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Deployment Scenario Name Validation

**URL:** `/sap/bc/adt/aif/aifdtyp/validation`

### Application Interface

**URL:** `/sap/bc/adt/aif/aifityp`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifityp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifityp/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifityp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifityp/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/aifityp/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/aifityp/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/aifityp/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/aif/aifityp/$values{?name,maxItemCount,path,objectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifityp/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/aif/aifityp/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/aif/aifityp/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/aif/aifityp/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/aif/aifityp/validation`

### Namespace

**URL:** `/sap/bc/adt/aif/aifntyp`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifntyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifntyp/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifntyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifntyp/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/aifntyp/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/aifntyp/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/aifntyp/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifntyp/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/aif/aifntyp/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/aif/aifntyp/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/aif/aifntyp/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/aif/aifntyp/validation`

### Recipient

**URL:** `/sap/bc/adt/aif/aifrtyp`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifrtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifrtyp/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifrtyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifrtyp/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/aifrtyp/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/aifrtyp/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/aifrtyp/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/aifrtyp/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/aif/aifrtyp/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/aif/aifrtyp/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/aif/aifrtyp/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/aif/aifrtyp/validation`

### Check

**URL:** `/sap/bc/adt/aif/check`

**Operations:**

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifptyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/check/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifptyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/check/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/check/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/check/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/check/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/check/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/aif/check/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/aif/check/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/aif/check/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/aif/check/validation`

### Fix Value

**URL:** `/sap/bc/adt/aif/fixvalue`

**Operations:**

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifftyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/fixvalue/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/applicationinterfaceframework/aifftyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/fixvalue/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/fixvalue/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/fixvalue/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aif/fixvalue/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/aif/fixvalue/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/aif/fixvalue/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/aif/fixvalue/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/aif/fixvalue/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/aif/fixvalue/validation`

## Others

### Review Booklet

**URL:** `/sap/bc/adt/analytics/reviewbooklets`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/rvbctyp/rvbctyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/analytics/reviewbooklets/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/rvbctyp/rvbctyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/analytics/reviewbooklets/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/analytics/reviewbooklets/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/analytics/reviewbooklets/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/analytics/reviewbooklets/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Review Booklet Name Validation

**URL:** `/sap/bc/adt/analytics/reviewbooklets/validation`

## Application Jobs

### Application Job Catalog Entry

**URL:** `/sap/bc/adt/applicationjob/catalogs`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/applicationjobs/sajc/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/applicationjob/catalogs/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/applicationjobs/sajc/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/applicationjob/catalogs/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/applicationjob/catalogs/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/applicationjob/catalogs/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/applicationjob/catalogs/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/applicationjob/catalogs/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/applicationjob/catalogs/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/applicationjob/catalogs/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/applicationjob/catalogs/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/applicationjob/catalogs/validation`

### Application Job Template

**URL:** `/sap/bc/adt/applicationjob/templates`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/applicationjobs/sajt/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/applicationjob/templates/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/applicationjobs/sajt/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/applicationjob/templates/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/applicationjob/templates/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/applicationjob/templates/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/applicationjob/templates/$new/content{?relatedObjectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/applicationjob/templates/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/applicationjob/templates/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/applicationjob/templates/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/applicationjob/templates/validation`

## Others

### Application Log Object

**URL:** `/sap/bc/adt/applicationlog/objects`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/applicationlogobjects/aplotyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/applicationlog/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/applicationlogobjects/aplotyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/applicationlog/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/applicationlog/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/applicationlog/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/applicationlog/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Application Log Object Name Validation

**URL:** `/sap/bc/adt/applicationlog/objects/validation`

## Others

### Application Object

**URL:** `/sap/bc/adt/applicationobjects/objects`

**Operations:**

- **http://www.sap.com/wbobj/applicationobjects/apobtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/applicationobjects/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/applicationobjects/apobtyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/applicationobjects/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/applicationobjects/objects/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/applicationobjects/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/applicationobjects/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/applicationobjects/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Application Object Name Validation

**URL:** `/sap/bc/adt/applicationobjects/objects/validation`

## Cloud Communication Management

### Communication Scenario

**URL:** `/sap/bc/adt/aps/cloud/com/sco1`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **publish**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/com/sco1/$publish{?name}`

- **propertysearchhelp**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/com/sco1/$propertysearchhelp{?communicationScenarioId,communicationScenarioInboundServiceId,communicationScenarioOutboundServiceId,communicationScenarioPropertyName}`

### Allowed values for Scenario Type

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/scenariotype/values`

### PSE Value Help

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/pse/valueHelp`

### OAuth 2.0 Granttype Value Help

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/oAuth2Granttype/valueHelp`

### OAuth 2.0 Profile Value Help

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/oAuth2Profile/valueHelp`

### Role Value Help

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/pfcgRole/valueHelp`

### Inbound Service Value Help

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/inboundService/valueHelp`

### Inbound Service Details

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/inboundService/detail`

**Accept:**

- `application/vnd.sap.adt.com.ibsdetail+xml`

### Outbound Service Value Help

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/outboundService/valueHelp`

### Outbound Service Details

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/outboundService/detail`

**Accept:**

- `application/vnd.sap.adt.com.obsdetail+xml`

### Allowed values for allowed instances

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/allowedinstances/values`

### Allowed values for allowed instances in Steampunk

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/steampunkAllowedInst/values`

### Allowed values for http versions

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/httpversion/values`

### Allowed values for http compression

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/compressrequest/values`

### Allowed values for IDOC partner type

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/partnertype/values`

### Allowed values for IDOC output mode

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/outputmode/values`

### Allowed values for IDOC port type

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/porttype/values`

### Allowed values for IDOC content type

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/contenttype/values`

### Allowed values for inbound IDOC process code

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/inboundprocesscode/values`

### Allowed values for outbound IDOC process code

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/outboundprocesscode/values`

### Authorization Object Details

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/auth/detail`

**Accept:**

- `application/vnd.sap.adt.aps.common.authdetail+xml`

### Activity Details

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/actvt/detail`

**Accept:**

- `application/vnd.sap.adt.aps.common.actvtdetail+xml`

### Authorization Objects

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/auth/values`

### Authorization Fields

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/auth/fields`

### Data Element

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/dataelement/values`

### Communication Scenario Name Validation

**URL:** `/sap/bc/adt/aps/cloud/com/sco1/validation`

### Inbound Service

**URL:** `/sap/bc/adt/aps/cloud/com/sco2`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

### Allowed values for Inbound Service Type

**URL:** `/sap/bc/adt/aps/cloud/com/sco2/ibstype/values`

### Inbound Service Name Validation

**URL:** `/sap/bc/adt/aps/cloud/com/sco2/validation`

### Outbound Service

**URL:** `/sap/bc/adt/aps/cloud/com/sco3`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

### Allowed values for Outbound Service Type

**URL:** `/sap/bc/adt/aps/cloud/com/sco3/obstype/values`

### Allowed Types for Creation of Steampunk Outbound Service

**URL:** `/sap/bc/adt/aps/cloud/com/sco3/obsspcreationtype/values`

### Allowed Values for Outbound Service Service Interface

**URL:** `/sap/bc/adt/aps/cloud/com/sco3/serviceinterface/values`

### Allowed Values for Outbound Service Logical External Schema

**URL:** `/sap/bc/adt/aps/cloud/com/sco3/desdschema/values`

### Allowed Values for Outbound Service Communication Target

**URL:** `/sap/bc/adt/aps/cloud/com/sco3/cota/values`

### Outbound Service Name Validation

**URL:** `/sap/bc/adt/aps/cloud/com/sco3/validation`

### Business Catalog

**URL:** `/sap/bc/adt/aps/cloud/iam/sia1`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **bucapps**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/iam/sia1/$bucapps{?name}`

- **publish**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/iam/sia1/$publish{?name}`

- **getscope**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/iam/sia1/$getScope{?name}`

### Allowed values for Catalog Type

**URL:** `/sap/bc/adt/aps/cloud/iam/sia1/catalogtype/values`

### Allowed values for Catalog Dependency Type

**URL:** `/sap/bc/adt/aps/cloud/iam/sia1/catalogdependencytype/values`

### Catalog Role Value Help

**URL:** `/sap/bc/adt/aps/cloud/iam/sia1/catalogRole/valueHelp`

### Restriction Type Value Help

**URL:** `/sap/bc/adt/aps/cloud/iam/sia1/restrictionType/valueHelp`

**Accept:**

- `application/vnd.sap.adt.aps.common.restrictionsvh+xml`

### Title Value Help

**URL:** `/sap/bc/adt/aps/cloud/iam/sia1/title/valueHelp`

### Details for Restriction Types

**URL:** `/sap/bc/adt/aps/cloud/iam/sia1/restrictionType/details`

**Accept:**

- `application/vnd.sap.adt.common.restrictiontypedetails+xml`

### Allowed Business Catalogs

**URL:** `/sap/bc/adt/aps/cloud/iam/sia1/businessCatalog/valueHelp`

### Business Catalog Name Validation

**URL:** `/sap/bc/adt/aps/cloud/iam/sia1/validation`

### Restriction Type

**URL:** `/sap/bc/adt/aps/cloud/iam/sia2`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **publish**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/iam/sia2/$publish{?restrictionTypeID}`

### Allowed values for Aggregation Category

**URL:** `/sap/bc/adt/aps/cloud/iam/sia2/aggregationcategory/values`

### Allowed values for Restriction Fields

**URL:** `/sap/bc/adt/aps/cloud/iam/sia2/restrictionfield/values`

### Allowed values for Auth Object Extensions

**URL:** `/sap/bc/adt/aps/cloud/iam/sia2/authobjectextension/values`

### Allowed values for Restriction Type in update wizard

**URL:** `/sap/bc/adt/aps/cloud/iam/sia2/restrictiontype/values`

### Details for Restriction Fields

**URL:** `/sap/bc/adt/aps/cloud/iam/sia2/restrictionfield/details`

**Accept:**

- `application/vnd.sap.adt.iam.sia2authfielddetails+xml`

### Details for Authorization Object Extensions

**URL:** `/sap/bc/adt/aps/cloud/iam/sia2/authobjectextension/details`

**Accept:**

- `application/vnd.sap.adt.iam.sia2authfielddetails+xml`

### Restriction Type Name Validation

**URL:** `/sap/bc/adt/aps/cloud/iam/sia2/validation`

### Restriction Field

**URL:** `/sap/bc/adt/aps/cloud/iam/sia5`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/aps/cloud/iam/sia5/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/iam/sia5/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Allowed Authorization Fields

**URL:** `/sap/bc/adt/aps/cloud/iam/sia5/authfield/values`

### Restriction Field Name Validation

**URL:** `/sap/bc/adt/aps/cloud/iam/sia5/validation`

### IAM App

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

### App Types

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/apptype/values`

### App Creation Types

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/appcreationtype/values`

**Accept:**

- `application/vnd.sap.adt.aps.iam.appcreationtypes+xml`

### Service Types

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/servicetype/values`

### Services

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/service/values`

### Authorization Objects

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/auth/values`

### Service Details

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/service/detail`

**Accept:**

- `application/vnd.sap.adt.iam.servicedetail+xml`

### Authorization Object Details

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/auth/detail`

**Accept:**

- `application/vnd.sap.adt.aps.common.authdetail+xml`

### Activity Details

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/actvt/detail`

**Accept:**

- `application/vnd.sap.adt.aps.common.actvtdetail+xml`

### Uiad Details

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/uiad/detail`

**Accept:**

- `application/vnd.sap.adt.iam.uiaddetail+xml`

### Transaction Code Details

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/tcode/detail`

**Accept:**

- `application/vnd.sap.adt.iam.tcodedetail+xml`

### Publish Locally

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/publish`

**Accept:**

- `application/vnd.sap.adt.iam.publishing+xml`

### Authorization Fields

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/auth/fields`

### UI5 Applications

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/ui5apps/values`

### Allowed Apps

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/app/valueHelp`

### Application status

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/app/status`

**Accept:**

- `application/vnd.sap.adt.iam.status+xml`

### Transaction codes

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/tcode/values`

### Restriction Type Value Help

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/restrictionType/valueHelp`

**Accept:**

- `application/vnd.sap.adt.aps.common.restrictionsvh+xml`

### Restriction Type Proposal

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/restrictionType/proposal`

**Accept:**

- `application/vnd.sap.adt.sia6.restrictiontypeproposal+xml`

### Details for Restriction Types

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/restrictionType/details`

**Accept:**

- `application/vnd.sap.adt.common.restrictiontypedetails+xml`

### IAM App Name Validation

**URL:** `/sap/bc/adt/aps/cloud/iam/sia6/validation`

### Busines Catalog IAM App Assignment

**URL:** `/sap/bc/adt/aps/cloud/iam/sia7`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/aps/cloud/iam/sia7/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/iam/sia7/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Busines Catalog IAM App Assignment Name Validation

**URL:** `/sap/bc/adt/aps/cloud/iam/sia7/validation`

### Business Role Template

**URL:** `/sap/bc/adt/aps/cloud/iam/sia8`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **getsia9**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/iam/sia8/$getsia9{?name}`

- **publish**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/iam/sia8/$publish{?name}`

### Allowed space ID

**URL:** `/sap/bc/adt/aps/cloud/iam/sia8/fiorispaceid/valueHelp`

### Business Role Template Name Validation

**URL:** `/sap/bc/adt/aps/cloud/iam/sia8/validation`

### Business Role Template Catalog Assignment

**URL:** `/sap/bc/adt/aps/cloud/iam/sia9`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

### Business Role Template Catalog Assignment Name Validation

**URL:** `/sap/bc/adt/aps/cloud/iam/sia9/validation`

### Business Role Templ. – Launchpad Space Templ. Assignment

**URL:** `/sap/bc/adt/aps/cloud/iam/siad`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/aps/cloud/iam/siad/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/iam/siad/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/aps/cloud/iam/siad/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/cloud/iam/siad/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/aps/cloud/iam/siad/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/aps/cloud/iam/siad/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/aps/cloud/iam/siad/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/aps/cloud/iam/siad/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Business Role Templ. – Launchpad Space Templ. Assignment Name Validation

**URL:** `/sap/bc/adt/aps/cloud/iam/siad/validation`

### API Package

**URL:** `/sap/bc/adt/aps/com/sod1`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **packageassignments**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/com/sod1/$packageassignments{?name}`

- **publish**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/com/sod1/$publish{?wbObjectType,wbObjectName}`

### Tag Categories

**URL:** `/sap/bc/adt/aps/com/sod1/tagcategory/values`

### Tag Value Help

**URL:** `/sap/bc/adt/aps/com/sod1/tagvaluehelp/values`

### Type

**URL:** `/sap/bc/adt/aps/com/sod1/packagetype/values`

### Type

**URL:** `/sap/bc/adt/aps/com/sod1/docuprogramobjtype/values`

### Api Package Value Help

**URL:** `/sap/bc/adt/aps/com/sod1/sod1/values`

### API Package Name Validation

**URL:** `/sap/bc/adt/aps/com/sod1/validation`

### API Package Assignment

**URL:** `/sap/bc/adt/aps/com/sod2`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **apidetails**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/com/sod2/$apidetails{?apiWbObjectType,apiWbObjectName,apiSubWbObjectName}`

- **swaggerfile**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/com/sod2/$swaggerfile{?packageAssignmentId}`

- **ordfile**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/com/sod2/$ordfile{?packageAssignmentId}`

### Allowed TADIR Values

**URL:** `/sap/bc/adt/aps/com/sod2/tadir/values`

### Allowed OData V4 Services

**URL:** `/sap/bc/adt/aps/com/sod2/odatav4groupservice/values`

### API Object Types

**URL:** `/sap/bc/adt/aps/com/sod2/apiobjecttype/values`

### Consumption Bundle Types

**URL:** `/sap/bc/adt/aps/com/sod2/consumptionbundletype/values`

### Consumption Bundle Names

**URL:** `/sap/bc/adt/aps/com/sod2/consumptionbundlename/values`

### Leading Business Object Type

**URL:** `/sap/bc/adt/aps/com/sod2/leadingbusinessobjecttype/values`

### API Package Assignment Name Validation

**URL:** `/sap/bc/adt/aps/com/sod2/validation`

### Technical Object Group

**URL:** `/sap/bc/adt/aps/common/sbc1`

**Operations:**

- **classifications**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/common/sbc1/$classifications{?name}`

### Technical Object Group Name Validation

**URL:** `/sap/bc/adt/aps/common/sbc1/validation`

### Authorization Field

**URL:** `/sap/bc/adt/aps/iam/auth`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **authobjects**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/iam/auth/$authobjects{?name}`

- **authsearchhelp**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/iam/auth/$authsearchhelp{?authFieldName,authObjectName,searchHelpName}`

- **syncfieldsbuffer**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/iam/auth/$syncfieldsbuffer{?name}`

### Allowed Data Element

**URL:** `/sap/bc/adt/aps/iam/auth/dataelement/values`

### Allowed check table

**URL:** `/sap/bc/adt/aps/iam/auth/checktable/values`

### authcolsearchhelp

**URL:** `/sap/bc/adt/aps/iam/auth/authcolsearchhelp`

**Accept:**

- `application/vnd.sap.adt.auth.authcolsearchhelp+xml`

### Allowed Authorization Fields

**URL:** `/sap/bc/adt/aps/iam/auth/authField/valueHelp`

### Details for Object-Field-Searchhelp

**URL:** `/sap/bc/adt/aps/iam/auth/objfldsearchhelp`

**Accept:**

- `application/vnd.sap.adt.auth.objfldsearchhelp+xml`

### Data Element allowed

**URL:** `/sap/bc/adt/aps/iam/auth/authdtelallowed`

**Accept:**

- `application/vnd.sap.adt.auth.authdtelallowed+xml`

### Authorization Field Name Validation

**URL:** `/sap/bc/adt/aps/iam/auth/validation`

### Authorization Default Variant

**URL:** `/sap/bc/adt/aps/iam/suco`

**Operations:**

- **http://www.sap.com/aps/iam/sucotyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/iam/suco/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/aps/iam/sucotyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/iam/suco/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aps/iam/suco/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aps/iam/suco/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/aps/iam/suco/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/aps/iam/suco/$values{?name,maxItemCount,path,objectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/iam/suco/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/aps/iam/suco/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/aps/iam/suco/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/aps/iam/suco/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/aps/iam/suco/validation`

### Authorization Default (TADIR)

**URL:** `/sap/bc/adt/aps/iam/sush`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

### Maintenance Mode Value Help

**URL:** `/sap/bc/adt/aps/iam/sush/maintenancemode/values`

### Application Type Value Help

**URL:** `/sap/bc/adt/aps/iam/sush/applicationtype/values`

### Authorization Field Value Help

**URL:** `/sap/bc/adt/aps/iam/sush/authobjectfield/values`

### Proposal Status Value Help

**URL:** `/sap/bc/adt/aps/iam/sush/proposalstatus/values`

### Check Indicator Value Help

**URL:** `/sap/bc/adt/aps/iam/sush/checkindicator/values`

### Maintenance Status Value Help

**URL:** `/sap/bc/adt/aps/iam/sush/maintenancestatus/values`

### Auth Object Value Help

**URL:** `/sap/bc/adt/aps/iam/sush/su22authobject/values`

### Value help for auth field values

**URL:** `/sap/bc/adt/aps/iam/sush/su22authfield/values`

### Creatable new objects

**URL:** `/sap/bc/adt/aps/iam/sush/su22newobject/values`

**Accept:**

- `application/vnd.sap.adt.sush.newobjectlist+xml`

### Value help to get hash of applications

**URL:** `/sap/bc/adt/aps/iam/sush/su22hash/values`

### details of auth objects

**URL:** `/sap/bc/adt/aps/iam/sush/su22authobject/detail`

**Accept:**

- `application/vnd.sap.adt.sush.authobjdetail+xml`

### synchronize SUSH object

**URL:** `/sap/bc/adt/aps/iam/sush/sush/synchronize`

**Accept:**

- `application/vnd.sap.adt.sush.synchronize+xml`

### no default values

**URL:** `/sap/bc/adt/aps/iam/sush/nodefault/values`

### Authorization Default (TADIR) Name Validation

**URL:** `/sap/bc/adt/aps/iam/sush/validation`

### Authorization Default (External)

**URL:** `/sap/bc/adt/aps/iam/susi`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/aps/iam/susityp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/iam/susi/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/aps/iam/susityp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/aps/iam/susi/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/aps/iam/susi/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/aps/iam/susi/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/aps/iam/susi/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/aps/iam/susi/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Authorization Default (External) Name Validation

**URL:** `/sap/bc/adt/aps/iam/susi/validation`

### Authorization Object

**URL:** `/sap/bc/adt/aps/iam/suso`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

### Allowed Object Class Values

**URL:** `/sap/bc/adt/aps/iam/suso/objectclass/values`

### Allowed Authorization Object Classes

**URL:** `/sap/bc/adt/aps/iam/suso/objectclass/listvalues`

**Accept:**

- `application/vnd.sap.adt.suso.objectclasslist+xml`

### Allowed Authorization Fields

**URL:** `/sap/bc/adt/aps/iam/suso/authfield/values`

### Allowed Activities

**URL:** `/sap/bc/adt/aps/iam/suso/activity/values`

### Details for Activities

**URL:** `/sap/bc/adt/aps/iam/suso/activity/details`

**Accept:**

- `application/vnd.sap.adt.suso.activitydetails+xml`

### Allowed Activities

**URL:** `/sap/bc/adt/aps/iam/suso/activity/listvalues`

**Accept:**

- `application/vnd.sap.adt.suso.activitylist+xml`

### Allowed SU22 trace level

**URL:** `/sap/bc/adt/aps/iam/suso/su22tracelevel/values`

### Allowed Access Category Values

**URL:** `/sap/bc/adt/aps/iam/suso/accesscategory/values`

### Allowed Authorization Objects

**URL:** `/sap/bc/adt/aps/iam/suso/authObject/valueHelp`

### Criticality

**URL:** `/sap/bc/adt/aps/iam/suso/criticality/values`

### Usage in Privileged BDEF Mode

**URL:** `/sap/bc/adt/aps/iam/suso/privileged/values`

### Usage in the OWN Authorization Context

**URL:** `/sap/bc/adt/aps/iam/suso/owncontext/values`

### Search Help

**URL:** `/sap/bc/adt/aps/iam/suso/searchhelp`

**Accept:**

- `application/vnd.sap.adt.suso.searchhelp+xml`

### Allowed SearchHelp Values

**URL:** `/sap/bc/adt/aps/iam/suso/searchhelp/list`

### ABAP Language Version for package

**URL:** `/sap/bc/adt/aps/iam/suso/abaplanguageversion`

**Accept:**

- `application/vnd.sap.adt.suso.abaplanguageversion+xml`

### Basis Object

**URL:** `/sap/bc/adt/aps/iam/suso/susobasisobject`

**Accept:**

- `application/vnd.sap.adt.suso.susobasisobject+xml`

### Authorization Object Name Validation

**URL:** `/sap/bc/adt/aps/iam/suso/validation`

## Others

### Archiving Object

**URL:** `/sap/bc/adt/archivingobjects/objects`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/archivingobjects/aobjtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/archivingobjects/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/archivingobjects/aobjtyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/archivingobjects/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/archivingobjects/objects/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/archivingobjects/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/archivingobjects/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/archivingobjects/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Archiving Object Name Validation

**URL:** `/sap/bc/adt/archivingobjects/objects/validation`

## ABAP Test Cockpit

### ATC Check Category

**URL:** `/sap/bc/adt/atc/checkcategories`

**Accept:**

- `application/vnd.sap.adt.chkcv1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/atc/chkctyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checkcategories/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### ATC Check Category Name Validation

**URL:** `/sap/bc/adt/atc/checkcategories/validation`

### Exemption

**URL:** `/sap/bc/adt/atc/checkexemptions`

**Accept:**

- `application/vnd.sap.adt.chkev2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/atc/chketyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checkexemptions/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Exemption Name Validation

**URL:** `/sap/bc/adt/atc/checkexemptions/validation`

### ATC Check

**URL:** `/sap/bc/adt/atc/checks`

**Accept:**

- `application/vnd.sap.adt.chkov1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/atc/chkotyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checks/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **chkotyp/parameter**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checks/parameter{?checkname,chkoname}`

- **chkotyp/remoteenabled**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checks/remoteenabled{?checkname}`

### ATC Check Name Validation

**URL:** `/sap/bc/adt/atc/checks/validation`

### ATC Check Variant

**URL:** `/sap/bc/adt/atc/checkvariants`

**Accept:**

- `application/vnd.sap.adt.chkvv4+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/atc/chkvtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checkvariants/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **chkvtyp/formtemplate**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checkvariants/formtemplate{?chkvName,version}`

- **chkvtyp/checkschema**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checkvariants/schema{?chkoName}`

### CHKV Templates

**URL:** `/sap/bc/adt/atc/checkvariants/codecompletion/templates`

### ATC Check Variant Name Validation

**URL:** `/sap/bc/adt/atc/checkvariants/validation`

## Business Configuration Management

### Business Configuration Set

**URL:** `/sap/bc/adt/bct/scp1bcs`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/bct/scp1bcs/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/bct/scp1bcs/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/bct/scp1bcs/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/bct/scp1bcs/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/bct/scp1bcs/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/bct/scp1bcs/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/bct/scp1bcs/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/bct/scp1bcs/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Business Configuration Set Name Validation

**URL:** `/sap/bc/adt/bct/scp1bcs/validation`

### Business Configuration Maintenance Object

**URL:** `/sap/bc/adt/bct/smbctyp`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/bct/smbctyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/bct/smbctyp/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/bct/smbctyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/bct/smbctyp/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/bct/smbctyp/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/bct/smbctyp/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/bct/smbctyp/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/bct/smbctyp/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Business Configuration Maintenance Object Name Validation

**URL:** `/sap/bc/adt/bct/smbctyp/validation`

## Others

### Background Processing Context

**URL:** `/sap/bc/adt/bgqc/bgprocessingcontexts`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/bgqcbgprocessingcontexts/bgqctyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/bgqc/bgprocessingcontexts/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/bgqcbgprocessingcontexts/bgqctyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/bgqc/bgprocessingcontexts/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/bgqc/bgprocessingcontexts/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/bgqc/bgprocessingcontexts/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/bgqc/bgprocessingcontexts/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Background Processing Context Name Validation

**URL:** `/sap/bc/adt/bgqc/bgprocessingcontexts/validation`

## Core Data Services

### Behavior Definition

**URL:** `/sap/bc/adt/bo/behaviordefinitions`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/adt/categories/bdef/codecompletion**
  - Method: `GET`
  - Template: `/sap/bc/adt/bo/behaviordefinitions/codecompletion/proposals{?uri}`

- **http://www.sap.com/adt/categories/bdef/elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/bo/behaviordefinitions/codecompletion/elementinfo{?uri*,path*,type*}`

- **http://www.sap.com/adt/relations/docu/bdef/langu**
  - Method: `GET`
  - Template: `/sap/bc/adt/bo/behaviordefinitions/docu/langu{?uri*,searchWord*}`

- **http://www.sap.com/adt/categories/bdef/implementationtypevalues**
  - Method: `GET`
  - Template: `/sap/bc/adt/bo/behaviordefinitions/implementationtypevalues{?name}`

- **http://www.sap.com/adt/categories/bdef/interfaces**
  - Method: `GET`
  - Template: `/sap/bc/adt/bo/behaviordefinitions/interfaces{?name}`

- **http://www.sap.com/adt/categories/bdef/extensions**
  - Method: `GET`
  - Template: `/sap/bc/adt/bo/behaviordefinitions{?extended}`

### Behavior Definition Parser Info

**URL:** `/sap/bc/adt/bo/behaviordefinitions/parser/info`

**Accept:**

- `application/vnd.sap.adt.bdef.parserinfo.v1+xml`

### Source Formatter

**URL:** `/sap/bc/adt/bo/behaviordefinitions/source/formatter`

**Accept:**

- `text/plain`

### Behavior Definition Validation

**URL:** `/sap/bc/adt/bo/behaviordefinitions/validation`

## SAP Object Type Management

### SAP Object Node Type

**URL:** `/sap/bc/adt/businessobjects/nontnot`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/rapbl/nontnot/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessobjects/nontnot/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/rapbl/nontnot/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessobjects/nontnot/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessobjects/nontnot/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessobjects/nontnot/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessobjects/nontnot/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessobjects/nontnot/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/businessobjects/nontnot/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/businessobjects/nontnot/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/businessobjects/nontnot/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/businessobjects/nontnot/validation`

### SAP Object Type

**URL:** `/sap/bc/adt/businessobjects/rontrot`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/rapbl/rontrot/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessobjects/rontrot/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/rapbl/rontrot/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessobjects/rontrot/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessobjects/rontrot/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessobjects/rontrot/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessobjects/rontrot/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/businessobjects/rontrot/$values{?name,maxItemCount,path,objectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessobjects/rontrot/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/businessobjects/rontrot/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/businessobjects/rontrot/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/businessobjects/rontrot/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/businessobjects/rontrot/validation`

## Business Services

### Service Binding

**URL:** `/sap/bc/adt/businessservices/bindings`

**Accept:**

- `application/vnd.sap.adt.businessservices.servicebinding.v2+xml`
- `text/html`
- `application/json`
- `text/plain`

**Operations:**

- **http://www.sap.com/categories/servicebindings/validations**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/bindings/validation{?objname,description,serviceBindingVersion,serviceDefinition,package}`

- **http://www.sap.com/adt/businessservices/servicebinding/bindingtypes/uiconfig**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/bindings/uiconfig/{bindtype}{?bindtypeversion}`

- **http://www.sap.com/adt/businessservices/servicebinding/bindingtypes/schema**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/bindings/schema/{bindtype}{?bindtypeversion}`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/bindings/bindingtypes`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/bindings/validate/servicedefinition`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/bindings/validation`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/bindings/bindingtypes/ina1`

**Accept:**

- `application/vnd.sap.adt.businessservices.ina.v1+xml`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/bindings/bindingtypes/sql1`

**Accept:**

- `application/vnd.sap.adt.businessservices.sql.v1+xml`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/bindings/uiconfig`

**Accept:**

- `application/vnd.sap.adt.businessservices.uiconfig.v1+json`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/bindings/schema`

**Accept:**

- `application/vnd.sap.adt.businessservices.schema.v1+json`

### Service Consumption Model

**URL:** `/sap/bc/adt/businessservices/consmodels`

**Accept:**

- `application/vnd.sap.adt.businessservices.serviceconsumptionmodel.v6+xml`
- `text/html`
- `application/json`
- `text/plain`

**Operations:**

- **http://www.sap.com/wbobj/raps/srvc/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/consmodels/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/adt/businessservices/consmodels/filecontent**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/consmodels/{srvcname}/filecontent{?version}`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/consmodels/getmapping`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/consmodels/validatemapping`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/consmodels/codesample`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/consmodels/consumers`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/consmodels/validatewsdl`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/consmodels/validaterfc`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/consmodels/consdata/validate`

### Service Consumption Model Name Validation

**URL:** `/sap/bc/adt/businessservices/consmodels/validation`

### Event Consumption Model

**URL:** `/sap/bc/adt/businessservices/eeecevc`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/eventconsumptionmodel/eeecevc/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/eeecevc/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/eventconsumptionmodel/eeecevc/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/eeecevc/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessservices/eeecevc/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessservices/eeecevc/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessservices/eeecevc/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/eeecevc/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/businessservices/eeecevc/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/businessservices/eeecevc/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/businessservices/eeecevc/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/businessservices/eeecevc/validation`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/eeecevc/previewobjects`

### Unnamed Collection

**URL:** `/sap/bc/adt/businessservices/eeecevc/generate`

### Event Binding

**URL:** `/sap/bc/adt/businessservices/evtbevb`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/raps/evtbevb/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/evtbevb/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/raps/evtbevb/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/evtbevb/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/businessservices/evtbevb/$values{?name,maxItemCount,path,objectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/evtbevb/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/businessservices/evtbevb/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/businessservices/evtbevb/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/businessservices/evtbevb/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Event Binding Name Validation

**URL:** `/sap/bc/adt/businessservices/evtbevb/validation`

### Event Object

**URL:** `/sap/bc/adt/businessservices/evtoevo`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/raps/evtoevo/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/evtoevo/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/raps/evtoevo/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/evtoevo/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessservices/evtoevo/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessservices/evtoevo/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessservices/evtoevo/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/evtoevo/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/businessservices/evtoevo/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/businessservices/evtoevo/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/businessservices/evtoevo/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/businessservices/evtoevo/validation`

### SOAP Provider Model

**URL:** `/sap/bc/adt/businessservices/servprovs`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/raps/sprvtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/servprovs/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/raps/sprvtyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/servprovs/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessservices/servprovs/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessservices/servprovs/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/businessservices/servprovs/$new/content{?relatedObjectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/businessservices/servprovs/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/businessservices/servprovs/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/businessservices/servprovs/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/businessservices/servprovs/validation`

## Change Document Management

### Change Document Object

**URL:** `/sap/bc/adt/changedocuments/objects`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/changedocumentobjects/chdochd/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/changedocuments/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/changedocumentobjects/chdochd/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/changedocuments/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/changedocuments/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/changedocuments/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/changedocuments/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Change Document Object Name Validation

**URL:** `/sap/bc/adt/changedocuments/objects/validation`

## Code Composer

### Code Composer Template

**URL:** `/sap/bc/adt/cmp_code_composer/cmpt`

**Operations:**

- **http://www.sap.com/adt/categories/codecomposer/code-composer-template/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/cmp_code_composer/cmpt/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/adt/categories/codecomposer/code-composer-template/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/cmp_code_composer/cmpt/{object_name}/source/main{?corrNr,lockHandle,version}`

### Code Composer Template Name Validation

**URL:** `/sap/bc/adt/cmp_code_composer/cmpt/validation`

## Others

### Communication Target

**URL:** `/sap/bc/adt/conn/commtargets`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/commtargetobjects/cotatyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/conn/commtargets/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/commtargetobjects/cotatyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/conn/commtargets/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/conn/commtargets/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/conn/commtargets/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/conn/commtargets/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/conn/commtargets/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Communication Target Name Validation

**URL:** `/sap/bc/adt/conn/commtargets/validation`

## Others

### Core Schema Notation Model

**URL:** `/sap/bc/adt/csn/csnm`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/csnmodel/csnmtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/csn/csnm/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/csnmodel/csnmtyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/csn/csnm/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/wbobj/csnmodel/csnmtyp/files**
  - Method: `GET`
  - Template: `/sap/bc/adt/csn/csnm/{object_name}/files`

- **http://www.sap.com/wbobj/csnmodel/csnmtyp/last-generation-run**
  - Method: `GET`
  - Template: `/sap/bc/adt/csn/csnm/{object_name}/last-generation-run`

### JSON Formatter

**URL:** `/sap/bc/adt/csn/csnm/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/csn/csnm/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/csn/csnm/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Unnamed Collection

**URL:** `/sap/bc/adt/csn/csnm/files`

**Accept:**

- `application/json`

**Operations:**

- **http://www.sap.com/wbobj/csnmodel/csnmtyp/files**
  - Method: `GET`
  - Template: `/sap/bc/adt/csn/csnm/{object_name}/files`

### Unnamed Collection

**URL:** `/sap/bc/adt/csn/csnm/last-generation-run`

**Accept:**

- `application/json`

**Operations:**

- **http://www.sap.com/wbobj/csnmodel/csnmtyp/last-generation-run**
  - Method: `GET`
  - Template: `/sap/bc/adt/csn/csnm/{object_name}/last-generation-run`

### Core Schema Notation Model Name Validation

**URL:** `/sap/bc/adt/csn/csnm/validation`

## Extensibility

### Custom Field

**URL:** `/sap/bc/adt/customfields/objects`

**Operations:**

- **http://www.sap.com/wbobj/extensibility/cfdffld/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/customfields/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/extensibility/cfdffld/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/customfields/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/customfields/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/customfields/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/customfields/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Custom Field Name Validation

**URL:** `/sap/bc/adt/customfields/objects/validation`

## Others

### Customer Data Browser Object

**URL:** `/sap/bc/adt/databrowser/objects`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/databrowserobjects/cdbo/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/databrowser/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/databrowserobjects/cdbo/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/databrowser/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/databrowser/objects/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/databrowser/objects/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/databrowser/objects/$new/content{?relatedObjectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/databrowser/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/databrowser/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/databrowser/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/databrowser/objects/validation`

## Others

### Data Category

**URL:** `/sap/bc/adt/datacategories/objects`

**Operations:**

- **http://www.sap.com/wbobj/datacategories/dcattyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/datacategories/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/datacategories/dcattyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/datacategories/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/datacategories/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/datacategories/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/datacategories/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Data Category Name Validation

**URL:** `/sap/bc/adt/datacategories/objects/validation`

## Dictionary

### Data Element

**URL:** `/sap/bc/adt/ddic/dataelements`

**Accept:**

- `application/vnd.sap.adt.dataelements.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/dtelde/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dataelements/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Supplement Documentations

**URL:** `/sap/bc/adt/ddic/dataelements/docu/supplements`

### Documentation Status

**URL:** `/sap/bc/adt/ddic/dataelements/docu/status`

### Data Element Name Validation

**URL:** `/sap/bc/adt/ddic/dataelements/validation`

### Table Index

**URL:** `/sap/bc/adt/ddic/db/indexes`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/tabldti/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/db/indexes/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/dictionary/tabldti/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/db/indexes/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/ddic/db/indexes/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/ddic/db/indexes/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/ddic/db/indexes/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/ddic/db/indexes/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Table Index Name Validation

**URL:** `/sap/bc/adt/ddic/db/indexes/validation`

### Technical Table Settings

**URL:** `/sap/bc/adt/ddic/db/settings`

**Accept:**

- `application/vnd.sap.adt.table.settings.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/tabldtt/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/db/settings/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Data Class Category

**URL:** `/sap/bc/adt/ddic/db/settings/dataClass/values`

### Size Category

**URL:** `/sap/bc/adt/ddic/db/settings/size/values`

### Key Area Fields

**URL:** `/sap/bc/adt/ddic/db/settings/keyFields/values`

### Technical Table Settings Name Validation

**URL:** `/sap/bc/adt/ddic/db/settings/validation`

### Data Definition

**URL:** `/sap/bc/adt/ddic/ddl/sources`

### Data Definition Name Validation

**URL:** `/sap/bc/adt/ddic/ddl/sources/validation`

### Annotation Definition

**URL:** `/sap/bc/adt/ddic/ddla/sources`

**Operations:**

- **http://www.sap.com/wbobj/cds/ddlaadf/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddla/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/cds/ddlaadf/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddla/sources/{object_name}/source/main{?corrNr,lockHandle,version}`

### Annotation Definition Name Validation

**URL:** `/sap/bc/adt/ddic/ddla/sources/validation`

### Metadata Extension

**URL:** `/sap/bc/adt/ddic/ddlx/sources`

**Accept:**

- `application/vnd.sap.adt.ddic.ddlx.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/cds/ddlxex/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddlx/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/cds/ddlxex/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddlx/sources/{object_name}/source/main{?corrNr,lockHandle,version}`

### Metadata Extension Name Validation

**URL:** `/sap/bc/adt/ddic/ddlx/sources/validation`

### Logical External Schema

**URL:** `/sap/bc/adt/ddic/desd`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/cds/desdtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/desd/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/cds/desdtyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/desd/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/ddic/desd/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/ddic/desd/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/ddic/desd/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Logical External Schema Name Validation

**URL:** `/sap/bc/adt/ddic/desd/validation`

### Domain

**URL:** `/sap/bc/adt/ddic/domains`

**Accept:**

- `application/vnd.sap.adt.domains.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/domadd/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/domains/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Domain Name Validation

**URL:** `/sap/bc/adt/ddic/domains/validation`

### Aspect

**URL:** `/sap/bc/adt/ddic/dras/sources`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

### Grammar metadata for type Aspect

**URL:** `/sap/bc/adt/ddic/dras/sources/$metadata`

### Navigation for type DRAS

**URL:** `/sap/bc/adt/ddic/dras/sources/$navigation`

### Code Completion for type DRAS

**URL:** `/sap/bc/adt/ddic/dras/sources/$codecompletion/proposal`

### Code Insertion for type DRAS

**URL:** `/sap/bc/adt/ddic/dras/sources/$codecompletion/insertion`

### Element Info for type DRAS

**URL:** `/sap/bc/adt/ddic/dras/sources/$elementinfo`

**Operations:**

- **elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dras/sources/$elementinfo{?uri,objectName,objectType}`

### Outline Configuration for type DRAS

**URL:** `/sap/bc/adt/ddic/dras/sources/$outlineconfiguration`

### Aspect Name Validation

**URL:** `/sap/bc/adt/ddic/dras/sources/validation`

### Type

**URL:** `/sap/bc/adt/ddic/drty/sources`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/drtysty/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/drty/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/dictionary/drtysty/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/drty/sources/{object_name}/source/main{?corrNr,lockHandle,version}`

### Grammar metadata for type Type

**URL:** `/sap/bc/adt/ddic/drty/sources/$metadata`

### Navigation for type DRTY

**URL:** `/sap/bc/adt/ddic/drty/sources/$navigation`

### Code Completion for type DRTY

**URL:** `/sap/bc/adt/ddic/drty/sources/$codecompletion/proposal`

### Code Insertion for type DRTY

**URL:** `/sap/bc/adt/ddic/drty/sources/$codecompletion/insertion`

### Formatter for type DRTY

**URL:** `/sap/bc/adt/ddic/drty/sources/$formatter`

**Accept:**

- `text/plain`

### Element Info for type DRTY

**URL:** `/sap/bc/adt/ddic/drty/sources/$elementinfo`

**Operations:**

- **elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/drty/sources/$elementinfo{?uri,objectName,objectType}`

### Outline Configuration for type DRTY

**URL:** `/sap/bc/adt/ddic/drty/sources/$outlineconfiguration`

### Occurrence Marking for type DRTY

**URL:** `/sap/bc/adt/ddic/drty/sources/$occurrencemarkers`

### Type Name Validation

**URL:** `/sap/bc/adt/ddic/drty/sources/validation`

### Dependency Rule

**URL:** `/sap/bc/adt/ddic/drul/sources`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/druldrl/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/drul/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/dictionary/druldrl/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/drul/sources/{object_name}/source/main{?corrNr,lockHandle,version}`

### Dependency Rule Name Validation

**URL:** `/sap/bc/adt/ddic/drul/sources/validation`

### Scalar Function Definition

**URL:** `/sap/bc/adt/ddic/dsfd/sources`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/dsfdscf/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dsfd/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/dictionary/dsfdscf/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dsfd/sources/{object_name}/source/main{?corrNr,lockHandle,version}`

### Grammar metadata for type Scalar Function Definition

**URL:** `/sap/bc/adt/ddic/dsfd/sources/$metadata`

### Navigation for type DSFD

**URL:** `/sap/bc/adt/ddic/dsfd/sources/$navigation`

### Code Completion for type DSFD

**URL:** `/sap/bc/adt/ddic/dsfd/sources/$codecompletion/proposal`

### Code Insertion for type DSFD

**URL:** `/sap/bc/adt/ddic/dsfd/sources/$codecompletion/insertion`

### Formatter for type DSFD

**URL:** `/sap/bc/adt/ddic/dsfd/sources/$formatter`

**Accept:**

- `text/plain`

### Element Info for type DSFD

**URL:** `/sap/bc/adt/ddic/dsfd/sources/$elementinfo`

**Operations:**

- **elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dsfd/sources/$elementinfo{?uri,objectName,objectType}`

### Outline Configuration for type DSFD

**URL:** `/sap/bc/adt/ddic/dsfd/sources/$outlineconfiguration`

### Occurrence Marking for type DSFD

**URL:** `/sap/bc/adt/ddic/dsfd/sources/$occurrencemarkers`

### Scalar Function Definition Name Validation

**URL:** `/sap/bc/adt/ddic/dsfd/sources/validation`

### Scalar Function Implementation Reference

**URL:** `/sap/bc/adt/ddic/dsfi`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/cds/dsfisfi/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dsfi/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/cds/dsfisfi/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dsfi/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/ddic/dsfi/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/ddic/dsfi/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/ddic/dsfi/$new/content{?relatedObjectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/ddic/dsfi/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/ddic/dsfi/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/ddic/dsfi/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/ddic/dsfi/validation`

### Dynamic Cache

**URL:** `/sap/bc/adt/ddic/dtdc/sources`

**Accept:**

- `application/vnd.sap.adt.ddic.dtdc.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/dtdcdf/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dtdc/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/dictionary/dtdcdf/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dtdc/sources/{object_name}/source/main{?corrNr,lockHandle,version}`

### Dynamic Cache Name Validation

**URL:** `/sap/bc/adt/ddic/dtdc/sources/validation`

### Entity Buffer

**URL:** `/sap/bc/adt/ddic/dteb/sources`

**Accept:**

- `application/vnd.sap.adt.ddic.dteb.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/dtebdf/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dteb/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/dictionary/dtebdf/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dteb/sources/{object_name}/source/main{?corrNr,lockHandle,version}`

### Entity Buffer Name Validation

**URL:** `/sap/bc/adt/ddic/dteb/sources/validation`

### Static Cache

**URL:** `/sap/bc/adt/ddic/dtsc/sources`

### Grammar metadata for type Static Cache

**URL:** `/sap/bc/adt/ddic/dtsc/sources/$metadata`

### Outline Configuration for type DTSC

**URL:** `/sap/bc/adt/ddic/dtsc/sources/$outlineconfiguration`

### Static Cache Name Validation

**URL:** `/sap/bc/adt/ddic/dtsc/sources/validation`

### Extension Index

**URL:** `/sap/bc/adt/ddic/extensionindexes`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/xinxdtx/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/extensionindexes/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/dictionary/xinxdtx/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/extensionindexes/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/ddic/extensionindexes/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/ddic/extensionindexes/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/ddic/extensionindexes/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/ddic/extensionindexes/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Extension Index Name Validation

**URL:** `/sap/bc/adt/ddic/extensionindexes/validation`

### Lock Object

**URL:** `/sap/bc/adt/ddic/lockobjects/sources`

**Accept:**

- `application/vnd.sap.adt.lockobjects.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/enqudl/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/lockobjects/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Lock Object Name Validation

**URL:** `/sap/bc/adt/ddic/lockobjects/sources/validation`

### Service Definition

**URL:** `/sap/bc/adt/ddic/srvd/sources`

**Accept:**

- `application/vnd.sap.adt.ddic.srvd.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/raps/srvdsrv/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/srvd/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/raps/srvdsrv/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/srvd/sources/{object_name}/source/main{?corrNr,lockHandle,version}`

### Service Definition Name Validation

**URL:** `/sap/bc/adt/ddic/srvd/sources/validation`

### Structure

**URL:** `/sap/bc/adt/ddic/structures`

**Accept:**

- `application/vnd.sap.adt.structures.v2+xml`
- `text/html`

### Structure Parser Info

**URL:** `/sap/bc/adt/ddic/structures/parser/info`

**Accept:**

- `application/vnd.sap.adt.tabl.parserinfo.v1+xml`

### Structure Name Validation

**URL:** `/sap/bc/adt/ddic/structures/validation`

### Database Table

**URL:** `/sap/bc/adt/ddic/tables`

**Accept:**

- `application/vnd.sap.adt.tables.v2+xml`
- `text/html`

### Table Parser Info

**URL:** `/sap/bc/adt/ddic/tables/parser/info`

**Accept:**

- `application/vnd.sap.adt.tabl.parserinfo.v1+xml`

### Database Table Name Validation

**URL:** `/sap/bc/adt/ddic/tables/validation`

### Table Type

**URL:** `/sap/bc/adt/ddic/tabletypes`

**Accept:**

- `application/vnd.sap.adt.tabletype.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/dictionary/ttypda/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/tabletypes/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Table Type Name Validation

**URL:** `/sap/bc/adt/ddic/tabletypes/validation`

## Others

### Data Destruction Object

**URL:** `/sap/bc/adt/destructionobjects/objects`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/destructionobjects/dobjdst/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/destructionobjects/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/destructionobjects/dobjdst/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/destructionobjects/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/destructionobjects/objects/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/destructionobjects/objects/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/destructionobjects/objects/$new/content{?relatedObjectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/destructionobjects/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/destructionobjects/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/destructionobjects/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/destructionobjects/objects/validation`

## Texts

### Knowledge Transfer Document

**URL:** `/sap/bc/adt/documentation/ktd/documents`

**Accept:**

- `application/vnd.sap.adt.sktdv2+xml`
- `text/html`
- `application/json`
- `text/plain`

**Operations:**

- **http://www.sap.com/wbobj/textobj/sktdtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/documentation/ktd/documents/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **sktdtyp/elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/documentation/ktd/documents/elementinfo{?fullname}`

- **sktdtyp/element/elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/documentation/ktd/documents/element/elementinfo{?path,type}`

### KTD Document Validation

**URL:** `/sap/bc/adt/documentation/ktd/documents/validation`

### KTD Syntax Templates

**URL:** `/sap/bc/adt/documentation/ktd/documents/codecompletion/templates`

### Dita Document Preview

**URL:** `/sap/bc/adt/documentation/ktd/documents/preview`

### KTD Link Code Completion

**URL:** `/sap/bc/adt/documentation/ktd/documents/codecompletion/links`

### KTD Code Completion

**URL:** `/sap/bc/adt/documentation/ktd/documents/$codecompletion/proposal`

## Dummy object types  (for unit tests)

### Dummy 1A object type

**URL:** `/sap/bc/adt/dummygroup/wbttt1a`

### Grammar metadata for type Dummy 1A object type

**URL:** `/sap/bc/adt/dummygroup/wbttt1a/$metadata`

### green description

**URL:** `/sap/bc/adt/dummygroup/wbttt1a/white/yellow`

### Dummy 1A object type Name Validation

**URL:** `/sap/bc/adt/dummygroup/wbttt1a/validation`

### Dummy object type (for unit tests)

**URL:** `/sap/bc/adt/dummygroup/wbttt2a`

**Operations:**

- **http://www.sap.com/wbobj/dummygroup/wbttt2a/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/dummygroup/wbttt2a/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/dummygroup/wbttt2a/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/dummygroup/wbttt2a/{object_name}/source/main{?corrNr,lockHandle,version}`

### Dummy object type (for unit tests) Name Validation

**URL:** `/sap/bc/adt/dummygroup/wbttt2a/validation`

## Others

### Email Template

**URL:** `/sap/bc/adt/emailtemplates/templates`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/smtg/smtg/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/emailtemplates/templates/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/smtg/smtg/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/emailtemplates/templates/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/emailtemplates/templates/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/emailtemplates/templates/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/emailtemplates/templates/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Email Template Name Validation

**URL:** `/sap/bc/adt/emailtemplates/templates/validation`

## Enhancements

### Enhancement Implementation

**URL:** `/sap/bc/adt/enhancements/enhoxh`

**Operations:**

- **http://www.sap.com/wbobj/enhancements/enhoxh/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/enhancements/enhoxh/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Enhancement Implementation Name Validation

**URL:** `/sap/bc/adt/enhancements/enhoxh/validation`

### BAdI Implementation

**URL:** `/sap/bc/adt/enhancements/enhoxhb`

**Accept:**

- `application/vnd.sap.adt.enh.enhoxhb.v4+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/enhancements/enhoxhb/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/enhancements/enhoxhb/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### BAdI Implementation Name Validation

**URL:** `/sap/bc/adt/enhancements/enhoxhb/validation`

### Source Code Plugin

**URL:** `/sap/bc/adt/enhancements/enhoxhh`

**Operations:**

- **http://www.sap.com/wbobj/enhancements/enhoxhh/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/enhancements/enhoxhh/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/enhancements/enhoxhh/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/enhancements/enhoxhh/{object_name}/source/main{?corrNr,lockHandle,version}`

### Object Name Validation

**URL:** `/sap/bc/adt/enhancements/enhoxhh/validation`

### Enhancement Spot

**URL:** `/sap/bc/adt/enhancements/enhsxs`

**Operations:**

- **http://www.sap.com/wbobj/enhancements/enhsxs/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/enhancements/enhsxs/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Enhancement Spot Name Validation

**URL:** `/sap/bc/adt/enhancements/enhsxs/validation`

### BAdI Enhancement Spot

**URL:** `/sap/bc/adt/enhancements/enhsxsb`

**Accept:**

- `application/vnd.sap.adt.enh.enhs.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/enhancements/enhsxsb/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/enhancements/enhsxsb/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### BAdI Definition Validation

**URL:** `/sap/bc/adt/enhancements/enhsxsb/validation`

### Enhancement Spot Search

**URL:** `/sap/bc/adt/enhancements/enhsxsb/search`

## Fiori User Interface

### Launchpad App Descriptor Item

**URL:** `/sap/bc/adt/fiori/uiad`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/fiori/uiadtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/fiori/uiad/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/fiori/uiadtyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/fiori/uiad/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/fiori/uiad/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/fiori/uiad/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/fiori/uiad/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/fiori/uiad/$values{?name,maxItemCount,path,objectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/fiori/uiad/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/fiori/uiad/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/fiori/uiad/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/fiori/uiad/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/fiori/uiad/validation`

### Launchpad Page Template

**URL:** `/sap/bc/adt/fiori/uipgtyp`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/fiori/uipgtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/fiori/uipgtyp/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/fiori/uipgtyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/fiori/uipgtyp/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/fiori/uipgtyp/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/fiori/uipgtyp/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/fiori/uipgtyp/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/fiori/uipgtyp/$values{?name,maxItemCount,path,objectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/fiori/uipgtyp/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/fiori/uipgtyp/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/fiori/uipgtyp/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/fiori/uipgtyp/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/fiori/uipgtyp/validation`

### Launchpad Space Template

**URL:** `/sap/bc/adt/fiori/uisttop`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/fiori/uisttop/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/fiori/uisttop/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/fiori/uisttop/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/fiori/uisttop/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/fiori/uisttop/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/fiori/uisttop/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/fiori/uisttop/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/fiori/uisttop/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/fiori/uisttop/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/fiori/uisttop/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/fiori/uisttop/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/fiori/uisttop/validation`

## Form Objects

### Form

**URL:** `/sap/bc/adt/formobjects/sfpf5f`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/form_objects/sfpf5f/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/formobjects/sfpf5f/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/form_objects/sfpf5f/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/formobjects/sfpf5f/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/formobjects/sfpf5f/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/formobjects/sfpf5f/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/formobjects/sfpf5f/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/formobjects/sfpf5f/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Form Name Validation

**URL:** `/sap/bc/adt/formobjects/sfpf5f/validation`

## Namespaces in HDI container

### Namespace in HDI container

**URL:** `/sap/bc/adt/hota/hotahdi`

### Unnamed Collection

**URL:** `/sap/bc/adt/hota/hotahdi/hoto/addlprops`

### Unnamed Collection

**URL:** `/sap/bc/adt/hota/hotahdi/hoto/checkin`

### Unnamed Collection

**URL:** `/sap/bc/adt/hota/hotahdi/hoto/checkout`

### Unnamed Collection

**URL:** `/sap/bc/adt/hota/hotahdi/hota/containername`

### Unnamed Collection

**URL:** `/sap/bc/adt/hota/hotahdi/hota/checknamespace`

### Unnamed Collection

**URL:** `/sap/bc/adt/hota/hotahdi/hota/checkout/hdiwizard`

### Unnamed Collection

**URL:** `/sap/bc/adt/hota/hotahdi/hoto/transportdetails`

### Unnamed Collection

**URL:** `/sap/bc/adt/hota/hotahdi/hota/featurecheck`

### Namespace in HDI container Name Validation

**URL:** `/sap/bc/adt/hota/hotahdi/validation`

### HDI Artifact

**URL:** `/sap/bc/adt/hota/hotahto`

**Operations:**

- **http://www.sap.com/wbobj/hota/hotahto/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/hota/hotahto/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### HDI Artifact Name Validation

**URL:** `/sap/bc/adt/hota/hotahto/validation`

## Others

### IDE Action

**URL:** `/sap/bc/adt/ideactions/objects`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/ideactions/saiatyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ideactions/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/ideactions/saiatyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ideactions/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/ideactions/objects/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/ideactions/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/ideactions/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/ideactions/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### IDE Action Name Validation

**URL:** `/sap/bc/adt/ideactions/objects/validation`

## Others

### ILM Object

**URL:** `/sap/bc/adt/ilmobjects/objects`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/ilmobjects/ilmbirm/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ilmobjects/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/ilmobjects/ilmbirm/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ilmobjects/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/ilmobjects/objects/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/ilmobjects/objects/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/ilmobjects/objects/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/ilmobjects/objects/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/ilmobjects/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/ilmobjects/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/ilmobjects/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/ilmobjects/objects/validation`

## Intelligent Scenario Lifecycle Management

### Intelligent Scenario Model

**URL:** `/sap/bc/adt/islm/intelligentmodel`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/intelligententities/intminm/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/islm/intelligentmodel/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/intelligententities/intminm/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/islm/intelligentmodel/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/islm/intelligentmodel/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/islm/intelligentmodel/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/islm/intelligentmodel/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/islm/intelligentmodel/$values{?name,maxItemCount,path,objectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/islm/intelligentmodel/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/islm/intelligentmodel/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/islm/intelligentmodel/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/islm/intelligentmodel/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/islm/intelligentmodel/validation`

### Intelligent Scenario

**URL:** `/sap/bc/adt/islm/intelligentscenario`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/intelligententities/intsins/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/islm/intelligentscenario/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/intelligententities/intsins/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/islm/intelligentscenario/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/islm/intelligentscenario/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/islm/intelligentscenario/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/islm/intelligentscenario/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/islm/intelligentscenario/$values{?name,maxItemCount,path,objectUri}`

### JSON Formatter

**URL:** `/sap/bc/adt/islm/intelligentscenario/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/islm/intelligentscenario/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/islm/intelligentscenario/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/islm/intelligentscenario/validation`

## Lifecycle Management

### Legacy Feature Toggle (Deprecated)

**URL:** `/sap/bc/adt/lifecycle_management/ftglaf`

### Allowed values for Release Status of Feature Toggle

**URL:** `/sap/bc/adt/lifecycle_management/ftglaf/releasestatus/values`

### Legacy Feature Toggle (Deprecated) Name Validation

**URL:** `/sap/bc/adt/lifecycle_management/ftglaf/validation`

## Others

### Metric Provider

**URL:** `/sap/bc/adt/metricproviders`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/metricprovider/gsmp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/metricproviders/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/metricprovider/gsmp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/metricproviders/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/metricproviders/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/metricproviders/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/metricproviders/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Metric Provider Name Validation

**URL:** `/sap/bc/adt/metricproviders/validation`

## Notes for Application Objects

### Note Type Assignment

**URL:** `/sap/bc/adt/notebasic/assignments`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/notebasic/nttatyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/notebasic/assignments/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/notebasic/nttatyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/notebasic/assignments/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/notebasic/assignments/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/notebasic/assignments/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/notebasic/assignments/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Note Type Assignment Name Validation

**URL:** `/sap/bc/adt/notebasic/assignments/validation`

### Note Type

**URL:** `/sap/bc/adt/notebasic/notetypes`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/notebasic/nttytyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/notebasic/notetypes/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/notebasic/nttytyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/notebasic/notetypes/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/notebasic/notetypes/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/notebasic/notetypes/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/notebasic/notetypes/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Note Type Name Validation

**URL:** `/sap/bc/adt/notebasic/notetypes/validation`

## Number Range Management

### Number Range Object

**URL:** `/sap/bc/adt/numberranges/objects`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/numberrangeobjects/nrobnro/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/numberranges/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/numberrangeobjects/nrobnro/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/numberranges/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/numberranges/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/numberranges/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/numberranges/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Number Range Object Name Validation

**URL:** `/sap/bc/adt/numberranges/objects/validation`

## Object Type Administration

### Repository Object Type

**URL:** `/sap/bc/adt/objtype_admin/sval`

### Blue Tool Configurations

**URL:** `/sap/bc/adt/objtype_admin/sval/configurations`

### Blue Tool Configurations (Metadata)

**URL:** `/sap/bc/adt/objtype_admin/sval/metadata`

### Available TR functional usage areas

**URL:** `/sap/bc/adt/objtype_admin/sval/assist/trscopes`

### Available options for visibility in object list

**URL:** `/sap/bc/adt/objtype_admin/sval/assist/wbobjlist`

### Available WB functional usage areas

**URL:** `/sap/bc/adt/objtype_admin/sval/assist/wbscopes`

### Repository Object Type Name Validation

**URL:** `/sap/bc/adt/objtype_admin/sval/validation`

### Object Type Group

**URL:** `/sap/bc/adt/objtype_admin/wgrp`

**Operations:**

- **http://www.sap.com/wbobj/objtype_admin/wgrp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/objtype_admin/wgrp/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Object Type Group Name Validation

**URL:** `/sap/bc/adt/objtype_admin/wgrp/validation`

## Package

### Package

**URL:** `/sap/bc/adt/packages`

**Accept:**

- `application/vnd.sap.adt.packages.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/packages/devck/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/packages/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **checkuseaccess**
  - Method: `GET`
  - Template: `/sap/bc/adt/packages/{packagename}/useaccesses/{packageinterfacename}`

- **tree**
  - Method: `GET`
  - Template: `/sap/bc/adt/packages/$tree{?packagename,type}`

- **applicationcomponents**
  - Method: `GET`
  - Template: `/sap/bc/adt/packages/valuehelps/applicationcomponents`

- **softwarecomponents**
  - Method: `GET`
  - Template: `/sap/bc/adt/packages/valuehelps/softwarecomponents`

- **transportlayers**
  - Method: `GET`
  - Template: `/sap/bc/adt/packages/valuehelps/transportlayers`

- **translationrelevances**
  - Method: `GET`
  - Template: `/sap/bc/adt/packages/valuehelps/translationrelevances`

- **abaplanguageversions**
  - Method: `GET`
  - Template: `/sap/bc/adt/packages/valuehelps/abaplanguageversions`

### Package Name Validation

**URL:** `/sap/bc/adt/packages/validation`

### Package Constraints

**URL:** `/sap/bc/adt/packages/$constraints`

**Accept:**

- `application/softwareComponent.v1+json`
- `application/packageConstraints.v1+json`

### Package Settings

**URL:** `/sap/bc/adt/packages/settings`

**Accept:**

- `application/vnd.sap.adt.packages.settings.v2+xml`

## Extensibility

### Predefined Field Enabling

**URL:** `/sap/bc/adt/predefinedfields/objects`

**Accept:**

- `application/vnd.sap.adt.blues.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/predefinedfields/PCFNPCF/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/predefinedfields/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/predefinedfields/PCFNPCF/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/predefinedfields/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

- **TAKE_SNAPSHOT**
  - Method: `GET`
  - Template: `/sap/bc/adt/predefinedfields/objects/{pcf_node}/snapshot`

- **TAKE_SNAPSHOT_FORCE_OVERRIDE**
  - Method: `GET`
  - Template: `/sap/bc/adt/predefinedfields/objects/{pcf_node}/snapshot?forceOverride=true`

### JSON Formatter

**URL:** `/sap/bc/adt/predefinedfields/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/predefinedfields/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/predefinedfields/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Predefined Field Enabling Name Validation

**URL:** `/sap/bc/adt/predefinedfields/objects/validation`

## Schema Definitions

### Logical Database Schema

**URL:** `/sap/bc/adt/schema_definitions/amsdtyp`

**Operations:**

- **http://www.sap.com/wbobj/schema_definitions/amsdtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/schema_definitions/amsdtyp/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

### Logical Database Schema Name Validation

**URL:** `/sap/bc/adt/schema_definitions/amsdtyp/validation`

## Switch Framework

### Feature Toggle

**URL:** `/sap/bc/adt/sfw/featuretoggles`

**Operations:**

- **http://www.sap.com/wbobj/sfw/ftg2ft/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/sfw/ftg2ft/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/wbobj/sfw/ftg2ft/toggle**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/toggle`

- **http://www.sap.com/wbobj/sfw/ftg2ft/check**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/check`

- **http://www.sap.com/wbobj/sfw/ftg2ft/validate**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/validate`

- **http://www.sap.com/wbobj/sfw/ftg2ft/packages/validate**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/packages/{package_name}/validate`

- **http://www.sap.com/wbobj/sfw/ftg2ft/packages/objects**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/packages/objects`

- **http://www.sap.com/wbobj/sfw/ftg2ft/dependencies/validate**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/dependencies/validate`

- **http://www.sap.com/wbobj/sfw/ftg2ft/states**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/states`

- **http://www.sap.com/wbobj/sfw/ftg2ft/runtimestate**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/runtimestate`

- **http://www.sap.com/wbobj/sfw/ftg2ft/logs**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/logs`

- **http://www.sap.com/wbobj/sfw/ftg2ft/objects**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/objects`

- **http://www.sap.com/wbobj/sfw/ftg2ft/objects/validate**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/objects/validate{?uri}`

### JSON Formatter

**URL:** `/sap/bc/adt/sfw/featuretoggles/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/sfw/featuretoggles/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/sfw/featuretoggles/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Attribute Keys Value Help

**URL:** `/sap/bc/adt/sfw/featuretoggles/attributes/attributeKeys`

### Attribute Values Value Help

**URL:** `/sap/bc/adt/sfw/featuretoggles/attributes/attributeValues`

### Types of togglable objects

**URL:** `/sap/bc/adt/sfw/featuretoggles/objects/types`

### Toggling

**URL:** `/sap/bc/adt/sfw/featuretoggles/sfw/featuretoggles`

**Operations:**

- **http://www.sap.com/wbobj/sfw/ftg2ft/toggle**
  - Method: `GET`
  - Template: `/sap/bc/adt/sfw/featuretoggles/{object_name}/toggle`

### Reference Product Value Help

**URL:** `/sap/bc/adt/sfw/featuretoggles/referenceProduct/values`

### Feature Toggle Name Validation

**URL:** `/sap/bc/adt/sfw/featuretoggles/validation`

## Others

### Software Component Relations

**URL:** `/sap/bc/adt/swc/relations`

**Accept:**

- `application/vnd.sap.adt.blues.v2+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/wbobj/softwarecomponent/swcrtyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/swc/relations/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/softwarecomponent/swcrtyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/swc/relations/{object_name}/source/main{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/objects/new/schema/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/swc/relations/$new/schema{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/configuration/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/swc/relations/$new/configuration{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/new/content/additional**
  - Method: `POST`
  - Template: `/sap/bc/adt/swc/relations/$new/content{?relatedObjectUri}`

- **http://www.sap.com/adt/categories/objects/values/domainspecificnameditems**
  - Method: `PUT`
  - Template: `/sap/bc/adt/swc/relations/$values{?name,maxItemCount,path,objectUri}`

- **http://www.sap.com/adt/serverdriven/sideeffect**
  - Method: `GET`
  - Template: `/sap/bc/adt/swc/relations/$new/sideeffect{?path,determination,featureControl}`

### JSON Formatter

**URL:** `/sap/bc/adt/swc/relations/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/swc/relations/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/swc/relations/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Object Name Validation

**URL:** `/sap/bc/adt/swc/relations/validation`

## Others

### Transport Object Definition

**URL:** `/sap/bc/adt/transportobject/objects`

**Operations:**

- **http://www.sap.com/wbobj/transportobjects/tobjtob/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/transportobject/objects/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/transportobjects/tobjtob/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/transportobject/objects/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/transportobject/objects/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/transportobject/objects/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/transportobject/objects/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### Transport Object Definition Name Validation

**URL:** `/sap/bc/adt/transportobject/objects/validation`

## Connectivity

### ABAP Messaging Channel

**URL:** `/sap/bc/adt/uc_object_type_group/samc`

### AMC Message Type

**URL:** `/sap/bc/adt/uc_object_type_group/samc/messagetype/values`

### AMC Scope

**URL:** `/sap/bc/adt/uc_object_type_group/samc/scope/values`

### AMC Virus Scan Outgoing

**URL:** `/sap/bc/adt/uc_object_type_group/samc/virusscan/values`

### AMC Activity

**URL:** `/sap/bc/adt/uc_object_type_group/samc/activity/values`

### AMC Program Type

**URL:** `/sap/bc/adt/uc_object_type_group/samc/progtype/values`

### ABAP Messaging Channel Name Validation

**URL:** `/sap/bc/adt/uc_object_type_group/samc/validation`

### ABAP Push Channel Application

**URL:** `/sap/bc/adt/uc_object_type_group/sapc`

### APC Connection Type

**URL:** `/sap/bc/adt/uc_object_type_group/sapc/connectiontypes/values`

### APC Protocol Type

**URL:** `/sap/bc/adt/uc_object_type_group/sapc/protocoltypes/values`

### APC Virus Scan Outgoing

**URL:** `/sap/bc/adt/uc_object_type_group/sapc/virusscanout/values`

### APC Virus Scan Ingoing

**URL:** `/sap/bc/adt/uc_object_type_group/sapc/virusscanin/values`

### APC Superclass determination

**URL:** `/sap/bc/adt/uc_object_type_group/sapc/superclass/values`

### APC Superclass determination

**URL:** `/sap/bc/adt/uc_object_type_group/sapc/classproperties/values`

### URL for Testscenario

**URL:** `/sap/bc/adt/uc_object_type_group/sapc/testurl/values`

### Exist Service Pfad

**URL:** `/sap/bc/adt/uc_object_type_group/sapc/service_path/values`

### ABAP Push Channel Application Name Validation

**URL:** `/sap/bc/adt/uc_object_type_group/sapc/validation`

## Connectivity

### HTTP Service

**URL:** `/sap/bc/adt/ucon/httpservices`

**Accept:**

- `application/vnd.sap.adt.uconn.http.v1+xml`
- `text/html`

**Operations:**

- **http://www.sap.com/adt/connectivity/http/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ucon/httpservices/{object_name}{?class_name}`

### Object Name Validation

**URL:** `/sap/bc/adt/ucon/httpservices/validation`

### Handlerclasses search

**URL:** `/sap/bc/adt/ucon/httpservices/HandlerClassesUri`

## Others

### API Catalog

**URL:** `/sap/bc/adt/wbobj/apictyp`

**Operations:**

- **http://www.sap.com/wbobj/apicatalogs/apictyp/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/wbobj/apictyp/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/apicatalogs/apictyp/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/wbobj/apictyp/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/wbobj/apictyp/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/wbobj/apictyp/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/wbobj/apictyp/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### API Catalog Name Validation

**URL:** `/sap/bc/adt/wbobj/apictyp/validation`

## Others

### WMPC Application

**URL:** `/sap/bc/adt/wmpc/applications`

**Operations:**

- **http://www.sap.com/wbobj/workloadclasses/wmpc/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/wmpc/applications/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/wbobj/workloadclasses/wmpc/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/wmpc/applications/{object_name}/source/main{?corrNr,lockHandle,version}`

### JSON Formatter

**URL:** `/sap/bc/adt/wmpc/applications/source/formatter`

**Accept:**

- `application/json`

### Server driven framework - Schema

**URL:** `/sap/bc/adt/wmpc/applications/$schema`

**Accept:**

- `application/vnd.sap.adt.serverdriven.schema.v1+json; framework=objectTypes.v1`

### Server driven framework - Configuration

**URL:** `/sap/bc/adt/wmpc/applications/$configuration`

**Accept:**

- `application/vnd.sap.adt.serverdriven.configuration.v1+json; framework=objectTypes.v1`

### WMPC Application Name Validation

**URL:** `/sap/bc/adt/wmpc/applications/validation`

## Custom Analytical Queries

### Analytical custom query

**URL:** `/sap/bc/adt/ana/aqd`

**Accept:**

- `application/vnd.sap.adt.ddlSource+xml`

**Operations:**

- **http://www.sap.com/adt/categories/ana/aqd/ddlsource**
  - Method: `GET`
  - Template: `/sap/bc/adt/ana/aqd/ddlsource/{object_name}/source/main/{?corrNr,lockHandle,version}`

- **http://www.sap.com/adt/categories/ana/aqd/ddlsource/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ana/aqd/ddlsource/source/{object_name}`

- **http://www.sap.com/adt/categories/ana/aqd/elementinfos**
  - Method: `GET`
  - Template: `/sap/bc/adt/ana/aqd/elementinfos/{action}`

- **http://www.sap.com/adt/categories/ana/aqd/ddl/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ana/aqd/ddl/source/{action}`

- **http://www.sap.com/adt/categories/ana/aqd/ddlsource**
  - Method: `GET`
  - Template: `/sap/bc/adt/ana/aqd/ato/settings`

## Enterprise Services

### Semantic Contract

**URL:** `/sap/bc/esproxy/semanticcontracts`

### Contract

**URL:** `/sap/bc/esproxy/contracts`

### Contract Implementation

**URL:** `/sap/bc/esproxy/contractimplementations`

### Integration Scenario Definition

**URL:** `/sap/bc/esproxy/integrationscenariodefns`

### Proxy Data Type

**URL:** `/sap/bc/esproxy/datatypes`

### Proxy Message Type

**URL:** `/sap/bc/esproxy/messagetypes`

### Service Consumer

**URL:** `/sap/bc/esproxy/serviceconsumers`

### Service Provider

**URL:** `/sap/bc/esproxy/serviceproviders`

### Operation Mapping

**URL:** `/sap/bc/esproxy/operationmappings`

### Consumer Mapping

**URL:** `/sap/bc/esproxy/consumermappings`

### Consumer Factory

**URL:** `/sap/bc/esproxy/consumerfactories`

### Proxy Generic Search

**URL:** `/sap/bc/esproxy/search`

### Proxy Specific Browse Search

**URL:** `/sap/bc/esproxy/proxysearch`

### Validate Proxy Name

**URL:** `/sap/bc/esproxy/validate`

### SOA Manager

**URL:** `/sap/bc/esproxy/soamanager`

### Enterprise Services Repository Search

**URL:** `/sap/bc/esproxy/esrsearch`

### ESR SCV Search

**URL:** `/sap/bc/esproxy/esrscv`

### Services Registry Search

**URL:** `/sap/bc/esproxy/srsearch`

### RFC Consumer

**URL:** `/sap/bc/esproxy/rfcconsumers`

### Proxy Activation

**URL:** `/sap/bc/esproxy/activation`

## Runtime Memory Analysis

### Runtime Memory Analysis: Snapshots

**URL:** `/sap/bc/adt/runtime/memory/snapshots`

**Operations:**

- **snapshots**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots{?user,originalUser}`

- **snapshot**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}`

- **snapshot-ranking-list**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/rankinglist{?maxNumberOfObjects,excludeAbapType*,sortAscending,sortByColumnName,groupByParentType}`

- **snapshots-delta-ranking-list**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapdelta/rankinglist{?uri1,uri2,maxNumberOfObjects,excludeAbapType*,sortAscending,sortByColumnName,groupByParentType}`

- **snapshot-children**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/children{?parentKey,maxNumberOfObjects,sortAscending,sortByColumnName}`

- **snapshots-delta-children**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapdelta/children{?uri1,uri2,parentKey,maxNumberOfObjects,sortAscending,sortByColumnName}`

- **snapshot-references**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/references{?objectKey,maxNumberOfReferences}`

- **snapshots-delta-references**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapdelta/references{?uri1,uri2,objectKey,maxNumberOfReferences}`

- **snapshot-overview**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapshots/{snapshotId}/overview`

- **snapshots-delta-overview**
  - Method: `GET`
  - Template: `/sap/bc/adt/runtime/memory/snapdelta/overview{?uri1,uri2}`

## ABAP DCL Sources

### DCL Language Help Resource

**URL:** `/sap/bc/adt/docu/dcl/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/dcl/langu/docu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/dcl/langu{?dclLanguageHelpId,dclsName}`

### DCL Parser Information Resource

**URL:** `/sap/bc/adt/acm/dcl/parser`

### DCL Element Info Resource

**URL:** `/sap/bc/adt/acm/dcl/elementinfo`

**Operations:**

- **http://www.sap.com/adt/categories/acm/dcl/elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/acm/dcl/elementinfo{?path,path_type}`

### DCL Sources Validation

**URL:** `/sap/bc/adt/acm/dcl/validation`

**Operations:**

- **http://www.sap.com/adt/categories/acm/dclsources/validation**
  - Method: `GET`
  - Template: `/sap/bc/adt/acm/dcl/validation{?objname,packagename,description,template}`

### DCL Sources

**URL:** `/sap/bc/adt/acm/dcl/sources`

**Accept:**

- `application/vnd.sap.adt.dclSource+xml`

**Operations:**

- **http://www.sap.com/adt/categories/acm/dclsources/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/acm/dcl/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/adt/categories/acm/dclsources/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/acm/dcl/sources/{object_name}/source/main{?corrNr,lockHandle,version}`

### ACM Repository Objects Resource

**URL:** `/sap/bc/adt/acm/dcl/repositoryaccess`

**Operations:**

- **http://www.sap.com/adt/categories/acm/dcl/repositoryaccess**
  - Method: `GET`
  - Template: `/sap/bc/adt/acm/dcl/repositoryaccess{?authorizationObject,authorizationField,authorizationValue,aspect,role,pfcgMapping,conditionset,sacfScenario,switchName,toggleName}`

## Annotation Pushdown

### SADL: Annotation Pushdown Prepare

**URL:** `/sap/bc/adt/sadl/gw/annopush/prepare`

**Accept:**

- `application/xml`

**Operations:**

- **http://www.sap.com/adt/categories/sadl/gw/annopush/prepare**
  - Method: `GET`
  - Template: `/sap/bc/adt/sadl/gw/annopush/prepare{?packagename, transportid, layer, servicename}`

### SADL: Annotation Pushdown Push

**URL:** `/sap/bc/adt/sadl/gw/annopush/push`

**Accept:**

- `application/xml`

**Operations:**

- **http://www.sap.com/adt/categories/sadl/gw/annopush/push**
  - Method: `GET`
  - Template: `/sap/bc/adt/sadl/gw/annopush/push{?packagename, transportid, layer, servicename}`

### SADL: Annotation Pushdown Finalize

**URL:** `/sap/bc/adt/sadl/gw/annopush/finalize`

**Accept:**

- `application/xml`

**Operations:**

- **http://www.sap.com/adt/categories/sadl/gw/annopush/finalize**
  - Method: `GET`
  - Template: `/sap/bc/adt/sadl/gw/annopush/finalize{?packagename, transportid, layer, servicename}`

### SADL: Annotation Pushdown Validate

**URL:** `/sap/bc/adt/sadl/gw/annopush/validate`

**Accept:**

- `application/xml`
- `application/xml`

**Operations:**

- **http://www.sap.com/adt/categories/sadl/gw/annopush/validate**
  - Method: `GET`
  - Template: `/sap/bc/adt/sadl/gw/annopush/validate{?servicename}`

## Annotation Pushdown: Get Meta Data Extentions

### SADL: Annotation Pushdown Metadata Extentions

**URL:** `/sap/bc/adt/sadl/gw/mde`

**Accept:**

- `application/xml`

## Feed Repository

### Data Provider Repository

**URL:** `/sap/bc/adt/dataproviders`

## External tools configuration

### Business Application Studio configuration

**URL:** `/sap/bc/adt/externaltools/bas/configurations`

### Business Application Studio configuration (Metadata)

**URL:** `/sap/bc/adt/externaltools/bas/metadata`

## Feed Repository

### Feed Repository

**URL:** `/sap/bc/adt/feeds`

### Feed Variants

**URL:** `/sap/bc/adt/feeds/variants`

## Reentranceticket

### Security Reentranceticket

**URL:** `/sap/bc/adt/security/reentranceticket`

## ADT Rest Framework Resources

### ADT HTTP(S) Endpoint

**URL:** `/sap/bc/adt`

### ADT Stateful HTTP(S) Endpoint

**URL:** `/sap/bc/adt`

## Client

### Client

**URL:** `/sap/bc/adt/system/clients`

## System Information

### System Information

**URL:** `/sap/bc/adt/system/information`

### Installed Components

**URL:** `/sap/bc/adt/system/components`

## System Landscape

### System Landscape

**URL:** `/sap/bc/adt/system/landscape/servers`

**Operations:**

- **http://www.sap.com/adt/relations/system/landscape/servers**
  - Method: `GET`
  - Template: `/sap/bc/adt/system/landscape/servers{?onlyActiveServers}`

## User

### User

**URL:** `/sap/bc/adt/system/users`

**Operations:**

- **http://www.sap.com/adt/relations/system/users/query**
  - Method: `GET`
  - Template: `/sap/bc/adt/system/users{?querystring,maxcount}`

- **self**
  - Method: `GET`
  - Template: `/sap/bc/adt/system/users/{username}`

## VIT URI Mapping

### VIT URI Mapper

**URL:** `/sap/bc/adt/vit/urimapper`

**Operations:**

- **http://www.sap.com/adt/vit/uriMapper**
  - Method: `GET`
  - Template: `/sap/bc/adt/vit/urimapper{?uri}`

## API Releases

### API Releases

**URL:** `/sap/bc/adt/apireleases`

**Operations:**

- **http://www.sap.com/adt/categories/apirelease**
  - Method: `GET`
  - Template: `/sap/bc/adt/apireleases/{uri}`

- **http://www.sap.com/adt/categories/apireleasecontract**
  - Method: `GET`
  - Template: `/sap/bc/adt/apireleases/{uri}/{contract}{?request}`

- **http://www.sap.com/adt/categories/apireleasecontractvalidation**
  - Method: `GET`
  - Template: `/sap/bc/adt/apireleases/{uri}/{contract}/validationrun`

- **http://www.sap.com/adt/categories/apireleasecontracts**
  - Method: `GET`
  - Template: `/sap/bc/adt/apireleases/meta/supportedcontracts`

- **http://www.sap.com/adt/categories/apireleasefeatures**
  - Method: `GET`
  - Template: `/sap/bc/adt/apireleases/meta/features`

- **http://www.sap.com/adt/categories/apireleasemetadata**
  - Method: `GET`
  - Template: `/sap/bc/adt/apireleases/meta`

- **http://www.sap.com/adt/categories/apireleaseapisobject**
  - Method: `GET`
  - Template: `/sap/bc/adt/apireleases/apis/{apisid}`

- **http://www.sap.com/adt/categories/apireleaseapicatalogdata**
  - Method: `GET`
  - Template: `/sap/bc/adt/apireleases/apia/{uri}{?request}`

- **http://www.sap.com/adt/categories/apireleaseapicatalogobjects**
  - Method: `GET`
  - Template: `/sap/bc/adt/apireleases/apic/{uri}`

## ABAP Test Cockpit

### ATC results

**URL:** `/sap/bc/adt/atc/results`

**Operations:**

- **http://www.sap.com/adt/atc/relations/results/active**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/results{?activeResult,contactPerson}`

- **http://www.sap.com/adt/atc/relations/results/activeforsysid**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/results{?activeResult,contactPerson,sysId}`

- **http://www.sap.com/adt/atc/relations/results/user**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/results{?createdBy,ageMin,ageMax,contactPerson}`

- **http://www.sap.com/adt/atc/relations/results/central**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/results{?centralResult,createdBy,contactPerson,ageMin,ageMax}`

- **http://www.sap.com/adt/atc/relations/results/centralforsysid**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/results{?centralResult,createdBy,contactPerson,ageMin,ageMax,sysId}`

- **http://www.sap.com/adt/atc/relations/results/displayid**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/results/{displayId}{?activeResult,contactPerson,includeExemptedFindings}`

- **http://www.sap.com/adt/atc/relations/results/log**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/results/{executionId}/log`

### ATC customizing

**URL:** `/sap/bc/adt/atc/customizing`

### ATC runs

**URL:** `/sap/bc/adt/atc/runs`

**Operations:**

- **http://www.sap.com/adt/atc/relations/worklist**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/runs{?worklistId,clientWait}`

- **http://www.sap.com/adt/atc/relations/runs**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/runs/{projectId}`

- **http://www.sap.com/adt/atc/relations/runs/action**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/runs/{projectId}{?action}`

### CCS Tunnel

**URL:** `/sap/bc/adt/atc/ccstunnel`

**Operations:**

- **http://www.sap.com/adt/atc/relations/ccstunnel/ccstunnel**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/ccstunnel{?targetUri}`

### Result Worklist

**URL:** `/sap/bc/adt/atc/result/worklist`

**Operations:**

- **http://www.sap.com/adt/atc/relations/result/worklist**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/result/worklist/{worklistId}/{displayId}{?contactPerson}`

### Check Failure

**URL:** `/sap/bc/adt/atc/checkfailures`

**Operations:**

- **http://www.sap.com/adt/atc/relations/checkfailures**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checkfailures/{worklistId}{?displayId}`

### Check Failure Details

**URL:** `/sap/bc/adt/atc/checkfailures/logs`

**Operations:**

- **http://www.sap.com/adt/atc/relations/checkfailures/logs**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checkfailures/logs{?displayId,objName,objType,moduleId,phaseKey}`

### ATC worklist

**URL:** `/sap/bc/adt/atc/worklists`

**Operations:**

- **http://www.sap.com/adt/atc/relations/new**
  - Method: `POST`
  - Template: `/sap/bc/adt/atc/worklists{?checkVariant}`

- **http://www.sap.com/adt/atc/relations/get**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/worklists/{worklistId}{?timestamp,usedObjectSet,includeExemptedFindings}`

- **http://www.sap.com/adt/atc/relations/objectset**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/worklists/{worklistId}/{objectSetName}{?timestamp,includeExemptedFindings}`

- **http://www.sap.com/adt/atc/relations/actions/deleteFindings**
  - Method: `DELETE`
  - Template: `/sap/bc/adt/atc/worklists/{worklistId}{?action}`

### Autoquickfix

**URL:** `/sap/bc/adt/atc/autoqf/worklist`

**Accept:**

- `application/vnd.sap.adt.atc.objectreferences.v1+xml`
- `application/vnd.sap.adt.atc.autoqf.proposal.v1+xml`
- `application/vnd.sap.adt.atc.autoqf.selection.v1+xml`
- `application/vnd.sap.adt.atc.genericrefactoring.v1+xml`

### ATC Remarks

**URL:** `/sap/bc/adt/atc/remarks`

**Accept:**

- `application/vnd.sap.adt.atc.remarks.v1+xml`

### List of Approvers

**URL:** `/sap/bc/adt/atc/approvers`

### List of Variants

**URL:** `/sap/bc/adt/atc/variants`

**Operations:**

- **http://www.sap.com/adt/atc/relations/variants/referenceVariant**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/variants{?maxItemCount,data}`

### Exemptions Apply

**URL:** `/sap/bc/adt/atc/exemptions/apply`

**Operations:**

- **http://www.sap.com/adt/atc/relations/exemptions/apply/template**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/exemptions/apply{?markerId}`

- **http://www.sap.com/adt/atc/relations/exemptions/apply**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/exemptions/apply{?markerId}`

### Exemptions View

**URL:** `/sap/bc/adt/atc/checkexemptionsview`

**Operations:**

- **http://www.sap.com/adt/atc/relations/checkexemptionsview**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/checkexemptionsview{?aggregatesOnly,requestedBy,assessedBy,assessableBy,exemptionState}{exemptionName}`

- **http://www.sap.com/adt/atc/relations/exemptions/findingItemId**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/exemptions/atcexemption/{findingItemId}`

### Approver Notifications

**URL:** `/sap/bc/adt/atc/apprNotifi/subscriptions`

**Operations:**

- **http://www.sap.com/adt/atc/relations/apprNotifi/subscriptions**
  - Method: `GET`
  - Template: `/sap/bc/adt/atc/apprNotifi/subscriptions{?userName}`

### ATC Configuration

**URL:** `/sap/bc/adt/atc/configuration/configurations`

### ATC Configuration (Metadata)

**URL:** `/sap/bc/adt/atc/configuration/metadata`

## ABAP Unit

### ABAP Unit Testruns

**URL:** `/sap/bc/adt/abapunit/testruns`

**Accept:**

- `application/vnd.sap.adt.abapunit.testruns.config.v1+xml`
- `application/vnd.sap.adt.abapunit.testruns.config.v2+xml`
- `application/vnd.sap.adt.abapunit.testruns.config.v3+xml`
- `application/vnd.sap.adt.abapunit.testruns.config.v4+xml`
- `application/xml`

### ABAP Unit Metadata

**URL:** `/sap/bc/adt/abapunit/metadata`

### ABAP Unit Testruns Evaluation

**URL:** `/sap/bc/adt/abapunit/testruns/evaluation`

**Accept:**

- `application/vnd.sap.adt.abapunit.testruns.evaluation.config.v1+xml`
- `application/vnd.sap.adt.abapunit.testruns.evaluation.config.v2+xml`
- `application/vnd.sap.adt.abapunit.testruns.evaluation.config.v3+xml`

### ABAP Unit Explain Tool

**URL:** `/sap/bc/adt/abapunit/explain`

**Accept:**

- `application/vnd.sap.adt.aunit.explain.request.v1+asjson`

**Operations:**

- **http://www.sap.com/adt/relations/abapunit/explain/capabilities**
  - Method: `GET`
  - Template: `/sap/bc/adt/abapunit/explain/capabilities{?uri}`

### ABAP Unit

**URL:** `/sap/bc/adt/abapunit/runs`

**Operations:**

- **http://www.sap.com/adt/relations/abapunit/previews**
  - Method: `GET`
  - Template: `/sap/bc/adt/abapunit/previews{?withNavigationUris}`

### /abapunit/ai/chat/action

**URL:** `/sap/bc/adt/abapunit/ai/chat/action`

**Accept:**

- `application/vnd.sap.adt.aunit.chat.action.v1+asjson`

**Operations:**

- **get**
  - Method: `GET`
  - Template: `/sap/bc/adt/abapunit/ai/chat/action{?class,action,testclass,object_name,object_type}`

## Test Double Framework for managing db dependencies

### Get DDL Dependency

**URL:** `/sap/bc/adt/aunit/dbtestdoubles/cds/dependencies`

**Operations:**

- **http://www.sap.com/adt/categories/aunit/dbtestdoubles/cds/dependencies**
  - Method: `GET`
  - Template: `/sap/bc/adt/aunit/dbtestdoubles/cds/dependencies{?ddlsourceName,dependencyLevel,withAssociations,contextPackage}`

### Get DDL dependency info

**URL:** `/sap/bc/adt/aunit/dbtestdoubles/cds/dependencies/info`

**Operations:**

- **http://www.sap.com/adt/categories/aunit/dbtestdoubles/cds/dependencies**
  - Method: `GET`
  - Template: `/sap/bc/adt/aunit/dbtestdoubles/cds/dependencies/info{?ddlsourceName,dependencyLevel,withAssociations}`

- **http://www.sap.com/adt/categories/aunit/dbtestdoubles/cds/dependencies/info**
  - Method: `GET`
  - Template: `/sap/bc/adt/aunit/dbtestdoubles/cds/dependencies/info{?name,type}`

### Validate DDL entity

**URL:** `/sap/bc/adt/aunit/dbtestdoubles/cds/validation`

**Operations:**

- **http://www.sap.com/adt/categories/aunit/dbtestdoubles/cds/validation**
  - Method: `GET`
  - Template: `/sap/bc/adt/aunit/dbtestdoubles/cds/validation{?ddlName}`

## ABAP Source Based Dictionary

### Element Info Resource

**URL:** `/sap/bc/adt/ddic/elementinfo`

**Operations:**

- **http://www.sap.com/adt/categories/ddic/elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/elementinfo{?path,uri}{&context}{&type*}`

### Code Completion Resource

**URL:** `/sap/bc/adt/ddic/codecompletion`

**Operations:**

- **http://www.sap.com/adt/categories/ddic/codecompletion**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/codecompletion{?path}{&type*}{&context}{&property*}{&contextUri}`

## Business Logic Extensions

### badis

**URL:** `/sap/bc/adt/businesslogicextensions/badis`

**Operations:**

- **http://www.sap.com/adt/relations/businesslogicextensions/badis/compatibilitycheckruns**
  - Method: `GET`
  - Template: `/sap/bc/adt/businesslogicextensions/badis/{extensionname}/compatibilitycheckruns`

### badinameproposals

**URL:** `/sap/bc/adt/businesslogicextensions/badinameproposals`

**Operations:**

- **http://www.sap.com/adt/relations/businesslogicextensions/badis/nameproposal**
  - Method: `GET`
  - Template: `/sap/bc/adt/businesslogicextensions/badinameproposals{?badidefinition}`

## Object Classification System

### Classifications

**URL:** `/sap/bc/adt/classifications`

**Accept:**

- `application/vnd.sap.adt.classification+xml`

**Operations:**

- **http://www.sap.com/adt/categories/classifications**
  - Method: `GET`
  - Template: `/sap/bc/adt/classifications{?uri}`

- **http://www.sap.com/adt/categories/classifications/api/supportedTypes**
  - Method: `GET`
  - Template: `/sap/bc/adt/classifications/api/supportedTypes`

## Change and Transport System

### Transports

**URL:** `/sap/bc/adt/cts/transports`

**Accept:**

- `application/vnd.sap.as+xml;charset=utf-8;dataname=com.sap.adt.transport.service.checkData`
- `application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.CreateCorrectionRequest`
- `application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.CreateCorrectionRequest.v1`
- `application/vnd.sap.adt.transports.search.v1+xml`

**Operations:**

- **http://www.sap.com/adt/categories/cts/transports/search**
  - Method: `GET`
  - Template: `/sap/bc/adt/cts/transports/search{?searchFor,transportNumber,owner*,requestType*,requestStatus*,taskType*,taskStatus*,fromDate,toDate}`

### Transport Checks

**URL:** `/sap/bc/adt/cts/transportchecks`

### Transport Management

**URL:** `/sap/bc/adt/cts/transportrequests`

**Accept:**

- `application/vnd.sap.adt.transportorganizer.v1+xml`

**Operations:**

- **http://www.sap.com/adt/categories/cts/transportrequests**
  - Method: `GET`
  - Template: `/sap/bc/adt/cts/transportrequests{?targets}`

- **http://www.sap.com/adt/categories/cts/transportrequests/valuehelp/attribute**
  - Method: `GET`
  - Template: `/sap/bc/adt/cts/transportrequests/valuehelp/attribute{?maxItemCount}{&name}`

- **http://www.sap.com/adt/categories/cts/transportrequests/valuehelp/target**
  - Method: `GET`
  - Template: `/sap/bc/adt/cts/transportrequests/valuehelp/target{?maxItemCount}{&name}`

- **http://www.sap.com/adt/categories/cts/transportrequests/valuehelp/ctsproject**
  - Method: `GET`
  - Template: `/sap/bc/adt/cts/transportrequests/valuehelp/ctsproject{?maxItemCount}{&name}`

- **http://www.sap.com/adt/categories/cts/transportrequests/valuehelp/object**
  - Method: `GET`
  - Template: `/sap/bc/adt/cts/transportrequests/valuehelp/object/{field}{?maxItemCount}{&name}`

### Transport Management

**URL:** `/sap/bc/adt/cts/transportrequests/reference`

### Transport Search Configurations

**URL:** `/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations`

### Transport Search Configurations (Metadata)

**URL:** `/sap/bc/adt/cts/transportrequests/searchconfiguration/metadata`

### Supported facets of a transport request

**URL:** `/sap/bc/adt/cts/transportrequests/facets`

## CDS Annotation Related ADT Resource

### CDS Annotation Definitions

**URL:** `/sap/bc/adt/ddic/cds/annotation/definitions`

### Element Info for CDS Annotations

**URL:** `/sap/bc/adt/ddic/cds/annotation/elementinfo`

**Operations:**

- **http://www.sap.com/adt/relations/ddic/cds/annotation/elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/cds/annotation/elementinfo{?path,enumValue}`

### Code Completion for Generic Object Reference

**URL:** `/sap/bc/adt/ddic/cds/annotation/objref/proposal`

**Operations:**

- **http://www.sap.com/adt/relations/annotation/objref/proposal**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/cds/annotation/objref/proposal{?path,value,objectName,objectType,alv,signalCompleteness}`

## CDS Annotation Definitions

### DDLA Case Preserving Formatter for Identifiers

**URL:** `/sap/bc/adt/ddic/ddla/formatter/identifiers`

**Accept:**

- `text/plain`

### DDLA Language Help Resource

**URL:** `/sap/bc/adt/docu/ddla/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/ddla/langu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/ddla/langu{?ddlaSearchWord,ddlaStatementName,ddlaRootAnnotation}`

### DDLA Parser Info Resource

**URL:** `/sap/bc/adt/ddic/ddla/parser/info`

### DDLA Text Length Calculator

**URL:** `/sap/bc/adt/ddic/ddla/textlengthcalc`

**Operations:**

- **http://www.sap.com/adt/relations/ddic/ddla/textlengthcalc**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddla/textlengthcalc{?definedlength}`

### DDLA Dictionary Repository Access Resource

**URL:** `/sap/bc/adt/ddic/ddla/repositoryaccess`

**Operations:**

- **http://www.sap.com/adt/relations/ddic/ddla/repositoryaccess**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddla/repositoryaccess{?path}`

## ABAP DDL Sources

### DDL Parser Information Resource

**URL:** `/sap/bc/adt/ddic/ddl/parser`

### DDL Dictionary Repository Access Resource

**URL:** `/sap/bc/adt/ddic/ddl/ddicrepositoryaccess`

**Operations:**

- **http://www.sap.com/adt/categories/ddic/ddl/ddicrepositoryaccess**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/ddicrepositoryaccess{?column,datasource,datasourcetype*,requestScope*,path*,targetUriRequired,unlimitedResultSizeForElements,uriRequired,exactMatch,role,dsfd,cdsTypeAndDataElement,drasPath,drtyPath,bdef,bdefEntity,bdefAction,bdefFunction,ddlsName,abapLanguageVersion,currentSourceName,currentSourceType,objectType*}`

### DDL Dependency Analyzer Resource

**URL:** `/sap/bc/adt/ddic/ddl/dependencies/graphdata`

**Operations:**

- **http://www.sap.com/adt/categories/ddic/ddl/dependencies/graphdata**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/dependencies/graphdata{?ddlsourceName*,addMetrics*}`

### DDL Dictionary Element Info Resource

**URL:** `/sap/bc/adt/ddic/ddl/elementinfo`

**Accept:**

- `text/plain`

**Operations:**

- **http://www.sap.com/adt/categories/ddic/ddl/elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/elementinfo{?getTargetForAssociation,getFullTypeFieldInformation,getLabelTextsOfDataElementForFields,getExtensionViews,getSecondaryObjects,dataType,cdsFunction,path*}`

### Dictionary Mass Element Info Resource

**URL:** `/sap/bc/adt/ddic/ddl/elementinfos`

### DDL Element Mapping Resource

**URL:** `/sap/bc/adt/ddic/ddl/elementmappings`

### DDL Element Mapping Strategies Resource

**URL:** `/sap/bc/adt/ddic/ddl/elementmappings/strategies`

### DDL Language Help Resource

**URL:** `/sap/bc/adt/docu/ddl/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/ddl/langu/docu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/ddl/langu{?ddlSearchWord,ddlStatementName,ddlRootAnnotation,ddlsName}`

### DDL Sources Validation

**URL:** `/sap/bc/adt/ddic/ddl/validation`

**Operations:**

- **http://www.sap.com/adt/categories/ddic/ddlsources/validation**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/validation{?objname,packagename,description,template}`

### DDL Sources

**URL:** `/sap/bc/adt/ddic/ddl/sources`

**Accept:**

- `application/vnd.sap.adt.ddlSource+xml`

**Operations:**

- **http://www.sap.com/adt/categories/ddic/ddlsources/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/sources/{object_name}{?corrNr,lockHandle,version,accessMode,_action}`

- **http://www.sap.com/adt/categories/ddic/ddlsources/source**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/sources/{object_name}/source/main{?corrNr,lockHandle,version}`

### DDL Case Preserving Formatter for Identifiers

**URL:** `/sap/bc/adt/ddic/ddl/formatter/identifiers`

**Accept:**

- `text/plain`

### DDL pretty printer configuration

**URL:** `/sap/bc/adt/ddic/ddl/formatter/configurations`

**Operations:**

- **http://www.sap.com/adt/relations/ddic/ddl/formatter/configurations**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/formatter/configurations{?ddlsourceName,packageName,defaultConfiguration}`

- **http://www.sap.com/adt/relations/ddic/ddl/formatter/configurations/name**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/formatter/configurations/{object_name}`

### DDL sqlView Create Statement Resource

**URL:** `/sap/bc/adt/ddic/ddl/createstatements`

**Operations:**

- **http://www.sap.com/adt/relations/ddic/ddl/createstatements**
  - Method: `POST`
  - Template: `/sap/bc/adt/ddic/ddl/createstatements/{object_name}`

### DDL Active Object Resource

**URL:** `/sap/bc/adt/ddic/ddl/activeobject`

**Operations:**

- **http://www.sap.com/adt/categories/ddic/ddl/activeobject**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/activeobject{?datasource,datasourcetype,sourcetype*}`

### Related Objects Resource

**URL:** `/sap/bc/adt/ddic/ddl/relatedObjects`

**Operations:**

- **http://www.sap.com/adt/relations/ddic/ddl/relatedObjects/entity/name**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/relatedObjects/entity/{name}`

- **http://www.sap.com/adt/relations/ddic/ddl/relatedObjects/ddlsource/name**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/relatedObjects/ddlsource/{name}`

### Migration Wizard Object Validation Resource

**URL:** `/sap/bc/adt/ddic/ddl/migration/validation`

**Accept:**

- `application/vnd.sap.adt.ddl.migrationobjects.v2+xml`

### Run Migration in Background

**URL:** `/sap/bc/adt/ddic/ddl/migration/bgruns`

**Accept:**

- `application/vnd.sap.adt.ddl.migrationobjects.v2+xml`

### Get Migration Log Details

**URL:** `/sap/bc/adt/ddic/ddl/migration/logs`

**Operations:**

- **http://www.sap.com/adt/relations/migration/logs**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddl/migration/logs/{logId}`

## CDS Metadata Extensions

### DDLX Parser Info Resource

**URL:** `/sap/bc/adt/ddic/ddlx/parser/info`

### DDLX Case Preserving Formatter for Identifiers

**URL:** `/sap/bc/adt/ddic/ddlx/formatter/identifiers`

**Accept:**

- `text/plain`

### DDLX Language Help Resource

**URL:** `/sap/bc/adt/docu/ddlx/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/ddlx/langu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/ddlx/langu{?ddlxSearchWord,ddlxStatementName,ddlxRootAnnotation,ddlxName}`

### Annotation chain resource

**URL:** `/sap/bc/adt/ddic/ddlx/annotation/chain`

**Operations:**

- **http://www.sap.com/wbobj/cds/annotation/chain**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/ddlx/annotation/chain{?entity,element,variant}`

## CDS Aspect

### CDS Aspect Language Help

**URL:** `/sap/bc/adt/docu/dras/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/dras/langu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/dras/langu{?uri}`

## CDS Type

### CDS Type Language Help

**URL:** `/sap/bc/adt/docu/drty/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/drty/langu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/drty/langu{?uri}`

## Dependency Rules

### DRUL Parser Info Resource

**URL:** `/sap/bc/adt/ddic/drul/parser/info`

### DRUL Language Help Resource

**URL:** `/sap/bc/adt/docu/drul/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/drul/langu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/drul/langu{?drulSearchWord,drulStatementName}`

## Scalar Functions

### Scalar Functions Language Help

**URL:** `/sap/bc/adt/docu/dsfd/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/dsfd/langu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/dsfd/langu{?uri}`

## Dynamic View Caches

### DTDC Language Help Resource

**URL:** `/sap/bc/adt/docu/dtdc/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/dtdc/langu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/dtdc/langu{?dtdcSearchWord,dtdcStatementName,dtdcRootAnnotation,dtdcName}`

### Dynamic View Cache Parser Info Resource

**URL:** `/sap/bc/adt/ddic/dtdc/parser/info`

### Dynamic View Cache Create SQL Statement Resource

**URL:** `/sap/bc/adt/ddic/dtdc/createstatements`

**Operations:**

- **http://www.sap.com/adt/relations/ddic/dtdc/createstatements**
  - Method: `POST`
  - Template: `/sap/bc/adt/ddic/dtdc/createstatements/{object_name}`

## Entity Buffers

### Entity Buffer Language Help Resource

**URL:** `/sap/bc/adt/docu/dteb/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/dteb/langu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/dteb/langu{?uri}`

### Entity Buffer Parser Info Resource

**URL:** `/sap/bc/adt/ddic/dteb/parser/info`

### Entity Buffer Formatter

**URL:** `/sap/bc/adt/ddic/dteb/formatter`

**Accept:**

- `text/plain`

### Entity Buffer Code Completion

**URL:** `/sap/bc/adt/ddic/dteb/codecompletion/proposal`

### Entity Buffer Element Info

**URL:** `/sap/bc/adt/ddic/dteb/elementinfo`

**Operations:**

- **elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/dteb/elementinfo{?uri}`

### Entity Buffer Navigation Support

**URL:** `/sap/bc/adt/ddic/dteb/navigation`

## Lock Objects

### ENQU Lock Mode Named Items

**URL:** `/sap/bc/adt/ddic/lockobjects/lockmodes`

### ENQU Secondary Table Proposals

**URL:** `/sap/bc/adt/ddic/lockobjects/tables`

### ENQU Lock Object Adjustment

**URL:** `/sap/bc/adt/ddic/lockobjects/adjustment`

### ENQU Lock Object Validation

**URL:** `/sap/bc/adt/ddic/lockobjects/validation`

## ABAP Dictionary Logs

### DDIC Activation Graph Resource

**URL:** `/sap/bc/adt/ddic/logs/activationgraph`

**Operations:**

- **http://www.sap.com/adt/categories/ddic/logs/activation/graph**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/logs/activationgraph{?objectName,objectType,logName}`

## ABAP Database Procedure Proxies

### Database Procudre Proxies

**URL:** `/sap/bc/adt/ddic/dbprocedureproxies`

### DDIC SQSC Validation

**URL:** `/sap/bc/adt/ddic/validation`

## Service Definitions

### SRVD Language Help Resource

**URL:** `/sap/bc/adt/docu/srvd/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/srvd/langu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/srvd/langu{?srvdSearchWord,srvdStatementName,srvdRootAnnotation,srvdName}`

### SRVD Parser Info Resource

**URL:** `/sap/bc/adt/ddic/srvd/parser/info`

### SRVD Case Preserving Formatter for Identifiers

**URL:** `/sap/bc/adt/ddic/srvd/formatter/identifiers`

**Accept:**

- `text/plain`

### SRVD Source Types

**URL:** `/sap/bc/adt/ddic/srvd/sourceTypes`

### SRVD Services

**URL:** `/sap/bc/adt/ddic/srvd/services`

### Service Definition Element Info Resource

**URL:** `/sap/bc/adt/ddic/srvd/elementinfo`

**Operations:**

- **http://www.sap.com/adt/categories/ddic/srvd/elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/ddic/srvd/elementinfo{?path}`

## Type Groups

### TypeGroups

**URL:** `/sap/bc/adt/ddic/typegroups`

### Validation

**URL:** `/sap/bc/adt/ddic/typegroups/validation`

## ABAP External Views

### Views

**URL:** `/sap/bc/adt/ddic/views`

### View Validation

**URL:** `/sap/bc/adt/ddic/views/$validation`

## ABAP Source

### Code Completion

**URL:** `/sap/bc/adt/abapsource/codecompletion/proposal`

### Element Info

**URL:** `/sap/bc/adt/abapsource/codecompletion/elementinfo`

**Accept:**

- `text/plain`

**Operations:**

- **http://www.sap.com/adt/relations/elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/abapsource/codecompletion/elementinfo{?uri,fullname}`

### Code Insertion

**URL:** `/sap/bc/adt/abapsource/codecompletion/insertion`

### HANA Catalog Access

**URL:** `/sap/bc/adt/abapsource/codecompletion/hanacatalogaccess`

**Operations:**

- **http://www.sap.com/adt/relations/abapsource/codecompletion/hanacatalogaccess**
  - Method: `GET`
  - Template: `/sap/bc/adt/abapsource/codecompletion/hanacatalogaccess{?requestScope*,pattern*}`

### Type Hierarchy

**URL:** `/sap/bc/adt/abapsource/typehierarchy`

**Accept:**

- `application/vnd.sap.adt.typehierachy.result.v1+xml`

### Pretty Printer

**URL:** `/sap/bc/adt/abapsource/prettyprinter`

### Pretty Printer Settings

**URL:** `/sap/bc/adt/abapsource/prettyprinter/settings`

**Accept:**

- `application/vnd.sap.adt.ppsettings.v2+xml`
- `application/vnd.sap.adt.ppsettings.v3+xml`
- `application/vnd.sap.adt.ppsettings.v4+xml`
- `application/vnd.sap.adt.ppsettings.v5+xml`

### Cleanup

**URL:** `/sap/bc/adt/abapsource/cleanup/source`

### Occurrence Markers

**URL:** `/sap/bc/adt/abapsource/occurencemarkers`

### Parser

**URL:** `/sap/bc/adt/abapsource/parsers/rnd/grammar`

### Export ABAP Doc

**URL:** `/sap/bc/adt/abapsource/abapdoc/exportjobs`

**Accept:**

- `application/vnd.sap.adt.abapsource.abapdoc.exportjobs.v1+xml`

## Navigation

### Navigation

**URL:** `/sap/bc/adt/navigation/target`

**Accept:**

- `application/xml`
- `semantic.navigation.v1`

**Operations:**

- **http://www.sap.com/adt/categories/navigation/options**
  - Method: `GET`
  - Template: `/sap/bc/adt/navigation/target{?uri,filter,fullname}`

### Navigation Update

**URL:** `/sap/bc/adt/navigation/indexupdate`

**Operations:**

- **http://www.sap.com/adt/categories/navigation/options**
  - Method: `GET`
  - Template: `/sap/bc/adt/navigation/indexupdate{?uri}`

## Programs

### Includes

**URL:** `/sap/bc/adt/programs/includes`

### Programs

**URL:** `/sap/bc/adt/programs/programs`

**Operations:**

- **http://www.sap.com/adt/categories/programs/valuehelp/logicalDataBase**
  - Method: `GET`
  - Template: `/sap/bc/adt/programs/programs/{programname}/valuehelp/logicaldatabase`

- **http://www.sap.com/adt/categories/programs/valuehelp/authorizationGroup**
  - Method: `GET`
  - Template: `/sap/bc/adt/programs/programs/{programname}/valuehelp/authorizationgroup`

- **http://www.sap.com/adt/categories/programs/valuehelp/application**
  - Method: `GET`
  - Template: `/sap/bc/adt/programs/programs/{programname}/valuehelp/application`

- **http://www.sap.com/adt/categories/programs/valuehelp/ldbSelectionScreen**
  - Method: `GET`
  - Template: `/sap/bc/adt/programs/programs/{programname}/valuehelp/ldbselectionscreen`

### Run a program

**URL:** `/sap/bc/adt/programs/programrun`

**Operations:**

- **http://www.sap.com/adt/relations/programs/programrun**
  - Method: `GET`
  - Template: `/sap/bc/adt/programs/programrun/{programname}{?profilerId}`

- **http://www.sap.com/adt/relations/programs/programrun/job**
  - Method: `GET`
  - Template: `/sap/bc/adt/programs/programrun/job/{programname}`

### Program Validation

**URL:** `/sap/bc/adt/programs/validation`

### Include Validation

**URL:** `/sap/bc/adt/includes/validation`

## Text Elements

### Text Elements

**URL:** `/sap/bc/adt/textelements/programs`

**Accept:**

- `application/vnd.sap.adt.textelements.v1+xml`

### Text Elements

**URL:** `/sap/bc/adt/textelements/functiongroups`

**Accept:**

- `application/vnd.sap.adt.textelements.v1+xml`

### Text Elements

**URL:** `/sap/bc/adt/textelements/classes`

**Accept:**

- `application/vnd.sap.adt.textelements.v1+xml`

## Classes and Interfaces

### Classes

**URL:** `/sap/bc/adt/oo/classes`

**Accept:**

- `application/vnd.sap.adt.oo.classes.v4+xml`

### Interfaces

**URL:** `/sap/bc/adt/oo/interfaces`

**Accept:**

- `application/vnd.sap.adt.oo.interfaces.v5+xml`

### Validation of Object Name

**URL:** `/sap/bc/adt/oo/validation/objectname`

### Run a class

**URL:** `/sap/bc/adt/oo/classrun`

**Operations:**

- **http://www.sap.com/adt/relations/oo/classrun**
  - Method: `GET`
  - Template: `/sap/bc/adt/oo/classrun/{classname}{?profilerId}`

## Basic Object Properties

### Basic Object Properties

**URL:** `/sap/bc/adt/vit/wb/object_type`

**Operations:**

- **http://www.sap.com/adt/categories/basic/object/properties**
  - Method: `GET`
  - Template: `/sap/bc/adt/vit/wb/object_type/{type}/object_name/{name}`

## Deletion

### Deletion

**URL:** `/sap/bc/adt/deletion/delete`

**Accept:**

- `application/vnd.sap.adt.deletion.request.v1+xml`

### Deletion check

**URL:** `/sap/bc/adt/deletion/check`

**Accept:**

- `application/vnd.sap.adt.deletion.check.request.v1+xml`

## Activation

### Inactive Objects

**URL:** `/sap/bc/adt/activation/inactiveobjects`

**Operations:**

- **http://www.sap.com/adt/relations/activation/inactiveobjects**
  - Method: `GET`
  - Template: `/sap/bc/adt/activation/inactiveobjects{?USERNAME}`

- **http://www.sap.com/adt/relations/activation/inactiveobjects/update**
  - Method: `PUT`
  - Template: `/sap/bc/adt/activation/inactiveobjects{?action}`

### Activation

**URL:** `/sap/bc/adt/activation`

### Activation in background

**URL:** `/sap/bc/adt/activation/runs`

**Accept:**

- `application/vnd.sap.adt.activationrun.v1+xml`

**Operations:**

- **http://www.sap.com/adt/relations/runs/run**
  - Method: `GET`
  - Template: `/sap/bc/adt/activation/runs/{run_id}{?withLongPolling}`

- **activationBgRunsStatus**
  - Method: `GET`
  - Template: `/sap/bc/adt/activation/runs/status{?extended}`

### Activation result

**URL:** `/sap/bc/adt/activation/results`

**Operations:**

- **http://www.sap.com/adt/relations/runs/result**
  - Method: `GET`
  - Template: `/sap/bc/adt/activation/results/{result_id}`

### Check

**URL:** `/sap/bc/adt/checkruns`

**Operations:**

- **http://www.sap.com/adt/categories/check/relations/reporters**
  - Method: `GET`
  - Template: `/sap/bc/adt/checkruns{?reporters}`

### Reporters

**URL:** `/sap/bc/adt/checkruns/reporters`

## URI Fragment Mapper

### URI Fragment Mapper

**URL:** `/sap/bc/adt/urifragmentmappings`

**Operations:**

- **http://www.sap.com/adt/categories/urimapping/fragments/plaintext**
  - Method: `GET`
  - Template: `/sap/bc/adt/urifragmentmappings?targettype=plaintext&uri={uri}`

## Floor Plan Manager

### FPM Applications Creation Tools

**URL:** `/sap/bc/adt/fpm/creationtools`

## Function Groups; Functions; Function Group Includes

### Function Group Validation

**URL:** `/sap/bc/adt/functions/validation`

### Function Groups

**URL:** `/sap/bc/adt/functions/groups`

**Accept:**

- `application/vnd.sap.adt.functions.groups.v3+xml`

**Operations:**

- **http://www.sap.com/adt/categories/functiongroups/functionmodules**
  - Method: `GET`
  - Template: `/sap/bc/adt/functions/groups/{groupname}/fmodules`

- **http://www.sap.com/adt/categories/functiongroups/includes**
  - Method: `GET`
  - Template: `/sap/bc/adt/functions/groups/{groupname}/includes`

## Message Classes

### Message Classes

**URL:** `/sap/bc/adt/messageclass`

**Operations:**

- **http://www.sap.com/adt/categories/messageclasses/message**
  - Method: `GET`
  - Template: `/sap/bc/adt/messageclass/{mc_name}`

- **http://www.sap.com/adt/categories/messageclasses/message**
  - Method: `GET`
  - Template: `/sap/bc/adt/messageclass/{mc_name}/messages/{msg_no}`

- **http://www.sap.com/adt/categories/messageclasses/messages/longtext**
  - Method: `GET`
  - Template: `/sap/bc/adt/messageclass/{mc_name}/messages/{msg_no}/longtext`

### Validation of Message class Name

**URL:** `/sap/bc/adt/messageclass/validation`

**Operations:**

- **http://www.sap.com/adt/categories/messageclasses/validation**
  - Method: `GET`
  - Template: `/sap/bc/adt/messageclass/validation{?objname,description}`

## HANA-Integration

### Vendors for HANA-Integration

**URL:** `/sap/bc/adt/nhi/vendors`

### Deliveryunit-Proxies for HANA-Integration

**URL:** `/sap/bc/adt/nhi/deliveryunitproxies`

### Validation for HANA-Integration

**URL:** `/sap/bc/adt/nhi/validation`

### Deliveryunits for HANA-Integration

**URL:** `/sap/bc/adt/nhi/deliveryunits`

### Views for HANA-Integration

**URL:** `/sap/bc/adt/nhi/views`

### Database Procedures for HANA-Integration

**URL:** `/sap/bc/adt/nhi/dbprocedures`

## SQLM Marker

### SQLM Data Fetch

**URL:** `/sap/bc/adt/sqlm/data`

**Operations:**

- **http://www.sap.com/adt/categories/sqlmmarker/data**
  - Method: `GET`
  - Template: `/sap/bc/adt/sqlm/data{?snapshot,source_name,object_type,sub_type}`

- **http://www.sap.com/adt/categories/sqlmmarker/view**
  - Method: `GET`
  - Template: `/sap/bc/adt/sqlm/data{?action}`

## Quickfixes

### Quickfixes

**URL:** `/sap/bc/adt/quickfixes/evaluation`

**Accept:**

- `application/vnd.sap.adt.quickfixes.evaluation+xml;version=1.0.0`

## Refactorings

### Refactoring

**URL:** `/sap/bc/adt/refactorings`

### Change Package Assignment

**URL:** `/sap/bc/adt/refactoring/changepackage`

## Repository Information

### Status

**URL:** `/sap/bc/adt/repository/informationsystem/status`

### Usage References

**URL:** `/sap/bc/adt/repository/informationsystem/usageReferences`

**Operations:**

- **http://www.sap.com/adt/relations/informationsystem/usageReferences**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/usageReferences{?uri}`

- **http://www.sap.com/adt/relations/informationsystem/usageReferences/scope**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/usageReferences/scope{?uri}`

### Usage Snippets

**URL:** `/sap/bc/adt/repository/informationsystem/usageSnippets`

**Operations:**

- **http://www.sap.com/adt/relations/informationsystem/usageSnippets**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/usageSnippets`

### Where Used

**URL:** `/sap/bc/adt/repository/informationsystem/whereused`

### Full Name Mapping

**URL:** `/sap/bc/adt/repository/informationsystem/fullnamemapping`

### Meta Data

**URL:** `/sap/bc/adt/repository/informationsystem/metadata`

### Search

**URL:** `/sap/bc/adt/repository/informationsystem/search`

**Operations:**

- **http://www.sap.com/adt/relations/informationsystem/search/quicksearch**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/search{?operation,query,useSearchProvider,noDescription,maxResults}{&objectType*}{&group*}{&packageName*}{&sourcetype*}{&state*}{&lifecycle*}{&rollout*}{&zone*}{&category*}{&appl*}{&userName*}{&releaseState*}{&language*}{&system*}{&version*}{&docu*}{&fav*}{&created*}{&month*}{&date*}{&comp*}{&abaplv*}`

- **http://www.sap.com/adt/relations/informationsystem/search/whitelisting**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/search{?operation,query,useSearchProvider,noDescription,maxResults}{&objectType*}{&group*}{&packageName*}{&sourcetype*}{&state*}{&lifecycle*}{&rollout*}{&zone*}{&category*}{&appl*}{&userName*}{&releaseState*}{&language*}{&system*}{&version*}{&docu*}{&fav*}{&created*}{&month*}{&date*}{&comp*}{&abaplv*}{&contextPackage}`

### Object Types

**URL:** `/sap/bc/adt/repository/informationsystem/objecttypes`

**Operations:**

- **http://www.sap.com/adt/relations/informationsystem/objecttypes**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/objecttypes{?maxItemCount,name,data}`

### Release States

**URL:** `/sap/bc/adt/repository/informationsystem/releasestates`

### ABAP Language Versions

**URL:** `/sap/bc/adt/repository/informationsystem/abaplanguageversions`

**Operations:**

- **http://www.sap.com/adt/relations/informationsystem/abaplanguageversions**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/abaplanguageversions{?uri}`

### Text Search

**URL:** `/sap/bc/adt/repository/informationsystem/textsearch`

**Operations:**

- **http://www.sap.com/adt/relations/informationsystem/textsearch**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/textsearch{?searchString,searchFromIndex,searchToIndex,getAllResults}{&packageName*}{&userName*}{&objectName*}{&objectType*}`

- **http://www.sap.com/adt/relations/informationsystem/textsearch/support**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/textsearch/support{?db}`

### Object Names

**URL:** `/sap/bc/adt/repository/informationsystem/textsearch/objectnames`

### Object Types

**URL:** `/sap/bc/adt/repository/informationsystem/textsearch/objecttypes`

### Executable Object Types

**URL:** `/sap/bc/adt/repository/informationsystem/executableobjecttypes`

### Virtual Folders

**URL:** `/sap/bc/adt/repository/informationsystem/virtualfolders`

**Accept:**

- `application/vnd.sap.adt.repository.virtualfolders.result.v1+xml`

### Virtual Folders Contents

**URL:** `/sap/bc/adt/repository/informationsystem/virtualfolders/contents`

**Accept:**

- `application/vnd.sap.adt.repository.virtualfolders.result.v1+xml`

**Operations:**

- **http://www.sap.com/adt/categories/repository/virtualfolders/contents**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/virtualfolders/contents{?withVersions,ignoreShortDescriptions}`

### Facets supported by Virtual Folders

**URL:** `/sap/bc/adt/repository/informationsystem/virtualfolders/facets`

### Facets Validation

**URL:** `/sap/bc/adt/repository/informationsystem/virtualfolders/facets/validation`

**Operations:**

- **http://www.sap.com/adt/categories/repository/virtualfolders/facetvalidation**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/virtualfolders/facets/validation{?context}`

### Object Properties

**URL:** `/sap/bc/adt/repository/informationsystem/objectproperties/values`

**Operations:**

- **http://www.sap.com/adt/relations/informationsystem/objectProperties**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/objectproperties/values{?uri}`

- **http://www.sap.com/adt/relations/informationsystem/objectProperties/facet**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/objectproperties/values{?facet}`

### Object Favorites

**URL:** `/sap/bc/adt/repository/favorites/lists`

### Transport Properties

**URL:** `/sap/bc/adt/repository/informationsystem/objectproperties/transports`

**Operations:**

- **http://www.sap.com/adt/relations/informationsystem/transportProperties**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/objectproperties/transports{?uri}`

### Property Values

**URL:** `/sap/bc/adt/repository/informationsystem/properties/values`

**Operations:**

- **http://www.sap.com/adt/relations/informationsystem/propertyvalues**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/properties/values{?maxItemCount,name,data}`

### OSL Object References

**URL:** `/sap/bc/adt/repository/informationsystem/objectsets/references`

**Operations:**

- **http://www.sap.com/adt/categories/objectsets/id/adtReferences**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/objectsets/references/{id}`

### OSL Object References Metrics

**URL:** `/sap/bc/adt/repository/informationsystem/objectsets/metrics`

### Node Path

**URL:** `/sap/bc/adt/repository/nodepath`

### Object Structure

**URL:** `/sap/bc/adt/repository/objectstructure`

### Node Structure

**URL:** `/sap/bc/adt/repository/nodestructure`

### Type Structure

**URL:** `/sap/bc/adt/repository/typestructure`

### Proxy URI Mappings

**URL:** `/sap/bc/adt/repository/proxyurimappings`

### Repository Objects Generators

**URL:** `/sap/bc/adt/repository/generators`

**Operations:**

- **http://www.sap.com/categories/repository/generators**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/generators{?referencedObject,fetchAllGenerators,type,id}`

### Element Info

**URL:** `/sap/bc/adt/repository/informationsystem/elementinfo`

**Operations:**

- **http://www.sap.com/adt/relations/informationsystem/elementinfo**
  - Method: `GET`
  - Template: `/sap/bc/adt/repository/informationsystem/elementinfo{?path,type*}`

## Relation Explorer

### Object relations

**URL:** `/sap/bc/adt/objectrelations/network`

**Accept:**

- `application/vnd.sap.adt.objectrelations.request.v1+xml`

### Object relations

**URL:** `/sap/bc/adt/objectrelations/components`

**Accept:**

- `application/vnd.sap.adt.objectrelations.request.v1+xml`

### References in Object Relation

**URL:** `/sap/bc/adt/objectrelations/references`

**Accept:**

- `application/vnd.sap.adt.objectrelations.request.references.v1+xml`

### References in Object Relation

**URL:** `/sap/bc/adt/objectrelations`

**Accept:**

- `application/vnd.sap.adt.objectrelations.request.sets.v1+xml`

**Operations:**

- **http://www.sap.com/adt/categories/objectrelations/id/relations**
  - Method: `GET`
  - Template: `/sap/bc/adt/objectrelations/{id}`

## Service Binding Types

### OData V4

**URL:** `/sap/bc/adt/businessservices/odatav4`

**Accept:**

- `application/vnd.sap.adt.businessservices.odatav4.v2+xml`

**Operations:**

- **http://www.sap.com/adt/businessservices/servicebinding/odatav4**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav4/{objectname}{?servicename,serviceversion,srvdname}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav4/feap/params**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav4/feap{?feapParams}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav4/feap/params/fileredirection**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav4/feap/{feapParams}/{filename}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav4/feap/params/fileredirection**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav4/feap/{feapParams}/{fileresource}/{filename}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav4/feap/feappagename**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav4/feap/{feapParams}/{feappagename}{?feapParams}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav4/testclient**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav4/testclient{?url,serverName,serverPort,serverPath}`

### OData V2

**URL:** `/sap/bc/adt/businessservices/odatav2`

**Accept:**

- `application/vnd.sap.adt.businessservices.odatav2.v3+xml`

**Operations:**

- **http://www.sap.com/adt/businessservices/servicebinding/odatav2**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav2/{objectname}{?servicename,serviceversion,srvdname}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav2/publish**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav2/publishjobs{?servicename,serviceversion}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav2/unpublish**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav2/unpublishjobs{?servicename,serviceversion}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav2/feap/params**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav2/feap{?feapParams}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav2/feap/params/fileredirection**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav2/feap/{feapParams}/{filename}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav2/feap/params/fileredirection**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav2/feap/{feapParams}/{fileresource}/{filename}`

- **http://www.sap.com/adt/businessservices/servicebinding/odatav2/testclient**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/odatav2/testclient{?url,serverName,serverPort,serverPath}`

### Service Binding Classification

**URL:** `/sap/bc/adt/businessservices/release`

**Operations:**

- **http://www.sap.com/adt/businessservices/servicebinding/bindingtypes/release**
  - Method: `GET`
  - Template: `/sap/bc/adt/businessservices/release{?objectname,bindtype,bindtypeversion,repositoryid,servicename,serviceversion}`

## Debugger

### Debugger

**URL:** `/sap/bc/adt/debugger`

### Memory Sizes

**URL:** `/sap/bc/adt/debugger/memorysizes`

**Operations:**

- **http://www.sap.com/adt/debugger/relations/memorysizes**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/memorysizes{?includeAbap}`

### System Areas

**URL:** `/sap/bc/adt/debugger/systemareas`

**Operations:**

- **self**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/systemareas/{systemarea}{?offset,length,element,isSelection,selectedLine,selectedColumn,programContext,filter}`

### Statements for Breakpoints

**URL:** `/sap/bc/adt/debugger/breakpoints/statements`

### Message Types for Breakpoints

**URL:** `/sap/bc/adt/debugger/breakpoints/messagetypes`

### Breakpoints

**URL:** `/sap/bc/adt/debugger/breakpoints`

**Operations:**

- **http://www.sap.com/adt/debugger/relations/synchronize**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/breakpoints{?checkConflict}`

### Breakpoint Condition

**URL:** `/sap/bc/adt/debugger/breakpoints/conditions`

### Breakpoint Validation

**URL:** `/sap/bc/adt/debugger/breakpoints/validations`

### VIT Breakpoints

**URL:** `/sap/bc/adt/debugger/breakpoints/vit`

### Debugger Listeners

**URL:** `/sap/bc/adt/debugger/listeners`

**Operations:**

- **http://www.sap.com/adt/debugger/relations/launch**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/listeners{?debuggingMode,requestUser,terminalId,ideId,timeout,checkConflict,isNotifiedOnConflict}`

- **http://www.sap.com/adt/debugger/relations/stop**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/listeners{?debuggingMode,requestUser,terminalId,ideId,checkConflict,notifyConflict}`

- **http://www.sap.com/adt/debugger/relations/get**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/listeners{?debuggingMode,requestUser,terminalId,ideId,checkConflict}`

### Debugger Variables

**URL:** `/sap/bc/adt/debugger/variables`

**Operations:**

- **http://www.sap.com/adt/debugger/relations/maxlength**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/variables/{variableName}/{part}{?maxLength}`

- **http://www.sap.com/adt/debugger/relations/subcomponents**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/variables/{variableName}/{part}{?component,line}`

- **http://www.sap.com/adt/debugger/relations/csv**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/variables/{variableName}/{part}{?offset,length,filter,sortComponent,sortDirection,whereClause,c*}`

- **http://www.sap.com/adt/debugger/relations/json**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/variables/{variableName}/{part}{?offset,length,filter,sortComponent,sortDirection,whereClause,c*}`

- **http://www.sap.com/adt/debugger/relations/valueStatement**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/variables/{variableName}/{part}{?rows,maxStringLength,maxNestingLevel,maxTotalSize,ignoreInitialValues,c*,lineBreakThreshold}`

### Debugger Actions

**URL:** `/sap/bc/adt/debugger/actions`

**Operations:**

- **http://www.sap.com/adt/debugger/relations/action**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/actions{?action,value}`

### Debugger Stack

**URL:** `/sap/bc/adt/debugger/stack`

### Debugger Watchpoints

**URL:** `/sap/bc/adt/debugger/watchpoints`

**Operations:**

- **http://www.sap.com/adt/debugger/relations/insert**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/watchpoints{?variableName,condition}`

- **http://www.sap.com/adt/debugger/relations/get**
  - Method: `GET`
  - Template: `/sap/bc/adt/debugger/watchpoints`

### Debugger Batch Request

**URL:** `/sap/bc/adt/debugger/batch`

## Task handler integration

### Work Processes

**URL:** `/sap/bc/adt/runtime/workprocesses`

## Web Dynpro

### WebDynpro Application

**URL:** `/sap/bc/adt/wdy/applications`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/applications/editor**
  - Method: `PUT`
  - Template: `/sap/bc/adt/wdy/applications/{object_name}`

### WebDynpro Interface View

**URL:** `/sap/bc/adt/wdy/interfaceviews`

### WebDynpro Component

**URL:** `/sap/bc/adt/wdy/components`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/components/editor**
  - Method: `PUT`
  - Template: `/sap/bc/adt/wdy/components/{object_name}`

### WebDynpro ComponentInterface

**URL:** `/sap/bc/adt/wdy/componentinterfaces`

### Component Controller

**URL:** `/sap/bc/adt/wdy/componentcontrollers`

### Window Controller

**URL:** `/sap/bc/adt/wdy/windows`

### Webdynpro Code Completion

**URL:** `/sap/bc/adt/wdy/abapsource/codecompletion/proposal`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/WDACodeCompletion**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/abapsource/codecompletion/proposal{?uri,signalCompleteness}`

### Webdynpro element information

**URL:** `/sap/bc/adt/wdy/abapsource/codecompletion/elementinfo`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/WDAElementinformation**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/abapsource/codecompletion/elementinfo{?uri}`

### Webdynpro Pretty Printer

**URL:** `/sap/bc/adt/wdy/abapsource/prettyprinter`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/WDAPrettyPrinter**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/abapsource/prettyprinter{?uri}`

### Webdynpro element insertion

**URL:** `/sap/bc/adt/wdy/abapsource/codecompletion/insertion`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/WDACodeinsertion**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/abapsource/codecompletion/insertion{?uri,patternKey}`

### Web Dynpro Application launcher

**URL:** `/sap/bc/adt/wdy/launchconfiguration`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/launchconfigurations**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/launchconfiguration/{object_type}/{object_name}`

### Webdynpro View UI Element Library

**URL:** `/sap/bc/adt/wdy/viewdesigner/uielementlibrary`

### Webdynpro View

**URL:** `/sap/bc/adt/wdy/views`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/view/validatecontextbinding**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/views/{comp_name}/{view_name}{?_action,elementDefName,elementLibName,property}`

### Interface Controller

**URL:** `/sap/bc/adt/wdy/interfacecontrollers`

### Custom Controller

**URL:** `/sap/bc/adt/wdy/customcontrollers`

### Interface view Controller for a Component Interface

**URL:** `/sap/bc/adt/wdy/interfaceviews`

### Navigation controller

**URL:** `/sap/bc/adt/wdy/navigation/target`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/Navigation**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/navigation/target{?uri}`

### Search WDA Entities

**URL:** `/sap/bc/adt/wdy/search`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/search/mime**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/search{?operation,mime_source,component_name,query,maxResults}`

- **http://www.sap.com/adt/categories/webdynpro/search/otr**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/search{?operation,package,query}`

- **http://www.sap.com/adt/categories/webdynpro/search/otr/alias**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/search{?operation,alias}`

- **http://www.sap.com/adt/categories/webdynpro/search/events**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/search{?operation,componentName,controllerName,version}`

- **http://www.sap.com/adt/categories/webdynpro/search/usablecontrollers**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/search{?operation,componentName,controllerName}`

- **http://www.sap.com/adt/categories/webdynpro/search/typeformattingoptions**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/search{?operation,typeName}`

- **http://www.sap.com/adt/categories/webdynpro/search/ovscompusages**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/search{?operation,componentName}`

- **http://www.sap.com/adt/categories/webdynpro/search/ddicfields**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/search{?operation,ddicName}`

- **http://www.sap.com/adt/categories/webdynpro/search/interfaceviewsplugs**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/search{?operation,componentName}`

### Code template

**URL:** `/sap/bc/adt/wdy/codetemplate`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/CodeTemplate**
  - Method: `GET`
  - Template: `/sap/bc/adt/wdy/codetemplate{?compname,contname,version}`

### Web Dynpro Configuration

**URL:** `/sap/bc/adt/wdy/componentconfig`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/componentconfig/create**
  - Method: `POST`
  - Template: `/sap/bc/adt/wdy/https://5bff2ab7-3ad1-48e3-8980-53a354a1b276.abap-web.us10.hana.ondemand.com/sap/bc/webdynpro/sap/configure_component`

### Application Configuration

**URL:** `/sap/bc/adt/wdy/applicationconfig`

**Operations:**

- **http://www.sap.com/adt/categories/webdynpro/applicationconfig/create**
  - Method: `POST`
  - Template: `/sap/bc/adt/wdy/https://5bff2ab7-3ad1-48e3-8980-53a354a1b276.abap-web.us10.hana.ondemand.com/sap/bc/webdynpro/sap/configure_application`

### FPM Application Configuration

**URL:** `/sap/bc/adt/wdy/fpmapplications`

### FPM Flooplan Configuration

**URL:** `/sap/bc/adt/wdy/fpmfloorplans`

### FPM Adaptable Configuration

**URL:** `/sap/bc/adt/wdy/fpmadaptables`

### FPM Layout Component Configuration

**URL:** `/sap/bc/adt/wdy/fpmcomponents`

### FPM Adaptable Configuration

**URL:** `/sap/bc/adt/wdy/fpmguibbs`

### FPM Adaptable Configuration

**URL:** `/sap/bc/adt/wdy/fpmruibbs`

## ABAP Cross Trace

### ABAP Cross Trace: Traces

**URL:** `/sap/bc/adt/crosstrace/traces`

**Accept:**

- `application/vnd.sap.adt.crosstrace.trace.full.v1+json`

**Operations:**

- **traces**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/traces{?traceUser,actCreateUser,actChangeUser}`

- **trace**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/traces/{traceId}`

- **trace**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/traces/{traceId}{?includeSensitiveData}`

- **records**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/traces/{traceId}/records`

- **record-content**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/traces/{traceId}/records/{recordNumber}/content`

### ABAP Cross Trace: Activations

**URL:** `/sap/bc/adt/crosstrace/activations`

**Accept:**

- `application/vnd.sap.adt.crosstrace.activations.v1+xml`
- `application/vnd.sap.adt.crosstrace.activations.v1.b+xml`

**Operations:**

- **activation**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/activations/{activationId}`

### ABAP Cross Trace: Components

**URL:** `/sap/bc/adt/crosstrace/components`

### ABAP Cross Trace: Request Types

**URL:** `/sap/bc/adt/crosstrace/request_types`

### ABAP Cross Trace: URI Mapping

**URL:** `/sap/bc/adt/crosstrace/urimapping`

**Operations:**

- **include**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/urimapping{?program,include,line,offset}`

- **workbench-object**
  - Method: `GET`
  - Template: `/sap/bc/adt/crosstrace/urimapping{?objectType,objectName,component,subComponent}`

## ABAP Language Help

### ABAP Language Help

**URL:** `/sap/bc/adt/docu/abap/langu`

**Operations:**

- **http://www.sap.com/adt/relations/docu/abap/langu/docu**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/abap/langu{?format,language,uri,version}`

- **http://www.sap.com/adt/relations/docu/abap/langu/docu/query**
  - Method: `GET`
  - Template: `/sap/bc/adt/docu/abap/langu{?format,language,query,version}`

## Transformation

### Transformation

**URL:** `/sap/bc/adt/xslt/transformations`

**Accept:**

- `application/vnd.sap.adt.transformations+xml`

**Operations:**

- **http://www.sap.com/adt/categories/transformations/formatter**
  - Method: `GET`
  - Template: `/sap/bc/adt/xslt/transformations/{transformationname}/formatter`

- **http://www.sap.com/adt/categories/transformations/navigation**
  - Method: `GET`
  - Template: `/sap/bc/adt/xslt/transformations/{transformationname}/navigation`

- **http://www.sap.com/adt/categories/transformations/validation**
  - Method: `GET`
  - Template: `/sap/bc/adt/xslt/transformations/{transformationname}/validation`


---

*This document was automatically generated from the ADT discovery endpoint.*