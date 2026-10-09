# Inputs per operation, and the document a write sends

**Status:** partly done. The payload half shipped — `interfaces-adt` 6.0.0 /
`interfaces` 50.0.0, consumed by the next `adt-clients` major — and §2.3 was
withdrawn with it. What remains is the per-operation input split, §2.1–2.2
and steps 3–6. Delete this file when that is done or abandoned.

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

### 2.3 The document model — **withdrawn**

This section used to require a typed model of each document: `doma:content`'s
three groups, `valueTableRef` as a reference rather than a string, `fixValues`
as a union with the value table, four label pairs on a data element. It said
the split and the model land in one major or not at all.

**Decision 32 withdrew it**, and `interfaces-adt` 6.0.0 went the other way: a
write sends `source`, a string this library passes through and does not read.
For a class it is ABAP, for a domain it is the object's XML document, and what
that XML may look like is documentation — `docs/usage/OBJECT_LIFECYCLE.md`,
"What a write sends" — not a type.

The reasoning is in the decision, and it is short: this package is a cut of
endpoints. It does not demand a particular ABAP body either, and a consumer who
must assemble the XML anyway is better served by the server's own document,
read back, than by a model of it maintained here and drifting.

So the split below no longer depends on this. `IDomainUpdateConfig` holding
`source` and the lock is not "no typing" — it is the accurate statement of what
that endpoint takes.

### 2.4 What the create sends — **settled**

**The create posts a shell, and takes no payload.** `IAdtCreatable.create` now
excludes `source` from its config and takes `IAdtCreateOptions`, which refuses
it too: measured across all 27 create implementations here, every one posts a
metadata document and not one carries source.

The other half of the question — whether the create sends the domain's *type* —
is settled the same way and against the measurement's permission.
`datatype`, `length` and `decimals` went back onto `IDomainConfig` in 4.1.0 on
the strength of a POST that keeps them, and came off again in 6.0.0: the shape
arrives with the document, through the update. A day-old field with no importer
was removed rather than deprecated.

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

With §2.3 withdrawn, none of the unmeasured rows is input to anything any more:
no group of a document is declared as a field, so there is nothing left for
them to be wrong about. They stay here because the measured rows are worth
keeping — and because the day a document model is proposed again, this is the
list of what it would first have to establish.

## 4. Order

1. ~~Settle §2.4~~ — **done**, `interfaces-adt` 6.0.0 / `interfaces` 50.0.0,
   and consumed by the `adt-clients` major that takes them.
2. ~~Measure what §3 leaves open~~ — **dropped with §2.3**. Nothing unmeasured
   is input any more.
3. **`interfaces-adt`**: add the agnostic input and result shapes. Additive —
   a minor.
4. **`adt-clients`**: declare the concrete per-operation configs, extend the
   agnostic ones, split every handler's members onto them. Major. The document
   model is no longer part of this step.
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
- ~~`document?: string` is gone~~ — **done**: it is `source`, on every type that
  takes a payload, and the eleven names it replaced are listed in decision 32.
- ~~The six document-only types all have their model~~ — **withdrawn**, §2.3.
- Every claim in §3 that became input is measured, and the measurement is in a
  probe under `scripts/`, not in a commit message.
- `npm run check` in `interfaces`, and build + `test:check` + the unit suite in
  `adt-clients`, all green; a full SAP run before the release.
