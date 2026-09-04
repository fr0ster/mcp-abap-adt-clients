# `adt-clients` onto the 29.0.0 contracts — design

> **Amended 2026-09-04.** The migration target is now `interfaces@30.0.0`, which
> ships first and collapses the members that duplicated one endpoint at a
> different level of doneness. Everything below holds; what changed is that the
> one gap this design had to record — package contents — is closed in the
> contract instead of documented as a known cost. The file name keeps its date
> and its 29; history lives in git.

## Why

`@mcp-abap-adt/interfaces@29.0.0` is published. It removed the wide composites,
the 32 state bags and the transport envelope from the contract surface, and moved
every CRUD member from throwing to answering `IAdtResponse`. `adt-clients`
implements those contracts and no longer compiles: **154 errors**.

The migration is not bookkeeping. It closes the report this whole line of work
started from — creating and modifying a class in a package that **requires a
transport request** produced a fabricated error instead of the one SAP sent.

## What the contract now is

- `IAdtResponse<TValue, TError = IAdtError>`; `getResult()` answers
  `IAdtResult<TValue>`.
- Eight members answer instead of throwing: `create`, `read`, `readMetadata`,
  `update`, `delete`, `validate`, `check`, `activate`.
- `@throws` remained on `lock`, `unlock`, `getVersions` and `getVersionSource` in
  29.0.0, on the grounds that they answer a lock handle, nothing, a version list
  and a source string and so have no failure half. **Superseded 2026-09-04:** a
  lock refused because another user holds it is a 403, so they do have one, and in
  30.0.0 they answer like everything else. No member of the contract throws.
- Each atom names its own result: `IAdtCreatable<TConfig, TCreated>`,
  `IAdtReadable<TConfig, TSource, TMetadata>`, and so on. There is no `IAdtCrud`,
  `IAdtModifiable`, `IAdtObject`, `IAdtSourceObject`.
- No state types, no `errors[]`.
- `IAdtOperationOptions.analyse` is the injection point for what counts as a
  failure.
- `AdtOperationError` no longer exists; this package's `AdtSAPError` and
  `AdtParseError` remain.

## Decisions taken

**One spec for the whole migration.** Decomposition happens in the plan, not by
splitting the design.

**The interpretation of a server response belongs to the consumer, on two
independent axes.** This is the principle the rest of the design is an
implementation of, and both strategies below are instances of it rather than
separate features.

`adt-clients` does not decide what an ADT answer *means*. It obtains the wire
response and hands the interpretation over:

- the **error strategy** decides whether that answer is a failure at all, and how
  it is presented as `IAdtError`;
- the **result strategy** decides how the same answer is presented as
  `IAdtResult<T>`, when no failure was established.

The library ships defaults for both. They are defaults, not the meaning.

```
wire response
  → error strategy   (consumer's, or the shipped default)
      → failure  → IAdtError
      → no failure
          → result strategy   (consumer's, or the shipped default)
              → IAdtResult<T>
```

The order is fixed: the failure question is answered first, because a result
strategy must not be asked to make a value out of a refusal.

**The two axes are genuinely independent**, which a missing class shows better
than any argument. ADT answers a read for one with 200 and an empty body. One
consumer calls that a failure and takes what it needs from `IAdtError` — a
read-modify-write must, since writing back what it read would erase the object.
Another accepts the same answer as legitimate and takes the raw body, or its own
shape, through `IAdtResult`. Same bytes, opposite readings, and neither is this
library's to impose.

**`IAdtResult` is the strategy, and it is the only injection point for shape.**
It is not a container holding a value — its *implementation* decides how the
answer becomes a value. `adt-clients` ships the defaults, and two or three of them
where an answer is large enough that a caller might reasonably want different
amounts. A consumer supplies their own implementation and gets their own shape.

**The substitution happens at the factory, and the factory is ours.**
`IAdtResult<T>` stays `{ readonly value: T }` and **no member gains a
parameter** — the choice is never made at the call. What varies is the **type
arguments the factory instantiates the atoms with**, and the factory lives in
`adt-clients`, so its return type is ours to declare:

```ts
// the default: each member answers its document
getClass(): IAdtCreatable<IClassConfig, ClassCreated> &
            IAdtReadable<IClassConfig, ClassSource, ClassMetadata> & …

// a caller who wants a different shape names the strategy
getClass(results: ClassResultStrategy<R>): IAdtCreatable<IClassConfig, R['created']> &
                                           IAdtReadable<IClassConfig, R['source'], R['metadata']> & …
```

