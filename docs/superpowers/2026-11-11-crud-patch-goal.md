# Goal: the library patches an object's document from the changes

## Goal

Every create, read, update and delete of an ABAP object is done by adt-clients. For the
domain, the data element, the table type, the function group, the package and the message
class, adt-clients exports a patch per type that takes the document the caller read and the
changes the caller names — the description, and each type's own fields — and returns that
document with exactly those changes, everything else as SAP stored it. A caller updates by
reading the metadata, patching it with the library and writing it with the library's update;
it no longer patches XML itself: mcp-abap-adt calls the library and keeps no patcher of its
own. A description is set on the object's own root element, on every system — also where
SAP's read-back carries no description there and a nested reference (`adtcore:packageRef`)
carries another object's. The library's integration suite passes on ABAP Cloud (trial) and
on premise (E19): the table type update is accepted, and the master-language, transport-list
and transport-deletion-check cases either pass or skip stating why.

## Invariants

- **A patch takes changes, not XML.** The caller names the fields it changes, typed per
  object type; the patch is a function of the read document and the changes, and sends no
  request. The existing read and update members keep their contracts.
- **Attributes the caller changes are written on the object's root,** and added there when
  the document the change applies to does not carry them. A nested element's attribute of
  the same name (a package reference's description, a value help's description) is never
  written in its place.
- **Nothing the caller did not ask to change is changed.** Every field, attribute and
  element the caller did not name reaches SAP as SAP stored it, the ones the library does
  not know included.
- **One endpoint, one method.** Every member issues exactly one ADT request, as the
  repository's base principle states; reading, patching and writing stay three steps.
- **Static types first.** What the compiler can prove is not checked at run time; no casts,
  `any`, `@ts-ignore` or non-null `!` in the code this change writes. A runtime check stays
  only for what comes from outside the type system — SAP's documents above all. No regular
  expression in production code: XML is read and written with the parser or plain string
  code; the library's tests patch documents through the shipped patches, not a
  first-match helper of their own.
- **No timeouts, retries or polling** added by the library. A failed request is its own
  answer.
- **Proved live, per type, on both kinds of system.** Each of the six types' update is run
  against ABAP Cloud (trial) and on premise (E19) and its result read back. Unit tests show
  each rule is load-bearing: break the rule deliberately and a test goes red.
- **The other trial failures are closed.** A failure the library or its tests cause is fixed.
  Where it is an environment condition — no saved transport search configuration on a fresh
  account, no transport request on cloud — the test skips and states that reason; it never
  passes green having run nothing, and never fails for the environment.

## Out of scope

- Object types other than the six named.
- Source-code updates (classes, programs, includes, function modules and the like).
- What mcp-abap-adt's tools accept and answer, beyond calling the library instead of
  patching itself.
- A backport to an earlier major.
