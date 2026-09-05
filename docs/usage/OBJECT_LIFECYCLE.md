# The lifecycle of an ADT object

Every object type in this library answers the same small set of members, and
they compose into one flow:

```
create → lock → update → unlock → activate
```

`read`, `check` and `delete` sit outside it. This page says what each member
actually does, which parts are opt-in, and where the flow does not hold — the
exceptions are few and each of them is a property of ADT, not of this library.

Everything below is measured against a real system. Where a claim is about the
server rather than about this code, it says so.

## `create()` creates the initial object, and nothing else

This is the rule to hold on to: **a create makes the object shell**. It does not
write source, it does not activate, it does not publish. For 24 of the 31 types
it is one POST and the answer to it.

```typescript
const answer = await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test class',
});
```

What comes back is an object that exists, is inactive, and is empty. Source is a
separate write, and activation is a separate call — which is exactly the order
Eclipse uses.

**Three options extend the create**, and each has to be asked for:

| Option | What it adds |
|---|---|
| `sourceCode` | a lock → PUT → unlock after the create, for the types that carry source |
| `activateOnCreate` | an activation once the source is in |
| `deleteOnFailure` | deletes the object again if a later step in the same call fails |

`deleteOnFailure` is the one worth spelling out: it runs on the failure path
only, and only if the create itself succeeded. A refused create leaves nothing
to roll back, and the rollback must never remove an object the call did not
make.

**Types whose create does more, unconditionally:**

- **Function group** — validate → create → check. The check reads; it writes
  nothing.
- **Package** — validate → create → check.
- **Unit test class** — creates the container class, activates it, then writes
  the tests into it. A test class has nowhere to live otherwise; this one is
  composite by nature.
- **Service binding** — see [Service bindings](#service-bindings-publishing-is-the-editing)
  below.

## `update()` owns the lock window

An update is the whole window, not just the PUT:

```
lock → check(source) → PUT → unlock → check(inactive) → [activate]
```

The lock is taken as the first step and released as its own step, and the
session goes `stateful` for the lock and back to `stateless` after the unlock —
a lock handle is only valid inside a stateful request on some releases, so
going stateless before the unlock would break the unlock itself.

If anything inside the window fails, the unlock still runs. That is not a
`catch` around the PUT; it is registered when the lock is taken and discharged
when the unlock happens normally, so it cannot run twice and cannot be skipped.

**Activation is opt-in**: pass `activateOnUpdate`. Without it the object is left
saved-but-inactive, which is a legitimate state and sometimes the one you want
(several objects activated together afterwards, for instance).

**To hold the lock yourself**, pass `lockHandle` in the options. The member then
does the PUT and nothing else — no lock, no unlock, no check — and the chain is
yours:

```typescript
const lockHandle = /* from your own lock */;
await client.getClass().update({ className: 'ZCL_TEST' }, {
  sourceCode,
  lockHandle,
});
```

This is what you want when one lock covers several writes — a class and its test
include, say, which are written under the *class's* lock.

## `delete()` does not lock

```
check(deletion) → delete
```

Both go to `/sap/bc/adt/deletion/…`, which is ADT's own deletion service. There
is no lock to take and none to release.

The check is a question, and the delete is the answer to a different one. A
refusal arrives as `del:isDeleted` on the delete — not as `del:isDeletable`,
which belongs to the check — and `packageDeletionRefusal` reads the right one.

## `activate()` and what counts as a failure

`activationExecuted="false"` does **not** mean the activation failed. It means
there was nothing to do — the object was already active. Only a message of type
`E` is a verdict. This is what the shipped `activationRefusal` analysis reads,
and it is the default at every `activate` call site.

A locked object refuses activation with HTTP 403, not with a message in the
body.

## Service bindings: publishing is the editing

The one type where the flow above does not apply. A binding is created once and
after that it is **published** and **unpublished**; its ADT lock exists for
those two operations, and `update()` deliberately does not take it, because how
long a lock is held is a policy the consumer owns.

The full account, with the Eclipse trace and a `try/finally` example, is in
[CLIENT_API_REFERENCE.md](CLIENT_API_REFERENCE.md#service-bindings-publishing-is-the-editing).

The other exception is the **transport request**, which is not a locked object at
all: it is changed and deleted directly.
