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

1. **Refuse new chains** — a chain not yet admitted is rejected from this point,
   so the set of outstanding chains can only shrink. An already-admitted chain is
   not interrupted: it runs its remaining steps, `LOCK` included.
   **Cleanup is not a new chain.** `unlockAll()`, and the unlock of a lock already
   held, stay admissible after `close()` has returned. What is refused is the
   admission of a *new chain* — never a step of one already admitted, and never
   cleanup. An earlier draft said "work that could acquire a new lock", which an
   implementation could read as licence to reject the `LOCK` step of a chain
   already running, contradicting the promise two lines above. This says nothing
   about whether a second unlock attempt will succeed; it says the caller is
   allowed to make one. A barrier that permanently refused cleanup would decide
   that question on their behalf, and it is not ours to decide.
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
- a **lock-capable** chain still running at the deadline is named in the result,
  by the object it was working on. A read-only one is not — it appears only as
  `timedOut: true`, since naming it would put an object in `unresolvedIntents`
  that no `LOCK` could have touched.

That last point cannot be done by watching the registry, and an earlier draft
promised exactly that: "a lock registered after the snapshot is reported by
name". Impossible. At the moment `close()` returns, that lock is not in the
registry yet — and once it returns it cannot amend a result it has already
handed back. `LockFailure` would misdescribe it too: that means an `UNLOCK` was
attempted and failed, and here none was attempted at all.

**So the registry records intent, not only possession.** A chain declares the key
it may lock and resolves that declaration when the outcome is known — held, or
confirmed not taken.

**At admission, not immediately before the `LOCK`.** An earlier draft said "before
it sends the `LOCK`", which is too late by exactly the gap that matters: a chain
admitted before `close()` may be several steps short of its `LOCK` when the
deadline arrives — validating, reading, checking — and would then hold no
declaration at all. The report would not name it, and after `close()` returned it
would either take a lock nobody recorded, or be refused mid-flight by a barrier
that promised not to interrupt running chains. Both outcomes contradict something
this spec states elsewhere.

So the granularity is the **chain**, not the request:

- a **lock-capable** chain declares its intent when it is admitted, since both the
  object and whether the flow can lock at all are known from its config before any
  request goes out;
- an admitted chain may run **all** its remaining steps, `LOCK` included — that is
  what "not aborted" means;
- only a **new** chain is refused after step 1.

**A read-only chain declares nothing.** An earlier draft had every chain declare,
which puts a false entry in the report: a read-only flow still running at the
deadline would be named in `unresolvedIntents` — an object it could never have
locked — breaking the guarantee that every entry there describes a lock that may
exist. A read-only chain still outstanding is covered by `timedOut: true`, which
says what is true: the barrier stopped while work was in progress.

A lock-capable chain that fails before its `LOCK` resolves its declaration as
not-taken and is not reported. The cost of declaring at admission is a declaration
that often resolves to nothing; the cost of declaring later is a lock nobody knows
about.

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
/** An attempt carries the error it got; a lock never tried has none to carry. */
type UnlockOutcome =
  | { key: string; outcome: 'refused' | 'unknown'; error: unknown }
  | { key: string; outcome: 'not-attempted' };

