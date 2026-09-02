# Decisions, and why

Every entry here is a choice that could reasonably have gone the other way. The
point is not the choice — it is the reasoning and the evidence, so that whoever
meets the question next can tell a decision from an accident, and can reopen one
without re-deriving it from scratch.

**Adding an entry.** One per decision, in the shape used below, and it starts
from the **problem** — the thing that was actually hit, not the principle it
illustrates. Then what was decided, what it was decided *against*, why, and what
would change it. An entry that cannot name what would overturn it is a
preference, not a decision; an entry that cannot name the problem is a rule
somebody invented.

**This file replaces committed run logs and probe captures.** Those used to be
landed under `docs/evidence/` and kept. They should not be: a log is the raw
material a decision is made from, and once the decision is written the log is a
large file nobody reads, carrying whatever the run happened to print. What is
worth keeping is what/how/why — and the log itself stays in git history for
anyone who wants to check the distillation.

**Superseding.** Do not delete an entry. Mark it superseded and link to the one
that replaces it: the history of a reversed decision is the most useful part of
it.

The **contract's** decisions — what belongs in a type, what a capability atom
may state — live in `@mcp-abap-adt/interfaces`, in its own `DECISIONS.md`.
Entries here are about this implementation.

---

## 1. A method the factory cannot return is not API

**Problem.** `getProfiler()` is typed `IProfiler`. Four methods on the concrete
`Profiler` class — `latestTraceId()`, `listTraceIds()`,
`listTraceFilesResponse()`, `listTraceFiles()` — were not in that contract, so
no consumer could call them. One had a caller inside this package; three had
none. Meanwhile the gap they appeared to fill (getting the newest trace) was
reported as unmet, because for anyone outside it was.

**Decided.** Removed, in 15.0.0. A capability reaches consumers through the
contract the factory returns, or it does not exist.

**Against.** Keeping them as a documented "advanced" surface reachable by
casting to the concrete class, or widening `IProfiler` to include them.

**Why.** An unreachable method is worse than a missing one: it reads as coverage
in the class, so nobody writes the thing that is actually needed. It also
invites the cast, and a cast in a test is a test reaching past the contract it
exists to check — `ProgramExecutor.test.ts` had exactly that, with a comment
explaining that the contract "does not carry `latestTraceId()` yet".

**What would change it.** A consumer need that the contract cannot express. Then
the answer is to widen the contract, not to re-add a method beside it.

---

## 2. A removal ships with a replacement a consumer can import

**Problem.** The migration published for decision 1 was `list()` reduced with
`compareRecordedAt`. That function existed and `src/index.ts` did not re-export
it, so the documented migration would not have compiled. The gate meant to catch
this passed, because it matched documented names against every identifier
anywhere under `src`.

**Decided.** `compareRecordedAt` is public since 15.0.0, and `check:docs`
measures each documented import against the surface of the package it is
imported *from* — this package against what `src/index.ts` reaches through its
barrels, each dependency against its own `types` entry.

**Against.** Telling consumers to write the comparison themselves, and treating
the doc gate as a linter rather than a proof.

**Why.** Comparing `recordedAt` as text is wrong across UTC offsets — `09:00:00Z`
is later than `10:00:00+02:00` and sorts lower — so "write it yourself" hands
every consumer the same subtle bug. And a gate that reports nothing is
indistinguishable from a gate that finds nothing: this one had two holes at once
(pooled packages, and `import type` unread) and still printed success.

**What would change it.** Nothing about the rule. The gate's strictness would
change if a documented snippet legitimately needed an internal path — it can,
via a relative import, which is measured against the loose set on purpose.

---

## 3. A checker reads code with a parser, not with a pattern

**Problem.** The doc gate read imports with a regular expression, and review
found three holes in it in a row: `import type { … }` unread, a specifier in
double quotes unread, and — before those — names measured against a pooled set
of packages. Every one of them made a line **invisible** rather than
mis-parsed, and an invisible import is a passing one. A fourth was waiting in
any import wrapped across lines. The same regex had been copied into the
`docsImportsResolve` unit test, so both had the same blind spots.

**Decided.** No part of the gate reads code with a pattern. Fences come from a
Markdown parser (`markdown-it`), each block from the TypeScript parser, and what
a module exports comes from the TypeScript **type checker** — which answers that
question, rather than describing what the text looks like. One reader,
`scripts/doc-imports.js`, is shared by the gate and the test.

