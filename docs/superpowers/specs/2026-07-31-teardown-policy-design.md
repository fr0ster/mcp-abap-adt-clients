# disconnect() settles, because the waiting was never ours to do

Continuation of `2026-07-27-session-lifecycle-design.md`, and a correction to it.

## The defect

We publish this:

```ts
/**
 * Tears the session down and reports what could not be finished.
 *
 * Resolves rather than throws — the report carries the failures.
 */
disconnect(): Promise<ITeardownReport>;
```

There is a path where it never resolves. After the ceiling expires,
`drain()` waits for in-flight requests with no bound at all:

```ts
while (this.inFlight > 0) {
  await this.changed();
}
```

`changed()` without a timeout resolves only when something wakes the lifecycle.
If a request never settles, nothing does — and because transitions are
serialized, every later `connect()` queues behind that teardown forever.

The declaration is a promise. This breaks it.

## The real mistake, which is larger

`drain()` waits on two things:

```ts
while (this.inFlight > 0 || this.liveWindows > 0) { ... }
```

Both are the caller's, and neither is ours to wait for.

**A lock window is opened by the consumer.** It is the consumer's declaration
that a span must not lose its session — so closing it correctly is the
consumer's job too. A teardown that blocks until the consumer gets around to it
has taken over responsibility that was never transferred.

**An in-flight request is issued by the consumer**, with the timeout the consumer
chose — including none, which is a legitimate choice for a long poll. Waiting on
a request the caller declared unbounded, and then calling that a teardown, is the
same error in a different costume.

And a fact that settles it: **nothing opens a window today.** `beginWindow()` is
exposed on the connection and called by nobody — not by the connector, not by
`adt-clients`, which has zero references to it. The waiting exists for a case
that does not yet occur, and it is what breaks the contract that does.

This is a correction to the earlier design, which is to say to my own: the
mechanism was built ahead of any user, and the hole opened inside the part that
was built ahead.

## Goal

`disconnect()` settles. It tears the session down and returns.

## Design

Remove the waiting.

- **Windows are not waited for.** They are recorded in the report — the caller
  learns which spans were open when it tore down — and closing them properly
  stays with whoever opened them.
- **In-flight requests are not waited for.** They continue exactly as their
  caller arranged; nothing is aborted. They will settle or fail on their own
  terms, and the connection is already marked unusable by then, so their outcome
  cannot be mistaken for a healthy session.
- The ceiling, and the two-phase drain built around it, go with them. There is
  nothing left to bound.

What the caller sees after a teardown is what the contract already says: the
connection is not connected, and the next call raises `ADT_NOT_CONNECTED`. That
is the whole notification mechanism, and it already exists — no new report field,
no flag, no strategy.

### Not done

- **No request is aborted.** Aborting mid-flight drops a stateful session and
  orphans a lock — the failure this whole design exists to prevent.
- **`disconnect()` is not refused** because something is open. A prohibition
  invented to protect the caller from itself is not a contract, it is a nanny.
- **No default timeout** is introduced anywhere. That would cancel an explicit
  choice on every request.

### What was justified, and no longer is

The one argument for waiting was to let a chain finish its `UNLOCK` rather than
strand a lock server-side — the original incident. It does not survive contact
with where the knowledge lives: the connector does not know a lock exists, what
it covers, or whether unlocking it still makes sense. `adt-clients` holds the
lock handle and the registry. If a chain must finish its unlock before a
teardown, that is arranged by the code that took the lock, not by a connection
blocking on a counter it cannot interpret.

## Consequences to state plainly

- A teardown during an in-flight request now clears session state under it. That
  request fails. It was going to fail anyway once the session went away; the
  difference is that it fails promptly instead of holding a teardown open.
- A teardown with an open window no longer waits for it. The report names the
  window. Whatever it protected is the caller's to release.
- `ITeardownReport` keeps both existing fields. `abandonedWindows` still means
  "open when the teardown happened", which is the same fact it always carried.

## Tests

At `SessionLifecycle` level — no server needed.

- a request that never settles: `disconnect()` resolves anyway, and a following
  `connect()` is not blocked — the regression this exists to prevent
- an open window: `disconnect()` resolves, the window is named in the report
- nothing open: report unchanged from today
- no request is aborted or errored by the teardown itself

## Release

A behavioural change to `disconnect()` in `@mcp-abap-adt/connection`: it stops
waiting. No API change, no `interfaces` change. Version is the user's call.
