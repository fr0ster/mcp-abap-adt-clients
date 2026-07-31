# disconnect() must settle, because we said it does

Continuation of `2026-07-27-session-lifecycle-design.md`.

## The defect

The contract we publish says:

```ts
/**
 * Tears the session down and reports what could not be finished.
 *
 * Resolves rather than throws — the report carries the failures.
 */
disconnect(): Promise<ITeardownReport>;
```

There is a path where it never resolves. After the ceiling expires,
`SessionLifecycle.drain()` waits for in-flight requests with no bound:

```ts
while (this.inFlight > 0) {
  await this.changed();
}
```

`changed()` with no timeout resolves only when something wakes the lifecycle. If
a request never settles, nothing does. The transition never completes, and since
transitions are serialized, every later `connect()` queues behind it forever.

That is the whole of it: **we declare that this settles, and it can fail to.**
The declaration is wrong, or the implementation is — one of the two has to move.

## What this is not

Not a judgement about how anyone uses the library.

Outside a critical section the connector passes the caller's timeout verbatim, so
a caller may pass none and mean it. That is a legitimate choice — a long poll
looks exactly like that — and the connector honouring it is correct. Responsibility
for that choice sits with the caller.

So the following were considered and rejected, both for the same reason: each
answers a question nobody asked us, by overruling a decision that is not ours.

| rejected | why |
|---|---|
| a default timeout outside a critical section | cancels an explicit choice on every request |
| aborting in-flight requests at the ceiling | aborting mid-flight is what drops a stateful session and orphans a lock — the failure this design exists to prevent |
| refusing `disconnect()` while a request is unbounded | a prohibition invented to protect the caller from itself |

A library declares a contract and keeps it. It does not police the calls.

## Goal

`disconnect()` settles. Always. Whatever is still outstanding is reported rather
than waited on indefinitely.

## Design

At the ceiling, the drain stops waiting and returns. Nothing is aborted, nothing
is cancelled, nothing is forbidden — the in-flight request goes on exactly as the
caller arranged. What changes is that the teardown no longer holds its own
promise hostage to it.

The report is the right place to say so, since it already exists to carry "what
could not be finished". It needs one more fact:

```ts
interface ITeardownReport {
  abandonedWindows: string[];
  releasePending: boolean;
  /** Requests admitted before the teardown were still running when it gave up. */
  requestsInFlight: boolean;
}
```

Not folded into `releasePending`: that one is about a transport resource, and a
report that conflates two different facts is a report that lies about both.

### Consequences to state plainly

- **Session state is cleared while a request may still be running.** Today's
  unbounded wait exists to avoid exactly that. The trade is deliberate: a request
  that outlives the ceiling is already beyond what the connection can manage, and
  a teardown that never returns is worse than one that returns with a warning.
  The request fails on its own terms rather than being cut off.
- The caller learns this happened and can act — that is what the new field is for.

### The ceiling itself

Currently fixed at the composition site:

```ts
protected readonly lifecycle = new SessionLifecycle();   // no options
```

`SessionLifecycle` already accepts `ceilingMs`. Nothing reaches it. Since the
value now decides when a teardown gives up, a caller that wants a different one
should be able to say so — a default we choose is fine, a default nobody can
change is not.

Kept **absolute**, measured from the teardown request, not from the last activity.
Making it configurable must not make it sliding.

## What must not change

- A caller that configures nothing sees today's behaviour up to the ceiling.
- No new required member on `IAbapConnection` or on either capability atom.
- Admission still shuts before any await at expiry; windows are still abandoned
  there.
- No request is ever aborted by the teardown.

## Tests

All at `SessionLifecycle` level — no server, which is what makes them possible.

- a request that never settles: `drain()` resolves at the ceiling, reports
  `requestsInFlight`, and the request is neither aborted nor errored
- `connect()` after such a teardown is not blocked — the regression this exists
  to prevent
- the ceiling stays absolute: a request settling late does not extend it
- everything settling before the ceiling: report unchanged from today
- a configured ceiling is honoured; an unconfigured one is 600s

## Release

Additive except for the new report field, which lands in `interfaces` first as a
minor, then the connector consumes it. Version numbers are the user's call.
