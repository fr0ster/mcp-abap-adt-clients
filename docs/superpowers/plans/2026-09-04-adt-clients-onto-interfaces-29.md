# Bringing `adt-clients` onto `@mcp-abap-adt/interfaces` 29.0.0

Active plan. Delete this file when the work is done or abandoned.

## Where things stand

`@mcp-abap-adt/interfaces@29.0.0` **is published**. `adt-clients` now depends on
`^29.0.0`, the lockfile resolves from the registry with no `"link": true`, and
`npx tsc --noEmit` reports **154 errors** — every one of them a place the new
contract touches.

`adt-clients` `package.json` says **17.0.0**, which is **not on npm** (16.0.0 is).
Its `v17.0.0` tag was re-cut onto the licence commits. The version for this work
is the maintainer's call and has not been made.

## What changed in the contract, in one screen

- `IAdtResponse<TValue, TError = IAdtError>` — takes the **value**, not a wrapper.
  `getResult()` answers `IAdtResult<TValue>`; `IAdtResult` is no longer written at
  call sites.
- Eight members answer the contract instead of throwing: `create`, `read`,
  `readMetadata`, `update`, `delete`, `validate`, `check`, `activate`.
- `@throws` remains only on `lock`, `unlock`, `getVersions`, `getVersionSource` —
  they answer a lock handle, nothing, a version list and a source string, so they
  have no failure half.
- **Each atom names its own result**: `IAdtCreatable<TConfig, TCreated>`,
  `IAdtReadable<TConfig, TSource, TMetadata>`, `IAdtUpdatable<TConfig, TUpdated>`,
  and so on. There is **no** `IAdtCrud`, `IAdtModifiable`, `IAdtObject` or
  `IAdtSourceObject`.
- **No state types.** `IAdtObjectState` and the 31 `I<Object>State` interfaces are
  gone. `errors[]` with them.
- `IAdtOperationOptions.analyse` is the injection point:
  `(verdict: IAdtError | undefined, answer?: IAdtWireResponse) => IAdtError | undefined`.
- `AdtOperationError` no longer exists. Catch structurally on `code`, or use this
  package's `AdtSAPError` / `AdtParseError`.

## The pattern, already set for `class`

`src/core/class/types.ts` is the worked example. A state bag is replaced by one
named type per member, declared **beside the implementation**, because a result
is the implementation's to name:

```ts
export type ClassCreated = string;           // the created class's metadata document
export type ClassSource = string;            // /source/main
export type ClassMetadata = string;
export type ClassCheckResult = string;       // chkl:messages; <msg type="E"> is the verdict
export type ClassActivationResult = string;  // activationExecuted="false" ≠ failure
export type ClassValidationResult = string;
export type ClassDeletionResult = string;    // del:isDeleted="false" inside a 200
export type ClassUpdated = void;             // ADT answers nothing worth reading
```

Each carries, in its doc comment, the measured ADT behaviour it depends on. Copy
the *shape*, not the values — read what each object type's low-level functions
actually request before naming its results.

## Order of work

1. **`class`** — 22 files, 8 still importing `IClassState`, 56 `IAdtWireResponse`,
   12 casts. Finish the module.
2. **`clients/AdtClient.ts`** — 26 errors; most fall out once the per-type results
   exist.
3. **`core/shared/AdtUtils.ts`** — 24 errors.
4. **The other 27 object types**, one at a time.
5. **Re-read the 461 `as X` casts.** Many existed to get around the envelope. With
   it gone they are either redundant or hiding a real mismatch — and a cast is
   invisible to both the compiler and a diff review.
6. **Tests**: seven files still on the old contract (`discovery`, `readSource`,
   `readMetadata`, `whereUsed`, `search`, `sqlQuery`, `tableContents`); make skips
   visible; add negative cases as their own body of tests.
7. **On-prem**: reproduce the original complaint — creating and modifying a class
   in a package that requires a transport request must surface SAP's own message.
   The cloud trial cannot do this: `ZLOCAL` is local and `transport_request` is
   not configured, which the last full run confirmed by skipping that test.

## Rules that were learned the hard way today

**The compiler is not the check here.** Measured in `adt-clients`: 461 `as X`,
297 `: any`, 141 `as unknown as`. Where a cast sits, `tsc` will stay silent after
the migration. And three mass edits of the contracts package by regex **silently
deleted six types and the first field of three others** — nothing failed, because
a deleted type nobody references still compiles. It was found by diffing against
`git show HEAD:`.

So: **enumerate, edit, count**. List the targets by an exact criterion, edit them,
then grep every removed symbol across the repository *including comments and
README*, and compare counts before and after. Six review rounds on interfaces #63
found zero defects in types and every one of them in prose or unused imports.

**A green test proves nothing on its own.** Six tests in `sqlQuery` and
`tableContents` passed without running — the suite printed `PASS` with no steps.
Skips must be printed unconditionally.

**Test both directions**: that an error is reported when SAP refused, *and* that
none is reported when it did not.

**Do not design from what the consumer currently reads.** It would freeze the
consumer's mistakes into the contract — `checkResult` is read via `.status` 18
times and via the body zero, while the verdict lives in the body.

## Reference material already captured

- `docs/usage/TROUBLESHOOTING.md` — seven ADT behaviours observed on a live
  system, including `S_ABPLNGVS`, absence arriving as 200-with-empty-body, and a
  refusal inside a 2xx.
- `@mcp-abap-adt/interfaces` `docs/architecture/DECISIONS.md` — decisions 20
  (choice by injection, never more contract) and 21 (a test asks the contract).
