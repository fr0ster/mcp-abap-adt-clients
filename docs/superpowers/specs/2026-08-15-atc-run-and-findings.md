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

```ts
// starting a run — the atom that already exists, since interfaces 16.0.0
IAdtRunnable<IAtcRunTarget, IAtcRunStarted, IAtcRunOptions>

// asking about what it produced — its own interface, as ITestRunInformation is
interface IAtcFindings {
  getFindings(worklistId: string, options?: IAtcFindingsOptions): Promise<IAdtResponse>;
}
```

`run()` returns the worklist id, because that is what identifies the run — see "no run id" below.
Retrying for the artifact belongs inside `run()` only if `run()` is defined as "start and wait";
otherwise it belongs to the caller. **Decide this when writing the plan**, and state which:
`ClassExecutor` chose "start and wait" (`runWithProfiling` returns the resolved trace), and the
symmetry argues for the same here.

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

## Object coverage

`buildAtcObjectUri` in #68 maps `class`, `interface`, `program`, `include`, `function_group`,
`package`. Whether that is ATC's full checkable set or just what the author needed is unknown.
Anything the map does not cover cannot be checked, so the set is part of the contract and should
be stated rather than inherited.

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

1. **Does `run()` wait?** Start-and-wait (as `runWithProfiling` does) or start-and-return.
2. **Retry defaults.** `ClassExecutor` uses 5 attempts × 2000 ms as call parameters with
   defaults. #68 hardcodes 75 × 4000 ms — five minutes of silence — in the module, justified by
   a comment citing an unnamed Java reference. Take the former's shape; pick the numbers.
3. **On-prem behaviour.** Needs a probe from a machine that reaches an on-prem system; this one
   reaches cloud only.
4. **Object coverage** — the checkable set, above.
