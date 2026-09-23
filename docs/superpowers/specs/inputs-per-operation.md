# Inputs per operation, and the document a write sends

**Status:** not started. Delete this file when it is done or abandoned.

Prescriptive. Where it disagrees with the code, the code is what changes.

Authority: **decision 31** in `mcp-abap-adt-interfaces`,
`docs/architecture/DECISIONS.md` — what and why. This is how.

## 1. What is wrong now

One `IXxxConfig` per object type is the input of every member of that type's
handler: ten for a domain, twelve for a class, fourteen for a table. Their
inputs are not the same input. `AdtClass` reads nine fields on `create`
(`superclass`, `final`, `createProtected`, `classTemplate`, `packageName`,
`masterLanguage`, `masterSystem`, `responsible`, `description`) and five on
`update` (`sourceCode`, `definitionsCode`, `localTypesCode`, `macrosCode`,
`testClassCode`). The intersection is `className` and `transportRequest`.

Three consequences, all of them already paid for:

- **"Is this field dead" has no single answer.** A field is dead for one member
  and live for another. Two sweeps over the same files disagreed, and one of
  them removed `description` from a table type's *create* because it is dead on
  the *update* — caught in review, one step from shipping objects described by
  their own name.
- **The type explains itself in prose.** `IDomainConfig` carries the sentence
  *"the fields beside this one describe a create; on an update they are not
  sent"* — a type telling the reader what it could tell the compiler.
- **The implementation has nowhere to put its plumbing.** `onLock` was declared
  on nine config types and invoked by one implementation; `sessionId` on five
  and read by none. `IIncludeConfig` still carries `onLock`.

## 2. The target

### 2.1 Three layers, and which package holds each

| layer | package | contents |
|---|---|---|
| capability atoms | `interfaces-adt` | unchanged — `IAdtCreatable<TConfig, TCreated>` and the rest already take their own `TConfig` |
| **agnostic input and result shapes** | `interfaces-adt` | what *any* ADT create takes, what *any* write takes, what each answers |
| **concrete per-type inputs** | `adt-clients` | `IDomainCreateConfig`, `IDomainUpdateConfig`, … extending the agnostic shapes |

A consumer replacing the implementation pulls the same contract for the atoms
and the agnostic shapes, and their own package for the realisation. Code written
against the agnostic shape survives the swap; code written against a concrete
one does not, and does not need to.

### 2.2 The agnostic layer is not invented

It is already written out by hand 39 times. Measured across the ADT configs:
`transportRequest` in **34**, `description` in **31**, `packageName` in **27**,
`masterLanguage` in 22, `masterSystem` and `responsible` in 9 each — and **none
of the 39 extends anything**. That repetition is the shape to lift.

**The object's own name does not go in it.** It is `className`, `includeName`,
`tableName`, `serviceDefinitionName`, `scalarFunctionName` — a different field
per type. The name stays the concrete type's business. Normalising it to `name`
is a separate decision and is **out of scope here**; do not do it as a side
effect.

### 2.3 The document model

Splitting without it delivers nothing: `IDomainUpdateConfig` would hold
`document?: string` and nothing else, which is the typing the library has today
— that is, none. So the two land in one major or not at all.

The model is derived from documents that were read, not from guesses. For a
domain, `doma:content` has three groups:

```
typeInformation    datatype, length, decimals
outputInformation  length (its own: SPRAS is LANG(1) shown as 2), style,
                   conversionExit, signExists, lowercase, ampmFormat
valueInformation   EITHER valueTableRef OR fixValues, never both;
                   plus appendExists
```

- `valueTableRef` is a **reference** — `adtcore:uri`, `adtcore:type="TABL/DT"`,
  `adtcore:name` — not a string. Today's `value_table?: string` described it
  wrongly.
- each `fixValue` is `position`, `low`, `high`, `text`. An **empty `low` is a
  value**, not an omission: `ZOK_D_TEST` has `low=""` with `text="FALSE"`.
  `IFixedValue` is `{ low, text }` and must be replaced, not extended in place.
- either/or is a fact about the data, so model it as a union rather than two
  optional fields that can both be set.

A data element is the same story: `dtel:dataElement` carries four labels, **each
with a `Length` and a `MaxLength`** — six values per label pair, not four — plus
`searchHelp`, `searchHelpParameter`, `setGetParameter`, `defaultComponentName`,
`deactivateInputHistory`, `changeDocument`, `leftToRightDirection`,
`deactivateBIDIFiltering`.

Six types have document-only updates. All six need this treatment; do not do one
and leave five.

### 2.4 What the create sends

**The create posts a shell.** The server's own POST answer documents it:
`version="inactive"`, all three `doma:content` groups present and empty. A
create arriving with them filled in is a different flow — measured to be
accepted (`201`, the type is kept, the activation is clean) but not the flow
this library follows. `datatype` therefore belongs on `IDomainCreateConfig` as
input to the *object's shape*, and the create sends what that flow sends.

Settle this explicitly before writing code, and record the answer here: does
`create` send the type, or does the shape arrive only with the document? The
measurement permits either; the flow prefers the second. **The decision is the
maintainer's, not this spec's.**

## 3. What is measured and what is not

| claim | status |
|---|---|
| POST keeps `typeInformation` | **measured**, cloud trial — `scripts/probe-domain-create-payload.ts` |
| a domain without a type cannot be activated | **measured** — `DO(251)`, `D0(408)` |
| the document holds all three groups, filled | **measured** — `XFELD`, `SPRAS`, `ZOK_D_TEST` in both states |
| POST keeps `outputInformation` | **not measured** |
| POST keeps `valueInformation` (either form) | **not measured** |
| any of it on **on-premise** | **not measured at all** — every measurement is the cloud trial |

Anything unmeasured either gets measured before it enters the contract as input,
or does not enter. That rule is what this whole line of work exists to enforce.

## 4. Order

1. **Settle §2.4** and record it.
2. **Measure** what §3 leaves open, for whichever groups the answer to §2.4
   makes input. Read-only probes where possible; one created-and-deleted object
   where not.
3. **`interfaces-adt`**: add the agnostic input and result shapes. Additive —
   a minor.
4. **`adt-clients`**: declare the concrete per-operation configs, extend the
   agnostic ones, split every handler's members onto them, add the document
   model. Major.
5. **Remove** the old `IXxxConfig` from the contract, declaring each removal in
   `tools/surface-removed.txt` with its reason. Major for `interfaces-adt` and
   `interfaces`.
6. **Consumers**: `mcp-abap-adt` and `mcp-abap-adt-backup` both import these
   types from `adt-clients` today (58 imports; the backuper has no dependency on
   `interfaces` at all), so their change is an import path at worst.

Publish the dependency before consuming it. No local tarball bridges.

## 5. Done means

- **A script decides "is this field dead", and it runs in CI.** After the split
  the question is decidable: for each per-operation config, every field is read
  by the one member that takes it. A unit test asserts it, the way
  `check-surface.js` asserts the contract. Without this the spec has moved the
  problem, not solved it.
- No field is declared on an input and dropped by the request it belongs to.
- `document?: string` is gone, or kept deliberately with the reason written down.
- The six document-only types all have their model.
- Every claim in §3 that became input is measured, and the measurement is in a
  probe under `scripts/`, not in a commit message.
- `npm run check` in `interfaces`, and build + `test:check` + the unit suite in
  `adt-clients`, all green; a full SAP run before the release.
