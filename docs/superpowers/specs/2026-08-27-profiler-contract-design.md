# One contract for reading what a run produced

**Status:** design, awaiting approval
**Packages:** `@mcp-abap-adt/interfaces` (breaking, 22.0.0), `@mcp-abap-adt/adt-clients` (consumer)
**Supersedes:** fr0ster/mcp-abap-adt-interfaces#45, which adds two members to the bag this dismantles

## What this changes

`IProfiler` becomes the one contract for **reading the results a run left behind**, with an
implementation per trace family. Everything about *causing* a run to be measured leaves it and
goes to the executors, which is where the run already lives.

The contract stops promising HTTP calls and starts promising results.

## Why — measured, not argued

Every claim below was checked against this repository and, where it says so, against a system.

### The contract has one real consumer

| member | call sites in this repository |
|---|---|
| `list()` | **39** |
| `getParameters()` | one test, one JSDoc example |
| `createParameters`, `getHitList`, `getStatements`, `getDbAccesses`, `listRequests`, `getRequestsByUri`, `listObjectTypes`, `listProcessTypes` | **tests only — no product caller** |
| `getParametersForCallstack()`, `getParametersForAmdp()` | **none, anywhere** |

### Three members are the same call, and it is refused

`getTraceParameters`, `getTraceParametersForCallstack` and `getTraceParametersForAmdp` are
byte-identical: same URL, method, timeout and `Accept`. And the URL they use is POST-only —
recorded in `ProfilerTraces.test.ts`:

```
// Note: GET /parameters returns 405 — only POST is supported
```

Three members of a published contract that cannot succeed.

### Two members are empty by construction

Measured on E19: `listRequests()` and `getRequestsByUri()` answer `200` with a 345-byte empty
feed — including for the very object just traced. A trace *request* schedules a measurement and
is consumed by the run that fulfils it; the finished trace lands in the traces collection. The
names invite the opposite reading, and this repository fell for it: a helper looked for finished
traces in the requests collection.

### Nothing in it returns what three of its members require

`getHitList`, `getStatements` and `getDbAccesses` all take a trace id first. No member produces
one. The consequences are in the code:

- a regex over an Atom feed, written twice here, once against the wrong collection — since fixed
  on the branch (`parseTraceFeedEntries`, `listTraceIds`, `latestTraceId` on the concrete
  `Profiler`), which is the point: the fix had to live **outside** the contract because the
  contract has no room for it;
- `(runtime.getProfiler() as Profiler).extractIdFromResponse(...)` — a cast **through** the
  contract to reach the concrete class, still present at `ProfilerTraces.test.ts:240`. A consumer
  casting past an interface to the implementation is that interface admitting it does not cover
  the job.

Position in that feed is not age either (measured: first entries minutes old, last eight days
older), so "the first id in the document" is a trace chosen at random.

### The typing mechanism exists and is fed "untyped" by every descendant

```ts
IListableRuntimeObject<TResult, TOptions, TKind>
```

`TResult` exists to type the result. All six descendants pass `IAdtResponse`: `IProfiler`,
`ICrossTrace`, `IMemorySnapshots`, `IRuntimeDumps`, `IGatewayErrorLog`, `ISystemMessages`. A generic
that is always instantiated with "no promise" is worse than no generic: it looks like a contract
while promising nothing about content.

### The same shape is already written three times

| family | listing | reading one |
|---|---|---|
| profiler | `list()` | `getHitList` / `getStatements` / `getDbAccesses(traceId)` |
| crossTrace | `list()` | `getById` / `getRecords` / `getRecordContent(traceId)` |
| st05 | `getDirectory()` | — |

Two concepts, three vocabularies. `ISt05Trace.getState()` — "am I recording" — is the odd member,
and it is odd because it belongs to the recording side, which is exactly the split this spec makes.

## The split

**Recording is the executor's.** Scheduling a measurement produces a *request id*, and a request
nobody fulfils is litter: `ProfilerTraces.test.ts` schedules one on every run and never runs
anything, leaving an orphan each time. The request's life is bounded by the run, so it belongs to
whoever runs.

**Reading is the profiler's.** What traces exist, and what is inside one.

The two never share a vocabulary: `requestId` stops appearing on the reading surface entirely,
which removes the confusion between it and `traceId` at the source.

## The contract

Two atoms, composed. Parameterised over what each family's entries and views actually are, so a
family names its own types instead of everyone agreeing on `IAdtResponse`.

