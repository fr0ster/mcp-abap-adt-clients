# Migrating to 23.0.0

23.0.0 finishes what 19.0.0 started: **this package interprets nothing.**

19.0.0 took the verdicts out of the library's defaults. What it left behind were
readings and verdicts applied *inside* members — a transport listing that came
back as a parsed tree, a package delete that judged `del:isDeleted` on its own,
a unit-test run that remembered its id, an abapGit client that listed every
repository to find one. Each of those was a decision about SAP's answer taken
before the caller saw it. They are all gone, and every one of them is still
available — as a strategy you pass, in
[`@mcp-abap-adt/adt-strategies`](../../packages/adt-strategies).

Three rules produced every change below:

1. **One member, one ADT request.** Nothing reads the configurations and picks
   one, lists repositories and filters them, or reads a document to patch it.
2. **The result strategy is given when the implementation is built.** A result
   set per object type; the shipped `<x>Documents` sets answer the document as
   it arrived (`rawDocument`), or nothing (`nothing`) where there is nothing to
   read. Every shape a member used to answer is now a strategy you put into
   that set.
3. **The error strategy is given with every call** — `options.analyse`, typed
   `IAdtAnalyseOptions` in `@mcp-abap-adt/interfaces-adt` 11. No member
   substitutes its own. A failure whose cause is SAP's answer comes back
   through it, never as a throw and never rewrapped without the response. A
   member throws only for a cause inside the library: an argument the caller
   left out before any request was built, or a defect.

Nothing changes silently. Every item below is a name that no longer exports, an
answer that is now the document instead of a shape, or a signature the compiler
stops you on. Where an answer changed shape without the type changing — most
defaults are `unknown` either way — this document says so explicitly, because
that is the one kind of change the compiler will not show you.

The readings below are imported from `@mcp-abap-adt/adt-strategies`; the result
sets they go into (`transportDocuments`, `utilDocuments`, …) from
`@mcp-abap-adt/adt-clients`. Install both:

```bash
npm install @mcp-abap-adt/adt-clients @mcp-abap-adt/adt-strategies
```

---

## 1. Dependencies and the connection contract

| package | 22.x | 23.0.0 |
|---|---|---|
| `@mcp-abap-adt/interfaces-adt` | `^9.0.0` | `^11.0.0` |
| `@mcp-abap-adt/interfaces-adt-connection` | — | `^1.0.0` (new) |
| `@mcp-abap-adt/interfaces-auth` | dependency | **dev** dependency — nothing a consumer imports from this package names it |
| `@mcp-abap-adt/connection` (dev) | `^9.2.x` | `^9.3.0` |

**The connection moved package.** `interfaces-adt` 11 no longer exports the
connection contract; it lives in `@mcp-abap-adt/interfaces-adt-connection` 1.0.0,
unchanged. A connector depends on the connection alone and stops following every
major of the object contracts.

```typescript
// 22.x
import type { IAbapConnection, IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt';

// 23.0.0
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
  ITimeoutConfig,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ADT_SESSION_ERROR } from '@mcp-abap-adt/interfaces-adt-connection';
```

The same move covers `ISessionLifecycleAware`, `ICriticalSection`,
`IRequestProfiling`, `IDeferredResponseConnection` and `AdtSessionErrorCode`.
Everything else — configs, capability atoms, `IAdtResponse`, `IAnalyse`,
`ADT_NO_FAILURE` — stays in `@mcp-abap-adt/interfaces-adt`.

**Keep one copy of each contract in the tree.** A consumer holding
`interfaces-adt` 9 or 10 next to this release gets two declarations of
`IAdtError` and types that do not match across the seam. Check with
`npm ls @mcp-abap-adt/interfaces-adt @mcp-abap-adt/interfaces-adt-connection`.

## 2. The error strategy is taken with every call

`interfaces-adt` 10 gave `options.analyse` to every member that answers an
`IAdtResponse` — 79 members that had none: `lock`, `unlock`, `getVersions`,
`getVersionSource`, every `getUtils()` member, every runtime and executor
member, the transport listing, the unit-test run members, the abapGit client.
Where a member had no options parameter, one was added as the **last**
parameter.

