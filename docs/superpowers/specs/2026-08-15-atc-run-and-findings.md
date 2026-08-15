# ATC: start a run, then look for the result

**Status:** blocked on a probe, 2026-08-15. The shape is agreed and the synchronous contract is
all but complete — one part of it, the set of checkable object types, is a fact nobody has
captured, and so is the whole question of waiting. See "The probe that unblocks this". Not
implemented.

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

The decisive observation, and the thing that settles an otherwise blocking disagreement about
whether ATC is synchronous: **an ATC run is the same shape as a profiled execution** — start a
process, then look for the result it produces.

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
  getFindings(worklistId: string, options?: IAtcFindingsOptions): Promise<IAdtResponse>;
}
```

- `run(target, options)` creates the worklist, starts the run, and returns `IAtcRunResult` — the
  worklist id and the `FINDING_STATS` the run response carried. Nothing more: those two are what
  the server hands back, and both were observed.

**Where the check variant comes from.** `POST /atc/worklists` requires one, so `run()` cannot
proceed without deciding this. `IAtcRunOptions.checkVariant` is optional; when the caller omits
it, the client reads `POST /atc/customizing` and uses `systemCheckVariant`. That is not a
convenience — on the trial `/atc/variants` returns `totalItemCount 0`, so customizing is the only
observed source of a usable variant, and a contract that demanded the caller supply one would be
unusable there. The read happens per `run()` call; caching it is an optimisation nobody has
measured a need for, and a cached variant is wrong the moment the system's default changes.

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
- `getFindings(worklistId, options)` reads the worklist. One request, no retry.

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

Probed live on the **cloud trial**, 2026-07-20 — each line from a server response:

| step | request |
|---|---|
| variant | `POST /sap/bc/adt/atc/customizing` → `systemCheckVariant` (trial: `ABAP_CLOUD_DEVELOPMENT_DEFAULT`) |
| worklist | `POST /sap/bc/adt/atc/worklists?checkVariant=<X>`, `Accept: text/plain` → a bare 32-char id |
| run | `POST /sap/bc/adt/atc/runs?worklistId=<id>` with `<atc:run maximumVerdicts="N"><objectSets><objectSet kind="inclusive"><adtcore:objectReferences>…` → `<atcworklist:worklistRun>` carrying **the same worklist id** and `FINDING_STATS` |
| findings | `GET /sap/bc/adt/atc/worklists/<id>`, `Accept: application/atc.worklist.v1+xml` |

Three facts established there, each of which contradicts something the PRs assume:

- **There is no separate run id.** The run response echoes the worklist id. `IGetAtcRunStatusParams
  { run_id }` in #17, and `extractAtcRunId` reading the `Location` header in #68, describe
  something the trial does not have.
- **There is no run-status resource.** `withLongPolling` has nothing to poll.
- **`checkstyle` is not a format.** `GET /atc/worklists` with a checkstyle `Accept` → **406**,
  one accepted type. `AtcFindingsFormat = 'xml' | 'checkstyle'` in #17 is half wrong.

`/sap/bc/adt/atc/variants` returns `totalItemCount 0` on the trial, so listing variants is not a
substitute for reading customizing.

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
  /** One or more objects to check, as one inclusive object set. */
  objects: readonly IAtcObjectRef[];
}
```

Exclusive object sets (`kind` is an attribute, so other values exist) are **not** in this
contract: nothing has established what they accept, and a field nobody has seen answered is the
kind of promise this package spent three releases removing.

`AtcObjectType` is the set whose ADT URI can be built, and **it is the one part of the
synchronous contract that cannot be decided from here.** #68 maps `class`, `interface`,
`program`, `include`, `function_group`, `package` (`buildAtcObjectUri`); whether that is ATC's
checkable set, a subset, or partly wrong is unknown, and an object type absent from the map
cannot be checked at all. It is a contract decision, not an implementation detail — a published
union is a promise about which objects this package can check.

**Blocked on the probe below.** Ship the confirmed set, not the inherited one.

## What goes in `interfaces`

- the parameter types from #17, corrected: no `run_id`, no `with_long_polling`, no `checkstyle`;
- `IAtcRunTarget` / `IAtcObjectRef` / `IAtcRunResult` / `IAtcRunOptions` / `IAtcFindingsOptions`;
- `IAtcFindings`.

`IAtcLog` already in the package (`runtime/IAtcLog.ts`) is **not** this: it reads a check-failure
or execution **log** by `executionId`, a diagnostic-log sibling of `IApplicationLog`. Different
endpoints, no shared field. Whether `/atc/results/{executionId}/log` and `/atc/worklists/{id}`
are the same resource under two ids is unverified.

One release, both packages, cut when the work is done — the rule the last three interfaces
releases were cut against.

## The guard applies

Any new handler joins `src/__tests__/unit/capabilities/manifest.ts`: its factory, its config, the
capabilities it claims, and the **request each method makes** — method and path, the whole chain.
The completeness check fails on a factory with no entry, so this is not optional. An ATC entry
claims `runnable` and its findings capability, and nothing else.

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

## The probe that unblocks this

One session against the trial answers everything still open, and until it happens further design
rounds produce findings rather than progress — three of them so far have.

| ask | why it blocks something |
|---|---|
| `POST /atc/customizing` → is `systemCheckVariant` there, and usable as `checkVariant`? | `run()`'s first request depends on it |
| the run response, captured whole | `FINDING_STATS` positions — what a triple like `0,1,2` means with known findings present |
| run one object of **each** kind #68 lists, and a few it does not (DDL source, table, behavior definition) | fixes `AtcObjectType`, the last undecided part of the contract |
| `POST /atc/runs?...&clientWait=true` | the lead on waiting; `false` is what #68 sends, unexplained |
| a worklist read **between** starting a run and its completion, if a run can be made slow enough | the only way to see whether an unfinished worklist is distinguishable |

The first three close the synchronous contract. The last two decide whether waiting is designed
at all.

## Open questions

1. **What marks a run finished?** Unanswered, and the reason `run()` does not wait.
   `FINDING_STATS` is the candidate — is it populated before the work is done? — and `clientWait`
   is the lead: #68 passes `false` without saying what `true` does. **This is the probe that
   unblocks waiting**, and nothing else in the spec depends on it.
3. **On-prem behaviour.** Needs a probe from a machine that reaches an on-prem system; this one
   reaches cloud only.
4. **Object coverage** — the checkable set, above.
