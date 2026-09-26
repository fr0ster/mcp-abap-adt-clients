# Troubleshooting

ADT answers are often accurate about the wrong thing. Everything below was
observed against a running system, and each entry says what the message looks
like, what it actually means, and how to tell the two apart.

SAP-side behaviour with a consumer-side workaround is collected in
[WORKAROUNDS.md](WORKAROUNDS.md); the entries below that belong there are short
and link to it.

## "You are not authorized to make changes (authorization object S_ABPLNGVS)"

Arrives as a `403` with an `<exc:exception>` document, `adtType`
`ExceptionResourceNoAccess`. It reads as a missing role. Often it is not.

**What the object is.** `S_ABPLNGVS` is not a role — it is an authorization
object for the ABAP **language version**:

| field | meaning |
|---|---|
| `ABP_LNG_VS` | the language version — *ABAP for Cloud Development*, *Standard ABAP* |
| `ACTVT` | the permitted operations — create, change, activate, execute, ABAP Unit |

The template role `SAP_BC_ABAP_DEVELOPER_5` carries it restricted to *ABAP for
Cloud Development*. Allowing *Standard ABAP* as well means adding that value in
PFCG.

**It may be inert.** The check applies only when the SACF authorization scenario
`ABAP_LANGUAGE_VERSION` is switched on. Otherwise the object sitting in a role
restricts nothing, so finding it in a role proves nothing about behaviour.

**It is not `S_DEVELOP`.** `S_DEVELOP` governs access to development objects at
all; `S_ABPLNGVS` additionally governs *which language version* they may be
created, changed and run in.

### What "access to a language version" actually grants

The object is checked as a pair, and both halves have to match the request:

- **`ABP_LNG_VS` — which language.** An object is written in one ABAP language
  version, fixed by the software component its package belongs to. Writing into a
  package whose component is *ABAP for Cloud Development* requires that value;
  writing a Standard ABAP object requires the Standard ABAP value. Holding one
  does not grant the other, and this is the usual cause on BTP ABAP Environment,
  where a developer is typically granted the cloud value only.
- **`ACTVT` — which operation, per language.** Access is granted per activity:
  create, change, activate, execute, run ABAP Unit. A user can hold *change* for
  a language version and not *activate* it, so a chain can write successfully and
  then fail at the activation step with the same object named.

That second half is what makes the failure look intermittent: the same user, the
same package, refused at one step of a create chain and not at the earlier ones.
Read which step the failure carries — `IAdtError.request` names it — before
concluding the whole language version is denied.

**What to check, in order.** Whether the package in the request exists; which
language version its software component fixes; whether the user holds that value
in `ABP_LNG_VS`; and whether they hold the specific `ACTVT` for the operation
that failed rather than for the one that succeeded.

