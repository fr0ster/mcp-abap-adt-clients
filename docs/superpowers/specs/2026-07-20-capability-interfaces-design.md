# Capability interfaces — design

**Date:** 2026-07-20
**Status:** approved for planning
**Repos:** `@mcp-abap-adt/interfaces` (step 1), `@mcp-abap-adt/adt-clients` (later steps)

## Problem

`IAdtObject<TConfig, TReadResult>` declares 13 methods that every object handler must
provide. Most handlers cannot provide all of them, so they lie — and they lie
inconsistently.

A survey of all 30 primary handlers in `src/core/*/Adt*.ts` established:

- Only `create`, `read`, `readMetadata` are implemented by every handler.
- `getVersions` / `getVersionSource` throw in 11 of 30.
- `activate`, `check`, `lock`, `unlock` throw in 4–5.
- `readTransport` is unimplemented in 6 handlers **via three different mechanisms**:
  three throw, three return a fabricated error state, one returns an empty
  `{errors: []}`. With no way to say "I don't do transports", implementers invented
  three different lies. That inconsistency is the clearest symptom of the problem.
- Four handlers are 0–4 of 13: `AdtPackageLegacy` (0/13 — every method throws, the
  class exists solely to satisfy the type), `AdtUnitTest` (3/13), `AdtRequest` (3/13),
  `AdtMessageClassMessage` (4/13).

The cost is paid by consumers: `AdtClient.getUnitTest()` returns a type promising
`lock()`, and the promise is false. The compiler cannot help, so the failure surfaces
at runtime against a live SAP system.

## Goal and non-goal

**Goal: contract honesty.** A handler should declare only what it does, and
`AdtClient.getXxx()` should return a type that does not lie.

**Explicit non-goal for now: parameter polymorphism.** An exhaustive search found
**no production code that accepts `IAdtObject` as a parameter or holds a collection of
them** — only the test harness `BaseTester` (`src/__tests__/helpers/BaseTester.ts:88`),
which already uses just 7 of the 13 methods. Group activation
(`src/core/shared/groupActivation.ts:138`) operates on `IObjectReference[]`, not on
handlers, so it would not consume a capability interface either.

Narrow capability interfaces do enable such call sites later, and TypeScript's
structural typing makes them compose without ceremony. But that is a future benefit,
not present justification. Claiming otherwise would overstate the case.

## Design rules

Two rules govern the decomposition. Both were derived during review, not assumed.

**Rule 1 — split only on evidence.** An atom is divided only when a class exists that
has one part without the other. Absent such a class, the methods stay together.

This is why `IAdtCrud` is a single atom: `create`, `read`, `readMetadata`, `update`,
`delete` are implemented by all 30 handlers. The only two apparent exceptions —
`AdtRequest` and `AdtUnitTest` — are our own defects, not domain limits (see
"Known defects"). No ADT object has partial CRUD.

It is also why `readMetadata` stays inside `IAdtCrud` despite being conceptually a
header read rather than a CRUD operation: all 30 handlers implement both `read` and
`readMetadata`, so there is nothing to split on. If an object ever reads a header but
not a body, we divide then, with grounds.

**Rule 2 — exclude only on verified domain limits.** A class is left out of a
capability only when the limitation is confirmed to be ADT's, not ours. When unsure,
the class stays in and the throwing stub is treated as a bug.

The asymmetry is deliberate. A wrong exclusion enters the type system and is read by
the next developer as truth about SAP; a redundant method that throws is a visible bug
that is cheap to fix. Encoding our gaps as contract is the worse failure.

## The partition

Every method of every "big" interface belongs to **exactly one** atom. Nine atoms
cover 20 methods with no overlap.

