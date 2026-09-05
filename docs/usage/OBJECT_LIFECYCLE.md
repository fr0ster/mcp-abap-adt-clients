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

## How to check a created object, and when

Four of the checks in this library's own test suite were doing nothing, and all
four passed. They are worth reading as a list of what not to do.

### Check the answer, not the object

Every member answers an object, whether it found anything or not. So this is a
constant:

```typescript
const state = await client.getClass().read({ className });
if (state) { /* always taken */ }
```

Three loops in this suite were written that way — two spun twenty round trips
and ten seconds of sleeping every run, a third reported "the package is ready"
on its first pass without waiting for anything. The compiler cannot catch it
wherever the value is `any`, and the tests passed throughout. Read `.ok`:

```typescript
if (!state.ok) throw new Error(state.getError().message);
```

### What each step actually guarantees

| After | The object is | A read answers |
|---|---|---|
| `create()` | named, and holding the name | **depends on the type** — see below |
| `update()` | carrying an inactive version | `version=inactive` reads it, even under the lock |
| `activate()` | carrying an active version | the plain read answers |

What a create leaves varies: a domain is complete, an interface has a generated
skeleton, a DDL source answers 200 with an empty body, and **a class refuses
every read** until its source is written. So a read straight after a create
proves nothing portable — and for a class the refusal describes your request
rather than the object's state, which is why it invites a retry that can never
succeed.

**The first check worth making is after the source is written.** Read it back
and compare it to what you sent.

### Three things that are not existence checks

- **A deletion check.** `del:isDeletable="true"` means nothing is blocking a
  delete, and nothing blocks deleting what is not there. Measured, an absent
  `MSAG/N` and an absent `FUGR/FF` both answer `true`; absent classes,
  structures, data elements and scalar functions answer `false`. Read
  `<del:text>` instead — it says "does not exist" in every case.
- **A 2xx.** A refusal arrives with `200` often enough that the status settles
  nothing: an activation that failed, a deletion that was refused and a
  publication that was rejected all answer `200` with the verdict in the body.
- **An empty body.** For several types, absence and emptiness are the same
  answer: `200` with zero bytes. Which one it is, is your `analyse` to decide.

### What to check instead

Read the thing you actually care about and look at the content. After a create
and an update, read the source back and compare it to what you wrote; after an
activation, read the active version. For a message, read the message class —
a message has no existence of its own to ask about.

### When waiting is the right answer, and when it is not

Waiting helps for exactly one thing: an activation whose effect has not landed
yet. That is what `withLongPolling` is for, and this library uses it on the read
that follows an activation.

Waiting never helps for a read that refuses with **"wrong input data"** — the
object has no version and will not grow one on its own — or for **"does not
have a TMDIR entry"**, which means the object is not there at all. Both read
like transient faults. Neither is one.

And nothing in this library polls an asynchronous ADT job for you. A publish
takes about two minutes of server time and answers its own verdict; if you want
to watch the state settle afterwards, that loop is yours to write.

## Service bindings: publishing is the editing

The one type where the flow above does not apply. A binding is created once and
after that it is **published** and **unpublished**; its ADT lock exists for
those two operations, and `update()` deliberately does not take it, because how
long a lock is held is a policy the consumer owns.

