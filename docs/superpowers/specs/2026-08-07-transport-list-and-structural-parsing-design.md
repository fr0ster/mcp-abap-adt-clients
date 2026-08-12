# Transport list, and where parsing stops

**Status:** design, revised after review. Steps A and B are unblocked; the capture (C) blocks
only the parsing half, D and E.
**Date:** 2026-08-07 (revised same day)

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

### Captured shape — the first 1 800 characters of it

With `configUri`, the opening of the response is exactly the tree #105 reconstructed — that
part of the issue is correct and is **captured, not inferred**. What follows is the whole of
what was kept; the remaining ~135 KB was not saved, and no claim below rests on it:

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

Status lives on the container, not only on the request node — `tm:status="Modifiable"` sits
on `tm:modifiable` while the request carries its own `tm:status="D"`. That much is visible
above. That `tm:workbench` repeats per target, and that a `tm:released` sibling container
exists, is **inference from one excerpt** — it is in the capture question table, not in the
evidence table.

## Where parsing stops

**Parsing is not this library's job beyond identifying what belongs to the object and the
method.** Deciding that a field is "the description", renaming `tm:desc` to `description`,
choosing which fields matter — that is the consumer's, and doing it here would make the
library agnostic in name only.

So the library parses **exactly enough to form a structural type**: it knows that
`tm:request` sits under a status container inside a category container — ADT knowledge a
consumer should not need — and it hands back the nodes as they are.

The shape of that type is **not fixed by this document**. It is derived from the captured
fixture; see "The type is derived, not declared" below.

## The API, exactly

### What exists today

```ts
// src/core/transport/list.ts
export async function listTransports(
  connection: IAbapConnection,
  params: IListTransportsParams,          // { user, status?, date_range?, target_system?, request_type? }
): Promise<IAdtResponse>;

// src/core/transport/AdtRequest.ts — reached via AdtClient.getRequest()
async list(params: {
  user: string; status?: string; dateRange?: string;
  targetSystem?: string; requestType?: string;
}): Promise<ITransportState>;             // ITransportState.listResult?: IAdtResponse

// @mcp-abap-adt/interfaces
interface ITransportState extends IAdtObjectState {
  transportNumber?: string; taskNumber?: string; listResult?: IAdtResponse;
}
```

Four call sites reach it: `AdtClient.getRequest()`, `AdtClientLegacy.getRequest()` (returns
`AdtRequestLegacy`, which does **not** override `list`), `AdtClientBatch.getRequest()`
(delegates to the same `AdtRequest` over `BatchRecordingConnection`), and the low-level
export.

### What it becomes

Two levels, and the boundary between them is where resolution happens. **The low level never
resolves anything and never makes a call the caller did not ask for.** `configUri` is
therefore *required* there, and optional only one level up.

```ts
// @mcp-abap-adt/interfaces — on npm before adt-clients imports any of it.
// The first four ship in release A, TransportTreeParser in release B: it
// returns ITransportTree, which the capture defines. See "Order of work".

/** Low level. configUri is required: this layer does not resolve, it requests. */
export interface IListTransportsParams {
  /** href of a saved search configuration, verbatim from getTransportSearchConfigurations. */
  configUri: string;
}

/** High level. Omitting configUri opts into the resolution rule below. */
export interface IListTransportsOptions {
  configUri?: string;
}

export interface ITransportSearchConfiguration {
  /** href from the atom:link child, verbatim — pass back as configUri. */
  uri: string;
  /** etag from the same link, when present. */
  etag?: string;
  /** createdBy, createdAt, changedBy, changedAt, client — verbatim, no renaming. */
  attributes: Record<string, string>;
}

export type TransportTreeParser = (data: unknown) => ITransportTree;
```

```ts
// src/core/transport/list.ts — low level. Exactly one request per function, always.
export async function listTransports(
  connection: IAbapConnection,
  params: IListTransportsParams,          // configUri required
): Promise<IAdtResponse>;

export async function getTransportSearchConfigurations(
  connection: IAbapConnection,
): Promise<ITransportSearchConfiguration[]>;

// src/core/transport/parseTransportTree.ts — pure, no connection, exported from the root
export const parseTransportTree: TransportTreeParser;
```

