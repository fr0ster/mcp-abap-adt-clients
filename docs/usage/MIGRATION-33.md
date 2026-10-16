# Migrating to 33.0.0

33.0.0 changes no type and no dependency range. It changes what a member does
when the connection refuses the credential, which the type system cannot show:
a promise that used to resolve with a failure may now reject.

## A credential the provider refused before SAP was asked

`@mcp-abap-adt/connection` raises `AuthRefusedError` when the credential
provider says no — a login that ended, a refresh token the identity provider
will not renew, a client the identity provider refuses. When that happens
before the request reaches SAP, a member used to answer
`{ ok: false, origin: 'connection' }` with the refusal's message and nothing
else: its `refusal` (the minted error, with `kind` and `facts`) was dropped.

Now the member **rejects with that error, the same object**, before `analyse`
or the reading is called. Code that checks `answer.ok` and does not catch now
sees the rejection. Catch it where you call members, read its `refusal`, and
stop: every further request would ask the provider again.

```ts
try {
  const answer = await client.getClass().read({ className });
  if (!answer.ok) { /* SAP's answer, or no answer arrived */ }
} catch (error) {
  // The provider refused the credential; `error.refusal.kind` says why.
  throw error;
}
```

`orThrow` passes the same object through.

The same holds everywhere else this library catches what a request threw:

- **A multi-step member** (lock, write, unlock — a message write, say) still
  runs its unlocks and rollbacks, then rejects with the refusal. A rollback
  that did not complete is logged (`warn`), not attached: the refusal is not
  this library's to change. A refusal met by an unlock on a chain that had
  otherwise succeeded or failed rejects the same way, after every cleanup ran;
  the failure the chain would have answered is logged.
- **`AdtClient.unlockAll()`** used to return every failed unlock as a
  `LockFailure`. It now stops at a refusal and rejects with it; that lock and
  those not yet tried stay in `pendingLocks`. **`await using`** (the client's
  `Symbol.asyncDispose`) lets it through — under `await using` a scope that
  also threw sees the language's `SuppressedError` holding both.
- **`AdtBatchConnection.execute()`** rejects every part with the refusal —
  sent, unsent and recorded while settling — where unsent parts used to get
  "ADT batch request not sent because an earlier batch envelope failed". A
  member recorded on the batch rejects with it too.

## A credential SAP refused

When SAP answered `401` and the provider could not renew the credential, the
refusal carries SAP's response as its cause (`cause.response.status ===
401`). A member now answers a failure with that response
(`response.status === 401`) and the request it was sent with, where it used
to answer one with neither. The message is the refusal's.
`analyse` still sees it, but cannot clear it: there is no document to read.

## How a refusal is recognised

By shape, not by `instanceof`: own data properties `refusal` (an object with
string `kind` and `reason`) and `at` (a string), and no own `response`. SAP's
answer is looked for one level down only, as `cause.response` with
`status` exactly `401`: any other status there (an identity provider's
`400 invalid_grant` a provider threw) is not SAP answering, and the refusal
rejects. Getters are never run. A value of your own that carries this shape is
treated the same way.
