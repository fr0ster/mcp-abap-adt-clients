# The lock safety net belongs to adt-clients, not to the connection

Continuation of `2026-07-27-session-lifecycle-design.md`, and a correction to it.

## Two sessions, two layers

There is the **REST session** — cookies, CSRF token, connection id, the HTTP
conversation — and there is the **ABAP session** the server keeps behind it,
which is what actually holds a lock.

They belong to different layers, and so do their risks:

| layer | owns | its risk |
|---|---|---|
| `@mcp-abap-adt/connection` | the REST session | losing or silently replacing the HTTP conversation |
| `@mcp-abap-adt/adt-clients` | the ABAP session's semantics — stateful mode, lock handles, the registry | leaving a lock on the server |

**The server does not end the session.** In an orderly shutdown — the consumer
deciding it is done — the teardown starts on our side of the wire, which means
the ABAP session is still alive and an `UNLOCK` can simply be sent.

That is a claim about orderly shutdown only, and it needs to be: teardowns also
arise *internally*, when a lost session is detected and cleaned up before a
recovery. Those are neither the consumer's doing nor a case where an `UNLOCK` can
be sent, and they are what makes the fencing below non-optional. Releasing a lock during shutdown
is an ordinary operation, not a best-effort gamble. That is the case we handle,
and handling it is cheap.

**Out of scope: a server that goes away.** The lock survives in the enqueue table
and is cleared by waiting or by SM12. That is SAP's risk and the operator's, not
ours, and designing around it would mean insuring someone else's failure with our
complexity. We release what we took, while we can. We do not build machinery for
the case where we cannot.

## The defect that remains

Independent of any of the above, we publish this:

```ts
/** Resolves rather than throws — the report carries the failures. */
disconnect(): Promise<ITeardownReport>;
```

and there is a path where it never resolves:

```ts
while (this.inFlight > 0) {
  await this.changed();      // no bound
}
```

Because transitions are serialized, a teardown stuck there blocks every later
`connect()` as well. That is a broken promise and it is squarely the connection
layer's own business.

## What each layer does

### The connection

Stops waiting. `disconnect()` tears down the REST session and returns.

- No wait on in-flight requests. They continue as their caller arranged; nothing
  is aborted.
- No wait on open windows. The connection cannot interpret them — it does not
  know a lock exists, what it covers, or what would release it.
- The unbounded loop, the two-phase drain and its ceiling all go; nothing is left
  to bound.

This is the connection handling its own risk and stopping there — but only once
the next section holds. Removing the wait without it is not a simplification, it
is a hazard.

### Removing the wait requires generation fencing

The wait had a second effect nobody designed but everybody relied on: it
guaranteed that no request outlived the session it was issued against. Drop it
and a request can settle **after** a later `connect()` has established a new one.

That matters because the response path mutates shared state:

```ts
private observeResponse(headers?: Record<string, unknown>): void {
  this.applyIdentityPolicy(this.updateCookiesFromResponse(headers));
}
```

A stale response reaching that would write its cookies over the new session's,
and — worse — the identity policy could read the mismatch as a replacement and
raise a session-lost teardown against a session that is perfectly healthy. The
old request would be tearing down its successor.

So the fencing is not an optional hardening; it is what makes removing the wait
safe:

#### The teardown epoch is the wrong counter for it

`RequestLease.epoch` exists and is used for nothing, so it is the obvious
candidate. It is also insufficient, and the reason is deliberate:

```ts
if (origin === 'caller') {
  this.epoch += 1;
}
```

Only a **caller-initiated** teardown bumps it. An internal one — the cleanup that
follows a lost session, and the recovery after it — does not, on purpose: a
recovery must not cancel itself. So after a session loss and a successful
recovery, requests issued against the dead session carry the *same* epoch as the
new one and would sail straight through a fence built on it. That is precisely
the case fencing exists for, and epoch cannot see it.

Two counters answering two different questions:

| counter | question | changes when |
|---|---|---|
| `epoch` (exists) | did the caller ask to stop? | a caller-initiated teardown |
| **session generation** (new) | is this still the session you were issued against? | every `markConnected()` **and** every `beginTeardown()` |

