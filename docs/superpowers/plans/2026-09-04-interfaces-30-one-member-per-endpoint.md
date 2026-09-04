# `@mcp-abap-adt/interfaces` 30.0.0 — one member per endpoint, and the shape is injected

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every ADT member answers the contract, and the consumer says what the
answer becomes by injecting a strategy into the implementation once — never by
calling a second method and never by passing a parser at the call. Measured, that
is 32 members answering the contract today out of 106 ADT members; when this is
done it is all of them.

**Architecture:** A contract member names an endpoint and the *contract* it
answers. How much of the answer becomes a value is a strategy the consumer
supplies to the implementation at construction, so the member's result type is a
type parameter of its atom with today's shape as the default. `interfaces` names
the injection point and the type; every strategy implementation ships from
`@mcp-abap-adt/adt-clients`, because this package emits no function.

**Tech Stack:** TypeScript (types only — no runtime code is emitted), Biome,
`tsc --noEmit` over `src/__typechecks__/` as the test suite.

**Spec:** `docs/architecture/DECISIONS.md` in this repository — decisions 5, 16,
18, 19 and 20 — together with
`docs/superpowers/specs/2026-09-04-adt-clients-onto-interfaces-29-design.md` in
`mcp-abap-adt-clients`, whose "Package contents: one member, and the strategy
decides the shape" section deferred exactly this work to 30.0.0.

**Repository:** the work happens in `/home/okyslytsia/prj/mcp-abap-adt-interfaces`.
This plan lives in `mcp-abap-adt-clients` because that is the consumer whose
migration is blocked on it; the two releases are ordered — **30.0.0 is published
to npm first, and `adt-clients` migrates once, onto 30.0.0, never onto 29.0.0.**

---

## Global Constraints

- All artifacts in English — source, comments, commit messages.
- **This package emits no class and no function.** Since 29.0.0 it is 50 constants
  and otherwise empty modules. `IResultStrategy` is a *type*; `packageTree`,
  `dumpList` and every other strategy implementation belongs to `adt-clients`.
- **No per-call strategy argument on any member.** Decision 16: a parse overload
  was tried across 23 members and reverted, because it costs every implementer a
  second signature and moves the result's meaning from the contract to the call
  site. The choice is injected into the implementation, once.
- **A member's strategy sees the answer of that member's own request.** Whatever
  requests an implementation issues before it — to obtain a node id, a scope
  document, a CSRF token — are the implementation's business, never appear in the
  contract, and reach the consumer only if they fail.
- Never change `package.json` version without the maintainer asking. Publishing is
  the maintainer's, always.
- Every removal is verified by **enumerate, edit, count**: list the targets by an
  exact criterion, edit, then grep every touched symbol across the whole
  repository *including comments, `docs/` and `README.md`*, and compare the counts
  before and after. Six review rounds on #63 found zero defects in the types and
  every one of them in prose.
- `npx biome check src`, `npm run build` and `npm run test:check` are clean at the
  end of every task.

---

## Decisions taken by the maintainer, 2026-09-04

These are settled. A task that finds them inconvenient reports back rather than
reinterpreting them.

1. **One endpoint is one member; the shape is a strategy.** Members that differ
   only in how far the same answer was parsed collapse into one.
2. **The strategy is injected once per implementation**, through the implementing
   library's factory — not passed at each call. The contract expresses this by
   making the result type a type parameter of the atom.
3. **The strategy is handed the whole answer**: `IResultStrategy<T> = (answer:
   IAdtWireResponse) => T`. It gets the status and the headers, not only the body,
   because a reading may need them — and because `analyse`, the error strategy on
   the other axis, already takes the answer for the same reason.
4. **Preliminary requests are invisible to the contract.** The library builds the
   tree, the list or the raw document out of what the server sent; where the
   consumer goes with that structure afterwards is the consumer's business.
5. **`IDebugger`, `IAdtDebuggerSession`, `IMemorySnapshots` and `IAdtBatch` leave
   this package** for a research branch of `adt-clients`, and come back measured.
   Batch is the precedent: a contract nobody can yet state should not be
   published, because every consumer that adopts it has to be migrated again when
   it changes. Memory snapshots go with the debugger for the plainest reason there
   is — **how they are meant to work is not yet clear, and a contract published so
   that something is there is worse than none.**
6. **Package recursion leaves the contract.** `maxDepth` and `includeSubpackages`
   described a walk the library performed; a member answers one read.
7. **Every ADT member answers the contract — the whole surface, in this release.**
   Not the measured duplication alone. A release that fixes half of them leaves the
   claim "this package follows the principle" untrue for another version, and costs
   `adt-clients` a second migration.
8. **`lock`, `unlock`, `getVersions` and `getVersionSource` stop throwing**,
   superseding the 29.0.0 design's carve-out for them. Their stated reason was that
   they "have no failure half"; a lock refused because another user holds it is a
   403, so they do. Decision 20 already said it: a thrown error is invisible to the
   compiler, so a consumer never learns from the type that a failure path exists.

---

## What was measured, 2026-09-04

Every row was read in the source, not inferred.

