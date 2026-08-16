# ATC: start a run, then look for the result

**Status:** blocked on a probe, 2026-08-15. The shape is agreed and the synchronous contract is
all but complete — **three** facts nobody has captured still bear on it, and so does the whole
question of waiting. The traffic table is being re-verified too: one of its rows disagreed with
#68 and #68 was right, so the probe re-issues the rest rather than trusting a single unrepeatable
session — and re-verifying it is what turned two of its rows back into open contract questions.
See "The probes that unblock this". Not implemented.

**Scope:** an ATC client in `@mcp-abap-adt/adt-clients`, and the contract it needs in
`@mcp-abap-adt/interfaces`. The MCP server is a separate consumer and out of scope here.

## Where this comes from

Three outside-contributor PRs propose ATC support and none can be merged: they were written in
July against `adt-clients` ~10.x and `interfaces` ~11.x, and both packages have since gone
through the capability-narrowing series (interfaces 15.0.0–17.0.0, adt-clients 11.1.0–12.0.0).

- `mcp-abap-adt-clients` **#68** — `AdtAtc` + a synchronous ABAP Unit runner. The ATC part is
  four files, ~740 lines; the rest of its 11k-line diff is merge noise from a migration that has
  since landed for real.
- `mcp-abap-adt-interfaces` **#17** — six low-level parameter types.
- `mcp-abap-adt` **#147** — five MCP tools. Depends on #68 and does not compile against anything
  released.

What is worth keeping from them is the **ADT traffic** — the URLs, the headers, the payload
shapes. What is not worth keeping is the API they wrapped it in.

## The shape: this is profiling, not CRUD

**An ATC run is the same shape as a profiled execution** — start a process, then look for the
result it produces. That is why this is not a CRUD object, and it is the whole of what the
analogy gives. An earlier draft claimed it also settled whether ATC is synchronous; it does not,
and the two sections below say why — the analogy breaks exactly where completion is concerned,
which is why waiting is left undesigned.

`ClassExecutor.runWithProfiling` (`src/executors/class/ClassExecutor.ts:86-125`) already does
this. It does **not** poll a status resource, because none exists; it retries fetching the
**artifact** until the artifact is there:

```ts
// SAP writes traces asynchronously — poll until the trace file appears
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const result = await this.tryResolveTrace(lookupUris, profilerId, ...);
  if (result) return result;
  await delay(retryDelayMs);
}
```

### Where the analogy breaks, and what replaces it

A profiled execution's artifact **does not exist until the run is done**, so its appearance *is*
the completion signal. An ATC worklist does not work that way: it is created by a request of its
own **before** the run (`POST /atc/worklists`, then `POST /atc/runs?worklistId=`). So
`GET /atc/worklists/{id}` succeeds immediately, and an empty answer is ambiguous — it means
either "the run found nothing" or "the run is not finished". **A clean result and an unfinished
one are the same bytes**, which makes "retry until the artifact is there" wrong for ATC as
stated. Raised in review, 2026-08-15.

What replaces it is the server's own count. The run response is
`<atcworklist:worklistRun>` carrying the worklist id **and `FINDING_STATS`** — a comma triple in
its `description`, e.g. `0,0,1` (probed on the trial; which position is which severity is
**not** established). So the run tells you how many findings to expect, and the readiness test is
not "are there findings" but "does the worklist carry as many as the run said". Zero expected and
zero present is then a decided answer rather than an ambiguous one.

Two things must be probed before this is more than a design:

1. **Are `FINDING_STATS` present and populated on a system where the run is asynchronous?** If
   the count only arrives once the run has finished, it is the readiness marker and nothing else
   is needed. If it comes back zeroed while work continues, it is not, and the marker has to come
   from somewhere else — a status attribute on the worklist, or the on-prem run resource.
2. **`clientWait`.** #68 passes `clientWait=false` (`run.ts`, the runs URL) without saying what
   `true` does. The name suggests the server holds the request until the run completes, which
   would remove the question entirely on systems that honour it.

