# ATC: start a run, wait for it, read the findings

**Status:** designed against captured traffic, 2026-08-16. One question is still open —
`AtcObjectType` is **closed for cloud**: seven of nine types confirmed, each by a run submitted at
the URI this client builds whose finished worklist then listed that object. The remaining two,
`program` and `include`, are refused by ABAP Cloud itself and wait on an on-prem probe. The
criterion for confirming one was wrong twice before it was right, and both wrong versions are
recorded below with what refuted them. Everything else in the contract rests on a response somebody
can re-read: `docs/evidence/2026-08-16-atc-trial-probe.md` for the traffic, and
`docs/evidence/2026-08-17-atc-objecttype-confirmed.md` for every type in the union, quoted from
the worklists that confirmed them. Not implemented.

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
      /**
       * The server returned **without waiting**. Not "the checks are still
       * running": a short run can finish before this result reaches the
       * caller, and a consumer that read the old wording as a guarantee of a
       * running state would be relying on something the protocol never said.
       * Ask `getRunStatus(runId)`. Raised in review, 2026-08-17.
       */
      waited: false;
      worklistId: string;
      /**
       * From the `Location` header. Poll `getRunStatus(runId)` until it
       * reports finished — **under a bound of the caller's choosing** — then
       * read `getFindings(worklistId)`. See "waiting has no failure state".
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
   * match.
   */
  status: string;
  /**
   * True when `status` is exactly `finished`, case-normalised.
   *
   * **Completion, not success.** It says the run reached an end, not that the
   * end was a good one: a run can finish having checked nothing, with the
   * reason recorded in the worklist, the result resource or its log rather
   * than in this status.
   *
   * **There is deliberately no `isTerminal` or `isFailed`.** A run that fails
   * or is cancelled has never been observed, so any state this type named for
   * it would be invented — and a wrong name is worse here than none, because a
   * caller would branch on it.
   */
  isFinished: boolean;
  /**
   * From the `worklistid` atom link, when the response carries one.
   *
   * **Optional on purpose.** The only status response anyone has captured was
   * already `finished`, and this method exists to be polled — so it will be
   * called on states nobody has seen. Requiring the link would make the parser
   * throw at exactly the moment polling matters, on a response that may simply
   * not have it yet. The caller already has the worklist id from
   * `IAtcRunResult`; this is a convenience, not the source.
   */
  worklistId?: string;
  /** From the `displayid` atom link. A different resource; see `IAtcLog`. */
  resultId?: string;
}
```

#### Waiting has no failure state, and the contract says so rather than pretending

"Poll until finished" is only a complete instruction if every run eventually finishes. Nobody has
watched one fail. If the server reports `failed`, `cancelled` or anything else terminal, a caller
following that instruction literally waits for ever. Raised in review, 2026-08-16.

Two ways out, and this contract takes the second:

- **invent the states** — `isTerminal`, or a `outcome: 'finished' | 'failed' | 'cancelled'`. It
  would be guessing at the names, and a caller branching on a name the server never sends is
  worse off than one branching on nothing;
- **bound the wait and hand back what the server said.** `getRunStatus` returns the raw `status`
  alongside `isFinished`, so a caller that stops after N attempts or T seconds can report the
  state it last saw. This client offers no `waitForRun` helper in v1 for the same reason: a
  helper would have to decide when to give up, and that decision belongs to whoever knows how
  long their checks take.

`scripts/probe-atc.ts` does exactly this — twenty attempts, three seconds apart, and it names the
last status it saw when it gives up rather than reporting a run as unfinished.

**What would close it:** a run that fails. Deliberately checking an object mid-edit, or against a
variant that does not exist, and capturing the status. It is on the probe list, and until it
answers, "poll until finished" carries the bound in the caller's hands and nowhere else.

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
`docs/evidence/2026-08-16-atc-trial-probe.md`; the type confirmations are in
`docs/evidence/2026-08-17-atc-objecttype-confirmed.md`. Raw captures stay out of git, so anything
a claim rests on is quoted into one of those two.

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
one of `<objectSets>`.

Acceptance would prove nothing here — a bogus URI is accepted too. What proves it is the finished
worklist of a two-object run, which carried **both** objects as separate `<atcobject:object>`
elements, each with its own findings block: the class with a finding, the package with an empty
one. Two objects went in and two objects were checked. An earlier draft cited the same run as
"listed both", which read as the weaker claim after the evidence rule changed; the shape of the
response is what carries it.

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
// Seven of nine confirmed on cloud; two refused by the system, and open until
// an on-prem probe. Each member was confirmed by a run submitted at the URI
// this client builds, whose finished worklist then listed that object under
// that type.
type AtcObjectType =
  | 'class'
  | 'interface'
  | 'function_group'
  | 'package'
  | 'ddl_source'
  | 'table'
  | 'behavior_definition';
```