```ts
/** One trace, as every family can describe it. */
export interface ITraceEntry {
  /** The id the reading members take. */
  id: string;
  /** When the system wrote it. Position in a feed is not age. */
  recordedAt: string;
  /** Whose run produced it, where the family knows. */
  user?: string;
  /** What was running, where the family knows. */
  objectName?: string;
  /** The ADT URI of the trace itself. */
  uri?: string;
}

/** What traces exist. */
export interface ITraceListing<
  TEntry extends ITraceEntry = ITraceEntry,
  TOptions = undefined,
> {
  list(options?: TOptions): Promise<TEntry[]>;
}

/**
 * What is inside one trace.
 *
 * `TViews` names the family's views and their result types, so `read()` is
 * typed per view rather than returning a union the caller must narrow.
 */
export interface ITraceReading<TViews extends Record<string, unknown>> {
  read<K extends keyof TViews>(
    traceId: string,
    view: K,
    options?: TraceViewOptions<TViews, K>,
  ): Promise<TViews[K]>;
}

export interface IProfiler<
  TEntry extends ITraceEntry = ITraceEntry,
  TViews extends Record<string, unknown> = Record<string, unknown>,
  TOptions = undefined,
> extends ITraceListing<TEntry, TOptions>,
    ITraceReading<TViews> {
  readonly kind: string;
}
```

The ABAP profiler then says what it is:

```ts
export interface IAbapTraceViews {
  hitlist: IAbapTraceHitList;
  statements: IAbapTraceStatements;
  dbAccesses: IAbapTraceDbAccesses;
}

type AbapProfiler = IProfiler<ITraceEntry, IAbapTraceViews, { user?: string }>;
```

and cross-trace says what *it* is, with the same two atoms and different views
(`records`, `recordContent`). ST05 implements the listing only; it has no per-trace views.

### Why `read(id, view)` and not three members

Three members per family multiplies with families and is how the current bag grew. One member
whose return type is chosen by the view keeps the contract small **without** the union-narrowing
that a plain `result()` would force — which would be `IAdtResponse` again under a new name.

### Why no `latestTraceId()`

Proposed in #45 — and already implemented on the concrete `Profiler` here, which is where it
should stay. It is a trap the measurements already sprang: SAP writes traces asynchronously, so
*newest* is not *mine*, and the on-prem test that uses it has to snapshot the listing before its
run and poll for an id that is new. A caller that needs its own snapshots `list()` before
running and polls for an id that is new. A contract member that looks like the answer and is not
is worse than no member. The convenience may live in an implementation; it does not belong in a
contract.

## What is deleted

| member | why |
|---|---|
| `getParameters`, `getParametersForCallstack`, `getParametersForAmdp` | byte-identical, and the endpoint refuses GET with 405 |
| `listRequests`, `getRequestsByUri` | empty by construction; the collection is consumed by the run |
| `listObjectTypes`, `listProcessTypes` | catalogue lookups, not results of a run; no caller |
| `createParameters` | moves to the executor with the rest of recording |

`IProfilerTraceParameters` moves with `createParameters`: it says *what to measure*, which is an
argument to a run, not to a read.

## What the executor gains

`ClassExecutor` and `ProgramExecutor` already do this; the change is that they own it openly
instead of importing raw functions past the contract:

```ts
scheduleTrace(options?: ITraceParameters): Promise<string>;   // the request id
runWithProfiling(target, options): Promise<IExecutionResult>;
```

ST05's `getState()` joins them as recording control.

## Scope — one judgement call to confirm

In scope: traces a run produces — `abaptraces`, `crosstrace`, `st05`.

Out of scope, deliberately: `IRuntimeDumps`, `IApplicationLog`, `IGatewayErrorLog`,
`ISystemMessages`, `IMemorySnapshots`. A dump is arguably the result of a run too, and all five
have the same listing shape — but they are records the system writes about itself and are read
without anyone running anything through us. They can adopt `ITraceListing` later without a
breaking change, and doing them now would make one change into six.

**This boundary is the one decision in this spec that is a judgement rather than a measurement.**

## Versioning and order

0. Land this branch first. It already carries the parsing work (`parseTraceFeedEntries`,
   `listTraceIds`, `latestTraceId`) on the concrete `Profiler`, which is what the typed `list()`
   below is built from — the contract change should consume a fix that is already proven against
   a system, not arrive at the same time as it.
1. `@mcp-abap-adt/interfaces` **22.0.0** — breaking: `IProfiler` reshaped, members deleted,
   `ITraceEntry` / `ITraceListing` / `ITraceReading` added. Published first.
2. `@mcp-abap-adt/adt-clients` — consumes it: `Profiler` implements the new shape and returns
   parsed entries; `ClassExecutor`/`ProgramExecutor` take scheduling; the deep imports and the
   `as Profiler` cast go.
3. `#45` closed with a comment: its content is here, its shape is not.

## Consequences worth stating

- **Typing the results is the bulk of the work**, not the split. Parsing `hitlist`, `statements`
  and `dbAccesses` into real types is where the effort is; without it these atoms are three tidy
  bags instead of one untidy one. First pass types `list()` and `hitlist` — what consumers
  actually read — and leaves the other two views typed as their parsed document until someone
  needs them.
- **The schedule-without-running test must go** or become an executor test. It is the only
  producer of orphaned trace requests.
- **ADT can schedule a trace for another session.** Nothing here uses it. If the need appears it
  belongs to whoever owns the running, so it does not change this design — but the contract must
  not be widened for it in advance.
