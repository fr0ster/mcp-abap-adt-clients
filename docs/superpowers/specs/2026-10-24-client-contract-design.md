# Spec: `IAdtClient` — the client a consumer receives is a contract

Answers [`2026-10-24-client-contract-goal.md`](../2026-10-24-client-contract-goal.md) (#216).

## 1. What there is today (measured in the code, 2026-10-24)

- `src/clients/AdtClient.ts` has 35 factories. Each has two overloads,
  `getX(): IXContract<typeof xDocuments>` and `getX<R extends IXResults>(results: R): IXContract<R>`,
  and one implementation `getX<R …>(results: R = xDocuments …): AdtX<R>`.
- The 35 compositions `IXContract<R>` are declared in `AdtClient.ts` (lines 261–1040); mcp-abap-adt
  imports none of them. They are built only from atoms (`IAdtCreatable`, `IAdtReadable`, …) and config types that
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

Only contracts are added. Nothing concrete moves, and no composition is named (goal):

1. **The result-set contracts**, under their names, in each object's existing `src/adt/IAdtX.ts`
   beside its config:
   - all 35 `IXResults`, each a `readonly` slot map of `IResultStrategy<unknown>`;
   - `IMessageClassMessageResults<TRead, TWritten, TDeleted>` keeps its generic parameters and
     their defaults;
   - a shared one stays one interface: `IClassResults` serves class, behavior implementation and
     the local includes.
2. **Two input and answer types the client names:**
   - `IServiceBindingPublicationConfig` moves as it is, because it is the input of a member
     `IAdtClient` declares;
   - `IAdtLockFailure` (`{ readonly key: string; readonly error: unknown }`) is the answer of
     `unlockAll()`.
3. **`IAdtClient`** (decision 23: composed, never inherited):
   - **one signature per factory**: `getX<R extends IXResults = IXResults>(results?: R): A₁ & A₂ & …`,
     where the `Aᵢ` are the atoms the factory offers today, written inline with the same type
     arguments as today's `IXContract<R>`. Today's two overloads become this one signature: a call
     without a result set answers over `IXResults` (its slots are `unknown`), and a call with one
     answers over the set passed. Two quirks are written as they are, because this task changes no
     type: the class, behavior-implementation and local-include factories offer
     `IAdtTransportAware<…, string>`, and the request factory reads
     `NonNullable<R['searchConfigurations']>`;
   - `unlockAll(): Promise<IAdtLockFailure[]>`;
   - `readonly pendingLocks: string[]`;
   - `[Symbol.asyncDispose](): Promise<void>`, typed from `@types/node` as it is in adt-clients
     today. The plan confirms that the published declaration needs nothing from a consumer beyond
     what adt-clients already needs.
4. **Bookkeeping:**
   - every new symbol goes into `tools/package-map.json`;
   - a type-only check under `src/__typechecks__/` proves an object literal can implement
     `IAdtClient` with no adt-clients import;
   - README and CHANGELOG entries.

## 3. What changes in adt-clients (a major: 38.0.0)

1. **The compositions go.** `IClassContract<R>` and its 34 siblings are deleted from `AdtClient.ts`.
   What a factory answers is written only in `IAdtClient`.
2. **The result-set contracts come from interfaces-adt.** Each `core/<dir>/types.ts` imports its
   `IXResults` from there and deletes the local declaration.
   `IServiceBindingPublicationConfig` and `LockFailure` are deleted locally, and `LockRegistry`
   answers `IAdtLockFailure`. adt-clients stops exporting all of these names; the migration note
   says where to import them from.
3. **The values stay here.** Every `xDocuments` stays, keeps `satisfies IXResults` against the
   contract it now imports, and stays unannotated. `rawDocument` and `nothing` stay too.
4. **`AdtClient implements IAdtClient`.**
   - Its factories are implementations: each is
     `getX<R extends IXResults = typeof xDocuments>(results: R = …): AdtX<R>`, answering its own
     class. The two contract-typed overloads it declares today go. The compiler checks every
     factory against the one signature in `IAdtClient`. No composition is written a second time.
   - `AdtClient` stays an exported class, because mcp-abap-adt extends it (`GuardedAdtClient`).
5. **`AdtClientLegacy`.** Its overrides keep answering their own legacy classes. A type-level
   check proves an `AdtClientLegacy` is assignable to `IAdtClient`.
6. **`createAdtClient()` answers `Promise<IAdtClient>`.** This is where a consumer receives the
   client, so it sees the contract and never the classes.
7. **The shape check.** The capability manifest types its factories as `(client: IAdtClient) => …`,
   so `ReturnType` reads the contract's factory. `factoryReturnsCoverClass.ts` reads the same
   factories from `IAdtClient` instead of the deleted compositions. The runtime completeness
   test, which walks the prototypes of `AdtClient` and `AdtClientLegacy`, stays.
8. **A substitution check.** A type-level test passes a hand-written object that implements
   `IAdtClient` where a client is taken. It proves a consumer can substitute its own client.
9. **No behaviour change.** No member's request or answer changes, and the unit suite passes
   unchanged apart from type imports.
10. **Docs.** README, `CLIENT_API_REFERENCE.md`, a migration note for 38.0.0 and the CHANGELOG. The
    migration note covers:
    - the client type;
    - where the result-set contracts are imported from now;
    - that the named compositions are gone, so a consumer that needs a name composes it from the
      atoms;
    - that `IAdtClient` without a result set answers `unknown` slots.

## 4. What changes in mcp-abap-adt (with its next major, 21.0.0)

mcp-abap-adt declares `@mcp-abap-adt/interfaces-adt` directly (`^20.1.0`) and will import
`IAdtClient` from it, so its own range moves to `^20.2.0` together with adt-clients `^38.0.0`, both
resolved from the registry. Its lockfile is regenerated by npm, and the server is built after a
clean install from the registry.

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
4. mcp-abap-adt moves to adt-clients ^38.0.0 and its own interfaces-adt range to ^20.2.0 in its
   21.0.0, and is built after a clean install from the registry.

Each step depends only on published versions (goal, the registry rule).

## 6. Not in this work

- **No executor, runtime client or WebSocket contract.** `AdtExecutor`, `AdtRuntimeClient` and
  `AdtClientsWS` keep their current types.
- **The two quirks stay.** Changing them would change types beyond the move.
- **No rename** of any result-set contract.
