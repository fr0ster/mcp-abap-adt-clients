# disconnect() must settle, and most of what surrounds it should go

Continuation of `2026-07-27-session-lifecycle-design.md`, and a substantial
correction to it.

## The defect

We publish a `disconnect()` that resolves. There is a path where it never does:

```ts
while (this.inFlight > 0) {
  await this.changed();      // no bound
}
```

`changed()` without a timeout resolves only when something wakes the lifecycle. If
a request never settles, nothing does — and because transitions are serialized, a
teardown stuck there blocks every later `connect()` as well.

That is the whole defect. Everything below is either fixing it or removing
machinery built around it that never earned its place.

## Two sessions, two layers

There is the **REST session** — cookies, CSRF token, connection id — and the
**ABAP session** the server keeps behind it, which is what holds a lock.

| layer | owns | its risk |
|---|---|---|
| `@mcp-abap-adt/connection` | the REST session | losing or silently replacing the HTTP conversation |
| `@mcp-abap-adt/adt-clients` | the ABAP session's semantics — stateful mode, lock handles, the registry | leaving a lock on the server |

**The server does not end the session.** In an orderly shutdown the teardown
starts on our side, so the ABAP session is still alive and an `UNLOCK` can simply
be sent. Teardowns also arise internally, when a lost session is detected before a
recovery — those are neither the consumer's doing nor a case where an `UNLOCK` can
be sent, and they are why the fencing below is not optional.

**Out of scope: a server that goes away.** The lock survives in the enqueue table
and is cleared by waiting or by SM12. That is SAP's risk and the operator's. We
release what we took, while we can, and build nothing for the case where we
cannot.

## The connection

### It stops waiting

`disconnect()` tears down the REST session and returns.

- No wait on in-flight requests. They continue as their caller arranged; nothing
  is aborted. Outside a critical section the connector passes the caller's timeout
  verbatim, including none — a legitimate choice for a long poll — and waiting on
  a request the caller declared unbounded is not a teardown.
- The unbounded loop, the two-phase drain and its ceiling all go.

### It returns nothing

```ts
disconnect(options?: { deadlineMs?: number }): Promise<void>;
```

`ITeardownReport` is **removed**, on a criterion this ecosystem already has:
`@mcp-abap-adt/interfaces` holds what a **consumer imports**. Counted across all
four repositories, `ITeardownReport` appears in one — the connector — and only to
type its own method's return. No consumer imports it; the sole occurrence in
`adt-clients` is a test stub building an object literal. Both its fields were
vacuous in practice: `releasePending` was hard-coded `false`, and
`abandonedWindows` drew from windows nothing opens.

Earlier drafts of this document proposed growing it by two required fields —
`teardownRan` and `releaseTimedOut` — which meant a **breaking major** on the
shared contract so that `AdtClient.close()`, our own wrapper, could read the
connector's internal state. Expanding a shared contract to carry information
between two of our own packages is the wrong trade at any version number.

**What those two facts become instead: nothing the caller has to handle.** They
were "cleanup is owed" and "a transport resource is still held", and both are the
connection's own state, so the connection settles them itself:

- a repeat `disconnect()` performs whatever is still owed. It is idempotent, and a
  caller wanting cleanup simply calls it again;
- `connect()` settles the debt before establishing anything (below).

No report, no query, no new member on any interface.

### Removing the wait requires generation fencing

The wait had a second effect nobody designed and everybody relied on: no request
outlived the session it was issued against. Drop it and a request can settle
**after** a later `connect()` established a new one — and the response path mutates
shared state:

```ts
private observeResponse(headers?: Record<string, unknown>): void {
  this.applyIdentityPolicy(this.updateCookiesFromResponse(headers));
}
```

A stale response would write its cookies over the new session's and could be read
as a replacement, raising a session-lost teardown against a healthy session. The
old request would tear down its successor. So the fencing is not hardening; it is
what makes removing the wait safe.

#### The teardown epoch is the wrong counter

`RequestLease.epoch` exists and is used for nothing, so it is the obvious
candidate. It is also insufficient, deliberately:

```ts
if (origin === 'caller') {
  this.epoch += 1;
}
```

Only a caller-initiated teardown bumps it, because a recovery must not cancel
itself. After a session loss and a successful recovery, requests from the dead
session carry the *same* epoch as the new one and sail through a fence built on
it — precisely the case fencing exists for.