**The trap.** It is also raised for a create into a package **that does not
exist** — before going to PFCG, check the package. See
[WORKAROUNDS.md](WORKAROUNDS.md#s_abplngvs-refuses-a-create-into-a-package-that-does-not-exist).

## A read of an object that is not there returns 200 and an empty body

`source/main` never answers 404, and a not-yet-ready metadata read answers the
same `200` with zero bytes, so "not there" and "there and empty" are one answer.
A read-modify-write that trusts the status erases the object. See
[WORKAROUNDS.md](WORKAROUNDS.md#a-read-answers-200-with-an-empty-body-instead-of-404).

## "Resource  ZCL_X: wrong input data for processing" on a read

A `400 ExceptionResourceWrongData`, `SADT_RESOURCE/007`, on every read of a
class that was created and has no source written yet. It is unfinished, not
absent or broken: write the source, do not retry. See
[WORKAROUNDS.md](WORKAROUNDS.md#what-a-bare-create-leaves-depends-on-the-type).

## "Class ZCL_X does not have a TMDIR entry" on an activation

A `200` carrying `<msg type="E" code="OO(045)">`: the object **does not exist**.
Distinguish it from the entry above — `wrong input data` is an object that
exists with nothing in it, `TMDIR` is an object that is not there at all. See
[WORKAROUNDS.md](WORKAROUNDS.md#activationexecuted-false-is-not-a-failure).

## A message class exists; its messages do not

`getMessageClassMessage().read()` answering `OBJECT_NOT_FOUND` is **this library
reading content**, not SAP reporting absence. A message class is a container and
its messages are rows in it: only the container has existence on the wire — 404
before it is created, 404 after it is deleted — while a row has none. Measured,
`POST …/messages/001?_action=LOCK_MSG` answers `200` before message 001 exists,
because the PUT after it is what creates it.

So there is nothing to ask about a row, and nothing refuses. The member fetches
the class document and looks for the number itself. A consumer who replaces the
reading replaces that verdict along with it.

## `validate()` passed and the create says the name is taken

Fixed in this package, and worth knowing if you are on an older version or
reading raw ADT traffic: a validation refuses a taken name two different ways.
A domain, a structure, a table, a class and a service definition answer a
failing status. A **function group and a DDL source answer `200`** with the
verdict in the body:

```xml
<SEVERITY>ERROR</SEVERITY>
<SHORT_TEXT>Data definition ZAC_X already exists</SHORT_TEXT>
```

A `validate()` that returns `200` has therefore not told you the name is free —
the body has. This package reads none of it: supply an `analyse` that looks for
`<SEVERITY>` if a rejected name should reach you as a failure, or read the
document yourself.

Note what `validate()` still does not answer: whether the object exists. A free
name validates fine either way. And note what an abandoned create leaves — the
name is held from the POST onward whatever state the object is in, including a
class that no read can see.

## An object that exists, holds its name, and cannot be deleted

`delete()` works on anything you can name — with one exception, and it is the
expensive one: **an object that was created but never bound to a package.** It
holds its name against every future create, and nothing removes it.

The mechanism shows in the deletion check's own answer. When it can resolve the
object it names the package:

```xml
<del:object del:isDeletable="true"  adtcore:name="ZAC_X" adtcore:packageName="ZADT_BLD_PKG03"/>
<del:object del:isDeletable="false" adtcore:name="ZAC_X">
  <del:message del:type="E"><del:text>Object does not exist</del:text></del:message>
```

The second shape is what an absent object gets — and an unbound one gets it too,
because the check resolves through the package. So the system reports "does not
exist" about something whose name is demonstrably taken, and the delete has
nothing to work on.

**This page does not reproduce it on purpose.** The experiment succeeds by
leaving exactly the undeletable object it is describing.

**Prevention is the whole remedy this library offers:**

- since 18.0.0 `create` is one POST, so it cannot leave a half-made object of
  its own; what can is *your* sequence stopping between the POST and the write.
  Wrap the steps that follow a create so a failure calls `delete` while the
  object is still bound to its package;
- treat a create as unfinished until you have seen the object *in its package* —
  `getUtils().search({ query: name })` answers `adtcore:packageName` for an
  object that resolved, and that is the attribute to look for;
- do not abandon a create halfway on purpose.

There is no member for re-binding an object to a package, and adding one would
not help: the resource that would accept it is reached the same way. Cleaning up
an object already in this state is SAP GUI territory.

## A refusal can arrive with a 2xx

The status is the channel; the document is the verdict. ADT has at least three
refusal shapes, and a `200` can carry any of them. See
[WORKAROUNDS.md](WORKAROUNDS.md#a-refusal-can-arrive-with-a-2xx-and-an-error-status-names-the-fix).

## Activation reports `activationExecuted="false"` and nothing is wrong

The flag says whether ADT did any work, not whether it succeeded; only
`<msg type="E">` is the verdict. See
[WORKAROUNDS.md](WORKAROUNDS.md#activationexecuted-false-is-not-a-failure).

## A deletion check that says "no" is not a failure

`/deletion/check` answers **200** with `del:isDeletable="false"` and a reason.
That is the answer the check exists to produce, not a failure to answer.

A *delete* that reports `del:isDeleted="false"` is a different thing entirely —
the objects are still on the system, and that is a failure.

## 406 and 415 name the exact content type in their text

The status number says nothing actionable; the sentence names the header. See
[WORKAROUNDS.md](WORKAROUNDS.md#a-refusal-can-arrive-with-a-2xx-and-an-error-status-names-the-fix).

## "No URI-Mapping defined for URI", inside a 200

The address does not exist on the server. Historically this came from building an
object URI by lowercasing its type code — `DEVC/K` became
`/sap/bc/adt/devc/k/{name}` — where the real resource is
`/sap/bc/adt/packages/{name}`.

If a group operation (deletion check, delete, activate) does nothing and reports
nothing, read the body: the complaint is in there, inside a success.
