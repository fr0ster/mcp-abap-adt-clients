# Workarounds for SAP-side behaviour

This document collects behaviour of the SAP system and its ADT endpoints that a
consumer has to work around. Each case is **surprising, not a defect of this
library**, and has a **workaround on the consumer side**. The knowledge used to
be scattered across guides and code comments; it lives here now, and the other
documents link to it.

What belongs here:

- the SAP system or an ADT endpoint does something a caller would not expect —
  a refusal inside a `200`, a message that names the wrong cause, a state that
  outlives the request that made it;
- the behaviour was **measured** against a running system, or is documented by
  SAP — every entry says which, where and when;
- there is something a consumer can do about it.

What does not: defects of this library (those are issues and fixes), and
general API documentation ([CLIENT_API_REFERENCE.md](CLIENT_API_REFERENCE.md),
[OBJECT_LIFECYCLE.md](OBJECT_LIFECYCLE.md)).

**Why the workaround is always yours.** Every member of this library issues
exactly one ADT request on the connection it was given, and interprets nothing
(Decision 15 in [DECISIONS.md](../architecture/DECISIONS.md)). It does not open
a second session, retry, poll or judge an answer on your behalf. Where a
workaround needs a reading, `@mcp-abap-adt/adt-strategies` usually has one, and
each entry names it.

Every entry has the same sections: **Symptom** (what the caller sees),
**Cause**, **Rule**, **Workaround**, **Evidence** and **Where it bites**.

## Contents

Sessions and locks