| counter | question | changes when |
|---|---|---|
| `epoch` (exists) | did the caller ask to stop? | a caller-initiated teardown |
| **session generation** (new) | is this still the session you were issued against? | every `markConnected()` **and** every `beginTeardown()` |

Counting only at `markConnected()` leaves a gap: between a `disconnect()` and the
next `connect()` a lease taken before the teardown still matches, and a response
arriving then would write into state `disconnect()` has just cleared. A teardown
starts a generation too — the moment a session stops being current is the moment
leases against it go stale, whether or not a replacement exists.

#### The rule

- A lease captures the **generation** at admission.
- Every side effect on shared state — cookie update, identity policy, CSRF cache,
  the recovery paths — is skipped when the lease's generation is not current.
- The request still resolves or rejects normally to **its own caller**. Fencing
  suppresses its effects on the connection, not its result.
- **Except for the request that raised the teardown**, which holds a permit.

#### The permit

A request detecting a lost session raises an internal teardown, which bumps the
generation and would otherwise make its own lease stale on the spot — fencing it
out of the recovery it just triggered, with nobody else able to run it.

Rebasing it onto the generation the teardown created is not enough: a successful
recovery calls `markConnected()`, bumping the generation again, so the raiser goes
stale a second time in the middle of the retry the permit exists for. The permit
is therefore scoped to the recovery **transition** — granted when the teardown is
raised, surviving whatever the transition does to the counter, ending when the
transition does, at which point the holder is rebased onto the generation actually
published.

**Only one raiser, enforced.** Two responses can arrive together and both detect
the loss; each would take a permit and invalidate the other's. Raising is a
compare-and-set: the first request to move the lifecycle into the session-lost
state takes the permit, and later detectors are fenced like any other stale lease.

**The permit does not outrank the caller.** It exempts its holder from the
*generation* fence and nothing else — in particular not the epoch. A recovery
still captures the epoch when it starts and refuses to publish if the caller has
since requested a teardown. Otherwise the permit would be a licence to resurrect a
session the caller explicitly ended.

### The transport release, bounded

`disconnect()` must await the transport release to know it happened, so an RFC
close that never settles takes the teardown and every queued `connect()` with it.

The release is awaited under `deadlineMs`, and on expiry it is **detached** — not
cancelled, since cancelling a half-closed handle is no better than leaving it. The
connection records that cleanup is owed.

**Omitting `deadlineMs` does not mean "no bound"**: it means
`SAP_RELEASE_DEADLINE_MS`, 600 000 ms. The unchanged behaviour *is* the defect this
document opens with, and a direct `disconnect()` — no `AdtClient` anywhere — is the
commoner call of the two.

**`deadlineMs` is measured from the call.** The connection serializes transitions,
so a `disconnect()` may sit behind a queued `connect()` or recovery. If the bound
started when the transition began, that queue time would fall outside it. Counting
from the call gives a standalone caller what it plainly asked for — a return within
`deadlineMs` of asking.

**Accepted values.** Bounded completion is the guarantee here, so the input is
validated rather than coerced:

| value | behaviour |
|---|---|
| finite, `0 <= v <= MAX_SAFE_INTEGER - <monotonic now>` | used as given |
| `0` | do not wait at all |
| `Infinity`, `NaN`, negative, or beyond that range | **rejected** — throws before anything happens |

`Infinity` coerced to a default hides that the contract cannot do what was asked;
treated as unbounded it discards the guarantee; a negative clamped to `0` turns a
mistake into an immediate destructive close. And "finite" alone is too weak:
`Date.now() + Number.MAX_VALUE` is finite and useless, since the addition is
absorbed and the deadline can never be reached.

**The clock is monotonic** — `performance.now()` or an injected equivalent. A wall
clock can move backwards, making the remaining time longer than asked or the
deadline unreachable. `SessionLifecycle`'s existing ceiling has the same flaw and
is fixed in the same release; its `now` injection point already exists, so this is
a default to change.

### A detached release, and what it blocks

The release is still running after detachment, so it carries state:

- while **in flight**, a later teardown observes it within its own bound rather
  than starting another. A duplicate would be sent over a handle the first may
  already have consumed;
