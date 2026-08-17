# ATC evidence: `AtcObjectType` confirmed on the cloud trial, 2026-08-17

Captured by `scripts/probe-atc.ts` against package `ZBASE_PROBE01`. Host redacted; everything
else is the server's own bytes. Raw captures stay out of git (`atc-probe*/` is ignored).

## What has to be shown, and why a summary will not do

A type is confirmed when **the run submitted at the URI this client builds** comes back with that
object in **its own** finished worklist. A weaker fact — the type appearing in *some* worklist —
proves the type is checkable but not that the URI is right, and the package run lists everything
in the package, so it can supply that weaker fact for every type at once.

An earlier version of this file gave one status response and, per type, a sentence saying the run
was polled to `finished` beside an `<atcobject:object>` element. That cannot be checked: nothing
tied the element to that type's own run, so each one could equally have come from the package
run. Raised in review, 2026-08-17.

So each section below carries the chain, and the **worklist id is the join**: it appears in the
run request, in the run resource the `Location` points at, and in the worklist read. Same id
throughout, different id per type.

### `class` — `atc-probe5`, template `oo/classes`

**worklist `0ABD945AC5681FE1A6C51EE2E3AB6030`** — the id that joins the four steps.

```
1. POST /sap/bc/adt/atc/worklists?checkVariant=…            -> 0ABD945AC5681FE1A6C51EE2E3AB6030
2. POST /sap/bc/adt/atc/runs?worklistId=0ABD945AC5681FE1A6C51EE2E3AB6030&clientWait=false
      objectReference adtcore:uri="/sap/bc/adt/oo/classes/ZOK_CL_CLEANER"
   -> 201   Location: /sap/bc/adt/atc/runs/6E27F48C3C661FD1A6C51F140BD97D04
3. GET  /sap/bc/adt/atc/runs/6E27F48C3C661FD1A6C51F140BD97D04
   -> finished
4. GET  /sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C51EE2E3AB6030?includeExemptedFindings=false
```

and step 4 answered with:

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/CLAS/ZOK_CL_CLEANER" adtcore:type="CLAS" adtcore:name="ZOK_CL_CLEANER" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" atcobject:objectTypeId="CLAS/OC" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

The run resource itself links back to the same worklist — `/sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C51EE2E3AB6030` — so the
chain closes without taking my word for any step.

### `interface` — `atc-probe5`, template `oo/interfaces`

**worklist `0ABD945AC5681FE1A6C5211857828030`** — the id that joins the four steps.

```
1. POST /sap/bc/adt/atc/worklists?checkVariant=…            -> 0ABD945AC5681FE1A6C5211857828030
2. POST /sap/bc/adt/atc/runs?worklistId=0ABD945AC5681FE1A6C5211857828030&clientWait=false
      objectReference adtcore:uri="/sap/bc/adt/oo/interfaces/ZOK_IF_PROBE"
   -> 201   Location: /sap/bc/adt/atc/runs/6E27F48C3C661FD1A6C5214CDE2CBD04
3. GET  /sap/bc/adt/atc/runs/6E27F48C3C661FD1A6C5214CDE2CBD04
   -> finished
4. GET  /sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C5211857828030?includeExemptedFindings=false
```

and step 4 answered with:

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/INTF/ZOK_IF_PROBE" adtcore:type="INTF" adtcore:name="ZOK_IF_PROBE" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

The run resource itself links back to the same worklist — `/sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C5211857828030` — so the
chain closes without taking my word for any step.

### `function_group` — `atc-probe5`, template `functions/groups`

**worklist `0ABD945AC5681FE1A6C522E8469FA030`** — the id that joins the four steps.

```
1. POST /sap/bc/adt/atc/worklists?checkVariant=…            -> 0ABD945AC5681FE1A6C522E8469FA030
2. POST /sap/bc/adt/atc/runs?worklistId=0ABD945AC5681FE1A6C522E8469FA030&clientWait=false
      objectReference adtcore:uri="/sap/bc/adt/functions/groups/ZOK_FG_PROBE"
   -> 201   Location: /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6C52335D086A030
3. GET  /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6C52335D086A030
   -> finished
4. GET  /sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C522E8469FA030?includeExemptedFindings=false
```

and step 4 answered with:

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/FUGR/ZOK_FG_PROBE" adtcore:type="FUGR" adtcore:name="ZOK_FG_PROBE" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

The run resource itself links back to the same worklist — `/sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C522E8469FA030` — so the
chain closes without taking my word for any step.

### `package` — `atc-probe5`, template `packages`

**worklist `6E27F48C3C661FD1A6C5291DD624DD04`** — the id that joins the four steps.

```
1. POST /sap/bc/adt/atc/worklists?checkVariant=…            -> 6E27F48C3C661FD1A6C5291DD624DD04
2. POST /sap/bc/adt/atc/runs?worklistId=6E27F48C3C661FD1A6C5291DD624DD04&clientWait=false
      objectReference adtcore:uri="/sap/bc/adt/packages/ZBASE_PROBE01"
   -> 201   Location: /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6C529A99B88E030
3. GET  /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6C529A99B88E030
   -> finished
4. GET  /sap/bc/adt/atc/worklists/6E27F48C3C661FD1A6C5291DD624DD04?includeExemptedFindings=false
```

and step 4 answered with:

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/DEVC/ZBASE_PROBE01" adtcore:type="DEVC" adtcore:name="ZBASE_PROBE01" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

The run resource itself links back to the same worklist — `/sap/bc/adt/atc/worklists/6E27F48C3C661FD1A6C5291DD624DD04` — so the
chain closes without taking my word for any step.