`markConnected()` currently increments nothing. It is the one place a session
becomes current, whatever brought it there — first connect, reconnect, or
recovery — which makes it the honest place to count generations.

**Counting only there leaves a gap**, and an earlier draft had it: between a
`disconnect()` and the next `connect()` there is no new generation, so a lease
taken before the teardown still matches. A response arriving in that window would
write cookies and a CSRF token into the state `disconnect()` has just cleared,
and the next `connect()` would begin over that debris. So a teardown starts a
generation too: the moment the session stops being the current one is the moment
leases against it go stale, whether or not a replacement exists yet.

Epoch keeps its existing job untouched.

#### The rule

- A lease captures the **generation** at admission.
- Every side effect on shared state — cookie update, identity policy, CSRF cache,
  the recovery paths — is skipped when the lease's generation is not the current
  one.
- **Except for the request that raised the teardown**, which holds a permit.

#### The permit is held for a transition, not for a generation number

A request detecting a lost session raises an internal teardown, which bumps the
generation and would otherwise make its own lease stale on the spot — fencing it
out of the recovery it just triggered, with nobody else able to run it.

Rebasing it onto the generation the teardown created is not enough, and an
earlier draft stopped there. A successful recovery calls `markConnected()`, which
bumps the generation **again** — so the raiser goes stale a second time, now in
the middle of the retry it exists to perform. Chasing the number does not work:
the permit has to outlive every generation change the recovery itself causes.

So the permit is scoped to the recovery **transition**. It is granted when the
teardown is raised, it survives whatever the transition does to the counter, and
it ends when the transition does — at which point the holder is rebased onto the
generation that was actually published, and continues as an ordinary lease of the
new session. Everything else from the dead session stays fenced throughout.

#### Only one raiser, and that has to be enforced

"Only one request can be the raiser" was an assertion, not a mechanism. Two
responses can arrive together and both detect the loss; each would take a permit
and each would invalidate the other's, which is worse than having no permit at
all.

Raising is therefore a compare-and-set: the first request to move the lifecycle
into the session-lost state takes the permit, and every later detector is told the
teardown is already under way and is fenced like any other stale lease. It does
not raise a second teardown and does not attempt a second recovery.

Test with two concurrent detectors, because one detector cannot distinguish an
assertion from a rule.

#### The permit does not outrank the caller

It exempts its holder from the **generation** fence and from nothing else. In
particular it does not touch the teardown **epoch**, and the existing rule stands
unchanged: a recovery captures the epoch when it starts and refuses to publish if
the caller has since requested a teardown.

Without that boundary the permit would be a licence to resurrect. A caller calls
`disconnect()` while a recovery is in flight; the recovery finishes, and — holding
a permit that ignored the epoch — publishes a session over the top of a teardown
the caller asked for. The caller would be left connected to something it
explicitly ended.

Two counters, two questions, and the permit answers only one of them: *is this
still your session* — never *did the caller ask to stop*.
- The request still resolves or rejects normally to **its own caller**. Fencing
  suppresses its effects on the connection, not its result.

Tests, both orderings, because only the second distinguishes the two counters:

- explicit: request A → `disconnect()` → `connect()` → A settles
- **the gap**: request A → `disconnect()` → A settles → `connect()`. No new
  session exists when A lands, and the cleared state must stay cleared — this is
  the ordering that fails if generations are counted only at `markConnected()`
- **internal**: request A → session-lost teardown → recovery establishes a new
  session → A settles. Same epoch throughout; the new session's identity and
  cookies must still be untouched and no teardown raised.
- **the raiser's permit**: request A detects the loss and raises the teardown,
  request B is in flight from the same dead session. A completes its recovery; B
  is fenced. Without the carve-out A fences itself and the recovery never happens
  — this test fails on the rule as first written.
- **the permit survives `markConnected()`**: A's recovery publishes a new session,
  and A's own retry still proceeds. Fails if the permit is a generation number
  rather than a scope.
- **two detectors**: A and B both see the loss at once. Exactly one teardown is
  raised, exactly one recovery runs, and the loser is fenced rather than holding a
  competing permit.

### adt-clients

Releases its locks before it lets the connection go, because it is the only layer
that can: it holds the handles, in `LockRegistry`, and `unlockAll()` already
exists.