| Atom | Methods | Evidence |
|---|---|---|
| `IAdtCrud` | `create`, `read`, `readMetadata`, `update`, `delete` | 30/30 — universal; no partial-CRUD object exists |
| `IAdtValidatable` | `validate` | 27/30 |
| `IAdtCheckable` | `check` | 26/30 |
| `IAdtActivatable` | `activate` | 25/30 |
| `IAdtLockable` | `lock`, `unlock` | rigid pair — 0 handlers have one without the other |
| `IAdtVersionable` | `getVersions`, `getVersionSource` | 19 vs 11, verified domain boundary |
| `IAdtTransportAware` | `readTransport` | 24/30 |
| `IAdtFeatureToggleControl` | `switchOn`, `switchOff`, `getRuntimeState`, `checkState`, `readSource` | single implementer |
| `IAdtServiceBindingOps` | `validateServiceBinding`, `updateServiceBinding` | single implementer |

`validate`, `check` and `activate` are separate atoms because their sets genuinely
differ: `AdtPackage` implements `check` but not `activate`; `AdtMessageClass`
implements `validate` but neither `check` nor `activate`.

`IAdtLockable` and `IAdtVersionable` are each one atom because their member methods
co-occur perfectly across all 30 handlers.

### The versioning boundary is real

`getVersions` / `getVersionSource` are absent from 11 handlers for a domain reason,
confirmed with the maintainer: ADT exposes version history at `<sourceUri>/versions`.
Objects without a source resource — those represented purely as XML — have no such
endpoint.

The dividing line is "has `/source/main`", **not** "is DDIC": `Table`, `Structure` and
`TableType` have versions; `Domain`, `DataElement` and `Package` do not.

- **With versions (19):** Class, Interface, Program, Ddl, Table, Structure, TableType,
  Enhancement, MetadataExtension, BehaviorDefinition, BehaviorImplementation,
  AccessControl, AppendStructure, ScalarFunction, ScalarFunctionImplementation,
  ServiceDefinition, Transformation, FunctionInclude.
- **Without (11):** Domain, DataElement, Package, FunctionGroup, AuthorizationField,
  FeatureToggle, MessageClass, MessageClassMessage, Request, Service, UnitTest.

## Composition

Composite interfaces are intersections of atoms. They define no methods of their own —
that is what keeps the partition a partition.

```ts
export type IAdtCrudObject<TConfig, TReadResult = TConfig> =
  & IAdtCrud<TConfig, TReadResult>
  & IAdtValidatable<TConfig, TReadResult>
  & IAdtCheckable<TConfig, TReadResult>
  & IAdtActivatable<TConfig, TReadResult>
  & IAdtLockable<TConfig, TReadResult>
  & IAdtTransportAware<TConfig, TReadResult>;
```

A handler that also has version history composes further:

```ts
type ISourceObject<C, R> = IAdtCrudObject<C, R> & IAdtVersionable<C>;
```

## Correctness proof

The partition must be provably exact, not exact by inspection. A compile-time
assertion checks assignability in **both** directions between `IAdtObject` and the
intersection of its ten constituent atoms:

```ts
type Assert<T extends true> = T;

type AllAtoms<C, R> =
  & IAdtCrud<C, R> & IAdtValidatable<C, R> & IAdtCheckable<C, R>
  & IAdtActivatable<C, R> & IAdtLockable<C, R> & IAdtVersionable<C>
  & IAdtTransportAware<C, R>;

type _PartitionIsExact = [
  Assert<IAdtObject<C, R> extends AllAtoms<C, R> ? true : false>,
  Assert<AllAtoms<C, R> extends IAdtObject<C, R> ? true : false>,
];
```

A dropped method, a mistyped parameter or a missing generic argument fails the build.

Both directions are required: one alone would permit the intersection to be a strict
superset or subset. The assertion must itself be verified by temporarily removing a
method and confirming the build fails — the same discipline used for the ATC
vocabulary guard, where an `Extract`-based check turned out to degrade silently
instead of erroring.

## Scope of step 1

Step 1 is **purely additive**. The atoms are declared as a parallel branch in
`@mcp-abap-adt/interfaces`.

