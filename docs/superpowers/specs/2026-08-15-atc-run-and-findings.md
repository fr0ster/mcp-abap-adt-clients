# ATC: start a run, wait for it, read the findings

**Status:** designed against captured traffic, 2026-08-16. One question is still open —
`AtcObjectType`, the set of checkable object types: **one of nine confirmed**, two refused by the
system, six accepted but unproven. The criterion for confirming one was itself wrong until
2026-08-16 and is corrected below. Everything else in the contract rests on a response somebody
can re-read (`docs/evidence/2026-08-16-atc-trial-probe.md`). Not implemented.

**Scope:** an ATC client in `@mcp-abap-adt/adt-clients`, and the contract it needs in
`@mcp-abap-adt/interfaces`. The MCP server is a separate consumer and out of scope here.

## What changed on 2026-08-16, and why the whole design moved

Every revision of this spec up to 2026-08-15 was built on one recorded session from 2026-07-20,
and on three facts that session was thought to have established. `scripts/probe-atc.ts` re-issued
them against the trial. **All three were wrong**, and each was wrong in the direction that had
been used to argue *against* the outside PR:

| the spec said | the trial answered |
|---|---|
| there is no separate run id; the run echoes the worklist id | `POST /atc/runs?clientWait=false` → **201, empty body**, `Location: /sap/bc/adt/atc/runs/0ABD…6030` — an id that is **not** the worklist id, which 404s at that path |
| there is no run-status resource; `withLongPolling` has nothing to poll | `GET /atc/runs/{that id}` → **200** `<runs:run runs:status="finished">`, a `backgroundruns` resource |
| ATC is synchronous on cloud, so waiting cannot be studied there | the worklist read straight after the run is **byte-identical to the bogus-URI control's**; read again once the status said `finished`, it holds the finding. **ATC on cloud is asynchronous** |

A fourth, smaller one had already fallen the day before: the traffic table's
`POST /atc/customizing` is a **405**; `GET` is the verb, as #68 had it.

So `run()` is no longer start-only, `IAtcRunResult` no longer carries what it said, and the
on-prem probe that was going to "decide whether waiting is designed at all" is no longer the
gate — waiting is designed here, against a marker that was watched arriving. **#68 was right
about the mechanism and wrong only about the API it wrapped around it.** What follows keeps its
traffic and replaces its interface, which was the plan all along; it just turns out the traffic
was the better-attested half by a wider margin than this spec credited.

Two lessons are recorded rather than smoothed over, because both were avoidable:

- **A single unrepeatable session is not evidence, however carefully it is written down.** This
  spec argued from one for three weeks, and stated its conclusions as facts that contradicted
  working code. The moment its provenance was questioned, three of four rows fell.
- **The control is what made the async finding visible.** An empty worklist after an accepted run
  reads exactly like a clean check. Only the bogus URI's *identical* worklist showed that the
  emptiness meant "not yet".

## The shape: this is profiling, and now more closely than before

An ATC run is the same shape as a profiled execution — start a process, then look for the result.
`ClassExecutor.runWithProfiling` (`src/executors/class/ClassExecutor.ts:86-125`) retries fetching
the **artifact**, because a trace file does not exist until the run is done, so its appearance is
the completion signal.

ATC cannot use that rule, and this spec was right about the reason: the worklist is created by a
request of its own **before** the run, so `GET /atc/worklists/{id}` succeeds immediately and an
empty answer means either "found nothing" or "not finished". That was reasoning; it is now
observation. The class worklist read immediately after its run and the bogus URI's worklist are
the same 2076 bytes, `<atcworklist:objects/>` in both.

What the earlier drafts could not supply was the replacement. It exists, and it is better than
the profiler's:

```
POST /atc/runs?worklistId=…&clientWait=false
  → 201, Location: /sap/bc/adt/atc/runs/{runId}

GET /sap/bc/adt/atc/runs/{runId}
  → <runs:run runs:status="finished">
       <atom:link href="/sap/bc/adt/atc/results/{displayId}"  rel="…/results/displayid"/>
       <atom:link href="/sap/bc/adt/atc/worklists/{worklistId}" rel="…/results/worklistid"/>
     </runs:run>
```

