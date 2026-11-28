# Plan: type groups (`TYPE/DG`) in adt-clients

This plan carries out `2026-11-28-type-groups-spec.md` in the order of the spec's section 6.
The goal (`2026-11-28-type-groups-goal.md`) and the spec bind every task.

**Every task:**
- **Tests first.** The tests named under "Tests first" are written first, and they fail. Then
  the files change until they pass.
- **Small commits.** Each logical change is its own commit, ending with the session's
  attribution lines.
- **The gate.** A task is done when:
  - its tests pass;
  - every test that passed before still passes;
  - each package's `build`, `lint:check` and `test:check` are green.
- **Known red cases.** A task that leaves a test red names it as known red, and names the task
  that turns it green.

**Versions:**
- `@mcp-abap-adt/interfaces-adt` takes the next minor of the version in its `package.json` when
  Task 3 starts (33.0.0 today, so 33.1.0).
- `@mcp-abap-adt/adt-clients` takes the next minor on top of the latest version on the registry
  when Task 4 starts. The patch 48.0.1 is published before type groups, so that is most likely
  48.1.0. The branch takes that release from `main` before Task 4, and Task 12 writes the
  version.
- adt-strategies and adt-clients-legacy keep their versions.

**Pull requests:**
- interfaces-adt is a separate repository. Its change is one PR in that repository, linked
  from this PR and linking back.
- Everything in this repository stays in this PR.

## Task 1 — Measurements (done)

Both rows are settled by measurement (spec 1.3):
- **On premise:** `type-group-cycle-s4-2025` and `type-group-reads-s4-2025`.
- **Cloud:** `type-group-cycle-abap-cloud` and `type-group-reads-abap-cloud`.
- **Committed in this PR:** the scrubbed corpus, under
  `packages/adt-clients/corpus/adt/answers/type-group-*`.

**Still open:** `corrNr` and long polling on the metadata read, proven in Task 11. Neither changes
a row.

## Task 2 — interfaces-adt: the contract

**Where:**
- Repository `mcp-abap-adt-interfaces`, package `packages/interfaces-adt`.
- Worktree `.worktrees/type-groups`, branch `feat/type-groups` off `origin/main`.
- The PR is opened at the first commit and linked from this PR.

**Tests first** (`src/__typechecks__/typeGroup.ts`, run by `test:check`):
- **The name.** `'typeGroup'` is an `AdtApiName`.
- **`ITypeGroupConfig`.** It requires only `typeGroupName`, has the optional fields of spec 2.1,
  and has no `transformationType`.
- **`ITypeGroupResults`.** It holds exactly the nine slots of spec 2.1. A set missing one, or
  carrying `check`, `metadataUpdated`, `transport` or `deletionCheck`, does not compile.
- **`IAdtLockedDeletable`.**
  - `delete` without `lockHandle` does not compile.
  - An implementing class needs no `checkDeletion`.
  - Both overloads take `analyse`.
- **The rows.**
  - The on-premise operations are exactly the tuple of spec 2.3, and the cloud ones exactly the
    cloud tuple.
  - `nameMaxLength` is `5`, and `evidence` names each release's typestructure case.
  - `AdtTypeCodeWith<'cloud', 'create'>` lacks `TYPE/DG`; `AdtTypeCodeWith<'cloud', 'validate'>`
    and `AdtTypeCodeWith<'onprem', 'delete'>` include it.

**Files and interfaces:**
- `src/adt/IAdtCapabilities.ts`: `IAdtLockedDeletable<TConfig, TDeleted, TRequired>` (spec 2.2).
- `src/adt/IAdtTypeGroup.ts`: `ITypeGroupConfig` and `ITypeGroupResults`.
- `src/adt/IAdtTypeTable.ts`: `'typeGroup'` in `AdtApiName`.
- `src/adt/AdtTypeTables.ts`: the two rows of spec 2.3.
- `src/index.ts`: the exports.

**Commits:**
1. the atom and its typecheck cases;
2. the config, the results and their cases;
3. the name, the rows and their cases.

## Task 3 — interfaces-adt: docs and release

**Tests first:** if a doc shows a type group example, a `src/__typechecks__/` fixture compiles it,
as `docExamples33.ts` does for its release.