The full account, with the Eclipse trace and a `try/finally` example, is in
[CLIENT_API_REFERENCE.md](CLIENT_API_REFERENCE.md#service-bindings-publishing-is-the-editing).

## Message classes: the messages are rows

The other place the flow does not hold, and for a different reason. A message
class is a container and its messages are rows in it — addressable, lockable,
and with no write of their own. Measured from a full run, creating, updating and
deleting message `001` are **indistinguishable on the wire**: all three are the
same PUT of the whole class, differing only in the body.

```
GET  …/messageclass/zac_msg01                            read the class whole
GET  …/messageclass/zac_msg01                            again, for read-modify-write
POST …/messages/001?_action=LOCK_MSG&accessMode=MODIFY   lock the row
POST …?_action=LOCK&accessMode=MODIFY&msgNo=001&onSave=X lock the container, naming the row
PUT  …?lockHandle=…&corrNr=…                             write the class whole
POST …?_action=UNLOCK&lockHandle=…                       release the container
POST …/messages/001?_action=UNLOCK_ALL                   release the row
```

Two locks per write, taken in that order and released in reverse, and the
container's lock is told which row is being saved. So a member that edits one
message reads and rewrites the whole class, which is why a handful of message
operations produce a great many class reads.

**Only the container exists.** The class answers 404 before it is created and
404 after it is deleted, and 200 in between — ordinary. A row has no existence
of its own: in the trace above, `LOCK_MSG` on `messages/001` answers `200`
*before* message 001 exists, because the PUT on the next line is what creates
it. There is nothing to ask about a row, so nothing refuses.

This is why `getMessageClassMessage().read()` decides for itself: it fetches the
class document and looks for the number, answering `OBJECT_NOT_FOUND` when it is
not among the messages. That verdict is this library reading content, not SAP
reporting absence — and a consumer replacing the reading replaces the verdict
with it.

The third exception is the **transport request**, which is not a locked object at
all: it is changed and deleted directly.

## What a bare `create()` actually leaves, per type

A POST sometimes builds a minimal working object and sometimes builds nothing.
Which one you get is a property of the type, and it is not guessable — measured
on a cloud system by creating each and asking every way of reading it:

| Type | What the POST left | A read straight after |
|---|---|---|
| `domain` | a complete object — the create carries the content | 2067 bytes |
| `interface` | a generated skeleton | 53 bytes |
| `class` | a generated skeleton | **refused**, `400`, "wrong input data" |
| `ddl` | an object with no content | `200`, empty |
| `serviceDefinition` | **nothing — the create itself is refused** | — |

`serviceDefinition` is the clearest case of the second kind: there is nothing to
generate a service from, so the POST answers *"Check of condition failed"* and
no object is made. `program` could not be measured here — an ABAP Cloud system
refuses it outright with `S_DEVELOP`.

### The class has a skeleton; you just cannot read it yet

The class row above is the one to be careful with, because the refusal invites
the wrong conclusion. SAP *did* generate a minimal class. It is stored as the
active version, and it becomes readable the moment the first source is written:

```
GET …/source/main?version=active    200   class ZAC_PROBE_INACT definition      ← SAP's, lower case
GET …/source/main?version=inactive  200   CLASS zac_probe_inact DEFINITION …    ← ours, as written
```

Before that first write, every read refuses — `active`, `inactive`, neither,
metadata, source. And nothing else lifts it:

```
create              ok
read after create   refused, wrong input data
read after 30s      refused                       ← not timing
lock                ok
read while locked   refused
read after unlock   refused                       ← not the lock either
```

So the object is not empty and it is not broken. It is unfinished, and the first
`update()` is what finishes it. Activation is a separate matter again: it
promotes what you wrote into the active version, replacing the skeleton.

**`getVersions()` will not tell you any of this.** It answers `ok` in every state
above, listing version slots rather than content — `99999` for the inactive,
`00000` for the active — so it reports two entries for the class nothing can
read. The count drops to one when activation consumes the inactive slot, which
is real but is not an answer to "is there anything to read".

## The name is taken from the POST onward, and `validate()` may not say so

Whatever the create leaves behind, it holds the name. A second create is refused
for every type measured — *"Resource Data Definition ZAC_X does already exist."*

`validate()` does answer it — that is what it is for — but the answer arrives
two ways, and one of them was being dropped. Measured across seven types:

| Type | How a taken name is refused |
|---|---|
| `domain`, `structure`, `table`, `class`, `serviceDefinition` | a failing status |
| `functionGroup`, `ddl` | **`200`** carrying `<SEVERITY>ERROR</SEVERITY>` |

Only the function group was reading that body, so `getDdl().validate()` answered
"fine" for a name the system had already rejected. Fixed: `validationRefusal` is
the shipped default on every `validate()` now, and it is deliberately narrow — a
`200` without `<SEVERITY>ERROR</SEVERITY>` stays a success.

What `validate()` does **not** answer is whether the object exists: a name that
is free validates fine whether or not anything was ever created under it. For
existence, read.

**Which is why an abandoned create is worth cleaning up.** A create that failed
partway, or one whose source was never written, leaves a name that nothing else
can use and — for a class — an object that no read can see. `deleteOnFailure` in
the operation options exists for the first case; the second is yours to notice.

## Absence does not have one wording

Deleting each object and reading it again produced three different sentences:

```
domain     Error while importing object ZAC_UNFIN_DOM from the database
interface  Resource INTERFACE ZAC_UNFIN_INTF does not exist.
ddl        Data definition ZAC_UNFIN_DDLS of version  does not exist
```

All three are refusals and all three mean the same thing. None of them is worth
matching on: the text is the server's, it is language-dependent, and it varies
by type. If you need to branch on absence, branch on the failure your own
`analyse` decided, not on the sentence.

Reproduce with `npx ts-node scripts/probe-inactive-metadata.ts` and
`npx ts-node scripts/probe-unfinished-create.ts`.
