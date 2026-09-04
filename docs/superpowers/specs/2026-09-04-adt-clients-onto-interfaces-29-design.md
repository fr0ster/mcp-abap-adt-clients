# `adt-clients` onto the 29.0.0 contracts — design

## Why

`@mcp-abap-adt/interfaces@29.0.0` is published. It removed the wide composites,
the 32 state bags and the transport envelope from the contract surface, and moved
every CRUD member from throwing to answering `IAdtResponse`. `adt-clients`
implements those contracts and no longer compiles: **154 errors**.

The migration is not bookkeeping. It closes the report this whole line of work
started from — creating and modifying a class in a package that **requires a
transport request** produced a fabricated error instead of the one SAP sent.

## What the contract now is

- `IAdtResponse<TValue, TError = IAdtError>`; `getResult()` answers
  `IAdtResult<TValue>`.
- Eight members answer instead of throwing: `create`, `read`, `readMetadata`,
  `update`, `delete`, `validate`, `check`, `activate`.
- `@throws` remains only on `lock`, `unlock`, `getVersions`, `getVersionSource` —
  they answer a lock handle, nothing, a version list and a source string, so they
  have no failure half.
- Each atom names its own result: `IAdtCreatable<TConfig, TCreated>`,
  `IAdtReadable<TConfig, TSource, TMetadata>`, and so on. There is no `IAdtCrud`,
  `IAdtModifiable`, `IAdtObject`, `IAdtSourceObject`.
- No state types, no `errors[]`.
- `IAdtOperationOptions.analyse` is the injection point for what counts as a
  failure.
- `AdtOperationError` no longer exists; this package's `AdtSAPError` and
  `AdtParseError` remain.

## Decisions taken

**One spec for the whole migration.** Decomposition happens in the plan, not by
splitting the design.

**A member answers its document; a parser is a separate parameter.** The default
result is the body as it arrived — decision 5 leaves parsing to the consumer, and
this library does not know which fields a caller needs. Where a caller wants a
shape, the implementation takes a parser in the form already established by
`search(criteria, parse)`. The strategy lives in the implementation; the contract
says only that a result is answered.

Mutations that ADT answers with nothing return `void`. Success is `ok: true`; the
reason for a failure is in `getError()`.

**Legacy migrates; batch is deleted.** `AdtClientLegacy`, `AdtUtilsLegacy` and
`AdtClassLegacy` serve real systems and move to the new contract.
`AdtClientBatch` and `AdtRuntimeClientBatch` are research rather than product —
mixed GET+POST in one envelope is a server-side 500 — and are removed with their
tests rather than migrated.

**Vertical slice, then replication.** `class` is taken to completion — value
types, implementation, casts re-read, positive and negative tests — and only then
are the other 27 done in batches of four or five. An approach applied to
twenty-eight things before it is proved on one is how this session produced three
silent data losses.

## Shape of the work

### Per object type

`src/core/<type>/types.ts` declares one named type per member, replacing the
state bag, with the measured ADT behaviour in its doc comment. `class` is written
and is the worked example:

```ts
export type ClassCreated = string;           // the created class's metadata document
export type ClassSource = string;            // /source/main
export type ClassCheckResult = string;       // chkl:messages; <msg type="E"> is the verdict
export type ClassActivationResult = string;  // activationExecuted="false" ≠ failure
export type ClassDeletionResult = string;    // del:isDeleted="false" inside a 200
export type ClassUpdated = void;             // ADT answers nothing worth reading
```

Copy the shape, never the values: read what each type's low-level functions
actually request before naming its results.

The implementation then declares the atoms it honours with those types, and each
member returns `answering(...)` from `src/utils/adtResponse.ts` rather than
building a state and throwing.

### Failure classification

`recogniseFailure` already distinguishes `refusal`, `parse` and `connection`, and
`refusalAware` is installed once per connection. Neither changes. What changes is
that a per-type implementation may pass `analyse` to override the verdict, which
is how the "200 with an empty body" ambiguity is resolved per caller rather than
guessed at centrally.

### Casts

461 `as X`, 297 `: any` and 141 `as unknown as` exist in the repository. Many were
written to get around the envelope. Each cast in a migrated file is read: removed
if redundant, and if it hides a real mismatch, the mismatch is fixed. A cast is
invisible to both the compiler and a diff review, so this is done by reading, not
by grep counts alone.

## Testing

**Both directions.** That a failure is reported when SAP refused, and that none is
reported when it did not. Only the first is usually written, and a library that
failed everything would pass it.

**Negative cases are their own body of work**, not an afterthought in existing
tests: a refusal inside a 2xx, a 404 carrying a document, an empty body where a
document was expected, a deletion that did not delete.

**Unit tests over captured real answers.** The evidence already gathered — an
`exc:exception` with `ExceptionResourceNoAccess`, 1709 bytes, from a live trial —
is run through the classification and asserted to reach the caller whole. This is
deterministic, needs no system, and tests what no type can.

**A test that did not run did not pass.** Six tests in `sqlQuery` and
`tableContents` passed without executing; the suite printed `PASS` with no steps.
Skips are printed unconditionally.

**Seven integration files still on the old contract** — `discovery`, `readSource`,
`readMetadata`, `whereUsed`, `search`, `sqlQuery`, `tableContents` — read the
verdict from the contract using the `expectResult` / `expectFailure` helpers in
`src/__tests__/helpers/contract.ts`.

## Verification

The compiler is not the check, and this is measured rather than asserted: where a
cast sits, `tsc` stays silent, and three regex edits of the contracts package
silently deleted six types and the first field of three others while every check
stayed green.

So each step is verified three ways:

1. **Compiler** — for signature mismatches. Cheap, exact, and exhausted quickly.
2. **Enumerate, edit, count** — list targets by an exact criterion, edit, then grep
   every touched symbol across the repository *including comments and README*, and
   compare counts before and after. Six review rounds on interfaces #63 found zero
   defects in types and every one in prose or unused imports.
3. **Tests** — unit for meaning, integration for behaviour.

## Done means

- `npm run lint:check`, `npm run build`, both type-checks: clean.
- No `IAdtObjectState`, no `I<Object>State`, no `errors: []`, no `AdtOperationError`
  anywhere in `src`.
- Batch removed; legacy migrated.
- Full integration run against the cloud trial with no failure attributable to the
  migration, and every skip printed with its reason.
- **On-prem**: creating and modifying a class in a package that requires a
  transport request surfaces SAP's own message. The cloud trial cannot show this —
  `ZLOCAL` is local and `transport_request` is unset, which the last full run
  confirmed by skipping that test — so it is verified on the machine with on-prem
  access before release.

## Out of scope

The `adt-clients` version number, and publication. Both are the maintainer's.