```typescript
import { analyseException } from '@mcp-abap-adt/adt-strategies';

const locked = await client.getClass().lock(
  { className: 'ZCL_X' },
  { analyse: analyseException },
);
```

Nothing else about the call changes; passing nothing is still allowed and still
judges nothing beyond what the transport refused.

## 3. Verdicts a member applied on its own

Seven members fell back from your `analyse` to a reading of their own, and three
applied one you could not replace. Each now hands on what you pass, or nothing.
If you relied on the old verdict, pass the strategy that replaces it:

| member | 22.x applied | 23.0.0: pass |
|---|---|---|
| `getPackage().delete` | `packageDeletionRefusal` | `analyseDeletion` |
| `getServiceBinding().update` | `publicationRefusal` | `analysePublication` |
| `getMessageClassMessage().read` | an inline absence check | `analyseMessageClassMessage(msgno)` |
| `validate` on scalar function, scalar function implementation, append structure | `validationUnsupported` (404/405/501) | `analyseUnsupportedStatus([404, 405, 501], '…')` |
| `getTransformation().validate` | `validationUnavailable` (404) | `analyseUnsupportedStatus([404], '…')` |
| `getUnitTest().run`, `getCdsUnitTest().run(className)` | `startedRun` | `analyseUnitTestStart` |
| `getCdsUnitTest().checkCdsTestDoubles` | `testDoublesVerdict` | `analyseCdsTestDoubles` |

```typescript
import {
  analyseDeletion,
  analyseMessageClassMessage,
  analysePublication,
  analyseUnsupportedStatus,
} from '@mcp-abap-adt/adt-strategies';

// A package delete SAP declined inside a 200 is a failure again.
const deleted = await client
  .getPackage()
  .delete({ packageName: 'ZPKG', transportRequest }, { analyse: analyseDeletion });
if (!deleted.ok) {
  for (const m of deleted.getError().messages) console.error(m.type, m.text, m.t100);
}

// A binding whose publication SAP refused.
await client.getServiceBinding().update(
  {
    bindingName: 'ZUI_X_O4',
    desiredPublicationState: 'published',
    serviceType: 'odatav4',
  },
  { analyse: analysePublication },
);

// The class answering is not the message existing.
await client
  .getMessageClassMessage()
  .read({ className: 'ZMSG', msgno: '001' }, undefined, {
    analyse: analyseMessageClassMessage('001'),
  });

// A system without the validation resource, named as such.
await client.getScalarFunction().validate(
  { scalarFunctionName: 'ZSF_X', packageName: 'ZPKG', description: 'x' },
  { analyse: analyseUnsupportedStatus([404, 405, 501], 'scalar-function validation') },
);
```

