# Stateful Session Guide

This guide explains how `@mcp-abap-adt/adt-clients` manages ADT sessions for CRUD workflows.

## Key Points

- `AdtClient` and `Adt*` objects operate through `IAbapConnection`.
- The connection maintains the ADT session (`sap-adt-connection-id`).
- Lock/unlock operations return a `lockHandle` used by update/delete flows.
- Tests and helpers track locks in `.locks/active-locks.json`.

## Workflow Example

```typescript
const client = new AdtClient(connection);

await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPKG',
  description: 'Test',
}, { activateOnCreate: true });

await client.getClass().update({
  className: 'ZCL_TEST',
}, { sourceCode: updatedCode, activateOnUpdate: true });
```

## Cleanup Guidance

- Always unlock or delete objects after failures.
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
