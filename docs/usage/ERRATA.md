# SAP ADT errata

What SAP ADT answers that a caller would misread, recorded once it has been
decided to belong here.

## The debuggee ending is answered as a failure

**Symptom.** Two requests of the ABAP debugger whose purpose is that the
debuggee stops existing answer as if they had failed:

- a step that lets the program run to its end — `stepContinue`, or any step
  past the last statement — answers `500 AdiFailed`, subtype `debuggeeEnded`
  (`SY/530`);
- `terminateDebuggee` answers `500 AdiFailed`, subtype `terminateDebuggee`
  (`SY/530`), on premise; on SAP BTP ABAP Environment it answers `200`.

**What actually happened.** The request worked. After either answer the
program's run returns (with its output after `debuggeeEnded`, with an error
after a termination), and the next request on the debug session answers
`noSessionAttached`. Measured on premise, SAP_BASIS 758
(`corpus/adt/debugger-run-to-line--08-stepcontinue`) and 816
(`corpus/adt/debugger-terminate--01-terminate-debuggee`), and on the cloud,
2026-10-08/10.

**Why the library has a strategy for it.** `analyseDebuggeeEnd` from
`@mcp-abap-adt/adt-strategies`, passed to `step`, `stepToLine` or
`terminateDebuggee`, answers those two subtypes as no failure; the result is
the document that names the subtype, so the caller still sees that the
debuggee is gone. Every other refusal stays a refusal — including
`noSessionAttached` on a request sent after the end. A caller who wants the end
of the program to stop them passes `analyseException` instead.

## A service binding is locked to publish it

**Symptom.** `_action=LOCK` on a service binding, before a publish or an
unpublish, answers `403 ExceptionResourceNoAccess`, *"User … is currently
editing"*.

**What Eclipse does.** It meets the same `403` on its own LOCK and publishes
anyway:

- Eclipse ADT 3.60.3 against the BTP trial, 2026-09-05: `LOCK` → `200` on its
  *"stateful, enqueue"* session; `POST …/odatav4/publishjobs` → `200`,
  stateless; `UNLOCK` → `200` only on *"Closing editor"*; a second `LOCK` before
  the unpublish → `403` while the first was still held.
- Eclipse against a cloud system, 2026-09-27: after a publish its editor kept
  the lock (a `LOCK` from another session → `403`); the unpublish that followed
  sent its own `LOCK` → `403` and then `POST …/unpublishjobs` → `200`.

**Why the library has a strategy for it.** `analysePublicationLock` from
`@mcp-abap-adt/adt-strategies`, passed to `getServiceBinding().lock()`, answers
that `403` as a lock without a handle (`''`): the publication goes ahead, and
there is nothing to unlock. Every other refusal stays a refusal. It treats any
`403` on that LOCK this way; what was observed is the one above, where an
editing session already held the binding. A caller who wants the `403` to stop
them passes `analyseException` instead.