Until one of those is answered, the retry loop is a guess with a default, and the spec says so
rather than implying otherwise.

An earlier draft of this spec claimed retrying the fetch "survives both answers" and that no
status resource is needed. That was wrong for the reason above, and is struck: a retried `GET`
can see the same empty pre-run worklist every time and prove nothing. Retrying is not a readiness
rule when the artifact predates the work. Raised in review twice, 2026-08-15 — the second time
because the paragraph was left standing next to the analysis that refuted it.

## The contract

Two capabilities, not a CRUD object.

**`run()` starts a run and returns what the server answered. It does not wait.** Two drafts of
this spec had it waiting, and both were unimplementable for the same reason: waiting needs a
signal that says "finished", and no such signal has been observed. `FINDING_STATS` is a
candidate and `clientWait` is a lead, but a contract cannot promise to wait for something nobody
has watched arrive.

```ts
// starting a run — the atom that exists since interfaces 16.0.0
IAdtRunnable<IAtcRunTarget, IAtcRunResult, IAtcRunOptions>

// reading a worklist — its own interface, as ITestRunInformation is
interface IAtcFindings {
  getFindings(worklistId: string): Promise<IAdtResponse>;
}
```

- `run(target, options)` creates the worklist, starts the run, and returns `IAtcRunResult` — the
  worklist id and the `FINDING_STATS` the run response carried. Nothing more: those two are what
  the server hands back, and both were observed.

**How many findings a run may return.** The payload carries `maximumVerdicts="N"`, so `run()`
cannot build its request without a number. `IAtcRunOptions.maximumVerdicts` is optional and
defaults to **100** — the value #68 uses in both its call sites, which is the only number anyone
has run against a real system. It is a cap on results, not a page size: nothing observed says
what happens at the boundary, so a caller wanting everything raises it rather than paging, and
the default being a cap is worth saying in the method's documentation rather than leaving a
caller to discover a truncated worklist.

**Where the check variant comes from.** `POST /atc/worklists` requires one, so `run()` cannot
proceed without deciding this. `IAtcRunOptions.checkVariant` is optional; when the caller omits
it, the client reads `GET /atc/customizing` and uses `systemCheckVariant`. That is not a
convenience — on the trial `/atc/variants` returns `totalItemCount 0`, so customizing is the only
observed source of a usable variant, and a contract that demanded the caller supply one would be
unusable there. The read happens per `run()` call; caching it is an optimisation nobody has
measured a need for, and a cached variant is wrong the moment the system's default changes.

**The verb here is #68's, not a captured one**, and that makes this paragraph provisional in a
way the rest of the contract is not. The `GET` comes from code that ran; the `POST` this replaced
came from the session whose other rows are now being re-read. The probe sends both. If only
`POST` answers, one word changes here. If **neither** answers — if `systemCheckVariant` is not
readable on a system — then `checkVariant` cannot be optional at all, because the fallback it
falls back to does not exist, and `IAtcRunOptions.checkVariant` becomes required. That is a
change to the published type, not to a sentence, which is why this sits on the blocking list.

**What `IAtcRunResult` carries.** The worklist id, and the finding statistics **as the server
sent them** — the raw `description` string, e.g. `"0,0,1"`:

```ts
interface IAtcRunResult {
  worklistId: string;
  /**
   * `FINDING_STATS` from the run response, verbatim — a comma-separated triple.
   * Not parsed into named counts: which position is which severity has not been
   * established, and inventing `{ errors, warnings, infos }` would put three
   * guesses into a public type. Parse it when a probe says what it means.
   */
  findingStats: string;
}
```
- `getFindings(worklistId)` reads the worklist. One request, no retry, no options.

