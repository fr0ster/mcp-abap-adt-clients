# interfaces 30.0.0 — one member per endpoint, and the strategy chooses the shape

Active plan. Delete when done or abandoned.

## Why

Decision 16 says one endpoint is one contract member. Three resources break it,
and they break it the same way: the answer is large, callers want different
amounts of it, and the contract resolved that by adding members instead of by
letting a strategy choose. That is the case strategies exist for.

## What was measured, 2026-09-04

| resource | members today | evidence |
|---|---|---|
| `POST /repository/nodestructure` | `fetchNodeStructure`, `getPackageContentsList`, `getPackageHierarchy` | the URL is built in exactly one place, `src/core/shared/nodeStructure.ts:46`; the other two hold no URL and call `fetchNodeStructure` twice each |
| `/repository/informationsystem/usageReferences` | `getWhereUsedScope`, `getWhereUsed`, `getWhereUsedList` | only `src/core/shared/whereUsed.ts` builds it; recorded as a Known gap in adt-clients CHANGELOG 17.0.0 |
| `/repository/informationsystem/search` | `search`, `searchObjects` | 17.0.0 records that both issue the same request; `search` already carries the parser overload, `searchObjects` answers the frame and is not in the contract |

**Transport is clean** — `create` and `delete` share `/cts/transportrequests` by
POST and DELETE, which are different operations rather than two readings. The
legacy implementation asks a different resource entirely (`/sap/bc/cts/...`,
no `adt`), which is one contract with two implementations and correct.

**Not audited, and the obvious next place to look:** the runtime contracts.
`IDebugger` alone has 39 members answering `IAdtWireResponse`. Same question,
same criterion: how many members per endpoint.

## The shape

Each collapses to one member with the parser overload the contract already uses
for `search` — no new concept for a consumer to learn:

```ts
getPackageContents(
  packageName: string,
  options?: IGetPackageContentsOptions,        // depth of the walk moves here
): Promise<IAdtResponse<IPackageContentItem[]>>;

getPackageContents<T>(
  packageName: string,
  options: IGetPackageContentsOptions,
  parse: (data: unknown) => T,
): Promise<IAdtResponse<T>>;
```

`IPackageContentItem`, `IPackageHierarchyNode` and `IRepositoryNodeContents`
survive as the types the shipped strategies return, rather than as the fixed
returns of three members. The raw document becomes reachable for the first time —
`parse` is `String` — which is what the backup consumer needs and cannot get
today.

**Check while implementing:** `fetchNodeStructure` takes `parentType`/`parentName`
/`nodeId`, so it walks more than packages. Either that generality lives in
`options`, or the collapse reintroduces the same defect under one fewer name.

## Order

1. Audit the runtime contracts by the same criterion before deciding the scope.
2. `nodestructure`, `usageReferences`, `search` — one member each, parser overload.
3. Publish 30.0.0; then `adt-clients` follows in its own release.

## Open in the 29.0.0 migration plan, and blocking nothing else

`docs/superpowers/plans/2026-09-04-adt-clients-onto-interfaces-29-implementation.md`
still carries contradictory instructions for package contents: Task 12 routes them
through an `AdtUtils` result set and a `getUtils` overload, Task 13 forbids both,
and a step in Task 13 still tells a worker to add a parser overload to package
members that have none. **Two attempts to remove them failed on stale anchors and
changed nothing** — the tree is clean, there is no half-applied state. Remove them
by locating the passages rather than by pattern; everything else in both tasks
(transport, dumps, `AdtUtils`' own migration, legacy) is independent and correct.

## `IDebugger` leaves `interfaces` first

Decided by the maintainer, 2026-09-04.

It is **not** audited for one-member-per-endpoint and it is not going to be, not
yet: it is still being researched. 39 of its members answer `IAdtWireResponse`,
which is what a contract looks like before anyone knows what the endpoints
actually return.

So it moves to `@mcp-abap-adt/adt-clients` as a research branch of its own, and
comes back to `interfaces` when the research is done and the shapes are known.
The precedent is batch, removed for the same reason: a contract nobody can yet
state is a contract that should not be published, because every consumer that
adopts it has to be migrated again when it changes.

**What this means concretely:**

- Removing `IDebugger` and its neighbours from `interfaces` is part of 30.0.0.
- The debugger implementation in `adt-clients` stops declaring them and states
  its own types, the way `RuntimeDumps` does since 29.0.0.
- Nothing about it blocks the endpoint audit above, or the 29.0.0 migration.
- When it returns, it returns having been measured — one member per endpoint,
  and results named rather than framed.