The export side was the last to go, and it went before review asked: it was
still matching `export …` lines while the sibling test had used the checker all
along, so the same gate held its two halves to different standards. The cost is
runtime — about four seconds against instant — which for a lint step is the
cheaper half of the trade.

**Against.** Widening the pattern once more — cheaper on the day, and it would
have been the third such widening.

**Why.** Quoting, line breaks, `type` modifiers, aliases and import-looking text
inside comments are decided questions for a parser and open ones for a pattern.
The failure mode is what makes it worth the change: a pattern that does not
match reports success, so each hole cost a review round to find and left the
gate's claim untrue in the meantime.

**The lesson had to be learned three times.** The first fix moved the *imports*
to a parser and left the *fences* matched by hand, one line above — so `~~~typescript`
and ```` ```ts title="example" ```` still never reached it. Valid CommonMark,
invisible to the gate, found by the next review. Replacing one hand-rolled
matcher with a parser is not the decision; leaving none is.

Then the *exports* were still a pattern, one function below. Each fix removed
the matcher it was looking at and left the next one standing.

**And the principle outran the code.** This entry said "a pattern that does not
match reports success" while the gate itself printed unmeasurable imports as a
footnote and exited `0` — the same thing by another route. An import the gate
cannot check now fails it. Writing the rule down is not applying it.

**What would change it.** A document format neither parser can read. Nothing in
Markdown is.

---

## 4. Unmeasured behaviour is stated as unmeasured

**Problem.** `delete(traceId)` was added against a measured `DELETE` that
answers `200`. What a **missing** id answers was never measured.

**Decided.** The signature is `Promise<void>`, which describes the resolved
value and says nothing about failure; a `404` rejects like any transport error,
and the CHANGELOG and the reference both say the case is unmeasured, so a caller
that must tolerate it has to catch.

**Against.** Swallowing `404` to make deletion idempotent — the shape most
delete APIs take.

**Why.** Idempotence here would be a guess dressed as a guarantee. HTTP's
idempotence is about server state, not about the status a second call returns,
so "DELETE is idempotent" does not license us to invent the response. One
request on an on-prem system settles it; until then the honest contract is the
one that does not claim.

**What would change it.** That one request.

---

## 5. Assertions are the proof; a run log is not

**Problem.** The integration test for `delete()` polls the feed until the id is
gone, and its verdict lines are missing from the run log — a passing test whose
own evidence is invisible. Two plausible explanations were tested and **both
were wrong**: `process.stdout.write` followed by `process.exit()` loses nothing
on this platform, to a pipe or a file, at 1 MB; and a jest suite writing 2000
lines at the end of its last test kept them all.

**Decided.** No logging machinery was added. The mechanism is recorded where the
test is, and the test's assertion stands as the proof.

**Against.** Making the helper write synchronously to fd 1, or writing a verdict
file per run.

**Why.** The RFC run showed what actually happens: the line survives but lands
*after* jest's `Ran all test suites` summary. Progress written straight to
stdout from a jest worker reaches the parent through an asynchronous relay that
`forceExit: true` does not wait for — a race the last test loses. A fix built on
either of the two disproved theories would have added machinery that changes
nothing. And a green test already proves the loop ran: `stillListed` starts
`true`, so the assertion could not pass otherwise.

**What would change it.** Dropping `forceExit`, which needs the open handles
after a SAP run dealt with first.

---

## 6. Only what a run makes is a run's to delete

**Problem.** The delete test needs a trace. The suite already resolves one —
possibly discovered from the feed rather than produced by this run — and these
tests run against systems other people are using.

**Decided.** Deletion is scoped to `traceIdFromThisRun`, set only by the
profiled run, never to the discovered id. When the run produced nothing, the
test skips.

**Against.** Reusing the id the reading tests already resolved, and — in the
executor suites — sweeping at teardown everything that appeared since the run
started, which would have collected the retry path's untracked first trace along
with any stranger's.

**Why.** On a shared system the newest trace in the feed belongs to whoever
profiled last. Taking it away mid-analysis is a test damaging someone's work to
assert something about itself.

**What would change it.** Nothing. It costs one variable.

---

## 7. A concrete system never stands in for a value

**Problem.** `buildDumpIdPrefix` documented itself with a real hostname and a
real SID, and two unit tests asserted the resulting string — one specific
machine named as sample data, in a public repository. The same host reached
committed run logs, because `globalSetup` prints the URL it checked.

**Decided.** Placeholders (`HOSTNAME`, `SID`) in code and tests. Run logs are
not kept in the tree at all — see the note at the top of this file.

**Against.** Keeping the real values because they came from a real run and
therefore "document reality".

**Why.** Nothing in the assertion depended on the host being real: the function
concatenates four arguments, and a placeholder shows that better, because it
names what the argument is for instead of where somebody once ran it.

**Deliberately not covered.** The ~35 comments reading "Measured on E19 <date>:
…" stay. Those are not identifiers the code uses; they are the provenance of a
measured fact, and stripping them would leave assertions about SAP with no
record of where the answer came from.

**What would change it.** A decision that provenance must go too — a different
question, and one this entry does not settle.

---

## 8. The save runs outside the lock session, and cleanup runs back inside it

**Problem.** A message class created inside one ABAP session cannot then be
locked by that session: `LOCK_MSG` answers `403 "user is currently editing"`.
Over HTTP nobody noticed, because our create is sent stateless and the roll area
— with the lock in it — is torn down when the request returns. Over RFC one
conversation is one session for its whole life, which is the entire reason RFC
is here, so the lock is still held when the next step asks for it.

**Decided.** The PUT that saves a message is sent `stateless`, the way Eclipse
sends it: the handle authorises the write, so the write does not need the
session that holds the handle. Cleanup switches back to `stateful`
**unconditionally** before releasing anything.

**Against.** Tearing the RFC session down on `setSessionType('stateless')`,
which would defeat the transport rather than fix the bug — lock handles have to
survive on BASIS < 7.50, and that survival is what RFC is for.

**Why.** An Eclipse capture shows locks on one stateful session marked `enqueue`
and every GET and the PUT on separate stateless ones. We have one connection, so
we cannot reproduce that shape — but we can keep the *save* off the lock session,
which is the half that matters.

The unconditional switch back is the part worth stating. The failure path is
reached from every step, and answering "did we get far enough to have switched?"
is what produced the bug: an unlock sent stateless never reaches the session
holding the handles, the `catch` around it swallows the refusal, and the lock
stays on the object with nothing said. `cleanupSessionMode.test.ts` asserts the
mode **at the moment each unlock is sent**, because asserting that unlock was
called would have passed before the fix.

**What would change it.** A connection that can hold two sessions. Then the
locks get their own and none of this is needed.

---

## 9. A test that cleans up badly is worse than one that fails

**Problem.** A package lifecycle suite reported green on runs where it did
nothing: finding a leftover object from the previous run, it deleted it in
`ensureObjectReady` and returned early — running neither create nor update. The
run that *had* failed left the object behind, so the next run skipped and passed,
and the two alternated. Reading the verdict showed a flake; reading the steps
showed a defect that reproduces every time.

**Decided.** A cleanup that fails after a passing test body makes the test red,
and says which object was left. A cleanup that fails after an already-failing
test is logged at ERROR, not raised — the first failure is the one worth
reporting.

**Against.** Logging the cleanup failure at WARN and returning green, which is
what hid this.

**Why.** The object left behind is not a tidiness problem; it changes what the
*next* run does. A suite that silently becomes a no-op is indistinguishable, in
CI, from one that verified everything — the same shape as decision 3's
invisible-import and decision 5's missing log lines, in a third place.

**What would change it.** Nothing. A leftover object has to be visible where it
is created, because that is the only place that knows it is a leftover.

---

## 10. A factory's return type is a contract, so the compiler checks the handler

**Problem.** `AdtClient` has 38 factories. Thirty-six return interfaces; two
returned the implementation — `getRequest(): AdtRequest` and
`getUtils(): AdtUtils`. A class as a return type asserts nothing: it satisfies
itself by definition, so the factory compiles whatever the class happens to be
on any given day.

**Decided.** The declared return is a contract. `getRequest(): IAdtRequest` as of
this release; `getUtils()` waits for `AdtUtils`' 35 methods to be decomposed into
atoms, because one interface with 35 members would satisfy the letter of this and
miss the point.

**Against.** Leaving it, on the grounds that the class *is* the contract in
practice and a consumer can read it.

**Why — measured, because the first reason given for this was wrong.** Remove
`list()` from `AdtRequest` and compare:

| return type | what fails |
|---|---|
| `AdtRequest` | `AdtRequest.ts:168` and an `override` in `AdtRequestLegacy` — two errors **inside the transport module**, none at the factory |
| `IAdtRequest` | `AdtClient.ts: Property 'list' is missing in type 'AdtRequest' but required in type 'IAdtRequest'` |

With the class, the removal is caught only by whatever happens to *call* the
method. Had no internal caller existed, `list()` could have disappeared with a
green build while every consumer lost it. With the contract, the class must
satisfy it **at the point it is handed out**, or the package does not build.

That is the whole of it: the contract makes "does this handler still offer what
it offered" a question the compiler asks, rather than one that depends on
somebody having written a call.

Two further consequences, real but not what decided it: a consumer can
**substitute** their own handler where the type names a contract, and can
**compose** it with their own types. Neither is possible against a class.

**The reason that was wrong, kept because it read plausibly.** The first draft
argued that `src/__tests__/unit/capabilities/` was blind to the two concrete
returns — "a comparison between a thing and itself". It is not. Planting a
capability the handler does not have makes that guard fail *identically* whether
the factory returns the class or the contract:

```
shape.ts: Type 'true' is not assignable to type
          '"transport.activatable — claimed but not offered"'