```ts
interface IAtcRunOptions {
  /**
   * The check variant to run. Omitted, the client reads `/atc/customizing` and
   * uses `systemCheckVariant` — see below.
   */
  checkVariant?: string;
  /**
   * `maximumVerdicts` in the run payload: a **cap on results**, not a page size.
   * Defaults to 100. A positive integer — it is serialised straight into an XML
   * attribute, so `run()` rejects 0, a negative, a fraction and NaN rather than
   * sending them and letting the server decide. The server's own bounds are
   * unknown; see the probe.
   */
  maximumVerdicts?: number;
}

```

**`getFindings` takes no options**, and there is no `IAtcFindingsOptions`.

The obvious candidate was `includeExemptedFindings`, and publishing it as a boolean would promise
that `true` works — while the only request anyone has made carries `false`. That is exactly what
this package's own rule forbids: **do not publish an option nobody has seen answered.** A
previous revision stated that rule and broke it in the same breath; caught in review,
2026-08-15. The request sends `includeExemptedFindings=false`, the observed form, and `true`
joins the probe list.

`format` is out for a stronger reason: `checkstyle` was answered with a **406** and one accepted
type, so the option would offer a choice that does not exist. The timestamp and object-set
filters ADT documents appear in no captured response here.

On the only system anyone has probed this is complete: the run returns finished counts, so a
caller runs and then reads, and gets a correct answer including a correct zero. That is the whole
of what is known to work, and it is what this spec designs.

**No retry, no `withLongPolling`, no status method** — not because ATC is known to be
synchronous everywhere, but because the opposite is unobserved, and a retry loop with no
readiness rule is a race with a timeout on it. If a probe finds an asynchronous system, waiting
is added **then**, against whatever marker that probe shows — as an option on `run()` or a
separate `runAndCollect`, decided on the evidence rather than ahead of it.

### What the contract must not have

`AdtAtc` in #68 declares `IAdtObject` — all ten methods, six of which throw
(`src/core/atc/AdtAtc.ts:422-457`), plus `getVersions`/`getVersionSource` calling
`throwUnsupportedVersions` (lines 587-593). That is precisely the pattern adt-clients 12.0.0
deleted from fifteen handlers. A check run is not created, updated, locked, activated or
versioned; it is run, and then read.

`readTransport()` there (lines 444-446) does not even throw — it returns `{ errors: [] }`, which
reads to a caller as success. Three defects of exactly that shape were fixed in 12.0.0.

## The ADT traffic

Recorded from the **cloud trial**, 2026-07-20 — one session, and see the correction under it:

| step | request |
|---|---|
| variant | `GET /sap/bc/adt/atc/customizing` → `systemCheckVariant` (trial: `ABAP_CLOUD_DEVELOPMENT_DEFAULT`) — **verb corrected**, see below |
| worklist | `POST /sap/bc/adt/atc/worklists?checkVariant=<X>`, `Accept: text/plain` → a bare 32-char id |
| run | `POST /sap/bc/adt/atc/runs?worklistId=<id>` with `<atc:run maximumVerdicts="N"><objectSets><objectSet kind="inclusive"><adtcore:objectReferences>…` → `<atcworklist:worklistRun>` carrying **the same worklist id** and `FINDING_STATS` |
| findings | `GET /sap/bc/adt/atc/worklists/<id>`, `Accept: application/atc.worklist.v1+xml` |

Three things that session recorded, each contradicting something the PRs assume — held as
recorded, not as established, for the reason under the table:

- **There is no separate run id.** The run response echoes the worklist id. `IGetAtcRunStatusParams
  { run_id }` in #17, and `extractAtcRunId` reading the `Location` header in #68, describe
  something the trial does not have.
- **There is no run-status resource.** `withLongPolling` has nothing to poll.
- **`checkstyle` is not a format.** `GET /atc/worklists` with a checkstyle `Accept` → **406**,
  one accepted type. `AtcFindingsFormat = 'xml' | 'checkstyle'` in #17 is half wrong.

