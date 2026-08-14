# Finishing the honest capabilities

**Status:** design, for review.
**Date:** 2026-08-13
**Repo:** this one. The design — atoms and composites — is decided here. The application side
(narrowing fifteen handlers, deleting `unitTest`'s undeclared methods, fixing three handlers' behaviour, the guard test) lands in
`mcp-abap-adt-clients`, where the inventory below was measured.

## Why this exists

Release 8.0.0 was called "honest capability types" and split the ADT contract into atoms so a
handler would declare what it can actually do. It did not finish. Measured across all 30
handler modules on 2026-08-13:

**Counts below overlap** — a handler can appear in more than one row. 11 of 30 have at least
one stub:

The counts below are **throw-detected only** — they come from looking for
`throw ... not supported` and `throwUnsupportedVersions`, and are therefore a floor. Two
handlers have more problem methods than their number shows: `transport` ten (nine plus the
no-op `validate`), `unitTest` ten (eight plus the no-op `readTransport` plus the mock
`validate`). See "Stubs that do not throw".

| symptom | modules |
|---|---|
| clean | 19 by the throw-count, but see below — `AdtMessageClassMessage` and the four local includes are in scope for a different reason: they declare `IAdtCreatable` without creating anything |
| stubs `getVersions`/`getVersionSource` | **10** — `dataElement`, `domain`, `functionGroup`, `messageClass`, `authorizationField`, `featureToggle`, `package`, `AdtServiceBinding`, `transport`, `unitTest` |
| stubs `readTransport` | 4 — `messageClass`, `authorizationField`, `featureToggle`, `functionInclude` |
| stubs more than versions and `readTransport` | 4 — `transport` 9, `unitTest` 8, `messageClass` 5, `AdtServiceBinding` 4 |

**16 of 30 handlers have a problem**: the 11 carrying a stub, plus five declaring
`IAdtCreatable` over a `create()` that is an alias for a PUT — `AdtMessageClassMessage` and the
four local class includes. The two groups do not overlap, so **15 need type or API
subtraction** — ten declaring an atom they cannot honour, plus the five alias holders. The ten
are nine version-declarers (the version-stub list minus `unitTest`, whose version stubs were
never declared and whose only real overclaim is fixed behaviourally) plus `functionInclude`,
which joins by a different route: it declares `IAdtTransportAware` over a throwing
`readTransport`, and `unitTest` needs **behaviour implemented** as well as nine dead methods
deleted.

A stub here is **any method that does not do what its capability promises** — one that throws,
one that returns an empty state, one whose comment calls its own answer a mock. The first kind
is the only one a grep finds, which is why the counts below are a floor.

**11 of 30 handlers carry at least one stub.** Ten need their **type narrowed** — they declare
atoms ADT does not support. (Five more handlers need narrowing for a different reason, counted
above; they carry no stub.) The eleventh stub-carrier, `unitTest`, needs **behaviour
implemented**: its
shape is already narrow, but it declares `IAdtValidatable` over a validate that returns what
its own comment calls a mock, so it overclaims too — just not by declaring too many atoms. A caller reading the type
is told an operation exists; calling it throws — or, worse, quietly returns an empty result
that looks like an answer. That is the defect 8.0.0 set out to remove.

The trigger for this spec was narrower — the maintainer asked for `IAdtDeletable` as its own
interface. It is needed, but the inventory shows it closes none of the eleven cases on its
own: only two handlers stub `delete`, and in one of them the stub is **wrong** rather than
honest.

## The target state: zero stubs

Not "stubs are detected" — **there are none.** Every method a handler has does what its
capability promises; anything that cannot be real is not declared, and therefore not present.

Three checkable statements about the finished work:

1. **No handler method throws "not supported".** After step 5,
   `grep -rn "is not supported" src/core/*/Adt*.ts` returns nothing. `throwUnsupportedVersions`
   has no remaining call site and is deleted with them.
2. **No handler method returns an empty state in place of an answer.** This is the class a grep
   cannot find, so it is the behaviour guard that holds it — but the target is the same:
   `unitTest.readTransport`, `transport.validate` and the `validate` that calls itself a mock
   are gone or made real, not merely undeclared.
3. **The manifest agrees with every class in both directions**, over the full product of
   handlers and atoms, so a capability cannot be declared without being implemented, nor
   implemented while hidden.

The guard is what keeps that true afterwards. It is not the goal; the goal is that it has
nothing to report on the day it is written.