| resource | members today | verdict |
|---|---|---|
| package contents | `getPackageContentsList`, `getPackageHierarchy` | **collapse into one.** Two members answering one question — what is in this package — differing only in the shape they build (`packageContentsList.ts:220`, `packageHierarchy.ts:433`) and in a walk (`maxDepth`, default 5). |
| `POST /repository/nodestructure` | `fetchNodeStructure` | **stays, as the helper member it is.** That the package member reaches this resource internally is not a contract question: a contract says what is asked, not which requests an implementation issues to answer it. The member remains for a caller who wants the node structure *as* the node structure — a class's includes, a program's parts — and it takes its shape by injection like everything else. |
| `/repository/informationsystem/search` | `search`, `search<T>(criteria, parse)` | **collapse.** One member and a per-call parse overload; decision 16 forbids the overload as the general mechanism, and decision 2 above replaces it with injection. |
| `/cts/transportrequests` (read) | `list`, `listNodes`, `listNodes<T>(parse, …)` | **collapse.** `IAdtTransport.ts:174` and `:177` **both answer `ITransportTree`** — the same shape from the same request, under two names — and `:188` is the parse overload again. |
| `/repository/informationsystem/usageReferences` | `getWhereUsedList`, `getWhereUsedScope` | **leave.** Different resources: `whereUsed.ts:232` reads `/usageReferences/scope`, `:283` reads `/usageReferences`. `getWhereUsedList` is a chain over both with a fallback for systems that do not expose the scope sub-resource (`whereUsed.ts:390`). A chain is an operation, not a second reading. `getWhereUsed` is not in the contract at all. **The earlier draft of this plan claimed three members over one endpoint; that was wrong.** |
| `/cts/transportrequests` (write) | `create`, `delete` | **leave.** POST and DELETE are different operations, not two readings. |
| runtime — dumps, atcLog, atcRun, systemMessages, applicationLog, ddicActivation, gatewayErrorLog, st05, crossTrace, trace, profiler | ~25 members answering **bare `Promise<IAdtWireResponse>`** | **migrate.** These never received the 29.0.0 treatment: they answer the transport envelope rather than a contract, so an implementation cannot both honour them and name its results. That is why Task 12 of the `adt-clients` plan has `RuntimeDumps` dropping `implements IRuntimeDumps` — the defect is here, not there. |
| `IDebugger` | 42 members | **leaves.** Not audited and not going to be yet; still being researched. |
| `IMemorySnapshots` | 9 members | **leaves** with it. Reached in `adt-clients` through `getDebugger().getMemorySnapshots()`, and how it is meant to function is still open. |
| `includeRawXml` — `IAdtShared.ts:190`, `IAdtUtilities.ts:320` | a boolean that switches the shape | **remove.** A flag that changes what the result *is* is a strategy wearing a parameter's clothes. |
| `IAdtService` | 16 members, every one answering the envelope | **migrate.** The largest single pocket of the shape 29.0.0 removed elsewhere, and the first audit missed it by looking only under `runtime/`. |
| abapGit (7), feature toggle (5), unit test (3), feeds (6), trace scheduling (5), ATC run (2), `runtime/types.ts` (1) | answer their own type directly | **migrate.** A member that answers `Promise<T>` gives a consumer nowhere to receive a failure but `catch`, which is what decision 20 forbids. |
| `lock`, `unlock`, `getVersions`, `getVersionSource` | `@throws`, by the 29.0.0 carve-out | **migrate.** Superseded by the maintainer 2026-09-04: a lock refused by another user's lock is a 403, so the carve-out's premise — "no failure half" — is false. |
| `IAdtCapabilities.search` | a search on the CRUD atoms | **remove.** The question belongs to `IAdtInformationSystem`; here it is a second member for one endpoint, across two files. |
| `ITrace.readWith`, `IProfiler.ITraceReadingWithParser` | per-call parsers | **remove.** Four existed, not two. |

**What is deliberately untouched:** `src/auth/**`, `src/session/**`,
`src/storage/**`, `src/token/**`, `src/connection/**`, `src/logging/**` — around
36 members. They are not ADT endpoints: there is no server answer to shape and no
ADT failure to classify. `IAbapConnection.makeAdtRequest` answering
`IAdtWireResponse` is the transport itself, which is precisely what an
`IResultStrategy` is handed.

By URL, the rest of the runtime surface is already one member per endpoint —
`traces`, `memory`, `feeds`, `gw/errorlog`, `systemmessages` each build a distinct
URL per member. The defect there is the envelope, not duplication.

---

## File Structure

In `/home/okyslytsia/prj/mcp-abap-adt-interfaces`:

| file | responsibility after this work |
|---|---|
| `src/adt/IAdtResponse.ts` | adds `IResultStrategy<T>` beside `IAdtResult<T>` — the two halves of "what shape is this answer" live together |
| `src/adt/IAdtUtilities.ts` | `IAdtPackageBrowsing<TContents>` has one `getPackageContents`; `IAdtRepositoryStructure<TNode>` keeps `fetchNodeStructure` as the helper it is; `IAdtInformationSystem<TSearch>` has one `search`; `IAdtGroupLifecycle<TInactive>` loses `includeRawXml` |
| `src/adt/IAdtShared.ts` | loses `includeRawXml` and the field documented as "Raw XML response (if includeRawXml was true)" |
| `src/adt/IAdtTransport.ts` | `IAdtTransport<TList>` with one read member, answering `IAdtResponse` |
| `src/runtime/*.ts` | each remaining contract answers `IAdtResponse<T>` with `T` a parameter of its interface |
| `src/runtime/IDebugger.ts`, `src/runtime/IAdtDebuggerSession.ts`, `src/adt/IAdtBatch.ts` | **deleted** |
| `src/service/IAdtService.ts` | sixteen members answering `IAdtResponse`, keyed by a results record |
| `src/adt/IAdtAbapGit.ts`, `IAdtFeatureToggle.ts`, `IAdtUnitTest.ts`, `src/feeds/IFeedRepository.ts`, `src/execution/ITraceScheduling.ts`, `src/runtime/IAtcRun.ts`, `src/runtime/types.ts` | the members that answered past the contract now answer it |
| `src/adt/IAdtCapabilities.ts` | the last four `@throws` members answer; `search` leaves the atoms |
| `src/index.ts` | exports follow every rename and deletion |
| `src/__typechecks__/` | one file per changed family; these are the tests |
| `docs/architecture/DECISIONS.md` | decision 22 records where a strategy is injected and why not per call |
| `CHANGELOG.md` | the 30.0.0 entry, naming each removal and what a consumer on 29.0.0 must now do |

---

### Task 1: `IResultStrategy`, and a typecheck that proves a consumer can inject one

**Files:**
- Modify: `src/adt/IAdtResponse.ts`
- Modify: `src/index.ts`
- Test: `src/__typechecks__/resultStrategy.ts` (create)

**Interfaces:**
- Consumes: `IAdtWireResponse` from `src/connection/IAbapConnection.ts`.
- Produces: `IResultStrategy<T>`, used by every later task.

- [ ] **Step 1: Write the failing typecheck**

Create `src/__typechecks__/resultStrategy.ts`:

```typescript
// Compile-only assertions. If these stop compiling, the types regressed.
//
// A strategy is how a consumer says what an answer should become. It is a type
// here and a function there: this package emits nothing, so the assertions below
// stand in for the implementations `adt-clients` ships.

import type { IAdtWireResponse, IResultStrategy } from '../index';

const answer: IAdtWireResponse = {
  data: '<pak:package/>',
  status: 200,
  statusText: 'OK',
  headers: {},
};

/** The whole document, untouched — what a backup consumer needs and 29.0.0 had no way to ask for. */
const raw: IResultStrategy<string> = (wire) => String(wire.data);

/** A reading that needs more than the body. */
const withEtag: IResultStrategy<{ etag?: unknown; body: string }> = (wire) => ({
  etag: wire.headers.etag,
  body: String(wire.data),
});

/** A strategy is data: it can be held, passed and swapped. */
const chosen: IResultStrategy<string> = raw;

export const _assertions = [chosen(answer), withEtag(answer).body] as const;
```