```ts
// src/core/transport/AdtRequest.ts — high level. Resolves, then delegates.
async list(options?: IListTransportsOptions): Promise<ITransportState>;
async listNodes(options?: IListTransportsOptions): Promise<ITransportTree>;
```

### How many requests

| call | requests |
|---|---|
| `list({ configUri })` / `listNodes({ configUri })` | **1** — the list |
| `list()` / `listNodes()` | **2** — configurations, then the list |
| `listTransports(conn, { configUri })` | **1**, always — it has no other mode |

`listNodes()` adds **no** request to `list()`: it is `list()` plus `parseTransportTree`
applied to `listResult.data`. `ITransportState` gains **no** `nodes` field — a parsed tree is
not an operation result, and putting it there would make the state type claim something it
does not always hold.

The parser is injected through the existing options object and threaded down:

```ts
new AdtClient(conn, logger, { transportListParser: myParser })
// → IAdtClientOptions.transportListParser?: TransportTreeParser
// → AdtRequest constructor gains an optional 4th argument
// → AdtRequestLegacy passes it through super()
```

The default parser is *typical*, not authoritative. A consumer on a system whose payload
differs substitutes its own instead of waiting for a release. This follows the existing
`IAdtClientOptions.enableAcceptCorrection` precedent. Because `parseTransportTree` is also
exported standalone, a consumer can parse a response it obtained any other way — including
one that came back from a batch.

### Batch

`AdtClientBatch.getRequest()` returns the same `AdtRequest` over `BatchRecordingConnection`,
whose `makeAdtRequest` resolves only after `execute()`. With an explicit `configUri` both
methods work unchanged: `list()` records one part, and `listNodes()` parses it once the batch
resolves.

**Automatic resolution cannot work there.** It must read the configurations response before
it can build the list URL, and during recording that response has not arrived — so the
`await` inside resolution never returns, and the consumer never reaches `execute()` to make
it return. A deadlock, not an error.

This affects **`list()` and `listNodes()` equally** — both resolve, so both hang. The guard
belongs in the shared resolution step, not in either method.

#### The mechanism

Deferral is a property of the connection, not of how the client was configured, so the
connection declares it. This follows the connection capability atoms already in
`@mcp-abap-adt/interfaces`:

```ts
// @mcp-abap-adt/interfaces
export interface IDeferredResponseConnection {
  /** Responses resolve only after a later flush; awaiting one mid-recording deadlocks. */
  readonly responsesAreDeferred: true;
}

export function hasDeferredResponses(
  connection: IAbapConnection,
): connection is IAbapConnection & IDeferredResponseConnection;
```

`BatchRecordingConnection` implements it with one field. `AdtRequest` calls
`hasDeferredResponses(this.connection)` before resolving and throws:

> `configUri is required on a batch client: resolving a search configuration needs a
> response that a batch cannot deliver until execute().`

Three reasons this beats a `batchMode` constructor option:

- it is true of the connection whatever built the handler — including a consumer who wraps
  `BatchRecordingConnection` themselves, without going through `AdtClientBatch`;
- `AdtClientBatch` forwards the caller's `IAdtClientOptions` verbatim to the inner
  `AdtClient`, so an option-based flag would have to be injected into someone else's object;
- a consumer cannot set it wrong on a normal connection without lying about their own
  transport.

**What it does not cover:** a third-party connection that defers responses without declaring
it still deadlocks. The marker makes the known case honest; it is not a proof of absence. If
that becomes real, the fallback is a timeout on resolution — deliberately not designed now,
because no such connection exists.

### Legacy

`AdtRequestLegacy` inherits `list()` today and therefore calls the ADT path on a system that
does not have it, while `listTransportsLegacy()` — pointing at `/sap/bc/cts/transportrequests`
— sits unused since it was written. `AdtRequestLegacy` overrides `list()` to use it.