**`runs:status` is the completion marker.** Not a count, not the artifact's appearance — a status
attribute on a resource whose whole purpose is to carry it. Polling it is not a race with a
timeout on it; it is reading the answer the server publishes.

The run resource also links to a **third** id, under `/atc/results/{displayId}`. That settles a
question this spec had listed as unverified: `/atc/results/…` and `/atc/worklists/…` are
**different resources with different ids**, linked from the same run under different `rel`s — so
`IAtcLog`, which reads a log by `executionId`, is not a second door onto the worklist.

### `clientWait` is a second mode, not a flag

`clientWait=true` was a lead in earlier drafts. It is now a captured behaviour, and it answers
with a **different response shape**:

| | `clientWait=false` | `clientWait=true` |
|---|---|---|
| status | 201 | 200 |
| body | empty | `<atcworklist:worklistRun>` |
| `Location` | the run id | **absent** |
| carries | nothing | `worklistId` + `FINDING_STATS` |
| cost | returns at once | holds the connection until the checks are done |

That explains the 2026-07-20 session completely: it recorded a `clientWait=true` run, which is
why it saw `<atcworklist:worklistRun>` with `FINDING_STATS` and no run id — and then generalised
one mode's response into "the run response", which is how "there is no separate run id" became a
fact for three weeks.

The two modes are not interchangeable, and neither is redundant. `true` is one request instead of
a poll loop, but yields no run id and holds a connection for as long as the checks take — SAP's
own `sap-perf-fesrec` puts the waiting run at more than three times the non-waiting one, on a
single class, and nothing bounds it for a larger object set. `false` returns at once and is the
only mode that gives something to poll.

## The contract

Three capabilities. Running, asking whether a run is done, and reading findings.

```ts
// starting a run — the atom that exists since interfaces 16.0.0
IAdtRunnable<IAtcRunTarget, IAtcRunResult, IAtcRunOptions>

interface IAtcRunStatusReadable {
  /** Status of a run started with `wait: false`. */
  getRunStatus(runId: string): Promise<IAtcRunStatus>;
}

interface IAtcFindings {
  getFindings(worklistId: string): Promise<IAdtResponse>;
}
```

### `IAtcRunResult` is a union, because the server has two answers

```ts
type IAtcRunResult =
  | {
      /** The server returned at once; the checks are still running. */
      waited: false;
      worklistId: string;
      /**
       * From the `Location` header. Poll `getRunStatus(runId)` until it
       * reports finished, then read `getFindings(worklistId)`.
       */
      runId: string;
    }
  | {
      /** The server held the request until the checks were done. */
      waited: true;
      worklistId: string;
      /**
       * `FINDING_STATS` verbatim — a comma-separated triple, e.g. `"0,0,1"`.
       * Not parsed into named counts: see below.
       */
      findingStats: string;
    };
```

A discriminated union rather than four optional fields, because which fields exist is decided by
the request and known at the call site. Optional fields would let a caller write
`result.runId!` and be wrong exactly when they used `wait`. This is the one place in the contract
where the server genuinely answers two ways, and the type says so.

**`findingStats` stays a raw string.** One data point now bears on the positions: a worklist whose
single finding carried `atcfinding:priority="3"` produced `FINDING_STATS` `0,0,1`. That is
consistent with the three positions being priorities 1, 2, 3 — and it is one sample with one
finding, which says nothing about positions 1 and 2. Parsing it into `{ errors, warnings, infos }`
would publish two guesses to save a caller one `split(',')`. It is returned as sent, and the
indication is written down here so the next probe knows what to confirm.

### `IAtcRunStatus`

```ts
interface IAtcRunStatus {
  /**
   * `runs:status` verbatim. Only `"finished"` has been observed, so this is a
   * string and not a union: enumerating the states a server may report, from
   * one state, is how a caller ends up with a union that silently fails to
   * match. `isFinished` is the tested question.
   */
  status: string;
  /** True when `status` is `finished`. */
  isFinished: boolean;
  /** From the `worklistid` atom link — the worklist to read findings from. */
  worklistId: string;
  /** From the `displayid` atom link. A different resource; see `IAtcLog`. */
  resultId?: string;
}
```

