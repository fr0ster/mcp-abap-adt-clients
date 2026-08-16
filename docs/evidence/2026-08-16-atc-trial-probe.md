# ATC probe evidence — cloud trial, 2026-08-16

Captured by `scripts/probe-atc.ts` against `ZBASE_PROBE01` (one class, `ZOK_CL_CLEANER`).
The trial host is redacted; everything else is verbatim, reflowed only for line length.
Raw captures stay out of git (`atc-probe*/` is ignored) — these are the responses the spec
quotes.

## [1] GET /atc/customizing — the verb that works

`GET /sap/bc/adt/atc/customizing`  
Accept: `application/xml, application/vnd.sap.atc.customizing-v1+xml, application/vnd.sap.atc.customizing-v2+xml`  
→ **200**

```xml
<?xml version="1.0" encoding="utf-8"?><atc:customizing xmlns:atc="http://www.sap.com/adt/atc"><properties><property name="ciCheckFlavour" value="true"/><property name="systemCheckVariant" value="ABAP_CLOUD_DEVELOPMENT_DEFAULT"/><property name="isCCSTunnelEnabled" value="false"/><property name="isTransportableExemptionTypeUsed" value="true"/></properties><exemption><reasons><reason id="FPOS" justificationMandatory="true" title="False Positive"/><reason id="OTHR" justificationMandatory="true" title="Other Reason"/></reasons><validities><validity id="U" value="No Restrictions"/><validity id="D" value="Date"/><validity id="P" value="Current SAP Support Package"/></validities></exemption><scaAttributes><scaAttribute labelL="Additional Info" labelM="Additional Info" labelS="Add. Info" label="false" attributeName="ADD_INFO"/><scaAttribute labelL="Referenced Application Component" labelM="Ref. App. Component" labelS="Component" label="false" attributeName="APPLICATION_COMPONENT"/><scaAttribute labelL="Change Category of Piecelist Items" labelM="Change Category" labelS="Category" label="false" attributeName="CHANGE_CATEGORY"/><scaAttribute labelL="Description of Change Category" labelM="Change Category" labelS="Text" label="true" refAttributeName="CHANGE_CATEGORY" attributeName="CHANGE_CATEGORY_TEXT"/><scaAttribute labelL="SAP Note Number" labelM="SAP Note Number" labelS="Note" label="false" attributeName="NOTE"/><scaAttribute labelL="Short text" labelM="Short text" labelS="Short text" label="true" refAttributeName="NOTE" attributeName="NOTE_TEXT"/><scaAttribute labelL="Referenced Object" labelM="Ref. Object" labelS="Ref. Obj." label="false" attributeName="REF_OBJ_NAME"/><scaAttribute labelL="Referenced Object Type" labelM="Ref. Object Type" labelS="RefObjType" label="false" attributeName="REF_OBJ_TYPE"/><scaAttribute labelL="Referenced Package" labelM="Ref.Package" labelS="Ref.Pack." label="false" attributeName="REF_PACKAGE"/><scaAttribute labelL="Referenced Software Component" labelM="Ref. Softw. Comp." labelS="Ref.SW.Cmp" label="false" attributeName="REF_SOFTWARE_COMPONENT"/><scaAttribute labelL="Simplification Item Category" labelM="Category" labelS="Category" label="false" attributeName="SITEM_STATE"/></scaAttributes></atc:customizing>
```

## [2] POST /atc/customizing — 405, the recorded verb refuted

`POST /sap/bc/adt/atc/customizing`  
Accept: `application/xml, application/vnd.sap.atc.customizing-v1+xml, application/vnd.sap.atc.customizing-v2+xml`  
→ **405**

```xml
<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="ExceptionMethodNotSupported"/><message lang="EN">Resource controller does not support method POST</message><localizedMessage lang="EN">Resource controller does not support method POST</localizedMessage><properties><entry key="T100KEY-ID">SADT_RESOURCE</entry><entry key="T100KEY-NO">010</entry><entry key="T100KEY-V1">POST</entry></properties></exc:exception>
```

## [5] POST /atc/runs?clientWait=false — 201, EMPTY body, Location carries a run id

`POST /sap/bc/adt/atc/runs?worklistId=0ABD945AC5681FE1A6A97116D8E9C030&clientWait=false`  
Accept: `application/xml`  
→ **201**, `Location: /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6A97156547C6030`

```xml
(empty body)
```

## [6] GET the worklist immediately after that run — EMPTY

`GET /sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6A97116D8E9C030?includeExemptedFindings=false`  
Accept: `application/atc.worklist.v1+xml, application/vnd.sap.atc.worklist.v1+xml`  
→ **200**

