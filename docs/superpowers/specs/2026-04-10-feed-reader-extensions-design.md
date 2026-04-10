# Feed Reader Extensions & Runtime Client Refactoring — Design Spec

## Date

2026-04-10

## Purpose

1. Add new feed reading capabilities and runtime modules (gateway error log, system messages)
2. Refactor `AdtRuntimeClient` from a flat method surface (~80 methods) into an object-oriented factory model where each domain returns its own handler object

This is a **breaking change** — major version bump required.

## Architecture

### Current State (flat methods on client)

```typescript
const client = new AdtRuntimeClient(connection, logger);

// ~80 methods directly on client
client.listProfilerTraceFiles();
client.launchDebugger(...);
client.listRuntimeDumps(...);
client.getFeeds();
// etc.
```

### Target State (noun-style factories for domain objects)

```typescript
const runtime = new AdtRuntimeClient(connection, logger);

const feeds       = runtime.feeds();           // feed repository
const dumps       = runtime.dumps();            // runtime dumps (ST22)
const gwErrors    = runtime.gatewayErrorLog();  // gateway error log (/IWFND/ERROR_LOG)
const messages    = runtime.systemMessages();   // system messages (SM02)
const profiler    = runtime.profiler();         // profiler traces
const crossTrace  = runtime.crossTrace();       // cross trace
const st05        = runtime.st05Trace();        // ST05 performance trace
const dbg         = runtime.debugger();         // ABAP debugger
const appLog      = runtime.applicationLog();   // application logs
const atc         = runtime.atcLog();           // ATC logs
const ddic        = runtime.ddicActivation();   // DDIC activation graph
const memory      = runtime.memorySnapshots();  // memory snapshots
```

Factory methods use noun-style naming (not `getX()`) to avoid confusion with fetch operations. `getX()` is reserved for actual data retrieval inside domain objects.

Each returned object encapsulates its own endpoints, parsing, and helper methods. `AdtRuntimeClient` becomes a thin factory/composition root.

### Interface Model

These are NOT `IAdtObject` (not CRUD). A dedicated interface hierarchy for runtime analysis objects:

```typescript
interface IRuntimeAnalysisObject {
  // Marker interface — all runtime domain objects implement this
}

// Generic — each domain supplies its own options type
interface IListableRuntimeObject<TOptions = void>
  extends IRuntimeAnalysisObject {
  list(options?: TOptions): Promise<IAdtResponse>;
}

interface IFeedRepository extends IRuntimeAnalysisObject {
  list(): Promise<IAdtResponse>;
  variants(): Promise<IAdtResponse>;
  dumps(options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
  systemMessages(options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
  gatewayErrors(options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
  byUrl(feedUrl: string, options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
}
```

Each domain object defines its own interface — there is no single large interface that forces unrelated methods together.

## Filter Interfaces

### `IFeedQueryOptions` — for feed-backed objects only

Applies to: `FeedRepository`, `RuntimeDumps`, `SystemMessages`, `GatewayErrorLog`.

```typescript
interface IFeedQueryOptions {
  user?: string;
  maxResults?: number;
  from?: string;  // YYYYMMDDHHMMSS
  to?: string;    // YYYYMMDDHHMMSS
}
```

Does NOT apply to: `Profiler`, `CrossTrace`, `Debugger`, `ApplicationLog`, `AtcLog`, `DdicActivation`, `MemorySnapshots`. These keep their existing domain-specific option types (`IProfilerTraceHitListOptions`, `IListCrossTracesOptions`, etc.).

### Filter parameter handling