**This is why the deletions are not optional.** A throwing method kept for a friendlier error
message is still a stub — it fails statement 1 by inspection, and it fails the guard by forcing
the manifest to claim a capability the behaviour test then rejects.

## What is actually broken, by cluster

### 1. Versions — ten handlers declaring a capability ADT does not give them

`dataElement`, `domain`, `functionGroup`, `messageClass`, `authorizationField`,
`featureToggle`, `package`, `AdtServiceBinding`, `transport`, `unitTest` — **ten**, not nine. An earlier
draft of this document said nine here and then named `service` as a version-stubber further
down; both `throwUnsupportedVersions` calls are in its source. `service` was therefore about to
be left without a migration.

An earlier draft called this "a migration that stopped halfway" and pointed at
`IAdtNonVersionedObject`, which is `IAdtSourceObject` minus `IAdtVersionable`. **That composite
is not the fix and is removed by this design** — see "No new composites". These ten simply do
not declare `IAdtVersionable`.

### 2. `readTransport` — four handlers

`messageClass`, `authorizationField`, `featureToggle`, `functionInclude` throw from it, while
`IAdtTransportAware` is part of both composites. Same shape as cluster 1: an atom exists, the
composite includes it unconditionally.

### 3. The four deep cases — four different diagnoses

**`transport` — a CRUD object with its hands tied, and two stubs that lie.**
Real: `create`, `read`, `readMetadata`, `list`, `listNodes`. `validate` is a no-op — it checks an argument and returns an empty state, and is deleted rather than implemented (see below).
Stubbed: `update`, `delete`, `activate`, `check`, `readTransport`, `lock`, `unlock`,
`getVersions`, `getVersionSource`.

Two of those stubs are **false**: ADT changes a request's description, and deletes an **empty**
request via `DELETE /cts/transportrequests/<NR>`. The stubs say "immutable after creation" and
"cannot be deleted via ADT". Compare `package`, which implements both against the same server.
**This is a code defect, not a typing one** — and it must be fixed before the type is narrowed,
or the narrowing will make the lie permanent.

**`unitTest` — the stubs are a symptom of `create()` meaning the wrong thing.**

Ruled by the maintainer 2026-08-13, and it changes this entry from "delete nine dead methods"
to real work:

> A unit test handler has **CRUD and run and the rest** — they are different things. The test
> is created **once**; it is run **as many times as needed**. And `run` must work without
> `create`, because the tests may already be in the class; but without `create`/`update` there
> is nothing to run.

So the honest shape is:

| method | meaning |
|---|---|
| `create` | create the local test class — once |
| `read` / `update` / `delete` | manage that test class |
| `run` / `getStatus` / `getResult` | execute whatever tests the class holds, any number of times |

`create` currently means "start a run". **That is why `update` and `delete` looked dead**: with
creation meaning execution, there was nothing to update or delete. The stubs were a consequence
of two different operations sharing one method, not of ADT lacking the capability —
`AdtLocalTestClass` implements both, and the integration tests call it directly for exactly
that reason.

This retires the earlier plan to delete nine methods from `AdtUnitTest`. `update` and `delete`
become real, wrapping `AdtLocalTestClass`. What genuinely does not exist — `activate`, `lock`,
`unlock`, versions — is still deleted.

It also makes `create` change meaning, which is breaking, and re-opens the `IUnitTestConfig`
question with a reason this time: if `create` creates the test class, the config must carry its
source.

**Superseded below.** The paragraphs that follow describe the earlier reading — that
`unitTest`'s contract was already narrow and its stubs were undeclared dead code. That was true
of the *declarations* and wrong about the *cause*.

`AdtUnitTest` declares
`IAdtCreatable, IAdtReadable, IAdtValidatable, IAdtTestRunnable` — **no `IAdtCrud`**. So its
eight stubbed methods are implemented but *not declared*: nothing in the contract promises
them, and a TypeScript caller cannot reach them through the handler's type at all.

That is a different defect from the rest of this document, and a smaller one: **delete the
methods**, do not narrow the type. The narrowing already happened.

`IAdtTestRunnable` has existed since 13.1.0 and already carries `run`, `getStatus`,
`getResult`, `getRunId`, `getStatusResponse`, `getResultResponse`. An earlier draft of this
spec proposed a new `IAdtRunnable` with three of those six — it would have created a second,
competing contract and lost the other three. There is nothing to add here.