`/sap/bc/adt/atc/variants` returns `totalItemCount 0` on the trial, so listing variants is not a
substitute for reading customizing.

**The customizing verb was wrong here until 2026-08-15.** This table read `POST /atc/customizing`;
#68 sends `GET` (`run.ts`, `getAtcCustomizing`). Both cannot be what was observed, and the table's
own claim — "each line from a server response" — is what makes the contradiction worth naming
rather than quietly editing. #68 is the better-attested of the two: it is code that ran against a
system, while the `POST` was recorded from a session nobody can now re-read. So the spec follows
`GET`, and the probe sends **both** and keeps whichever answers. If `POST` also works, this note
is the only thing that needs deleting.

And the consequence is not confined to that row. Every line of this table came from the **same
2026-07-20 session**, and one of them was wrong. That does not make the other three false — it
makes them all *one* source, uncorroborated, and "probed live" a weaker phrase here than it
reads. The three facts below are the ones #68 contradicts, so the probe re-issues each of them
rather than treating the table as settled:

- no separate run id (vs `extractAtcRunId` from `Location`);
- no run-status resource (vs polling `/atc/runs/{id}`);
- `checkstyle` refused with 406 (vs `AtcFindingsFormat`).

#68 asserts the opposite of all three on **on-prem** S/4HANA 2023. Both can be true at once —
that is the on-prem question, not a contradiction — but only once the cloud half is re-read from
a response rather than from this table.

**Unverified**: #68 claims an end-to-end run on S/4HANA 2023 (SAP_BASIS 758) with the async
`/atc/runs/{id}` path. No captured request or response accompanies the diff. The two claims are
not necessarily in conflict — ATC may differ between cloud and on-prem, as the transport list
does — but until someone probes on-prem, the async path is a claim, not a fact, and the design
above deliberately does not depend on which is true.

## The target: a set, not one object

The run payload nests `<adtcore:objectReferences>` — **plural**, inside an `objectSet` that is
itself one of `<objectSets>`. A contract taking a single object would impose a limit ADT does not
have, and would have to be broken later to lift it. Raised in review, 2026-08-15.

```ts
interface IAtcObjectRef {
  /** The kinds whose ADT URI this package can build — see below. */
  objectType: AtcObjectType;
  objectName: string;
}

interface IAtcRunTarget {
  /**
   * One or more objects to check, as one inclusive object set.
   *
   * A non-empty tuple, not an array: "one or more" in a doc comment over a type
   * that admits `[]` is a promise the compiler does not keep, and an empty
   * object set would start a run over nothing. `run()` also rejects an empty
   * array at runtime, for callers who arrive from JavaScript.
   */
  objects: readonly [IAtcObjectRef, ...IAtcObjectRef[]];
}
```

Exclusive object sets (`kind` is an attribute, so other values exist) are **not** in this
contract: nothing has established what they accept, and a field nobody has seen answered is the
kind of promise this package spent three releases removing.

```ts
// Blocked: the members are what the probe returns, not what #68 inherited.
type AtcObjectType = /* the confirmed set — see below */ never;
```

`AtcObjectType` is the set whose ADT URI can be built, and **it is the one part of the
synchronous contract that cannot be decided from here.** #68 maps `class`, `interface`,
`program`, `include`, `function_group`, `package` (`buildAtcObjectUri`); whether that is ATC's
checkable set, a subset, or partly wrong is unknown, and an object type absent from the map
cannot be checked at all. It is a contract decision, not an implementation detail — a published
union is a promise about which objects this package can check.

Two things already known about that mapping, before any run:

- **`include` is mapped two different ways in the two codebases.** #68 sends includes to
  `/sap/bc/adt/programs/programs/{name}`; this library builds `/sap/bc/adt/programs/includes/`
  for includes everywhere else. They cannot both be the ATC-checkable URI, and picking by
  preference would be a guess, so the probe runs **both**.