```xml
<?xml version="1.0" encoding="utf-8"?><atcworklist:worklist atcworklist:id="0ABD945AC5681FE1A6A97116D8E9C030" atcworklist:usedObjectSet="00000000000000000000000000000000" atcworklist:objectSetIsComplete="true" xmlns:atcworklist="http://www.sap.com/adt/atc/worklist"><atcworklist:objectSets><atcworklist:objectSet atcworklist:name="00000000000000000000000000000000" atcworklist:title="All Objects" atcworklist:kind="ALL"/></atcworklist:objectSets><atcworklist:objects/><atcworklist:scaAttributes><scaAttribute labelL="Additional Info" labelM="Additional Info" labelS="Add. Info" label="false" attributeName="ADD_INFO"/><scaAttribute labelL="Referenced Application Component" labelM="Ref. App. Component" labelS="Component" label="false" attributeName="APPLICATION_COMPONENT"/><scaAttribute labelL="Change Category of Piecelist Items" labelM="Change Category" labelS="Category" label="false" attributeName="CHANGE_CATEGORY"/><scaAttribute labelL="Description of Change Category" labelM="Change Category" labelS="Text" label="true" refAttributeName="CHANGE_CATEGORY" attributeName="CHANGE_CATEGORY_TEXT"/><scaAttribute labelL="SAP Note Number" labelM="SAP Note Number" labelS="Note" label="false" attributeName="NOTE"/><scaAttribute labelL="Short text" labelM="Short text" labelS="Short text" label="true" refAttributeName="NOTE" attributeName="NOTE_TEXT"/><scaAttribute labelL="Referenced Object" labelM="Ref. Object" labelS="Ref. Obj." label="false" attributeName="REF_OBJ_NAME"/><scaAttribute labelL="Referenced Object Type" labelM="Ref. Object Type" labelS="RefObjType" label="false" attributeName="REF_OBJ_TYPE"/><scaAttribute labelL="Referenced Package" labelM="Ref.Package" labelS="Ref.Pack." label="false" attributeName="REF_PACKAGE"/><scaAttribute labelL="Referenced Software Component" labelM="Ref. Softw. Comp." labelS="Ref.SW.Cmp" label="false" attributeName="REF_SOFTWARE_COMPONENT"/><scaAttribute labelL="Simplification Item Category" labelM="Category" labelS="Category" label="false" attributeName="SITEM_STATE"/></atcworklist:scaAttributes></atcworklist:worklist>
```

## [12] GET the bogus-URI control worklist — byte-identical to the one above

`GET /sap/bc/adt/atc/worklists/6E27F48C3C661FD1A6A972BF4DEA5D01?includeExemptedFindings=false`  
Accept: `application/atc.worklist.v1+xml, application/vnd.sap.atc.worklist.v1+xml`  
→ **200**

```xml
<?xml version="1.0" encoding="utf-8"?><atcworklist:worklist atcworklist:id="6E27F48C3C661FD1A6A972BF4DEA5D01" atcworklist:usedObjectSet="00000000000000000000000000000000" atcworklist:objectSetIsComplete="true" xmlns:atcworklist="http://www.sap.com/adt/atc/worklist"><atcworklist:objectSets><atcworklist:objectSet atcworklist:name="00000000000000000000000000000000" atcworklist:title="All Objects" atcworklist:kind="ALL"/></atcworklist:objectSets><atcworklist:objects/><atcworklist:scaAttributes><scaAttribute labelL="Additional Info" labelM="Additional Info" labelS="Add. Info" label="false" attributeName="ADD_INFO"/><scaAttribute labelL="Referenced Application Component" labelM="Ref. App. Component" labelS="Component" label="false" attributeName="APPLICATION_COMPONENT"/><scaAttribute labelL="Change Category of Piecelist Items" labelM="Change Category" labelS="Category" label="false" attributeName="CHANGE_CATEGORY"/><scaAttribute labelL="Description of Change Category" labelM="Change Category" labelS="Text" label="true" refAttributeName="CHANGE_CATEGORY" attributeName="CHANGE_CATEGORY_TEXT"/><scaAttribute labelL="SAP Note Number" labelM="SAP Note Number" labelS="Note" label="false" attributeName="NOTE"/><scaAttribute labelL="Short text" labelM="Short text" labelS="Short text" label="true" refAttributeName="NOTE" attributeName="NOTE_TEXT"/><scaAttribute labelL="Referenced Object" labelM="Ref. Object" labelS="Ref. Obj." label="false" attributeName="REF_OBJ_NAME"/><scaAttribute labelL="Referenced Object Type" labelM="Ref. Object Type" labelS="RefObjType" label="false" attributeName="REF_OBJ_TYPE"/><scaAttribute labelL="Referenced Package" labelM="Ref.Package" labelS="Ref.Pack." label="false" attributeName="REF_PACKAGE"/><scaAttribute labelL="Referenced Software Component" labelM="Ref. Softw. Comp." labelS="Ref.SW.Cmp" label="false" attributeName="REF_SOFTWARE_COMPONENT"/><scaAttribute labelL="Simplification Item Category" labelM="Category" labelS="Category" label="false" attributeName="SITEM_STATE"/></atcworklist:scaAttributes></atcworklist:worklist>
```