**`messageClass`** — no activation, no check, no versions, no `readTransport`.
**`AdtServiceBinding`** — 25 real methods, stubs only on `lock`/`unlock` and versions.

**`AdtMessageClass`** — unaffected. A message class *is* created by a POST to its collection;
it keeps `IAdtCreatable`. Only its *message* handler is in scope.

**`AdtMessageClassMessage`** — declares `IAdtCreatable`, but a message is not a standalone ADT
object: `create()` is an upsert delegating to the update path, which PUTs the parent message
class.

**Dropping the atom is not enough.** The structural guard recognises `IAdtCreatable` by the
presence of a `create` method of the right shape, not by what the class declares — so a class
keeping `create()` still satisfies it, and the bidirectional check would demand the manifest
claim it. **The method itself must go — deleted, not renamed.** All five already have a separate
`update()` (verified 2026-08-13), so `create()` is an alias over it and renaming would collide
with the method that is already there. The existing `update()` stays as the single PUT
capability. Deleting the alias is breaking for anyone calling `create()` on these handlers, and
belongs in the same major.

**Local class includes** (`AdtLocalTestClass`, `AdtLocalTypes`, `AdtLocalDefinitions`,
`AdtLocalMacros`) — same shape, same treatment. An include is brought into existence by a
lock/check/update flow on its class, not by a POST to a collection.

Note the name: the class is `AdtServiceBinding` and it lives in
`src/core/service/AdtService.ts`. `AdtServiceDefinition`, in its own module, is **clean** — it
has `lock.ts`, `unlock.ts` and `versions.ts` and stubs nothing. Saying "service" conflates
them, as an earlier draft of this document did.

## The shape of the fix

### Atoms

Split `IAdtModifiable` — today it is `update` **and** `delete` in one interface, so a handler
that can change an object but not remove it (or the reverse) cannot say so:

```ts
export interface IAdtUpdatable<TConfig, TReadResult = TConfig> {
  update(config: Partial<TConfig>, options?: IAdtOperationOptions): Promise<TReadResult>;
}

export interface IAdtDeletable<TConfig, TReadResult = TConfig> {
  delete(config: Partial<TConfig>): Promise<TReadResult>;
}

export interface IAdtModifiable<TConfig, TReadResult = TConfig>
  extends IAdtUpdatable<TConfig, TReadResult>,
    IAdtDeletable<TConfig, TReadResult> {}
```

`IAdtModifiable` **stays**, as the composite of the two. `IAdtCrud` is unchanged in shape, so
nothing that already implements everything notices. Only code naming `IAdtModifiable` where it
means one half is affected — and that is the point.

This mirrors what the package already does with `IAdtCrud`: keep the assembled name, add the
parts, prefer the part you actually mean.

### No new composites — that was the wrong question

An earlier draft said "apply `IAdtNonVersionedObject` to the ten version-stubbing handlers"
and left the `readTransport` cluster's composite "to be settled in the plan". Both were wrong,
and for the same reason the maintainer named: **`IAdtNonVersionedObject` is a negative name for
a positive thing.** It means "CRUD, validation, check, activation, lock and transport awareness
— but not versions", so it enumerates everything else in order to omit one atom. Composing from
atoms means you simply do not add `IAdtVersionable`.

It is also wrong on the facts: it still carries check, activation, lock and transport
awareness, which `transport`, `AdtServiceBinding`, `messageClass`, `authorizationField` and
`featureToggle` do not all have. Applying it to the ten would replace one lie with another.

**So: no new composite, and no wider use of the existing ones.** Each handler declares the
intersection of atoms it actually satisfies, exactly as `AdtUnitTest` already does:

```ts
export class AdtUnitTest
  implements
    IAdtCreatable<IUnitTestConfig, IUnitTestState>,
    IAdtReadable<IUnitTestConfig, IUnitTestState>,
    IAdtValidatable<IUnitTestConfig, IUnitTestState>,
    IAdtTestRunnable
```

That is the pattern. It needs no name of its own and it reads as what the handler can do.

It does **not** protect the truth on its own: a stub satisfies a structural interface
perfectly — a `delete` that throws has exactly the signature `IAdtDeletable` asks for. The
compiler guards the *shape*; only a behavioural test guards the *behaviour*. That is precisely
how the present eleven arose, and why the guard below is not optional.

**No interface may be defined by what an object does not support.** That is the rule; the
composite is one instance of breaking it.