The strategy is chosen once per implementation rather than per call, which fits how
these consumers work: a backup tool wants documents whole for everything it
touches, a script wants two fields from every read, an MCP server picks by what
its model is about to do. None of them changes its mind between `create` and
`read` of the same object.

Two or three defaults ship for the answers large enough to be worth reading
differently — transport requests, dumps, package contents — and a consumer
supplies their own for anything else.

Rejected on the way here, each for putting the choice at the call rather than at
the implementation: a `parse` argument on a member, a `result` field on the
operation options, and a type parameter **on a member** — `search<T>(criteria,
parse)` — which obliges every implementation to carry a second signature whether
or not its callers use it.

A type parameter on the **atom** is the opposite move and is what 30.0.0 does:
`IAdtPackageBrowsing<TContents>` names one member whose result type follows the
strategy the implementation was constructed with. Nothing is decided at the call,
and an implementation that wants only the default writes nothing at all.

**There is always a strategy, and the default is one.** This is architecture and
it outranks anything written here: a member never builds a value on its own, and
there is no branch that parses "because nobody asked for anything else". What a
consumer chooses is *which* strategy, never *whether* there is one — so
`utilsDocuments`, `transportDocuments` and `dumpDocuments` are default
**strategies**, and the parsing that lives in this library's low-level functions
today belongs inside them.

That is what makes the answer replaceable rather than merely configurable: a
consumer swapping the set is not overriding a built-in behaviour, they are
supplying the one thing that was ever doing the reading.

**Which shape that default strategy returns is what the member answered before.**
Decided by the maintainer, 2026-09-04, after `interfaces@30.0.0` shipped with
exactly that rule in its own type parameters — `IAdtPackageBrowsing<TContents = IPackageContentItem[]>`,
`IAdtRequest<TList = ITransportTree>`, `IRuntimeDumps<TList = string, TDump = string>`.
The defaults are therefore not uniform, and deliberately so: each is what its own
member answered, so a consumer who names no strategy is not moved by this release
at all.

An earlier draft of this design said the default answers the body as it arrived,
uniformly. That was written before the contract existed and would now contradict
it: a no-argument `getUtils()` answering `string` where `IAdtPackageBrowsing`
declares `IPackageContentItem[]` makes the factory disagree with the contract it
returns, and silently retypes every existing call to `string`.

What decision 5 settles is untouched — parsing is the consumer's, and this library
does not know which fields a caller needs. That is why `packageRaw`, `dumpDocument`
and the rest exist and are exported: the document is one strategy away, named and
importable, rather than being the shape everyone is given whether they wanted it
or not. And because the default is itself a strategy, "the document" and "the
parsed list" are two entries in one set rather than a behaviour and its escape
hatch.

**What more than one default is for.** The same request serves callers who want
very different amounts, and today the library picks for them:

| endpoint | a caller wanting little | a caller wanting much |
|---|---|---|
| transport requests | the request numbers alone | the tree with its containers, plus the description and the language a request carries |
| runtime dumps | a short list — id, time, program, message | the dump itself |
| package contents | names and ADT type codes | the full node structure with descriptions and sub-package links |

**This library has several consumers, and they want different amounts.** An MCP
server passes what it gets to a language model, where size is a budget: a whole
node structure spent on a question that needed six names displaces what the model
was reasoning about, while a listing too thin to answer forces a second call and
another turn. A backup tool wants the document whole and unparsed, because
anything this library dropped is data it cannot restore. A script wants two
fields. A human-facing ABAP tool wants what it can render.

None of those is more correct, and this library cannot tell which one is calling.
That is the argument for injection — not that the far end is sometimes a model,
but that the near end is several different programs with incompatible needs.

A short listing is therefore not a truncated full one. It is a different reading
of the same document, and the caller is the only one who knows which reading
their own consumer needs. That is the case `IAdtResult` implementations exist
for, and the reason the library ships more than one rather than making the
smaller reading a lossy version of the larger.

Language information is the sharpest instance: a transport request carries it,
nothing in the current shape exposes it, and a consumer who needs it presently
has no way to ask without re-fetching and parsing the document themselves.

Mutations that ADT answers with nothing return `void`. Success is `ok: true`; the
reason for a failure is in `getError()`.

