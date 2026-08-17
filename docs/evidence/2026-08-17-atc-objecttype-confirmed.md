# ATC evidence: `AtcObjectType` confirmed on the cloud trial, 2026-08-17

Captured by `scripts/probe-atc.ts` against package `ZBASE_PROBE01`. The trial host is redacted;
everything else is the server's own bytes, reflowed only for line length. Raw captures stay out
of git (`atc-probe*/` is ignored) — this is the subset the spec's claims rest on, and it is
quoted rather than summarised so a reader checks the server, not me.

**The rule being evidenced:** a type is confirmed when a run submitted at the URI *this client
builds* is accepted, its run resource reports `finished`, and the worklist for that run then
lists the object under that type. Acceptance alone proves nothing — a URI that cannot exist is
answered 201 too, and that control is at the end.

## The completion marker, in full

`GET /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6C5ABFA67E52030`, `Accept: application/vnd.sap.adt.backgroundrun.v1+xml` → **200**

```xml
<?xml version="1.0" encoding="utf-8"?>
<runs:run runs:status="finished" xmlns:runs="http://www.sap.com/adt/backgroundruns">
<runs:result>
<atom:link href="/sap/bc/adt/atc/results/6E27F48C3C661FD1A6C5AC1AE3CE9D04" rel="http://www.sap.com/abap/checks/atc/relations/results/displayid" type="application/xml" title="Result" xmlns:atom="http://www.w3.org/2005/Atom"/>
<atom:link href="/sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C5ABA18680A030" rel="http://www.sap.com/abap/checks/atc/relations/results/worklistid" type="application/vnd.sap.atc.worklistsummary.v1+xml" title="Worklist" xmlns:atom="http://www.w3.org/2005/Atom"/>
</runs:result>
</runs:run>
```

## Confirmed types

For each: the URI the client built, and the `<atcobject:object>` element the finished
worklist came back with. The `adtcore:type` is what makes it evidence about the *type* and
not just about a name.

### `class` — `atc-probe5`, template `oo/classes`

submitted `/sap/bc/adt/oo/classes/ZOK_CL_CLEANER` → **201**, polled to `finished`

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/CLAS/ZOK_CL_CLEANER" adtcore:type="CLAS" adtcore:name="ZOK_CL_CLEANER" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" atcobject:objectTypeId="CLAS/OC" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

### `interface` — `atc-probe5`, template `oo/interfaces`

submitted `/sap/bc/adt/oo/interfaces/ZOK_IF_PROBE` → **201**, polled to `finished`

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/INTF/ZOK_IF_PROBE" adtcore:type="INTF" adtcore:name="ZOK_IF_PROBE" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

### `function_group` — `atc-probe5`, template `functions/groups`

submitted `/sap/bc/adt/functions/groups/ZOK_FG_PROBE` → **201**, polled to `finished`

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/FUGR/ZOK_FG_PROBE" adtcore:type="FUGR" adtcore:name="ZOK_FG_PROBE" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

### `package` — `atc-probe5`, template `packages`

submitted `/sap/bc/adt/packages/ZBASE_PROBE01` → **201**, polled to `finished`

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/DEVC/ZBASE_PROBE01" adtcore:type="DEVC" adtcore:name="ZBASE_PROBE01" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/CLAS/ZOK_CL_CLEANER" adtcore:type="CLAS" adtcore:name="ZOK_CL_CLEANER" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" atcobject:objectTypeId="CLAS/OC" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

### `ddl_source` — `atc-probe5`, template `ddic/ddl/sources`

submitted `/sap/bc/adt/ddic/ddl/sources/ZOK_I_PROBE` → **201**, polled to `finished`

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/DDLS/ZOK_I_PROBE" adtcore:type="DDLS" adtcore:name="ZOK_I_PROBE" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

### `table` — `atc-probe5`, template `ddic/tables`

submitted `/sap/bc/adt/ddic/tables/ZOK_T_PROBE` → **201**, polled to `finished`

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/TABL/ZOK_T_PROBE" adtcore:type="TABL" adtcore:name="ZOK_T_PROBE" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

### `behavior_definition` — `atc-probe6`, template `bo/behaviordefinitions`

submitted `/sap/bc/adt/bo/behaviordefinitions/ZOK_I_PROBE` → **201**, polled to `finished`

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/BDEF/ZOK_I_PROBE" adtcore:type="BDEF" adtcore:name="ZOK_I_PROBE" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" atcobject:objectTypeId="BDEF/BDO" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

## The control: a URI that cannot exist

- `atc-probe5`: `/sap/bc/adt/oo/classes/ZZ_NO_SUCH_CLASS_PROBE` → **None** — the answer a real object gets.
- `atc-probe6`: `/sap/bc/adt/oo/classes/ZZ_NO_SUCH_CLASS_PROBE` → **201** — the answer a real object gets.

That is why a 201 is not evidence, and why every row above cites a worklist.

## What the system refuses to hold

`program` and `include` have no representative because ABAP Cloud will not create one:

```xml
<exc:exception><type id="ExceptionResourceNoAuthorization"/>
  <message lang="EN">You are not authorized to make changes (authorization object S_DEVELOP)</message>
</exc:exception>
```

Unmeasurable here rather than unmeasured; they wait on an on-prem probe.

## Open questions, as far as these runs took them

- `atc-probe5` `worklist-longpolling-in-flight` → 200, 6181ms, `unreadable`
- `atc-probe5` `run-for-longpolling-in-flight` → 201, 5656ms, `unreadable`
- `atc-probe5` `run-status-in-flight-longpolling` → 200, 1895ms, `running`
- `atc-probe5` `run-status-in-flight-plain` → 200, 2107ms, `running`
- `atc-probe6` `worklist-longpolling-in-flight` → 200, 5057ms, `unreadable`
- `atc-probe6` `run-for-longpolling-in-flight` → 201, 4641ms, `unreadable`
- `atc-probe6` `run-status-in-flight-longpolling` → 200, 1278ms, `running`
- `atc-probe6` `run-status-in-flight-plain` → 200, 1297ms, `running`

A long poll and a plain read started at the same moment came back within ~200ms of each
other, both `running`. Recorded as evidence; one pair is not a fact about the server.

- `atc-probe5` FINDING_STATS: run-known-bad-clientWait-true = `0,0,1`; run-clientWait-true = `0,0,1`
- `atc-probe6` FINDING_STATS: run-clientWait-true = `0,0,1`

Not decoded: the positions need the triples correlated with the findings' priorities, and a
worklist carrying more than one priority.