#### The evidence a type needs, and two wrong answers before it

**A worklist read after the run reports `finished` lists every object that was checked**, each
with its own findings block — empty when the object is clean. From the two-object run:

```xml
<atcobject:object adtcore:type="DEVC" adtcore:name="ZBASE_PROBE01" …>
  <atcobject:findings/>                                    <!-- checked, nothing found -->
</atcobject:object>
<atcobject:object adtcore:type="CLAS" adtcore:name="ZOK_CL_CLEANER" …>
  <atcobject:findings>
    <atcfinding:finding … atcfinding:priority="3"
      atcfinding:checkTitle="Extended Program Check (SLIN)" …/>
  </atcobject:findings>
</atcobject:object>
```

So a type is confirmed when its object appears in a finished worklist, with or without findings.
Appearing is the evidence; a finding is a bonus.

**But in whose worklist, and that is two different claims.** A run over a *package* lists
everything in it — so one such worklist can show ATC checking a function group and a CDS view
without anybody ever submitting those URIs:

- **the type is checkable** — an object of it appears in *some* finished worklist;
- **the template is right** — a run submitted at the URI *this client builds* for that type came
  back with the object in its own worklist.

`AtcObjectType` promises the second. It is the set of types a caller can hand to `run()`, and a
wrong URI fails at submission however checkable the type is. The first is still worth recording,
because it narrows what remains: a type known checkable with an unproven template needs one run,
not an investigation.

Both facts are carried separately in the probe's manifest — `confirmed` with the template that
did it, and `seenCheckedInSomeWorklist` with the run whose worklist showed it. Raised by a run of
2026-08-17 that proved `function_group` and `ddl_source` checkable in the package's worklist while
reporting them as never asked. Raised in review the same day.

Two answers were tried before that one, and both are worth keeping because each looked right:

1. **"Acceptance is evidence."** It is not: `/sap/bc/adt/oo/classes/ZZ_NO_SUCH_CLASS_PROBE`, a URI
   that cannot exist, is answered **201** exactly like a real one.
2. **"A worklist lists only objects that have findings."** Also wrong, and it was written into
   this spec on 2026-08-16 after a run where every candidate's worklist came back empty while the
   one hand-written class produced a finding. The inference was that clean objects are invisible.
   The block above refutes it — a clean package is listed, with an empty findings element.

   What actually happened is the probe's own defect: `runAt` starts the run with
   `clientWait=false` and reads the worklist **immediately**, so it was reading before the checks
   had finished. It systematically manufactured the ambiguity this spec warns about everywhere
   else, and the one worklist that did hold objects was a run that happened to finish first.
   Raised in review, 2026-08-16.

   The correction has a practical consequence worth stating, because work was about to be done on
   the strength of the wrong version: **the fixtures do not need to be non-conforming.** A clean
   object proves its type. What the probe needs is to wait.

**So the probe must, per candidate:** start the run, take the run id from `Location`, poll
`GET /atc/runs/{runId}` until `runs:status` reports finished, and only then read the worklist.
Reading earlier is not a weaker measurement; it is a different one, of nothing.

#### Where it stands

Each row below is quoted in `docs/evidence/2026-08-17-atc-objecttype-confirmed.md` as a **chain**,
not a summary: the worklist id created for that run, the run request carrying that id and the
built URI, the `Location` run resource reporting `finished` and linking back to the same worklist,
and the read of that worklist with the `<atcobject:object>` element it answered — `adtcore:type`
included, since the type is what makes it evidence about a type.

The worklist id is the join, and it differs per row. Without it a reader cannot tell an object
listed by *its own* run from one listed by the package run, which lists everything in the package
and would otherwise supply a false confirmation for every type at once.

| type | URI the client builds | confirmed by |
|---|---|---|
| `class` | `/sap/bc/adt/oo/classes/{NAME}` | `CLAS:ZOK_CL_CLEANER` — sessions 5 and 6 |
| `interface` | `/sap/bc/adt/oo/interfaces/{NAME}` | `INTF:ZOK_IF_PROBE` — sessions 5 and 6 |
| `function_group` | `/sap/bc/adt/functions/groups/{NAME}` | `FUGR:ZOK_FG_PROBE` — session 5 |
| `package` | `/sap/bc/adt/packages/{NAME}` | `DEVC:ZBASE_PROBE01`, and every object in the package beside it — sessions 5 and 6 |
| `ddl_source` | `/sap/bc/adt/ddic/ddl/sources/{NAME}` | `DDLS:ZOK_I_PROBE` — sessions 5 and 6 |
| `table` | `/sap/bc/adt/ddic/tables/{NAME}` | `TABL:ZOK_T_PROBE` — sessions 5 and 6 |
| `behavior_definition` | `/sap/bc/adt/bo/behaviordefinitions/{NAME}` | `BDEF:ZOK_I_PROBE` — session 6 |
| `program` | `/sap/bc/adt/programs/programs/{NAME}` | **not checkable here** — `403 ExceptionResourceNoAuthorization`, `S_DEVELOP` |
| `include` | `/sap/bc/adt/programs/includes/{NAME}` | **not checkable here** — same refusal |

