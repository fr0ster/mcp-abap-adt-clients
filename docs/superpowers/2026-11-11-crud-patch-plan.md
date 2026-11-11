# Plan: a typed patch per document type

Goal: `2026-11-11-crud-patch-goal.md`. Spec (approved): `2026-11-11-crud-patch-spec.md`.
This plan breaks the spec into steps, in order. It holds no code: code is written at each
step, test first.

**Every step follows the same discipline.**
- **Red first.** Write the tests named for the step, run them, and see them fail for the
  reason the step names.
- **Then the change.** Make the change, and see the tests go green.
- **Then the mutations.** Apply each listed mutation on its own. Its test must go red; then
  revert it. Mutate one half of a rule at a time, and make every assertion unique to its
  rule. The PR description records each mutation and the test that caught it.
- **Then the gate.** Commit by path to `feat/crud-patch`. Pushing and checking CI follow
  once the controller has opened the PR.

**Gate (adt-clients, at the repository root):** `npm run build`, `npm run test:check`,
`npm run lint:check`, `npm test` (unit suites, no SAP system). For a live run:
`npm run test:detached -- <path>` in `packages/adt-clients`, with `MCP_ENV_PATH` and
`MCP_TEST_OVERLAY` naming the system, then read `test-run.log` whole.

**Rules that bind every step.**
- No cast, `any`, `@ts-ignore` or `!`, and no regex in production code.
- No timeout, retry or polling.
- No identity in a tracked file: `corpusCarriesNoIdentity`, `notesNameNoSystem`.
- No `npx`, `npm exec`, `node_modules/.bin` or `ts-node`.
- Long runs start with `~/.claude/scripts/start-detached` and are waited on with
  `~/.claude/scripts/wait-pid`. Never `pgrep -f`.
- **Every live step writes to SAP.** Before each one, tell the controller it is ready for
  its live run and wait for the go. Onprem runs as the test user, with the overlay's transport.
  Cloud runs in `ZADT_BLD_PKG03`.

**Owner publish point**, marked ⛳: adt-clients 45.2.0. The release follows the usual
sequence: final review approves, CI is green, merge, tag `adt-clients-v45.2.0`, publish
checkout readied (main checkout at the tag, built), the owner publishes, then a clean
install from the registry outside the repository.

---

## Part A — adt-clients (this worktree, `feat/crud-patch`)

### A1. Measure the reference carrying only its name (spec §2, "A reference changed by name")

This comes before any patch code.

- **What.** A temporary, hand-run integration probe that uses the library's own members
  (create, lock, readMetadata, updateMetadata, unlock, readMetadata, delete). It is not
  committed. Its header says how to run it.
- **Domain.** Create a probe domain. Write its value table through a `doma:valueTableRef`
  holding only `adtcore:name`, as two writes:
  - empty reference → table A;
  - A → table B.
  After each write, read back.
- **Package.** Create a probe package under the build package. Move its super package
  from the build package to the overlay's second existing package, through a
  `pak:superPackage` holding only `adtcore:name`. Read back.
- **Control.** For each, the same change through the element as SAP answers it (all
  attributes, new values). A refusal of the name-only form then shows whether the form or
  the change itself is refused.
- **Systems.** Cloud and onprem. Clean up the probe objects at the end, each answer read
  (no `catch {}`).
- **Record.** Every answer whole: status, `T100KEY`, and what the read-back holds for
  `uri` / `type` / `name`.
- **Outcome.**
  - Both forms accepted, and the read-back carries SAP's own `uri` / `type` for the new
    target: the spec's §2 entry goes from Inference to Measured, with the date, in a
    commit to the spec. Delete the probe.
  - **SAP refuses the name-only form on either system or either type: stop.** Report to
    the controller with the recorded answers. No other form is chosen and nothing further
    in this plan runs until the owner decides.

### A2. The document scanner (spec §3)