**`withLongPolling=true` is not in this contract.** It was sent, and answered **identically** to
the plain read — but the run had already finished, so that comparison establishes nothing about
what long polling does while a run is in flight. An option whose one observation was made in the
condition where it cannot act is not an answered option. It joins the probe list.

### `IAtcRunOptions`

```ts
interface IAtcRunOptions {
  /**
   * Have the server hold the request until the checks finish (`clientWait`).
   * Defaults to **false**: the mode that returns a run id, which is the only
   * one that can be polled, cancelled by the caller's own timeout, or reported
   * on while it runs. `true` is one request instead of a loop, at the cost of
   * a connection held for as long as the checks take — which nothing bounds,
   * and which grows with the object set.
   */
  wait?: boolean;
  /**
   * The check variant to run. Omitted, the client reads `GET /atc/customizing`
   * and uses `systemCheckVariant`.
   */
  checkVariant?: string;
  /**
   * `maximumVerdicts` in the run payload: a **cap on results**, not a page
   * size. Defaults to 100. `run()` rejects anything that is not a positive
   * integer before sending it — the server answers 0 with a 400
   * (`ExceptionInvalidData`, `XML_PATH atc:run(1)`), and a client that can
   * name the problem should not spend a round trip to be told.
   */
  maximumVerdicts?: number;
}
```

`maximumVerdicts` at 1 and at 100000 were both accepted (201), so the upper bound is not near
anything a caller would pick, and `run()` does not impose one it cannot justify.

**Where the check variant comes from.** `POST /atc/worklists` requires one, so `run()` cannot
proceed without deciding this. `GET /atc/customizing` returns `systemCheckVariant`
(`ABAP_CLOUD_DEVELOPMENT_DEFAULT` on the trial) — captured, under the verb that works;
`POST` to the same path is a 405. Making `checkVariant` optional is not a convenience: on the
trial `/atc/variants` returns `totalItemCount 0`, so customizing is the only source of a usable
variant, and a contract demanding the caller supply one would be unusable there. The read happens
per `run()` call; a cached variant is wrong the moment the system default changes, and nobody has
measured a need for the optimisation.

### `getFindings` takes no options

The candidate was `includeExemptedFindings`. `true` **was sent and answered 200** — but the only
`false` read happened before the run finished and the only `true` read after, so the two differ by
timing and not by the flag. Its effect is still unobserved. Publishing it now would promise a
behaviour on the strength of a comparison that was never made, which is the same mistake in a
smaller font. The request sends `includeExemptedFindings=false`, and the flag joins the probe
list with a concrete way to settle it: read one finished worklist both ways.

`format` is out for a stronger reason, and this one held up under re-verification: a checkstyle
`Accept` is answered **406, "Accepted content types: application/atc.worklist.v1+xml"** — one
type. `AtcFindingsFormat = 'xml' | 'checkstyle'` in #17 offers a choice that does not exist.

### What the contract must not have

`AdtAtc` in #68 declares `IAdtObject` — all ten methods, six of which throw
(`src/core/atc/AdtAtc.ts:422-457`), plus `getVersions`/`getVersionSource` calling
`throwUnsupportedVersions` (lines 587-593). That is precisely the pattern adt-clients 12.0.0
deleted from fifteen handlers. A check run is not created, updated, locked, activated or
versioned. `readTransport()` (lines 444-446) does not even throw — it returns `{ errors: [] }`,
which reads as success. Three defects of that shape were fixed in 12.0.0.

This is the one part of #68 that re-verification did **not** rehabilitate, and it is the reason
the PR still cannot be merged: its traffic was right, its surface is the pattern this package
spent three releases removing.

## The ADT traffic

Captured by `scripts/probe-atc.ts` on the **cloud trial**, 2026-08-16, against `ZBASE_PROBE01`
(one class, `ZOK_CL_CLEANER`). Every row below is quoted in
`docs/evidence/2026-08-16-atc-trial-probe.md`; raw captures stay out of git.

