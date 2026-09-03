# Troubleshooting

ADT answers are often accurate about the wrong thing. Everything below was
observed against a running system, and each entry says what the message looks
like, what it actually means, and how to tell the two apart.

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

**The trap.** It is raised wherever the language version cannot be satisfied —
including cases that have nothing to do with your rights. Creating a class into a
package **that does not exist** answers with this object rather than "package not
found": with no package there is no software component, so there is no language
version to check against, and the refusal surfaces as an authorization failure.

Before going to PFCG, check that the package in the request exists and that its
software component allows the language version you are writing.

## A read of an object that is not there returns 200 and an empty body

ADT largely does not refuse a request for a missing object. `source/main` never
answers 404; it answers **200 with zero bytes**. A not-yet-ready read of a
domain, data element, package, table type or function group does the same.

So "the object is not there" and "the object is there and empty" arrive as the
identical answer, and neither the status nor the body can tell them apart.

**Why it matters more than it looks.** A read-modify-write that trusts the status
reads nothing, writes nothing back, and erases the object. A listing that treats
the same answer as a failure reports an error for an empty package.

Neither reading can be the library's, which is why it is a decision you supply:
pass `analyse` in the operation options to say which one applies to your call.

## A refusal can arrive with a 2xx

ADT answers some refusals with **200** carrying an `<exc:exception>` document.
The request reached the server and came back, so nothing throws and every layer
above stores the body as a result.

Measured on a trial: five of seven probed operation chains reported no errors
while SAP had refused, three of them writes — a caller believed an object existed
that did not, and that one had been deleted that had not.

**The status is the channel; the document is the verdict.** There are at least
three refusal shapes and they are not interchangeable:

| shape | resource |
|---|---|
| `<exc:exception>` | most resources, any status including 200 |
| `<del:message del:type="E">` in `del:checkResponse` | `/deletion/check` |
| `<msg type="E">` in `chkl:messages` | `/activation` |

## Activation reports `activationExecuted="false"` and nothing is wrong

The flag says whether ADT did any work, not whether the work succeeded. An object
that is already active answers `false` with an empty message list — identical, by
the flag alone, to an object that does not exist.

**Only `<msg type="E">` is the verdict.** An object locked by another session is
a `403` and never reaches this document at all.

## A deletion check that says "no" is not a failure

`/deletion/check` answers **200** with `del:isDeletable="false"` and a reason.
That is the answer the check exists to produce, not a failure to answer.

A *delete* that reports `del:isDeleted="false"` is a different thing entirely —
the objects are still on the system, and that is a failure.

## 406 and 415 name the exact content type in their text

The status number says nothing actionable; the sentence names the header:

- `406` — "Accepted content types: application/vnd.sap.adt.deletion.check.response.v1+xml"
- `415` — "Supported Media Types: …check.request.v1+xml"

Reading the body is cheaper than guessing content types from a status.

## "No URI-Mapping defined for URI", inside a 200

The address does not exist on the server. Historically this came from building an
object URI by lowercasing its type code — `DEVC/K` became
`/sap/bc/adt/devc/k/{name}` — where the real resource is
`/sap/bc/adt/packages/{name}`.

If a group operation (deletion check, delete, activate) does nothing and reports
nothing, read the body: the complaint is in there, inside a success.