The shape is a close path on `AdtClient`, and "unlock what is held, then
disconnect" is **not** enough on its own. Between the snapshot `unlockAll()`
takes and the `disconnect()` that follows, a concurrent chain can complete its
`LOCK` and register it — and close would then disconnect over a lock acquired
moments earlier. Sequencing two steps does not order what is running beside them.

So the close path is a barrier, in this order:

1. **Refuse new work** — further operations and lock acquisitions are rejected
   from this point, so the set of outstanding chains can only shrink.
   **Cleanup is not new work.** `unlockAll()`, and the unlock of a lock already
   held, stay admissible after `close()` has returned. What is refused is work
   that could acquire a *new* lock. This says nothing about whether a second
   attempt will succeed; it says the caller is allowed to make one. A barrier
   that permanently refused cleanup would decide that question on their behalf,
   and it is not ours to decide.
2. **Wait for running chains, up to a deadline**, so a `LOCK` already in flight
   lands and registers rather than appearing after the snapshot.
3. **`unlockAll()`**, now over a registry that cannot grow.
4. **`disconnect()` — only if asked.**

#### The connection is injected, so closing it is not ours

`AdtClient` is handed an `IAbapConnection`. It did not create it and cannot know
who else holds it — one connection may be shared by several clients, and an
earlier draft had the first `close()` tear down the session underneath the
second's running chains and held locks. Its barrier and its registry are its own;
the connection is not.

We already refuse to `connect()` on the consumer's behalf, for exactly this
reason. Disconnecting on their behalf is the same overreach with the sign
flipped, and worse, because it destroys state instead of creating it.

So step 4 is **opt-in**:

```ts
close(options?: { deadlineMs?: number; disconnect?: boolean }): Promise<ICloseReport>;
```

Default `false`. `close()` releases what this client holds and stops there,
leaving the connection exactly as it found it. A caller that owns the connection
and wants it gone says so — and by saying so takes responsibility for the other
clients it may be shared with, which is a judgement only they can make.

Rejected: a refcount on the connection so the last client out turns off the
lights. It puts the library back in charge of a lifetime it was lent, and it fails
the moment a consumer holds the connection itself without an `AdtClient` around
it.

Step 2 needs a deadline, and saying so is not a detail. An earlier draft said
"let running chains finish" with no policy for a chain that never settles —
which would move the very defect this spec exists to remove one layer up:
`disconnect()` guaranteed to return, and `close()` free to hang forever before
reaching it. That is the same mistake twice, and it is worth recording rather
than quietly fixing.

`close()` therefore takes a deadline, with a finite default the caller can
change, and always resolves:

- chains that finish inside it are unlocked normally;
- a chain still running at the deadline is **not** aborted — the barrier stops
  waiting, not the work — and `unlockAll()` proceeds over whatever is registered;
- a chain still running at the deadline is named in the result, by the object it
  was working on.

That last point cannot be done by watching the registry, and an earlier draft
promised exactly that: "a lock registered after the snapshot is reported by
name". Impossible. At the moment `close()` returns, that lock is not in the
registry yet — and once it returns it cannot amend a result it has already
handed back. `LockFailure` would misdescribe it too: that means an `UNLOCK` was
attempted and failed, and here none was attempted at all.

**So the registry records intent, not only possession.** A chain declares the key
it is about to lock *before* it sends the `LOCK`, and resolves that declaration
when the outcome is known — held, or confirmed not taken.

A declaration is identified **per attempt, not per key.** The registry is
`Map<string, UnlockThunk>` today, keyed by object, and that is enough for
possession — one ABAP session cannot hold two locks on one object, so at most one
entry per key can ever be *held*. It is not enough for intent: two chains may
attempt `DOMA/Z` concurrently, and keying their declarations by object would let
the loser's resolution clear the winner's, or one declaration overwrite the
other. Each attempt therefore carries its own token, the same reasoning that made
`WindowToken` a symbol rather than a label.

The second attempt is expected to fail — the server will not grant it — and the
point is that its failure must not corrupt the bookkeeping of the one that
succeeded. `close()` then reports
the declarations still unresolved at its deadline, which it *can* know, because
they were made before it stopped waiting.

