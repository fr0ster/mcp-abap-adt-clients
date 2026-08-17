# Plan: ATC runs and findings

**Spec:** `docs/superpowers/specs/2026-08-15-atc-run-and-findings.md` (approved 2026-08-17).
**Evidence:** `docs/evidence/2026-08-16-atc-trial-probe.md` (traffic),
`docs/evidence/2026-08-17-atc-objecttype-confirmed.md` (the seven confirmed types).

**Two packages, in order.** `@mcp-abap-adt/interfaces` carries the contract and must be published
before `@mcp-abap-adt/adt-clients` can consume it — no local tarball, no `file:` bridge. So this
is two PRs with a publish between them, and the second cannot start until the first is on npm.

Current: interfaces 17.0.0, adt-clients 12.0.0 (`^17.0.0`).

## What ships, in one sentence each

- **interfaces**: the ATC contract — `AtcObjectType`, `IAtcObjectRef`, `IAtcRunTarget`,
  `IAtcRunOptions`, `IAtcRunResult` (a discriminated union), `IAtcRunStatus`,
  `IAtcRunStatusReadable`, `IAtcFindings`.
- **adt-clients**: `AdtRuntimeClient.getAtc()` returning the intersection of those, implemented in
  `src/runtime/atc/`, beside the `AtcLog` that already lives there.

---

# Part one — interfaces

## Task 1 — The contract

New file `src/atc/IAtcRun.ts` (or alongside the existing `runtime/IAtcLog.ts`; the plan does not
care which, only that `IAtcLog` is not touched — it is a different resource pair and the spec says
so).

Everything the spec specifies, with its doc comments carried over rather than paraphrased. Three
of them are load-bearing and must survive review:

- **`AtcObjectType`** — the seven confirmed members, and a comment saying which system confirmed
  them and that the set is expected to grow. Nobody should build an exhaustive `Record` over it
  without having read that.
- **`IAtcRunResult`** — a discriminated union on `waited`, because the server answers two ways and
  which fields exist is decided by the request. `waited: false` documents "the server returned
  without waiting", **not** "the checks are still running".
- **`IAtcRunStatus.isFinished`** — completion, not success; `worklistId` optional; and no
  `isTerminal` or `isFailed`, because no failed run has been observed.

**No `waitForRun`, no polling helper.** A helper would have to decide when to give up, and that
belongs to whoever knows how long their checks take. The spec's reasoning goes in the doc comment
on `getRunStatus`, where a caller will actually meet it.

## Task 2 — Release interfaces

- CHANGELOG under a version the user picks — additive, so a minor unless they say otherwise;
- `npm install --package-lock-only` in the same commit;
- PR, review, merge, tag, GitHub release;
- **the user publishes.** Part two is blocked until it is on npm.

---

# Part two — adt-clients

## Task 3 — The low-level operations

`src/runtime/atc/run.ts`, taking #68's traffic and nothing else from it:

| function | request |
|---|---|
| `getCustomizing` | `GET /atc/customizing` — **GET**, the recorded `POST` is a 405 |
| `createWorklist(checkVariant)` | `POST /atc/worklists?checkVariant=…`, `Content-Type: text/plain`, `Accept: text/plain` → a bare 32-char id |
| `startRun(worklistId, uris, maximumVerdicts, wait)` | `POST /atc/runs?worklistId=…&clientWait=…` |
| `getRunStatus(runId)` | `GET /atc/runs/{runId}`, `Accept: application/vnd.sap.adt.backgroundrun.v1+xml` |
| `getWorklist(worklistId)` | `GET /atc/worklists/{id}?includeExemptedFindings=false`, `Accept: application/atc.worklist.v1+xml` |

`buildAtcObjectUri(objectType, objectName)` maps the seven confirmed types to the templates the
evidence confirms. **Not #68's map**: its `include` goes to `/programs/programs/`, and neither
`include` nor `program` is in the union at all.

## Task 4 — The handler

`src/runtime/atc/AdtAtc.ts`, implementing exactly the three capabilities and **nothing else**.

`run(target, options)`:

1. resolve the check variant — `options.checkVariant`, else `getCustomizing()`;
2. `createWorklist`;
3. `startRun` with `clientWait` from `options.wait ?? false`;
4. parse **what the mode promises**, and fail if it is absent:
   - `wait: false` → a `Location`; no `Location` is an error naming what was missing, never a
     silent fall back to the worklist id;
   - `wait: true` → `FINDING_STATS`; a missing one is an error, never `"0,0,0"`.