`listNodes()` on legacy **throws**: the legacy endpoint's payload has never been captured, and
guessing that `parseTransportTree` fits it would be exactly the failure this design exists to
stop. It becomes supported when someone captures a legacy payload.

## Compatibility

The five filter parameters have never had an effect. Probed 2026-08-07: the endpoint returns
the same empty root for `?user=`, for `?status=`, for the server's own property spellings, and
for no parameters at all. They are not "currently ignored" — they were never read.

So they are **removed**, not deprecated. Keeping a parameter that shapes nothing is the same
class of lie as `{"success": true, "count": 0}`. This is a **breaking change → major version**,
and the migration note is:

| before | after |
|---|---|
| `list({ user: 'ME', status: 'D' })` | `list({ configUri })`, then filter the returned nodes |
| relied on server-side filtering | there was none; the call returned nothing at all |

Filtering is a property of the saved search configuration, which is created in Eclipse and
referenced by href. The library will not filter the returned nodes — same boundary as the
parsing rule: selecting which requests matter is the consumer's decision.

### Resolving `configUri` when the caller omits it

**This lives entirely in `AdtRequest`.** The low-level `listTransports` requires `configUri`
and never runs any of it. Deterministic, or it throws. Never "the first one".

1. `configUri` given → used verbatim. No configurations request, and **no capability check**:
   nothing here needs a response, so a deferred connection is irrelevant.
2. Omitted → resolution is required, and only now does deferral matter:
   1. connection declares `responsesAreDeferred` → throw (see Batch above);
   2. otherwise `getTransportSearchConfigurations()`:
      - **exactly one** → use it.
      - **several, one marked default** → use the marked one.
      - **several, none marked** → throw, listing the URIs and requiring an explicit `configUri`.
      - **none** → throw `TransportSearchConfigurationMissing`, naming the endpoint.

**The order matters and an earlier draft had it wrong.** Checking the capability first would
have rejected every batch call, including `list({ configUri })`, which the Batch section
declares supported — a guard against a deadlock that cannot occur, forbidding the one batch
usage that works. The guard belongs *inside* the omitted branch, because that branch is the
only thing that awaits a response mid-recording.

Whether the payload marks a default is **unverified** — the capture must answer it. If it
does not, the "several" case collapses into "always throw unless explicit", which is still
deterministic; the rule does not change, only how often the error fires.

Cases 3 and 4 mean `list()` can fail where it previously returned an empty tree. That is the
point: it previously returned an empty tree *always*.

## The type is derived, not declared

An earlier draft of this document wrote `ITransportTree` out in full — with `tasks`, with
`container.target` — on the strength of a 1 800-character excerpt of a 137 KB payload. That
is the same mistake the design is about: asserting a shape nobody looked at.

So `ITransportTree` is **not defined here**. It is defined from the fixture, and the capture
must answer these before anyone writes it:

> **ANSWERED 2026-08-11 by an Eclipse trace the user captured.** The four open rows below are
> closed, and two of them are closed differently than this document assumed. See
> "What Eclipse actually does" immediately after this table.

| question | why it changes the type | status |
|---|---|---|
| Is there a `tm:task` element under `tm:request`? | decides whether `tasks` exists at all | **open** — no artifact contains the string `tm:task` |
| Which category containers occur — `tm:workbench` only, or also customizing? | decides whether `category` is a union or an open string | **open** — the configuration sets `CustomizingRequests=true`, so a second container is likely and unseen |
| Which status containers occur — `tm:modifiable`, `tm:released`, others? | same, for `status` | **open** — `Released=true` in the configuration, `tm:released` never observed |
| Do `tm:request` elements ever appear outside a status container? | decides whether `container` is optional | **open** |
| Does `tm:target` appear on the container, the request, or both? | decides where `target` lives | **answered** — a request attribute (`tm:target`, `tm:target_desc`); the container carries only its category |
| Do containers carry attributes beyond category/status? | decides whether `container` needs its own bag | **answered so far** — `tm:workbench` has only `tm:category`, `tm:modifiable` only `tm:status` |
| Does the configurations document mark a default? | decides the resolution rule above | **unanswerable here** — this system has exactly one configuration, and its element has no name or default attribute |