This is the rule the session-lifecycle spec already arrived at for windows —
*"what it tracks is 'a lock may be held', not 'an unlock happened'"* — applied at
the layer that can act on it. Uncertainty is reported as uncertainty. A chain
whose `LOCK` was confirmed to have failed resolves its declaration and is not
reported, because nothing was taken.

The choice of a bound belongs to the caller. What is not optional is that there
*is* one: a close path that can hang is not a close path.

### The shape of `close()`

`unlockAll()` returns `LockFailure[]`, which is not enough: the barrier now has
two different things to report, and one of them is not a failure at all.

```ts
interface ICloseReport {
  /** UNLOCK was attempted and rejected. The lock is known to be held. */
  unlockFailures: LockFailure[];
  /** Declared before the LOCK went out, still unresolved when waiting stopped.
   *  The outcome is UNKNOWN — it may be held, it may never have been taken. */
  unresolvedIntents: string[];
  /** Whether the barrier stopped waiting rather than running out of work. */
  timedOut: boolean;
  /** What the connection's own teardown could not finish. Carried, not swallowed.
   *
   *  Absent whenever no teardown happened, which is the ORDINARY case: it is
   *  absent by default, since `disconnect` defaults to false, and absent when
   *  `disconnect: true` was asked for but the connection implements no
   *  ISessionLifecycleAware to ask. Present only when a teardown actually ran. */
  teardown?: ITeardownReport;
}

close(options?: {
  deadlineMs?: number;
  /** Tear the connection down as well. Default false — see ownership, above. */
  disconnect?: boolean;
}): Promise<ICloseReport>;
```

This is the normative signature; the sketch in the ownership section above is the
same one, shown early for the argument it is making.

Four facts, four fields, because collapsing any of them loses a distinction that
matters to whoever reads the report.

The two fields record two different observations, and nothing more:

| field | what was observed |
|---|---|
| `unlockFailures` | the server answered the `UNLOCK`, and refused it. Carries the error it gave |
| `unresolvedIntents` | no answer was obtained — the intent was declared and never resolved. The outcome is unknown |

**What to do about either is the consumer's call.** Earlier drafts of this section
told them: first that a failure "calls for a retry", then — after that turned out
to be wishful — that retrying "is not a plan" and the lock is operator cleanup.
Both were the same error. Whether to retry, wait for the session to end, escalate
to an operator, or ignore it depends on what the caller was doing and what it can
tolerate, none of which we know. We report what happened and hand it over.

Two facts are worth stating because they are ours to know, and they are facts, not
instructions:

- A refused `UNLOCK` usually means the handle is no longer valid — the session
  moved, its type was toggled, the handle expired. The same call with the same
  handle will then get the same answer.
- That kind of disturbance is usually caused by something on our side, between
  `LOCK` and `UNLOCK`. `unlockAll()` already holds the session stateful across the
  whole batch for exactly this reason.

This also removes a justification I had leaned on for `disconnect` defaulting to
false — "so a retry can still work". The default does not need it and never did:
it stands on ownership alone. The connection was handed to us, so closing it is
not ours to decide. `LockFailure` cannot carry the second — it describes an attempt, and
for an unresolved intent no attempt was made.

The fourth exists because step 4 calls `disconnect()`, which returns an
`ITeardownReport` of its own, and an earlier draft simply dropped it. That would
be worst on RFC, where `releasePending` says a transport resource did not close:
the caller would see a successful `close()` and never learn that something is
still held open. A wrapper that discards its inner result reports success it did
not verify.

It is **optional**, and that is not a hedge. `disconnect()` lives on
`ISessionLifecycleAware`, which is a capability atom: an `IAbapConnection` is not
required to implement it, and a batch recorder or a transport with no HTTP
session does not. So step 4 narrows at runtime — exactly as `AdtClient`'s connect
guard does, checking the method it actually calls — and when the capability is
absent it is skipped, with `teardown` left undefined. Requiring it would
contradict this spec's own layering argument: the atoms exist so that a transport
is never forced to implement what it cannot honour, and a `close()` that demands
`disconnect()` re-imposes exactly that. Steps 1 to 3 — refuse, wait, unlock —
need no capability at all and run regardless.