- **Three of the types the spec wants measured are not in #68 at all.** DDL source, table and
  behavior definition have no entry in `buildAtcObjectUri`, so they cannot be checked through
  #68 even if ATC accepts them. The probe proposes the template this library already uses for
  each and runs it, which is the only way they can join the union.

**Blocked on the probe below.** Ship the confirmed set, not the inherited one.

## What goes in `interfaces`

- the parameter types from #17, corrected: no `run_id`, no `with_long_polling`, no `checkstyle`;
- `IAtcRunTarget` / `IAtcObjectRef` / `IAtcRunResult` / `IAtcRunOptions`;
- `IAtcFindings` — and **nothing** composing it with `IAdtRunnable`: the getter spells that
  intersection itself.

`IAtcLog` already in the package (`runtime/IAtcLog.ts`) is **not** this: it reads a check-failure
or execution **log** by `executionId`, a diagnostic-log sibling of `IApplicationLog`. Different
endpoints, no shared field. Whether `/atc/results/{executionId}/log` and `/atc/worklists/{id}`
are the same resource under two ids is unverified.

One release, both packages, cut when the work is done — the rule the last three interfaces
releases were cut against.

## Which systems this is for

**Everything here was observed on the cloud trial, and nothing on-prem has been captured.** The
requests are the same either way — the URLs and payloads are not in question — but the *shape of
the answers* is, and #68 claims an on-prem run response this spec has never seen.

The handler does **not** gate on environment. `isCloudEnvironment()` exists, but refusing to run
where the traffic is probably identical would be a guess in the other direction, and a
cloud-only ATC is a promise about on-prem that nobody has earned either.

What it does instead is refuse to invent: **`run()` parses the run response, and if the response
does not carry what it expects, it fails rather than defaulting.** A missing `FINDING_STATS`
becomes an error naming what was absent — not `findingStats: "0,0,0"`, and not an empty result.
The dangerous outcome on an unverified system is not an exception; it is a confident zero, which
is indistinguishable from a clean check. Every silent-success defect this package fixed in
12.0.0 had that shape.

So: **verified on cloud, unverified on-prem, honest on both** — and the on-prem probe below is
what would turn the second half of that sentence into a fact.

## Where this lives

**`AdtRuntimeClient.getAtc()`, in `src/runtime/atc/`, beside `AtcLog`.** Not `AdtClient`: that
client hands out per-object CRUD handlers, and a check run is not an ADT object — the same reason
`getProfiler()`, `getDumps()` and `getAtcLog()` are on the runtime client. Running checks and
reading findings is runtime analysis, and it belongs where the profiler traces and the ATC
**logs** already are.

Not an extension of `AtcLog` either: that reads a check-failure or execution log by
`executionId`, this runs checks and reads a worklist. Same subject, different resources, and one
handler holding both would have halves with nothing to do with each other.

**This decides what the capability guard covers**, which a previous revision got wrong by
asserting the guard applies. `src/__tests__/unit/capabilities/` walks `AdtClient` and
`AdtClientLegacy`; it does not know `AdtRuntimeClient` exists, and no runtime handler is in its
manifest. An ATC handler placed there is **not** covered, and claiming otherwise would have been
false. Raised in review, 2026-08-15.

The plan picks one of two, with a reason rather than by inheriting this sentence:

- **extend the completeness check to `AdtRuntimeClient`** — correct, and it immediately demands
  manifest entries for a dozen runtime handlers that have none. A larger job than this feature.
- **give ATC its own behavioural test in the guard's shape** — every method, the request it
  makes, method and path. Proportionate, and it leaves the runtime client uncovered as it is
  today.

The second is what this spec expects; the first is worth doing and is not this.

### What `getAtc()` returns

The intersection, spelled at the getter — no new named composite:

```ts
getAtc(): IAdtRunnable<IAtcRunTarget, IAtcRunResult, IAtcRunOptions> & IAtcFindings;
```