**Legacy migrates; batch is deleted.** `AdtClientLegacy`, `AdtUtilsLegacy` and
`AdtClassLegacy` serve real systems and move to the new contract.
`AdtClientBatch` and `AdtRuntimeClientBatch` are research rather than product —
mixed GET+POST in one envelope is a server-side 500 — and are removed with their
tests rather than migrated.

**Vertical slice, then replication.** `class` is taken to completion — value
types, implementation, casts re-read, positive and negative tests — and only then
are the other 27 done in batches of four or five. An approach applied to
twenty-eight things before it is proved on one is how this session produced three
silent data losses.

## Shape of the work

### Per object type

`src/core/<type>/types.ts` declares one named type per member, replacing the
state bag, with the measured ADT behaviour in its doc comment. `class` is written
and is the worked example:

```ts
export type ClassCreated = string;           // the created class's metadata document
export type ClassSource = string;            // /source/main
export type ClassCheckResult = string;       // chkl:messages; <msg type="E"> is the verdict
export type ClassActivationResult = string;  // activationExecuted="false" ≠ failure
export type ClassDeletionResult = string;    // del:isDeleted="false" inside a 200
export type ClassUpdated = void;             // ADT answers nothing worth reading
```

Copy the shape, never the values: read what each type's low-level functions
actually request before naming its results.

The implementation then declares the atoms it honours with those types, and each
member returns `answering(...)` from `src/utils/adtResponse.ts` rather than
building a state and throwing.

### Failure classification, and how `analyse` composes

`recogniseFailure` already distinguishes `refusal`, `parse` and `connection`, and
`refusalAware` is installed once per connection. Neither changes.

What does change is that `answering` cannot stay as it is. Today it takes a
thunk and sees either a finished value or an exception — never the wire response
of a *successful* call. So `analyse` would never be consulted on a 200 with an
empty body, which is the case it exists for, and could not clear a refusal that
`refusalAware` had already turned into a throw. The replacement takes the request
and the extraction separately:

```ts
answering<T>(
  run: () => Promise<IAdtWireResponse>,   // one request, unparsed
  read: IAdtResult-producing strategy,    // how the answer becomes a value
  analyse?: IAnalyse,                     // from the operation options
): Promise<IAdtResponse<T>>
```

**Composition, once per step and never per chain:**

| what happened | wire in hand | default verdict | `analyse` may clear it | result |
|---|---|---|---|---|
| request returned | yes | `undefined` | — | the value, or a failure if `analyse` returns one |
| threw, response attached | yes | `recogniseFailure(error)` | **yes** | cleared → the value from that wire; otherwise failure |
| threw, no response | **no** | `recogniseFailure(error)` | **no** | always a failure |
| no `analyse` supplied | either | as the default decided | — | as the default decided |

**A verdict can only be cleared when there is a wire response to produce a value
from.** A socket that would not open, a session that is gone, an authentication
that failed — none of these carries an answer, so there is nothing for the result
strategy to read and no `IAdtSuccess<T>` that could honestly be built. `analyse`
is still called for the record, but its `undefined` cannot turn "nothing came
back" into a success. Enforced in code, not left to the caller, and covered by a
negative test: an error with no `response`, an `analyse` that clears everything,
and an assertion that the answer is still `ok: false`.
A chain like `create` runs this per request, so `IAdtError.request` names the step
that refused rather than the chain that contained it.

### Casts

461 `as X`, 297 `: any` and 141 `as unknown as` exist in the repository. Many were
written to get around the envelope. Each cast in a migrated file is read: removed
if redundant, and if it hides a real mismatch, the mismatch is fixed. A cast is
invisible to both the compiler and a diff review, so this is done by reading, not
by grep counts alone.

## Testing

**Both directions.** That a failure is reported when SAP refused, and that none is
reported when it did not. Only the first is usually written, and a library that
failed everything would pass it.

**Negative cases are their own body of work**, not an afterthought in existing
tests: a refusal inside a 2xx, a 404 carrying a document, an empty body where a
document was expected, a deletion that did not delete.

**Unit tests over captured real answers.** The evidence already gathered — an
`exc:exception` with `ExceptionResourceNoAccess`, 1709 bytes, from a live trial —
is run through the classification and asserted to reach the caller whole. This is
deterministic, needs no system, and tests what no type can.

**A test that did not run did not pass.** Six tests in `sqlQuery` and
`tableContents` passed without executing; the suite printed `PASS` with no steps.
Skips are printed unconditionally.