`getRunStatus(runId)` parses `runs:status`, sets `isFinished` on an **exact, case-normalised**
match, and takes `worklistId`/`resultId` from the atom links when they are there.

`getFindings(worklistId)` is one request, no retry, no options.

**Validation, before any request:** an empty `objects` array rejects (the tuple type stops
TypeScript callers; JavaScript ones arrive anyway), and `maximumVerdicts` must be a positive
integer — the server answers 0 with a 400, and a client that can name the problem should not
spend a round trip being told.

## Task 5 — Wire it up

`AdtRuntimeClient.getAtc()`, returning the intersection spelled at the getter:

```ts
getAtc(): IAdtRunnable<IAtcRunTarget, IAtcRunResult, IAtcRunOptions> &
  IAtcRunStatusReadable &
  IAtcFindings;
```

No new named composite: one getter has this set, and a composite earns a name when more than one
handler does. Export the types from `src/index.ts` — **the interfaces types are not re-exported**;
consumers import them from `@mcp-abap-adt/interfaces`.

## Task 6 — Tests

The capability guard walks `AdtClient` and `AdtClientLegacy`; it does not know `AdtRuntimeClient`
exists. So ATC gets its own behavioural test in the guard's shape — every method, the request it
makes, method and path — rather than the guard being extended to a dozen runtime handlers that
have no manifest entries. That larger job is worth doing and is not this.

Unit tests, against a recording connection:

1. `run()` with no `checkVariant` reads `/atc/customizing` **with GET**, and uses
   `systemCheckVariant`;
2. `run()` with `wait: false` returns `{ waited: false, runId }` taken from `Location`;
3. **`run()` with `wait: false` and no `Location` rejects**, naming what was absent — the
   silent-success shape this package removed from fifteen handlers;
4. `run()` with `wait: true` returns `{ waited: true, findingStats }` verbatim;
5. **`run()` with `wait: true` and no `FINDING_STATS` rejects** rather than defaulting to
   `"0,0,0"` — a confident zero is indistinguishable from a clean check;
6. `getRunStatus` sets `isFinished` for `finished` and **not** for `unfinished` or `not_finished`;
7. `getRunStatus` on a response without the worklist atom link still resolves, `worklistId`
   undefined;
8. an empty `objects` array rejects before any request;
9. `maximumVerdicts` of 0, -1, 1.5 and NaN reject before any request;
10. the seven `AtcObjectType` members build the URIs the evidence confirms — a table test, one
    row per type, so a changed template fails loudly.

Tests 3, 5 and 6 are the ones that keep this honest; 10 is the one that keeps it true to the
evidence. **Mutation-check each**, one at a time, breaking the thing it pins.

## Task 7 — Documentation and release

- `README.md` and `docs/` gain ATC where the runtime client is described;
- a usage example showing the two modes and the poll-until-finished loop **with a caller-chosen
  bound**, since the client offers no helper and the reason is the missing terminal state;
- CHANGELOG under a version the user picks;
- PR, review, merge, tag, release. The user publishes.

---

## What this does not do

- **`AtcObjectType` for on-prem.** `program` and `include` are refused by ABAP Cloud, so nothing
  here can confirm them. Adding them later is a **major** — exhaustive consumers break — and the
  spec says so.
- **A `waitForRun` helper.** No terminal-failure state has been observed, so a helper cannot know
  when to stop.
- **`includeExemptedFindings` as an option.** `true` was answered, but the only `false` read
  happened before a run finished and the only `true` read after, so they differ by timing rather
  than by the flag.
- **Parsing `FINDING_STATS`.** The triple is returned verbatim; one `0,0,1` beside one priority-3
  finding fits several orderings.
- **`runSync()` for ABAP Unit.** A different subject with a different endpoint. Its own spec.

## Open, and scheduled rather than forgotten

| question | who answers it |
|---|---|
| what a **failed** run reports, and where — status, worklist, execution log or check-failure logs | a trial session, `scripts/probe-atc.ts` already attempts it |
| what `withLongPolling=true` does to a run **in flight** | same; one pair of timings so far, ~200ms apart, both `running` |
| whether `includeExemptedFindings` changes a **finished** worklist | same, read both ways |
| what the `FINDING_STATS` positions mean | a worklist with findings at more than one priority |
| `program` and `include` on-prem | an on-prem system; widens the union, blocks nothing |
