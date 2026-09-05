# Checking code before the object exists

**Status:** measured, no member behind it. Parked here with the debugger work
until it is decided what a consumer should be able to ask for.

`POST /sap/bc/adt/checkruns?reporters=abapCheckRun` can carry the source inside
the request, so in principle nothing has to be in the system for it to be
compiled. Whether the server accepts that depends on the object type, and the
split is not the one you would guess.

Reproduce: `npx ts-node scripts/probe-checkrun-without-object.ts` (set
`PROBE_EXISTING_CLASS` to a class on your system for the control) and
`scripts/probe-checkrun-version.ts`.

## What was measured

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

**The version does not matter when a source is supplied.** `new`, `inactive` and
`active` were measured to answer identically — for `program`, `function_group`,
`structure` and `service_definition` alike — so the artifact in the request is
what gets compiled, and the `check()` members coercing the status to
`active | inactive` costs nothing here. ADT itself sends `chkrun:version="new"`
while an object is still being written.

**What it would be good for.** Validating generated or user-supplied code before
committing to a create, and getting a compiler's verdict on a source about to be
written. For the seven types above it costs one POST and leaves nothing behind.

## What is not settled

**Three types refused the payload, not the object.** `access_control` answered
`No DCL source data has been specified` with an artifact attached, and `domain`
and `data_element` answered `System expected the element '…domain'` /
`'…dtel}wbobj'`. The server read the artifact and rejected its shape, so a
correct payload might well be checked without the object. Finding those three
payloads is the first open question — Eclipse traces of a DCL and a domain being
written would answer it.

**There is no member for this.** `check()` takes the source through the config
and coerces the version, which happens to be enough — but nothing in the API
says "compile this source, the object need not exist", and a caller has to know
that passing `sourceCode` is what makes it work. Whether that deserves its own
member, a parameter, or nothing at all is the second question, and it is the
same question the whole one-endpoint-one-member line is answering elsewhere.

**A failed check is unreadable.** The 18 `src/core/*/check.ts` functions throw a
plain `Error` built from the message texts, so a check that finds something
answers `origin: 'connection'` with the report dropped:

```
broken: FAILED origin=connection response=DROPPED request=DROPPED
        message: Program check failed: The statement "THIS" is invalid. …
```

For this feature the messages *are* the answer being asked for, so the feature
cannot ship before that does. The fix is the pattern already shipped three
times — `activationRefusal`, `packageDeletionRefusal`, `publicationRefusal`: the
low-level function returns the response verbatim and a `checkRefusal` default
`analyse` reads `chkrun:status` and the messages.