**Seven integration files still on the old contract** — `discovery`, `readSource`,
`readMetadata`, `whereUsed`, `search`, `sqlQuery`, `tableContents` — read the
verdict from the contract using the `expectResult` / `expectFailure` helpers in
`src/__tests__/helpers/contract.ts`.

## Verification

The compiler is not the check, and this is measured rather than asserted: where a
cast sits, `tsc` stays silent, and three regex edits of the contracts package
silently deleted six types and the first field of three others while every check
stayed green.

So each step is verified three ways:

1. **Compiler** — for signature mismatches. Cheap, exact, and exhausted quickly.
2. **Enumerate, edit, count** — list targets by an exact criterion, edit, then grep
   every touched symbol across the repository *including comments and README*, and
   compare counts before and after. Six review rounds on interfaces #63 found zero
   defects in types and every one in prose or unused imports.
3. **Tests** — unit for meaning, integration for behaviour.

## Done means

- `npm run lint:check`, `npm run build`, both type-checks: clean.
- No `IAdtObjectState`, no `I<Object>State`, no `errors: []`, no `AdtOperationError`
  anywhere in `src`.
- Batch removed; legacy migrated.
- Full integration run against the cloud trial with no failure attributable to the
  migration, and every skip printed with its reason.
- **On-prem**: creating and modifying a class in a package that requires a
  transport request surfaces SAP's own message. The cloud trial cannot show this —
  `ZLOCAL` is local and `transport_request` is unset, which the last full run
  confirmed by skipping that test — so it is verified on the machine with on-prem
  access before release.

## The rule underneath all of this

Every implementation lives in a concrete package. `@mcp-abap-adt/interfaces`
holds types, interfaces and the constants they name, and since 29.0.0 emits no
class and no function at all — 50 constants and otherwise empty modules.

That is why the result strategies and the factory that selects them belong here
rather than there. When a design appears to need a change in `interfaces` to give
a consumer flexibility, check first whether the concrete package's own surface can
carry it — here the factory's return type carries the selection.

**What it cannot carry is a member that should not exist.** Where the contract
itself declares two members over one endpoint, no factory return type reaches a
caller through them, and the fix is in the contract. That is the one change this
design does require there, and it ships first as
`@mcp-abap-adt/interfaces@30.0.0`.

## Out of scope

The `adt-clients` version number, and publication. Both are the maintainer's.

## Package contents: one member, and the strategy decides the shape

Decided by the maintainer, 2026-09-04, after three failed attempts on my part to
close this by reasoning instead of asking.

**One endpoint, one member, and the result strategy chooses.** The node structure
is a single ADT resource. A caller asks it once, and what comes back — a flat
list of names and type codes, the whole tree of nodes, or the raw document a
backup tool needs untransformed — is the result strategy's decision, not a
different method's.

This is decision 16 and the strategy design working together, and it is the
canonical case for them rather than an awkward one.

**What that means for the current contract.** `IAdtPackageBrowsing` declares
`getPackageContentsList` and `getPackageHierarchy` as separate members over that
one resource, each walking the structure itself and discarding the document. That
is two members for one endpoint — the shape decision 16 exists to prevent — and
it is why no strategy can reach a caller through them.

Collapsing them into one member is therefore a change to
`@mcp-abap-adt/interfaces` rather than to this package — **and it happens first.**
`interfaces@30.0.0` replaces `getPackageContentsList` and `getPackageHierarchy`
with one `getPackageContents` on a type-parameterised atom, and `adt-clients`
migrates once, onto that. `fetchNodeStructure` is untouched and stays where it is:
it asks for the node structure as itself, and that the package member reaches the
same resource on its way is the implementation's business, not the contract's.

**What this package then ships for package contents:** four readings of one
answer — `packageList` (names and ADT type codes), `packageTree` (the structure
with its descriptions and sub-package links), `packageShort` (the reading an MCP
server can afford), and `packageRaw` (the document untouched, which a backup tool
could not reach through the old members at all). They are chosen the way every
other reading is: given to the implementation at construction, through
`AdtClient.getUtils()`.

**What does not come with them is the walk.** `maxDepth`, default 5, and the
recursion into sub-packages described something the library did on the caller's
behalf across many requests. A member answers one read; building a tree out of
that answer is the result strategy's, and walking further with it is the
consumer's. Recorded in the CHANGELOG as the behaviour change it is.
