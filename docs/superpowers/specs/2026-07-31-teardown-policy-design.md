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

This is the connection handling its own risk and stopping there.

### adt-clients

Releases its locks before it lets the connection go, because it is the only layer
that can: it holds the handles, in `LockRegistry`, and `unlockAll()` already
exists.

The shape is a close path on `AdtClient` — unlock what is held, then disconnect —
so that "the client was closed without unlocking" stops being a thing that can
happen by accident. `unlockAll()` already returns `LockFailure[]` for whatever it
could not release; nothing new is needed. The details belong to that repository's
own design, not here.

## What this means for `ILockWindowAware`

Named plainly: putting lock windows on the connection was a layering mistake of
mine. `beginWindow('Class/ZCL_FOO')` carries a domain concept into a layer that
cannot act on it — which is exactly why the teardown ended up blocking on a
counter it could not interpret.

It ships in `interfaces` 11.5.0 and `connection` 2.0.0, and nothing calls it:
`beginWindow()` has zero callers in either repository. Removing it is therefore
cheap in practice and breaking in form. **Not decided here** — the options are to
deprecate it now and remove it in the next major, or to leave it as an unused
capability nobody implements. Either way it stops being load-bearing.

## Not done

- **No teardown strategy or hook in the connection.** The previous draft proposed
  one. It is the same layering error one step removed: a seam in the connection
  for a decision that belongs to the layer above, which can simply act before
  calling `disconnect()`.
- **No request is aborted** by a teardown.
- **`disconnect()` is never refused** because something is open.
- **No default timeout** anywhere.

## Tests

Connection, at `SessionLifecycle` level — no server:

- a request that never settles: `disconnect()` resolves anyway, and a following
  `connect()` is not blocked — the regression this exists to prevent
- an open window does not delay a teardown
- no request is aborted or errored by the teardown itself

adt-clients: its close path unlocks before disconnecting, and reports what it
could not release — verifiable against the trial system, where the existing
`SessionLockRegistry` tests already exercise `unlockAll()`.

## Release

`@mcp-abap-adt/connection`: a behavioural change to `disconnect()` — it stops
waiting. No API change, and **no `interfaces` change**, so no cross-package
ordering. `adt-clients` follows independently with its close path. Versions are
the user's call.