1. [A package can be saved only once per ABAP session](#a-package-can-be-saved-only-once-per-abap-session) — PAK/058
2. [The session-type header is per request](#the-session-type-header-is-per-request)
3. [A class include is written under the class lock](#a-class-include-is-written-under-the-class-lock)
4. [A service binding is locked to publish it](#a-service-binding-is-locked-to-publish-it)

Reading answers

5. [A refusal can arrive with a 2xx, and an error status names the fix](#a-refusal-can-arrive-with-a-2xx-and-an-error-status-names-the-fix)
6. [A read answers 200 with an empty body instead of 404](#a-read-answers-200-with-an-empty-body-instead-of-404)
7. [A successful delete can carry an untyped message](#a-successful-delete-can-carry-an-untyped-message)
8. [S_ABPLNGVS refuses a create into a package that does not exist](#s_abplngvs-refuses-a-create-into-a-package-that-does-not-exist)

Creating and checking objects

9. [What a bare create leaves depends on the type](#what-a-bare-create-leaves-depends-on-the-type)
10. [A check run compiles source for objects that do not exist](#a-check-run-compiles-source-for-objects-that-do-not-exist)

Activation

11. [activationExecuted false is not a failure](#activationexecuted-false-is-not-a-failure)
12. [Activation settles inside the POST](#activation-settles-inside-the-post)

Transports

13. [The transport list is a saved-configuration search](#the-transport-list-is-a-saved-configuration-search)
14. [The transport tree has no fixed nesting](#the-transport-tree-has-no-fixed-nesting)
15. [A hand-made task is Unclassified and refuses objects](#a-hand-made-task-is-unclassified-and-refuses-objects)

ATC

16. [ATC takes its check variant from customizing](#atc-takes-its-check-variant-from-customizing)

---

## A package can be saved only once per ABAP session

**Symptom.** In an ABAP session that has already saved a package:

- a second `updateMetadata()` of it answers
  `400 ExceptionResourceAlreadyExists`, T100 `PAK/058`, *"Package <PACKAGE>
  is already locked"*;
- a `delete()` of it answers **`200`** carrying `isDeleted="false"` and the same
  `PAK/058`, while `checkDeletion()` just before it answered
  `isDeletable="true"`.

The message says *locked*, but the package is not enqueue-locked: the `LOCK`
that preceded the failing `PUT` answered `200`, and Eclipse reports the package
as in use elsewhere. Retrying in the same session never succeeds — retried for
30 seconds it still answered `PAK/058` — and the same request from a new
session succeeds at once, while the first session is still open.

**Cause.** `PAK/058` has one source, `CL_PACKAGE->IF_PACKAGE~SET_CHANGEABLE`,
and it checks `m_lock_state` on the **in-memory package instance**, not an
enqueue lock. `CL_PACKAGE` keeps those instances in a static buffer that lives
as long as the ABAP session. The ADT create and the ADT update both end in
`M_SAVE`, which leaves the instance in state `requested`. The next update or
delete loads the package through `load_package`, gets the buffered instance
back without reading the database, and `set_changeable` refuses. Nothing inside
the session resets it: no `CL_PAK_ADT_*` class calls
`set_changeable( abap_false )` or `undo_all_changes`.

It is neither the lock handle nor the enqueue lock: a made-up handle is refused
differently (`423 ExceptionResourceInvalidLockHandle`, `SADT_RESOURCE/026`), a
second `LOCK` is refused under a different message (`403
ExceptionResourceNoAccess`, `EU/510`), and a separate session updates the
package while the first still holds its buffered instance.

**Rule.** A package can be saved — created, updated or deleted — **only once
per ABAP session**.

- **RFC:** every call shares the connection's one session, so the rule applies
  from the create onward — an update straight after the create is refused.
- **HTTP:** the create is a stateless request whose session and buffer end with
  it, so it does not count. **Every stateful lock → update → unlock does**: a
  second update in the same stateful session is refused, and so is a delete
  from a session that updated the package.

**Workaround.** Run every stage that saves a package in an ABAP session no
earlier stage has saved it in:

- **Create:** over RFC, on a new connection. Over HTTP it is already stateless.
- **Lock → update → unlock:** the whole chain on a new connection. The lock
  handle belongs to the session that took it, so the chain cannot be split
  across sessions. Close the connection after the unlock, whatever the unlock
  answered — ending the session also releases its enqueue.
- **Delete:** on a new connection, or on a session that has never saved the
  package.

`IAbapConnection` has no `connect`-a-new-session or `disconnect`, on purpose:
the connection is the caller's and usually shared. Opening and closing sessions
is done on your concrete connector:

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';

// Yours: a connection with an ABAP session of its own, on your connector.
declare function openSession(): Promise<
  IAbapConnection & { disconnect(): Promise<void> }
>;

async function savePackage(packageName: string, document: string) {
  const connection = await openSession();
  try {
    const pkg = new AdtClient(connection).getPackage();
    const locked = await pkg.lock({ packageName });
    if (!locked.ok) throw new Error(locked.getError().message);
    const lockHandle = locked.getResult().value;
    try {
      const saved = await pkg.updateMetadata(
        { packageName },
        { source: document, lockHandle },
      );
      if (!saved.ok) throw new Error(saved.getError().message);
    } finally {
      await pkg.unlock({ packageName }, lockHandle);
    }
  } finally {
    // Ends the session, its package buffer and its enqueue with it.
    await connection.disconnect();
  }
}
```

A delete that should read `isDeleted="false"` as a failure passes
`analyseDeletion` from `@mcp-abap-adt/adt-strategies`; without it the `200` is
a success carrying the document.

**Evidence.** Issue [#176](https://github.com/fr0ster/mcp-abap-adt-clients/issues/176)
and its comments. The cause was read from the ABAP code of an on-premise system.
Measured on an on-premise system:

- 2026-08-31, HTTP: a delete from the session that updated the package answered
  `isDeleted="false"`, `PAK/058`, retried for 30 seconds; one second after the
  session ended the same request deleted it.
- 2026-09-26, one session throughout, both transports (a test package):

  | step | HTTP | RFC |
  | --- | --- | --- |
  | create | 200 | 200 |
  | `_action=LOCK` | 200, handle | 200, handle |
  | `PUT` with a made-up handle | 423 `SADT_RESOURCE/026` | same |
  | a second `_action=LOCK` | 403 `EU/510` | same |
  | `PUT` with our handle | **200** | **400 `PAK/058`** |
  | `_action=UNLOCK` | 200 | 200 |
  | `deletion/check` | `isDeletable="true"` | `isDeletable="true"` |
  | `deletion/delete`, same session | **`isDeleted="false"`, `PAK/058`** | **`isDeleted="false"`, `PAK/058`** |
  | `deletion/delete`, a new session | `isDeleted="true"` | `isDeleted="true"` |

- 2026-09-26, RFC, four connections: an update in a new session B answered
  `200`, the same update again in B answered `400 PAK/058`, a delete in B
  `isDeleted="false"`; a new session C updated the package while A and B were
  still open; a new session D deleted it.
- 2026-09-27, HTTP, one connection held across calls as an MCP server holds it:
  the first lock → PUT → unlock answered OK, the second in the same stateful
  session `400 PAK/058`; two more chains, each on a new connection, both OK; the
  delete from the stateful session `PAK/058`, from a new connection
  `deleted: true`.

mcp-abap-adt applies this workaround in its package tools (its PR #230); its
package integration test (create → two updates → delete) passes on both
transports, where the second update used to fail on both.

**Where it bites.** `getPackage()`: `create`, `updateMetadata`, `delete`
(`lock` and `unlock` themselves answer `200`). This library's package
integration test replaces its session before the update and again before the
delete (`recycleTestSession()`); see
[RFC_TESTING.md](../development/RFC_TESTING.md#packages-one-save-per-abap-session).

---

## The session-type header is per request

**Symptom.** None by itself — the trap is a wrong belief: that a request sent
without `x-sap-adt-sessiontype: stateful` ends the stateful session and loses
the lock taken in it.

**Cause.** `x-sap-adt-sessiontype: stateful` is a per-request instruction
("handle this call inside a stateful ABAP session"), not a session-wide switch.
Session membership rides on the session cookie (`sap-contextid` /
`SAP_SESSIONID`); `sap-adt-connection-id` identifies the conversation.

**Rule.** Omitting the header does not close a session. Eclipse sends it only
on `LOCK` and `UNLOCK`; the read after the lock, the lock-bound `PUT`, check
runs and activation go without it, carrying only the cookie, and the lock
survives.

**Workaround.** Mark only the lock and the unlock stateful — which is what
`lock()` and `unlock()` do — and send the write in between with the handle and
the same session cookie. Do not send the header with an explicit `stateless`
value: that case was never measured, and `@mcp-abap-adt/connection` never does
it (it omits the header when the mode is stateless).

**Evidence.** Eclipse ADT logs, 2026-07-27: the header only on `LOCK` and
`UNLOCK`. A full run of this library against the cloud trial: 803 requests,
exactly 100 with the header — the 50 `LOCK`s and 50 `UNLOCK`s
([STATEFUL_SESSION_GUIDE.md](STATEFUL_SESSION_GUIDE.md)).

**Where it bites.** Every `lock` / `update` / `unlock` sequence; any consumer
that manages `setSessionType()` itself.

---

## A class include is written under the class lock

**Symptom.** A caller looks for a lock on a local include — test classes, local
types, definitions, macros — and either finds none or takes one that is not the
one ADT checks the write against.

**Cause.** A class's local includes are sections of the global class, not
objects of their own. ADT writes them under the **parent class's** lock:
`POST /sap/bc/adt/oo/classes/{name}?_action=LOCK&accessMode=MODIFY`, then
`PUT /sap/bc/adt/oo/classes/{name}/includes/testclasses?lockHandle=…`. One
handle serves every include, and the write goes out stateless. Whether an
include-level `LOCK` endpoint exists was never verified.

**Rule.** Lock the class; write the include with the class's handle. An include
is not deleted — it is emptied.

**Workaround.** `getClass().lock()`, then `update()` on
`getLocalTestClass()` / `getLocalTypes()` / `getLocalDefinitions()` /
`getLocalMacros()` with that handle in `options.lockHandle`, then
`getClass().unlock()`. To remove an include's content, write an empty source.
Mind the names: Eclipse's *Local Types* editor writes `includes/implementations`
(`getLocalTypes()`), and *Class-relevant Local Types* writes
`includes/definitions` (`getLocalDefinitions()`) — see
[OBJECT_LIFECYCLE.md](OBJECT_LIFECYCLE.md#which-class-include-is-which).

**Evidence.** Eclipse ADT 3.60.3 traffic against one system: `PUT
…/includes/implementations?lockHandle=4E23…` and `PUT
…/includes/definitions?lockHandle=4E23…`, the same class handle, both `200`,
stateless. The include-level `LOCK` endpoint has never been probed.

**Where it bites.** `getLocalTestClass()`, `getLocalTypes()`,
`getLocalDefinitions()`, `getLocalMacros()`, `getUnitTest()`.

---

## A service binding is locked to publish it

**Symptom.** A service binding will not delete — *"You are already editing
<SERVICE_BINDING>"* — or `_action=LOCK` from another process answers
`403 ExceptionResourceNoAccess`, *"User … is currently editing"*. Recycling
your own session does not clear it.

**Cause.** A service binding is not edited; it is created once and then
published and unpublished, and its ADT lock exists for those two operations.
Eclipse takes the lock on a dedicated long-lived stateful "enqueue" session,
keeps that session alive, and unlocks **when the editor closes**, not when the
publish job finishes. An open Eclipse editor on the binding holds the lock for
the same user from a different session.

**Rule.** The lock spans an editing session. From elsewhere, a held lock looks
like a 403; it is usually someone's open Eclipse, not a leaked lock.

**Workaround.** For a library there is no editor, so the edit is the operation:
`lock()`, `update()` with the desired publication state, `unlock()` in a
`finally`. The publish job took about 133 seconds on the systems measured,
above the 120 s default — pass a larger `timeout`. Read the job's own answer
(`analysePublication` from `@mcp-abap-adt/adt-strategies` reads its
`SEVERITY`); nothing needs polling. For a binding locked elsewhere, close the
Eclipse editor that holds it. The full example is in
[CLIENT_API_REFERENCE.md](CLIENT_API_REFERENCE.md#service-bindings-publishing-is-the-editing).

**Evidence.** Eclipse ADT 3.60.3 against the BTP trial, 2026-09-05:
`LOCK` → `200` on session *"stateful, enqueue"*; `POST
…/odatav4/publishjobs` → `200` stateless, 133 057 ms; `UNLOCK` → `200` on
*"Closing editor"*; a second `LOCK` before the unpublish → `403` while the
first was held.

**Where it bites.** `getServiceBinding()`: `lock`, `update`, `delete`.

---

## A refusal can arrive with a 2xx, and an error status names the fix

**Symptom.** A deletion check, an activation or a validation answers **`200`**
and the object was refused. In the other direction, a `406` or `415` whose
number says nothing actionable.

**Cause.** In ADT the status is about the channel; the document is the verdict.
There are at least three refusal shapes, and they are not interchangeable:

| shape | resource |
|---|---|
| `<exc:exception>` | most resources, any status including 200 |
| `<del:message del:type="E">` in `del:checkResponse` | `/deletion/check` |
| `<msg type="E">` in `chkl:messages` | `/activation` |

An error status carries the fix in its text: a `406` answered *"Accepted
content types: application/vnd.sap.adt.deletion.check.response.v1+xml"*, a
`415` *"Supported Media Types: …check.request.v1+xml"*. And the text is SAP's
own even when it misleads — `PAK/058` says *"already locked"* about a package
that is not enqueue-locked (see
[the first entry](#a-package-can-be-saved-only-once-per-abap-session)).

**Rule.** Read the document, not the status. A `LOCK`'s `Accept` is matched on
the base type only (`dataname` does not participate), so a `423` on a `LOCK` is
a real enqueue, never content negotiation in disguise.

**Workaround.** Pass the reading for the form you expect, from
`@mcp-abap-adt/adt-strategies`: `analyseDeletion`, `analyseActivation`,
`analyseCheck`, `analyseValidation`, `analyseException`; `analyseAny`
dispatches on the root element when the form is not known. For a `406`/`415`,
take the content type from the message text. Accept negotiation on `406` is
done by the library unless `enableAcceptCorrection` is `false`.

**Evidence.** On a cloud trial, five of seven probed operations reported no
error while SAP had refused, three of them writes. Cloud trial, 2026-09-03:
`/deletion/check` → `200`,
`del:isDeletable="false"` with a `del:message del:type="E"`; the `406` and `415`
texts above. 2026-09-22, `scripts/probe-lock-accept.ts`, three `LOCK`s on one
class: the library's `Accept` → `200`, a misspelt `dataname` → `200`,
`application/json` → `406`, *"Accepted content types:
application/vnd.sap.as+xml"*, `SADT_RESOURCE/044`. The recorded answers are in
[ANSWER_SHAPES.md](ANSWER_SHAPES.md). Issues #136 and #137.

**Where it bites.** Every member; most visibly `checkDeletion`, `delete`,
`activate`, `validate`, `check`.

---

## A read answers 200 with an empty body instead of 404

**Symptom.** A read answers **`200` with zero bytes**. `source/main` never
answers `404`: it does this for an object created but never activated, and for
one just deleted. A metadata read of an object that is not ready yet does the
same. A read-modify-write built on it fails with a message pointing nowhere near
the cause:

```
GET  → 200, empty body
PUT  → 400: The description is missing for <DOMAIN>
```

**Cause.** ADT answers absence, and not-yet-ready, with an empty success. The
varying response time of the ABAP system is the trigger for the not-ready case.

**Rule.** The status cannot tell "not there" from "there and empty". Compare
content, not status: during an update of an active object, `version=active`
answers the pre-update source and `version=inactive` what the `PUT` just wrote.
An **empty element** is not a missing one — ADT writes `<doma:valueTableRef/>`
for a domain with no value table and `<pak:superPackage/>` for a package with
no parent, and a patch must add the attribute there, not treat it as an error.

**Workaround.** Before a read-modify-write, reject an empty body rather than
patching it; after a write, read the version you wrote and compare it with what
you sent. `updateMetadata()` replaces the whole document and reads nothing, so
the read before it is yours and so is this check. For the package walkers
(node structure, package contents), whose empty answer is identical for an
empty package and a missing one, `isIndeterminateWalkAnswer` from
`@mcp-abap-adt/adt-strategies` says the answer is indeterminate — ask
`getPackage().readMetadata()` (404 for a missing package) first.

**Evidence.** Cloud trial, 2026-07-16 (PR #70):
`GET /sap/bc/adt/ddic/srvd/sources/{name}/source/main?version=active` → `200`,
empty, for a never-activated and for a deleted service definition. Seen live
2026-08-06 on a domain read-modify-write (the failure chain above). The package
walkers' empty answers are in the corpus
([ANSWER_SHAPES.md](ANSWER_SHAPES.md#two-answers-that-are-indistinguishable)).

**Where it bites.** `read` of source-based types (`getServiceDefinition()`,
`getDdl()`, …); `readMetadata` before an `updateMetadata` of `getDomain()`,
`getDataElement()`, `getPackage()`, `getTableType()`, `getFunctionGroup()`;
`getUtils()` node-structure reads.

---

## A successful delete can carry an untyped message

**Symptom.** `deletion/delete` answers `isDeleted="true"` together with one
`del:message` whose `del:type` is **empty** and whose text is **`S::000`**, with
a long-text link naming no message class
(`/sap/bc/adt/messageclass//messages/000/longtext`). A reading that takes an
untyped message as an error reports the delete as refused — the object is gone.

**Cause.** SAP attaches a placeholder message to the deletion result of a CDS
source.

**Rule.** Only a message SAP typed `E`, or a verdict attribute that is not
`"true"`, is a refusal. An untyped message does not overturn an explicit
`isDeleted="true"`; on an object that *was* refused, the same message still
belongs to the explanation.

**Workaround.** Use `analyseDeletion` (or `readDeletionRefusal`) from
`@mcp-abap-adt/adt-strategies` 0.5.0 or later, which reads it this way. A reading
of your own must not default an empty `del:type` to `E` when the verdict is
`"true"`.

**Evidence.** An on-premise system and a cloud ABAP environment, 2026-09-26: a DDLS delete
answered `isDeleted="true"` with the `S::000` message, and the object was gone
on the next read. The recorded document is the fixture in
`packages/adt-strategies/src/__tests__/readings.test.ts`
(*"an untyped placeholder message does not overturn isDeleted="true""*);
`packages/adt-strategies/CHANGELOG.md` [0.5.0].

**Where it bites.** `getDdl().delete()`; `getUtils().deleteObjectsGroup()` over
CDS sources; any deletion reading.

---

## S_ABPLNGVS refuses a create into a package that does not exist

**Symptom.** A create answers `403 ExceptionResourceNoAccess`, *"You are not
authorized to make changes (authorization object S_ABPLNGVS)"*.

**Cause.** `S_ABPLNGVS` is not a role but the authorization object for the ABAP
**language version** (`ABP_LNG_VS`, with `ACTVT` per operation). It is raised
wherever the language version cannot be satisfied — including when the package
in the request does not exist: with no package there is no software component,
so no language version to check against, and the refusal surfaces as an
authorization failure instead of "package not found".

**Rule.** The sentence is accurate about the object it checked and still not
necessarily the reason the request failed. The check applies only when the SACF
scenario `ABAP_LANGUAGE_VERSION` is switched on.

**Workaround.** Before going to PFCG, check that the package in the request
exists and that its software component allows the language version you are
writing; then that the user holds that value in `ABP_LNG_VS` and the `ACTVT` for
the step that failed. The authorization side is explained in
[TROUBLESHOOTING.md](TROUBLESHOOTING.md#you-are-not-authorized-to-make-changes-authorization-object-s_abplngvs).

**Evidence.** Cloud trial, 2026-09-03: a class create into a package that did
not exist answered this refusal. The meaning of the object is SAP's
authorization concept, as explained by the maintainer the same day.

**Where it bites.** Every `create`, most often `getClass().create()` with a
mistyped `packageName`.

---

## What a bare create leaves depends on the type

**Symptom.** Straight after `create()`, a read of a **class** answers
`400 ExceptionResourceWrongData`, `SADT_RESOURCE/007`, *"Resource  <CLASS>: wrong
input data for processing"* (note the double space) — for `active`, `inactive`,
metadata and source alike. Waiting 30 seconds does not help, and neither does
lock + unlock. Other types answer differently, and a service definition's
create is refused outright with *"Check of condition failed"*.

**Cause.** What the POST leaves is a property of the type:

| type | what the POST left | read straight after |
|---|---|---|
| `domain` | complete — content is in the create | 2067 bytes |
| `interface` | generated skeleton | 53 bytes |
| `class` | generated skeleton | **refused** `400 ExceptionResourceWrongData` |
| `ddl` | object, no content | `200`, empty |
| `serviceDefinition` | **nothing — the POST is refused** | — |

The class does have a skeleton; it becomes readable at the first source write
(`version=active` → SAP's `class <CLASS> definition`, `version=inactive` → what
you wrote).

**Rule.** A read straight after a create proves nothing portable. Two checks
look like existence checks and are not: `getVersions()` answers ok in every
state (it lists slots `99999` inactive and `00000` active, two of them even for
the unreadable class), and `validate()` answers neither "name is free" nor
"object exists" — the name is held from the POST onward regardless. Absence has
three wordings (*"Error while importing object … from the database"*,
*"Resource INTERFACE … does not exist."*, *"Data definition … of version  does
not exist"*); do not match on the text.

**Workaround.** After creating a class, write its source; do not retry the read.
The first check worth making is after the write: read the version you wrote and
compare. A service definition is created with its source in the same flow, not
bare. If a sequence stops between the POST and the write, `delete()` the object
while it is still bound to its package.

**Evidence.** Cloud trial, 2026-09-05, `scripts/probe-unfinished-create.ts` and
`scripts/probe-inactive-metadata.ts` (the table above). `program` could not be
measured there — an ABAP Cloud system refuses it with `S_DEVELOP`. The class, in
order:

```
create              ok
read after create   refused, wrong input data
read after 30s      refused                       ← not timing
lock                ok
read while locked   refused
read after unlock   refused                       ← not the lock either
first source write  ok
read active         200   class <CLASS> definition      ← SAP's skeleton
read inactive       200   CLASS <class> DEFINITION …    ← as written
```

**Where it bites.** `create` then `read` / `readMetadata` on `getClass()`,
`getInterface()`, `getDdl()`, `getDomain()`; `getServiceDefinition().create()`;
`getVersions()` and `validate()` used as readiness checks.

---

## A check run compiles source for objects that do not exist

**Symptom.** A check of a name that does not exist answers `200` with no
messages — which reads exactly like clean code when you count messages. For
other types, the same check compiles the source you sent and reports its
findings, although the object is not in the system.

**Cause.** `POST /sap/bc/adt/checkruns?reporters=abapCheckRun` with source in
the `chkrun:artifact` compiles that source **for some types even when the object
is absent**; for the others the check never runs, and a check that never ran
carries no message list at all.

| outcome | types |
|---|---|
| compiled without the object | `program`, `function_group`, `table`, `structure`, `metadata_extension`, `service_definition`, `scalar_function` |
| refused for absence (`notProcessed`) | `class`, `interface` (*"Resource CLASS … does not exist."*), DDL source (*"Data definition … of version  does not exist"*), `transformation` |
| payload refused, undetermined | `access_control`, `domain`, `data_element` |

**Rule.** The verdict is `chkrun:status`, never the message count:
`processed` = compiled, `notProcessed` = the check never ran. The version
(`new`, `inactive`, `active`) makes no difference when a source is supplied.

**Workaround.** Pass `analyseCheck` from `@mcp-abap-adt/adt-strategies`, which
reads the status first and messages only for a `processed` report; a reading of
your own must do the same. Do not take a clean check as proof the object exists.

**Evidence.** Cloud trial, 2026-09-05, `scripts/probe-checkrun-without-object.ts`
(with `PROBE_EXISTING_CLASS` as the control: the same class source for an
existing class is checked under all three versions) and
`scripts/probe-checkrun-version.ts`. The recorded pair is in
[ANSWER_SHAPES.md](ANSWER_SHAPES.md#two-answers-that-are-indistinguishable).

**Where it bites.** `check()` on every type that has one.

---

## activationExecuted false is not a failure

**Symptom.** `POST /sap/bc/adt/activation` answers **`200` even on failure**, and
`activationExecuted="false"` comes back for an object that is fine. A class that
does not exist answers `200` with `<msg type="E">` *"Class <CLASS> does not have
a TMDIR entry"* (`OO(045)`, beside an informational `EU(239)`).

**Cause.** The flag says whether ADT did any work, not whether the work
succeeded. An object needing no activation answers `false` with an empty message
list; a DDIC table re-activates unconditionally and answers `true`. A lock held
by another session is rejected before this document exists, with `403`
*"User … is currently editing …"*.

| scenario | HTTP | `activationExecuted` | `msg` |
|---|---|---|---|
| class already active | 200 | `false` | none |
| DDIC table already active | 200 | `true` | none |
| class does not exist | 200 | `false` | `E`, *"does not have a TMDIR entry"* |
| locked by another session | **403** | — | — |

**Rule.** Only an error-severity `<msg>` is a failure. `false` with no message
is "nothing to do". Per-type reasoning about the flag is worthless. The `TMDIR`
message means *absent*, not corrupt; waiting never helps it.

**Workaround.** Pass `analyseActivation` from `@mcp-abap-adt/adt-strategies`,
which reads exactly this table. Handle the `403` as a lock held elsewhere.

**Evidence.** Cloud trial, 2026-08-06 (the table); 2026-09-16, the no-op answer
(`activationExecuted="false"`, no messages) for a class activated twice and for
a function group straight after its create. Fixtures
`refusal-activation-fails`, `activation-success-verdict`,
`activation-nothing-to-activate` in `corpus/adt/`.

**Where it bites.** `activate()` on every type; `getUtils()` group activation.

---

## Activation settles inside the POST

**Symptom.** An object is still on the inactive list after an activation that
answered well, and it looks like the activation has not settled yet.

**Cause.** `POST /sap/bc/adt/activation` is synchronous — its effect is visible
on the next read. "Still listed" is scope: creating a function-group include
puts three entries on the list (`FUGR/F <group>`, the include, the regenerated
`SAPL<group>`). Activating the group clears only `SAPL<group>`; activating the
include clears the include and the group's own entry with it. The asynchronous
protocol is a different endpoint, `/sap/bc/adt/activation/runs` (`201` with the
run id in `Location`), with `/activation/results`.

**Rule.** No polling is needed after `/activation`; read the inactive list at
once. The only answer to "is it active now" is that list, not the activation's
`ok`.

**Workaround.** After `activate()`, read `getUtils().getInactiveObjects()` and
activate what is still listed — the parts before the container. For a
background run use `activateObjectsGroup()` / `getActivationRun()` /
`getActivationResults()`. On a cloud ABAP environment, activating a function group can leave
`FUGR/F <group>` listed with a "nothing to do" answer
(`activationExecuted="false"`, `generationExecuted="true"`, no messages); on
premise both entries cleared. That difference is unsettled.

**Evidence.** Cloud trial, 2026-09-22, `scripts/probe-activation-settle.ts`,
four runs, 44 reads of `/activation/inactiveobjects`: nine cycles answered
`activationExecuted="true"` in 748–1386 ms and the include was off the list on a
read 526–965 ms later, 9 of 9; activating the include cleared the group's entry
3 of 3. The on-premise observation is PR #157's.

**Where it bites.** `activate()` on `getFunctionGroup()` and
`getFunctionInclude()`; `getUtils().getInactiveObjects()`.

---

## The transport list is a saved-configuration search

**Symptom.** `GET /sap/bc/adt/cts/transportrequests` answers `200` with a bare
`<tm:root/>` (309 bytes) — for `?user=`, `?status=`, the server's own property
names, and for no parameters at all — while requests exist.

**Cause.** The endpoint is not a filtered list. It runs a **saved search
configuration**, referenced by URI. The collection and an item are different
resources with different content types: the collection accepts only
`application/vnd.sap.adt.transportorganizertree.v1+xml`, an item
(`/cts/transportrequests/<NR>`) only
`application/vnd.sap.adt.transportorganizer.v1+xml`. Discovery advertises the
item type on the collection, so sending it there answers `406`.

**Rule.** Reference a configuration; do not restate filters. An empty
`tm:root` is not an error — it is a search that found nothing, or a search that
was not given.

**Workaround.** `getRequest().searchConfigurations()`, pick a configuration by
what you know about your system, then `list({ configUri })` — required since
23.0.0. Keep the URI; it does not change between runs. Filtering is a property
of the saved configuration, maintained in Eclipse. The legacy endpoint
(`AdtRequestLegacy`) is not a saved search and takes no `configUri`.

**Evidence.** Cloud trial, 2026-08-07: the empty root for every filter form
while 15 requests existed; `?configUri=<href>` → 137 KB, 16 `tm:request`, the
same minute. Both content types captured from `406` bodies. PR #106.

**Where it bites.** `getRequest().list()`, `searchConfigurations()`.

---

## The transport tree has no fixed nesting

**Symptom.** A parser written against one captured transport tree finds no
requests in another.

**Cause.** The container chain depends on the query. `?configUri=` alone
answers `tm:workbench > tm:modifiable > tm:request`; `?targets=true&configUri=`
(what Eclipse sends) inserts `tm:target` in between, carrying a human name
(*"Local Change Requests"*) the request does not have. `tm:task` nests inside
`tm:request`, with `tm:parent` pointing at it.

**Rule.** Walk to `tm:request` and `tm:task` by element name, never by a fixed
path.

**Workaround.** Use `transportTree` from `@mcp-abap-adt/adt-strategies`, whose
`containers` is an ordered list walked by name; a reading of your own must do
the same. This library sends `?configUri=` alone; `targets=true` is not sent.

**Evidence.** Eclipse ADT 3.60.0 against a cloud ABAP trial, 2026-08-11 — the user's
captured request/response trace — against this library's own probe of
2026-08-07, which never saw `tm:target`.

**Where it bites.** `getRequest().list()` and any reading of its document.

---

## A hand-made task is Unclassified and refuses objects

**Symptom.** `addObject()` onto a task created with `createTask()` is refused
with `SCTS_ADT_MSG 009`, long text `TK127`. Every task reads back as
`Unclassified`, whatever `tm:type` was passed to `newtask`.

**Cause.** In the normal CTS edit flow — changing an object not yet on a
request, in a package that requires one — the system creates or picks the
request and creates or types the task itself. A request and task created **by
hand** (`newtask`) leave the task untyped, and SAP documents that an
Unclassified task takes no objects: *"You cannot add any objects if the task
type is Unclassified. You need to change the task type to
Development/Correction or Repair."*
([Changing a Task Type](https://help.sap.com/docs/ABAP_Cloud/bbcee501b99848bdadecd4e290db3ae4/36fa0d5b537d499ab361d862bcfa51ce.html)).

**Rule.** Type a hand-made task before adding objects to it directly.

**Workaround.** `changeTaskType(task, 'S')` (Development/Correction) or `'R'`
(Repair) after `createTask()`, then `addObject()`. `createTask()` also needs
`targetUser`; without it the owner resolves to an empty name and the call is
refused (`400 SCTS_ADT_MSG 009`, *"User  does not exist in the system (or
locked)"*).

**Evidence.** SAP Help, quoted above. Measured on premise, 2026-09-25:
`addObject()` onto a fresh Unclassified task refused with `SCTS_ADT_MSG 009` /
`TK127`; after `changeTaskType(task, 'S')` the same call answered `200`. BTP
trial, 2026-09-23: every task read `Unclassified` — that trial has no transport
system configured, so every request and task on it is hand-made.

**Where it bites.** `getRequest()`: `createTask`, `addObject`,
`changeTaskType`.

---

## ATC takes its check variant from customizing

**Symptom.** `/sap/bc/adt/atc/variants` answers `totalItemCount 0`, and a
findings read with a `checkstyle` `Accept` answers `406`.

**Cause.** On a cloud ABAP environment the variant a run uses is the system's, delivered by
`POST /sap/bc/adt/atc/customizing` (`systemCheckVariant`, there
`ABAP_CLOUD_DEVELOPMENT_DEFAULT`). The worklist has exactly one representation:
the `406` says *"Accepted content types: application/atc.worklist.v1+xml"*.

**Rule.** Resolve the variant from customizing; read findings as
`application/atc.worklist.v1+xml` only.

**Workaround.** `getAtc().resolveCheckVariant()` and read it with
`atcSystemCheckVariant`, then `createWorklist(variant)`, `startRun(…)`,
`getFindings(worklistId)`. Converting findings to another format is yours.

**Evidence.** Cloud trial, 2026-07-20. Old on-premise ATC was not measured.

**Where it bites.** `AdtRuntimeClient.getAtc()`: `resolveCheckVariant`,
`getFindings`.