- [ ] **Step 2: Run the typecheck to verify it fails**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check
```

Expected: FAIL — `Module '"../index"' has no exported member 'IResultStrategy'`.

- [ ] **Step 3: Declare the type**

In `src/adt/IAdtResponse.ts`, directly after `IAdtResult<T>`:

```typescript
/**
 * How an answer becomes a value.
 *
 * `IAdtResult` says a result has a value; this says where that value came from.
 * One endpoint serves callers who want very different amounts of it — an MCP
 * server passing the answer to a language model, where size is a budget; a backup
 * tool that must keep the document byte for byte; a script that wants two fields —
 * and no reading among those is more correct than the others.
 *
 * So the reading is not the library's. It is injected into the implementation
 * once, and the member's result type follows it. What is *not* offered is a second
 * member per reading: that was decision 16, and a per-call parse argument was
 * tried across 23 members and reverted (decision 20).
 *
 * **It is handed the whole answer, not the body.** A reading may need the status
 * or a header — an ETag, a `Content-Location` — and `analyse`, the strategy on the
 * error axis, already takes the answer for the same reason. The two axes are
 * symmetric: one decides whether an answer is a failure, the other what a
 * non-failure becomes.
 *
 * **It sees this member's own answer.** Requests an implementation issues on the
 * way — to obtain a node id, a scope document, a token — are its own business and
 * reach the consumer only as failures.
 *
 * ```typescript
 * const raw: IResultStrategy<string> = (wire) => String(wire.data);
 * ```
 */
export type IResultStrategy<T> = (answer: IAdtWireResponse) => T;
```

- [ ] **Step 4: Export it**

In `src/index.ts`, add `IResultStrategy` to the existing `export type { … } from './adt/IAdtResponse'` block, in alphabetical position.

- [ ] **Step 5: Run the typecheck to verify it passes**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check && npx biome check src
```

Expected: both silent.

- [ ] **Step 6: Commit**

```bash
git add src/adt/IAdtResponse.ts src/index.ts src/__typechecks__/resultStrategy.ts
git commit -m "feat: a strategy names how an answer becomes a value"
```

---

### Task 2: A package has one contents member, and the node structure stays a helper

`getPackageContentsList` and `getPackageHierarchy` answer the same question — what
is in this package — and differ only in the shape the library chose to build.

`fetchNodeStructure` is **not** the third of them. It is the node structure asked
for as itself, which a caller does for a class's includes as readily as for a
package, and it belongs on the helper atom. That the package member reaches the
same resource on its way is the implementation's business: a contract states what
is asked, never which requests were issued to answer it.

**Files:**
- Modify: `src/adt/IAdtUtilities.ts` (`IAdtPackageBrowsing`, `IAdtRepositoryStructure`)
- Modify: `src/index.ts`
- Test: `src/__typechecks__/utilities.ts`

**Interfaces:**
- Consumes: `IResultStrategy<T>` (Task 1), `IRepositoryNodeContents`, `IPackageContentItem`, `IPackageHierarchyNode`.
- Produces:
  - `IAdtPackageBrowsing<TContents = IPackageContentItem[]>` with one member,
    `getPackageContents(packageName, options?)`.
  - `IAdtRepositoryStructure<TNode = IRepositoryNodeContents>`, unchanged in
    membership: `fetchNodeStructure(parentType, parentName, options?)` and
    `getObjectStructure(objectType, objectName)`.
  - `IGetPackageContentsOptions` replaces `IGetPackageContentsListOptions` and
    `IGetPackageHierarchyOptions`, which no longer exist — and carries neither
    `maxDepth` nor `includeSubpackages`.
  - `fetchNodeStructure`'s third parameter becomes `IGetNodeContentsOptions`
    (`nodeId`, `withShortDescriptions`) rather than a bare `nodeId`, because both
    reach the wire.

- [ ] **Step 1: Write the failing typecheck**

Replace the package-browsing half of `src/__typechecks__/utilities.ts` with:

```typescript
/** The tree reading — what getPackageHierarchy used to be, now a strategy's shape. */
class TreeBrowsing implements IAdtPackageBrowsing<IPackageHierarchyNode> {
  async getPackageContents(
    _packageName: string,
  ): Promise<IAdtResponse<IPackageHierarchyNode>> {
    return succeeded({ name: 'Z1', type: 'DEVC/K', children: [] } as IPackageHierarchyNode);
  }
}

/** The backup consumer's reading, which 29.0.0 could not express at all. */
class RawBrowsing implements IAdtPackageBrowsing<string> {
  async getPackageContents(): Promise<IAdtResponse<string>> {
    return succeeded('<asx:abap/>');
  }
}

/** The default is the shape 29.0.0's list member answered, so a consumer who names nothing is unmoved. */
const byDefault: IAdtPackageBrowsing = {
  async getPackageContents(): Promise<IAdtResponse<IPackageContentItem[]>> {
    return succeeded([]);
  },
};

/** The helper keeps its own member, and takes its shape the same way. */
class RawNodes implements IAdtRepositoryStructure<string> {
  async fetchNodeStructure(): Promise<IAdtResponse<string>> {
    return succeeded('<asx:abap/>');
  }
  async getObjectStructure(): Promise<IAdtResponse<string>> {
    return succeeded('');
  }
}

export const _nodeAssertions = [
  byDefault,
  new TreeBrowsing(),
  new RawBrowsing(),
  new RawNodes(),
] as const;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check
```

Expected: FAIL — neither atom takes a type argument, and `getPackageContents` does
not exist.

- [ ] **Step 3: Collapse the two package members into one**

In `src/adt/IAdtUtilities.ts`:

```typescript
/**
 * What a package holds.
 *
 * Its own atom rather than part of {@link IAdtRepositoryStructure}: a package is a
 * container ADT gives its own resource, and reading what is in one is a question
 * about that container — **not** about the tree an implementation happens to walk
 * to answer it. Which requests it issues, and to which resource, is its business.
 *
 * **One member.** Until 30.0.0 there were two: `getPackageContentsList`, answering
 * `IPackageContentItem[]`, and `getPackageHierarchy`, answering
 * `IPackageHierarchyNode`. One question, two answers, and which one a caller got
 * was decided by the method name rather than by the caller. What the answer
 * becomes is now {@link IResultStrategy}'s, injected into the implementation once
 * — a flat list, a tree, names and type codes alone, or the document untouched.
 * `IPackageContentItem` and `IPackageHierarchyNode` survive as the shapes the
 * shipped strategies return.
 *
 * **No `maxDepth`, no `includeSubpackages`.** Those described a walk the library
 * performed on the caller's behalf across many requests. A member answers one
 * read; a consumer holding a result with sub-package references walks them itself,
 * which is what every consumer of the old tree did anyway.
 */
export interface IAdtPackageBrowsing<TContents = IPackageContentItem[]> {
  getPackageContents(
    packageName: string,
    options?: IGetPackageContentsOptions,
  ): Promise<IAdtResponse<TContents>>;
}

/** What the request itself takes; `maxDepth` is deliberately not among them. */
export interface IGetPackageContentsOptions {
  withShortDescriptions?: boolean;
}
```

- [ ] **Step 4: Parameterise the helper without changing its membership**

`IAdtRepositoryStructure` keeps both of its members. `fetchNodeStructure` gains
`TNode` and takes its options as an object:

```typescript
/**
 * `/sap/bc/adt/repository/nodestructure` and `/objectstructure` — the tree asked
 * for as the tree, and one object's parts.
 *
 * This is the helper a caller reaches for when the node structure *is* the
 * question: a class's includes, a program's parts, a node walked by hand. Package
 * contents are not asked here — {@link IAdtPackageBrowsing} owns that question,
 * and whether its implementation comes through this resource is invisible from
 * outside, as it should be.
 */
export interface IAdtRepositoryStructure<TNode = IRepositoryNodeContents> {
  fetchNodeStructure(
    parentType: string,
    parentName: string,
    options?: IGetNodeContentsOptions,
  ): Promise<IAdtResponse<TNode>>;

  /** The parts one object is made of. */
  getObjectStructure(
    objectType: string,
    objectName: string,
  ): Promise<IAdtResponse<string>>;
}

/**
 * What the node-structure request itself takes.
 *
 * `node_id` selects a sub-node of the parent; without it the server answers the
 * parent's own level. Both reach the wire (decision 17), which is why they are
 * here and `maxDepth` is not.
 */
export interface IGetNodeContentsOptions {
  nodeId?: string;
  withShortDescriptions?: boolean;
}
```

- [ ] **Step 5: Follow the removals through `src/index.ts`**

Remove `IGetPackageContentsListOptions` and `IGetPackageHierarchyOptions` from the
export blocks; add `IGetPackageContentsOptions` and `IGetNodeContentsOptions`. Keep
`IAdtPackageBrowsing`, `IPackageContentItem`, `IPackageHierarchyNode` and
`IRepositoryNodeContents`.

- [ ] **Step 6: Enumerate, edit, count**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
grep -rn "getPackageContentsList\|getPackageHierarchy\|IGetPackageContentsListOptions\|IGetPackageHierarchyOptions" src docs README.md
```

Expected: **0 hits.** Any hit in a doc comment or in `DECISIONS.md` prose is a
defect of this task, not a later one — that is where every review round on #63
found its defects.

`fetchNodeStructure` must still be present, and exactly once as a declaration:

```bash
grep -rn "fetchNodeStructure" src | wc -l
```

- [ ] **Step 7: Verify it passes**

```bash
npm run test:check && npx biome check src && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat!: a package has one contents member, and the shape is injected"
```

---

### Task 3: `search` keeps one signature

**Files:**
- Modify: `src/adt/IAdtUtilities.ts` (`IAdtInformationSystem`)
- Test: `src/__typechecks__/utilities.ts`

**Interfaces:**
- Consumes: `IResultStrategy<T>` (Task 1).
- Produces: `IAdtInformationSystem<TSearch = ISearchResult[]>`; the
  `search<T>(criteria, parse)` overload no longer exists.

- [ ] **Step 1: Write the failing typecheck**

Add to `src/__typechecks__/utilities.ts`:

```typescript
/** The 1.3MB hit list, kept whole — the reading the parse overload used to serve. */
class RawSearch implements IAdtInformationSystem<string> {
  async search(_c: ISearchObjectsParams): Promise<IAdtResponse<string>> {
    return succeeded('<adtcore:objectReferences/>');
  }
  async getWhereUsedList(): Promise<IAdtResponse<IWhereUsedListResult>> {
    return succeeded({} as IWhereUsedListResult);
  }
  async getWhereUsedScope(): Promise<IAdtResponse<string>> {
    return succeeded('');
  }
  modifyWhereUsedScope(scopeXml: string): string {
    return scopeXml;
  }
  async getVirtualFoldersContents(): Promise<IAdtResponse<string>> {
    return succeeded('');
  }
  async getAllTypes(): Promise<IAdtResponse<INamedItem[]>> {
    return succeeded([]);
  }
}
export const _searchAssertions = [new RawSearch()] as const;
```

- [ ] **Step 2: Run it to verify it fails**

Expected: FAIL — `IAdtInformationSystem` takes no type argument.

- [ ] **Step 3: Parameterise the atom and delete the overload**

In `src/adt/IAdtUtilities.ts`:

```typescript
export interface IAdtInformationSystem<TSearch = ISearchResult[]> {
  /**
   * Objects matching a query.
   *
   * One signature. Until 30.0.0 a second overload took `parse: (data: unknown) => T`
   * so a caller could keep the document — a recorded hit list runs to 473 rows and
   * 1.3MB, with nested references `ISearchResult` deliberately does not carry.
   * That reading is still available and is now chosen the way every other reading
   * is: an {@link IResultStrategy} given to the implementation, with `TSearch`
   * following it. Decision 20 — choice is offered by injection, never by more
   * contract, and a per-call argument is a second signature every implementer pays
   * for whether or not their callers use it.
   */
  search(criteria: ISearchObjectsParams): Promise<IAdtResponse<TSearch>>;

  // … getWhereUsedList, getWhereUsedScope, modifyWhereUsedScope,
  //    getVirtualFoldersContents, getAllTypes unchanged …
}
```

Leave the where-used members exactly as they are: measured, they read two
different resources, and `getWhereUsedList` is a chain over both.

- [ ] **Step 4: Verify**

```bash
npm run test:check && npx biome check src
grep -rn "parse: (data: unknown)" src docs README.md
```

Expected: typecheck silent. The grep still reports the transport overload — Task 5
removes that one; it must report nothing under `IAdtUtilities.ts`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat!: search has one signature, and the reading is injected"
```

---

### Task 4: A flag that changes the shape is a strategy, not a parameter

**Files:**
- Modify: `src/adt/IAdtShared.ts:190` and the field at `:225`
- Modify: `src/adt/IAdtUtilities.ts:320` (`IAdtGroupLifecycle.getInactiveObjects`)
- Test: `src/__typechecks__/utilities.ts`

**Interfaces:**
- Consumes: `IResultStrategy<T>` (Task 1).
- Produces: `IAdtGroupLifecycle<TInactive = IInactiveObjectsResult>`; no
  `includeRawXml` anywhere in the package.

- [ ] **Step 1: Write the failing typecheck**

```typescript
/** Inactive objects, kept as the server sent them. */
class RawInactive implements IAdtGroupLifecycle<string> {
  async activateObjectsGroup(): Promise<IAdtResponse<string>> {
    return succeeded('');
  }
  async getInactiveObjects(): Promise<IAdtResponse<string>> {
    return succeeded('<ioc:inactiveObjects/>');
  }
}
export const _inactiveAssertions = [new RawInactive()] as const;
```

- [ ] **Step 2: Run it to verify it fails**

Expected: FAIL — `IAdtGroupLifecycle` takes no type argument.

- [ ] **Step 3: Remove the flag and parameterise**

In `src/adt/IAdtUtilities.ts`, `getInactiveObjects` loses the `includeRawXml`
option and answers `IAdtResponse<TInactive>`; in `src/adt/IAdtShared.ts`, the
`includeRawXml` field and the result field documented as *"Raw XML response (if
includeRawXml was true)"* are deleted. Record the reason in the doc comment:

```typescript
/**
 * What is inactive right now.
 *
 * **No `includeRawXml`.** A boolean that changes what the result *is* is a reading
 * chosen at the call site, which is the shape decisions 16 and 20 rule out — and it
 * could offer exactly two readings, chosen by whoever wrote the flag. `TInactive`
 * spans the space instead.
 */
getInactiveObjects(): Promise<IAdtResponse<TInactive>>;
```

- [ ] **Step 4: Enumerate, edit, count**

```bash
grep -rn "includeRawXml\|Raw XML response" src docs README.md
```

Expected: **0 hits.**

- [ ] **Step 5: Verify and commit**

```bash
npm run test:check && npx biome check src
git add -A
git commit -m "feat!: a shape flag is a strategy, and includeRawXml leaves the contract"
```

---

### Task 5: Transport reads once, and answers the contract

`list` and `listNodes` return **the same `ITransportTree`** from the same request,
and neither answers `IAdtResponse`.

**Files:**
- Modify: `src/adt/IAdtTransport.ts:174-191`
- Test: `src/__typechecks__/transportTree.ts`

**Interfaces:**
- Consumes: `IResultStrategy<T>` (Task 1), `IAdtResponse`.
- Produces: `IAdtTransport<TList = ITransportTree>` with a single `list(options?)`
  answering `Promise<IAdtResponse<TList>>`. `listNodes` and its overload are gone.

- [ ] **Step 1: Write the failing typecheck**

In `src/__typechecks__/transportTree.ts`:

```typescript
/** The numbers alone — an MCP server's reading, where size is a budget. */
class Numbers implements IAdtTransport<string[]> {
  async list(_o?: IListTransportsOptions): Promise<IAdtResponse<string[]>> {
    return succeeded(['E19K900123']);
  }
}

/** The tree with its containers, descriptions and the language a request carries. */
class Tree implements IAdtTransport {
  async list(_o?: IListTransportsOptions): Promise<IAdtResponse<ITransportTree>> {
    return succeeded({} as ITransportTree);
  }
}
export const _transportAssertions = [new Numbers(), new Tree()] as const;
```

- [ ] **Step 2: Run it to verify it fails**

Expected: FAIL — `list` answers `Promise<ITransportTree>`, not `IAdtResponse`, and
the interface takes no type argument.

- [ ] **Step 3: Collapse the three into one**

```typescript
export interface IAdtTransport<TList = ITransportTree> {
  /**
   * The transport requests the server lists.
   *
   * Until 30.0.0 this resource had three members: `list` and `listNodes`, which
   * answered the identical `ITransportTree`, and a `listNodes<T>(parse, …)`
   * overload. One request, one member; a caller wanting the numbers alone, the
   * tree, or the document untouched injects an {@link IResultStrategy}.
   *
   * The tree is the reading that carries the containers, the description and the
   * **language** of a request — none of which a consumer could reach before
   * without re-fetching and parsing the document themselves.
   */
  list(options?: IListTransportsOptions): Promise<IAdtResponse<TList>>;
}
```

- [ ] **Step 4: Enumerate, edit, count**

```bash
grep -rn "listNodes" src docs README.md
```

Expected: **0 hits.**

- [ ] **Step 5: Verify and commit**

```bash
npm run test:check && npx biome check src
git add -A
git commit -m "feat!: transport lists once, answering the contract"
```

---

### Task 6: The runtime contracts answer the contract

Eleven interfaces answer bare `Promise<IAdtWireResponse>` — the envelope as the
result, which 29.0.0 removed everywhere except here. Nothing can implement them and
also name its results, which is why `adt-clients` was about to stop declaring them.

**Files:**
- Modify: `src/runtime/IRuntimeDumps.ts`, `IAtcLog.ts`, `IAtcRun.ts`,
  `ISystemMessages.ts`, `IApplicationLog.ts`, `IDdicActivation.ts`,
  `IGatewayErrorLog.ts`, `ISt05Trace.ts`, `ICrossTrace.ts`, `ITrace.ts`,
  `IProfiler.ts`
- Test: `src/__typechecks__/runtimeContracts.ts` (create)

**Interfaces:**
- Consumes: `IResultStrategy<T>` (Task 1), `IAdtResponse`.
- Produces: each interface gains one type parameter per distinct answer, defaulting
  to `string` — the document as it arrived, which is what every one of these
  members hands back today once the envelope is opened. Example:
  `IRuntimeDumps<TList = string, TDump = string>`.

- [ ] **Step 1: List the members, exactly**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
grep -rn "Promise<IAdtWireResponse>" src/runtime | grep -v IDebugger
```

Write the resulting list into this task before editing: it is both the work list
and the count the final grep is compared against.

- [ ] **Step 2: Write the failing typecheck**

Create `src/__typechecks__/runtimeContracts.ts`:

```typescript
// Compile-only assertions. A runtime contract answers IAdtResponse, and its shape
// is the implementation's to choose — the same rule the ADT contracts follow.

import type { IAdtResponse, IRuntimeDumps } from '../index';

const succeeded = <T>(value: T): IAdtResponse<T> => ({
  ok: true,
  getResult: () => ({ value }),
  getError: () => undefined,
});

/** Four fields per dump: an MCP server's reading. */
interface IDumpSummary {
  id: string;
  at: string;
  program: string;
  message: string;
}

class ShortDumps implements IRuntimeDumps<IDumpSummary[], string> {
  async listByUser(): Promise<IAdtResponse<IDumpSummary[]>> {
    return succeeded([]);
  }
  async getById(): Promise<IAdtResponse<string>> {
    return succeeded('<dump/>');
  }
}

/** The default is the document, so a consumer who names nothing still compiles. */
const byDefault: IRuntimeDumps = new ShortDumps() as never;
export const _runtimeAssertions = [byDefault, new ShortDumps()] as const;
```

- [ ] **Step 3: Run it to verify it fails**

Expected: FAIL — `IRuntimeDumps` takes no type arguments and its members answer
`IAdtWireResponse`.

- [ ] **Step 4: Migrate the eleven**

For each: add the type parameters, wrap every result in `IAdtResponse<…>`, and
delete the now-unused `IAdtWireResponse` import. `IRuntimeDumps` is the worked
example; copy the shape, never the values — read what each member actually requests
before choosing how many parameters it needs. Two members reading the same resource
at different granularity share one parameter.

```typescript
/**
 * Short dumps — the list, and one dump.
 *
 * Answers `IAdtResponse`, like everything else since 29.0.0. Until 30.0.0 these
 * answered `IAdtWireResponse` directly, so an implementation had to choose between
 * honouring the contract and naming its own results; the shape is now a parameter,
 * defaulting to the document as it arrived.
 */
export interface IRuntimeDumps<TList = string, TDump = string> {
  listByUser(
    user?: string,
    options?: Omit<IRuntimeDumpsListOptions, 'query'>,
  ): Promise<IAdtResponse<TList>>;

