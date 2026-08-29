# Profiler contract evidence — E19 on-premise, 2026-08-28

Taken for `fr0ster/mcp-abap-adt-interfaces#46`, which holds `22.0.0` on one measurement.
Captured by `scripts/probe-profiler-contract.ts --write` plus follow-up reads, against E19
(`RFCSAPRL 816`, client 100). Raw captures stay out of git (`profiler-probe/` is ignored) —
these are the responses.

**Verdict on the blocker: (b).** The catalogue URIs go on a **trace request**, not on the
parameters document. `IProfilerTraceParameters` does not gain fields; `ITraceScheduling` gains
an operation.

---

## Task 0.2 — where the catalogue choices go

### The catalogues answer, and are lists of URIs

`GET /sap/bc/adt/runtime/traces/abaptraces/objecttypes` → **200**, 7 items:

```xml
<nameditem:namedItemList xmlns:nameditem="http://www.sap.com/adt/nameditem"><nameditem:totalItemCount>7</nameditem:totalItemCount><nameditem:namedItem><nameditem:name>/sap/bc/adt/runtime/traces/abaptraces/objecttypes/report</nameditem:name><nameditem:description>Program</nameditem:description><nameditem:data/></nameditem:namedItem><nameditem:namedItem><nameditem:name>/sap/bc/adt/runtime/traces/abaptraces/objecttypes/transaction</nameditem:name><nameditem:description>Transaction</nameditem:description>…
```

`GET …/processtypes` → **200**, 8 items, same shape (`…/processtypes/any` "Any",
`…/processtypes/dialog` "Dialog", `…/processtypes/batch` "Background Processing",
`…/processtypes/rfc`, …). Both match what the trial reported.

### The parameters document is not where they go

`GET …/abaptraces/parameters` (the collection) → **405**

```xml
<exc:exception …><type id="ExceptionMethodNotSupported"/><message lang="EN">Resource controller does not support method GET</message>…</exc:exception>
```

`POST …/abaptraces/parameters` with the body the client builds today → **200**,
`Location: /sap/bc/adt/runtime/traces/abaptraces/parameters/0CC47A1E68C11FE1A8D8470F103675CA`,
empty response body.

`GET` of that `Location` → **200 with a zero-byte body**, `content-type:
application/atom+xml;type=entry`. Tried under `application/xml`, under `*/*`, under
`application/atom+xml;type=entry` and under a made-up type — **0 bytes every time**.

So a stored parameters resource cannot be read back at all on this system. It cannot be shown
to carry an object type or a process type, because it carries nothing.

### Where they actually go: the trace request

`GET …/abaptraces/requests` served **`application/atom+xml;type=feed`**. Note the probe asked
for `application/xml` and got **400 `acceptHeaderMissing`** — "Accept header missing" is this
resource's answer to an Accept it does not serve, which is misleading and cost a detour. With
`*/*` it answers 200.

Empty on E19:

```xml
<?xml version="1.0" encoding="utf-8"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:contributor trc:role="orgination" xmlns:trc="http://www.sap.com/adt/runtime/traces/abaptraces"><atom:name>E19</atom:name></atom:contributor><atom:title>ABAP Trace Requests E19</atom:title><atom:updated>2026-08-28T09:26:48Z</atom:updated></atom:feed>
```

A `POST` to that collection creates a request, and the created entry carries **both catalogue
choices as URIs**:

```xml
<atom:entry xml:lang="EN">
  <atom:content type="application/atom+xml" src="/sap/bc/adt/runtime/traces/abaptraces/requests/26%2c20260828092734"/>
  <atom:id>/sap/bc/adt/runtime/traces/abaptraces/requests/26%2c20260828092734</atom:id>
  <atom:link href="/sap/bc/adt/runtime/traces/abaptraces/B3435A3AA2C211F1B5CA0CC47A1E68C1" rel="http://www.sap.com/adt/relations/runtime/traces/abaptraces/tracefile" type="application/atom+xml" title="28.08.2026/12:27:34/-"/>
  <trc:extendedData xmlns:trc="http://www.sap.com/adt/runtime/traces/abaptraces">
    <trc:host>epbyminsd0654_E19_00</trc:host>
    <trc:server>epbyminsd0654_E19_00</trc:server>
    <trc:serverIsCurrent>true</trc:serverIsCurrent>
    <trc:requestIndex>26</trc:requestIndex>
    <trc:client trc:role="admin">100</trc:client>
    <trc:client trc:role="trace"/>
    <trc:description>-</trc:description>
    <trc:isAggregated>true</trc:isAggregated>
    <trc:expires>2026-08-28T11:27:34Z</trc:expires>
    <trc:processType trc:processTypeId="/sap/bc/adt/runtime/traces/abaptraces/processtypes/any"/>
    <trc:object trc:objectTypeId="/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any"/>
    <trc:executions trc:maximal="1" trc:completed="1"/>
  </trc:extendedData>
</atom:entry>
```