### `ddl_source` — `atc-probe5`, template `ddic/ddl/sources`

**worklist `0ABD945AC5681FE1A6C52B35BA0B2030`** — the id that joins the four steps.

```
1. POST /sap/bc/adt/atc/worklists?checkVariant=…            -> 0ABD945AC5681FE1A6C52B35BA0B2030
2. POST /sap/bc/adt/atc/runs?worklistId=0ABD945AC5681FE1A6C52B35BA0B2030&clientWait=false
      objectReference adtcore:uri="/sap/bc/adt/ddic/ddl/sources/ZOK_I_PROBE"
   -> 201   Location: /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6C52B607B756030
3. GET  /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6C52B607B756030
   -> finished
4. GET  /sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C52B35BA0B2030?includeExemptedFindings=false
```

and step 4 answered with:

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/DDLS/ZOK_I_PROBE" adtcore:type="DDLS" adtcore:name="ZOK_I_PROBE" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

The run resource itself links back to the same worklist — `/sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C52B35BA0B2030` — so the
chain closes without taking my word for any step.

### `table` — `atc-probe5`, template `ddic/tables`

**worklist `0ABD945AC5681FE1A6C52D7F13510030`** — the id that joins the four steps.

```
1. POST /sap/bc/adt/atc/worklists?checkVariant=…            -> 0ABD945AC5681FE1A6C52D7F13510030
2. POST /sap/bc/adt/atc/runs?worklistId=0ABD945AC5681FE1A6C52D7F13510030&clientWait=false
      objectReference adtcore:uri="/sap/bc/adt/ddic/tables/ZOK_T_PROBE"
   -> 201   Location: /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6C52E46A753E030
3. GET  /sap/bc/adt/atc/runs/0ABD945AC5681FE1A6C52E46A753E030
   -> finished
4. GET  /sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C52D7F13510030?includeExemptedFindings=false
```

and step 4 answered with:

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/TABL/ZOK_T_PROBE" adtcore:type="TABL" adtcore:name="ZOK_T_PROBE" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

The run resource itself links back to the same worklist — `/sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C52D7F13510030` — so the
chain closes without taking my word for any step.

### `behavior_definition` — `atc-probe6`, template `bo/behaviordefinitions`

**worklist `0ABD945AC5681FE1A6C5C5D1D420A030`** — the id that joins the four steps.

```
1. POST /sap/bc/adt/atc/worklists?checkVariant=…            -> 0ABD945AC5681FE1A6C5C5D1D420A030
2. POST /sap/bc/adt/atc/runs?worklistId=0ABD945AC5681FE1A6C5C5D1D420A030&clientWait=false
      objectReference adtcore:uri="/sap/bc/adt/bo/behaviordefinitions/ZOK_I_PROBE"
   -> 201   Location: /sap/bc/adt/atc/runs/6E27F48C3C661FD1A6C5C6051AB83D04
3. GET  /sap/bc/adt/atc/runs/6E27F48C3C661FD1A6C5C6051AB83D04
   -> finished
4. GET  /sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C5C5D1D420A030?includeExemptedFindings=false
```

and step 4 answered with:

```xml
<atcobject:object adtcore:uri="/sap/bc/adt/atc/objects/R3TR/BDEF/ZOK_I_PROBE" adtcore:type="BDEF" adtcore:name="ZOK_I_PROBE" adtcore:packageName="ZBASE_PROBE01" atcobject:author="CB9980006582" atcobject:objectTypeId="BDEF/BDO" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
```

The run resource itself links back to the same worklist — `/sap/bc/adt/atc/worklists/0ABD945AC5681FE1A6C5C5D1D420A030` — so the
chain closes without taking my word for any step.

## The control: a URI that cannot exist

- `atc-probe5`: `/sap/bc/adt/oo/classes/ZZ_NO_SUCH_CLASS_PROBE` -> **None**, the answer a real object gets.
- `atc-probe6`: `/sap/bc/adt/oo/classes/ZZ_NO_SUCH_CLASS_PROBE` -> **201**, the answer a real object gets.

Which is why every section above cites a worklist and not a status code.

## What the system refuses to hold

```xml
<exc:exception><type id="ExceptionResourceNoAuthorization"/>
  <message lang="EN">You are not authorized to make changes (authorization object S_DEVELOP)</message>
</exc:exception>
```

`program` and `include` are unmeasurable here rather than unmeasured; they wait on an
on-prem probe.

## Open questions, as far as these runs took them

- `atc-probe5` `worklist-longpolling-in-flight` -> 200, 6181ms, `unreadable`
- `atc-probe5` `run-for-longpolling-in-flight` -> 201, 5656ms, `unreadable`
- `atc-probe5` `run-status-in-flight-longpolling` -> 200, 1895ms, `running`
- `atc-probe5` `run-status-in-flight-plain` -> 200, 2107ms, `running`
- `atc-probe6` `worklist-longpolling-in-flight` -> 200, 5057ms, `unreadable`
- `atc-probe6` `run-for-longpolling-in-flight` -> 201, 4641ms, `unreadable`
- `atc-probe6` `run-status-in-flight-longpolling` -> 200, 1278ms, `running`
- `atc-probe6` `run-status-in-flight-plain` -> 200, 1297ms, `running`

Started at the same moment, both back within ~200ms, both `running`. Evidence, not a verdict.

- `atc-probe5` FINDING_STATS: run-known-bad-clientWait-true = `0,0,1`; run-clientWait-true = `0,0,1`
- `atc-probe6` FINDING_STATS: run-clientWait-true = `0,0,1`

Not decoded: the positions need triples correlated with the findings' priorities, and a
worklist carrying more than one priority.