  getById(
    dumpId: string,
    options?: IRuntimeDumpReadOptions,
  ): Promise<IAdtResponse<TDump>>;
}
```

- [ ] **Step 5: Enumerate, edit, count**

```bash
grep -rn "Promise<IAdtWireResponse>" src/runtime | grep -v IDebugger
```

Expected: **0 hits**, against the count recorded in Step 1.

- [ ] **Step 6: Verify and commit**

```bash
npm run test:check && npx biome check src && npm run build
git add -A
git commit -m "feat!: the runtime contracts answer the contract, not the envelope"
```

---

### Task 7: The debugger, memory snapshots and batch leave for research

Not a deprecation and not a deletion of the work: they move to a research branch of
`@mcp-abap-adt/adt-clients` and come back measured — one member per endpoint, and
results named rather than framed. 39 of `IDebugger`'s 42 members answer the
envelope, which is what a contract looks like before anyone knows what the
endpoints return.

**Files:**
- Delete: `src/runtime/IDebugger.ts`, `src/runtime/IAdtDebuggerSession.ts`,
  `src/runtime/IMemorySnapshots.ts`, `src/adt/IAdtBatch.ts`
- Delete: `src/__typechecks__/debuggerSession.ts`, `src/__typechecks__/batch.ts`
- Modify: `src/index.ts`

`IMemorySnapshots` leaves with the debugger, decided by the maintainer on
2026-09-04: how it is meant to function is not yet clear, and publishing a
contract so that something is there is not a service to anyone. It is therefore
**not** migrated by Task 6 — check that Task 6's work list excluded it.

**Interfaces:**
- Produces: nothing. This task only removes.

- [ ] **Step 1: Record what leaves**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
grep -rn "IDebugger\|IAdtDebuggerSession\|IMemorySnapshots\|IBatch\|IAdtBatch" src/index.ts | wc -l
```

Write the number here. It is what Step 4 is compared against.

- [ ] **Step 2: Delete the files and their typechecks**

```bash
git rm src/runtime/IDebugger.ts src/runtime/IAdtDebuggerSession.ts \
       src/runtime/IMemorySnapshots.ts src/adt/IAdtBatch.ts
git rm src/__typechecks__/debuggerSession.ts src/__typechecks__/batch.ts
```

- [ ] **Step 3: Remove every export**

In `src/index.ts`, delete the `./adt/IAdtBatch`, `./runtime/IDebugger`,
`./runtime/IAdtDebuggerSession` and `./runtime/IMemorySnapshots` blocks in full —
including the names re-exported from them at lines 43, 440-444, 477-488 and
491-496 of the 29.0.0 file.

- [ ] **Step 4: Enumerate, edit, count**

```bash
grep -rn "IDebugger\|DebuggerSession\|IMemorySnapshots\|IAdtBatch\|IBatchPayload\|IBatchRequestPart" src docs README.md
```

Expected: **0 hits in `src`.** Hits in `docs/architecture/DECISIONS.md` that
*describe* the removal are correct and stay; hits that still present them as part
of the surface are defects — fix them here.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:check && npx biome check src && npm run build
git add -A
git commit -m "refactor!: the debugger, memory snapshots and batch leave for research"
```

---

### Task 8: `IAdtService` answers the contract

Sixteen members, every one of them returning the transport envelope — the largest
single pocket of the shape 29.0.0 removed everywhere else, and missed by the first
audit because it lives under `src/service/` rather than `src/adt/`.

**Files:**
- Modify: `src/service/IAdtService.ts`
- Test: `src/__typechecks__/service.ts` (create)

**Interfaces:**
- Consumes: `IResultStrategy<T>` (Task 1), `IAdtResponse`.
- Produces: `IAdtService<R extends IAdtServiceResults = IAdtServiceDocuments>`,
  and the two record types it takes.

**Why a record and not sixteen type parameters.** One parameter per distinct
answer is the rule everywhere in this plan, and above three it stops being usable:
`IAdtService<A, B, C, D, E, …>` is a signature nobody can call. Where an interface
has more than three distinct answers, the parameters travel together as a record —
the same idea, spelled once. `adt-clients` already carries its result sets this
way (`IClassResults`, `IDumpResults`), so this is the shape a consumer meets on
both sides.

- [ ] **Step 1: List the sixteen and their answers**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
grep -nE '^  [a-zA-Z_]+[<(]' src/service/IAdtService.ts
```

Record the list in this task. Members answering the same document share one key.

- [ ] **Step 2: Write the failing typecheck**

`src/__typechecks__/service.ts`, asserting an implementation that answers named
shapes and one that keeps the documents:

```typescript
import type { IAdtResponse, IAdtService } from '../index';

const succeeded = <T>(value: T): IAdtResponse<T> => ({
  ok: true,
  getResult: () => ({ value }),
  getError: () => undefined,
});

interface IBindingSummary {
  name: string;
  published: boolean;
}

/** A consumer reading two fields where the default keeps the document. */
class SummarisingService
  implements IAdtService<{ binding: IBindingSummary; document: string; nothing: void }>
{
  async readServiceBinding(): Promise<IAdtResponse<IBindingSummary>> {
    return succeeded({ name: 'ZSB', published: true });
  }
  // … the remaining fifteen, each answering its key …
}

export const _serviceAssertions = [new SummarisingService()] as const;
```

- [ ] **Step 3: Run it to verify it fails**

Expected: FAIL — `IAdtService` takes no type argument, and its members answer
`IAdtWireResponse`.

- [ ] **Step 4: Declare the record and migrate the sixteen**

```typescript
/** One key per distinct answer this contract has, not one per member. */
export interface IAdtServiceResults {
  bindingTypes: unknown;
  binding: unknown;
  check: unknown;
  activation: unknown;
  deletion: unknown;
  odata: unknown;
  publication: unknown;
  nothing: unknown;
}

/** The shipped default: every answer is the document as it arrived. */
export interface IAdtServiceDocuments extends IAdtServiceResults {
  bindingTypes: string;
  binding: string;
  check: string;
  activation: string;
  deletion: string;
  odata: string;
  publication: string;
  nothing: void;
}

export interface IAdtService<R extends IAdtServiceResults = IAdtServiceDocuments> {
  getServiceBindingTypes(): Promise<IAdtResponse<R['bindingTypes']>>;
  readServiceBinding(name: string): Promise<IAdtResponse<R['binding']>>;
  // … and so on for the rest, each keyed by what it answers …
}
```

`createAndGenerateServiceBinding` answered a `{ createResult, generateResult }`
pair of envelopes; it answers `IAdtResponse<R['binding']>` for the create and
leaves the generate to its own member, because a member that answers two requests
in one value is the envelope problem in a different costume.

- [ ] **Step 5: Enumerate, edit, count**

```bash
grep -c "IAdtWireResponse" src/service/IAdtService.ts
```

Expected: **0.**

- [ ] **Step 6: Verify and commit**

```bash
npm run test:check && npx biome check src
git add -A
git commit -m "feat!: the service binding contract answers the contract"
```

---

### Task 9: The ADT members that answered past the contract