## [13] GET /atc/runs/{id from Location} — a status resource EXISTS

`GET /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6A97156547C6030`  
Accept: `application/vnd.sap.adt.backgroundrun.v1+xml`  
→ **200**, `Location: /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6A97156547C6030`

```xml
<?xml version="1.0" encoding="utf-8"?><runs:run runs:status="finished" xmlns:runs="http://www.sap.com/adt/backgroundruns"><runs:result><atom:link href="/sap/bc/adt/atc/results/0ABD945AC5681FE1A6A97175E98C4030" rel="http://www.sap.com/abap/checks/atc/relations/results/displayid" type="application/xml" title="Result" xmlns:atom="http://www.w3.org/2005/Atom"/><atom:link href="/sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6A97116D8E9C030" rel="http://www.sap.com/abap/checks/atc/relations/results/worklistid" type="application/vnd.sap.atc.worklistsummary.v1+xml" title="Worklist" xmlns:atom="http://www.w3.org/2005/Atom"/></runs:result></runs:run>
```

## [15] GET /atc/runs/{worklistId} — 404: the worklist id is not a run id

`GET /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6A97116D8E9C030`  
Accept: `application/vnd.sap.adt.backgroundrun.v1+xml`  
→ **404**

```xml
(empty body)
```

## [16] GET the same worklist later — now populated, one finding

`GET /sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6A97116D8E9C030?includeExemptedFindings=true`  
Accept: `application/atc.worklist.v1+xml, application/vnd.sap.atc.worklist.v1+xml`  
→ **200**

```xml
<?xml version="1.0" encoding="utf-8"?><atcworklist:worklist atcworklist:id="0ABD945AC5681FE1A6A97116D8E9C030" atcworklist:usedObjectSet="99999999999999999999999999999999" atcworklist:objectSetIsComplete="true" xmlns:atcworklist="http://www.sap.com/adt/atc/worklist"><atcworklist:objectSets><atcworklist:objectSet atcworklist:name="00000000000000000000000000000000" atcworklist:title="All Objects" atcworklist:kind="ALL"/><atcworklist:objectSet atcworklist:name="99999999999999999999999999999999" atcworklist:title="Last Check Run" atcworklist:kind="LAST_RUN"/></atcworklist:objectSets><atcworklist:objects><atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/CLAS/ZOK_CL_CLEANER" adtcore:type="CLAS" adtcore:name="ZOK_CL_CLEANER" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" atcobject:objectTypeId="CLAS/OC" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core"><atcobject:findings><atcfinding:finding adtcore:uri="/sap/bc/adt/atc/findings/itemid/6E27F48C3C661FD1A6A9440358DD9D01/index/1186" atcfinding:location="/sap/bc/adt/oo/classes/zok_cl_cleaner/source/main#start=30,0" atcfinding:processor="CB9980006582" atcfinding:lastChangedBy="CB9980006582" atcfinding:effectOnTransports="allowTransports" atcfinding:priority="3" atcfinding:checkId="F8607CD40A0F8B30BDF8590205B306E8" atcfinding:checkTitle="Extended Program Check (SLIN)" atcfinding:checkClass="CL_CI_TEST_EXTENDED_CHECK" atcfinding:messageId="1713" atcfinding:messageTitle="Strings without text elements are not translated: |Cleaning item, |" atcfinding:exemptionApproval="-" atcfinding:exemptionKind="" atcfinding:checksum="-969200553" atcfinding:remarkText="" atcfinding:remarkLink="" atcfinding:quickfixInfo="atc:6E27F48C3C661FD1A6A9440358DD9D01,1186," xmlns:atcfinding="http://www.sap.com/adt/atc/finding"><atom:link href="/sap/bc/adt/documentation/atc/documents/itemid/6E27F48C3C661FD1A6A9440358DD9D01/index/1186" rel="http://www.sap.com/adt/relations/documentation" type="text/html" xmlns:atom="http://www.w3.org/2005/Atom"/><atcfinding:quickfixes atcfinding:manual="false" atcfinding:automatic="false" atcfinding:pseudo="false" atcfinding:aiBasedQF="false" atcfinding:ai_enabled="false"/></atcfinding:finding></atcobject:findings></atcobject:object></atcworklist:objects><atcworklist:scaAttributes><scaAttribute labelL="Additional Info" labelM="Additional Info" labelS="Add. Info" label="false" attributeName="ADD_INFO"/><scaAttribute labelL="Referenced Application Component" labelM="Ref. App. Component" labelS="Component" label="false" attributeName="APPLICATION_COMPONENT"/><scaAttribute labelL="Change Category of Piecelist Items" labelM="Change Category" labelS="Category" label="false" attributeName="CHANGE_CATEGORY"/><scaAttribute labelL="Description of Change Category" labelM="Change Category" labelS="Text" label="true" refAttributeName="CHANGE_CATEGORY" attributeName="CHANGE_CATEGORY_TEXT"/><scaAttribute labelL="SAP Note Number" labelM="SAP Note Number" labelS="Note" label="false" attributeName="NOTE"/><scaAttribute labelL="Short text" labelM="Short text" labelS="Short text" label="true" refAttributeName="NOTE" attributeName="NOTE_TEXT"/><scaAttribute labelL="Referenced Object" labelM="Ref. Object" labelS="Ref. Obj." label="false" attributeName="REF_OBJ_NAME"/><scaAttribute labelL="Referenced Object Type" labelM="Ref. Object Type" labelS="RefObjType" label="false" attributeName="REF_OBJ_TYPE"/><scaAttribute labelL="Referenced Package" labelM="Ref.Package" labelS="Ref.Pack." label="false" attributeName="REF_PACKAGE"/><scaAttribute labelL="Referenced Software Component" labelM="Ref. Softw. Comp." labelS="Ref.SW.Cmp" label="false" attributeName="REF_SOFTWARE_COMPONENT"/><scaAttribute labelL="Simplification Item Category" labelM="Category" labelS="Category" label="false" attributeName="SITEM_STATE"/></atcworklist:scaAttributes></atcworklist:worklist>
```

