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

**File: `src/runtime/IAtcRun.ts`.** Not a choice left to whoever executes this — an earlier draft
offered two locations and said it did not care, while the location decides the module category and
which barrel entry the contract appears under. Raised in review, 2026-08-17.

`src/runtime/` is where `IAtcLog.ts` already lives, alongside `IProfiler`, `IRuntimeDumps` and the
rest of the runtime-analysis contracts — which is what a check run is, and is why the handler goes
on `AdtRuntimeClient`. `IAtcLog.ts` itself is **not touched**: it is a different pair of resources
and the spec says so.

**Export, in `src/index.ts`, in the same shape as its neighbours** — an explicit named list, not a
star:

```ts
export type {
  AtcObjectType,
  IAtcFindings,
  IAtcObjectRef,
  IAtcRunOptions,
  IAtcRunResult,
  IAtcRunStatus,
  IAtcRunStatusReadable,
  IAtcRunTarget,
} from './runtime/IAtcRun';
```

placed beside the existing `from './runtime/IAtcLog'` block, so the two ATC contracts read as
neighbours without one importing the other.

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

**The headers are part of the request, not decoration** — see the table in Task 6, which is the
one place they are written verbatim. This table names the paths; where it repeats a header it
repeats it from there, because an implementation written to a paraphrase here would fail the test
written to the captures there. That happened once already, with the worklist `Accept`. Raised in
review, 2026-08-17.

| function | request |
|---|---|
| `getCustomizing` | `GET /atc/customizing` — **GET**, the recorded `POST` is a 405 |
| `createWorklist(checkVariant)` | `POST /atc/worklists?checkVariant=…` → a non-empty id |
| `startRun(worklistId, uris, maximumVerdicts, wait)` | `POST /atc/runs?worklistId=…&clientWait=…`, body per Task 6 test 5 |
| `getRunStatus(runId)` | `GET /atc/runs/{runId}` |
| `getWorklist(worklistId)` | `GET /atc/worklists/{id}?includeExemptedFindings=false` |

`buildAtcObjectUri(objectType, objectName)` maps the seven confirmed types to the templates the
evidence confirms. **Not #68's map**: its `include` goes to `/programs/programs/`, and neither
`include` nor `program` is in the union at all.

## Task 4 — The handler

`src/runtime/atc/AdtAtc.ts`, implementing exactly the three capabilities and **nothing else**.

`run(target, options)`:

0. **treat `options` as absent, not as `{}`.** `IAdtRunnable` makes the second argument optional,
   so every read of it is optional-chained with a default: `options?.checkVariant`,
   `options?.wait ?? false`, `options?.maximumVerdicts ?? 100`. A handler that reads
   `options.wait` throws on the one-argument call the interface explicitly allows;
1. resolve the check variant — `options?.checkVariant`, else `getCustomizing()`;
2. `createWorklist`;
3. `startRun` with `clientWait` from `options?.wait ?? false`;
4. parse **what the mode promises**, and fail if it is absent:
   - `wait: false` → a `Location`; no `Location` is an error naming what was missing, never a
     silent fall back to the worklist id;
   - `wait: true` → `FINDING_STATS`; a missing one is an error, never `"0,0,0"`.

**Every response this handler depends on is checked, not assumed.** Three of them carry a single
value the next step cannot work without, and an implementation that shrugs at a missing one
produces the failure this package keeps removing — a request that looks like it worked. So:

| response | what must be there | when it is not |
|---|---|---|
| `POST /atc/worklists` | a non-empty id — **and nothing more specific** | reject naming it: a run against an empty id is a request nobody can interpret |
| run, `wait: false` | `Location` | reject (above) |
| run, `wait: true` | `FINDING_STATS` | reject (above) |
| `GET /atc/runs/{id}` | `runs:status` | reject — `status` is non-optional in `IAtcRunStatus`, and returning `undefined` through it is a lie the type cannot catch |

**The worklist id is checked for emptiness and nothing else.** An earlier draft of this plan
required `[A-Za-z0-9]{20,}`, a shape nobody specified: the evidence shows 32-character hex on one
system, the contract sets no format, and that regex manages to accept unconfirmed junk *and* to
risk rejecting a valid id from a backend nobody has probed. A trimmed non-empty scalar is what the
next request actually needs. Raised in review, 2026-08-17.

**And in waiting mode, the handler returns the id it created.** That is the id it controls and the
one `getFindings` must be called with, so nothing about the run response can improve on it.

