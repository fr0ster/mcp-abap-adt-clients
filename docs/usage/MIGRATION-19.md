# Migrating to 19.0.0

19.0.0 stops this package from deciding anything.

Two rules produced every change below, and both were already the design's
stated intent:

1. **The verdict on a response belongs to the consumer.** The result and error
   strategies are injected so that decision is yours. The library was taking it
   first — three failure strategies wired as the default at 81 call sites, a
   check-run parser that turned a report into a pass or a fail, and a connection
   wrapper that read bodies and threw on what it recognised.
2. **One member, one endpoint call.** A member that sends several requests has
   already chosen an order and a shape for you, and it cannot be given a reading
   at all: `IResultStrategy` takes one answer.

Nothing changes silently. Every item below is a name that no longer exports, a
call that now returns where it used to throw, or a signature the compiler will
stop you on.

It needs `@mcp-abap-adt/interfaces` 43.0.0, whose own migration is in its
CHANGELOG.

---

## 1. The error strategies are gone

| removed | what it read |
|---|---|
| `activationRefusal` | `<msg type="E">` in an activation checklist |
| `validationRefusal` | `<SEVERITY>ERROR</SEVERITY>` in a validation |
| `deletionRefusal` | `isDeletable` in a deletion check |
| `parseCheckRunResponse` | a check-run report, into pass/fail plus message lists |
| `parseDeletionCheck`, `assertDeletable`, `DeletionNotPermittedError` | the deletion check, as an exception |
| `assertActivationSucceeded` | the same checklist, as an exception |
| `withRefusalDetection` | any body, into a thrown refusal — see §5 |
| `waitForCleanCheckRun` | a check run, repeatedly, until it came back empty |

Their source is in git at the `18.0.2` tag. Lift what you want into your own
code and pass it as `analyse`:

```typescript
const answer = await client.getClass().activate(config, { analyse: myVerdict });
```

Write it from the responses your own system gives you.

## 2. The default `analyse` is none

Members pass `options?.analyse` through and substitute nothing.

**An ADT refusal delivered inside a `2xx` now arrives as a success carrying that
document.** A failed activation, a validation that says the name is taken, a
deletion check that says no — all of them used to arrive as an `IAdtError`.

```typescript
// 18.x: a failed activation was a failure.
const answer = await cls.activate(config);
if (!answer.ok) console.log(answer.getError().message);

// 19.0: it is the checklist, and you decide.
const answer = await cls.activate(config, { analyse: myActivationVerdict });
```

A transport failure is still a failure, carrying its response and the request it
arrived on. If you want nothing judged at all, including a `403`:

```typescript
import { nothingIsARefusal } from '@mcp-abap-adt/adt-clients';

const answer = await cls.read(config, 'active', { analyse: nothingIsARefusal });
// answer.ok is true for anything that came back; a request that never
// completed is still a failure, because there is no answer to read.
```

## 3. The check functions return their report

Eighteen `check.ts` modules raised `Error('… check failed: …')` when the report
held a `type="E"` message. A check run that finds a syntax error is a check run
that *worked*, and the throw cost you the findings, the line numbers and the
T100 keys.

```typescript
// 18.x
try { await cls.check(config); } catch (e) { /* a joined string */ }

// 19.0
const answer = await cls.check(config);   // the report, whatever it says
```

Two retries went with them: `checkDdl` re-ran a check answered `notProcessed`
saying the data definition did not exist, and `checkAccessControl` re-ran one
answered `notProcessed` with no findings. Both were waits on the server. If you
need one, write the loop around the call.

`checkDdl` and `checkAccessControl` also lost a trailing `logger?` parameter
that existed only for those retries. Neither is exported from this package.

## 4. `update` takes a complete document

Six updates fetched the current document, patched the config's named fields into
it, and PUT the result: **domain, package, dataElement, tableType, transport**
and **functionGroup**, which also locked and unlocked around it.

They send `config.document` now.

```typescript
// 18.x
await client.getDomain().updateMetadata({ domainName: 'ZD', description: 'new' });

// 19.0
const current = await client.getDomain().readMetadata({ domainName: 'ZD' });
const edited = patchTheDescription(String(current.getResult().value), 'new');

const handle = (await client.getDomain().lock({ domainName: 'ZD' })).getResult().value;
await client.getDomain().updateMetadata(
  { domainName: 'ZD', document: edited },
  { lockHandle: handle },
);
await client.getDomain().unlock({ domainName: 'ZD' }, handle);
```

**A partial update no longer exists.** The fields beside `document` describe a
create; on an update they are not sent, and a field you leave out of the
document is not preserved, because nothing was read to preserve it from.
Guaranteeing the document is valid is yours, which is the point: this package
does not know what your system will accept.

The patch helpers went with the read — `patchDomainXml` and its four siblings.

One read-modify-write stays: `AdtMessageClassMessage`. A message is a row inside
its class's document and no endpoint writes a single message.

## 5. The connection wrapper no longer reads bodies

`withRefusalDetection` did two jobs. It read bodies into refusals and threw —
gone. It also put `{ method, url }` back on an answer the connection had
stripped it from, and that survives as `withRequestTrace`.

**A `200` carrying `<exc:exception>` no longer throws.** It is a `200` carrying a
document. `IAdtError.request` still fills itself on every failure, including a
status the transport refused.

## 6. Walks are yours

| removed | what it did |
|---|---|
| `getPackageContents`, `getPackageContentsList`, `getPackageHierarchy` | one node-structure request per object type, plus a descent into subpackages |
| `getIncludesList`, `listFunctionModules`, `listFunctionGroupIncludes` | the object's node structure, then the child type's node |