## What Eclipse actually does — captured 2026-08-11

The user pulled the real request/response trace out of Eclipse ADT 3.60.0. It closes every
open row above, and it contradicts two things this document treated as settled.

**1. The container chain is not fixed.** Eclipse's tree carries a `tm:target` level this
document never had:

```
tm:root
  tm:workbench tm:category="Workbench"
    tm:target tm:name="Local Change Requests" tm:desc="No Target # Release locally only"
      tm:modifiable tm:status="Modifiable"
        tm:request …
          tm:long_desc, ~17 × atom:link
          tm:task tm:number tm:parent tm:owner tm:desc tm:type="Unclassified" tm:status …
```

My own probe, sending only `configUri`, got `tm:workbench > tm:modifiable > tm:request` with
**no `tm:target`**. Eclipse sends `?targets=true`. So the level is produced by the parameter,
not by the data — **a parser that hardcodes the chain breaks on the other form.** Walk to
`tm:request` by element name, not by path. `container` cannot be a fixed triple.

**2. `tm:task` exists**, nested inside `tm:request`, with the same attribute set plus
`tm:parent` naming its request.

**3. Our request differs from Eclipse's in two ways:**

| | ours | Eclipse |
|---|---|---|
| query | `?configUri=<href>` | `?targets=true&configUri=<href>` |
| Accept | `transportorganizertree.v1+xml` | `transportorganizer.v1+xml, transportorganizertree.v1+xml` |

Both return `content-type: transportorganizertree.v1+xml`. Ours works — the 137 KB / 16-request
probe used it — but it returns the flatter shape. Whether `targets=true` should be sent, always
or optionally, is now a real design question rather than an unknown.

**4. Eclipse reads the configuration document itself** between listing the configurations and
running the search, then passes only the URI. We skip that read. Nothing so far shows it is
required.

Raw capture: `.superpowers/sdd/2026-08-07-transport-list-configuri/capture/` (git-ignored —
copy into a fixture before that directory is deleted).

All four open rows need the same thing: **the tree body past its first request**. Every probe
printed a prefix, so 16 requests were counted but only one was ever seen. One request cannot
show a second container, a sibling status, or a nested task.

A closed question worth recording, because it contradicts an earlier draft: **status appears
in two places, differently.** In the tree the request carries `tm:status="D"` and the
container carries `tm:status="Modifiable"`; in the item resource the request itself carries
both `tm:status="D"` and `tm:status_text="Modifiable"`. So the container is not the only
carrier of that information in general — it is the only carrier *in the tree*.

What *is* fixed, and needs no capture:

- attributes are handed back **verbatim** — `tm:number`, not `number`; no renaming, no
  selection, no camelCase;
- the container's own values are attached to each request, because flattening the tree
  otherwise loses information the consumer cannot recover;
- nothing is invented that the payload does not carry.

The capture is step C of the work order below for this reason.

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

The types this design adds split cleanly into two groups: those the capture cannot change,
and those it defines. That split, not the call-fix / parse-fix split, is what orders the work
— because **every interfaces type must be on npm before adt-clients imports it**, and half of
them are ready now.

**Two interfaces releases, therefore two publishes by the user.** That is the honest cost of
the rule; the alternative is one publish that waits for a token nobody in this repo controls,
stalling the defect fix behind a fixture it does not need.

