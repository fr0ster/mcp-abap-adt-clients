# @mcp-abap-adt/adt-strategies

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
the package-deletion and publication verdicts. [MIGRATION-23.md](../../docs/usage/MIGRATION-23.md)
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

await client.getPackage().delete({ packageName: 'ZPKG' }, { analyse: analyseDeletion });
```

```typescript
import { analyseActivation, asItCame } from '@mcp-abap-adt/adt-strategies';

const answer = await client
  .getClass()
  .activate({ className: 'ZCL_X' }, { analyse: analyseActivation });

if (!answer.ok) {
  for (const message of answer.getError().messages) {
    console.error(`[${message.type}] ${message.text}`);
  }
}
```

## Why it cannot be one rule

ADT does not have a single way of saying no. From the recordings in
[`corpus/adt/`](../../corpus) at the root of this repository:

| the "no" | arrives as | shape |
|---|---|---|
| activation did not happen | 200 | `<chkl:messages>` with `<msg type="E">` |
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
when the form is not known in advance, and three built for one question:
`analyseMessageClassMessage(msgno)`, `analyseUnitTestStart` and
`analyseUnsupportedStatus(statuses, what)`.

Each answers an `IAdtMessageFailure`: the contract's `IAdtError` plus every
message in the document, normalised. SAP spells severity three ways and carries
a T100 key in exactly one of the forms; the reading flattens that so a caller
matching on `type === 'E'` does not have to know which carrier they got.

### The whole surface

| export | what it is |
|---|---|
| `analyseActivation` | `<chkl:messages>` — a `<msg type="E">` is the verdict, `activationExecuted="false"` is not |
| `analyseCheck` | `<chkrun:checkRunReports>` — the status first, then the messages |
| `analyseDeletion` | `del:isDeleted` and `del:isDeletable` on a `200`, and **every** `del:message`, each with its severity and the T100 key read from its long-text link |
| `analyseValidation` | name admissibility: two families answer with a body, three with the status |
| `analyseUnitTest` | `aunit:runResult` — alerts on the method that failed |
| `analyseException` | `<exc:exception>`, wherever it arrives |
| `analysePublication` | a service binding's publication job: `<SEVERITY>` inside a `200` |
| `analyseCdsTestDoubles` | the CDS test-doubles check |
| `analyseMessageClassMessage(msgno)` | the class answering is not the message existing |
| `analyseUnitTestStart` | a started run whose answer names no run id |
| `analyseUnsupportedStatus(statuses, what)` | renames a `404`/`405`/`501`… as `UNSUPPORTED_OPERATION` — a system without the resource, told apart from a refusal |
| `analyseAny` | dispatches on the root element when the form is not known in advance |
| `readActivationRefusal`, `readCheckRunRefusal`, `readDeletionRefusal`, `readValidationRefusal`, `readUnitTestRefusal`, `readExceptionRefusal`, `readPublicationRefusal`, `readCdsTestDoublesRefusal`, `readMessageClassMessageAbsence`, `readAdtRefusal` | the readings underneath — pure functions over a document, answering `AdtRefusal` or `null` |
| `isIndeterminateWalkAnswer` | says an empty node structure cannot be read: an empty package and one that does not exist answer identically |
| `AdtMessage`, `AdtRefusal`, `IAdtMessageFailure` | the shapes those produce |

**The result axis** — each a `IResultStrategy` for one slot of an `adt-clients`
result set:

| export | slot it fills | answers |
|---|---|---|
| `asItCame`, `rawOf` | any | the answer unchanged; `answer.data` as text |
| `transportTree`, `transportCreated`, `transportSearchConfigurations`, `transportObjectEntries` | `getRequest`: `list`; `created`/`createdTask`; `searchConfigurations`; `objects` | `ITransportTree`, `ICreatedTransport`, `ITransportSearchConfiguration[]`, `ITransportObjectEntry[]` |
| `objectVersions` | any versionable type: `versions` | `IObjectVersion[]` |
| `unitTestRunId` | `getUnitTest`/`getCdsUnitTest`: `run` | the run id, from the header ADT puts it in |
| `featureToggleRuntimeState`, `featureToggleCheckState` | `getFeatureToggle`: `runtimeState`, `checkState` | the two states |
| `utilSearchHits`, `utilNamedItems`, `utilNodeContents`, `utilInactiveObjects`, `utilActivationRunId`, `utilWhereUsedReferences` | `getUtils`: `search`, `types`, `node`, `inactive`, `activation`, `whereUsed` | the parsed shapes; `readSearchHits`, `readNamedItems`, `readNodeStructure`, `extractRunId` are the pure functions underneath |
| `abapGitRepos`, `abapGitErrorLog`, `abapGitExternalRepo` | `AdtAbapGitClient`: `repos`, `errorLog`, `externalRepo` | `IAbapGitRepo[]` (with `repositoryId`, `pullLink`, `logLink`), log entries, branches |
| `atcSystemCheckVariant`, `atcWorklistId`, `atcStartedRun`, `atcWaitingRun`, `atcRunStatus` | `getAtc`: `checkVariant`, `worklist`, `startedRun`, `waitingRun`, `runStatus` | the variant, the worklist id, the run |
| `profilerTraceEntries`, `profilerHitList`, `profilerStatements`, `profilerDbAccesses`, `compareRecordedAt` | `getProfiler`: `list`, `hitlist`, `statements`, `dbAccesses` | trace entries and the three views; an ordering by recorded time |
| `traceSchedulingTypes`, `traceSchedulingRequests`, `traceSchedulingProfilerId` | executors: `types`, `requests`, `scheduled` | the catalogue, the requests, the profiler id |
| `feedDescriptors`, `feedVariants`, `feedEntries`, `feedSystemMessages`, `feedGatewayErrors`, `feedGatewayErrorDetail` | `getFeeds` | the Atom feeds, read |

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