The run response also echoes an id. An earlier draft had `run()` **reject** when that echo was
absent or different — which is new failure behaviour, invented in a plan, for a contract the spec
has already been approved against. The spec calls a waiting response malformed when
`FINDING_STATS` is missing and says nothing about the echo, and turning a usable answer into an
error is not a detail an implementation plan gets to add. Raised in review, 2026-08-17.

So: a **different** echo is logged at WARN and the created id is returned; an **absent** one is
not an error at all. If cross-checking the echo is worth a rejection, it goes through the spec
first, with evidence that the echo is always present and always equal.

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
handler does.

**What this package exports, precisely** — an earlier draft said "export the types from
`src/index.ts`" and then, in the next clause, that the interfaces types are not re-exported. Both
cannot hold, and it named the wrong file besides. Raised in review, 2026-08-17.

- `AdtAtc` goes in **`src/index.runtime.ts`**, the runtime barrel, beside the `AtcLog` already
  there. `src/index.ts` re-exports that barrel wholesale (line 27), so nothing is added to it.
- **No contract type is exported from here.** `AtcObjectType`, `IAtcRunTarget`, `IAtcRunResult`
  and the rest come from `@mcp-abap-adt/interfaces`, which consumers import directly. That is the
  standing rule for this package and the reason the interfaces package exists.

## Task 6 — Tests

The capability guard walks `AdtClient` and `AdtClientLegacy`; it does not know `AdtRuntimeClient`
exists. So ATC gets its own behavioural test in the guard's shape — every method, and the request
it makes — rather than the guard being extended to a dozen runtime handlers that have no manifest
entries. That larger job is worth doing and is not this.

**"The request" means method, path AND media types**, which is a stronger claim than the guard's
own and deliberately so. In ATC the header *is* the resource: the same path answers differently by
`Accept`, a checkstyle `Accept` is refused with **406** naming the one type it will serve, and the
worklist creation is `text/plain` in both directions where everything around it is XML. A suite
that pinned only method and path would stay green while the client asked for a media type the
server refuses. So the request-level test fixes the headers for all five low-level operations:

| operation | headers pinned, exactly as captured |
|---|---|
| `getCustomizing` | `Accept: application/xml, application/vnd.sap.atc.customizing-v1+xml, application/vnd.sap.atc.customizing-v2+xml` |
| `createWorklist` | `Content-Type: text/plain`, `Accept: text/plain` |
| `startRun` | `Content-Type: application/xml`, `Accept: application/xml` |
| `getRunStatus` | `Accept: application/vnd.sap.adt.backgroundrun.v1+xml` |
| `getWorklist` | `Accept: application/atc.worklist.v1+xml, application/vnd.sap.atc.worklist.v1+xml` |

**Verbatim from the captures, not paraphrased.** A first draft of this table wrote the worklist
`Accept` as one type where the traffic sends two, which is the failure mode the table exists to
prevent — a header rewritten from memory into something plausible. The server's 406 names
`application/atc.worklist.v1+xml` as what it will serve, and the request that works offers both;
neither fact is a licence to send something else. Raised in review, 2026-08-17.

**The wiring gets its own test, in the file that already tests the wiring.**
`src/__tests__/unit/clients/AdtRuntimeClient.factory.test.ts` asserts, for each of the runtime
handlers, both that the getter returns the right instance and — in a separate case — that repeated
calls return **the same** one. `getAtc()` gets both, beside its neighbours. Without them the
`_atc` field could be forgotten, or a fresh handler built per call, and no request-level test
would notice. Raised in review, 2026-08-17.

Unit tests for the handler itself, against a recording connection:

1. **`run(target)` called with no second argument at all.** `IAdtRunnable` makes `options`
   optional, and the algorithm reads `options.checkVariant` and `options.wait` — so a handler that
   forgets the optional chaining throws on `undefined`, and a test passing `{}` sails past it
   because `{}` is not `undefined`. Assert the whole default set from one call: the variant comes
   from `/atc/customizing`, `clientWait=false` reaches the URL, and the payload carries
   `maximumVerdicts="100"`. Raised in review, 2026-08-17;
2. `run()` with no `checkVariant` **in an options object** reads `/atc/customizing` **with GET**,
   and uses `systemCheckVariant`;
3. `run()` **with** an explicit `checkVariant` does not read `/atc/customizing` at all — assert
   the request was never made, not merely that the right variant was used;
4. `run()` with no `checkVariant` and a customizing response carrying **no** `systemCheckVariant`
   rejects locally, naming what was missing — rather than creating a worklist with `undefined` in
   the URL and letting the server decide what that means;
