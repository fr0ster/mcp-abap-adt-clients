# ATC: start a run, then look for the result

**Status:** design agreed 2026-08-15. Not implemented.

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

That form survives both answers to the question nobody has settled:

| | run is synchronous (cloud trial, probed 2026-07-20) | run is asynchronous (on-prem, claimed by #68) |
|---|---|---|
| status resource | `GET /atc/runs/{id}` → **404**, `GET /atc/runs` → **405** | claimed to exist |
| artifact retry | finds findings on the first attempt | finds them on a later one |

So the client does not branch on system type, and does not need a status method at all. **Not
knowing whether ATC is asynchronous stops being a blocker; it becomes a default for the retry
count.**

## The contract

Two capabilities, not a CRUD object.

**`run()` starts and waits, and returns the findings.** Decided here rather than left to the
plan, because it fixes the generic parameters, the retry options and what `getFindings` is for —
review was right that these cannot be separated:

```ts
// starting a run and getting its result — the atom that exists since interfaces 16.0.0
IAdtRunnable<IAtcRunTarget, IAtcRunResult, IAtcRunOptions>

// reading a worklist that already exists — its own interface, as ITestRunInformation is
interface IAtcFindings {
  getFindings(worklistId: string, options?: IAtcFindingsOptions): Promise<IAdtResponse>;
}
```

- `run(target, options)` creates the worklist, starts the run, waits until the worklist carries
  what the run said it would, and returns `IAtcRunResult` — the worklist id, the counts, and the
  findings. `options` carries the retry bounds, as `runWithProfiling`'s do.
- `getFindings(worklistId)` reads a worklist and returns; it does **not** wait. Its purpose is a
  worklist that already exists — they persist, and re-reading yesterday's run is a real use.

The alternative — `run()` returns an id and the caller polls — was rejected for the reason the
profiler was: it makes every caller reimplement the readiness rule, and the readiness rule is the
part that needs the server's own count to be correct.

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

`AtcObjectType` is the set whose ADT URI can be built. #68 maps `class`, `interface`, `program`,
`include`, `function_group`, `package` (`buildAtcObjectUri`). Whether that is ATC's checkable set
or just what its author needed is **unknown**, and it is a contract decision rather than an
implementation detail: an object type absent from the map cannot be checked at all. Confirm the
set against a live system before fixing it; ship the confirmed set, not the inherited one.

## What goes in `interfaces`

- the parameter types from #17, corrected: no `run_id`, no `with_long_polling`, no `checkstyle`;
- `IAtcRunTarget` / `IAtcRunStarted` / `IAtcRunOptions` / `IAtcFindingsOptions`;
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

## Open questions

1. **What marks a run finished?** `FINDING_STATS` from the run response is the candidate, and
   it needs the two probes above — is it populated before the work is done, and does `clientWait`
   make the question moot. Until then the retry loop is a guess.
2. **Retry defaults.** `ClassExecutor` uses 5 attempts × 2000 ms as call parameters with
   defaults. #68 hardcodes 75 × 4000 ms — five minutes of silence — in the module, justified by
   a comment citing an unnamed Java reference. Take the former's shape; pick the numbers.
3. **On-prem behaviour.** Needs a probe from a machine that reaches an on-prem system; this one
   reaches cloud only.
4. **Object coverage** — the checkable set, above.