**Files:**
- `README.md` and the package docs, wherever they list API names, atoms or rows.
- `docs/architecture/`, wherever it lists atoms.
- `CHANGELOG.md`: the minor's entry, dated on the day of each edit.
- `package.json`: the next minor (see "Versions").
- The root `package-lock.json`: `npm install --package-lock-only`.

**Commits:** the docs; then the CHANGELOG, the version and the lockfile.

**Then:**
1. Codex reviews the PR, then the owner.
2. The PR is merged and tagged, and the owner publishes.
3. A clean install from the registry, outside the repository, proves it: the version resolves,
   and `ADT_TYPES_CLOUD.typeGroup` carries the cloud row.

Nothing in adt-clients goes on before this.

## Task 4 — adt-clients: the published contract, a buildable milestone

This task takes the new contract and adds what every exhaustive map over `AdtApiName` needs, so
that `test:check` compiles: the address, the types, an `AdtTypeGroup` that declares no atom yet,
and the factory.

**Tests first:**
- **`endpoints/typeTables.test.ts`.** The rows' evidence names a typestructure case of its
  release, and `nameMaxLength` equals that case's `OBJNAME_MAXLENGTH`.
- **`endpoints/objects.test.ts`.**
  - `TYPE_GROUP.uri('ZTg1')` keeps the name's case, and `TYPE_GROUP.uri('Z/1')` encodes it.
  - `.collection` and `.validation` are the measured paths.
- **`clients/handlerFactories.test.ts` and `factoryStrategy.test.ts`.** `getTypeGroup()` answers
  an `AdtTypeGroup`, with and without a result set.
- **`helpers/typeTableConformance.ts` (`HANDLER`).** `typeGroup: (c) => c.getTypeGroup()`.
  - The conformance cases for type groups (`conformance/typeTablesConformance.test.ts`) are
    **known red** until Task 7. The rows list operations whose members do not exist yet.

**Files:**
- `packages/adt-clients/package.json`: the `@mcp-abap-adt/interfaces-adt` range raised to the
  published minor.
- The root `package-lock.json`: regenerated by npm only (`npm install --package-lock-only`, then
  `npm ci --ignore-scripts`). Checked for any `"link": true` but the workspace siblings.
- `src/endpoints/objects.ts`: the `TYPE_GROUP` record (spec 3.1, no `seg`), in the records list.
- `src/constants/contentTypes.ts`: `ACCEPT_TYPE_GROUP`.
- `src/core/typeGroup/types.ts`: `typeGroupDocuments` and the snake_case params.
- `src/core/typeGroup/AdtTypeGroup.ts`:
  - `TypeGroupValues`;
  - the class with its generics, constructor, lock tracker and `name()`.
- `src/core/typeGroup/index.ts`.
- `src/clients/AdtClient.ts`: `getTypeGroup()`, two overloads, gated `AdtServedBy<'typeGroup'>`.
- `src/__tests__/helpers/typeTableConformance.ts`: the `HANDLER` entry.

**Commits:**
1. the range and the lockfile;
2. the record and the constant;
3. the types, the class and the factory.

## Task 5 — the reads and validation

**Tests first** (`unit/core/typeGroup/typeGroup.test.ts`, against a recording connection and the
corpus recordings):
- **Requests.** `validate`, `readMetadata`, `read`, `getVersions` and `getVersionSource` each send
  exactly one request, the one in spec 3.2's table: URL, method, every header, no body.
- **Names.**
  - A mixed-case name arrives unchanged in the path and the query.
  - A name longer than 5 characters is sent as given, with no refusal of the library's own.
- **Headers and query.**
  - `readMetadata`'s Accept defaults to v3, and `options.accept` replaces it.
  - `version` and `withLongPolling` go into the query as the table says.
- **Timeout.** Each member hands its `timeout` option to the request (`withCallTimeout`).
- **Answers.** Each member answers its corpus recording through `typeGroupDocuments` unchanged.
  Validation's empty 200 is no failure; its 400 `InvalidTypeGroupName` is a failure carrying the
  response.
- **Strategies.**
  - A custom result set: each member answers what that set's slot made of the answer.
  - A caller's `analyse` is called once with that answer, and its verdict is the result's.

