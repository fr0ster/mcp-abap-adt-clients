# `PROG/I` include evidence — ADT has a write path, 2026-08-28

From the ADT discovery documents already committed in `docs/discovery/`, plus one live read of
E19 (`RFCSAPRL 816`). Collected because #116 says there is no write path for standalone
includes; there is one, and it is a different resource from a program.

## The collection is a creation target — on modern on-prem only

`<app:collection href="/sap/bc/adt/programs/includes">`, extracted up to its closing tag from
each system's discovery document:

| system | release | `app:accept` on the includes collection |
|---|---|---|
| E19 | `RFCSAPRL 816` | `application/vnd.sap.adt.programs.includes.v2+xml` |
| E77 | `RFCSAPRL 740` | *none* |
| ABAP Cloud trial | — | *none* |
| Cloud (MDD) | — | *none* |

E19, verbatim:

```xml
<app:collection href="/sap/bc/adt/programs/includes"><atom:title>Includes</atom:title><app:accept>application/vnd.sap.adt.programs.includes.v2+xml</app:accept><atom:category term="includes" scheme="http://www.sap.com/adt/categories/programs"/><adtcomp:templateLinks xmlns:adtcomp="http://www.sap.com/adt/compatibility"/></app:collection>
```

E77, same collection, no `app:accept` — present, but not a POST target:

```xml
<app:collection href="/sap/bc/adt/programs/includes"><atom:title>Includes</atom:title><atom:category term="includes" scheme="http://www.sap.com/adt/categories/programs"/></app:collection>
```

A collection without `app:accept` cannot be posted to. So an include is creatable on modern
on-prem and nowhere else available to us — which is also why the cloud trial could never have
settled this, and why cloud answers `403 S_DEVELOP` for the type.

## Programs and includes accept different types

Same E19 document:

```
/sap/bc/adt/programs/includes → application/vnd.sap.adt.programs.includes.v2+xml
/sap/bc/adt/programs/programs → application/vnd.sap.adt.programs.programs.v2+xml
                                application/vnd.sap.adt.programs.programs.v3+xml
```

## And different payloads

`GET /sap/bc/adt/programs/includes/zabapgit_forms`
Accept: `application/vnd.sap.adt.programs.includes.v2+xml`
→ **200**, head of body verbatim:

```xml
<?xml version="1.0" encoding="utf-8"?><include:abapInclude include:contextRefCount="1" abapsource:sourceUri="source/main" abapsource:fixPointArithmetic="false" abapsource:activeUnicodeCheck="false" adtcore:responsible="IBALDASEVICS" adtcore:masterLanguage="EN" adtcore:masterSystem="E19" adtcore:name="ZABAPGIT_FORMS" adtcore:type="PROG/I" adtcore:changedAt="2026-01-03T01:53:10Z" adtcore:version="active" adtcore:createdAt="2025-05-22T00:00:00Z" adtcore:changedBy="IBALDASEVICS" adtcore:description="abapGit - Form Routines" adtcore:descriptionTextLimit="70" adtcore:language="EN" xmlns:include="http://www.sap.com/adt/programs/includes" xmlns:abapsource="http://www.sap.com/adt/abapsource" xmlns:adtcore="http://www.sap.com/adt/core">
```

`GET /sap/bc/adt/programs/programs/ZAC_PROG0230217`
Accept: `application/vnd.sap.adt.programs.programs.v3+xml`
→ **200**, head of body verbatim:

```xml
<?xml version="1.0" encoding="utf-8"?><program:abapProgram program:lockedByEditor="false" program:programType="executableProgram" abapsource:sourceUri="source/main" abapsource:fixPointArithmetic="true" abapsource:activeUnicodeCheck="true" adtcore:responsible="OKYSLYTSIA" adtcore:masterLanguage="EN" adtcore:masterSystem="E19" adtcore:abapLanguageVersion="standard" adtcore:name="ZAC_PROG0230217" adtcore:type="PROG/P" adtcore:changedAt="2026-08-27T09:17:51Z" adtcore:version="active" adtcore:createdAt="2026-08-27T00:00:00Z" adtcore:changedBy="OKYSLYTSIA" adtcore:description="ProgramExecutor integration ZAC_PROG0230217" adtcore:descriptionTextLimit="70" adtcore:language="EN" xmlns:program="http://www.sap.com/adt/programs/programs" xmlns:abapsource="http://www.sap.com/adt/abapsource" xmlns:adtcore="http://www.sap.com/adt/core">
```

Different root element, different namespace, different `adtcore:type`, and
`include:contextRefCount` on one side against `program:programType` / `program:application` on
the other. An include is not a flavour of program.

## Includes validate at their own endpoint

Present on every system checked, distinct from `/sap/bc/adt/programs/validation`:

```xml
<app:collection href="/sap/bc/adt/includes/validation"><atom:title>Include Validation</atom:title><atom:category term="validation" scheme="http://www.sap.com/adt/categories/includes"/></app:collection>
```

Its query parameters have **not** been measured.

## What this library sends today

`src/core/program/create.ts` maps `programType: 'include'` to `'I'`, then builds a payload that
hardcodes `adtcore:type="PROG/P"` and posts it to `/sap/bc/adt/programs/programs` under the
program content type. The request contradicts itself and goes to the wrong collection. Nobody
has run it, so what SAP makes of it is unknown.