**`IAdtNonVersionedObject` is deleted.** It came from a mistake and has only caused them: It exists only to say "everything except versions",
which is what omitting an atom already says; keeping it would leave two ways to express one
thing and invite the next handler to reach for the negative one. Removing an exported type is
breaking, and belongs in the same major as the narrowing.

It could not stay correct either: it fixes *everything else* while claiming only to exclude
versions, so it carries check, activation, lock and transport awareness to handlers that lack
them. Applying it "to fix" the version cluster would have swapped one lie for another.

**And a negative name has no meaning to the type system.** `Non` is not a negation; it is a
name over a set that happens to omit something. `IAdtNonVersionedObject & IAdtVersionable`
compiles and hands out `getVersions` — the name promises an absence the compiler never
enforced and never could.

The point is not that omission prevents a consumer composing whatever it likes — it does not,
and nothing here can. It is that **a negative type does not belong in a capability vocabulary
at all.** The vocabulary names capabilities; absence is expressed by not naming one. A type
whose meaning lives only in its name is a comment pretending to be a type.

`IAdtSourceObject` is a different case: it names its set **positively**, and every handler
matching it matches it exactly. It stays.

**The rule for anything added later:** a handler declares the intersection of atoms it
satisfies — that is the whole vocabulary. A composite is legitimate only when it names a set
positively and its members match exactly. A name reaching for "Non…", "…Without…" or
"…Except…" means an atom should be dropped, not a type added. The plan adds no third
composite.

**What the plan needs from the inventory** is therefore not a composite design but, per
handler, the atom list it satisfies. That is mechanical once the open questions below are
answered.

### Code, before the types

`transport.update()` and `transport.delete()` are implementable and must be implemented first:
description change, and deletion of an empty request. Narrowing the type around a stub that
lies would carve the lie into the contract.

## Compatibility impact

**Two things are removed from consumers, and each makes its release a major:**

- **`IAdtNonVersionedObject`**, exported from `@mcp-abap-adt/interfaces` — deleted. This is why
  the interfaces release is a major, not the minor an earlier draft assumed.
- **`create()` on five handlers** in adt-clients — `AdtMessageClassMessage`,
  `AdtLocalTestClass`, `AdtLocalTypes`, `AdtLocalDefinitions`, `AdtLocalMacros`. A caller
  switches to the `update()` those classes already have, which is the operation that was
  happening anyway.

No name changes meaning; everything else survives, with atoms added beneath it.
- **A runtime breaking change, and this is the one to read twice.** Step 5 deletes the stub
  methods. Today a caller reaching one gets a controlled `Error("... is not supported ...")`;
  afterwards it gets `TypeError: x.delete is not a function`. TypeScript callers are stopped at
  compile time, but **JavaScript consumers, and TypeScript ones going through `any` or a cast,
  see the change only at runtime, and the message is worse.**

  That is acceptable in a major — an object that never supported an operation should not carry
  a method for it — but it must be in the changelog as a runtime break, not filed under
  "types narrowed".

  **An earlier draft offered an alternative — keep the throwing method, remove it only from the
  contract — for the friendlier message. It is withdrawn: it cannot coexist with the guard.**
  A public throwing method structurally satisfies its atom, so the bidirectional check would
  force the manifest to claim the capability, and the behaviour test would then fail on the
  throw. Keeping the better error message would mean giving up the mechanism that stops this
  recurring. The methods go.

- **No change to any supported ADT operation** — every one that works today keeps working, and
  `transport` gains two. What does change is *failure* behaviour on the removed methods, as
  described immediately above. Those are different claims and an earlier draft ran them
  together.
- **Not `IAdtDeletable` alone.** Shipping only the atom would remove one stub of the eleven
  cases' many and leave the rest declaring what they cannot do.

## Order of work

1. **Code, with tests — three handlers, independent of everything below and shippable on
   their own:**
   - `transport.update` / `transport.delete` — description change, and deletion of an empty
     request;
   - `unitTest.validate` — real class-name validation, as `AdtClass` does, replacing the
     self-declared mock;
   - `functionGroup.activate` — read `<msg type="E">` from the response instead of returning
     `errors: []` regardless, at all three call sites. It is the one handler whose method works
     and whose answer is ignored, so no capability atom and no request-counting guard would
     have caught it.

   `transport.validate` is **deleted** rather than implemented: the request number is
   system-generated, so there is nothing to validate.