Test: `close()` over a connection that implements no lifecycle atom still
unlocks, still reports, and does not throw.

`deadlineMs` is in milliseconds, matching every other timeout in these packages.
The default is **600 000 ms**, from `SAP_CLOSE_DEADLINE_MS`.

It is a shutdown policy, not a bound derived from anything. Two earlier drafts
tried to derive it and both were wrong: 60s from a single request's 45s, then
600s by equating it with `SAP_TIMEOUT_CRITICAL`. The second is no better than the
first, because that ceiling applies **per request** — a chain runs several in
sequence, so nothing caps a chain's total duration, and matching the numbers
reconciles nothing.

Stated honestly instead: **`close()` may stop waiting while a legitimate chain is
still working.** That is what a shutdown deadline is for. The chain is not
aborted, its intent is reported as unresolved, and the caller learns that
something was still in progress when they asked to stop. 600s is chosen as
patience — long enough that reaching it means something is wrong rather than
merely slow — and it is configurable because how patient to be during shutdown is
the caller's judgement, not ours.

In practice it is not reached: the barrier waits only while chains are actually
outstanding and returns immediately when none are. The deadline bounds a
pathology; it does not pace the normal path.

Named rather than left to each implementation, because a default nobody wrote
down is a different default in every test.

`close()` resolves in all cases; it never rejects for a lock it could not
release, since the report is the answer.

### `Symbol.asyncDispose` must go through it

`AdtClient` already has a disposer, and it predates all of this:

```ts
async [Symbol.asyncDispose](): Promise<void> {
  const failures = await this.unlockAll();
  ...
}
```

It calls `unlockAll()` directly. Left alone it would bypass every part of this
design — the barrier, the intent declarations, the deadline, the report — which
is the worse outcome for being the *idiomatic* path: `await using client = ...`
is what a careful consumer reaches for, and it would get the weakest cleanup.

So the disposer delegates: `close({ disconnect: false })`. The default is right
for it twice over — a disposer cannot know whether the connection is shared, and
it was handed one it did not create.

A disposer returns `void`, so the report has nowhere to go. It is logged, and the
distinction the report exists to draw must survive that: **failed unlocks and
unresolved intents are logged separately**, because they are different
observations — the server refused, versus no answer was obtained. Flattening them
into one warning would undo the work of separating them.

The log says what was observed and stops. The current message ends with "retry
`unlockAll()` or rely on session-drop", which is advice, and this document has
already established twice that the advice is not ours to give — once when it was
optimistic and once when I replaced it with pessimistic advice instead. It goes.
What replaces it is the names and the fact: these keys were refused, these were
never resolved.

A consumer that needs the report calls `close()` itself. `await using` is for the
case where nobody is going to read it, and its job is to leave nothing behind
quietly. The barrier and the intent declaration are the new parts. One test is not about
concurrency at all: **`close()` → `unlockAll()` afterwards is still admitted**,
i.e. the barrier does not permanently refuse cleanup. It asserts admission, not
success — a rejected unlock is expected to be rejected again. Then four
concurrency tests — including two chains attempting `DOMA/Z` at once, where the
loser's failure must not disturb the winner's bookkeeping: a chain interrupted mid-`LOCK`, asserting the lock was
released rather than stranded; a chain that never settles, asserting `close()`
returns at its deadline and names the object it was working on; and a chain whose
`LOCK` is confirmed to have failed, asserting it is NOT named — uncertainty is
reported, a known non-event is not. The details belong to that repository's
own design, not here.

## Decision: what a window is for

**A window marks a span in which a short per-request timeout must not abort a
request.** That is its whole purpose, and it is squarely the connection's own
risk: deciding how long its own requests may run is its business and nobody
else's.

The risk is **an operation whose outcome is unknown**, not a session presumed
dead. A `LOCK` that times out client-side may well have succeeded on the server;
we simply stopped listening. The lock is then held by a session we are still in,
by a handle we never received — unreachable and unreleasable, which is the
orphan. A `PUT` aborted the same way leaves us unable to say whether it landed.

