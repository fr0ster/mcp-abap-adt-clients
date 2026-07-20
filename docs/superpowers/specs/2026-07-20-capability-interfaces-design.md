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

## The behavioural contract

An interface constrains behaviour, not only shape. TypeScript checks the second and
says nothing about the first, so the partition alone does not solve the problem that
motivated it — it would merely distribute it across nine interfaces instead of one.

The evidence is already in hand. `readTransport` is "unimplemented" in six handlers by
three different mechanisms — throwing, returning a fabricated error state, and
returning an empty `{errors: []}`. Every one of those satisfies the structural
signature. The type system was never going to catch it.

So each atom carries a behavioural contract, and implementations must satisfy both.

### The rule that makes the split worth doing

**"Not supported" ceases to be a behaviour.** A handler that cannot do something does
not implement the atom. It must not throw `UNSUPPORTED_OPERATION`, must not return a
fabricated error state, and must not return an empty stub.

This is the whole point of the partition: `AdtDomain` will not implement
`IAdtVersionable`, so the question of what its `getVersions` should return disappears
rather than being answered three ways.

### Per-atom obligations

Contracts common to every atom:

- **Failure is a thrown error**, using `AdtObjectErrorCodes`. Operations do not signal
  failure by returning a state that happens to contain errors.
- **The returned state accumulates results**, and `state.errors` records
  non-fatal diagnostics only. An empty `errors` array must mean "nothing went wrong",
  never "this operation does not apply here".
- **Session type is restored** on both the success and failure paths. Any method that
  sets `stateful` returns the connection to `stateless` before it finishes or throws.

Atom-specific obligations:

- `IAdtCrud` — `read` returns `undefined` for a genuinely absent object; it does not
  throw for absence. Note the trial-verified caveat that ADT source endpoints answer
  `200` with an empty body rather than `404`, so absence is determined by content, not
  status. `create` is not idempotent and must not silently succeed on an existing
  object.
- `IAdtLockable` — `lock` returns a handle and leaves the session `stateful`; the
  caller owns the obligation to `unlock`. `unlock` is idempotent and tolerates an
  already-released handle. A failure between the two must still restore the session.
- `IAdtActivatable` — activation of an already-active object is a no-op, not an error.
- `IAdtVersionable` — implemented only by objects with a source resource. `getVersions`
  returns an empty array for an object with no history; it does not throw.
- `IAdtCheckable` / `IAdtValidatable` — a check that *finds problems* has succeeded;
  problems are reported in the result, not raised as errors. Only a failure of the
  check mechanism itself throws.
- `IAdtTransportAware` — implemented only by objects that participate in transports.

### How this is enforced

The compiler cannot verify any of the above, so enforcement is by documentation and
test:

- Each atom's declaration carries the contract in its docblock, next to the signature,
  where an implementer will actually read it.
- The behavioural expectations that can be exercised without a live system belong in
  the unit suite as shared conformance tests, parameterised over handlers — the same
  table-driven approach already used for `postUpdateReadinessRead` and
  `updateNoActivateReadsInactive`.

Writing the contract down is not a guarantee. It is, however, the difference between a
convention a reviewer can point at and one that has to be inferred from whichever
handler was read first.

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
4. **`IAdtSearchable` — viable, but its own spec.** See "Search capability" below.

## Search capability — viable, deferred to its own spec

An earlier draft of this spec claimed no coherent search capability existed. That
reasoning was wrong and is corrected here, because the mistake is instructive: it
judged coherence by the *current concrete signatures* and concluded no capability was
possible. Absence of a shared concrete shape does not imply absence of a shared
abstraction — that is what interfaces are for.

The shapes do share a core. All five "an object was found" types carry a name, a type,
and optional `uri` / `packageName` / `description`:

| Type | Name | Type field | Extras |
|---|---|---|---|
| `ISearchResult` | `name` | `type` | `description`, `packageName?`, `uri?` |
| `IWhereUsedReference` | `name` | `type` | `uri`, `isResult`, `usageInformation?` |
| `IPackageContentItem` | `name` | `adtType` | `isPackage`, `packageName` |
| `IPackageHierarchyNode` | `name` | `adtType?` | `is_package`, `children?` |
| `IObjectReference` | `name` | `type` | `parentName?` |

The inconsistency is itself a defect: the object's type is spelled three ways
(`type`, `adtType`, `adtType?`), and "is this a package" is `isPackage` in one type and
`is_package` in its sibling — **snake_case and camelCase for the same concept in the
same file**. A shared base interface removes exactly this.

```ts
/** Anything the repository can hand back as a located object. */
export interface IAdtObjectHit {
  name: string;
  type: string;
  uri?: string;
  packageName?: string;
  description?: string;
}

export interface IAdtSearchable<
  TCriteria extends IAdtSearchCriteria = IAdtSearchCriteria,
  TResult extends IAdtObjectHit = IAdtObjectHit,
> {
  search(criteria: TCriteria): Promise<TResult[]>;
}
```

Each existing result type then extends `IAdtObjectHit`. The hierarchy node falls out
neatly: a tree node is a hit with `children`, not a separate concept.

The generic parameters exist so consumers can bring their own types, constrained by the
contract package rather than dictated by it — consistent with this library's stance of
offering options rather than prescribing usage.

### The generic cuts both ways — a caveat to design in from the start

A type parameter behaves differently depending on which side supplies the value, and
only one direction is sound:

- **Consumer implements the interface** — sound. They produce `MyHit` themselves and
  the compiler checks it.
- **Consumer calls our method as `search<MyHit>(...)`** — unsound. We cannot return
  `MyHit`; we do not know its fields. Such a parameter degrades into a disguised `as`:
  the type claims `businessArea` while the runtime value has `undefined`.

So library methods must offer an explicit bridge rather than a pass-through type
parameter:

```ts
search<T extends IAdtObjectHit = ISearchResult>(
  criteria: IAdtSearchCriteria,
  map?: (hit: ISearchResult) => T,
): Promise<T[]>;
```

We return our shape; the consumer optionally supplies the transformation and gets
theirs. Compiler-checked, unlike a bare type argument.

### Why this is a separate spec

The cost is materially different from the atom partition, which is additive and
risk-free:

1. **Parsers must be written.** Four methods return raw XML today (`searchObjects`,
   `getWhereUsed`, `getVirtualFoldersContents`, `getAllTypes`). ADT XML parsing is
   where bugs live — `FeedRepository` already parses so defensively that a malformed
   feed is indistinguishable from an empty one.
2. **It is breaking.** Return types change and `is_package` migrates to `isPackage`.
3. **Still zero call sites.** Nothing in the library consumes a search abstraction, so
   there is no existing usage to validate the shape against.

Worth doing — it collapses three spellings of one concept into one — but as its own
scoped piece of work, not folded into the partition.

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
