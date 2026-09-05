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

## Checking code before the object exists

`POST /sap/bc/adt/checkruns?reporters=abapCheckRun` can carry the source inside
the request, so in principle nothing has to be in the system for it to be
compiled. Whether the server accepts that **depends on the object type**, and
the split is not the one you would guess.

Measured on an ABAP Cloud system (2026-09-05) by sending, for a name no system
has, one clean source and one with a deliberate syntax error. The verdict is
`chkrun:status`: `processed` means the source was compiled, `notProcessed` means
the check never ran — and a `notProcessed` report carries no messages, which
reads exactly like clean code if you only count messages.

**Checked without the object existing:**

| Type | Evidence |
|---|---|
| `program` | `"The statement \"THIS\" is invalid"` — the broken source is what it complained about |
| `function_group` | same, reported against `SAPLZZ_NOSUCH_FG` |
| `table` | missing `AbapCatalog` annotations on the clean source, syntax errors on the broken one |
| `structure` | same |
| `metadata_extension` | `"Entity 'ZZ_NOSUCH_V' does not exist or is not active."` — it resolved the annotated entity |
| `service_definition` | `"Unexpected token \"this\". Expected was \"expose\" or \"}\""` |
| `scalar_function` | `"Unexpected token \"this\". Expected was \"RETURNS\" or \"WITH\""` |

**Refused — the object has to exist first:**

| Type | What the server said |
|---|---|
| `class` | `Resource CLASS ZZ_NOSUCH_CLS does not exist.` |
| `interface` | `Resource INTERFACE ZZ_NOSUCH_INTF does not exist.` |
| `view` (DDL source) | `Data definition ZZ_NOSUCH_DDL of version  does not exist` |
| `transformation` | `Transformation ZZ_NOSUCH_XSLT does not exist` |

For classes and interfaces the version makes no difference: `new`, `active` and
`inactive` all answer the same refusal. The same class source sent for a class
that **does** exist is checked under all three, so it is the object's absence
that is refused, not the payload.

**Undetermined** — `access_control`, `domain`, `data_element`. These did not
refuse for absence; they refused the payload. DCL answered `No DCL source data
has been specified` even with an artifact attached, and the two XML-bodied DDIC
types answered `System expected the element '…domain'` / `'…dtel}wbobj'` — the
server read the artifact and rejected its shape. A correct payload might well be
checked without the object; this probe did not establish one.

**What this is good for.** Validating generated or user-supplied code before
committing to a create, and getting a compiler's verdict on a source you are
about to write. For the seven types above it costs one POST and leaves nothing
behind.

```typescript
// The object need not exist. The source goes in the config; the answer is the
// compiler's report.
const answer = await client
  .getProgram()
  .check({ programName: 'ZZ_CANDIDATE', sourceCode }, 'inactive');
```

**The version does not matter when you supply a source.** `new`, `inactive` and
`active` were measured to answer identically for an object that is not there —
the artifact in the request is what gets compiled. So the members coercing the
status to `active | inactive` costs nothing here, even though ADT itself sends
`chkrun:version="new"` while an object is still being written.

**What a check with errors answers today.** A clean source comes back as a
result carrying the `chkrun:checkRunReports` document. A source with errors
comes back as the failure half — but with `origin: 'connection'` and no
`response` attached, because the low-level check functions still throw a plain
`Error` built from the message texts:

```
broken: FAILED origin=connection response=DROPPED request=DROPPED
        message: Program check failed: The statement "THIS" is invalid. …
```

The message survives; the report does not, so line numbers and severities are
out of reach, and `origin` points at the transport for what is a verdict about
the code. This is the last of the throw-instead-of-answer sites — 18 of them —
and it is why a check verdict is not yet something an `analyse` can overrule.

Reproduce with `npx ts-node scripts/probe-checkrun-without-object.ts`; set
`PROBE_EXISTING_CLASS` to a class on your system to include the control. The
version question is `scripts/probe-checkrun-version.ts`.