2. **`@mcp-abap-adt/interfaces`**: add `IAdtUpdatable` and `IAdtDeletable` with
   `IAdtModifiable` as their composite, and **remove `IAdtNonVersionedObject`**. The removal
   makes this a **major**, not the minor an earlier draft claimed.
3. ~~Composites.~~ **Removed** — this design adds none. See "No new composites" above.
4. **Publish interfaces**, then narrow the overclaiming handlers in adt-clients, each to the
   exact intersection of atoms it satisfies — not to a composite. **Fifteen handlers**: the ten
   declaring capabilities ADT does not support, plus `AdtMessageClassMessage` and the four
   local class includes, whose `create()` alias is deleted rather than merely undeclared. The
   two groups do not overlap. `unitTest` is not among them — it is already narrow.
   **Breaking** for a consumer that named a wide type — a major.
5. Delete each stub as its handler stops declaring the method — and for `unitTest`, delete the
   **nine** that were never declared: the eight that throw, plus `readTransport`, which does
   not throw at all (see "Stubs that do not throw" below). `transport.validate` goes here too.

   **This step must complete before the shape guard is switched on**, for the reason given
   under check 1: TypeScript reads shape, not intent, so an undeclared method still satisfies
   its atom. The methods are **deleted**, without exception — the alternative of keeping a
   throwing method for a friendlier JavaScript error was withdrawn above, because such a method
   still satisfies its atom structurally and would force the manifest to claim the capability.

Step 2 is the interfaces release. Step 4 is one adt-clients major.

## Stubs that do not throw — and why the guard needs more than a `throw`

`unitTest.readTransport()` does not throw. It returns an empty state, and its own comment says
a test run has no transport request. The dishonesty is identical to a throwing stub; only the
disguise differs, and the contract correctly does not declare it.

**This breaks the detection criterion**, not just the count. Every number in this document came
from looking for `throw ... not supported` or `throwUnsupportedVersions`. A method that quietly
returns nothing is invisible to that, so the inventory is a floor, not a total.

A scan for the wider class — a body that issues no request and returns a bare state — was run
across all 30 modules on 2026-08-13 and is **not reliable**: most of its hits are two-line
delegates in `AdtUtils` that genuinely call an imported function, which a regex cannot tell
from a no-op. It did surface, besides `unitTest.readTransport`, the `validate()` of both
`transport` and `unitTest`, each returning an empty state with a comment that ADT offers no
validation endpoint — arguably the same pattern, arguably an honest "nothing to validate".

So the guard test cannot be a grep over source. It has to assert **the semantics each atom
promises**, against a recording connection — which is not the same as "a request goes out",
since some capabilities legitimately make none. The next section works that out; this class of
stub is the one that produced `{"success": true, "count": 0}` over 55 real transport requests,
and it is the class a grep cannot see.

## How this is verified

Three earlier attempts at this section were wrong, each in an instructive way:

- **grep for `throw ... not supported`** — `unitTest.readTransport()` disproves it: no throw,
  returns an empty state, equally dishonest.
- **"every declared method issues a request"** — `IAdtTestRunnable.getRunId()`,
  `getStatusResponse()` and `getResultResponse()` are state accessors that correctly touch no
  network, and a local `validate()` can be a real capability with no endpoint.
- **reflect over the classes to discover their atoms** — impossible. `implements`,
  intersections and type aliases are erased at compile time; nothing at runtime can say which
  atoms a class declared.

### The manifest is the source, and three checks defend it

```ts
// src/__tests__/unit/capabilities/manifest.ts  (adt-clients)
export const HANDLER_CAPABILITIES = {
  AdtClass: ['creatable', 'readable', 'updatable', 'deletable', 'validatable',
             'checkable', 'activatable', 'lockable', 'versionable', 'transportAware'],
  AdtRequest: ['creatable', 'readable', 'updatable', 'deletable'],   // no validatable
  AdtServiceBinding: ['creatable', 'readable', 'updatable', 'deletable', 'validatable',
                      'checkable', 'activatable', 'transportAware'],
  // … one entry per exported handler
} as const satisfies Record<string, readonly Capability[]>;
```

**1. Shape — compile time, and it must be BIDIRECTIONAL.**

A one-way assertion "the class satisfies what the manifest claims" is not enough, and permits
exactly the regression this guard exists to stop: a class declares `IAdtDeletable`, its
`delete` throws, and the manifest simply omits `deletable`. All three checks pass while the
public contract overclaims. Under-claiming is not the safe direction — it is a hiding place.