**Files:**
- `src/core/typeGroup/validation.ts`, `read.ts`, `versions.ts`;
- the members in `AdtTypeGroup.ts` with their atoms' overload pairs: `IAdtValidatable`,
  `IAdtMetadataReadable`, `IAdtReadable`, `IAdtVersionable`.

**Commits:** validation; the metadata and source reads; the versions.

## Task 6 — create, the source write, lock and unlock

**Tests first** (same file):
- **`create`** sends spec 3.2's single request and body:
  - the caller's header pair as given;
  - the name, the package and the description exactly as given, XML-escaped;
  - a name over 5 characters, and a description over 70, sent whole;
  - the language attributes and `sap-language` only with `masterLanguage`;
  - `corrNr` only with `transportRequest`.
- **`update`** sends one PUT:
  - with `lockHandle`, `corrNr` only when given, and `If-Match` only when given;
  - with the caller's header pair, and the source exactly as given as the body.
- **`lock`** sends one LOCK, stateful for that request, and is stateless after it. It answers the
  handle from the corpus lock body, `''` from a body without one, and records the handle in the
  client's lock registry.
- **`unlock`** sends one UNLOCK, stateful for that request, answers nothing, and releases the
  handle in the registry.
- **Session.** Nothing but `lock` and `unlock` touches the session type
  (`capabilities/behaviour.test.ts`).
- **The same as Task 5** for each of these members: timeout, corpus answer, custom result set,
  `analyse` once.

**Files:**
- `create.ts`, `update.ts`, `lock.ts`, `unlock.ts`;
- the members in `AdtTypeGroup.ts`:
  - `IAdtCreatable`, `IAdtUpdatable` and `IAdtLockable`;
  - `lock` through `inStatefulSession` and `lockHandleOf`, with the tracker;
  - `unlock` with `nothing`;
  - each gated `AdtPerformedBy<'typeGroup', …>`.

**Commits:** create; the source write; lock and unlock.

## Task 7 — activation and delete

**Tests first:**
- **`activate`** sends exactly one request: the activation POST with the caller's pair and the
  measured body, naming `TYPE_GROUP.uri(name)` and the name as given.
  - It sends nothing after any checklist, including `activationExecuted="false"` with no
    message.
  - `analyse` gets no `context`.
- **`delete`** sends exactly one `DELETE …?lockHandle=…`, with `corrNr` only when given and the
  caller's pair. Without `lockHandle` it does not compile (a typecheck case).
- **The same as Task 5** for both: timeout, corpus answer, custom result set, `analyse` once.
- **The behaviour guard** (`capabilities/behaviourGuard.ts`):
  - `invoke` and `invokeWithOptions` pass `lockHandle: 'GUARD-LOCK'` to `delete` on a handler
    whose manifest names `lockedDeletable`;
  - the call to `delete` of every `deletable` handler is unchanged;
  - a guard test shows both paths.
- **The capability manifest** (`capabilities/manifest.ts`): the atom
  `lockedDeletable: ['delete']`, and `typeGroup` with its atoms.

**Files:**
- `activation.ts`, through `activateObjectInSession`;
- `delete.ts`;
- the members in `AdtTypeGroup.ts`: `activate` through `answering`, and `delete` as
  `IAdtLockedDeletable`, both gated;
- `behaviourGuard.ts` and `manifest.ts`.

**Known red turned green:** the type group conformance cases of Task 4.

**Commits:** the guard's locked-delete path; activation; delete; the manifest.

## Task 8 — exports and variant gates

**Tests first:**
- **`clients/variantGates.test.ts`,** with typecheck fixtures under `src/__tests__/typechecks/`:
  - on the cloud client, `create`, `update`, `lock`, `unlock`, `activate` and `delete` of
    `getTypeGroup()` do not compile, and the rest do;
  - on the on-premise client every member compiles.
- **`publicApiSurface.test.ts`.** `AdtTypeGroup` and `typeGroupDocuments` are values of the root.
  A typecheck fixture imports `TypeGroupValues` from the package root.
- **`core/activatingApis.ts`.** The type group is an activation member that sends one request.

**Files:** `src/index.ts`, with the three exports.

**Commit:** the exports.

## Task 9 — the cross-cutting guards

