# Transport list, and where parsing stops

**Status:** design, approved in outline; the `list` fix is a prerequisite for the rest.
**Date:** 2026-08-07

## Why this exists

Issue #105 asks for a typed transport request, because `AdtClient.getRequest().list()`
hands back an unparsed response and every consumer parses the CTS tree itself. That
request is reasonable, but its stated cause is wrong, and building on it would have
produced a well-typed API over a call that returns nothing.

Probed against the trial system on 2026-08-07:

| step | result |
|---|---|
| `create` a request | `TRLK900494`, `errors: []` |
| `read` it back | HTTP 200, 10.6 KB, full metadata |
| requests actually on the system | 15, of which 11 are ours, oldest 2026-07-20 |
| `GET /cts/transportrequests?user=…` | **empty root**, 309 bytes |
| same with `status`, with the user GUID, with no parameter at all | **empty root**, every time |

So there is no `tm:request` in the response to parse *at any depth*. Issue #105 attributes
`fr0ster/mcp-abap-adt#168` to a consumer parser assuming the wrong nesting; for this
library the cause is upstream of parsing — the request is built wrong.

## The actual defect

The transport list is a **saved-configuration search**, not a filtered GET. The server
says so itself:

```
GET /sap/bc/adt/cts/transportrequests/searchconfiguration/configurations
  → <configuration:configuration> … href=".../configurations/7E5B0B99…"

GET /sap/bc/adt/cts/transportrequests/facets
  → request_type, request_status, cts_project, target, repository
```

The stored configuration carries the real search properties:

```
User, WorkbenchRequests, CustomizingRequests, Modifiable, Released,
DateFilter, FromDate, ToDate, com.sap.adt.tm.facets.order
```

`src/core/transport/list.ts` sends `user`, `status`, `dateRange`, `targetSystem`, `type`.
The only overlap is `user`, and even that differs in case. Passing the configuration's own
property names as query parameters still returns an empty root — the search must be
*referenced*, not restated:

```
GET /sap/bc/adt/cts/transportrequests?configUri=<href of a saved configuration>
  → 137 181 bytes, 16 × <tm:request>
```

### Captured shape

With `configUri`, the response is exactly the tree #105 reconstructed — that part of the
issue is correct and is now **captured, not inferred**:

```xml
<tm:root adtcore:name="CB9980008038" …>
  <tm:workbench tm:category="Workbench">
    <tm:modifiable tm:status="Modifiable">
      <tm:request tm:number="TRLK900494" tm:parent="" tm:owner="CB9980008038"
                  tm:desc="probe capture transport" tm:type="K" tm:status="D"
                  tm:target="" tm:target_desc="" tm:cts_project=""
                  tm:cts_project_desc="" tm:lastchanged_timestamp="20260807095553"
                  tm:uri="/sap/bc/adt/vit/wb/object_type/…/TRLK900494">
        <tm:long_desc/>
        <atom:link rel="…/adturi"           href="/sap/bc/adt/cts/transportrequests/TRLK900494"/>
        <atom:link rel="…/consistencycheck" href="…/TRLK900494/consistencychecks"/>
        <atom:link rel="…/releasejobs"      href="…/TRLK900494/releasejobs"/>
```

`tm:workbench` repeats per target, and status lives on the container
(`tm:modifiable`, `tm:released`), not on the request node.

## Where parsing stops

**Parsing is not this library's job beyond identifying what belongs to the object and the
method.** Deciding that a field is "the description", renaming `tm:desc` to `description`,
choosing which fields matter — that is the consumer's, and doing it here would make the
library agnostic in name only.

So the library parses **exactly enough to form a structural type**: it knows that
`tm:request` sits under a status container inside a category container — ADT knowledge a
consumer should not need — and it hands back the nodes as they are.

```ts
list()      -> IAdtResponse          // unchanged; for callers wanting status and headers
listNodes() -> {
  requests: Array<{
    attributes: Record<string, string>;   // tm:number, tm:desc, tm:owner … verbatim
    container: { category: string; status: string; target?: string };
    tasks: Array<{ attributes: Record<string, string> }>;
  }>;
}
```

`container` exists because flattening the tree loses the status and the target: they
belong to the request but are carried by its parents. No renaming, no field selection, no
camelCase.

### The parser is replaceable

```ts
new AdtClient(conn, logger, { transportListParser: myParser })
```

The default parser is *typical*, not authoritative. A consumer on a system whose payload
differs substitutes its own instead of waiting for a release. This follows the existing
`IAdtClientOptions.enableAcceptCorrection` precedent.

### Absent is not unrecognised

| response | result |
|---|---|
| `<tm:root/>` self-closing | `requests: []` — an honest "none" |
| root is not `tm:root`, or the shape is unknown | **throws**, carrying the payload |

Both states are verified: the empty root is what a system with no matching requests
returns, and it must never be reported as a failure — on systems that hold no transport
requests at all it is the permanent, correct answer. **No heuristic may treat emptiness as
suspicious**; that would replace one lie with another. The distinction is structural — by
root element and nesting — never by counting results. Counting is exactly what produced
`{"success": true, "count": 0}` over 55 real requests in #168.

We cannot distinguish "this user owns none" from "this system has none". The trial answers
both identically. That difference is not invented into the type.

## Order of work

1. **Fix `list.ts`** — resolve a search configuration and pass `configUri`. Until this
   lands there is nothing to type.
2. **Structural type + parser** — in `@mcp-abap-adt/interfaces`, published **before**
   adt-clients consumes it.
3. **Tests** — see below.
4. **Rewrite issue #105** — its "What it cost" section states a cause that the evidence
   contradicts.

Applying the same rule to the other raw methods (`AdtUtils` returns `IAdtResponse` from 23
of its 35 methods) comes after transports, which is the only one with a proven defect.

## Tests

- **Unit, from the captured payload.** `/tmp/final.txt` holds 137 KB with 16 requests;
  a trimmed fixture goes into the repo. Asserts: nesting is read correctly, container
  status is attached, attributes survive verbatim.
- **Unit, unrecognised body** — throws rather than returning `[]`.
- **Unit, empty root** — returns `[]`, does not throw, emits no warning.
- **Integration** — asserts *content*, and states which case it verified. On a system with
  no requests it must assert "shape recognised, zero requests" rather than skip or fail.
  Today's test asserts only `listResult).toBeDefined()`, which passes over an empty tree —
  which is why this went unnoticed since 2026-07-20.

## Evidence status

| claim | basis |
|---|---|
| `configUri` returns requests; the other forms do not | captured, trial, 2026-08-07 |
| tree nesting and `tm:*` attribute names | captured |
| empty root for no matches | captured |
| `transportorganizertree` is the only type `/cts/transportrequests` accepts | captured (406 body) |
| `transportorganizer.v1+xml` is the *item* type, not the collection's | captured |
| where the configuration comes from when none is saved | **unknown** — every probe here found one already present |
| whether on-prem behaves the same | **unverified** — no on-prem system is reachable from this machine |

## Open questions

1. **If no saved configuration exists**, must the client create one (POST), and with what
   body? Every trial probe found one already there. This decides whether `list()` can be a
   single call or needs a create-then-search sequence.
2. **Does `configUri` exist on older on-prem releases?** `e77` discovery has no transport
   organizer collection at all.
3. Should `list()` accept an explicit `configUri`, so a consumer can drive its own saved
   search? Likely yes, defaulting to the first available configuration.

## Related

- #105 — the request this design answers, and corrects
- #7 — added `listTransports()`; the call has never returned data
- fr0ster/mcp-abap-adt#168 / #169 — the empty-list defect downstream