So the assertion runs both ways: **the manifest names an atom if and only if the class's public
type structurally satisfies it.**

```ts
type Has<C, A> = C extends A ? true : false;
type Claims<H extends keyof typeof HANDLER_CAPABILITIES, A extends Capability> =
  A extends (typeof HANDLER_CAPABILITIES)[H][number] ? true : false;

// NOT one line per pair — a forgotten line is a silent hole, and there are
// 30 handlers × 11 atoms of them. The product is generated, so nothing can be
// left out: every mismatch surfaces as a key in Mismatches.
type AtomFor<H, A extends Capability> = /* atom type for A, bound to H's config */ never;

type Mismatches = {
  [H in keyof typeof HANDLER_CAPABILITIES]: {
    [A in Capability as
      Has<HandlerClass<H>, AtomFor<H, A>> extends Claims<H, A> ? never : A
    ]: ['structurally satisfies', Has<HandlerClass<H>, AtomFor<H, A>>,
        'manifest claims',        Claims<H, A>];
  };
};

// Every handler maps to {} when it agrees with its manifest entry.
type _NoMismatches = Assert<Equals<Mismatches, EmptyPerHandler<typeof HANDLER_CAPABILITIES>>>;
```

The `as` clause in the mapped type drops every atom that agrees, so a handler in disagreement
keeps a key and the assertion fails **naming the handler and the atom**. `HandlerClass<H>` and
`AtomFor<H, A>` are the two lookups the plan has to write — a registry of the exported classes
and one of the atom types bound to each handler's config — and they are what makes the product
enumerable rather than hand-listed.

This only works once step 5 has deleted the undeclared stubs — while `AdtUnitTest` still
carries a `delete` method it never declared, it satisfies `IAdtDeletable` structurally.
TypeScript sees shape, not intent. **Order matters: delete the dead methods first, then this
check becomes meaningful.** Until then it would demand the manifest claim capabilities the
handler was never meant to have.

**2. Completeness — runtime, and this part reflection *can* do.** Enumerate the package's
exported classes — values, not types, so they survive compilation — and fail on any handler
absent from the manifest. This is what stops a new object type, copied from an existing one,
from arriving unchecked; that is how the current eleven appeared.

**3. Behaviour — runtime, driven by the manifest.** For each handler, for each atom it claims,
assert that atom's own semantics against a recording connection:

| atom | asserted of every handler claiming it |
|---|---|
| `IAdtCreatable` | `create` issues a **POST**. Always — see the note below. |
| `IAdtReadable` | `read` issues a GET and returns the body; `readMetadata` likewise |
| `IAdtUpdatable` | `update` issues a **PUT**. Always. |
| `IAdtDeletable` | `delete` issues a DELETE |
| `IAdtValidatable` | `validate` either issues a request **or** returns a decision it computed — never an empty state with no decision in it |
| `IAdtCheckable` | `check` issues a **POST** and reports what came back |
| `IAdtActivatable` | `activate` issues a **POST**, *and* an error-severity `<msg>` in the response reaches the caller — see `functionGroup` below |
| `IAdtLockable` | `lock` returns a handle the server supplied; `unlock` issues a request releasing it |
| `IAdtVersionable` | `getVersions` issues a GET and parses a feed; `getVersionSource` fetches a version's body |
| `IAdtTransportAware` | `readTransport` reports a request the server named |
| `IAdtTestRunnable` | `run` issues a POST; `getStatus` and `getResult` each issue a GET and report what came back; `getRunId`/`getStatusResponse`/`getResultResponse` return prior state **without** a request |

Every method of an atom is covered, not one per atom — `readMetadata`, `unlock` and
`getVersionSource` are exactly where stubs hid before.

### The verbs are fixed, and that is a finding about a handler

`create` is POST and `update` is PUT — the atoms do not bend per handler. Review raised
`AdtMessageClassMessage.create()` as a counterexample: it is documented as an upsert and
delegates to the update path, which ends in a **PUT** of the parent message class
(`src/core/messageClass/update.ts:53`). The code is as described.

The conclusion is the opposite of relaxing the rule. **A message is not a standalone ADT
object** — it lives inside a message class, and there is no collection to POST it to. So that
handler does not create a resource; it modifies its parent. It should not declare
`IAdtCreatable` at all, and the guard rejecting it is the guard working.

