# Migrating to 18.0.0

For a consumer on 17.x. Everything here is a change you have to make; nothing
in this release is opt-in.

The shape of the change is one idea: **a member is one ADT request, it answers
the contract, and it is named for the resource it addresses.** Everything below
follows from that. Where 17.x gave you one call that did six things and told you
about none of them, 18.0.0 gives you six calls that each answer.

Requires `@mcp-abap-adt/interfaces@^39.0.1`. Run `npm ls @mcp-abap-adt/interfaces`
after installing: it must print **one** version. Two structurally identical
copies do not compare equal in TypeScript, and the errors read as impossible.

---

## 1. The sequence around a write is yours

`create`, `update` and `delete` used to run a chain — lock, check, write,
unlock, activate — behind one call.

```typescript
// 17.x
await client.getClass().create(config, { activateOnCreate: true });
await client.getClass().update(config, { sourceCode });   // locked and unlocked for you
```

```typescript
// 18.0.0
const cls = client.getClass();
await cls.create(config);                    // the POST, and nothing else

const locked = await cls.lock(config);
if (!locked.ok) throw new Error(locked.getError().message);
const lockHandle = locked.getResult().value;
try {
  await cls.update(config, { sourceCode, lockHandle });
} finally {
  await cls.unlock(config, lockHandle);
}

await cls.activate(config);
```

`activateOnCreate`, `activateOnUpdate` and `deleteOnFailure` are gone from
`IAdtOperationOptions` — they asked for extra steps, and there are none left.
If you relied on `deleteOnFailure`, note what it actually did: it ran on **every**
path including success, in twenty-four handlers. Whatever it was doing for you,
it was not that.

`AdtMessageClassMessage` is the single exception and still composes: a message
is a row inside its class's document, so one PUT needs two lock handles and a
read-modify-write of XML this library assembles.

## 2. Every member answers, and nothing throws for a server refusal

```typescript
// 17.x
try {
  const state = await cls.create(config);
  if (state.errors.length) { /* … */ }
} catch (e) { /* a refusal arrived here, sometimes */ }
```

```typescript
// 18.0.0
const answer = await cls.create(config);
if (!answer.ok) {
  const failure = answer.getError();
  failure.origin;    // 'connection' | 'refusal' — which system to go and look at
  failure.message;   // what SAP said, verbatim
  failure.request;   // which request, when a member issued more than one
  return;
}
const value = answer.getResult().value;
```

- **The 28 `IXxxState` types are gone.** A member answers
  `IAdtResponse<T>`, and `T` is what its result strategy produced.
- **`AdtFailureOrigin` has two values**, `'connection'` and `'refusal'`.
  `'parse'` is gone: it described this library failing to read a document, which
  is not a verdict about the server.
- An argument you did not supply still throws. That is your mistake, not the
  server's, and it must not be dressed as one.

## 3. Some types have no source, and say so

Eight types **are** their own document and no longer offer `read`/`update`:
`getDomain()`, `getDataElement()`, `getPackage()`, `getTableType()`,
`getFunctionGroup()`, `getRequest()`, `getMessageClass()`,
`getAuthorizationField()`.

```typescript
// 17.x
const xml = await client.getDomain().read({ domainName: 'ZDOM' });

// 18.0.0
const xml = await client.getDomain().readMetadata({ domainName: 'ZDOM' });
```

All eight answered `read` and `readMetadata` with the **identical request**
before, so this is a rename to the truth rather than a loss.

**Watch for `getAdtObject: () => any`-style indirection.** Four calls to `read()`
on types that no longer have one were hidden behind exactly that in this
package's own suite, and the compiler could not see them.

Two types had `update` writing the *wrong* resource and now write the source:
`getFunctionInclude().update()` and `getFeatureToggle().update()`. If you were
using them to write a document, you were writing the thing you did not mean to.

## 4. `delete` no longer asks permission for you

```typescript
// 18.0.0
const check = await handler.checkDeletion(config);   // available on 30 types
if (!check.ok) return;                                // read what ADT said
await handler.delete(config);
```

**Seven types stopped declaring `IAdtDeletable`**, because they do not delete:
the four class includes, a message-class message, and the two unit-test
handlers. `AdtLocalTestClass.delete()` was literally
`this.update({ testClassCode: '' })` — do that instead, and say so.

## 5. A write states what it needs

The write atoms take the config as given rather than `Partial`, so a
requirement is in the type where you can see it.

```typescript
// 18.0.0 — the protocol is required, and the compiler says so
await client.getServiceBinding().update(
  { bindingName: 'ZAC_SRVB01', desiredPublicationState: 'published',
    serviceType: 'odatav4' },
  { timeout: 300_000 },
);
```

`desiredPublicationState: 'unchanged'` is refused. `publishODataV2` /
`unpublishODataV2` are gone — one member takes the protocol.

`create` takes **no source**. It makes the object; the body is the write that
follows. And `update` reads its source from `options.sourceCode` only —
`config.sourceCode` belongs to `check`, which compiles a source that is not on
the server yet.

## 6. Timeouts and the session

- **No client-side deadline by default.** `SAP_TIMEOUT_DEFAULT` is `0`. Aborting
  a request the server is still executing ends nothing there, and over HTTP it
  costs the session: the ICF layer is replaced while the ABAP layer beneath
  keeps the enqueue locks, whose handles died with the cookie.
- **`options.timeout` now works.** In 17.x it was documented and ignored
  everywhere but one member. If you want a deadline, pass it; if you want one
  process-wide, set `SAP_TIMEOUT_DEFAULT`.
- **`stateful` covers the `LOCK` and the `UNLOCK` and nothing else.** The write
  between them goes out stateless, carrying `lockHandle` and `corrNr` —
  Eclipse's model. Anything the server takes during a request that runs *inside*
  a session is held by that session.
- **A refused `lock` leaves the session stateless.** In 17.x it left the shared
  connection stateful, and your next unrelated request inherited it.

## 7. Smaller removals

| gone | use |
|---|---|
| `AdtFunctionInclude.readSource()` | `read()` — it is the source |
| `getODataV2ServiceBinding` / `getODataV4ServiceBinding` | one member, protocol as an argument |
| `AdtRuntimeClientExperimental` | `AdtRuntimeClient` |
| `getProgram({ programType: 'include' })` | `getInclude()` — the old mapping now throws |
| `IAdtServiceBinding` from `@mcp-abap-adt/interfaces` | the capability atoms |
| `IAdtNonVersionedObject` | omit the versioning atom; a type states what it *is* |

`AdtAuthorizationField` no longer claims `IAdtTransportAware`, and
`AdtInclude.delete` takes no lock handle.

## 8. The reading is injected once, at construction

Every `parse` parameter and per-call result option is gone. A result strategy is
chosen when the handler is built, and each member reads its own slot.

```typescript
const client = new AdtClient(connection, logger);
const cls = client.getClass();          // ships defaults: the document as it arrived
```

To supply your own shape, pass your result set to the handler rather than a
parser to the call. `IAdtResult` **is** the strategy — not a container with one
inside.

---

## If something used to work and now does not compile

That is the point of the release, and the compiler is telling you where 17.x was
doing something on your behalf that it never told you about. The three questions
that resolve almost every case:

1. **Does this type have a source?** If not, the member is `readMetadata` /
   `updateMetadata`.
2. **Was this call doing more than one request?** Then it is now the two or six
   calls it always was, in the order you choose.
3. **Am I reading the answer?** `answer.ok` before `getResult()`; a refusal is a
   value now, not an exception.
