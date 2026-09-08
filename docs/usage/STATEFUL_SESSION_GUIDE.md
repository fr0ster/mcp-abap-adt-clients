# Stateful Session Guide

This guide explains how `@mcp-abap-adt/adt-clients` manages ADT sessions for CRUD workflows.

## Key Points

- `AdtClient` and `Adt*` objects operate through `IAbapConnection`.
- The connection maintains the ADT session (`sap-adt-connection-id`).
- `lock` returns the `lockHandle`; `update` and `delete` carry it in
  `options.lockHandle`, and `unlock` gives it back.
- **Only `lock` and `unlock` change the session type**, and each covers its own
  request and nothing more: `lock` sets stateful, acquires the handle, and puts
  the session back to stateless before returning. The window between `lock` and
  `unlock` is *not* stateful — the write inside it goes out stateless, carrying
  the handle in `options.lockHandle`.
- This is Eclipse's model, measured: of 792 requests in a full run, exactly four
  carry `x-sap-adt-sessiontype: stateful` — two `LOCK`s and two `UNLOCK`s. The
  source `PUT`, the activation and every read are stateless.
- **A lock the server takes during activation outlives the `unlock`.** Activation
  generates, and generation takes `E_ABAP_GENPH` on the generated program; that
  one belongs to the ABAP session, not to the object, and is released when the
  session ends — measured on E19, visible in SM12 for exactly as long as the
  session lives. Nothing in this library can release it earlier.
- Tests and helpers track locks in `.locks/active-locks.json`.

## Workflow Example

Every member is one request, so the window is yours to open and close:

```typescript
const client = new AdtClient(connection);
const cls = client.getClass();
const config = { className: 'ZCL_TEST' };

// The POST that makes the class shell. Nothing else.
await cls.create({ ...config, packageName: 'ZPKG', description: 'Test' });

const locked = await cls.lock(config);          // stateful from here
if (!locked.ok) throw new Error(locked.getError().message);
const lockHandle = locked.getResult().value;

try {
  await cls.update(config, { sourceCode: updatedCode, lockHandle });
} finally {
  await cls.unlock(config, lockHandle);          // stateless again
}

await cls.activate(config);
```

Passing no `lockHandle` is allowed. Whether a write without a lock is accepted
is ADT's judgement about that object on that system, and its refusal comes back
in the answer rather than as an exception this library invented.

## Cleanup Guidance

- Always unlock or delete objects after failures — the `try/finally` above is
  the shape, because a handle left held makes the next create answer 403 with
  nothing appearing to hold it.
- Use the lock registry helpers to recover stale locks.

## The session belongs to the caller, not to this library

`IAbapConnection` — the whole contract this library depends on — is five
methods: `connect`, `getBaseUrl`, `getSessionId`, `setSessionType`,
`makeAdtRequest`. There is no `disconnect`, no `close`, no `recycle`. That is
deliberate, and it has a consequence worth knowing before you meet it:

**No client, handler or low-level function here ends or reopens an ABAP session.**
It cannot — there is nothing on the interface to call — and it should not: the
connection was opened by you and is usually shared, so tearing it down in the
middle of one operation would take every other caller down with it. The library
goes as far as `setSessionType('stateful' | 'stateless')` and no further.

Some ADT operations cannot be done twice in one ABAP session, and this is where
that lands on you rather than on us. The clearest case: a package the session
has just updated **cannot be deleted by that same session** — ADT answers
`PAK/058`, and the same delete from any other session succeeds on the first
attempt, immediately, while the first session is still open. It is ownership of
the framework's state, not a delay: retried for 30 seconds it never succeeds.

So when an operation refuses in a way that names editing or locking, and the
object is one your session has just changed, the fix is a different session —
and only you can make one:

```ts
// The consumer owns the lifecycle, so the consumer recycles.
await connection.disconnect();   // on your concrete connector, not on IAbapConnection
await connection.connect();
await client.getPackage().delete({ packageName });
```

This library's part is to report the refusal rather than swallow it.
`AdtPackage.delete()` reads `del:isDeleted` out of the response body and throws
with the message id — a `200` from a deletion endpoint means the request was
understood, not that the object went away.

The test harness does exactly this, in `recycleTestSession()`, under the
`cleanup_session_after_test` flag in `test-config.yaml`. That is harness code on
the consumer side, not a library method, for the reasons above.