**Tests first:** none new. These guards run over the new code and corpus, and stay green:
`onlyCorpusStrategiesShip`, `corpusCarriesNoIdentity`, `notesNameNoSystem`,
`noHardcodedObjectAddresses`, `typeCodeScan`, `noInputValidation`, `overloadPairs` and
`requestHeaders`.

**Files:** none, unless a guard finds a deviation. The fix then goes into the member or the
recording, never into the guard.

**Commit:** only the fixes, each its own.

## Task 10 — the live suite

**Tests first** (they are the suite): `integration/core/typeGroup/TypeGroup.test.ts`, with spec
5.3's cases.
- **On premise:**
  - one case per operation, in cycle order;
  - `expectLockReleased` after the write's unlock;
  - the transportable-package case with `corrNr`, and the metadata read with
    `withLongPolling=true`.
- **Cloud:** validation, the reads of `ABAP`, the version list, and a version's source.
- **Every case:** enabled by the variant's row; it logs SAP's status and message on failure, and
  its cleanup runs also on failure.

**Files:**
- `src/__tests__/helpers/test-config.yaml.template`: the `type_groups` section;
- `src/__tests__/helpers/overlays/onprem.yaml` and `cloud.yaml`: the empty forms of the new keys;
- `docs/development/TEST_CONFIG_SCHEMA.md`: the keys.

**Commits:** the config keys; the suite.

## Task 11 — live runs

Each run starts on the owner's go. The owner is told when the suite is ready.

**On premise:**
- `npm run test:detached -- integration/core/typeGroup`, with the on-premise session and an
  overlay that gives a transportable package and a transport.
- If `corrNr` or long polling on the metadata read is refused:
  1. it leaves the member and its tests, in a commit of its own;
  2. the run is repeated.

**Cloud:** the same suite with the cloud session and overlay.

**If a run shows a published row wrong**, the release stops, and the contract is released again
before adt-clients goes on:
1. the measurement for that operation is redone and committed to the corpus;
2. the row is corrected in a new interfaces-adt PR, with its typecheck case changed first, and
   a patch version in its CHANGELOG;
3. Codex and the owner review it, it is merged and tagged, the owner publishes, and a clean
   install from the registry proves the corrected row;
4. adt-clients raises its range to that patch and regenerates the lockfile, with the link check;
5. the members' gates, the unit tests and both live suites run again before Task 12.

**Commit:** only the fixes a run needs, each its own.

## Task 12 — adt-clients docs and version

**Tests first:**
- `check:docs` (`docsImportsResolve`): every name the docs import exists.
- `notesNameNoSystem`: no system is named.

**Files:**
- `README.md`: the type group in the object and factory lists, its members per variant, and its
  one-request activation.
- `docs/usage/CLIENT_API_REFERENCE.md` and `ADT_OBJECT_ENTITIES.md`: the members and requests.
- `docs/usage/ERRATA.md`: the four entries of spec 7.
- `docs/architecture/`, wherever it lists object types or atoms.
- `CHANGELOG.md`: the minor's entry, dated on the day of each edit.
- `packages/adt-clients/package.json`: the next minor (see "Versions").
- The root `package-lock.json`: `npm install --package-lock-only`, then the link check.

**Commits:** the README and usage docs; ERRATA; the CHANGELOG, the version and the lockfile.

## Task 13 — release gate and hand-off

**Checks:**
- At the root, `npm run check`, plus each package's `build`, `lint:check`, `test:check` and
  `test:unit`.
- Every `package.json` of the release declares only semver ranges, and every range resolves on
  the registry.
- The lockfile holds no link but the workspace siblings.
- The PR's CI is green after the last push.

**The documents leave.** The goal, the spec and the plan are deleted in a commit of their own.
What they still owe goes into the PR description first:
- mcp-abap-adt's type group tools;
- the later task for the check run, deletion check, metadata write and transport;
- 7.40, in the legacy-coverage task.

**Then:**
1. Codex reviews, then the owner.
2. Once approved, the PR is merged and tagged `adt-clients-v<version>`, and the publish checkout
   is prepared.
3. The owner publishes.
4. A clean install from the registry, outside the repository, proves it.
5. mcp-abap-adt takes the release in its own change.