The precedent, counted rather than asserted: of `AdtClient`'s 37 getters, **13 spell an
intersection and 24 return a single named type** — mostly `IAdtSourceObject`, which names a set
several handlers share exactly. So the rule is not "always inline"; it is that a composite earns
a name when more than one handler has that set. ATC's is used by one getter, so a third name over
two types that already have one would buy nothing. `IAtcLog` beside it is named because it
declares its own methods, which this does not.

(An earlier revision said "all 36 getters", which is simply false — corrected in review,
2026-08-15.)

That rule is stated here and followed here, but it is **not** yet true of the client as a whole:
the same count found five different kinds of return type across the 37 getters, two of them
concrete classes. Making them one is
[issue #109](https://github.com/fr0ster/mcp-abap-adt-clients/issues/109) — a separate,
breaking pass with its own spec. ATC conforms to the rule so it adds nothing to that pile; it
does not clean it either, and this spec does not wait for it.

The concrete class is not the return type. A consumer never names `AdtAtc`, and returning it
would hand out whatever else the class happens to carry — the exact gap the capability guard
exists to close on the other client.

## Deliberately not in scope

**`runSync()`** — #68 also adds a synchronous ABAP Unit runner: one `POST /abapunit/testruns`
with `<aunit:runConfiguration>` keyed by object reference, returning the full result. Its
motivation is that the async `/abapunit/runs` path fails on 7.5x backends. Nothing on `main` can
reach that endpoint, so it is additive and worth having — but it is a different subject with a
different endpoint, and mixing it into ATC is what made #68 an 11k-line diff. Its own spec.

## What is not designed here

**Waiting for an asynchronous run.** It needs a completion marker, no marker has been observed,
and two drafts of this spec tried to reason one into existence — first from the artifact
appearing, then from a count whose timing is unknown. The third answer is to design for what was
seen and to leave the rest to a probe. A consumer that needs "run and collect" today composes
`run()` and `getFindings()` itself, and on the probed system that is correct.

## The probes that unblock this

**Two systems, and the trial cannot stand in for the other.** A previous revision claimed one
session against the trial "answers everything still open"; it cannot. On a system where the run
comes back finished, `clientWait=true` changes nothing observable, and there is no interval in
which to catch an unfinished worklist. Waiting can only be studied where the run is actually
asynchronous — which is on-prem, where it is claimed and unverified. Raised in review,
2026-08-15.

### On the trial — closes the synchronous contract

Credentials for this exist; the run is synchronous there, which is exactly why it can settle the
contract and nothing about waiting.

`scripts/probe-atc.ts` runs every ask below in one session and writes each request and response
to disk verbatim (`--out=atc-probe`). Three things make it a measurement rather than a
confirmation, each added after review, 2026-08-15:

- **It runs the URI a client would build, not the one ADT handed back.** The contract takes
  `objectType` + `objectName`, so the client must build the URI — which makes the *template* the
  thing under test. An earlier version took the package listing's URI, which would have proved a
  ready-made URI is checkable and said nothing about the mapping. ADT's own URI is run too, but
  only where it differs from the built one, so the difference gets measured.
- **The candidate list is required, not discovered.** It probes #68's six plus the three above,
  and a candidate with no representative object in the package is reported as **unmeasured**,
  named in the manifest, and exits non-zero. Taking whatever a package happened to contain meant
  a package with no interface would have finished green with the blocker still open.
- **It asks the run-id question with the right id.** The disputed claim is #68's separate run id
  from `Location`, so the probe reads the run response's headers and fetches *that*; a 404 for
  the worklist id proves nothing about it. Both are fetched, as separate steps.

It also sends a URI that cannot exist **and reads that worklist back like any other**. The read
is the control, not the send: if the bogus run and a real one both answer 200, only the two
worklists separate "ATC checked this object" from "ATC accepted anything and checked nothing".
Raised in review, 2026-08-16 — the control ran without its read until then, which made it a
gesture.

One ask it can only answer if told where to look: **what the `FINDING_STATS` positions mean**
needs a run that found something. The probe picks representatives by type, not by being dirty, so
they may all be clean — and `0,0,0` reads identically in every severity ordering. Pass
`--known-bad=class:ZCL_SOMETHING_DIRTY` to point it at an object that fails its checks; without
one the probe reports the positions as undecoded rather than letting three zeroes pass for an
answer.

**Blocking — each of these decides something the contract already states, so the contract is not
final until they answer:**

| ask | what it decides |
|---|---|
| run one object of **each** kind #68 lists, and the three it does not (DDL source, table, behavior definition), **at the URI a client builds** — plus both `include` templates | `AtcObjectType`, and which include URI ATC takes |
| `GET` **and** `POST /atc/customizing` | which verb reads the check variant. The contract says `GET`, on #68's authority against a recorded `POST`. If only `POST` answers, the contract is wrong as written — and if neither does, `checkVariant` cannot be optional at all |
| the run response's **headers**, whole | whether a run has an id of its own. #68 reads one from `Location`; the recorded session says the body echoes the worklist id. If a usable run id exists, `IAtcRunResult` has to carry it, and `run()` returning only a worklist id would be losing something the server gave |

**Not blocking — improvements that can join the contract once answered:**

| ask | what it would add |
|---|---|
| the run response, captured whole, **with known findings present** | what the `FINDING_STATS` positions mean. The contract returns the triple verbatim precisely so it does not need to know, which is what keeps this off the blocking list — but a clean object answers nothing, so the probe needs a known-bad one (`--known-bad=type:NAME`) |
| `GET /atc/worklists/{id}?includeExemptedFindings=true` | whether that option exists at all — it stays out of the contract until answered |
| `maximumVerdicts` at its edges — 0, 1, something enormous | the server's bounds, which nothing states, and so whether `run()` should validate a range |

An earlier revision called the object set "the only thing blocking the synchronous contract".
That stopped being true the moment the traffic table's provenance was downgraded: two of its rows
are things the contract asserts, and re-verifying them can refute them. Raised in review,
2026-08-16.

### On an on-prem system — decides whether waiting is designed at all

Nothing here can be answered from the cloud trial, and this machine reaches cloud only, so it
needs the on-prem route (a run from a machine that reaches one).

| ask | why |
|---|---|
| does `POST /atc/runs` return before the checks finish? | the whole premise of waiting. If it does not, waiting is never designed and this spec is complete as written |
| `GET /atc/runs/{id}` — a real status resource, or 404? | #68 built its polling on this. The trial's recorded 404 does not settle it even for the trial: which id was fetched was never written down, and a 404 for the worklist id says nothing about a run id from `Location` |
| `POST /atc/runs?...&clientWait=true` | whether the server will simply hold the request, which would answer the question by removing it |
| a worklist read **between** start and completion | whether an unfinished worklist is distinguishable from an empty result at all — the thing that made two drafts of this spec wrong |

Until that second probe happens, `run()` stays start-only, and that is a decision rather than an
omission.

## Open questions

Four, and each belongs to one of the probes above rather than to another round of design.

1. **The checkable object set** — `AtcObjectType`. The trial answers it.
2. **Which verb reads the check variant.** The contract says `GET`; the trial answers it, and can
   refute it.
3. **Whether a run has an id of its own.** If it does, `IAtcRunResult` carries it; the trial
   answers it, from the run response's headers.
4. **Whether ATC is ever asynchronous, and what marks a run finished.** Decides only whether
   waiting is designed; needs an on-prem system, and until then `run()` is start-only by
   decision.

The first three are the synchronous contract, and the trial closes all three in one session.

Everything else this spec once listed here has been decided in the text: the finding statistics,
`maximumVerdicts`, the target's shape, where the handler lives, and what the accessor returns.