| step | request | answer |
|---|---|---|
| variant | `GET /sap/bc/adt/atc/customizing` | `systemCheckVariant` = `ABAP_CLOUD_DEVELOPMENT_DEFAULT`. `POST` → **405** |
| worklist | `POST /sap/bc/adt/atc/worklists?checkVariant=<X>`, `Accept: text/plain` | 200, a bare 32-char id |
| run | `POST /sap/bc/adt/atc/runs?worklistId=<id>&clientWait=false`, `Content-Type: application/xml`, body `<atc:run maximumVerdicts="N"><objectSets><objectSet kind="inclusive"><adtcore:objectReferences>…` | **201, empty**, `Location: /sap/bc/adt/atc/runs/<runId>` |
| status | `GET /sap/bc/adt/atc/runs/<runId>`, `Accept: application/vnd.sap.adt.backgroundrun.v1+xml` | 200 `<runs:run runs:status="finished">` + atom links to worklist and results |
| run (waiting) | the same POST with `clientWait=true` | 200 `<atcworklist:worklistRun>` with `worklistId` and `FINDING_STATS`, no `Location` |
| findings | `GET /sap/bc/adt/atc/worklists/<id>`, `Accept: application/atc.worklist.v1+xml` | 200; empty before the run finishes, populated after |

`GET /atc/runs/<worklistId>` → **404**: the two ids are not interchangeable.

A finding, for the shape:

```xml
atcfinding:location="/sap/bc/adt/oo/classes/zok_cl_cleaner/source/main#start=30,0"
atcfinding:priority="3"
atcfinding:checkTitle="Extended Program Check (SLIN)"
atcfinding:messageTitle="Strings without text elements are not translated: |Cleaning item, |"
```

## The target: a set, not one object

The run payload nests `<adtcore:objectReferences>` — plural, inside an `objectSet` that is itself
one of `<objectSets>`. A run over two objects was accepted and its worklist listed **both**
(`ZBASE_PROBE01` and `ZOK_CL_CLEANER`), so the plural is real and not decorative.

```ts
interface IAtcObjectRef {
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
contract: nothing has established what they accept.

### `AtcObjectType` — the one open question

```ts
// One of nine confirmed, two refused by the system, six accepted but unproven.
type AtcObjectType = 'class' /* … pending dirty representatives */;
```

#### The evidence a type needs, which an earlier draft got wrong

A draft of this section said a type joins the union when its object **shows up in the finished
worklist**. That criterion does not work, and the probe run of 2026-08-16 is what showed why:

**a worklist lists only objects that have findings.** The run over `ZBASE_PROBE01` produced a
worklist holding exactly one object — the one class with real code in it — and exactly one
finding. Every other object was checked and produced nothing, and a checked-and-clean object is
absent from the worklist in precisely the same way an unchecked one is. The worklist of a run
over a freshly made table came back **byte-identical** to the worklist of a run over
`/sap/bc/adt/oo/classes/ZZ_NO_SUCH_CLASS_PROBE`, a URI that cannot exist.

So this is the same ambiguity the spec already names for an empty worklist, one level down: at
the level of a single object rather than a whole run. It was missed because the only object with
content in the probed package was one class somebody had written by hand.

**Acceptance is not evidence either.** The impossible URI is answered **201**, exactly like a
real one.

**What is left is a finding.** A type is confirmed when ATC reports a finding against an object
of that type, at the URI the client builds. Which means the representative has to contain
something ATC objects to — a clean object cannot prove anything about its type, however carefully
it is made. The fixtures for the first run were clean by construction, so they could not have
closed this no matter how correct they were.

#### Where it stands

| type | URI the client builds | status |
|---|---|---|
| `class` | `/sap/bc/adt/oo/classes/{NAME}` | **confirmed** — a finding at `…/source/main#start=30,0`, `priority="3"`, `FINDING_STATS 0,0,1` |
| `program` | `/sap/bc/adt/programs/programs/{NAME}` | **not checkable here** — the system refuses to hold one: `403 ExceptionResourceNoAuthorization`, `S_DEVELOP` |
| `include` | `/sap/bc/adt/programs/includes/{NAME}` | **not checkable here** — same refusal |
| `interface` | `/sap/bc/adt/oo/interfaces/{NAME}` | run accepted, no finding — unproven |
| `function_group` | `/sap/bc/adt/functions/groups/{NAME}` | run accepted, no finding — unproven |
| `package` | `/sap/bc/adt/packages/{NAME}` | run accepted, no finding — unproven |
| `ddl_source` | `/sap/bc/adt/ddic/ddl/sources/{NAME}` | run accepted, no finding — unproven |
| `table` | `/sap/bc/adt/ddic/tables/{NAME}` | run accepted, no finding — unproven |
| `behavior_definition` | `/sap/bc/adt/bo/behaviordefinitions/{NAME}` | no representative was made — unmeasured |

