# A teardown hook, so an open lock window can be dealt with

Continuation of `2026-07-27-session-lifecycle-design.md`, and a correction to it.

## The case this exists for

A consumer opens a lock window, something odd happens, and it closes the client
without unlocking. The lock stays on the server. Nobody is coming back for it.

That is the case worth insuring against, and it is what the window was for. The
earlier design tried to insure against it by **waiting** — the teardown blocked
until the window closed, bounded by a ceiling. That was the wrong instrument.

## Why waiting was wrong

Two reasons, and the second is decisive.

**It takes over a responsibility nobody transferred.** The consumer opened the
window; closing it correctly is the consumer's job. A teardown that blocks until
they get around to it has quietly assumed ownership of their problem.

**The connector cannot act on what it is waiting for.** It does not know a lock
exists, what object it covers, or what handle would release it. It waits on a
counter it cannot interpret, and when the counter never reaches zero it has no
recourse — which is exactly the hole in the current implementation:

```ts
while (this.inFlight > 0) {
  await this.changed();      // no bound; disconnect() may never resolve
}
```

We publish `Resolves rather than throws` for `disconnect()`. That path breaks the
promise. Waiting longer was never going to fix an abandoned lock; it only
converted one problem into two.

## The instrument that fits

Not a wait — **a hook**. At teardown, hand the open windows to a strategy the
consumer supplied, and let the code that knows what a window means decide what to
do about it.

`adt-clients` holds the lock handle and the registry. Given the window's label it
can find the handle and send the `UNLOCK`. That is auto-unlock, written by the
only party able to write it, and it is opt-in: a consumer that wants nothing gets
nothing.

```ts
interface ITeardownContext {
  /** Labels of windows still open, in the order they were opened. */
  readonly openWindows: readonly string[];
  /** False when the session is already gone, so nothing can be sent over it. */
  readonly sessionUsable: boolean;
}

interface ITeardownStrategy {
  /**
   * Called once, before the session is cleared, while requests are still
   * admitted. Anything it needs to send, it sends here.
   */
  onTeardown(context: ITeardownContext): Promise<void>;
}
```

The default is no strategy at all: the teardown reports the open windows and
proceeds. Today's consumers see the report they already see.

### Why this is not the wait in disguise

The connector still does not wait on the counter. It calls a function the
consumer provided and awaits **that** — the consumer's own code, with the
consumer's own timeouts, doing work the consumer chose. If that code takes a
while, the consumer decided so. If it hangs, that is theirs too, and it is
visible in their stack rather than buried in ours.

`sessionUsable` matters: when the teardown was raised because the session was
lost, an `UNLOCK` cannot be sent — there is nothing to send it over. The strategy
is told, so it can record the orphan instead of attempting a call that will fail.

### What still goes

Everything that was there to support waiting:

- the unbounded post-expiry loop — the contract hole
- the two-phase drain and its ceiling — nothing left to bound
- waiting on in-flight requests: they continue exactly as their caller arranged,
  nothing is aborted, and the connection is marked unusable before they land

## Not done

- **No request is aborted.** Aborting mid-flight drops a stateful session and
  orphans a lock — the failure this whole design exists to prevent.
- **`disconnect()` is never refused** because a window is open. A prohibition
  invented to protect the caller from itself is not a contract.
- **No default strategy.** Auto-unlock is a decision about someone else's locks;
  shipping it as the default would make it ours.
- **No default timeout** anywhere. That would cancel an explicit per-request
  choice.

## Open questions for review

1. **One call with all windows, or one call per window?** All at once is proposed:
   a consumer unlocking three objects may want to order or batch them, and per
   window it cannot.
2. **Is `sessionUsable` enough context**, or does the strategy also need the
   reason (caller-requested vs session-lost)?
3. **Where does `ITeardownStrategy` live?** It is implemented by consumers, so by
   the standing rule it belongs in `@mcp-abap-adt/interfaces` — which means that
   package ships first, as always.

## Tests

At `SessionLifecycle` / connection level — no server needed.

- no strategy: `disconnect()` resolves, open windows reported, behaviour otherwise
  as today
- a strategy is called once, before the session is cleared, and can still send
- a strategy sees `sessionUsable: false` after a session-lost teardown
- a strategy that throws does not prevent the teardown from completing
- an in-flight request neither blocks the teardown nor is aborted by it
- `connect()` after a teardown is not blocked — the regression this exists to
  prevent

## Release

`interfaces` gains the strategy types (minor), then `@mcp-abap-adt/connection`
consumes them and changes `disconnect()`'s behaviour: it stops waiting. Versions
are the user's call.