Thirty-four members return their own type directly, so a consumer has nowhere to
receive a failure except `catch` — the thing decision 20 exists to stop.

**Files:**
- Modify: `src/adt/IAdtAbapGit.ts` (7), `src/adt/IAdtFeatureToggle.ts` (5),
  `src/adt/IAdtUnitTest.ts` (3), `src/feeds/IFeedRepository.ts` (6),
  `src/execution/ITraceScheduling.ts` (5), `src/runtime/IAtcRun.ts` (2),
  `src/runtime/types.ts` (1)
- Test: `src/__typechecks__/abapGit.ts`, `feeds.ts`, `trace.ts`, `atcRun.ts` (existing files, extended)

**Interfaces:**
- Consumes: `IAdtResponse`, `IResultStrategy<T>` (Task 1).
- Produces: the same member names, each answering `Promise<IAdtResponse<…>>`. Where
  the answer is a document rather than a named shape, the interface takes a type
  parameter for it, defaulting to what it answers today.

**What does not change:** `src/auth/**`, `src/session/**`, `src/storage/**`,
`src/token/**`, `src/connection/**`, `src/logging/**`. Those are not ADT
endpoints — there is no server answer to shape and no ADT failure to classify, and
`IAbapConnection.makeAdtRequest` answering `IAdtWireResponse` is the *transport*,
which is what an `IResultStrategy` is handed. Touching them would be the mistake
this rule is written to prevent.

- [ ] **Step 1: List the thirty-four**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
grep -rnE '\): Promise<(?!IAdtResponse)' -P src/adt src/feeds src/execution/ITraceScheduling.ts src/runtime/IAtcRun.ts src/runtime/types.ts
```

Record the list. It is the work list and the count Step 5 is compared against.

- [ ] **Step 2: Write the failing typechecks**

For each file, one implementation answering the contract. `IFeedRepository` is the
worked example; the rest follow it exactly:

```typescript
class Feeds implements IFeedRepository {
  async list(): Promise<IAdtResponse<IFeedDescriptor[]>> {
    return succeeded([]);
  }
  // … variants, dumps, systemMessages, gatewayErrors, gatewayErrorDetail …
}
```

- [ ] **Step 3: Run them to verify they fail**

Expected: FAIL on every member — a bare `Promise<T>` is not `Promise<IAdtResponse<T>>`.

- [ ] **Step 4: Migrate, file by file, committing per file**

Seven commits, one per file, so a reviewer can reject one without the rest.

- [ ] **Step 5: Enumerate, edit, count**

Re-run Step 1's grep. Expected: **0 hits** in those files.

- [ ] **Step 6: Verify**

```bash
npm run test:check && npx biome check src && npm run build
```

---

### Task 10: The four that still threw, and the search on the atoms

Decided by the maintainer, 2026-09-04, **superseding the 29.0.0 design**: `lock`,
`unlock`, `getVersions` and `getVersionSource` answer the contract like everything
else. The carve-out said they "have no failure half" — a lock refused by another
user's lock is a 403, so they do.

**Files:**
- Modify: `src/adt/IAdtCapabilities.ts`
- Test: `src/__typechecks__/capabilityAtoms.ts`

**Interfaces:**
- Produces:
  - `lock(config): Promise<IAdtResponse<string>>`
  - `unlock(config, lockHandle): Promise<IAdtResponse<void>>`
  - `getVersions(config): Promise<IAdtResponse<IObjectVersion[]>>`
  - `getVersionSource(config, version): Promise<IAdtResponse<string>>`
  - `search` **leaves the atoms.** A search is not something an object does to
    itself; `IAdtInformationSystem.search` is where that question lives, and having
    it on the CRUD atoms as well is two members for one endpoint across two files.

- [ ] **Step 1: Write the failing typecheck**

```typescript
class Locking implements IAdtLockable<IClassConfig> {
  async lock(): Promise<IAdtResponse<string>> {
    return succeeded('LOCK_HANDLE');
  }
  async unlock(): Promise<IAdtResponse<void>> {
    return succeeded(undefined);
  }
}
export const _lockAssertions = [new Locking()] as const;
```

- [ ] **Step 2: Run it to verify it fails**

Expected: FAIL — `lock` answers `Promise<string>`.

- [ ] **Step 3: Migrate the four, delete `search`, and rewrite the file's header**

The header currently states the carve-out as settled — "`lock`, `unlock`,
`getVersions` and `getVersionSource` still throw" — and every `@throws` tag under
it. All of it goes, replaced by one sentence saying what changed and why: a member
that can be refused has a failure half, and a thrown error is invisible to the
compiler.

- [ ] **Step 4: Enumerate, edit, count**

```bash
grep -rn "@throws" src | wc -l
```

Expected: **0** across the package.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:check && npx biome check src
git add -A
git commit -m "feat!: the last four members answer, and search leaves the atoms"
```

---

### Task 11: The last per-call parsers

Four exist, not two. `search` (Task 3) and `listNodes` (Task 5) are done; these are
the other two.

**Files:**
- Modify: `src/runtime/ITrace.ts` (`readWith`), `src/runtime/IProfiler.ts`
  (`ITraceReadingWithParser`)
- Test: `src/__typechecks__/trace.ts`

**Interfaces:**
- Produces: `ITrace` with `read` answering `IAdtResponse<…>` and no `readWith`;
  `IProfiler` without the parser-carrying reading type.

- [ ] **Step 1: Write the failing typecheck** — an implementation of `ITrace` with
no `readWith` member, asserting the interface no longer requires one.

- [ ] **Step 2: Run it to verify it fails** — Expected: FAIL, `readWith` missing.

- [ ] **Step 3: Delete both, and say where the reading went**

In each doc comment: the reading is chosen when the implementation is constructed,
which is decision 22. A caller who took `readWith(parse)` now constructs the trace
reader with that strategy.

- [ ] **Step 4: Enumerate, edit, count**

```bash
grep -rn "parse: (data: unknown)\|readWith\|WithParser" src docs README.md
```

Expected: **0 hits in `src`.**

- [ ] **Step 5: Verify and commit**

```bash
npm run test:check && npx biome check src && npm run build
git add -A
git commit -m "feat!: no member takes a parser"
```

---

### Task 12: The record — decision 22, the changelog, and the migration note

A release that removes members without saying what a consumer does instead is the
stale-docs failure: believed, and wrong.

**Files:**
- Modify: `docs/architecture/DECISIONS.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md` if it names any removed symbol

**Interfaces:**
- Consumes: everything Tasks 1-7 produced.
- Produces: nothing importable.

- [ ] **Step 1: Add decision 22**

After decision 21, with this content — it is the decision the whole release
implements, and decisions 16 and 20 each state only half of it:

```markdown
## 22. The shape is injected into the implementation, not chosen at the call

Decision 16 says one endpoint is one member. Decision 20 says choice arrives by
injection. Neither says *where* the injection happens, and 29.0.0 shipped both
answers at once: `search` took a per-call `parse`, while the capability atoms took
their shapes from the implementation.

**Decided.** Into the implementation, once. A member's result type is a type
parameter of its atom; the consumer supplies the strategy when they construct the
implementation, and every call through it answers that shape.

**Why not per call.** It is a second signature every implementer must provide,
whether or not their callers use it — tried across 23 members and reverted. It also
moves the result's meaning from the contract to the call site: two calls to the
same member in one program can then answer different things, and nothing in the
type says so.

**Why this is not "the consumer loses flexibility".** A consumer wanting two
shapes constructs two implementations, which is one line, and each is honestly
typed. Measured against how these consumers actually work: a backup tool wants
documents whole for everything it touches, a script wants two fields from every
read, an MCP server picks by what its model is about to do. None changes its mind
between one call and the next.

**What the strategy is given.** The whole answer — status, headers, body — because
a reading may need any of it, and because `analyse` on the error axis already takes
the answer. What it is *not* given is anything the implementation did on the way:
preliminary requests are the implementation's business and reach the consumer only
as failures.

**How to catch a violation.** A member taking a function that shapes its own
result. A boolean that switches what the result *is* (`includeRawXml`). Two members
whose implementations issue the same request.
```

- [ ] **Step 2: Write the changelog entry**

`## 30.0.0` with, at minimum: `IResultStrategy` added; the node-structure trio
collapsed to one `getPackageContents`; `search`'s parse
overload removed; transport's `listNodes` removed and `list` answering
`IAdtResponse`; `includeRawXml` removed; the eleven runtime contracts answering
`IAdtResponse`; `IDebugger`, `IAdtDebuggerSession`, `IMemorySnapshots` and `IAdtBatch`
removed, with the sentence that they return measured.

- [ ] **Step 3: Write the migration note**

For each removal, what a consumer on 29.0.0 does now — the table a reader of a
breaking release actually needs:

| 29.0.0 | 30.0.0 |
|---|---|
| `utils.getPackageContentsList('Z1')` | `utils.getPackageContents('Z1')` on an implementation constructed with the list strategy |
| `utils.getPackageHierarchy('Z1', { maxDepth: 5 })` | `utils.getPackageContents('Z1')` on one constructed with the tree strategy; the walk into sub-packages is the consumer's |
| `utils.fetchNodeStructure('CLAS/OC', 'ZCL_X', '0000')` | `utils.fetchNodeStructure('CLAS/OC', 'ZCL_X', { nodeId: '0000' })` |
| `utils.search(c, parse)` | `search(c)` on an implementation constructed with that strategy |
| `transport.listNodes(parse, o)` | `transport.list(o)` on an implementation constructed with that strategy |
| `getInactiveObjects({ includeRawXml: true })` | `getInactiveObjects()` on an implementation constructed with the raw strategy |
| `dumps.getById(id)` → `IAdtWireResponse` | `dumps.getById(id)` → `IAdtResponse<TDump>`; the document is `getResult().value` |
| `IDebugger`, `IMemorySnapshots`, `IAdtBatch` | not published in 30.0.0; use the implementation's own types from `adt-clients` |

- [ ] **Step 4: Sweep the prose**

```bash
grep -rn "getPackageContentsList\|getPackageHierarchy\|fetchNodeStructure\|listNodes\|includeRawXml\|IAdtPackageBrowsing" docs README.md
```

Every remaining hit must be one that *describes the removal*, in the changelog or
in a decision. Anything presenting a removed member as available is a defect.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: decision 22, and what a consumer on 29.0.0 does now"
```

---

### Task 13: Hand over

- [ ] **Step 1:** `npm run build && npm run test:check && npx biome check src` — all clean.
- [ ] **Step 2:** Report to the maintainer: the version bump to 30.0.0 and `npm publish` are theirs. Do not bump, do not tag, do not nudge.
- [ ] **Step 3:** Only once 30.0.0 is **on npm**, `adt-clients` installs it and runs its own plan. It never migrates onto 29.0.0 — the intermediate state costs a second migration of the same files.

---

## What this changes in the `adt-clients` plan

`docs/superpowers/plans/2026-09-04-adt-clients-onto-interfaces-29-implementation.md`
was written against 29.0.0 and against the assumption that `interfaces` was closed.
Both stop holding, and three things in it change:

1. **Package contents get their strategies after all.** The design spec's promise —
   two or three shipped readings for the answers large enough to be read
   differently — is met by `getPackageContents` plus `packageList`, `packageTree`,
   `packageShort` and `packageRaw` in `adt-clients`. The reviewer's first P1 is
   closed by the contract change, not by an exception in the plan.
2. **Task 12 and Task 13 stop contradicting each other.** The `AdtUtils` result set,
   the `getUtils` overload and the parser overload on package members all disappear:
   `AdtUtils` takes its strategies at construction like every other implementation,
   and the package members it declared no longer exist.
3. **`RuntimeDumps` keeps `implements IRuntimeDumps`.** Task 12's "the class stops
   declaring the contract and states its own" was the honest move only while
   `interfaces` was closed. It is open, and Task 6 above fixes the contract instead.

---

## Self-review

**Coverage against the decisions.** One member per endpoint → Tasks 2, 3, 5.
Injection at the implementation → Task 1 defines it, every later task consumes it,
Task 8 records it as decision 22. The strategy sees the whole answer → Task 1.
Preliminary requests invisible → Task 1's doc comment and decision 22. Debugger, memory
snapshots and batch leave → Task 7. Every ADT member answers the contract → Tasks
6, 8, 9 and 10, which between them name all 74 members that did not. No member
takes a parser → Tasks 3, 5 and 11, which is all four. The four that threw → Task
10, with the superseded carve-out rewritten rather than left standing. Recursion leaves → Task 2.

**Placeholders.** None. Two counts are
recorded during execution rather than now — Task 6 Step 1 and Task 7 Step 1 —
because they are the before-halves of before/after comparisons and inventing them
here would defeat the check.

**Type consistency.** `IResultStrategy<T>` is defined in Task 1 and used under that
name in 2, 3, 4, 5, 6 and 8. `getPackageContents(packageName, options?)` and
`fetchNodeStructure(parentType, parentName, options?)` keep those signatures in
Tasks 2 and 8. `IAdtPackageBrowsing<TContents>`, `IAdtRepositoryStructure<TNode>`,
`IAdtInformationSystem<TSearch>`, `IAdtGroupLifecycle<TInactive>`,
`IAdtTransport<TList>` and `IRuntimeDumps<TList, TDump>` are spelled the same way
everywhere they appear.

**Verification, three ways, as the design spec requires.** The compiler for
signatures (`npm run test:check`); enumerate-edit-count for removals, including
prose, in Tasks 2, 4, 5, 6, 7 and 8; and the typechecks in `src/__typechecks__/`
for meaning — each one asserts that something *outside* this package can implement
the contract, which is the property a contract library exists to have.
