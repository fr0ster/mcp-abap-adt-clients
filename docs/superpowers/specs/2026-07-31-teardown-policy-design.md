# Teardown policy belongs to the consumer

Continuation of `2026-07-27-session-lifecycle-design.md`. That design gave the
connection a teardown that drains before it clears anything. This one is about
who gets to decide **how long** that drain waits, and what happens when it runs
out.

## Problem

`AbstractAbapConnection` composes the lifecycle with no options:

```ts
protected readonly lifecycle = new SessionLifecycle();
```

`SessionLifecycle` already accepts `ceilingMs` and `now`. The composition site
passes neither, so the 600-second ceiling is fixed at the point where a consumer
cannot reach it — not in config, not in `SapConfig`, not as an argument to
`disconnect()`.

The behaviour *after* the ceiling expires is not expressible at all:

```ts
// Expiry. Synchronous, before any await: no request may enter after this.
this.admissionForcedShut = true;
for (const entry of this.windows.values()) entry.abandoned = true;

while (this.inFlight > 0) {
  await this.changed();          // no bound, and no way to ask for one
}
```

So a teardown can wait indefinitely, and the caller has no way to say it would
rather not.

## What this is NOT

**Not a defect in a request without a timeout.** Outside a critical section the
connector passes the caller's timeout verbatim:

```ts
const effectiveTimeout = this.inCriticalSection
  ? Math.max(timeout ?? 0, getCriticalSectionTimeout())
  : timeout;
```

A consumer that passes none has *chosen* "as long as it takes" — a legitimate
choice for a long poll. Inventing a default would overrule it.

**Not a defect in waiting for that request.** A teardown that waits for a request
the consumer declared unbounded is behaving consistently. The problem is only
that the caller of `disconnect()` cannot express a different preference.

Both of the obvious "fixes" were rejected for the same reason: they replace the
consumer's decision with ours.

| rejected | why |
|---|---|
| default timeout outside a critical section | cancels the consumer's explicit choice on **every** request |
| a bound we pick for the post-expiry wait | we decide how long their teardown may take |

The rule this follows: **we may decide FOR our consumers — that is what a default
is — but we may not cut off the client's ability to choose otherwise.** Today's
behaviour is a decision that became unchangeable, which is the part that is wrong.

## Reach, across consumers

The connector has more than one consumer, and the exposure is not where this was
first noticed.

| consumer | `makeAdtRequest` call sites | without a timeout |
|---|---|---|
| `@mcp-abap-adt/adt-clients` | ~480 | effectively none — it passes an explicit 45s |
| `mcp-abap-adt` (server) | 4 in production code | **1** (`handleGetObjectNodeFromCache.ts`) |

So `adt-clients`, where this was found, is the consumer already protected by its
own convention. The one that can issue an unbounded request is the server.

Evidence of an actual hang: **none**. The report that started this turned out to
be a sandbox artefact — a stub server denied `listen(127.0.0.1)`, hidden behind a
15-minute jest timeout. This is a robustness gap and a policy-ownership problem,
not a live incident, and it should be sized accordingly.

## Goal

Let a consumer state its own teardown policy. Change nothing for a consumer that
does not.

## Design

A teardown policy, injected, with a default that reproduces today's behaviour
exactly.

Two decisions belong to it:

1. **How long the drain waits** — today's fixed 600s ceiling becomes the
   default value of a policy field.
2. **What happens when that expires while requests are still in flight** —
   currently an unbounded wait, which becomes one named option among others
   rather than the only behaviour.

The shape of the second is the substantive question for review:

| option | teardown resolves | in-flight requests |
|---|---|---|
| `wait` (today's behaviour, the default) | when the last one settles | run to completion |
| `report` | at the ceiling | left running; the report says so |

`report` needs a field on `ITeardownReport` — the existing `releasePending` is
about a transport release, not about requests, so conflating them would make the
report lie. A new boolean (`requestsInFlight`) keeps each fact its own.

`report` does **not** abort anything. Aborting a request mid-flight is what drops
a stateful session and orphans a lock — the failure the whole lifecycle design
exists to prevent. It resolves the teardown and leaves the request alone.

### What must not change

- A consumer that passes nothing gets exactly today's behaviour, including the
  600s ceiling. Verified by the existing lifecycle tests, unchanged.
- No new required member on `IAbapConnection` or on either capability atom; the
  policy is configuration, not contract surface.
- The ceiling stays **absolute**, measured from the teardown request. Making it
  configurable must not make it sliding.
- Admission still shuts before any await at expiry, and windows are still
  abandoned there. Only the wait that follows becomes a choice.

## Tests

- default construction ⇒ ceiling 600s, post-expiry wait unbounded (pins that the
  default is today's behaviour, not merely "some default")
- explicit ceiling honoured, and still absolute — a request settling late does
  not extend it
- `report`: teardown resolves at the ceiling with `requestsInFlight: true` while
  a request is still outstanding; that request is neither aborted nor errored
- `wait`: unchanged from today, including the report's fields
- a policy given to one connection does not leak to another

All of this is `SessionLifecycle`-level and needs no server, which is what makes
it testable at all.

## Release

Additive and default-preserving, so a **minor** on `@mcp-abap-adt/connection`.
Version is the user's call. No `interfaces` change is required unless
`requestsInFlight` is added to `ITeardownReport`, which lives there — in which
case interfaces ships first, as always.