## [17] checkstyle Accept — 406, one accepted type

`GET /sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6A97116D8E9C030`  
Accept: `application/vnd.sap.atc.checkstyle.v1+xml, application/vnd.sap.atc.checkstyle+xml`  
→ **406**

```xml
<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="ExceptionResourceNotAcceptable"/><message lang="EN">The message content is not acceptable. Accepted content types: application/atc.worklist.v1+xml</message><localizedMessage lang="EN">The message content is not acceptable. Accepted content types: application/atc.worklist.v1+xml</localizedMessage><properties><entry key="T100KEY-ID">SADT_RESOURCE</entry><entry key="T100KEY-NO">044</entry><entry key="T100KEY-V1">application/atc.worklist.v1+xml</entry></properties></exc:exception>
```

## [22] maximumVerdicts=0 — 400

`POST /sap/bc/adt/atc/runs?worklistId=6E27F48C3C661FD1A6A975BEA8DBFD01&clientWait=false`  
Accept: `application/xml`  
→ **400**

```xml
<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="ExceptionInvalidData"/><message lang="EN">Check of condition failed</message><localizedMessage lang="EN">Check of condition failed</localizedMessage><properties><entry key="XML_PATH">atc:run(1)</entry><entry key="XML_OFFSET">106 </entry><entry key="T100KEY-ID">00</entry><entry key="T100KEY-NO">001</entry><entry key="T100KEY-V1">Check of condition failed</entry></properties></exc:exception>
```

## [28] POST /atc/runs?clientWait=true — 200, worklistRun with FINDING_STATS

`POST /sap/bc/adt/atc/runs?worklistId=6E27F48C3C661FD1A6A97973EDF99D01&clientWait=true`  
Accept: `application/xml`  
→ **200**

```xml
<?xml version="1.0" encoding="utf-8"?><atcworklist:worklistRun xmlns:atcworklist="http://www.sap.com/adt/atc/worklist"><atcworklist:worklistId>6E27F48C3C661FD1A6A97973EDF99D01</atcworklist:worklistId><atcworklist:worklistTimestamp>2026-08-16T08:24:01Z</atcworklist:worklistTimestamp><atcworklist:infos><atcinfo:info xmlns:atcinfo="http://www.sap.com/adt/atc/info"><atcinfo:type>FINDING_STATS</atcinfo:type><atcinfo:description>0,0,1</atcinfo:description></atcinfo:info></atcworklist:infos></atcworklist:worklistRun>
```