Each feed-backed object documents which parameters it supports. Only supported parameters are mapped to endpoint query params. Unsupported parameters are not mapped (not rejected, not silently promised as a feature — simply not part of that object's contract).

### `FeedRepository.byUrl()` identifier

The `feedUrl` parameter is the feed URL as returned in `<link>` elements of the Atom catalog from `/sap/bc/adt/feeds`. This is the canonical, unambiguous identifier.

## New Modules

### Feed Repository (`src/runtime/feeds/`)

Extend existing module. Reads `/sap/bc/adt/feeds` Atom catalog, returns typed entries by topic.

**Current state:**
- `getFeeds(connection)` — raw GET, returns `IAdtResponse`
- `getFeedVariants(connection)` — raw GET, returns `IAdtResponse`

**New functionality — `FeedRepository` class:**

```typescript
class FeedRepository implements IFeedRepository {
  list(): Promise<IAdtResponse>              // feed catalog
  variants(): Promise<IAdtResponse>          // feed variants
  dumps(options?: IFeedQueryOptions): Promise<IFeedEntry[]>
  systemMessages(options?: IFeedQueryOptions): Promise<IFeedEntry[]>
  gatewayErrors(options?: IFeedQueryOptions): Promise<IFeedEntry[]>
  byUrl(feedUrl: string, options?: IFeedQueryOptions): Promise<IFeedEntry[]>
}
```

**Feed entry type (common Atom structure):**

```typescript
interface IFeedEntry {
  id: string;
  title: string;
  updated: string;
  link: string;
  content: string;
  author?: string;
  category?: string;
}
```

**Implementation details:**
- Parse Atom XML using `fast-xml-parser` (already a dependency)
- Feed catalog returns list of available feeds with URLs
- Topic methods resolve the correct feed URL from catalog, then fetch and parse
- `IFeedQueryOptions` maps to: `user` → ADT query expression, `maxResults` → `$top`, `from`/`to` → time range params

### System Messages (`src/runtime/systemMessages/`)

**Endpoint:** `/sap/bc/adt/runtime/systemmessages`
**SAP equivalent:** SM02

**Files:** `read.ts`, `types.ts`, `index.ts`

**Low-level functions:**

```typescript
listSystemMessages(connection, options?: IFeedQueryOptions): Promise<IAdtResponse>
getSystemMessage(connection, messageId: string): Promise<IAdtResponse>
```

**Domain object:**

```typescript
class SystemMessages implements IListableRuntimeObject<IFeedQueryOptions> {
  list(options?: IFeedQueryOptions): Promise<IAdtResponse>
  getById(messageId: string): Promise<IAdtResponse>
}
```

**Types:**

```typescript
interface ISystemMessageEntry {
  id: string;
  title: string;
  text: string;
  severity: string;
  validFrom: string;
  validTo: string;
  createdBy: string;
}
```

### Gateway Error Log (`src/runtime/gatewayErrorLog/`)

**Endpoint:** `/sap/bc/adt/gw/errorlog`
**SAP equivalent:** /IWFND/ERROR_LOG

Gateway errors are system-wide (not per-user). Individual errors have detail URL: `/sap/bc/adt/gw/errorlog/{type}/{id}`.

**Files:** `read.ts`, `types.ts`, `index.ts`

**Low-level functions:**

```typescript
listGatewayErrors(connection, options?: IFeedQueryOptions): Promise<IAdtResponse>
getGatewayError(connection, errorType: string, errorId: string): Promise<IAdtResponse>
```

**Domain object:**

```typescript
class GatewayErrorLog implements IListableRuntimeObject<IFeedQueryOptions> {
  list(options?: IFeedQueryOptions): Promise<IAdtResponse>
  getById(errorType: string, errorId: string): Promise<IAdtResponse>
}
```

**Types (based on real response structure):**

```typescript
interface IGatewayErrorEntry {
  type: string;             // e.g. "Frontend Error"
  shortText: string;
  transactionId: string;
  package: string;
  applicationComponent: string;
  dateTime: string;
  username: string;
  client: string;
  requestKind: string;
}

interface IGatewayErrorDetail extends IGatewayErrorEntry {
  serviceInfo: {
    namespace: string;
    serviceName: string;
    serviceVersion: string;
    groupId: string;
    serviceRepository: string;
    destination: string;
  };
  errorContext: {
    errorInfo: string;
    resolution: Record<string, string>;
    exceptions: IGatewayException[];
  };
  sourceCode: {
    lines: ISourceCodeLine[];
    errorLine: number;
  };
  callStack: ICallStackEntry[];
}

interface IGatewayException {
  type: string;
  text: string;
  raiseLocation: string;
  attributes?: Record<string, string>;
}

interface ICallStackEntry {
  number: number;
  event: string;
  program: string;
  name: string;
  line: number;
}

interface ISourceCodeLine {
  number: number;
  content: string;
  isError: boolean;
}
```

## Refactoring Existing Runtime Modules

All existing flat methods on `AdtRuntimeClient` are moved into domain objects.

Important scope note:

- For refactoring of already existing runtime domains, low-level functions in `src/runtime/` remain unchanged
- For new feed/runtime capabilities introduced by this spec, new low-level functions and modules are added where needed

So the "low-level functions remain unchanged" rule applies to refactoring of existing modules, not to the full scope of this document.

### Domain Object Mapping

| Domain Object | Factory Method | Current Methods | Module |
|---|---|---|---|
| `Profiler` | `profiler()` | `listProfilerTraceFiles`, `getProfilerTraceParameters`, `getProfilerTraceParametersForCallstack`, `getProfilerTraceParametersForAmdp`, `buildProfilerTraceParametersXml`, `createProfilerTraceParameters`, `extractProfilerIdFromResponse`, `getDefaultProfilerTraceParameters`, `getProfilerTraceHitList`, `getProfilerTraceStatements`, `getProfilerTraceDbAccesses`, `listProfilerTraceRequests`, `getProfilerTraceRequestsByUri`, `listProfilerObjectTypes`, `listProfilerProcessTypes` | `src/runtime/traces/profiler.ts` |
| `CrossTrace` | `crossTrace()` | `listCrossTraces`, `getCrossTrace`, `getCrossTraceRecords`, `getCrossTraceRecordContent`, `getCrossTraceActivations` | `src/runtime/traces/crossTrace.ts` |
| `St05Trace` | `st05Trace()` | `getSt05TraceState`, `getSt05TraceDirectory` | `src/runtime/traces/st05.ts` |
| `AbapDebugger` | `debugger()` | `launchDebugger`, `stopDebugger`, `getDebugger`, `getDebuggerMemorySizes`, `getDebuggerSystemArea`, `synchronizeBreakpoints`, `getBreakpointStatements`, `getBreakpointMessageTypes`, `getBreakpointConditions`, `validateBreakpoints`, `getVitBreakpoints`, `getVariableMaxLength`, `getVariableSubcomponents`, `getVariableAsCsv`, `getVariableAsJson`, `getVariableValueStatement`, `executeDebuggerAction`, `getCallStack`, `insertWatchpoint`, `getWatchpoints`, `executeBatchRequest`, `buildDebuggerBatchPayload`, `buildDebuggerStepWithStackBatchPayload`, `executeDebuggerStepBatch`, `stepIntoDebuggerBatch`, `stepOutDebuggerBatch`, `stepContinueDebuggerBatch` | `src/runtime/debugger/abap.ts` |
| `ApplicationLog` | `applicationLog()` | `getApplicationLogObject`, `getApplicationLogSource`, `validateApplicationLogName` | `src/runtime/applicationLog/` |
| `AtcLog` | `atcLog()` | `getAtcCheckFailureLogs`, `getAtcExecutionLog` | `src/runtime/atc/` |
| `DdicActivation` | `ddicActivation()` | `getDdicActivationGraph` | `src/runtime/ddic/` |
| `RuntimeDumps` | `dumps()` | `buildDumpIdPrefix`, `buildRuntimeDumpsUserQuery`, `listRuntimeDumps`, `listRuntimeDumpsByUser`, `getRuntimeDumpById` | `src/runtime/dumps/` |
| `MemorySnapshots` | `memorySnapshots()` | `listSnapshots`, `getSnapshot`, `getSnapshotOverview`, `getSnapshotRankingList`, `getSnapshotChildren`, `getSnapshotReferences`, `getSnapshotDeltaOverview`, `getSnapshotDeltaRankingList`, `getSnapshotDeltaChildren`, `getSnapshotDeltaReferences` | `src/runtime/memory/` |
| `FeedRepository` | `feeds()` | `getFeeds`, `getFeedVariants` + new topic methods | `src/runtime/feeds/` |
| `SystemMessages` | `systemMessages()` | new | `src/runtime/systemMessages/` |
| `GatewayErrorLog` | `gatewayErrorLog()` | new | `src/runtime/gatewayErrorLog/` |

### Refactoring Approach

Each domain object:
- Is a class in its respective `src/runtime/{module}/` directory
- Holds `connection` and `logger` references (injected via constructor)
- Delegates to existing low-level functions (no rewrite of endpoint logic)
- Exposes methods with simplified names (strip domain prefix: `listProfilerTraceFiles` → `listTraceFiles`)

`AdtRuntimeClient` becomes:
- Constructor unchanged (connection, logger, options)
- Accept negotiation setup unchanged
- All methods replaced by factory methods returning domain objects
- Domain objects are lazily created and cached

### AdtRuntimeClientExperimental

Same refactoring pattern — AMDP debugger methods move into an `AmdpDebugger` domain object returned by `getAmdpDebugger()`.

## File Structure After Refactoring

```
src/runtime/
├── feeds/
│   ├── index.ts
│   ├── read.ts               (existing low-level + new topic functions)
│   ├── types.ts              (new: IFeedQueryOptions, IFeedEntry, IFeedRepository)
│   └── FeedRepository.ts     (new: domain object class)
├── systemMessages/            (new module)
│   ├── index.ts
│   ├── read.ts
│   ├── types.ts
│   └── SystemMessages.ts
├── gatewayErrorLog/           (new module)
│   ├── index.ts
│   ├── read.ts
│   ├── types.ts
│   └── GatewayErrorLog.ts
├── dumps/
│   ├── index.ts
│   ├── read.ts               (existing, no changes)
│   └── RuntimeDumps.ts       (new: domain object wrapping existing functions)
├── traces/
│   ├── index.ts
│   ├── profiler.ts           (existing, no changes)
│   ├── crossTrace.ts         (existing, no changes)
│   ├── st05.ts               (existing, no changes)
│   ├── Profiler.ts           (new: domain object)
│   ├── CrossTrace.ts         (new: domain object)
│   └── St05Trace.ts          (new: domain object)
├── debugger/
│   ├── index.ts
│   ├── abap.ts               (existing, no changes)
│   ├── amdp.ts               (existing, no changes)
│   ├── amdpDataPreview.ts    (existing, no changes)
│   ├── AbapDebugger.ts       (new: domain object)
│   └── AmdpDebugger.ts       (new: domain object)
├── applicationLog/
│   ├── index.ts
│   ├── read.ts               (existing, no changes)
│   └── ApplicationLog.ts     (new: domain object)
├── atc/
│   ├── index.ts
│   ├── logs.ts               (existing, no changes)
│   └── AtcLog.ts             (new: domain object)
├── ddic/
│   ├── index.ts
│   ├── activationGraph.ts    (existing, no changes)
│   └── DdicActivation.ts     (new: domain object)
├── memory/
│   ├── index.ts
│   ├── snapshots.ts          (existing, no changes)
│   └── MemorySnapshots.ts    (new: domain object)
└── index.ts                   (updated: export all domain objects and types)
```

## Public API Changes (Breaking)

### Removed

All ~80 flat methods on `AdtRuntimeClient`.

### Added

12 noun-style factory methods on `AdtRuntimeClient`, each returning a domain object:

```typescript
feeds(): IFeedRepository
dumps(): RuntimeDumps
systemMessages(): SystemMessages
gatewayErrorLog(): GatewayErrorLog
profiler(): Profiler
crossTrace(): CrossTrace
st05Trace(): St05Trace
debugger(): AbapDebugger
applicationLog(): ApplicationLog
atcLog(): AtcLog
ddicActivation(): DdicActivation
memorySnapshots(): MemorySnapshots
```

### Exports from `src/index.ts`

All domain object classes, their interfaces, and all types (IFeedQueryOptions, IFeedEntry, IGatewayErrorDetail, ISystemMessageEntry, etc.).

## Testing Strategy

- Integration tests against real SAP system for each new module
- Test structure: `src/__tests__/integration/runtime/{moduleName}/`
- Existing tests updated to use new domain object API
- Filter options testing: with user, with time range, with maxResults
- Unit tests for domain object construction and method delegation

## Implementation — Two Workstreams

### Track A: Runtime Client Refactoring

Existing low-level functions remain unchanged. New domain object classes wrap them. `AdtRuntimeClient` switches from flat methods to factories.

1. **IRuntimeAnalysisObject + IListableRuntimeObject<TOptions> interfaces**
2. **Domain object classes for existing modules** — Profiler, CrossTrace, St05Trace, AbapDebugger, ApplicationLog, AtcLog, DdicActivation, RuntimeDumps, MemorySnapshots
3. **Refactor AdtRuntimeClient** — replace ~80 flat methods with 12 factory methods
4. **Refactor AdtRuntimeClientExperimental** — AmdpDebugger domain object
5. **Update exports in src/index.ts**
6. **Update existing tests** to use new domain object API

### Track B: New Feed/Runtime Features

New low-level functions and modules. Feed parsing and topic resolution.

1. **IFeedQueryOptions + IFeedEntry + IFeedRepository types**
2. **Feed Repository** — FeedRepository class, Atom XML parsing, topic methods
3. **Gateway Error Log** — low-level functions + GatewayErrorLog domain object
4. **System Messages** — low-level functions + SystemMessages domain object
5. **Wire new modules into AdtRuntimeClient** factory methods
6. **Integration tests for new modules**

Track A goes first (does not break low-level function layer), Track B adds new capabilities on top.

## API Boundary: Parsed vs Raw

Two abstraction levels with an explicit boundary:

- **Level 1** — `FeedRepository` returns parsed `IFeedEntry[]` (high-level, Atom XML → typed objects)
- **Level 2** — topic-specific runtime objects (`RuntimeDumps`, `SystemMessages`, `GatewayErrorLog`, `Profiler`, etc.) return `IAdtResponse` (raw endpoint wrappers)

Parsed domain models for Level 2 objects are out of scope for this iteration. If needed later, they become a separate phase.

## Migration Checklist Rule

The domain-object mapping table (see "Domain Object Mapping" section) serves as the migration checklist. Every currently exported runtime function must be explicitly:

- **Preserved** — wrapped by the new domain object with the same or simplified name
- **Renamed** — with the old → new name documented
- **Dropped** — with justification

No function may silently disappear during refactoring.

## Migration Test Coverage Rule

The migration checklist (domain-object mapping table) must be backed by tests. For every currently public runtime method:

- **Preserved/renamed** — at least one test covers the new domain-object method
- **Dropped** — justification documented, old test removed or updated

This makes the "no silent disappearance" rule enforceable, not just declarative.