Explicitly NOT in step 1:

- `IAdtObject` is not redefined as an intersection. It stays byte-for-byte as it is.
- No handler class is modified.
- No `AdtClient.getXxx()` return type is narrowed.
- No composite is applied to any existing declaration.

Version: **minor** (11.2.0), shipping alongside the ATC contract types already on
`feat/atc-unittest-types`. Nothing breaks; consumers may adopt atoms when they choose.

## Later steps, deliberately deferred

Each is a separate decision, taken once the atoms have settled:

1. **Redefine `IAdtObject` as the intersection of its atoms.** Safe once the proof
   above passes, but pointless before consumers exist.
2. **Narrow `AdtClient.getXxx()` return types** for the 11 handlers without versions,
   so `getDomain()` no longer promises `getVersions()`. This is a **breaking change**
   for adt-clients — code calling `client.getDomain().getVersions()` compiles today and
   throws at runtime; afterwards it fails to compile. That converts a runtime error
   into a compile error, which is the point, but it warrants a major bump and a
   CHANGELOG entry naming exactly what breaks.
3. **Non-CRUD / runtime clients.** A separate survey found the 14 runtime classes are
   already uniform: identical `(connection, logger)` constructors, stateless, raw
   `IAdtResponse` returns, no locks, no polling. There is a de-facto convention but no
   meaningful shared operation set — the honest common denominator is a constructor
   whose `logger` parameter 13 of 14 implementations never read. No abstraction is
   proposed for them here.
4. **`IAdtSearchable` is not proposed.** Seven "find things" operations have seven
   different input shapes and five different result shapes. `ISearchResult` exists in
   `IAdtShared.ts:84` and is used by no production code — the one type that would have
   been the shared search result was declared and abandoned. A search capability would
   have to be *imposed* by normalizing all seven signatures, and would have zero
   existing call sites to validate against. That is a design act, not an extraction,
   and belongs in its own spec if wanted.

## Known defects (not part of this design)

Found while building the matrix. Both are bugs to fix, and under Rule 2 neither
affects the partition — the classes stay in their capabilities.

1. **`AdtRequest.update()` and `.delete()` throw** with the claim that ADT does not
   support them (`src/core/transport/AdtRequest.ts:190,203`). A transport request's
   description can be changed, and an empty request can be deleted. The comment states
   something about ADT that is not true. Could not be verified on the cloud trial: the
   user has no transport requests there, so `FIND` returns an empty tree, and discovery
   declares content types but not methods. Treated as a defect on the maintainer's
   domain knowledge, flagged as unverified.
2. **`AdtUnitTest` implements `IAdtObject` with 3 of 13 methods.** It is a test-run
   executor, not an object; a test class is a variant of a class. The contract is
   simply the wrong one for it.

Related, from the same surveys but out of scope here:

- `FeedRepository` reaches the same three endpoints as `SystemMessages`,
  `GatewayErrorLog` and `RuntimeDumps` with the opposite contract — parsed objects
  instead of raw, silent empty results instead of throwing. Two access paths to one
  endpoint with opposite semantics; new callers choose arbitrarily.
- Eight core modules construct `new AdtUtils(connection, noopLogger)` inside their own
  `read.ts` to call `readObjectMetadata` — an inverted dependency, typed modules
  reaching back into the facade for what should be their own read logic.
- `src/utils/managementOperations.ts:43` is a second, duplicate group-activation
  implementation with a different object shape than
  `src/core/shared/groupActivation.ts`.

## Testing

The partition proof is a compile-time assertion in the interfaces package; it needs no
runtime test and is validated by deliberately breaking it once.

Step 1 changes no behaviour, so the adt-clients unit suite (348 tests) and the public
surface must both be unchanged. The surface is captured across all seven entry points
with the TypeScript compiler API, as in the 7.5.0 migration — a `diff` of before and
after must be empty.
