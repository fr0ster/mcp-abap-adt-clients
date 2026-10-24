# Spec: `IAdtClient` — the client a consumer receives is a contract

Answers [`2026-10-24-client-contract-goal.md`](../2026-10-24-client-contract-goal.md) (#216).

## 1. What there is today (measured in the code, 2026-10-24)

- `src/clients/AdtClient.ts` has 35 factories. Each has two overloads,
  `getX(): IXContract<typeof xDocuments>` and `getX<R extends IXResults>(results: R): IXContract<R>`,
  and one implementation `getX<R …>(results: R = xDocuments …): AdtX<R>`.
- The 35 compositions `IXContract<R>` are declared in `AdtClient.ts` (lines 261–1040). They are
  built only from atoms (`IAdtCreatable`, `IAdtReadable`, …) and config types that
  `@mcp-abap-adt/interfaces-adt` already exports, with two exceptions:
  - `IServiceBindingPublicationConfig`, local to `core/service/types.ts:128`, which
    `IServiceBindingContract` names in its `IAdtUpdatable`;
  - `LockFailure` (`{ key: string; error: unknown }`, `core/shared/LockRegistry.ts:26`), which
    `unlockAll()` answers.
- The result-set interfaces `IXResults` live in each `core/<dir>/types.ts`:
  - Every slot is `readonly …: IResultStrategy<unknown>`, with `IResultStrategy` from interfaces-adt.
  - One is generic: `IMessageClassMessageResults<TRead, TWritten, TDeleted>`.
  - Some are shared. `getBehaviorImplementation` and the four `getLocal*` reuse `IClassResults` and
    `classDocuments`.
- The default result sets `xDocuments` are values built from `rawDocument` (`IResultStrategy<string>`)
  and `nothing` (`IResultStrategy<void>`). Each is `satisfies IXResults`, without an annotation.
- The client-level members are `unlockAll(): Promise<LockFailure[]>`, `get pendingLocks(): string[]`
  and `[Symbol.asyncDispose](): Promise<void>`.
- `createAdtClient(connection, …): Promise<AdtClient>` builds `AdtClient` or `AdtClientLegacy`.
- The shape check (`src/__tests__/unit/capabilities/shape.ts`) compares each factory's no-argument
  return with the capability manifest. The manifest (`manifest.ts:72`) types its factories as
  `(client: AdtClient) => unknown`.

## 2. What goes to `@mcp-abap-adt/interfaces-adt` (a minor: 20.1.0 → 20.2.0)

Only contracts are added. Nothing concrete moves (goal: contracts only).

1. **The result-set contracts**, under their names, in `src/adt/` beside each object's existing
   `IAdtX.ts`:
   - all 35 `IXResults`, each a `readonly` slot map of `IResultStrategy<unknown>`;
   - `IMessageClassMessageResults<TRead, TWritten, TDeleted>` keeps its generic parameters and
     their defaults.
   - The ones that are reused stay one interface: `IClassResults` serves class, behavior
     implementation and the local includes.
2. **The compositions** `IXContract<R extends IXResults>`, with the same names and definitions as
   in `AdtClient.ts` today, one definition each. Two quirks move as they are, because this task
   changes no behaviour and no type:
   - the class, behavior-implementation and local-include contracts hard-code
     `IAdtTransportAware<…, string>`;
   - `IRequestContract` reads `NonNullable<R['searchConfigurations']>`.
3. **Two input and answer types the contracts name:**
   - `IServiceBindingPublicationConfig` moves as it is. It is the input of a contract's member,
     so the contract package must hold it.
   - `IAdtLockFailure` (`{ readonly key: string; readonly error: unknown }`) is the answer of
     `unlockAll()`.
4. **`IAdtClient`**, composed and not inherited (decision 23):
   - For every factory, the two overloads `getX(): IXContract<IXResults>` and
     `getX<R extends IXResults>(results: R): IXContract<R>`.
   - `unlockAll(): Promise<IAdtLockFailure[]>`.
   - `readonly pendingLocks: string[]`.
   - `[Symbol.asyncDispose](): Promise<void>`, whose typing comes from `@types/node` as it does in
     adt-clients today. The plan confirms that the published declaration needs nothing more from
     a consumer than adt-clients already needs.
5. **Bookkeeping:**
   - every new symbol goes into `tools/package-map.json` (`check-surface` and `check-graph` enforce
     placement);
   - a type-only check under `src/__typechecks__/` proves an object literal can implement
     `IAdtClient` without any adt-clients import;
   - README and CHANGELOG entries.

The no-argument overload answers the composition over the result-set contract, so its slots
answer `unknown`. A typed answer needs a result set, which the consumer passes (goal).

## 3. What changes in adt-clients (a major: 38.0.0)

1. **The contracts come from interfaces-adt.**
   - `AdtClient.ts` and each `core/<dir>/types.ts` import the compositions and result-set
     contracts from there. Their local declarations are deleted, so each is defined only once.
   - `IServiceBindingPublicationConfig` and `LockFailure` are deleted locally. `LockRegistry`
     answers `IAdtLockFailure`.
   - adt-clients stops exporting these names. A consumer imports them from interfaces-adt; the
     migration note says so.
2. **The values stay here.**
   - Every `xDocuments` stays, keeps `satisfies IXResults` against the contract it now imports, and
     stays unannotated, so `typeof xDocuments` keeps its narrow slots.
   - `rawDocument` and `nothing` stay.
3. **`AdtClient` implements `IAdtClient`.**
   - Its no-argument overloads keep answering `IXContract<typeof xDocuments>`, which is narrower
     than the contract's `IXContract<IXResults>`. The compiler checks the class against the
     contract.
   - `AdtClient` stays an exported class, because mcp-abap-adt extends it (`GuardedAdtClient`).
4. **`AdtClientLegacy`.** Its overrides keep their concrete return types. A type-level check proves
   that an `AdtClientLegacy` is assignable to `IAdtClient`.
5. **`createAdtClient()` answers `Promise<IAdtClient>`.** The same goes for every other factory
   function that answers the client, if there is one.
6. **The shape check.** The capability manifest types its factories as `(client: IAdtClient) => …`.
   `factoryReturnsCoverClass.ts` imports the three contracts from interfaces-adt. The runtime
   completeness test, which walks the prototypes of `AdtClient` and `AdtClientLegacy`, stays as
   it is.
7. **A substitution check.** One type-level test passes a hand-written object that implements
   `IAdtClient` where the library takes a client. It proves that a consumer can substitute its own
   client.
8. **No behaviour change.** No member's request or answer changes, and the unit suite passes
   unchanged apart from type imports.
9. **Docs.** README, `CLIENT_API_REFERENCE.md`, a migration note for 38.0.0 (the client type, where
   the contracts are imported from now, and that `IAdtClient` without a result set answers
   `unknown` slots) and CHANGELOG.

## 4. What changes in mcp-abap-adt (with its next major, 21.0.0)

The compiler finds every use, and each is fixed where it is found:

- `src/lib/clients.ts`: `GuardedAdtClient extends AdtClient` stays. The server's own
  `createAdtClient`, `getAdtClient` and their callers answer `IAdtClient`.
- `src/handlers/common/readonly/resolveVersionedObject.ts` and the test fixtures that import
  `type AdtClient` use `IAdtClient`.
- A call without a result set that relied on a `string` slot now meets `unknown`. It passes the
  result set it needs, as the server's handlers already do through `resultsFor(…)`.
- The CHANGELOG entry goes into the [Unreleased] major that already carries three breaking
  changes.

## 5. Order and versions

1. **PR #271 (adt-clients 37.3.0, legacy) merges and is released first.** It changes the legacy
   getters this work must keep assignable. This branch rebases onto it.
2. interfaces-adt 20.2.0 is published.
3. adt-clients 38.0.0 depends on `@mcp-abap-adt/interfaces-adt ^20.2.0` from the registry and is
   published.
4. mcp-abap-adt moves to adt-clients ^38.0.0 in its 21.0.0.

Each step depends only on published versions (goal, the registry rule).

## 6. Not in this work

- **No executor, runtime client or WebSocket contract.** `AdtExecutor`, `AdtRuntimeClient` and
  `AdtClientsWS` keep their current types.
- **The two quirks stay.** Changing them would change types beyond the move.
- **No rename** of any composition or result-set contract.