- a **late success** clears the pending state whenever it arrives;
- a **late failure** leaves it set, so a later attempt may retry.

`connect()` must not proceed over it. Building a client over a handle still
closing risks a duplicate release, and waiting for it hands back the unbounded
wait this document removes.

This **amends** `2026-07-27-session-lifecycle-design.md`, which has `connect()`
retry a pending release and reject only if the retry fails. That rule was written
when a release could only be settled and failed; detaching one is new here, so the
two split by state rather than one overruling the other:

| release state | `connect()` |
|---|---|
| **in flight** (detached, unsettled) | rejects immediately with `ADT_SESSION_ERROR.RELEASE_PENDING`. It does not wait and starts no second release |
| **settled, failed** | retries it first, as the earlier spec requires — under `SAP_RELEASE_DEADLINE_MS`, since a retry that never settles would hang `connect()`. Proceeds on success; a **failed** retry keeps the state retriable, this row again; only **expiry** detaches it, moving to the first row |
| **settled, succeeded late** | nothing pending; proceeds normally |

### Expiring while still queued

Counting queue time only helps if the queue moves. A `connect()` or recovery ahead
can hang, and then the `disconnect()` callback never runs. So the bound is armed
**outside** the serialized transition and can settle the public promise before the
callback is reached.

**The intent still applies.** `disconnect()` shuts admission, bumps the epoch and
starts a generation **synchronously at the call**, as the earlier lifecycle spec
requires — a caller who asked to disconnect cannot have requests still going
through while the transition waits its turn. So after a queue expiry:

- the connection is **unusable**: admission shut, marked disconnected;
- the transport is **not** cleaned — no drain, no `clearSessionState()`, no
  release — and the connection records that cleanup is owed;
- `connect()`, or a repeat `disconnect()`, settles the debt. Whichever comes
  first.

Rolling the intent back was rejected: a connection that accepted `disconnect()`
and kept serving requests contradicts the published contract more seriously than
an uncleaned transport.

**The queued body is withdrawn**, not left to run later. Leaving it would fire a
teardown requested for a session that may be long gone against whatever session
exists by then — the successor-killing hazard the fencing prevents, arriving
through the queue instead of through a response.

**The race between expiring and starting** is resolved by compare-and-set on a
per-call state, `queued → running | expired`; only the winner acts. A **zero**
budget sets `expired` at the call, before anything is scheduled: `setTimeout(…, 0)`
is a macrotask and would lose to a transition callback already queued, making the
outcome depend on event-loop ordering.

`connect()` settles an owed cleanup before establishing anything — the skipped
`clearSessionState()` and release, under `SAP_RELEASE_DEADLINE_MS`. If that release
does not complete it is detached and `connect()` rejects with `RELEASE_PENDING`,
which is the first row of the table above and needs no separate rule.

## Windows are removed

`ILockWindowAware`, `WindowToken`, `beginWindow()`, `endWindow()` and the window
accounting inside `SessionLifecycle` all go.

**They do nothing.** `beginWindow()` delegates to the lifecycle and stops; it never
touches a timeout. The behaviour they were meant to provide — a span where a short
per-request timeout must not abort a request, because an aborted operation leaves
an outcome we cannot determine and possibly a lock we cannot reach — is already
implemented, and has been since 1.9.0:

```ts
const effectiveTimeout = this.inCriticalSection
  ? Math.max(timeout ?? 0, getCriticalSectionTimeout())
  : timeout;
```

`beginCriticalSection()` / `endCriticalSection()` acts and is reference-counted.
Windows are the inert duplicate. Keeping both means two mechanisms for one idea,
one of which is a no-op that reads as though it works.

**They cannot do lock bookkeeping either**, which is what the teardown was using
them for. Five open windows give the connection five opaque strings: it cannot say
which object, find a handle, send an `UNLOCK`, or judge whether any still matters.
`LockRegistry` a layer up is keyed by object and valued by *the function that
releases it* — it models the same case and can act on it.

There is a conceptual error in them too: a "window" suggests a span that owns the
session, but overlapping windows share one ABAP session, so they partition
nothing. Blocking a teardown on `liveWindows > 0` waited for "some span is open"
over a session every span shares anyway.

**Nothing calls them.** Across all four repositories, `beginWindow` has zero
callers outside the connector's own delegation.