| | step | needs the capture? |
|---|---|---|
| A | **Interfaces release A** — `IListTransportsParams` (narrowed to a required `configUri`), `IListTransportsOptions`, `ITransportSearchConfiguration`, `IDeferredResponseConnection` + `hasDeferredResponses`. All four are fixed by the *request* contract and by `BatchRecordingConnection`, neither of which the tree body can change. Publish to npm. | no |
| B | **Fix the call** — `listTransports` with a required `configUri`, `getTransportSearchConfigurations`, the resolution rule in `AdtRequest`, the legacy `list()` override, `responsesAreDeferred` on `BatchRecordingConnection`, and the batch guard. Consumes release A. This is the step that makes `list()` return data at all. | no |
| C | **Capture the tree body in full.** Everything else — configurations, configuration document, metadata template, facets, discovery, the item resource — is already captured and quoted above. Missing is only the tree past its first request, the one thing that answers the four open rows. Probe script: `scratchpad/capture-tree.js`, whole bodies via `fs.writeFileSync`; needs a live token. | — |
| D | **Interfaces release B** — `ITransportTree` derived from the fixture, and `TransportTreeParser`, which is `(data: unknown) => ITransportTree` and so cannot precede it. Publish to npm. | yes |
| E | **Parse** — `parseTransportTree`, `listNodes()`, `transportListParser` injection. Consumes release B. `listNodes()` on legacy throws. | yes |
| F | **Tests** — see below. Those covering the call contract land with B; those over the fixture with E. | partly |
| G | **Rewrite issue #105** — its "What it cost" section states a cause that the evidence contradicts. Can happen any time; it depends on the finding, not the code. | no |

A and B can start today. C is the only thing waiting, and it now blocks D and E alone. No
local `file:` bridge or tarball at either publish — the consumer waits for npm.

Applying the same rule to the other raw methods (`AdtUtils` returns `IAdtResponse` from 23
of its 35 methods) comes after transports, which is the only one with a proven defect.

## Tests

Each test is tagged with the work-order step it lands in. A test cannot precede
the interfaces release its types come from.

- **[E] Unit, from the captured payload.** The response measured 137 KB with 16 requests, but
  the probe wrote only its first 1 800 characters to disk — enough to confirm the nesting
  and the attribute names quoted above, not enough for a fixture. Step C re-captures it in
  full; trim into the repo with the request numbers and owner GUID replaced. Asserts:
  nesting is read correctly, container values are attached, attributes survive verbatim.
- **[E] Unit, unrecognised body** — throws rather than returning `[]`.
- **[E] Unit, empty root** — returns `[]`, does not throw, emits no warning.
- **[B] Unit, resolution rule** — one configuration → used; several with a default → the
  default; several without → throws naming the URIs; none → throws naming the endpoint.
- **[E] Unit, injected parser** — a stub parser is called instead of the default, and its
  return value reaches the caller unchanged.
- **[B] Unit, batch guard — the throwing side.** Over a connection declaring
  `responsesAreDeferred`, `list()` *without* `configUri` throws — and `listNodes()` too,
  once it exists in E. The
  test must assert the throw is **fast**, not merely that it happens: a deadlock would
  otherwise pass as a timeout.
- **[B] Unit, batch guard — the working side.** Over the same connection,
  `list({ configUri })` records **one** part and does not throw — and `listNodes({ configUri })`
  the same, once it exists in E. Without this
  test the guard can be tightened into rejecting all batch calls and everything stays green
  — which is exactly how the first draft of the resolution order was wrong.
- **[B] Unit, low-level purity** — `listTransports` issues exactly one request and never
  touches the configurations endpoint, whatever it is given.

The integration test splits across the two releases, because after B there is no parser and
therefore nothing that can recognise a shape — only a response body.

- **[B] Integration, over the raw response.** Asserts on `listResult.data` itself: the body
  is a `tm:root` document, and — on a system holding requests — it contains at least one
  `tm:request`. That is a string-level assertion, and it is deliberately crude; it is also
  enough to have caught this defect, because the call returned 309 bytes with no
  `tm:request` for two weeks. Today's test asserts only `listResult).toBeDefined()`, which
  an empty tree passes, which is why nothing was noticed since 2026-07-20.
  On a system with no requests it asserts the empty root and **says so in the test name**,
  rather than skipping — a system with nothing to list is a verified case, not an absent one.
- **[E] Integration, over the parsed tree.** Now that recognition exists, asserts what B
  could not: the shape is recognised, and the request count matches what the raw body
  contains. On an empty system that becomes "recognised, zero requests" — the assertion the
  earlier draft demanded at B, where it was unimplementable.

Both share one housekeeping fix, landing with B: `Transport.test.ts` creates transport
requests and never deletes them (11 have accumulated since 2026-07-20). It should take one
from `shared_dependencies` instead of creating its own.