interface ICloseReport {
  /** Locks this client held and could not confirm released.
   *  `outcome` says how far each got — see the table under the deadline rules. */
  locksNotReleased: UnlockOutcome[];
  /** Declared before the LOCK went out, still unresolved when waiting stopped.
   *  The outcome is UNKNOWN — it may be held, it may never have been taken. */
  unresolvedIntents: string[];
  /** Whether the shutdown budget was exhausted — in step 2, in step 3, or both.
   *  Not "the barrier stopped waiting": since the budget now covers cleanup, a
   *  run whose chains all finished can still be cut short by a hung UNLOCK. */
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
| `locksNotReleased`, `outcome: 'refused'` | SAP answered this `UNLOCK` at application level and refused it. Carries the error it gave |
| `locksNotReleased`, `outcome: 'unknown'` | no application-level answer was obtained — a timeout, a reset, or a gateway status that says nothing about what SAP did. It may well have released the lock |
| `locksNotReleased`, `outcome: 'not-attempted'` | the shutdown budget ran out before this lock's turn. Nothing was sent, so it is held as far as anything here knows |
| `unresolvedIntents` | the `LOCK` itself never resolved, so no confirmed handle was ever available to unlock with. The lock may exist on SAP regardless — the answer simply had not arrived |

The `outcome` discriminator is new, and it exists because an earlier draft
declared that every entry meant "the server refused, the lock is known held".
`unlockAll()` records a `LockFailure` for **any** exception — a timeout, a
connection reset, a DNS failure — and in those cases the `UNLOCK` may have
arrived and worked. Claiming otherwise would state as fact something we did not
observe, which is the same error the `unresolvedIntents` field was introduced to
avoid, made on the unlock side after being fixed on the lock side.

Distinguishing them is deliberately conservative, and "a response with a status
means refused" is **not** the rule — an earlier draft said it was. A 502, 503 or
504 comes from a proxy or gateway and says nothing about what SAP did with the
`UNLOCK`; the request may have reached the server and worked. `isNetworkError`
separates transport failures from responses, which is useful and not sufficient:
a response is not by itself an answer from the application.

So `refused` requires an **application-level answer about this operation** — an
ADT error payload, or a status the ADT layer attributes to SAP's handling of the
call. Everything else is `unknown`: gateway and proxy statuses, transport
failures, timeouts, anything unparseable.

The asymmetry is intended. Misfiling an unknown as a refusal asserts something we
did not observe; misfiling a refusal as unknown only understates our certainty.
When the classification is itself uncertain, it goes to `unknown`.

**What to do about either is the consumer's call.** Earlier drafts of this section
told them: first that a failure "calls for a retry", then — after that turned out
to be wishful — that retrying "is not a plan" and the lock is operator cleanup.
Both were the same error. Whether to retry, wait for the session to end, escalate
to an operator, or ignore it depends on what the caller was doing and what it can
tolerate, none of which we know. We report what happened and hand it over.

**When there is nothing to do.** The report is also a statement of absence, and
that is worth spelling out, because otherwise every close looks like it might
need following up:

- `locksNotReleased` empty **and** `unresolvedIntents` empty means every lock this
  client took was confirmed released. Nothing is outstanding; no retry is needed
  and none would find anything.
- A `LOCK` confirmed to have **failed** is deliberately absent from both fields.
  Nothing was taken, so there is nothing to release — absence here is a positive
  result, not a gap in the record.
- `timedOut: false` means the barrier ran out of work rather than out of patience,
  so the two emptiness checks above cover everything this client was doing.

**Every entry in either field describes a lock that may still exist.** An earlier
draft said only `unknown` outcomes and unresolved intents did, which contradicts
the contract one section above: `locksNotReleased` means *release not confirmed*,
and that is true of both its outcomes. A refusal is an answer about the
**attempt**, not about the lock. It establishes that this `UNLOCK` was not
confirmed to have succeeded, and nothing more: an invalid or expired handle is
equally consistent with the lock still being held and with the lock or its session
having already gone.

What the two outcomes distinguish is how much was learned about the attempt — not
what state the lock is in, which neither of them settles:

| outcome | what is established | what is not |
|---|---|---|
| `refused` | SAP answered about this `UNLOCK` and did not confirm a release | whether the lock remains, and whether the same call would be refused again — an application-level error may be transient |
| `unknown` | nothing at all about the outcome | the same, plus whether the call was even processed |

Reading either as a verdict on the lock requires the semantics of the specific SAP
error, which this library does not interpret. It reports what it was told.

Emptiness is the only final state: both fields empty means every lock this client
took was confirmed released.

Two more facts are worth stating because they are ours to know, and they are
facts, not instructions:

- A **refused** `UNLOCK` is often an invalid handle — the session moved, its type
  was toggled, the handle expired. Often, not always, and the report says nothing
  about which: distinguishing a permanent rejection from a transient one needs the
  semantics of the specific SAP error code, and this library does not classify
  them. An earlier draft of this bullet promised that repeating the call would get
  the same answer, which the table above already contradicts. Nothing was learned
  about the handle in an `unknown` outcome at all.
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
aborted. Any outstanding chain shows up as `timedOut: true`; a **lock-capable** one
also appears in `unresolvedIntents`, since only those declare. Either way the
caller learns that something was still in progress when they asked to stop. 600s is chosen as
patience — long enough that reaching it means something is wrong rather than
merely slow — and it is configurable because how patient to be during shutdown is
the caller's judgement, not ours.

In practice it is not reached: the barrier waits only while chains are actually
outstanding and returns immediately when none are. The deadline bounds a
pathology; it does not pace the normal path.

Named rather than left to each implementation, because a default nobody wrote
down is a different default in every test.

**Accepted values.** `number` admits `Infinity`, `NaN`, negatives and absurdities,
and bounded completion is the central guarantee here — so the input is validated
rather than coerced:

| value | behaviour |
|---|---|
| finite, `0 <= v <= MAX_SAFE_INTEGER - <monotonic now>` | used as given |
| `0` | valid and meaningful: do not wait at all. Step 2 is skipped, step 3 runs over whatever is registered now |
| `Infinity`, `NaN`, negative | **rejected** — `close()` throws before doing anything |
| beyond `MAX_SAFE_INTEGER - <monotonic now>` | **rejected** — the absolute deadline would not be exactly representable; see below |

The two checks happen at different moments, deliberately. `Infinity`, `NaN` and
negatives are rejected **immediately**, at the call, since they are wrong
regardless of when the wait starts. Representability is checked against the
**single monotonic reading** that also computes the deadline — one snapshot used
for both, so there is no window between validating a value and using it. Checking
it at the call and computing the deadline from a later reading would leave exactly
that window: a value that passed could be out of safe range by the time the queued
call reaches its own step 2.

**That reading is taken after the call reaches the head of the queue and before
step 1** — before the barrier shuts, before anything is refused, before any
cleanup. Otherwise a `close()` carrying an unrepresentable deadline would shut the
barrier and *then* throw, leaving the client permanently refusing new chains
because of an argument that was never accepted. "Throws before doing anything" has
to mean before the first mutation this call makes, not merely before its wait.

Rejected loudly rather than silently repaired, because every silent repair here is
wrong in a way the caller cannot see. Coercing `Infinity` to a default hides that
they asked for something the contract cannot provide; treating it as unbounded
discards the guarantee outright; clamping a negative to `0` turns "I made a
mistake" into "close immediately", which is destructive.

**No cap on patience — but the value must be representable.** Capping how long
someone waits during their own shutdown is the overreach this document rejects
everywhere else, and that is not what this is. "Finite" turned out to be too weak
a test: the absolute deadline is `now + deadlineMs`, and past `MAX_SAFE_INTEGER`
that sum stops being exact — `Date.now() + Number.MAX_VALUE` is still finite and
still useless, since the addition is absorbed entirely and the deadline can never
be reached in any run of any program.

So the accepted range is `0 <= deadlineMs <= Number.MAX_SAFE_INTEGER - <monotonic now>`,
which is still about 285,000 years and rejects nothing anyone means. Outside it,
`close()` throws with the rest of the invalid input. The rejection is about
arithmetic, not about preference: a value that cannot be added to a clock without
losing precision is not a longer wait, it is an unrepresentable one, and accepting
it would be promising a bound we cannot compute. That obliges the implementation rather than the caller: a single
`setTimeout` cannot carry an arbitrary finite value — anything past the runtime's
32-bit range overflows and fires almost immediately, turning a very patient close
into an instant one, which is the opposite of what was asked and fails silently.

So the deadline is **absolute, not a timer**: compute the instant it expires,
compare against the clock, and re-arm the wait in safe-sized chunks until then.

**And the clock must be monotonic** — `performance.now()`, or an injected
equivalent. `Date.now()` is a wall clock and can move backwards: an NTP
correction or a manual change during the wait makes the remaining time longer than
the caller asked for, and a large enough step back makes the deadline unreachable
altogether. A duration is not a moment in the day, and measuring it against
something adjustable forfeits the bound this section exists to guarantee.

`SessionLifecycle` computes its own ceiling as `deadline = teardownAt + ceilingMs`
with `now` defaulting to `Date.now()`, so the absolute-deadline shape is
established there — **but its clock choice is not a precedent to follow.** An
earlier draft cited it as though it were, which is an argument from what exists
rather than from what is correct. The same fix belongs there: the injection point
already exists, so it is a default to change, and it should happen in the same
release rather than leaving one bounded wait honest and the other not.

**"Always resolves" is scoped to valid input.** With an invalid `deadlineMs` the
call throws instead, before doing anything, as above. The guarantee is that a
`close()` which starts will finish; it is not a promise to accept nonsense.

`close()` resolves in all cases where it starts at all — that is, for valid
options; see the deadline rules above. It never rejects for a lock it could not
release, since the report is the answer.

### Calling it more than once

Unavoidable now that the disposer delegates to it: `await using` will call
`close()` on a client the caller has already closed by hand. Two concurrent
`close()` calls are equally ordinary. So the semantics have to be written down
rather than discovered.

`close()` is **idempotent and serialized**. Calls queue; none is dropped.

**A call's deadline starts when its own wait starts**, not when the call was made.
A second `close()` may sit behind the first for a while, and charging that queueing
time against its deadline would hand the caller less patience than they asked for,
for a reason they cannot see — and in the limit expire the deadline before step 2
even begins, producing a `timedOut: true` that never waited for anything.

**`deadlineMs` is the budget for the whole `close()`, not for step 2 alone.** Two
earlier drafts scoped it to the wait, and both were wrong in the same way: they
moved the original defect rather than removing it.

The second draft said steps 3 and 4 are "bounded by whatever timeouts are in
force". This document establishes elsewhere that an ordinary request may carry no
timeout at all — that is the caller's legitimate choice — and `unlockAll()` awaits
each unlock thunk in sequence with no bound of its own:

```ts
for (const [key, unlock] of [...this.locks]) {
  try { await unlock(); ... }
}
```

One hung `UNLOCK` therefore blocks this `close()` and every queued one, forever.
That is the exact defect this spec opens with, relocated from step 2 to step 3.

So the deadline covers steps 2 **and** 3. Unlike a request's timeout, these are
requests *we* issue, on our own behalf, during our own shutdown — bounding them is
not overruling anyone. When the budget runs out mid-cleanup, the remaining locks
are reported rather than attempted, which needs a third outcome:

| `outcome` | meaning |
|---|---|
| `refused` | attempted; SAP answered at application level and did not confirm release |
| `unknown` | attempted; no application-level answer arrived |
| `not-attempted` | the budget expired before this lock's turn — still held as far as we know, and nothing was sent |

Step 4 needs no share of the budget: after this spec, `disconnect()` does not wait
for anything, and a transport release that does not complete is already reported
as `releasePending` rather than awaited.

**A cleanup that stops being awaited is still running.** Bounding step 3 means
`close()` returns while an `UNLOCK` may still be in flight — we stopped listening,
we did not cancel it. The registry keeps that lock, so a later `close()` would
otherwise send a *second* `UNLOCK` with the same handle while the first is
unanswered, and the first's late arrival would then land on bookkeeping the second
had already changed.

So a lock carries a cleanup state, not just a presence:

- while an `UNLOCK` for it is **in flight**, a later `close()` does not start
  another. It observes the existing one, within its own budget, and reports
  `unknown` if that budget expires first.
- a **late success** removes the lock from the registry, whenever it arrives.
- a **late failure** leaves it, so the next `close()` may attempt it afresh.

Duplicate `UNLOCK`s are worth avoiding beyond the bookkeeping: the second would be
sent with a handle the first may already have consumed, and its refusal would say
nothing about whether the lock is held.

A queued caller therefore waits at most its predecessor's `deadlineMs`, plus that
call's `disconnect()`, and then gets its own full budget.

- **The barrier shuts once.** Step 1 has no meaning a second time — new work is
  already refused.
- **Step 2 waits again if anything is still outstanding.** An earlier draft said
  it had "nothing left to wait for", which is true only when the first call
  finished on its own terms. A call that returned `timedOut: true` left chains
  running, and *may* have left lock intents unresolved — may, because the
  outstanding chain can be a read-only one, which declares none. Either way a
  second call waits again, under **its own** `deadlineMs`. Otherwise a caller who saw a timeout and
  retried with more patience would get no more patience — and a lock those chains
  register in the meantime would never be picked up.
- **Cleanup runs again**, because cleanup stays admissible after `close()`: a
  second call re-attempts `unlockAll()` over whatever is still registered. This is
  what makes an explicit `close()` followed by a disposer harmless, and it is also
  how a caller re-attempts an `unknown` unlock without a separate API.
- **`disconnect: true` is honoured whenever it is first asked for**, including on
  a later call after a default `close()` — a caller may reasonably close the client
  now and decide about the connection afterwards.