5. **the run payload, at request level** — the one operation whose body carries the whole
   instruction, and which none of an earlier draft's tests looked at. Assert the XML that
   `startRun` sends:
   - **every** object reference in `target.objects` appears, not just the first;
   - `<objectSet kind="inclusive">`;
   - `maximumVerdicts` is `100` by default and the caller's value when given;
   - `clientWait=false` and `clientWait=true` each reach the URL for the matching `wait`.

   A handler that sent only the first object, the wrong `kind`, or a lost `maximumVerdicts` would
   pass every result-level assertion in this list;
6. `run()` with `wait: false` returns `{ waited: false, runId, worklistId }` — the `runId` from
   `Location` **and** the `worklistId` from the worklist that was created for it, which is a
   different value from a different response and is what `getFindings` is called with next;
7. **`run()` with `wait: false` and no `Location` rejects**, naming what was absent — the
   silent-success shape this package removed from fifteen handlers;
8. `run()` with `wait: true` returns `{ waited: true, findingStats, worklistId }` against an
   ordinary observed response — the stats verbatim, and the created worklist id. It asserts the
   happy path and nothing about where the id came from: an earlier draft had it claiming the
   response echo "must agree", which contradicts test 15, where a *different* echo is fed in
   deliberately and the call succeeds. Which id is authoritative is test 15's job. Raised in
   review, 2026-08-17;
9. **`run()` with `wait: true` and no `FINDING_STATS` rejects** rather than defaulting to
   `"0,0,0"` — a confident zero is indistinguishable from a clean check;
10. `getRunStatus` sets `isFinished` for `finished` and **not** for `unfinished` or `not_finished`;
11. `getRunStatus` on a response carrying **both** atom links returns both ids, each from its own
   `rel` — `…/results/worklistid` and `…/results/displayid`. Asserting only the absent case, as an
   earlier draft did, leaves a parser free to take the first `href` it sees or to swap the two;
12. `getRunStatus` on a response without the worklist atom link still resolves, `worklistId`
   undefined;
13. **`createWorklist` on an empty or whitespace-only response rejects**, naming it. Only that:
    the test must not assert a length or a character class, since no such rule is specified;
14. **`getRunStatus` on a response with no `runs:status` rejects**, rather than resolving with
    `status: undefined` through a non-optional field;
15. **waiting mode returns the id it created**, proven where it matters: a run response echoing a
    *different* id still yields the created one, and the call **succeeds**. A response with no
    echo also succeeds. A positive test where the two agree cannot distinguish "returns the
    created id" from "trusts the response id" — this one can, without inventing a failure the
    spec does not have.

    **And it asserts the WARN.** Task 4 says a differing echo is logged; a behaviour that is
    specified and untested is a behaviour that quietly disappears. The test passes a recording
    `ILogger` and checks the warning names both ids. If that is not worth asserting, the logging
    requirement should come out of Task 4 instead — but it should not sit in one and be absent
    from the other. Raised in review, 2026-08-17;
16. an empty `objects` array rejects before any request;
17. `maximumVerdicts` of 0, -1, 1.5 and NaN reject before any request;
18. the seven `AtcObjectType` members build the URIs the evidence confirms — a table test, one
    row per type, so a changed template fails loudly.

Which test guards what, since the list is long enough that the reason gets lost:

- **7, 9, 10, 13, 14** keep it honest — a missing `Location` silently becoming the worklist id, a
  missing `FINDING_STATS` becoming `"0,0,0"`, a substring match accepting `unfinished`, an empty
  worklist id used anyway, a `status` that is `undefined` through a non-optional field;
- **15** is the only one that can tell which worklist id the handler actually returns — and it
  asserts a success, not a rejection, because the spec defines no failure here;
- **5** is the only one that reads the **XML payload** — the header table above also reads the
  request, so "the only one that looks at what was sent" stopped being true when that table was
  added. 5 remains the only thing standing between a caller's `target` and a body that instructs
  the server to do something else: a lost object reference, the wrong `objectSet kind`, a dropped
  `maximumVerdicts`;
- **18** keeps the URI templates tied to the evidence;
- **6, 8, 11** pin the `worklistId` and the atom links, which everything downstream needs;
- **1** is the only one that calls `run()` the way the interface allows and most callers will —
  with one argument;
- **3, 4** pin the branch that decides whether a request happens at all. **Mutation-check each**, one at a time, breaking the thing it pins.

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