An earlier draft justified this differently — "aborting tears down the socket,
which drops the stateful ABAP session" — and that claim does not hold. The socket
belongs to the local agent; the ABAP session lives on the server and is carried
by a cookie, which is why it survives a local `disconnect()` and why a
reconnect can find it again. Dropping one TCP connection does not demonstrate the
end of a cookie-backed session, and this repository has already retracted one
belief of that family: *"a stateless request kills a stateful session"* turned out
to be false when checked against Eclipse's actual traffic.

The corrected reasoning does not weaken the case for a window; it sharpens it.
An operation with an unknown outcome is dangerous precisely *because* the session
survives — the lock outlives our uncertainty about it. If the session died on
every timeout, the lock would die with it and there would be less to protect.

**A window is not lock bookkeeping.** Say a caller locks five objects, works on
them, unlocks them. The window model can *represent* that — `Symbol(label)` is
unique per occurrence, so five tokens close independently, and even the same
label twice does not collide. But representing is all it does. Five open windows
give the connection five opaque strings: it cannot say which object, find a
handle, send an `UNLOCK`, or judge whether any of them still matters.

What models that case properly already exists a layer up:

```ts
private readonly locks = new Map<string, UnlockThunk>();   // LockRegistry
track(key: string, unlock: UnlockThunk): void
```

Keyed by object, valued by *the function that releases it*. Five objects, five
entries, each knowing how to unlock itself; `unlockAll()` runs the batch keeping
the session stateful throughout and returns `LockFailure[]` for what it could
not. It models the case **and can act on it**. Windows duplicated the fraction
that cannot.

There is a conceptual error in the old reading too: a "window" suggests a span
that owns the session. With five overlapping windows there is still one ABAP
session shared by all of them, so the windows partition nothing — they are a
counter. Which is why blocking a teardown on `liveWindows > 0` was meaningless:
it waited for "some span is open" over a session every span shares anyway.

### Consequence: as shipped, a window does nothing

`beginWindow()` delegates to the lifecycle and stops there. It does not touch a
timeout. The behaviour the decision above describes is implemented elsewhere, in
the reference-counted pair that has carried it since 1.9.0:

```ts
const effectiveTimeout = this.inCriticalSection
  ? Math.max(timeout ?? 0, getCriticalSectionTimeout())
  : timeout;
```

So there are two mechanisms for one idea: `beginCriticalSection()`, which acts
but is unnamed and uncounted per span, and `beginWindow(label)`, which is named
and counted but inert. **They should be one.** Opening a window raises the
effective timeout ceiling for its duration; closing the last one restores it —
which is what the critical section already does by reference count. The label
stays, because "which span" is worth having in a log even when it is not worth
blocking on.

#### The raise is connection-wide, and that is deliberate

Worth stating because the wording above invites the opposite reading. The
mechanism is a flag plus a reference count:

```ts
const effectiveTimeout = this.inCriticalSection
  ? Math.max(timeout ?? 0, getCriticalSectionTimeout())
  : timeout;
```

No request is bound to a particular window. While *any* window is open, **every**
request on that connection gets the raised ceiling, including one that has
nothing to do with the locked object.

The reasoning for the raise is sound: those requests share one ABAP session, and a
timeout that aborts an unrelated request mid-flight leaves that session in the
same uncertain state — an operation whose outcome we do not know — during a span
someone declared sensitive precisely to avoid that. The raise is a property of the
session, not of a span, and the span is only what turns it on.

**But an earlier draft said "accepted rather than fixed", and that was me keeping
a decision that is not mine.** A caller who set a short timeout on an unrelated
request has stated a preference, and the raise silently overrules it for as long
as somebody else's window is open. There is currently no way to say otherwise.
That is the exact shape this document criticises everywhere else: a default is
ours to choose, a default nobody can escape is not.

So the raise stays as the **default** — it is the safer side, and the caller who
wants it has to do nothing — and a request may opt out of it:

```ts
makeAdtRequest({ ..., honourTimeout: true })
```

Meaning "apply my timeout as given, even inside a window". The caller then owns
what follows, which is the point: they may know their request is unrelated to
whatever is locked, and we do not.

Rejected: binding every request to a window token. It threads a token through
every call site to express something almost no caller needs to say, when a single
opt-out says it where it is actually needed.