`trc:processTypeId` and `trc:objectTypeId` are exactly the URIs `listProcessTypes()` and
`listObjectTypes()` hand out. That settles it: they are scheduling inputs.

Discovery agrees, and names a second flavour nothing has used:

```xml
<app:collection href="…/abaptraces/requests"><atom:title>Trace requests</atom:title><atom:category term="trace-requests" …/></app:collection>
<app:collection href="…/abaptraces/requests"><atom:title>Trace requests with uri</atom:title><atom:category term="trace-requests-with-uri" …/></app:collection>
```

and three parameters flavours — `trace-parameters`, `trace-parameters-callstackaggregation`,
`trace-parameters-amdptrace` — none of which declares an `app:accept`.

### How this was obtained, and what it cost

The POST was meant to be **rejected**: it was sent with `Content-Type:
application/x-probe-invalid` and an empty body, expecting a 415 or a 400 naming the accepted
type. **It was accepted instead** — 200 — and created request index 26, which then matched and
produced a trace file. Both were deleted immediately:

```
DELETE /sap/bc/adt/runtime/traces/abaptraces/requests/26%2c20260828092734  → 200
DELETE /sap/bc/adt/runtime/traces/abaptraces/B3435A3AA2C211F1B5CA0CC47A1E68C1 → 200
```

Verified after: the feed has **0 entries**, and the trace file answers **404**. Recorded rather
than tidied away, because "an invalid content type is rejected" was an assumption and it was
wrong — this collection takes a POST with no usable body at all and schedules something.

**What is still missing for (b):** the request body Eclipse sends. The entry above shows the
stored shape, not the submitted one. A capture of Eclipse scheduling a trace for an object
would give the field names directly; without it, the submitted document has to be reconstructed
from the stored one.

## Task 0.1 — cross traces

E19 has none, the same as the trial:

```xml
<?xml version="1.0" encoding="utf-8"?><sxt:traces xmlns:sxt="http://www.sap.com/adt/crosstrace/traces"/>
```

```xml
<?xml version="1.0" encoding="utf-8"?><sxt:activations xmlns:sxt="http://www.sap.com/adt/crosstrace/traces"/>
```

Both `200`, under `application/vnd.sap.adt.crosstrace.traces.v1+xml` and
`…crosstrace.activations.v1+xml`. So `ICrossTrace` has no measured shape anywhere, and ships
unchanged in `22.0.0` as the plan provides for. That is an answer, not a gap.

## Task 0.4 — what `/sap/bc/adt/includes/validation` takes

`POST`, `Accept: application/vnd.sap.as+xml`, parameters in the query string. Discovered by
removing one at a time; the server names the first one it misses:

| parameters sent | status | answer |
|---|---|---|
| *(none)* | 400 | `Parameter objtype could not be found.` |
| `objname` | 400 | `Parameter objtype could not be found.` |
| `objname`, `objtype=PROG/I` | 400 | `Parameter packagename could not be found.` |
| `objtype=PROG/I`, `packagename` | 400 | `Parameter objname could not be found.` |
| `objname`, `objtype=PROG/I`, `packagename` | **200** | `<CHECK_RESULT>X</CHECK_RESULT>` |
| `objname`, `objtype=PROG/I`, `packagename`, `description` | **200** | `<CHECK_RESULT>X</CHECK_RESULT>` |

So **`objname`, `objtype` and `packagename` are required; `description` is optional.** Success
body, verbatim:

```xml
<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><CHECK_RESULT>X</CHECK_RESULT></DATA></asx:values></asx:abap>
```

The endpoint does not police `objtype`: `objtype=PROG/P` posted to the **includes** validation
also answers `200 X`.

**The same three are required by `/sap/bc/adt/programs/validation`** — measured side by side:

| endpoint | `objname` + `objtype` only | + `packagename` |
|---|---|---|
| `/programs/validation` | 400 `Parameter packagename could not be found.` | 200 `X` |
| `/includes/validation` | 400 `Parameter packagename could not be found.` | 200 `X` |

**So the parameter set is identical and an include needs no validation params type of its
own.** The endpoints differ; the parameters do not.

That comparison also turned up a defect in this package: `validateProgramName()` in
`src/core/program/validation.ts` appends `packagename` only `if (packageName)`, so calling it
without a package sends a request the server answers **400**. The parameter is not optional.
