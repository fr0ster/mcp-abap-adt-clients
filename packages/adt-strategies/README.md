# @mcp-abap-adt/adt-strategies

> **Since adt-clients 36.0.0** every call below to one of the 32 members that
> take `options.headers` (`create`, `update`, `updateMetadata`, `delete`,
> `checkDeletion`, `check`, `activate` and the others listed in
> [A request's own headers](https://github.com/fr0ster/mcp-abap-adt-clients#a-requests-own-headers)) passes the request's own `Accept` / `Content-Type` pair.
> In these samples `headers` stands for that pair, an `IAdtHeaders`
> (`{ accept, contentType }`); the member sends exactly it.

The readings and verdicts for [`@mcp-abap-adt/adt-clients`](https://www.npmjs.com/package/@mcp-abap-adt/adt-clients):
what an ADT answer becomes, and whether it is a failure — derived from recorded
ADT answers.

## Why this is a separate package

`adt-clients` interprets **nothing**. Every member makes one ADT request and
answers the document SAP sent, unless you built the implementation with a
reading; it judges nothing, unless you pass `analyse` with the call. That is
deliberate: which part of a document you want, and whether an answer is a
failure, depend on which object types you touch and what you were doing, and a
library that decided for you would be wrong for somebody.

Which leaves a real gap for anyone who has no opinion yet. This package fills
it — with an opinion, stated as one, and built from evidence rather than taste.
Since `adt-clients` 23.0.0 it holds **every** reading and verdict that library
used to apply on its own: the transport tree, the search hits, the version feed,
the unit-test run id, the abapGit repositories, the ATC and profiler shapes,
the package-deletion and publication verdicts. [MIGRATION-23.md](../adt-clients/docs/usage/MIGRATION-23.md)
maps each old behaviour to the strategy that replaces it.

**Two axes, two moments.** A *result* strategy is given once, when you build an
implementation — one slot per member, in the result set `adt-clients` exports
for it (`transportDocuments`, `utilDocuments`, …). An *error* strategy is given
with every call, as `options.analyse`:

```typescript
import { transportDocuments } from '@mcp-abap-adt/adt-clients';
import {
  analyseDeletion,
  transportSearchConfigurations,
  transportTree,
} from '@mcp-abap-adt/adt-strategies';

const requests = client.getRequest({
  ...transportDocuments,
  list: transportTree,
  searchConfigurations: transportSearchConfigurations,
});

await client.getPackage().delete({ packageName: 'ZPKG' }, { headers, analyse: analyseDeletion });
```

```typescript
import { analyseActivation, asItCame } from '@mcp-abap-adt/adt-strategies';

const answer = await client
  .getClass()
  .activate({ className: 'ZCL_X' }, { headers, analyse: analyseActivation });

if (!answer.ok) {
  for (const message of answer.getError().messages) {
    console.error(`[${message.type}] ${message.text}`);
  }
}
```

## Why it cannot be one rule

ADT does not have a single way of saying no. From the recordings in
[`corpus/adt/`](../adt-clients/corpus/adt) (`answers/` and `debugger/`) in adt-clients' directory of this repository:

| the "no" | arrives as | shape |
|---|---|---|
| activation did not happen | 200 | `<chkl:messages>` with `<msg type="E">` |
| activation activated nothing | 200 | `<ioc:inactiveObjects>`, or `activationExecuted="false"` with no message and the object still inactive |
| the object was never checked | 200 | `chkrun:status="notProcessed"` |
| the check found an error | 200 | `<chkrun:checkMessage type="E">` |
| the deletion was declined | 200 | `del:isDeleted="false"` |
| the object may not be deleted | 200 | `del:isDeletable="false"` |
| the name is taken (DDL, function group) | **200** | `<SEVERITY>ERROR</SEVERITY>` |
| the name is taken (class, domain, table) | **400** | `<exc:exception>` |
| locked, absent, unlocked write | 403 / 404 / 423 | `<exc:exception>` |

Read the last three rows together. One question, asked of one endpoint family,
answered two ways depending on the object type. A rule keyed on the status
misses the first of them silently and reports a taken name as free.

## What is in it

**The error axis.** One strategy per document form —
`analyseActivation`, `analyseCheck`, `analyseDeletion`, `analyseValidation`,
`analyseUnitTest`, `analyseException`, `analysePublication`,
`analyseCdsTestDoubles` — `analyseAny`, which dispatches on the root element
when the form is not known in advance, and five built for one question:
`analyseMessageClassMessage(msgno)`, `analyseObjectProperties`, `analyseUnitTestStart`,
`analysePublicationLock`, `analyseDebuggeeEnd`, `analyseDebuggerFreed` and
`analyseUnsupportedStatus(statuses, what)`.

Each answers an `IAdtMessageFailure`: the contract's `IAdtError` plus every
message in the document, normalised (`analyseActivation` an
`IAdtActivationFailure`, which adds `stillInactive`: what SAP listed as still
inactive). SAP spells severity three ways and carries
a T100 key in exactly one of the forms; the reading flattens that so a caller
matching on `type === 'E'` does not have to know which carrier they got.

### Why a strategy says what it says

Several of these exist because SAP answers something other than what it means —
a `403` on a service binding's LOCK that is to be ignored
(`analysePublicationLock`), a refusal inside a `200` (`analysePublication`,
`analyseActivation`, `analyseDeletion`). Why `analysePublicationLock` exists is in
[ERRATA.md](ERRATA.md) — shipped in this package, and kept in adt-clients at
[docs/usage/ERRATA.md](https://github.com/fr0ster/mcp-abap-adt-clients/blob/main/packages/adt-clients/docs/usage/ERRATA.md).

### The whole surface

| export | what it is |
|---|---|
| `analyseActivation` | what `POST /activation` answered, answering `IAdtActivationFailure` (the messages and `stillInactive`): a `<msg type="E">` is a refusal; `ioc:inactiveObjects` is not activated, its objects in `stillInactive`; an empty body is activated; any other document is not activated ("the answer does not state the activation"); `activationExecuted="false"` with no message is judged by the inactive list the member hands as `context.activation` — a named object still listed is not activated, none is nothing to activate, no list is not decided. The table and its measurements are in [ERRATA.md](ERRATA.md) |
| `stillInactiveAmong(named, inactiveObjects)` | the judgement after a silent checklist, on either activation path: the entries of an inactive-objects answer (`ioc:inactiveObjects`, or the flat `adtcore:objectReferences` of 7.40) whose `uri` or `parentUri` is one of `named`; the transport-only entry never counts; `null` for an answer that is no `2xx` list |
| `analyseCheck` | `<chkrun:checkRunReports>` — the status first, then the messages |
| `analyseDeletion` | `del:isDeleted` and `del:isDeletable` on a `200`, and **every** `del:message`, each with its severity and the T100 key read from its long-text link |
| `analyseValidation` | name admissibility: two families answer with a body, three with the status |
| `analyseUnitTest` | `aunit:runResult` — alerts on the method that failed |
| `analyseException` | `<exc:exception>`, wherever it arrives |
| `analysePublication` | a service binding's publication job: `<SEVERITY>` inside a `200` |
| `analysePublicationLock` | a service binding's LOCK before a publish or unpublish: a `403` (an editor holds the binding) is no failure, the lock comes back without a handle; every other refusal as `analyseException`. A caller who wants the `403` to stop them passes `analyseException` instead |
| `analyseDebuggeeEnd` | an ABAP debugger step or termination: `500 AdiFailed` subtype `debuggeeEnded` or `terminateDebuggee` is the debuggee ending as asked, no failure — the result is the document naming the subtype; every other refusal as `analyseException` |
| `analyseDebuggerFreed` | `terminateDebugger`: a `500` served as `text/plain` or with an empty body, with no ADT exception document, is the debugger freeing its own session, no failure; everything else (a `500` with an exception document or served as anything else, other statuses, a connection failure, a body that is not a string) as `analyseException` |
| `analyseCdsTestDoubles` | the CDS test-doubles check |
| `analyseMessageClassMessage(msgno)` | the class answering is not the message existing: a class document without the message, and an answer that is no message class document at all (empty, not XML, another document), are refused `ADT_OBJECT_NOT_FOUND` (since 0.14.0 the second too) |
| `analyseObjectProperties` | a `200` from `getUtils().getObjectProperties` is not the object being described: an answer that is no `opr:objectProperties` document holding `opr:object` (empty, not XML, another document such as a sign-in page) is refused `ADT_OBJECT_NOT_FOUND` (since 0.15.0) |
| `analyseUnitTestStart` | a started run whose answer names no run id |
| `analyseUnsupportedStatus(statuses, what)` | renames a `404`/`405`/`501`… as `UNSUPPORTED_OPERATION` — a system without the resource, told apart from a refusal |
| `analyseAny` | dispatches on the root element when the form is not known in advance |
| `readActivationRefusal(document, activation?)` | the activation reading underneath `analyseActivation`, answering `AdtActivationRefusal` or `null`; `activation` is the facts of a silent checklist (`AdtActivationFacts`) |
| `readCheckRunRefusal`, `readDeletionRefusal`, `readValidationRefusal`, `readUnitTestRefusal`, `readExceptionRefusal`, `readPublicationRefusal`, `readCdsTestDoublesRefusal`, `readMessageClassMessageAbsence`, `readObjectPropertiesAbsence`, `readAdtRefusal` | the readings underneath — pure functions over a document, answering `AdtRefusal` or `null`; of an activation's answers `readAdtRefusal` dispatches the checklist only |
| `readExceptionSubType` | the subtype an `exc:exception` names (`com.sap.adt.communicationFramework.subType`), or `undefined` |
| `isIndeterminateWalkAnswer` | says an empty node structure cannot be read: an empty package and one that does not exist answer identically |
| `AdtMessage`, `AdtRefusal`, `IAdtMessageFailure`, `AdtActivationRefusal`, `IAdtActivationFailure`, `IAdtStillInactive`, `AdtActivationFacts` | the shapes those produce |

**The result axis** — each a `IResultStrategy` for one slot of an `adt-clients`
result set, except the readings of members that have no slot yet (the table
after this one):

| export | slot it fills | answers |
|---|---|---|
| `asItCame`, `rawOf` | any | the answer unchanged; `answer.data` as text |
| `transportTree`, `transportCreated`, `transportSearchConfigurations`, `transportObjectEntries` | `getRequest`: `list`; `created`/`createdTask`; `searchConfigurations`; `objects` | `ITransportTree`, `ICreatedTransport`, `ITransportSearchConfiguration[]`, `ITransportObjectEntry[]` |
| `objectVersions` | any versionable type: `versions` | `IObjectVersion[]` |
| `unitTestRunId` | `AdtExecutor.getClassTestRunner`: `run` | the run id, from the header ADT puts it in |
| `featureToggleRuntimeState`, `featureToggleCheckState` | `getFeatureToggle`: `runtimeState`, `checkState` | the two states |
| `utilSearchHits`, `utilNamedItems`, `utilNodeContents`, `utilInactiveObjects`, `utilActivationRunId`, `utilWhereUsedReferences` | `getUtils`: `search`, `types`, `node`, `inactive`, `activation`, `whereUsed` | the parsed shapes; `readSearchHits`, `readNamedItems`, `readNodeStructure`, `extractRunId` are the pure functions underneath |
| `utilDiscoveryCollections`, `ACTIVATION_RUNS_COLLECTION` | `getUtils`: `discovery` | the path of every collection (`app:collection/@href` that is a path) as a `ReadonlySet<string>`, empty for an answer that is no `app:service` document; `has(ACTIVATION_RUNS_COLLECTION)` says whether the system offers `/activation/runs` (exact, never a prefix) |
| `abapGitRepos`, `abapGitErrorLog`, `abapGitExternalRepo` | `AdtAbapGitClient`: `repos`, `errorLog`, `externalRepo` | `IAbapGitRepo[]` (with `repositoryId`, `pullLink`, `logLink`), log entries, branches |
| `atcSystemCheckVariant`, `atcWorklistId`, `atcStartedRun`, `atcWaitingRun`, `atcRunStatus` | `getAtc`: `checkVariant`, `worklist`, `startedRun`, `waitingRun`, `runStatus` | the variant, the worklist id, the run |
| `profilerTraceEntries`, `profilerHitList`, `profilerStatements`, `profilerDbAccesses`, `compareRecordedAt` | `getProfiler`: `list`, `hitlist`, `statements`, `dbAccesses` | trace entries and the three views; an ordering by recorded time |
| `traceSchedulingTypes`, `traceSchedulingRequests`, `traceSchedulingProfilerId` | executors: `types`, `requests`, `scheduled` | the catalogue, the requests, the profiler id |
| `feedDescriptors`, `feedVariants`, `feedEntries`, `feedSystemMessages`, `feedGatewayErrors`, `feedGatewayErrorDetail` | `getFeeds` | the Atom feeds, read |

**Readings of members with no slot.** `IUtilResults` of interfaces-adt names no
slot for these `getUtils()` members, so the member answers the document as it
came (`IAdtResponse<string>`) and you read it with the pure function — or pass
the strategy to your own code over the wire answer. `options.analyse` is still
yours to set on the member: the reading judges nothing, it only reads a
document.

| export | reads what this member answers | answers |
|---|---|---|
| `readObjectOutline`, `objectOutline` | `getObjectOutline` (`<object uri>/objectstructure`) | `IObjectOutline`: the root element and its children, with visibility, level and the links' positions |
| `readStructureElementInfo`, `structureElementInfo` | `getStructureElementInfo` (`/sap/bc/adt/ddic/elementinfo?path=`) | `IStructureElementInfo`: the structure's code, name, URI and short text; `components` in document order (name — a field's, or `.include` / `.append` —, `includeName`, `partOfInclude`, `includeLevel`, `dataElement`, `dataType`, `length`, `decimals`, `isKey`, every property as written); `includes`, the components naming a structure; the package |
| `readServiceDefinitionElementInfo`, `serviceDefinitionElementInfo` | `getServiceDefinitionElementInfo` (`/sap/bc/adt/ddic/srvd/elementinfo?path=`) | `IServiceDefinitionElementInfo`: the definition's code, name, URI and short text; `entities` (name, URI, `alias` — absent when the `expose` has no `as`), in document order, not the source's; `links` (an extension's); the package |

**An unknown name is not a `404`.** Both element-info endpoints answer `200`
with an element info that names nothing (measured on premise and on ABAP cloud,
2026-11-05), so the answer is `ok`. The reading answers `name === undefined`
with empty `components` / `entities`: that is the object being absent — decide
it there, or with your own `analyse`.

```typescript
import { readStructureElementInfo } from '@mcp-abap-adt/adt-strategies';

const answer = await client.getUtils().getStructureElementInfo('/DMO/S_TRAVELX');
if (answer.ok) {
  const info = readStructureElementInfo(answer.getResult().value);
  if (info.name === undefined) {
    // no such structure
  } else {
    info.includes.map((c) => [c.name, c.includeName, c.partOfInclude]);
  }
}
```

**A code read from an answer is an `IAdtAnsweredObject`** (since 0.16.0). The
readings that take a type code from an answer — `readSearchHits` /
`utilSearchHits`, `readNodeStructure` / `utilNodeContents`,
`utilInactiveObjects`, `utilWhereUsedReferences` and the trace readings' program
references — look it up once against the ADT type tables of
`@mcp-abap-adt/interfaces-adt` (every variant: an answer does not say which
release sent it) and answer `{ type: AdtTypeCode }` for a code a table holds,
`{ unknownType: string }` — the text exactly as ADT sent it — for any other.
`answeredObject(text)` is that lookup, for a consumer reading a code itself:

```typescript
import { answeredObject } from '@mcp-abap-adt/adt-strategies';

const object = answeredObject('CLAS/OC');
if (object.type !== undefined) {
  // a code of the tables: act on it
} else {
  console.warn(`not a code the library serves: ${object.unknownType}`);
}
```

**Use a named strategy where the form is known.** `analyseAny` answers `null`
for a document it does not recognise, and `null` here means "not a failure" — so
a form nobody wrote a reading for passes as a success.

**A reading answers `null` for two different things**: a document that is not a
refusal, and a document of a form it was not written for. A caller who needs to
tell those apart calls the specific reading rather than the dispatcher.

**None of the result readings is a default.** `adt-clients` answers the
document; shaping it is the consumer's decision — which fields, to what end —
and these are offered by name for the consumer who wants the shape the library
used to impose. Most readings answer an empty shape for a document they cannot
read — judging the document is `analyse`'s job, not the reading's. Two throw when
the document has no `tm:root`: `transportTree` and `transportCreated`, because
an empty tree or an empty request would report something that does not exist. `adt-clients` lets a reading's exception surface as itself.

## How the defaults are justified

Every strategy is tested against the recorded answer it was derived from **and**
against the recorded success it must be told apart from. That pairing is the
point: on most of these endpoints the refusal and the success share a status, so
a reading that fires on both would look correct and recognise nothing.

No SAP system. The corpus is the fixture.

One row of the table was wrong when it was first written — a table was listed
under validation, and the corpus rejected it on the first run: a table answers
`400` with an exception document, not `<SEVERITY>ERROR</SEVERITY>`. That is the
argument for this package in one line.

## Licence

LGPL-3.0-only.