- **Tests first** (`unit/utils/documentEdit.test.ts`). On the fixtures of A3 and
  hand-written edge documents (declaration, comments, a processing instruction, CDATA,
  single- and double-quoted values, `>` inside a value, self-closing elements, a nested
  element of the same name):
  - locates a path's start tag, content and attribute ranges;
  - reports an absent path as absent;
  - returns every byte outside the splices unchanged;
  - applies several splices in any order;
  - escapes text and attribute values (by the attribute's own quote character).
- **Change.** `src/utils/documentEdit.ts`, internal and not exported, plain string code
  plus `XMLValidator`.
- **Source scan** (`unit/noRegexInDocumentPatches.test.ts`). It uses the TypeScript parser
  and refuses a regex literal or a `RegExp` call in `src/utils/documentEdit.ts` and
  `src/core/*/patch.ts`. Its red: a fixture file with a regex literal, and one with
  `new RegExp`.
- **Mutations:**
  - match a name anywhere instead of the path (nested same-name test goes red);
  - end a start tag at the first `>` regardless of quotes;
  - rebuild through the parser instead of splicing (byte-equality test);
  - drop attribute escaping, then drop text escaping (one at a time);
  - drop the validator (cut-short document test).

### A3. Fixtures into the corpus

- Record the measured reads of the six types, from cloud (`abap-cloud`) and onprem
  (`s4-2025`), into `corpus/adt/documents/<release>/`. Each gets its JSON sidecar as
  `corpus/README.md` describes, and is scrubbed to the placeholders.
  - Domain: the shared domain, `WAERS` (value table), `ABAP_BOOLEAN` (fixed values).
  - Data element: the shared one and `BUKRS`.
  - Package: the build package.
  - Table type, function group, message class: one each.
- **Red first:** `corpusCarriesNoIdentity.test.ts` refuses an unscrubbed copy. Run it once
  on the raw copy, then scrub.
- `corpus/README.md` gets the `documents/` row.
- The fresh no-description read-backs are added in A11, from the live run.

### A4. The result type and the shared rules (spec §1)

- **Tests first**, through the domain patch (the first type, A5), each on its own:
  - `not-a-document`: `''`, blank, non-XML, cut short;
  - `not-this-type`: a table-type document;
  - `element-missing`: names the first missing field in declaration order, and the
    patch returns no document;
  - no field given: the input string comes back after the checks;
  - `undefined` leaves the element byte-equal; `''` is written as `<x/>`;
  - a root description is added when missing and set when present; `adtcore:packageRef`'s
    description stays byte-equal.
- **Change.** `DocumentPatch` / `DocumentPatchRefusal` (`src/core/shared/` or beside the
  scanner, exported from the root) and the root-attribute rule.
- **Mutations:**
  - throw instead of returning the refusal;
  - write the fields that were found and skip the missing one;
  - drop the root check;
  - first-match description;
  - replace-only (no add);
  - write `''` for `undefined`.

### A5–A10. One patch per type (spec §2)

Every type follows the same step.

- **Tests first** (`unit/core/<type>/patch.test.ts`), on the corpus fixtures from both
  systems: each field of the spec's table is written at its path and in SAP's form, and
  every other byte is unchanged.
- **Change.** `src/core/<type>/patch.ts`, the changes interface, and the exports
  (`src/core/<type>/index.ts`, `src/index.core.ts`). `publicApiSurface.test.ts` imports
  each function from the package entry point (red before the export).
- The mutations below come on top of A4's shared ones, which are re-run per type for the
  description.

**A5. Domain** (`patchDomainDocument`).
- Mutations:
  - `length` to the first `doma:length` in the document (the output-length byte-equality
    test goes red only through the path);
  - unpadded length/decimals;
  - `signExists` / `lowercase` written as strings;
  - `valueTable` keeps the old `uri` / `type` (reference by name);
  - `valueTable` not added on `<doma:valueTableRef/>`;
  - `fixedValues`: no position;
  - `high` absent writes nothing instead of `<doma:high/>`;
  - `[]` keeps the old block;
  - `fixedValues` merged rather than replaced.

**A6. Data element** (`patchDataElementDocument`).
- Mutations:
  - description to the first attribute of that name;
  - 2-digit label length unpadded;
  - a label length derived from the label;
  - `*MaxLength` written.

**A7. Table type** (`patchTableTypeDocument`).
- Mutations:
  - `keyDefinition` / `keyKind` to the first element of that name (a fixture whose
    `ttyp:secondaryKeys` carries the same names, if the measured documents hold one,
    otherwise a hand-made variant of the measured one);
  - `length` unpadded;
  - a `ttyp:valueHelp` description written.

**A8. Function group** (`patchFunctionGroupDocument`).
- Mutations:
  - first-match description;
  - description truncated (the "passed as given" test, 41+ characters).

**A9. Package** (`patchPackageDocument`).
- Mutations:
  - description reaching `pak:superPackage` or `pak:subPackages/pak:packageRef`;
  - `softwareComponent` / `transportLayer` to the first element of that name, not
    `pak:transport/…`;
  - `superPackage` keeps the old `uri` / `type` / `description`;
  - `recordChanges` written as a string;
  - `responsible` / `masterSystem` to a nested element.

**A10. Message class** (`patchMessageClassDocument`).
- Mutations:
  - first-match description;
  - a message's attributes touched.

### A11. The tests move off `src/utils/xmlPatch.ts`

- **Red first.** With A5–A10 in place, the integration flows still import the regex
  helper. Delete `src/utils/xmlPatch.ts` and `unit/utils/xmlPatchFailsLoudly.test.ts` and
  see `npm run test:check` fail in `TableType.test.ts`, `Package.test.ts` and
  `domain/IfMatch.test.ts`.
- **Change.** Each test patches through the shipped function of its type. The `describe`
  command of `scripts/transport-admin.ts`, the helper's other user, is deleted with it.
- **Extend the six types' integration flows** for the live assertions of spec §5:
  - every field the system takes;
  - the fresh object's description;
  - a description of exactly the limit, read back whole, and one over it, answered as measured;
  - `fixedValues` with and without `high`, and `[]`;
  - `valueTable` empty → A → B;
  - `superPackage` change.
- `helpers/rootDescription.ts` stays.
- **Gate:** `npm run test:check`, `npm run lint:check`, unit suites.

### A12. MasterLanguage.test — two cases (spec §5)

- **Case one (runs everywhere):** without a configured language, the create body carries
  neither `adtcore:masterLanguage` nor `adtcore:language`. Red first: the current
  expectation of `EN` is left in, and the case fails against the library.
- **Case two:** `default_master_language` configured → the body carries it. Registered
  `it.skip` with the reason in its title when no language is configured (a config gate).
- **Mutation:** a library change that writes `EN` by default turns case one red.

### A13. Transport.test — the overlay key (spec §5)

- **Red first.** `check:config` refuses an overlay without
  `environment.transport_search_configured`.
- **Change:**
  - the key goes into `helpers/overlays/onprem.yaml` (`true`), `cloud.yaml` (`false`), the
    template, `scripts/check-config-drift.js`, `docs/development/TEST_CONFIG_SCHEMA.md`
    and the local overlays (cloud `false`, onprem as measured there);
  - the reader of the key, required and boolean, like `helpers/lockReleased.ts`;
  - the list case: registered `it.skip` with the reason in its title when `false`; run
    when `true`, where an empty list fails.
- **Mutations:**
  - a missing key read as `false` (the `check:config` test goes red);
  - `true` with an empty list passing.

### A14. deletionCheck.test — the transport case (spec §5)

- **Change.** The transport request case is registered `it.skip`, with the reason in its
  title, when `environment.default_transport` is empty; otherwise it runs as today.
- **Red first:** the cloud overlay registers the case as running, and it throws.
- **Mutation:** gate removed, and the cloud run fails again.

### A15. Live runs, per type, cloud and onprem

Each run needs the controller's go.

- Run the six types' integration suites and A12–A14's files on cloud, then on onprem, one
  directory at a time (`test:detached -- integration/core/<type>`).
- Every failure is fixed before going on. "Pre-existing" is no excuse.
- From the run, record into the corpus (A3's rules) each type's fresh read-back without a
  root description, and add a unit case for it to its type's patch test.
- The over-long description: the patch passes it as given and SAP's answer reaches the
  caller as it is. Measure what each type answers on each system and record it in spec §2
  as Measured; each type's live test writes a description of exactly the limit and then one
  over it, and expects what each system measured.
- Then the whole integration suite once on each system. Its summary goes into the PR
  description.

### A16. Documentation (spec §8)

- `README.md`, "`update()` writes the whole content": the three-call sequence with a
  shipped patch for the six document types.
- `docs/usage/CLIENT_API_REFERENCE.md`:
  - the `patchTheDescription` placeholder becomes `patchDomainDocument`;
  - one section per type with the field table, the refusals, "the description is passed
    as given", and "a reference changed by name".
- `docs/architecture/DECISIONS.md`: decision 19.
- `corpus/README.md` (A3).
- `CHANGELOG.md`: ask the controller to confirm 45.2.0 with the owner (repository rule),
  then write the entry with today's date, re-dated on every edit.
- `npm run check:docs` is green: every name the docs import exists.

### A17. The working documents leave

- Before the release commit, delete `docs/superpowers/2026-11-11-crud-patch-goal.md`,
  `-spec.md` and `-plan.md` in one commit.
- Anything they still owe goes into the PR description first: the server's steps of
  Part B, and the measured dates.

### A18. Release commit and the PR

- Version 45.2.0 in `packages/adt-clients/package.json` (once the owner confirms), then
  `npm install --package-lock-only` at the root.
  - Lockfile check: `"link": true` only for the three workspace siblings, and every
    third-party entry resolved from the registry.
  - `adt-clients-legacy`'s `^45.1.0` is satisfied, so no bump.
- **One PR** carries the goal, spec, plan, code, tests and docs: `feat/crud-patch` →
  `main`. The controller opens it, and the reviews run there.
- ⛳ after approval and green CI: merge, tag, publish checkout readied, the owner publishes,
  clean install from the registry.

---

## Part B — mcp-abap-adt, after 45.2.0 is on the registry

This is the server's own PR, in its own worktree. It starts only once
`@mcp-abap-adt/adt-clients@45.2.0` resolves from the registry; nothing is linked.

- **B1. The dependency.** Move `@mcp-abap-adt/adt-clients` to `^45.2.0`, regenerate the
  lockfile with npm, and check it (no link but the repository's own siblings).
- **B2. The handlers call the patches.**
  - Every handler of the goal's facts maps its tool arguments to the typed changes and
    keeps its value choices: defaults on create, upper-casing, label lengths, the
    `type_name` fallback, string-or-boolean flags to booleans, lengths to numbers.
  - Those handlers are domain, data element and table type (high create, high update and
    low update), function group (high update), package (high and low update) and message
    class (high update).
  - Each answers a `DocumentPatch` refusal as a failure of the step "patch", naming the
    field.
  - Tests first: the handlers' unit tests assert the changes each passes, and that a
    refusal reaches the answer. Mutation: a field dropped in the mapping.
- **B3. The patchers go.**
  - Delete the domain, data element, function group and package patchers. That removes
    79f62d7c's code with `domainPatch.ts`.
  - Delete the patch half of `tableTypePatch.ts`. `readTableTypeDefinition` and its type
    move into `tableTypeStored.ts`, which stays.
  - Delete `xmlPatch.ts` whole, with the unit tests of each.
  - `handleUpdateMessageClass.ts` loses its own `patchXmlAttribute`.
  - `communicationBatch.test.ts` and `TableTypeHighHandlers.test.ts` move to the
    library's patches.
- **B4. IncludeHighHandlers.test.** It moves to a root-scoped description helper in plain
  string code, like adt-clients' `helpers/rootDescription.ts`. That removes the last user
  of `xmlPatch.ts`.
- **B5. Live.** Run the six types' high and low handler suites on cloud and onprem, each run
  with the controller's go.
- **B6. Docs and CHANGELOG** of the server, as its repository's rules say. Then its review,
  release and the owner's publish, in that repository's sequence.