The critical section stays exactly as it is, including the fact that its raise is
**connection-wide**: while it is active every request on that connection gets the
raised ceiling, including unrelated ones. That is a property of the session rather
than of a span, and the span is only what turns it on. There is deliberately no
per-request escape — one caller withdrawing the guarantee another relies on, over
a session neither owns alone, is not that caller's decision.

## adt-clients

`AdtClient` releases its locks before letting the connection go, because it is the
only layer that can: it holds the handles, and `unlockAll()` already exists.

"Unlock what is held, then disconnect" is not enough on its own. Between the
snapshot `unlockAll()` takes and the `disconnect()` that follows, a concurrent
chain can complete its `LOCK` and register it. Sequencing two steps does not order
what runs beside them.

### The close barrier

1. **Refuse new chains.** A chain not yet admitted is rejected from this point. An
   already-admitted chain is not interrupted: it runs its remaining steps, `LOCK`
   included. **Cleanup is not a new chain** — `unlockAll()`, and the unlock of a
   lock already held, stay admissible after `close()` returns. That says the caller
   is allowed to try, not that trying will succeed; a barrier permanently refusing
   cleanup would settle that question on their behalf.
2. **Wait for running chains**, within the budget.
3. **`unlockAll()`**, over a registry that cannot grow.
4. **`disconnect()` — only if asked.**

### The connection is injected, so closing it is not ours

`AdtClient` is handed an `IAbapConnection`. It did not create it and cannot know
who else holds it — one connection may serve several clients, and a `close()` that
disconnected by default would tear the session down underneath another client's
chains and locks. We already refuse to `connect()` on the consumer's behalf;
disconnecting on their behalf is the same overreach with the sign flipped, and
worse, because it destroys state rather than creating it.

So step 4 is opt-in, default `false`. A caller that owns the connection and wants
it gone says so, and thereby takes responsibility for whoever shares it.

Rejected: a refcount on the connection so the last client out turns off the
lights. It puts the library back in charge of a lifetime it was lent, and fails as
soon as a consumer holds the connection without an `AdtClient` around it.

### The budget covers steps 2 to 4

Bounding step 2 alone would move the defect rather than remove it. `unlockAll()`
awaits each unlock thunk in sequence with no bound of its own, so one hung
`UNLOCK` blocks this `close()` and every queued one — the same failure, two steps
to the right. Unlike a caller's request, these are requests *we* issue during our
own shutdown, so bounding them overrules nobody.

When the budget expires mid-cleanup the remaining locks are reported rather than
attempted.

**A timeout plus `disconnect: true` can strand a lock.** If step 2 hit its
deadline, chains are still running; step 4 then clears the REST session, and a
`LOCK` completing afterwards produces a handle belonging to a session nobody can
reach. We still do it — the caller asked, and refusing because *we* ran out of
patience would overrule them — but it is stated here and visible as
`timedOut: true`. The safe order costs nothing, since `close()` is idempotent:
close without `disconnect`, read the report, ask for the teardown once `timedOut`
is false.

### Intents, declared at admission

A chain still running at the deadline must be nameable, and watching the registry
cannot do it: at the moment `close()` returns, that chain's lock is not registered
yet, and once returned the result cannot be amended.

So the registry records **intent**, not only possession. A **lock-capable** chain
declares the key it may lock when it is **admitted** — the object and whether the
flow can lock at all are known from its config before any request goes out — and
resolves that declaration when the outcome is known.

- **At admission, not before the `LOCK`.** A chain admitted before `close()` may be
  several steps short of its `LOCK` when the deadline arrives and would hold no
  declaration at all.
- **Per attempt, not per key.** Two chains may attempt `DOMA/Z` concurrently;
  keying declarations by object would let the loser's resolution clear the
  winner's. The second attempt is expected to fail — the point is that its failure
  must not corrupt the bookkeeping of the one that succeeded.
- **Read-only chains declare nothing.** One still running at the deadline would
  otherwise be named for an object no `LOCK` could have touched. It shows up as
  `timedOut: true`, which is what is true.

### `ICloseReport`