```

Its check is structural, and a class satisfies an atom the same way an interface
does. A guard reporting "36 of 38 verified" invites the assumption that the other
two are unchecked; the assumption deserved more scrutiny than the guard did.

**How to catch it.** A factory whose declared return is not an `I`-prefixed name.

**What would change it.** Nothing for the returns themselves. The *shape* stays
open: a set of atoms used by one handler is spelled at the getter and earns a
name when a second handler wants the same set.

**What this cannot reach, and why.** `AdtClientLegacy.getRequest()` declares the
same `IAdtRequest` while its handler refuses `create`, `update`, `delete` and
`listNodes` at runtime, and serves a `list` that rejects `configUri`. That is the
shape 12.0.0 removed everywhere else, and it survives here for a reason the type
system enforces:

```
Property 'getRequest' in type 'AdtClientLegacy' is not assignable
to the same property in base type 'AdtClient'
```

An override's return must be assignable to the base's, and offering *less* is the
one direction the language refuses. `AdtClientLegacy extends AdtClient` while
this handler is not a behavioural subtype — so the contract cannot be narrowed
where it is wrong.

A narrower contract was written and then thrown away rather than published,
because nothing could return it: an interface no factory can hand out is decision
11's mistake in another costume. Fixing this means changing the inheritance, not
the types, and that is tracked in #109 rather than smuggled into a release about
something else.

---

## 11. Moving to contracts means giving up inheritance, not renaming it

**Problem.** `AdtClientLegacy extends AdtClient`, and `AdtRequestLegacy extends
AdtRequest`. Both were written for implementation reuse, and both make a handler
that offers *less* pass as one that offers more. Decision 10 hit the wall this
builds: the legacy transport handler refuses four of seven methods, and its
factory cannot say so, because an override's return must be assignable to the
base's and offering less is the one direction the language refuses.

The inheritance is what made the mismatch type-check for years. Replacing the
declared class with a contract made the lie visible; it cannot make it go away.

**Decided.** Implementations do not extend implementations. A legacy client is
not a subclass of a modern one; it is a separate implementation of whatever
contract it actually satisfies, reusing code by **delegation** where reuse is
worth having.

Interfaces compose only where the contract genuinely needs it — where two
handlers share a set of members that means the same thing in both. Not to make
two types line up, and not to satisfy the compiler.

**Against.** Keeping `extends` for the code it saves and describing the
difference in comments — which is exactly what this repository has been doing,
and what decision 10 had to write down instead of fixing.

**Why.** Inheritance answers "is this the same kind of thing" with "yes" and
then makes the answer unfalsifiable: the subclass inherits every promise whether
or not it can keep it. Two clients that serve different endpoints, refuse
different operations and are chosen at runtime by a discovery probe are not the
same kind of thing. They implement overlapping contracts, which is a different
statement and one the compiler can check.

A composition written to please the type system is the same mistake in the other
direction: `IAdtRequest extends IAdtRequestReadOnly` would be reasonable if two
handlers wanted that set, and noise if the second handler is hypothetical — see
decision 11 in the contract package, which is about exactly that.

**What it commits us to.** `AdtClientLegacy` stops extending `AdtClient` — 24
overrides, 313 lines — and `createAdtClient()` stops returning a concrete
`AdtClient`, which is the same defect one level up. Only then can a legacy
factory declare the two methods it honours. Tracked in #109.

**The inventory, counted rather than guessed** — and the first count was wrong,
which is why it is here rather than in prose. 27 `extends` between classes under
`src/`, and they are not one thing:

| kind | count | verdict |
|---|---|---|
| `*Legacy extends *` — a handler that refuses what its base offers | 11 | what this decision is about |
| the `Unsupported*Error` hierarchy | 9 | not contracts; an error hierarchy is what `Error` is for |
| `AdtLocal* extends AdtClassMemberBase` | 4 | four members of the same kind sharing a base — the one case where "is this the same kind of thing" is genuinely yes |
| `AdtRuntimeClientExperimental extends AdtRuntimeClient {}` | 1 | an empty body: a rename wearing a class |
| `AdtService extends AdtServiceBinding {}` | 1 | the same, and already deprecated |
| `AdtContentTypesModern extends AdtContentTypesBase` | 1 | to re-examine: a table of values, not a handler |

So the rule is not "no `extends`". It is: **no implementation inherits promises
it cannot keep.** Two empty-bodied subclasses exist only to give a second name to
one thing, and four class members share a base because they are the same kind of
thing — neither is the failure this decision names.

**How to catch it.** A subclass that overrides a method to refuse what the base
performs. Every `*Legacy` in the table does that, which is why they are the list
and the error classes are not.

Also: an interface that exists so an `extends` clause compiles.

**Where this does not reach, said plainly because I nearly got it wrong.** This
is about *implementations* inheriting implementations. It is not a rule against
`extends` between interfaces.

A composite contract is extension where extension is needed: `IAdtCrud extends
IAdtCreatable, IAdtReadable, IAdtModifiable` names a set several handlers share,
and `IAdtRequest extends IAdtCrud` names the transport handler's contract —
`IAdtCrud` plus the two methods nothing else has. Neither invents a member,
neither exists to make a type line up, and dissolving them would leave every
getter spelling the same intersection by hand.

The line is what the extension is *for*: composing a contract someone needs, or
making a subclass pass as something it is not. The counted inventory of the
contract package — 85 heritage relations, 23 of them between capability
contracts — was read from the syntax tree after three greps gave three different
wrong answers, including one that reported zero capability extensions because the
`extends` sat on its own line. A rule about types is worth stating only on
numbers a parser produced.

**What would change it.** A pair of implementations that genuinely are the same
kind of thing, differing only in a value. There is none here: every pair found so
far differs in what it refuses.

---

## 12. A method's result is named by a contract, not by `IAdtResponse`

The rule lives in `@mcp-abap-adt/interfaces`, decision 13. It is here because the
code it judges is here.

**Decided.** It does not matter what concrete type a method returns, as long as
it satisfies the contract the caller was promised. `Promise<T>` is a promise
about `T`; `T` is what the consumer holds, so `T` is a contract.
`Promise<IAdtResponse>` is not one — it names the transport envelope, which every
method could name.

**Where we stand.** `AdtUtils` has 31 public methods. **Eight** resolve to a
shape — `search`, `getWhereUsedList`, `getPackageContentsList`,
`getPackageHierarchy`, `getInactiveObjects` and the three list readers.
**Twenty-three** resolve to the envelope.

**Against.** Closing the twenty-three by inventing result types. Two parsers
exist for them, so twenty-one shapes would be guesses, and a guessed shape is
indistinguishable to a consumer from a measured one.

**Why it is not cosmetic.** A consumer decides what to do next from the type it
was handed. When that type is the envelope, the decision is made by reading our
implementation instead — the coupling decision 10 removed at the factory,
surviving one level down at every method.

**How each one closes.** Measured, or handed to the consumer's own parser, which
the implementation must satisfy. Which of the two is the same question decision 5
of the contract package answers for parsing: small and stable, measure it; large
or system-dependent, let the consumer read it.

**How to catch it.** `Promise<IAdtResponse>` on a public method. Correct only
where the answer really is the envelope, and that should be said at the method.

## The two criteria, because they decide the work rather than describe it

**A contract names an essence, not a method.** It differs from a concrete class
by saying *how to work with the thing*, and two methods return the **same**
contract when their results mean the same. This is already how the package works:
`IAdtObjectHit` serves `search`, `getWhereUsedList`, `getPackageContentsList` and
`getPackageHierarchy` through types that extend it — one essence, four methods.

Without this the rule reads as "write a result type per method", which is the
envelope's mistake with the sign reversed: instead of everything meaning one
thing, nothing would mean the same as anything.

**Whether two things are one contract is settled by substitution.**
Implementations of one contract are interchangeable — a caller holding it can be
handed either and carry on. Where the logic forbids putting one in the other's
place, they implement different contracts, **however identical their members**.

TypeScript does not answer this. Structural typing is about shape and silent
about meaning, and this repository has the proof: `AdtRequestLegacy` has every
method `AdtRequest` has, by inheritance, and refuses four of them. The compiler
was content for years — decision 11 is what that cost.

The same test decides grouping. Six of the open members were about to be gathered
as "object metadata" because they all return metadata-ish XML; whether a
transaction's metadata can stand where a type's is expected is a question
substitution asks and member-matching does not.

**The envelope's real reach.** `IAdtResponse<T = any>` defaults its body to
`any`, and the generic is not used: **1121** bare uses here against **5** that
name a type. Every method sharing that return shares one type, so a consumer
cannot tell one answer from another — apples and oranges in one container. In the
contract package the same count is 180 against 4, and only **one** of those 180
is in `connection/`, where an envelope belongs.

**What would change it.** Nothing. The twenty-three close one at a time, and
`getUtils()` cannot hand out contracts worth the name until they do — #109.

## 13. A refusal is raised once, at the edge, and goes back whole

**The problem, measured.** ADT answers some refusals with a 2xx and an
`<exc:exception>` document. The transport is right to admit it — the request did
come back — so nothing threw and every layer above stored the body as a result.
With a connection answering 200 and "Object ZNOPE is locked by user XYZ" to
everything:

| call | `state.errors` was | the caller was told |
|---|---|---|
| `getClass().create()` | 0 | the class was created |
| `getClass().delete()` | 0 | the class was deleted |
| `getClass().activate()` | 0 | the class was activated |
| `getDomain().create()` | 0 | the domain was created |
| `getClass().read()` | 0 | it was read |
| `getClass().update()` | threw | "Class may be locked by another user" |

Five of seven reported success, three of them writes. `delete()` issued its
second request after the first had already been refused. The two that threw
invented their own reason and never showed the caller `XYZ`.

**The status code is the channel; the response is the result.** A 2xx says the
request reached the server and came back. What the server decided is in the body,
and nothing in this library was reading it.

**Decided.** The check is installed once, where a connection enters the library —
`AdtClient`, `AdtRuntimeClient`, `AdtExecutor`, `AdtUtils`. Not at the 466 call
sites, and not at the 241 places that assign a response into a state: a rule
applied in 241 places has 241 chances to be forgotten, and the next member
written would be the 242nd.

`AdtExceptionDocumentError` carries the server's message, the document
**verbatim**, the ADT type and namespace, the response, and **the request that
produced it** — a chain has several calls, and "object is locked" means a
different thing depending on which asked. It is exported from the package root
and `./core`, because a consumer who cannot name it cannot tell a refusal from
any other failure.

**Against.** Putting the refusal into `state.errors` and returning normally,
which would keep existing callers compiling. Rejected: `state.errors` is what a
caller reads to decide, and a full one after a chain that carried on regardless
is a worse lie than a throw. The behaviour change is the point.

**How it is installed matters.** It replaces `makeAdtRequest` and calls what it
captured — the same shape `installAcceptNegotiation` already uses, so the two
compose in either order. A `Proxy` was tried first and recursed: accept
negotiation keys a `WeakMap` by the connection object, and a proxy is not its
target. A test asserts one request per call so that cannot come back.

**How to catch it.** A parser that answers empty for a document it could not
read. A `catch` that discards. Any path where a 2xx body is stored without being
looked at.

**What would change it.** The direction in decision 19 of
`@mcp-abap-adt/interfaces`: strategies for what to do with a result and with an
error. Three of its questions are answered and they bind here — **without a
strategy a refusal still throws**, so the safe path stays the default; a strategy
receives the refusal **whole**, so completeness is never the consumer's to lose
by accident; and strategies arrive as **one options object**, because hanging a
second signature on each member was tried across 23 of them and reverted.