Seven confirmed, two refused by the system.

**The evidence is seven ATC runs across two probe sessions, and that is not a weakness.** The two
senses of "run" matter here, in a document where one of them is an API resource: each type has its
own **ATC run** — its own worklist id and its own run id — and those seven live in the manifests
of two **probe sessions**. Raised in review, 2026-08-17.

`function_group` was confirmed in the first session; in the second its run request timed out after
60 seconds and never reached a verdict at all. `behavior_definition` could only be confirmed in
the second, because the object did not exist until then. Each confirmation is a self-contained
capture — a run at a built URI and the finished worklist that listed the object — and nothing in
the rule says they must share a session.

Re-running until one manifest is green would have bought a tidier artefact and cost a real
observation: that a run request can simply time out, which the probe first reported as "the run
carried no Location" — a statement about the server, made about a request the server may never
have seen. Raised in review, 2026-08-17.

"Not checkable here" is a fact about **this system**, not about ATC. A classic program cannot
exist on ABAP Cloud, so ATC cannot check one on ABAP Cloud. And that is not a footnote, because
**ATC is the single control point for checks** — what it covers has to include on-prem, where
those objects do exist, even as SAP drops them from newer systems.

#### So what ships in v1, and the contradiction that had to be resolved

An earlier version of this spec wanted both: a union that covers on-prem, and an open-questions
list saying everything is trial-answerable and on-prem is not needed. Those cannot both hold.
Raised in review, 2026-08-16. The choice:

**v1 ships the confirmed set, and widening it later is a `major`.**

An earlier draft justified this by saying widening "is not a breaking change for anyone", which
is false and was the load-bearing claim. Adding a member to an exported union is invisible to a
caller *passing* a value, and breaking for a caller *exhausting* one:

```ts
const uri: Record<AtcObjectType, string> = { … };   // stops compiling
switch (t) { … default: const _: never = t; }        // stops compiling
```

Raised in review, 2026-08-16. So the honest accounting, and it makes the decision harder rather
than easier: **deferring the on-prem members costs a major release later.** It is still the right
trade, for a reason that survives the correction — a union naming `program` on the strength of
"it must work somewhere" is the promise-without-evidence this package spent three releases
removing from fifteen handlers, and being wrong about the URI would cost a major *and* a
migration.

The alternative considered and rejected: an open-ended `AtcObjectType | (string & {})`, which
makes widening free by making the type stop checking anything. A contract that cannot be wrong
cannot be relied on either.

The doc comment on the union says which system confirmed each member and that the set is expected
to grow, so nobody builds an exhaustive `Record` over it without having read that it will change.

That keeps the rule this package spent three releases establishing: **the type states what has
been seen to work.** A union naming `program` on the strength of "it must work somewhere" is the
same promise-without-evidence the capability narrowing removed from fifteen handlers, wearing a
different hat.

What that costs, stated plainly rather than buried: **until the on-prem probe runs, an on-prem
caller cannot ask this client to check a program or an include**, and `AtcObjectType` is
therefore not the whole of what ATC covers. The union is a statement about what this package has
seen checked, not about what ATC checks in the world, and the doc comment on it says so.

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

`IAtcLog` already in the package (`runtime/IAtcLog.ts`) is **not** this: it reads **two**
resources — the execution log at `/atc/results/{executionId}/log`, and the check-failure logs at
`/atc/checkfailures/logs`, filtered by `displayId` among others. Both are separate from a
worklist, and both take an `X-sap-adt-relation` header. The run resource links to `/atc/results/{displayId}` and to
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

**Nothing blocks v1 any more.** `AtcObjectType` was the one blocker and it is closed for cloud:
seven types confirmed, the other two refused by the system rather than unmeasured. What remains
are loose ends that would improve the contract without holding it, and one on-prem probe that
would widen the union.

(Counted against the table below rather than from memory — the number was wrong twice when it was
still a count.)

**Not blocking:**