What the default costs, stated so it is a decision rather than a surprise: an
unrelated slow request waits for the ceiling instead of its own short timeout,
unless it opts out. A test covers both sides.

The teardown does not wait on windows either way — which leaves
`ITeardownReport.abandonedWindows` needing a meaning it no longer has.

### `abandonedWindows` after the wait is gone

Its published documentation says:

> Labels of the lock windows still open when the bounded wait gave up.

There is no bounded wait any more, so that sentence describes nothing. Two
honest options, and this spec picks the first:

- **A snapshot**: the labels of windows open at the moment of teardown. Same
  field, same type, a narrower and truthful claim — "these spans were open when
  you tore down", with no implication that anything was waited for or given up
  on. Useful in a log, and it costs nothing.
- Deprecate the field and always return `[]`. Rejected: it throws away
  information that is free to collect, and leaves a field in the contract whose
  only purpose is to be empty.

This is a documentation change in `@mcp-abap-adt/interfaces`, not a type change —
but it is still a change there, so the earlier claim that this work needs no
`interfaces` release is wrong and is corrected below.

## Not done

- **No teardown strategy or hook in the connection.** An earlier draft proposed
  one. It is a layering error one step removed: a seam in the connection for a
  decision that belongs to the layer above, which can simply act before calling
  `disconnect()`.
- **Windows are not removed.** They have a real job — see the decision above —
  and it is the connection's own.
- **No request is aborted** by a teardown.
- **`disconnect()` is never refused** because something is open.
- **No default timeout is introduced for an ordinary request.** Outside a window
  the caller's value is passed verbatim, including none. The window ceiling is a
  different thing and it *does* override a caller's value — it raises rather than
  shortens, which is milder, but a caller who wanted a short timeout does not get
  one. That is why it now has an opt-out. The ceiling itself is a real default —
  600s, `SAP_TIMEOUT_CRITICAL` — and it predates this spec.
- **Nothing is aborted.** A teardown does not abort a request; `close()` does not
  abort a chain. Both stop waiting; neither cancels work.

## Tests

Connection, at `SessionLifecycle` level — no server:

- a request that never settles: `disconnect()` resolves anyway, and a following
  `connect()` is not blocked — the regression this exists to prevent
- an open window does not delay a teardown, and is reported as a snapshot
- no request is aborted or errored by the teardown itself
- **request A → `disconnect()` → `connect()` → A settles**: the new session's
  cookies and identity are untouched and no teardown is raised — the fencing
  test, and the reason the wait cannot simply be deleted

Connection, on the window's actual job:

- a request issued inside a window is not aborted by a short per-request timeout
- **an unrelated request, issued while someone else's window is open, also gets
  the raised ceiling** — the connection-wide effect, pinned as a decision
- **the same request with `honourTimeout: true` keeps its own timeout** — the
  escape from that default, which is what keeps it a default rather than a rule
- five concurrent windows: the ceiling holds until the last one closes, and
  closing them out of order works — this is the case that exposed the old
  reading
- outside any window the caller's timeout applies verbatim, unchanged

adt-clients: its close path unlocks before disconnecting, and reports what it
could not release — verifiable against the trial system, where the existing
`SessionLockRegistry` tests already exercise `unlockAll()`. Plus the race
explicitly: start a chain, call `close()` while its `LOCK` is in flight, and
assert the lock was released rather than stranded.

## Release

`@mcp-abap-adt/interfaces` first, and only for prose: `abandonedWindows` is
redocumented as a snapshot of what was open, since the wait it referred to no
longer exists. No type changes. Correcting an earlier draft of this spec, which
claimed no `interfaces` change was needed — a field whose documentation describes
a mechanism we removed is a contract that lies, and prose is part of the contract.

Then `@mcp-abap-adt/connection`: `disconnect()` stops waiting, and the **session
generation** fencing that makes that safe lands in the same release — they are one
change, not two, and shipping the first without the second would be a regression.
Generation, not epoch: an earlier draft of this plan said epoch, which is the
variant the body of this spec rejects for missing every internal teardown.

Then `adt-clients`, with its close barrier.

Versions are the user's call.