  **A timeout plus `disconnect: true` can strand a lock, and this is where.** If
  step 2 hit its deadline, chains are still running; step 4 then clears the REST
  session, and a `LOCK` those chains complete afterwards produces a handle that
  belongs to a session no longer reachable. A later `close()` will wait again as
  promised, but its `unlockAll()` has nothing usable to unlock with. The lock is
  then beyond this library.

  We do it anyway. The caller asked to disconnect and owns that decision; refusing
  it because we timed out would be us overruling them on the basis of our own
  impatience. What we owe them is that it is not a surprise: `timedOut: true`
  together with a present `teardown` is exactly this situation, stated here and
  visible in the report.

  The safe order exists and costs nothing, because `close()` is idempotent: call
  it **without** `disconnect`, read the report, and ask for the teardown once
  `timedOut` is false and the intents are resolved. A caller who cannot wait keeps
  the combined call and accepts the trade knowingly.

  A teardown counts as finished only when it **released**. `disconnect()` reports
  `releasePending: true` when a transport or session resource did not close, and
  its own contract says a repeat call retries that release. So while
  `releasePending` is true, a later `close({ disconnect: true })` calls
  `disconnect()` again. Treating one attempt as final would take a retry the
  connection explicitly offers and make it unreachable through the wrapper — worst
  on RFC, where the pending release is a real handle still held open.
- **Each call reports what that call did**, not a cached copy of the first. A
  second `close()` over a fully released registry returns empty arrays and
  `timedOut: false`, which is the truth about that call.

Concurrent callers are the one case where "what that call did" needs care: they
are serialized, so the second runs after the first and sees its effects. It does
not join and receive a copy — joining would silently discard a `disconnect: true`
that the first call never requested.

Tests:

- explicit `close()` → `Symbol.asyncDispose` → no throw, second report empty
- default `close()` → `close({ disconnect: true })` → the connection is torn down
  on the second call
- `close()` returns `timedOut: true` → a second `close()` with a longer deadline
  waits again and picks up what finished in between
- **an `UNLOCK` that never settles** → `close()` still returns when the budget
  expires, that lock reported as `unknown`, any lock after it as `not-attempted`,
  `timedOut: true`, and a queued `close()` is not blocked — the regression this
  whole spec exists to prevent, in the place it moved to last
- **all chains finished, the last `UNLOCK` hangs** → `timedOut: true` even with no
  `not-attempted` entries, since the budget was exhausted in step 3
- **cleanup timeout → a second `close()` before the first `UNLOCK` settles → the
  first settles late**: no duplicate `UNLOCK` is sent, and a late success removes
  the lock while a late failure leaves it for the next attempt
- **two queued `close()` calls with different deadlines**: the second waits its
  full `deadlineMs` measured from when its own wait begins, not from when it was
  called — it does not arrive already expired
- **an unrepresentable `deadlineMs` on the first `close()`**: it throws, and the
  client is left able to admit new chains — the barrier must not have shut on a
  call that was rejected
- a **read-only** chain outstanding at the deadline → `timedOut: true` with
  `unresolvedIntents` empty; it is not named, because it could not have locked
- the **wall** clock moves backwards mid-wait while the monotonic clock keeps
  advancing normally → `close()` still returns within the requested duration. It
  has to be posed this way round: winding back the injected monotonic clock would
  break that clock's own contract and prove nothing about the implementation. What
  is under test is which source the wait reads, so only the source that can
  legitimately move must move.
- `disconnect()` reports `releasePending: true` → a later
  `close({ disconnect: true })` retries the release rather than reporting the
  teardown as done
- `close({ disconnect: true })` that times out → the teardown still happens, the
  report shows `timedOut: true` with a `teardown` present, and a lock completing
  afterwards is **not** recoverable by a later `close()` — the documented cost,
  pinned so it cannot be mistaken for a bug

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
distinctions the report exists to draw must survive that — **four categories,
logged separately**, because they are three different observations and a log is
the only diagnosis available to whoever runs this headless:

| logged as | what was observed |
|---|---|
| not-attempted unlocks | the budget expired first; nothing was sent for this lock |
| refused unlocks | SAP answered **at application level** about this `UNLOCK` and refused it |
| unknown-outcome unlocks | no application-level answer — a timeout, a reset, **or a gateway status such as 502/503/504**, which says nothing about what SAP did |
| unresolved intents | the `LOCK` never resolved, so no confirmed handle was available to unlock with — **not** evidence that no lock was taken |

The criteria are repeated here rather than referenced, because this is where an
implementation is most likely to reach for `response !== undefined` and call it a
refusal. A response is not by itself an answer from the application.

Flattening them undoes the work of separating them, and this section previously
did exactly that: it named two categories while the report carried three, and
called every unlock failure a refusal — the same conflation that had just been
fixed one section above.

The log says what was observed and stops. The current message ends with "retry
`unlockAll()` or rely on session-drop", which is advice, and this document has
already established twice that the advice is not ours to give — once when it was
optimistic and once when I replaced it with pessimistic advice instead. It goes.
What replaces it is the names under all **three** headings: these keys were
refused, these got no application-level answer, these never resolved. Naming two
of the three here would reintroduce the conflation this section exists to
prevent — and it did, in an earlier draft.

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

**No per-request opt-out**, and this is the one place in this document where a
caller's stated preference is overruled with no escape. It is worth being explicit
about why that is not the same error as the others.

A draft did add one — `honourTimeout: true`, "apply my timeout as given, even
inside a window" — on the grounds that a caller may know their request is
unrelated to what is locked. It reinstates precisely the hazard the window exists
to remove. A request aborted mid-flight leaves an operation whose outcome is
unknown, and that outcome lands in the **shared** ABAP session, not in the
caller's private corner of it. "Unrelated" is a judgement about the object; the
damage is to the session. A caller can be right about the first and still cause
the second.

The choice is not removed, it is made **earlier and once**: at `beginWindow()`.
Opening a window is opt-in, and it is a statement that this session must not have
requests torn out from under it for the duration. Everything that follows is the
consequence the caller asked for. A per-request escape would let one caller
withdraw a guarantee another one is relying on, over a session neither of them
owns alone — which is not that caller's decision to make.

This is the connection defending its own risk, which is the same rule applied
consistently: the REST session and its state belong to this layer, so protecting
them is its job. Elsewhere in this document the connection is told to stop
interpreting locks, stop waiting on windows and stop closing a connection it was
lent — all cases of it reaching into someone else's business. This is the
opposite case, and the boundary works in both directions.

Rejected too: binding every request to a window token. Beyond threading a token
through every call site, it would encode the same false premise — that the
protection is per span, when the thing being protected is shared.

What the default costs, stated so it is a decision rather than a surprise: an
unrelated slow request waits for the ceiling instead of its own short timeout,
for as long as any window is open. A test pins it.

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
  one while a window is open. Deliberately, and with no per-request escape: the
  choice is made once, by opening the window. The ceiling itself is a real default
  — 600s, `SAP_TIMEOUT_CRITICAL` — and it predates this spec.
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
- **the lifecycle ceiling on a wound-back wall clock**: with the monotonic clock
  advancing normally, `SessionLifecycle`'s own bounded wait still expires when it
  should. The same regression as the `close()` one, against the ceiling that
  already exists — and the reason the clock change belongs in this release rather
  than a later one

Connection, on the window's actual job:

- a request issued inside a window is not aborted by a short per-request timeout
- **an unrelated request, issued while someone else's window is open, also gets
  the raised ceiling** — the connection-wide effect, pinned as a decision
  There is deliberately no per-request escape from it
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

Then `@mcp-abap-adt/connection`, one release carrying three things that are one
change:

1. `disconnect()` stops waiting;
2. the **session generation** fencing that makes that safe — shipping the first
   without it would be a regression;
3. `SessionLifecycle`'s own ceiling moves to a **monotonic** clock. Required by the
   body of this spec and easy to lose here, since it is not part of the teardown
   change and reads like housekeeping. It is not: leaving it on `Date.now()` keeps
   one bounded wait honest and the other subject to a clock that can be wound
   back, in the same file, which is worse than having neither.
Generation, not epoch: an earlier draft of this plan said epoch, which is the
variant the body of this spec rejects for missing every internal teardown.

Then `adt-clients`, with its close barrier.

Versions are the user's call.