## Evidence status

| claim | basis |
|---|---|
| `configUri` returns requests; the other forms do not | captured, trial, 2026-08-07 |
| tree nesting and `tm:*` attribute names | captured |
| empty root for no matches | captured |
| `transportorganizertree` is the only type `/cts/transportrequests` accepts | captured (406 body) |
| `transportorganizer.v1+xml` is the *item* type, not the collection's | captured |
| the five filter parameters were never read by the server | captured — empty root with them and without them |
| the configurations document | captured **in full** — see below |
| the configuration document (10 properties) | captured **in full** |
| `searchconfiguration/metadata` returns the same properties as a template | captured **in full** |
| the facets document (5 facets) | captured **in full** |
| discovery lists all four CTS resources | captured — `discovery.xml`, 440 KB, 2026-08-04 |
| the item resource carries `tm:status_text`, the tree does not | captured — both bodies |
| the full tree past its **first request** | **not captured** — the probes printed a prefix; step C |
| whether several configurations mark one as default | **not answerable here** — this system has exactly one |
| whether on-prem behaves the same | **unverified** — no on-prem system is reachable from this machine |
| the legacy `/sap/bc/cts/transportrequests` payload shape | **never captured** — hence `listNodes()` throws on legacy |

### What discovery says

`/sap/bc/adt/discovery` declares four CTS resources, which is how the search endpoints were
found in the first place:

```
/sap/bc/adt/cts/transportrequests                                  "Transport Management"
    accept: application/vnd.sap.adt.transportorganizer.v1+xml      ← wrong for the collection
/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations
/sap/bc/adt/cts/transportrequests/searchconfiguration/metadata
/sap/bc/adt/cts/transportrequests/facets
```

Two things follow. Discovery **does** name the search-configuration machinery, so nothing
about this design is undocumented guesswork. And discovery's single `accept` for the
collection is the **item** type — sending it to the collection returns 406, whose body names
`transportorganizertree.v1+xml` instead. Discovery is authoritative about *what exists*, not
about *what a resource accepts*; compare [[reference_adt_no_versions_endpoint]].

### The configurations document, verbatim

```xml
<configurations:configurations>
  <configuration:configuration createdBy="…" createdAt="…" changedBy="…" changedAt="…" client="100">
    <atom:link href="…/searchconfiguration/configurations/7E5B0B99…" rel="…/configurations"
               type="application/vnd.sap.adt.configuration.v1+xml" etag="20260807095048"/>
  </configuration:configuration>
</configurations:configurations>
```

There is **no name and no default marker** — the href lives on an `atom:link` child, and the
element carries only authorship, client and etag. An earlier draft of this document put
`adtcore:name` in `ITransportSearchConfiguration`; the payload has no such attribute.

## Open questions

1. **If no saved configuration exists**, must the client create one, and with what body?
   Partly answered: discovery declares
   `/cts/transportrequests/searchconfiguration/metadata`, and it returns exactly the ten
   properties of a configuration with an `isMandatory` flag on each — a template, which is
   what a POST body would be built from:

   ```
   WorkbenchRequests, CustomizingRequests, TransportOfCopiesCreationSupported,
   Modifiable, Released, User, DateFilter, FromDate, ToDate,
   com.sap.adt.tm.facets.order
   ```

   What is **not** proven is that the collection accepts a POST. Until someone tries it on a
   system with no configuration, the contract stays "throw". Answering this can only *relax*
   the rule, never change the API shape, so it does not block implementation.
2. **Does `configUri` exist on older on-prem releases?** `e77` discovery has no transport
   organizer collection at all. Only the user's on-prem machine can answer this.
3. **Is `tm:` the only namespace in play, and is `tm:root` guaranteed as the root element?**
   Recognition is structural, so this decides what "unrecognised" means in practice. Step C.

## Related

- #105 — the request this design answers, and corrects
- #7 — added `listTransports()`; the call has never returned data
- fr0ster/mcp-abap-adt#168 / #169 — the empty-list defect downstream