**`analyseDeletion` reads more than it did (issue #172).** It reads every
`del:message` SAP sends, each with its own severity, and the T100 key and
`msgv1..4` from the message's long-text link — the one part that does not change
with the logon language. The old reading took the first message as the only one,
so two messages read as none, and the reference counts stood in for SAP's
reason. An object is refused when its verdict attribute is not `"true"` or any
message is an `E`.

## 4. Readings a member applied on its own

These members answered a parsed shape by default. They answer the document as it
arrived now. **The declared type is often `unknown` both before and after, so the
compiler will not tell you** — a `getResult().value` you treated as an array is a
string of XML until you pass the reading.

### Transport requests

```typescript
import { transportDocuments } from '@mcp-abap-adt/adt-clients';
import {
  transportCreated,
  transportObjectEntries,
  transportSearchConfigurations,
  transportTree,
} from '@mcp-abap-adt/adt-strategies';

// Once, when you build the implementation — every member of it answers these shapes.
const requests = client.getRequest({
  ...transportDocuments,
  created: transportCreated,          // 22.x: parseCreatedTransport
  createdTask: transportCreated,
  list: transportTree,                // 22.x: parseTransportTree
  searchConfigurations: transportSearchConfigurations,
  objects: transportObjectEntries,    // 22.x: parseObjectEntries
});
```

**`list` requires the saved search it runs.** A listing is a saved-configuration
search, and in 22.x `list()` read the configurations and chose one. It takes the
`configUri` now, and `searchConfigurations()` is where you find one:

```typescript
const configs = await requests.searchConfigurations();
if (!configs.ok) throw new Error(configs.getError().message);

const [first] = configs.getResult().value;   // ITransportSearchConfiguration[]
if (!first) throw new Error('this system holds no saved transport search');

const tree = await requests.list({ configUri: first.uri });
if (tree.ok) {
  for (const request of tree.getResult().value.requests) {
    console.log(request.attributes['tm:number'], request.tasks.length);
  }
}
```

A hand-written transport result set names every slot now — the seven added
after 19.0.0 were optional and fell back to the shipped defaults; spread
`transportDocuments` and override, as above.

Which configuration to run is yours: the payload carries no name and no default
marker, so "the first one" is a choice, not a fact. Gone with the resolver:
`TransportSearchConfigurationMissing` and the parsed
`getTransportSearchConfigurations` helper.

`AdtClientLegacy`'s `getRequest().list()` is the exception. `/sap/bc/cts/transportrequests`
is no saved search, so `configUri` stays optional there and is **refused** when
given, rather than silently ignored.

### Object versions

```typescript
import { classDocuments } from '@mcp-abap-adt/adt-clients';
import { analyseUnsupportedStatus, objectVersions } from '@mcp-abap-adt/adt-strategies';

const cls = client.getClass({ ...classDocuments, versions: objectVersions });

const history = await cls.getVersions(
  { className: 'ZCL_X' },
  { analyse: analyseUnsupportedStatus([404, 406], 'version history') },
);
if (history.ok) {
  const [latest] = history.getResult().value;   // IObjectVersion[] — was ObjectVersion[]
  if (latest) {
    const source = await cls.getVersionSource(latest.contentUri);
    // The source as it came: the `versionSource` slot, rawDocument by default.
  }
}
```

Every versionable type has the two new slots, `versions` and `versionSource`.
The 22.x type `ObjectVersion` is `IObjectVersion` in adt-strategies. A system
without the resource used to throw `UNSUPPORTED_OPERATION`; it now answers the
transport's failure — `analyseUnsupportedStatus([404, 406], …)` renames it, as
above.

### Utilities (`getUtils()`)

| member | slot | 22.x default | 23.0.0: pass |
|---|---|---|---|
| `search` | `search` | `ISearchResult[]` | `utilSearchHits` |
| `getAllTypes` | `types` | `INamedItem[]` | `utilNamedItems` |
| `fetchNodeStructure` | `node` | node contents | `utilNodeContents` |
| `getInactiveObjects` | `inactive` | the inactive list | `utilInactiveObjects` |
| `activateObjectsGroup` | `activation` | the run id | `utilActivationRunId` |
| `getWhereUsed` | `whereUsed` | the document (`whereUsedReferences` was exported to read it) | `utilWhereUsedReferences` |

```typescript
import { utilDocuments } from '@mcp-abap-adt/adt-clients';
import {
  utilActivationRunId,
  utilSearchHits,
  utilWhereUsedReferences,
} from '@mcp-abap-adt/adt-strategies';

const utils = client.getUtils({
  ...utilDocuments,
  search: utilSearchHits,
  activation: utilActivationRunId,
  whereUsed: utilWhereUsedReferences,
});

const hits = await utils.search({ query: 'ZCL_*', objectType: 'CLAS' });
hits.ok && hits.getResult().value;             // ISearchResult[]

const run = await utils.activateObjectsGroup(objects);
run.ok && run.getResult().value;               // the run id, '' if SAP sent none
```

The util readings also stopped judging on the way: an SAP error document read by
`utilSearchHits` and its siblings is an empty result, not a throw. Judging it is
`analyse`'s.

The exports these readings replace are listed in §12.

**`deleteObjectsGroup` answers SAP's reply.** It threw on `del:isDeleted="false"`;
it answers the document now, and `analyseDeletion` makes the refusal a failure:

```typescript
import { analyseDeletion } from '@mcp-abap-adt/adt-strategies';

const gone = await client
  .getUtils()
  .deleteObjectsGroup(objects, transportRequest, { analyse: analyseDeletion });
```

**Where-used addresses objects the way activation does.** It builds the object
URI with the same `buildObjectUri` group activation uses (fixed for eleven types
in #173), and maps the friendly names — `class`, `interface`, `table`, `view`,
`functionmodule`, … — onto type codes. Any ADT type code works. `'intf/if'` and
`'stru/dt'`, which the old private vocabulary accepted but ADT does not use, are
**thrown before any request** as an unsupported type: use `'INTF/OI'` /
`'interface'` and `'TABL/DS'` / `'structure'`.

### Feature toggles

`getFeatureToggle(results)` is typed by `IFeatureToggleObject` since
`interfaces-adt` 11, which gives each of the toggle's answers its own slot. The
two states answer their documents; the readings are in adt-strategies:

```typescript
import { featureToggleDocuments } from '@mcp-abap-adt/adt-clients';
import {
  featureToggleCheckState,
  featureToggleRuntimeState,
} from '@mcp-abap-adt/adt-strategies';

const toggle = client.getFeatureToggle({
  ...featureToggleDocuments,
  runtimeState: featureToggleRuntimeState,
  checkState: featureToggleCheckState,
});
```

## 5. Lock and unlock

**`lock` answers the handle, and never throws for SAP's answer.** A `200` that
carried no handle used to throw "Failed to obtain lock handle" — raised as if
the library had failed, reaching you as a connection error with the answer gone.
It reads as `''` now, and the answer is in the response:

```typescript
const cls = client.getClass();
const config = { className: 'ZCL_X' };

const locked = await cls.lock(config);
if (!locked.ok) throw new Error(locked.getError().message);

const handle = locked.getResult().value;
if (handle === '') {
  // SAP answered and named no handle. Whether that is a refusal is yours to say —
  // or pass an analyse that says it once, for every lock.
}
```

**`unlock` answers SAP's reply**, read by nothing; it used to answer an empty
value the library built.

Both take `options` with `analyse`. The dead lock and versions plumbing is gone
with it: `LockCapability`, `VersionsCapability` and their types, the
`*ForUpdate` lock helpers (`lockClassForUpdate` and its siblings),
`acquireLockHandle`. None of them was reachable from the package root.

## 6. Unit tests

**`run` answers the document it got, and the run id is a reading.** ADT puts the
id in a header (`Location`, `Content-Location` or `sap-adt-location`), or in
`aunit:run@uri` — not in a body a caller would look at. `unitTestRunId` reads it:

```typescript
import { unitTestDocuments } from '@mcp-abap-adt/adt-clients';
import { analyseUnitTest, analyseUnitTestStart, unitTestRunId } from '@mcp-abap-adt/adt-strategies';

const unitTests = client.getUnitTest({ ...unitTestDocuments, run: unitTestRunId });

const started = await unitTests.run(tests, { analyse: analyseUnitTestStart });
if (!started.ok) throw new Error(started.getError().message);
const runId = started.getResult().value;   // was getRunId()

const status = await unitTests.getStatus(runId, true);
const result = await unitTests.getResult(runId, { analyse: analyseUnitTest });
```

**The handler remembers nothing.** Gone: `getRunId`, `getStatusResponse`,
`getResultResponse`, `getClassName`, `getCdsViewName`, and the remembered id
`getStatus()`/`getResult()` fell back to. Every member takes the run it is about.
A caller who wants the wire response passes `wireItself` for that slot:

```typescript
import { unitTestDocuments, wireItself } from '@mcp-abap-adt/adt-clients';

const withWire = client.getUnitTest({ ...unitTestDocuments, status: wireItself });
```

**On a legacy system**, `run` answers the finished result — the legacy endpoint
runs synchronously — and `getStatus`/`getResult` **refuse with
`UNSUPPORTED_OPERATION`** without a request. They used to replay a remembered
answer under a synthetic id.

`checkCdsTestDoubles(cdsViewName, options)` takes the view name and `analyse`;
pass `analyseCdsTestDoubles` for the old verdict.

## 7. Message classes

**`getMessageClass().updateMetadata` is one PUT of the document you pass.** It
used to read the class itself and patch `config.description` into it — a second
request, and a document this library composed in your place. Read, edit, write:

```typescript
const mc = client.getMessageClass();
const target = { name: 'ZMSG' };

const current = await mc.readMetadata(target);
if (!current.ok) throw new Error(current.getError().message);

// The first adtcore:description is the class's own; each message carries one too.
const edited = String(current.getResult().value).replace(
  /adtcore:description="[^"]*"/,
  'adtcore:description="New description"',
);

const locked = await mc.lock(target);
if (!locked.ok) throw new Error(locked.getError().message);
const lockHandle = locked.getResult().value;
try {
  await mc.updateMetadata(target, { source: edited, lockHandle });
} finally {
  await mc.unlock(target, lockHandle);
}
```

`AdtMessageClassMessage`'s write — a message is a row inside its class's
document — keeps assembling that document, and stays the one exception to "one
member, one request".

## 8. abapGit

The client makes one request per member, answers documents by default, and takes
a result set as its fourth constructor argument.

```typescript
import { AdtAbapGitClient, abapGitDocuments } from '@mcp-abap-adt/adt-clients';
import {
  abapGitErrorLog,
  abapGitExternalRepo,
  abapGitRepos,
} from '@mcp-abap-adt/adt-strategies';

const abapGit = new AdtAbapGitClient(connection, logger, undefined, {
  ...abapGitDocuments,
  repos: abapGitRepos,              // 22.x: IAbapGitRepoStatus[]
  errorLog: abapGitErrorLog,
  externalRepo: abapGitExternalRepo,
});
```

**`getRepo` is gone.** It listed every repository and picked the one for a
package — a filter over a document. List once and find it yourself:

```typescript
const repos = await abapGit.listRepos();
if (!repos.ok) throw new Error(repos.getError().message);
const repo = repos.getResult().value.find((r) => r.package === 'ZPKG');
```

**`unlink` and `getErrorLog` take what `listRepos` reported**, instead of a
package they had to look up:

```typescript
if (repo?.repositoryId) {
  await abapGit.unlink({ repositoryId: repo.repositoryId });   // was unlink({ package })
}
if (repo?.logLink) {
  const log = await abapGit.getErrorLog(repo.logLink);         // was getErrorLog(package)
}
if (repo?.pullLink) {
  await abapGit.pull({ package: repo.package, pullLink: repo.pullLink });
  // It does not wait. Poll listRepos on your own terms until status leaves 'R'.
}
```

`abapGitRepos` reads the key verbatim. The old parser read it as a number and
turned `000001` into `1` — which is the key `unlink` is addressed by.

Also removed: `IAbapGitAbortedError` and `IAbapGitTimeoutError`, thrown by a
poll loop that has not existed since 19.0.0.

## 9. Runtime client and executors

**Every factory takes a result set, and builds a fresh implementation per
call.** They used to cache the first instance, which kept the first caller's
readings for everyone after — memory between calls.

```typescript
import { AdtRuntimeClient, atcDocuments, profilerDocuments } from '@mcp-abap-adt/adt-clients';
import {
  atcRunStatus,
  atcStartedRun,
  atcSystemCheckVariant,
  atcWaitingRun,
  atcWorklistId,
  profilerHitList,
  profilerTraceEntries,
} from '@mcp-abap-adt/adt-strategies';

const runtime = new AdtRuntimeClient(connection, logger);

const profiler = runtime.getProfiler({
  ...profilerDocuments,
  list: profilerTraceEntries,        // 22.x default: IAbapTraceEntry[]
  hitlist: profilerHitList,
});

const atc = runtime.getAtc({
  ...atcDocuments,
  checkVariant: atcSystemCheckVariant,
  worklist: atcWorklistId,
  startedRun: atcStartedRun,
  waitingRun: atcWaitingRun,
  runStatus: atcRunStatus,
});
```

**ATC answers the contract everywhere.** `resolveCheckVariant()` and
`createWorklist()` answered a bare `Promise<string>` and threw on anything else;
both answer `IAdtResponse` now, and the seven throws whose cause was SAP's
answer are gone:

```typescript
const variant = await atc.resolveCheckVariant();
if (!variant.ok) throw new Error(variant.getError().message);

const worklist = await atc.createWorklist(variant.getResult().value);
if (!worklist.ok) throw new Error(worklist.getError().message);
```

| implementation | slot → reading |
|---|---|
| `getProfiler()` | `list` → `profilerTraceEntries`, `hitlist` → `profilerHitList`, `statements` → `profilerStatements`, `dbAccesses` → `profilerDbAccesses` |
| `getAtc()` | `checkVariant` → `atcSystemCheckVariant`, `worklist` → `atcWorklistId`, `startedRun` → `atcStartedRun`, `waitingRun` → `atcWaitingRun`, `runStatus` → `atcRunStatus` |
| `getFeeds()` | `feeds` → `feedDescriptors`, `variants` → `feedVariants`, `entries` → `feedEntries`, `systemMessages` → `feedSystemMessages`, `gatewayErrors` → `feedGatewayErrors`, `gatewayErrorDetail` → `feedGatewayErrorDetail` |
| `getClassExecutor()`, `getProgramExecutor()` | `types` → `traceSchedulingTypes`, `requests` → `traceSchedulingRequests`, `scheduled` → `traceSchedulingProfilerId` |

The executors take the same shape:

```typescript
import { AdtExecutor, classExecutorDocuments } from '@mcp-abap-adt/adt-clients';
import { traceSchedulingProfilerId } from '@mcp-abap-adt/adt-strategies';

const executor = new AdtExecutor(connection, logger);
const classes = executor.getClassExecutor({
  ...classExecutorDocuments,
  scheduled: traceSchedulingProfilerId,
});

const scheduled = await classes.scheduleTrace({ sqlTrace: true });
if (!scheduled.ok) throw new Error(scheduled.getError().message);
await classes.runWithProfiler(
  { className: 'ZCL_MY_CLASSRUN' },
  { profilerId: scheduled.getResult().value },
);
```

The other runtime implementations (`getDumps`, `getSystemMessages`,
`getGatewayErrorLog`, `getAtcLog`, `getApplicationLog`, `getDdicActivation`,
`getCrossTrace`, `getSt05Trace`) answered documents already; only their factory
signature and the caching changed. Each has its `<x>Documents` set exported.

## 10. System probes and Accept negotiation

**`isModernAdtSystem`, `getSystemInformation` and `fetchDiscoveryEndpoints`
raise what is not an answer.** A `404`, `405` or `501` is still the absent
endpoint — `false`, `null`, an empty set. Anything else — no network, an expired
session, a `401`, a `500` — used to be swallowed into the same answer, so
`createAdtClient` handed a legacy client to a modern system reached over a broken
connection. It is raised now:

```typescript
import { createAdtClient } from '@mcp-abap-adt/adt-clients';

try {
  const client = await createAdtClient(connection, logger);
} catch (error) {
  // The connection, not the system's age. Restore it and ask again.
}
```

**Accept negotiation keeps its state on the connection.** The corrected-`Accept`
caches and the on/off switch were module globals: a header learned on one
system was sent to every other, and one client's `enableAcceptCorrection`
switched it for all. Each connection has its own now. If you ran two clients
against two systems in one process and one of them saw a stray `406`, this is
why it stops.

## 11. Answers that are no longer rewrapped

Several creates and unlocks caught SAP's refusal and threw a new `Error` that
dropped the response (behavior definition, interface, table, table type,
transport), the interface create re-checked the status itself, the function
include delete judged `isDeleted`, and the legacy transport read fabricated a
`404`. All of them answer SAP's reply now, through your `analyse`. Code that
caught those exceptions should read `answer.ok` instead — which it already had
to for every other refusal.

## 12. Removed exports

Values `@mcp-abap-adt/adt-clients` 22.0.1 exported from its root and 23.0.0 does
not — measured against the 22.0.1 barrels — and where each went:

| removed | replacement, in `@mcp-abap-adt/adt-strategies` |
|---|---|
| `parseTransportTree`, `parseCreatedTransport`, `parseObjectEntries` | `transportTree`, `transportCreated`, `transportObjectEntries` (strategies) |
| `parseSearchResults` | `readSearchHits(xml)`, or `utilSearchHits` as a strategy |
| `searchHits`, `namedItems`, `nodeContents`, `inactiveObjects` | `utilSearchHits`, `utilNamedItems`, `utilNodeContents`, `utilInactiveObjects` |
| `activationRunId`, `extractRunId` | `utilActivationRunId`, `extractRunId` |
| `whereUsedReferences` | `utilWhereUsedReferences` |
| `compareRecordedAt` | `compareRecordedAt` |
| `TransportSearchConfigurationMissing` | none — `list` no longer chooses a configuration (§4) |

Type exports that left with their readings: `ObjectVersion` (now
`IObjectVersion`), `ISearchResult`, `IAdtObjectHit`, `IInactiveObjectsResponse`,
`IRepositoryNodeChild`, `IRepositoryNodeContents`, `IRepositoryObjectNode`,
`IWhereUsedListResult`, `IWhereUsedReference`, `ITransportTree`,
`ITransportTreeLink`, `ITransportTreeNode`, `ITransportTreeRequest`,
`ITransportTreeTask`, `ICreatedTransport`, `ITransportObjectEntry` — all from
adt-strategies now. `IObjectReference` comes from `@mcp-abap-adt/interfaces-adt`,
as it always did. `INamedItem` is still exported here, and from adt-strategies.
`PackageHierarchyCodeFormat` and `PackageHierarchySupportedType` are gone: they
described a walk that left in 19.0.0.

Added, one per implementation that takes a result set: `abapGitDocuments`,
`applicationLogDocuments`, `atcDocuments`, `atcLogDocuments`,
`classExecutorDocuments`, `crossTraceDocuments`, `ddicActivationDocuments`,
`feedDocuments`, `gatewayErrorLogDocuments`, `profilerDocuments`,
`programExecutorDocuments`, `runtimeDumpsDocuments`, `st05TraceDocuments`,
`systemMessagesDocuments`, `traceSchedulingDocuments`, with their `I…Results`
types.

Also gone, but never reachable from the package root — listed because the old
docs named some of them: the verdicts `packageDeletionRefusal`,
`publicationRefusal`, `validationUnsupported`, `validationUnavailable`,
`startedRun`, `testDoublesVerdict` and the reading `runId` (§3, §6);
`IAbapGitAbortedError` and `IAbapGitTimeoutError` (§8); `LockCapability`,
`VersionsCapability`, the `*ForUpdate` lock helpers, `acquireLockHandle` (§5);
`getDomainInfo`, `checkTransportRequirements`, `parsePackageDeletionCheck`,
`searchObjectsTyped`, the `Unsupported*OperationError` classes.

## If something used to work and now does not compile

- **`IAbapConnection` not exported by `@mcp-abap-adt/interfaces-adt`** — §1.
- **`list()` wants an argument** — §4, *Transport requests*.
- **`getRepo` / `unlink({ package })` / `getErrorLog(pkg)`** — §8.
- **`getRunId` / `getStatusResponse` / `getClassName`** — §6.
- **A name no longer exported** — §12.

## If something compiles and behaves differently

- **A value you read as an array is a string** — you are getting the document;
  pass the reading (§4, §9).
- **A delete, publication or unit-test start that used to fail now succeeds** —
  pass the analyser that used to be applied for you (§3).
- **A lock "succeeded" with an empty handle** — §5.
- **A probe throws where it answered `false`** — §10; the connection is broken.