"Not checkable here" is a fact about **this system**, not about ATC: a classic program cannot
exist on ABAP Cloud, so ATC cannot check one on ABAP Cloud. Whether ATC checks them on-prem is a
separate question and stays open.

Two things about the mapping stand regardless:

- **`include` is mapped two different ways in the two codebases.** #68 sends includes to
  `/sap/bc/adt/programs/programs/{name}`; this library builds `/sap/bc/adt/programs/includes/`
  everywhere else. They cannot both be the ATC-checkable URI, and the probe runs both — though
  neither can be resolved on a system that will not hold an include at all.
- **DDL source, table and behavior definition are absent from `buildAtcObjectUri` entirely**, so
  they cannot be checked through #68 even if ATC accepts them. Their templates come from what
  this library already uses.

## What goes in `interfaces`

- `IAtcRunTarget` / `IAtcObjectRef` / `IAtcRunOptions`;
- `IAtcRunResult`, the union, and `AtcObjectType`;
- `IAtcRunStatus` and `IAtcRunStatusReadable`;
- `IAtcFindings` — and **nothing** composing these three with `IAdtRunnable`: the getter spells
  that intersection itself.

Nothing from #17 survives as written: `IGetAtcRunStatusParams { run_id }` was right that a run id
exists but wrong in shape, `with_long_polling` is unmeasured, and `AtcFindingsFormat` offers a
format the server refuses.

`IAtcLog` already in the package (`runtime/IAtcLog.ts`) is **not** this: it reads a check-failure
or execution log by `executionId`. The run resource links to `/atc/results/{displayId}` and to
`/atc/worklists/{worklistId}` as two different resources under two different `rel`s, so the
question of whether they were the same thing under two ids is answered: they are not.

One release, both packages, cut when the work is done.

## Which systems this is for

Everything here was captured on the **cloud trial**. Nothing on-prem has been captured — but the
on-prem question has shrunk to almost nothing, because what #68 claims for S/4HANA 2023 (async
runs, a run id from `Location`, a pollable `/atc/runs/{id}`) is exactly what the trial now
demonstrates. The two systems agreeing is the likely case, and it is no longer this design's
risk: the design follows the traffic both accounts describe.

The handler does **not** gate on environment. What it does instead is refuse to invent: `run()`
parses the response, and if the response does not carry what the mode promises — no `Location`
on a `wait: false` run, no `FINDING_STATS` on a `wait: true` one — it fails with an error naming
what was absent. It does not default a missing run id to the worklist id, and it does not default
a missing count to `"0,0,0"`. The dangerous outcome on an unverified system is not an exception;
it is a confident zero, indistinguishable from a clean check — which is precisely the shape of
the mistake this spec spent three weeks inside.

## Where this lives

**`AdtRuntimeClient.getAtc()`, in `src/runtime/atc/`, beside `AtcLog`.** Not `AdtClient`: that
client hands out per-object CRUD handlers, and a check run is not an ADT object — the same reason
`getProfiler()`, `getDumps()` and `getAtcLog()` are on the runtime client.