| ask | what it would add |
|---|---|
| one **finished** worklist read with `includeExemptedFindings=false` and `=true` | whether the flag does anything. The two reads so far differ by timing, not by the flag |
| `withLongPolling=true` against a run that is **still running** | what long polling does. The one observation was made after the run had finished, where it cannot act |
| the bogus URI's worklist read **after** its run reports finished | whether ATC ever reports a bad reference. So far it answers 201 and an empty worklist, which is also what an unfinished good run looks like |
| a worklist with findings at more than one priority | whether the `FINDING_STATS` positions are priorities 1, 2, 3. One finding at priority 3 gave `0,0,1`, which is consistent and not conclusive |
| a run that **fails** — an object mid-edit, or a check variant that does not exist | what `runs:status` reports for a terminal failure. Until it answers, "poll until finished" has no stopping condition of its own and the bound sits with the caller |
| whether ATC checks `program` and `include` on an **on-prem** system, and at which URI (`programs/programs` or `programs/includes` for an include) | widens `AtcObjectType` by two members — a **major**, since exhaustive consumers break. Not a v1 blocker, but the one open question that leaves a real capability gap rather than an unanswered curiosity, and what an on-prem consumer waits on |

`scripts/probe-atc.ts` attempts all of these. It takes `--package=NAME` for the objects,
`--known-bad=KEY:NAME` for an object expected to produce findings, and exits non-zero while any
**cloud-scope** candidate is unconfirmed — so an incomplete probe cannot be read as a finished
one.

**Attempts, not runs**, and the difference matters for one row. `--known-bad` names an object
whose *checks* find something; the run itself still succeeds, so it says nothing about a run that
*fails*. An earlier version of this sentence claimed the probe covered every row, which it did
not. Raised in review, 2026-08-17. The probe now tries the cheapest deliberate failure — a check
variant that does not exist — and reports which of two things happened:

- the worklist creation is refused, so no run exists to have a status, and the question stays
  open;
- the run is accepted — which by itself proves **nothing**, because the server may fall back to a
  real variant, or run to an end and record the problem somewhere. So the probe samples the status
  to a fixed bound, records the whole sequence, and then reads the **four** places a result could
  live: the worklist, the `/atc/results/{displayId}` resource the run links to, that resource's
  `/log` — the **execution** log — and `/atc/checkfailures/logs?displayId=…`, which is a separate
  resource for **check-failure** logs.

  An earlier version read only the first three and called the execution log "the check-failure
  log". They are two endpoints, and `src/runtime/atc/logs.ts` has been issuing both since before
  this spec existed (`getExecutionLog`, `getCheckFailureLogs`). Each also carries its own
  `X-sap-adt-relation` header, which the probe was omitting — so a 4xx from that read would have
  been the request's fault and could have been mistaken for an answer. Raised in review,
  2026-08-17.

Two tests are deliberately absent, and both were written and removed:

- **"not `running`, therefore terminal".** The set of non-terminal states is precisely what is
  unknown — `queued` or `scheduled` would sail through and be recorded as the end of a run.
- **"`finished`, therefore it did not fail".** `finished` is a **completion** marker, not an
  outcome. A run can finish having done nothing useful, with the reason recorded in the worklist,
  the result, the execution log or the check-failure logs rather than in the status — and the
  existence of a resource called *check-failure logs*, distinct from the execution log, is
  itself the strongest hint that failures are recorded somewhere other than the status. Concluding success from `finished` was the
  same mistake as concluding a type is checkable from a 201. Raised in review, 2026-08-17.

So what the probe can report is bounded, and it depends on something it may not see. The status
sequence is bounded — a fixed number of polls plus the final read the results link comes from,
and the probe prints the count it actually used rather than this text asserting one. `finished`
may never appear in it, and the probe deliberately does
not know which of the other values are terminal — that is the whole gap. Two cases, and the run
must say which one it is in:

- **`finished` was observed** — in any of the status reads, the last one included. The run
  reached an end. Whether that end was a good one is still unobserved, and the captures are of a
  completed run, worth comparing against a healthy one.

  The last status read is also where the results link comes from, so it can be the *first* to
  show `finished` — after the worklist has already been taken. The probe re-reads the worklist in
  that case, so every capture sits on the same side of the marker. Without that there is a third
  case, "completion observed, but only after part of the evidence", which is a state nobody
  should have to reason about from a manifest. Raised in review, 2026-08-17.
- **`finished` was never observed.** Then completion is **not** established either. All that
  exists is a bounded sequence of states, and the four captures were taken while the run may
  still have been going: they cannot be read as final, and a difference from a healthy run could
  as easily be "not finished yet" as "failed".

An earlier version of this paragraph said "the run completed" flatly, which is only true in the
first case and is exactly the kind of unconditional reading this section was written to remove.
Raised in review, 2026-08-17.

Either way the manifest records it, rather than the spec asserting a coverage nobody checked.