```ts
type UnlockOutcome =
  | { key: string; outcome: 'refused' | 'unknown'; error: unknown }
  | { key: string; outcome: 'not-attempted' };

interface ICloseReport {
  /** Locks this client held and could not confirm released. */
  locksNotReleased: UnlockOutcome[];
  /** Declared before the LOCK went out, still unresolved when waiting stopped. */
  unresolvedIntents: string[];
  /** Whether the shutdown budget was exhausted — in step 2, 3 or 4. */
  timedOut: boolean;
}

close(options?: {
  deadlineMs?: number;
  /** Tear the connection down as well. Default false — see ownership, above. */
  disconnect?: boolean;
}): Promise<ICloseReport>;
```

This one **is** a consumer-facing type: whoever calls `AdtClient.close()` reads it.
It lives in `adt-clients`, not in `interfaces`, until someone else imports it.

| field / outcome | what was observed |
|---|---|
| `refused` | SAP answered this `UNLOCK` at application level and refused it |
| `unknown` | no application-level answer — a timeout, a reset, or a gateway status that says nothing about what SAP did |
| `not-attempted` | the budget expired before this lock's turn; nothing was sent |
| `unresolvedIntents` | the `LOCK` never resolved, so no confirmed handle was available — **not** evidence that no lock was taken |

`refused` requires an **application-level answer about this operation**. A 502, 503
or 504 comes from a proxy and says nothing about what SAP did. The asymmetry is
deliberate: misfiling an unknown as a refusal asserts something unobserved, while
the reverse only understates certainty.

**What to do about any of it is the consumer's call.** Earlier drafts told them —
first that a failure "calls for a retry", then that retrying "is not a plan" — and
both were the same error. Two facts are worth stating because they are ours to
know: a refused `UNLOCK` is often an invalid handle, and that kind of disturbance
usually comes from our own side between `LOCK` and `UNLOCK`, which is why
`unlockAll()` holds the session stateful across the batch.

**Every entry describes a lock that may still exist.** A refusal is an answer about
the *attempt*, not about the lock. Emptiness is the only final state: both fields
empty means every lock this client took was confirmed released, and a `LOCK`
confirmed to have failed is absent from both by design — nothing was taken.

### Calling `close()` more than once

Unavoidable, since the disposer delegates to it. `close()` is idempotent and
serialized; calls queue and none is dropped.

**A call's deadline starts when its own wait starts**, not when the call was made —
charging queueing time against it would hand the caller less patience than asked
for, invisibly, and in the limit expire before step 2 began.

- The barrier shuts once.
- Step 2 waits again if anything is still outstanding. A call that returned
  `timedOut: true` left chains running, so a second call waits again under its own
  budget.
- Cleanup runs again over whatever is still registered.
- `disconnect: true` is honoured whenever first asked for, and simply calls
  `disconnect()` again on a later request. Whether anything is still owed is the
  connection's own state and its own business; a repeat `disconnect()` is
  idempotent by design.
- Each call reports what that call did, not a cached copy. Concurrent callers are
  serialized rather than joined: joining would silently discard a
  `disconnect: true` the first call never requested.

### `Symbol.asyncDispose`

`AdtClient` already has a disposer, and it calls `unlockAll()` directly. Left alone
it bypasses the barrier, the intents, the budget and the report — worst because
`await using` is the idiomatic path, so the most careful consumer would get the
weakest cleanup.

It delegates to `close({ disconnect: false })`. The default is right for it twice:
a disposer cannot know whether the connection is shared, and it did not create it.

A disposer returns `void`, so the report is logged — **four categories,
separately**, since they are four different observations and a log is the only
diagnosis available to whoever runs this headless: not-attempted, refused,
unknown-outcome, unresolved intents. The current message ends with "retry
`unlockAll()` or rely on session-drop", which is advice; it goes, replaced by the
names under each heading.

## Not done

- **No teardown strategy or hook in the connection.** A seam for a decision that
  belongs to the layer above, which can act before calling `disconnect()`.
- **No request is aborted**, by a teardown or by `close()`. Both stop waiting;
  neither cancels work.
- **`disconnect()` is never refused** because something is open.
- **No default timeout for an ordinary request.** Outside a critical section the
  caller's value is passed verbatim, including none.

## Tests

Connection, at `SessionLifecycle` level — no server:

- a request that never settles: `disconnect()` resolves anyway, and a following
  `connect()` is not blocked