`fetchNodeStructure` answers one level and keeps its `node` reading. Compose the
walk you want over it — `scripts/lib/packageWalk.ts` and
`scripts/lib/functionGroupChildren.ts` in this repository are two consumers
doing exactly that, and are the shortest migration to copy.

**One behaviour leaves with them, and it is worth knowing.**
`/repository/nodestructure` answers `200` with **zero bytes** for a package that
does not exist, and `200` with a tree for one that does. "There is nothing in
it" and "there is no such thing" arrive byte-identical. The walk used to raise
for the empty root; that distinction is now yours to make, on the body.

## 7. Sequences are yours

| removed | what to write instead |
|---|---|
| `getWhereUsedList` | `getWhereUsedScope`, `modifyWhereUsedScope` (no request), `getWhereUsed` |
| `AdtClass.updateTestClasses` | `lock`, `getLocalTestClass().update(config, { lockHandle })`, `unlock` |
| `updateClassWithCheck` | `check`, then `update` |
| `AdtAtc.run` | `resolveCheckVariant`, `createWorklist`, `startRun(worklistId, …)` |
| the wait inside `activateObjectsGroup` | it is the POST; `extractRunId` reads the run id from `Location`, `activateObjectsGroup` answers the **run id**, `getActivationRun(runId, { withLongPolling: true })` says what it is doing, `getActivationResults(runId)` fetches them |
| `runWithProfiling` | `scheduleTrace`, then `runWithProfiler(target, { profilerId })` |
| the wait inside `AdtAbapGitClient.pull` | `listRepos` for the link, `pull({ package, pullLink })`, then poll `getRepo` |
| the metadata read inside `getTableContents` | `getTableColumns(name)`, then `getTableContents({ …, sql_query })` |

Two of these deserve naming, because the old member hid a decision rather than
just an order.

**`getWhereUsedList` fell back silently.** When `/usageReferences/scope`
answered `404` — some S/4 releases do — it searched unscoped and filtered the
references client-side. Your system, your decision.

**`activateObjectsGroup` answers the run id, not the body.** The server puts it
in `Location` and the body carries nothing you need, while both members that
continue the sequence take an id. `activationRunId` is that reading and
`extractRunId` reads a `Location` value directly, both exported, for a caller
whose own reading keeps the exchange instead.

**`pull` waited on a job it could not stop.** The `AbortSignal` you passed
aborted this client's own `sleep`, never the server's work. Written in your own
loop, that is visible instead of explained.

```typescript
const repos = await abapGit.listRepos();
const repo = repos.getResult().value.find((r) => r.package === 'ZPKG');
await abapGit.pull({ package: 'ZPKG', pullLink: repo.pullLink });

// Read once before testing the condition: `repo` was fetched before the POST,
// so its status says nothing about this pull.
const deadline = Date.now() + 600_000;
let status = (await abapGit.getRepo('ZPKG')).getResult().value;
while (status.status === 'R' && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 5_000));
  status = (await abapGit.getRepo('ZPKG')).getResult().value;
}
if (status.status === 'E' || status.status === 'A') {
  await abapGit.getErrorLog('ZPKG');
}
```

`pull` answers nothing now, like `link` and `unlink`; `IAbapGitPullResult` held
a `finalStatus` and an `errorLog`, both products of the polling.

`AdtAtc` no longer implements `IAdtRunnable`, and the two executors no longer
implement `IClassExecutor` / `IProgramExecutor` — those composites include the
atom whose member was the sequence. Each class declares the atoms it does
satisfy. The composites stay in the contract for an implementation that joins
them.

## 8. A create does not ask the server who you are

`AdtService`'s binding create and `AdtBehaviorImplementation.create` read
`/core/http/systeminformation` before their POST, to fill `masterSystem` and
`responsible`. Two requests for one create — and that read swallowed its own
failure and answered `null`, so a create could silently write neither.

Both fields come from your config, or from the system context you set on the
client.

## 9. Input validation is gone, with one exception

454 guards fired before any request was built — `Error('Class name is
required')`, thirty-five of them in `AdtService` alone. The field was already
declared required in the type, so the compiler had said it; the guard added a
string this package invented, thrown out of a member whose contract promises an
`IAdtResponse`. Your `analyse` never ran, your reading never ran, and the case
never reached your code.

Nothing replaces them. Where the value reaches `encodeSapObjectName` the URL is
built from what you gave and SAP answers; where a method is called on it first a
`TypeError` is raised in your own stack. **So "every missing field now reaches
the server" is not the promise** — the promise is that this package stops
answering for it.

**The exception: `packageName` on a create.** An object created without a
package cannot be removed through ADT at all. The deletion check resolves
through the package, so it answers "Object does not exist" while the name stays
taken for good, and clearing it is SAP GUI territory. Twenty-five handlers guard it, and the guard throws before any request. A package is not among them: what
binds a package is `superPackage`, and a top-level package has none.

## 10. What did not move

Result strategies. `rawDocument` is still the default reading everywhere it was,
so no member's return type changed, and `wireItself` still hands back the whole
exchange. `whereUsedReferences` is new and is *not* a default: it is the
reference-list shape the old walker returned, offered by name.

`IWhereUsedListResult` lost `objectName` and `objectType`. A reading sees the
answer, and the document does not name what was searched — the member used to
copy them from its own parameters. You know what you asked for.
