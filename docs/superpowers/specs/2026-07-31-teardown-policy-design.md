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

**The server does not end the session.** Every teardown originates on our side of
the wire, from the consumer — which means that at teardown the ABAP session is
still alive and an `UNLOCK` can simply be sent. Releasing a lock during shutdown
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

### Removing the wait requires epoch fencing

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
| **session generation** (new) | is this still the session you were issued against? | every `markConnected()` — however the session came to be |

`markConnected()` currently increments nothing. It is the one place a session
becomes current, whatever brought it there — first connect, reconnect, or
recovery — which makes it the honest place to count generations. Epoch keeps its
existing job untouched.

#### The rule

- A lease captures the **generation** at admission.
- Every side effect on shared state — cookie update, identity policy, CSRF cache,
  the recovery paths — is skipped when the lease's generation is not the current
  one.
- The request still resolves or rejects normally to **its own caller**. Fencing
  suppresses its effects on the connection, not its result.

Tests, both orderings, because only the second distinguishes the two counters:

- explicit: request A → `disconnect()` → `connect()` → A settles
- **internal**: request A → session-lost teardown → recovery establishes a new
  session → A settles. Same epoch throughout; the new session's identity and
  cookies must still be untouched and no teardown raised.

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
2. **Let running chains finish**, so a `LOCK` already in flight lands and
   registers rather than appearing after the snapshot.
3. **`unlockAll()`**, now over a registry that cannot grow.
4. **`disconnect()`**.

`unlockAll()` already returns `LockFailure[]` for whatever it could not release;
nothing new is needed there. The barrier is the new part, and it needs a
concurrency test that starts a chain, calls `close()` mid-`LOCK`, and asserts the
lock was released rather than stranded. The details belong to that repository's
own design, not here.

## Decision: what a window is for

**A window marks a span in which a short per-request timeout must not abort a
request.** That is its whole purpose, and it is squarely the connection's own
risk: aborting mid-flight tears down the socket, which drops the stateful ABAP
session and orphans whatever it held. Deciding how long its own requests may run
is the connection's business, and nobody else's.

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
- **No default timeout** anywhere.

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

Then `@mcp-abap-adt/connection`: `disconnect()` stops waiting, and the epoch
fencing that makes that safe lands in the same release — they are one change, not
two, and shipping the first without the second would be a regression.

Then `adt-clients`, with its close barrier.

Versions are the user's call.