Local class includes, raised in the same review, answer the same way: a lock/check/update flow
is updating a class, not creating an object.

**`update`, `check` and `activate` were then checked across all 30 modules, 2026-08-13.
The rule holds for every one of them:**

| atom | verb | outcome |
|---|---|---|
| `update` | PUT | all 26 modules end in PUT |
| `check` | POST | all go through `src/utils/checkRun.ts` |
| `activate` | POST | all go through `src/utils/activationUtils.ts` — except one |

`domain`, `package` and `dataElement` appear to start with a GET. They are read-modify-write:
GET the current XML, patch the changed fields, PUT it back. The first request is not the
operation, and building the XML from scratch instead would drop fields the client does not
model.

### A defect found while checking the verbs: `functionGroup.activate`

`activateFunctionGroup` is the only activation not going through the shared helper. Its verb is
correct — POST to `/sap/bc/adt/activation` — but it **returns the raw response and never reads
`<msg type="E">`**, and neither does its caller: `AdtFunctionGroup.ts:711` takes the result and
returns `{ activateResult: result, errors: [] }`, so `errors` is empty whatever the server
said, at all three call sites.

Nine handlers call `assertActivationSucceeded`. This one does not.

That is the defect 10.0.2 fixed — activation judged by a flag rather than by the messages,
where only `<msg type="E">` is the verdict. Nine modules were corrected then; `functionGroup`
has its own implementation and was missed.

**It belongs in step 1 with `transport` and `unitTest`** — a handler that reports success
regardless of the answer is a stub wearing a working method's clothes, and no capability atom
would catch it. Neither would the behaviour guard as specified: a POST does go out. Only
reading the response body does.

This is worth stating plainly: **the guard proves a request happens, not that its answer is
believed.** For `activate`, the assertion must be that an error-severity message reaches the
caller.

`IAdtValidatable` was the awkward one. **Both cases are now decided, and oppositely** — which
is what a test can force but never settle:

- **`transport` does not get the atom at all.** A transport request's number is generated by
  the system, so there is nothing to validate before creating one. `AdtRequest.validate()` is
  deleted, and `IAdtValidatable` leaves its list.
- **`unitTest` keeps the atom and gets code.** A unit test *is* a class, so validation there is
  a class's validation. `AdtUnitTest.validate()` currently checks an argument and returns what
  its own comment calls "a mock success response" — a stub that admits itself. `AdtClass`
  shows what it should do: call the real name validation against the server.

For reference, the three as they stand:

```
class.validate      calls validateClassName against the server   real
transport.validate  argument check, then an empty state          nothing to validate
unitTest.validate   argument check, then a "mock success"        stub
```

**What none of the three catches:** an atom nobody has thought of. The manifest and the
behaviour table enumerate the atoms that exist; a capability with no atom is invisible to all
three, and always will be. That is the limit of the design, and it is stated rather than
hidden.

## Open questions — closed 2026-08-13

The maintainer answered both: **these are ADT's limits, not unimplemented features.**

1. **`AdtServiceBinding`** (not `AdtServiceDefinition`, which is clean) stubs `lock`/`unlock`
   and versions — **ADT does not offer them**. So they leave the atom list; there is no code
   to write. It declares neither `IAdtLockable` nor `IAdtVersionable`.
2. **`messageClass`** stubs `activate`, `check`, `readTransport` and versions — **also ADT's
   limits**. Same treatment: those atoms are simply not declared.
3. ~~Does the `readTransport` cluster need a composite?~~ **No.** Those four do not declare
   `IAdtTransportAware`. There is no cluster to name.

This settles the shape of the work: **three handlers need behavioural code, fifteen need
type or API subtraction, and `unitTest` additionally needs nine dead methods deleted.** `functionGroup.activate` reports success whatever the server answered.
`transport`'s `update` and `delete` are stubs that lie — ADT changes a request's description
and deletes an empty one, which `package` proves against the same server. And
`unitTest.validate()` returns a self-declared mock where a class's real validation belongs.
Everywhere else the fix is subtraction: stop declaring what ADT cannot do.

It also means the per-handler atom lists are now writable without further probing, which is
what the plan was waiting on.

## Related

- 8.0.0 — the release that introduced the atoms and stopped short
- `src/adt/IAdtCapabilities.ts`, `src/adt/IAdtComposites.ts` — the atoms and the two composites this spec extends