Not an extension of `AtcLog` either: that reads a log by `executionId`, this runs checks and reads
a worklist. The run resource linking to both under different `rel`s confirms they are separate
resources, so one handler holding both would have halves with nothing to do with each other.

**The capability guard does not cover this.** `src/__tests__/unit/capabilities/` walks `AdtClient`
and `AdtClientLegacy`; it does not know `AdtRuntimeClient` exists, and no runtime handler is in
its manifest. The plan picks one of two:

- **extend the completeness check to `AdtRuntimeClient`** — correct, and it immediately demands
  manifest entries for a dozen runtime handlers that have none. A larger job than this feature.
- **give ATC its own behavioural test in the guard's shape** — every method, the request it makes,
  method and path. Proportionate, and it leaves the runtime client uncovered as it is today.

The second is what this spec expects; the first is worth doing and is not this.

### What `getAtc()` returns

```ts
getAtc(): IAdtRunnable<IAtcRunTarget, IAtcRunResult, IAtcRunOptions> &
  IAtcRunStatusReadable &
  IAtcFindings;
```

The intersection, spelled at the getter — no new named composite. The precedent, counted rather
than asserted: of `AdtClient`'s 37 getters, **13 spell an intersection and 24 return a single
named type** — mostly `IAdtSourceObject`, which names a set several handlers share exactly. A
composite earns a name when more than one handler has that set; ATC's is used by one getter.

That rule is followed here but is **not** yet true of the client as a whole: the same count found
five kinds of return type across the 37 getters, two of them concrete classes. Making them one is
[issue #109](https://github.com/fr0ster/mcp-abap-adt-clients/issues/109), a separate breaking pass.
ATC conforms, so it adds nothing to that pile; it does not clean it either.

The concrete class is not the return type. A consumer never names `AdtAtc`.

## Deliberately not in scope

**`runSync()`** — #68 also adds a synchronous ABAP Unit runner: one `POST /abapunit/testruns`
with `<aunit:runConfiguration>` keyed by object reference, returning the full result, because the
async `/abapunit/runs` path fails on 7.5x backends. Nothing on `main` can reach that endpoint, so
it is additive and worth having — but it is a different subject with a different endpoint, and
mixing it into ATC is what made #68 an 11k-line diff. Its own spec.

## What is still open

One blocker and four loose ends. All are trial-answerable; none needs an on-prem system.

**Blocking:**

| ask | what it decides |
|---|---|
| run one **deliberately non-conforming** object of each remaining kind — `interface`, `function_group`, `package`, `ddl_source`, `table`, `behavior_definition` — at the URI a client builds, and read the worklist after the run reports finished | `AtcObjectType`. Each representative must contain something ATC objects to; a clean one produces no finding and a worklist without a finding says nothing about whether the object was checked |

`program` and `include` are **not** on that list. The system refuses to hold either
(`403`, `S_DEVELOP`), so nothing about them can be settled here, and their line in the table
above is already the answer *for this system*.

**Not blocking:**

| ask | what it would add |
|---|---|
| one **finished** worklist read with `includeExemptedFindings=false` and `=true` | whether the flag does anything. The two reads so far differ by timing, not by the flag |
| `withLongPolling=true` against a run that is **still running** | what long polling does. The one observation was made after the run had finished, where it cannot act |
| the bogus URI's worklist read **after** its run reports finished | whether ATC ever reports a bad reference. So far it answers 201 and an empty worklist, which is also what an unfinished good run looks like |
| a worklist with findings at more than one priority | whether the `FINDING_STATS` positions are priorities 1, 2, 3. One finding at priority 3 gave `0,0,1`, which is consistent and not conclusive |
| whether ATC checks `program` and `include` on an **on-prem** system | the only part of `AtcObjectType` this trial cannot decide. Not blocking, because a union that omits them is honest on cloud and can be widened later; blocking only if the contract is expected to be complete on-prem from the start |

`scripts/probe-atc.ts` runs all of these. It takes `--package=NAME` for the objects,
`--known-bad=KEY:NAME` for an object expected to fail its checks, and exits non-zero while any
candidate type is unmeasured — so an incomplete probe cannot be read as a finished one.