- request A → `disconnect()` → `connect()` → A settles: the new session's cookies
  and identity are untouched, no teardown raised
- request A → `disconnect()` → A settles → `connect()`: the cleared state stays
  cleared — fails if generations are counted only at `markConnected()`
- request A → session-lost teardown → recovery → A settles: same epoch throughout,
  new session untouched
- the raiser's permit: A raises and completes its recovery while B, from the same
  dead session, is fenced
- the permit survives `markConnected()`
- two detectors: exactly one teardown, one recovery, the loser fenced
- the wall clock moves backwards while the monotonic clock advances: `disconnect()`
  still returns within the requested duration. Posed this way round deliberately —
  winding back the injected monotonic clock would break its own contract and prove
  nothing
- the lifecycle ceiling under the same rollback
- a transport release that never settles: `disconnect()` returns, the release is
  detached, a queued `connect()` is not blocked
- release timeout → `connect()` before it settles → rejects `RELEASE_PENDING`
  immediately; a late success lets the next through, a late failure has `connect()`
  retry the release itself
- `connect()`'s retry never settles → rejects at `SAP_RELEASE_DEADLINE_MS`, release
  left detached
- a nested `disconnect()` queued behind a recovery that never settles: returns at
  its deadline, the queued body withdrawn. A merely slow predecessor does not test
  this
- after that expiry: the connection is unusable, the transport uncleaned, the debt
  recorded; `connect()` then clears and releases before establishing
- the queue dequeues at the instant the bound fires: exactly one of the two wins,
  never both
- a zero budget is deterministic with a transition callback already pending

adt-clients:

- `close()` → `unlockAll()` afterwards is still admitted. Asserts admission, not
  success
- a chain interrupted mid-`LOCK`: the lock is released, not stranded
- a chain that never settles: `close()` returns at its deadline and names the
  object
- a chain whose `LOCK` is confirmed to have failed: **not** named
- a read-only chain outstanding: `timedOut: true`, `unresolvedIntents` empty
- two chains attempting `DOMA/Z` at once: the loser's failure does not disturb the
  winner's bookkeeping
- an `UNLOCK` that never settles: `close()` returns at the budget, that lock
  `unknown`, later ones `not-attempted`, `timedOut: true`, a queued `close()` not
  blocked
- all chains finished, the last `UNLOCK` hangs: `timedOut: true` with no
  `not-attempted` entries
- cleanup timeout → a second `close()` before the first `UNLOCK` settles → the
  first settles late: no duplicate sent, a late success removes the lock
- explicit `close()` → `Symbol.asyncDispose`: no throw, second report empty
- default `close()` → `close({ disconnect: true })`: torn down on the second call
- `close({ disconnect: true })` that times out: the teardown still happens and a
  lock completing afterwards is not recoverable — the documented cost
- an unrepresentable `deadlineMs`: throws, and the client can still admit chains
- two queued `close()` calls with different deadlines: the second gets its full
  budget from when its own wait begins
- `close()` over a connection implementing no lifecycle atom: still unlocks, still
  reports, does not throw

## Release

`@mcp-abap-adt/interfaces` — **removals**: `ITeardownReport`, `ILockWindowAware`
and `WindowToken` leave the contract, and `disconnect()` becomes `Promise<void>`
with an optional `{ deadlineMs }`. Nothing outside the connector imports any of
them, so the practical impact is nil and the formal one is a **major**. The
alternative — deprecate now, remove in the next major — is available if the
cascade is unwelcome; it costs a release either way.

`ADT_SESSION_ERROR` and `ISessionLifecycleAware` stay. They are the two additions
from 11.5.0 that a consumer actually imports.

Then `@mcp-abap-adt/connection`, one release carrying what is one change:

1. `disconnect()` stops waiting and returns `void`;
2. session-generation fencing, without which the first is a regression;
3. the bounded, detachable transport release with its in-flight state;
4. window machinery deleted from `SessionLifecycle` and the connection;
5. `SessionLifecycle`'s own ceiling on a monotonic clock — easy to lose because it
   reads like housekeeping, and it is not: leaving it on `Date.now()` puts an
   honest bounded wait and a wind-backable one in the same file.

Then `adt-clients`, with the close barrier, intents, `ICloseReport` and the
disposer.

Versions are the user's call.
