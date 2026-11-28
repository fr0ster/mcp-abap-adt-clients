# C7 split — one member, one endpoint, one request (adt-clients 49.0.0)

The owner's rule: one adt-clients method, one endpoint, one request. #304's C7
inventory left two kinds of member that still send two requests, and the owner
has approved splitting both:

1. **Every activation member** reads `GET /sap/bc/adt/activation/inactiveobjects`
   after a checklist that does not state its outcome (`activationExchange`,
   `src/utils/activationUtils.ts`). After the split it sends the activation
   request alone. The list is read by the member that already exists,
   `AdtUtils.getInactiveObjects`. The caller (mcp-abap-adt) composes the two.
2. **`AdtTableSettings.patchMetadata`** sends the GET and then the guarded PUT
   (interfaces-adt decision 51). After the split there is a separate read
   (`readMetadata`, which exists), a pure patch that sends no request, and a
   separate update (`updateMetadata`, which exists). The read, patch and write
   sequence goes to mcp-abap-adt, as the message class recipe did in 48.0.0.

Both change the public API: **adt-clients 49.0.0**. The plan is steps, not code.
Signatures are given where the API changes. Every step that changes behaviour
starts with a test that fails first. Each logical change is its own commit.

## Paths every package of the release takes

| Package | Now | After | Why |
|---|---|---|---|
| `@mcp-abap-adt/interfaces-adt` (other repo) | 33.0.0 | **34.0.0** | the patch contract is removed; decision 51 is superseded |
| `@mcp-abap-adt/adt-clients` | 48.0.0 | **49.0.0** | the owner's major |
| `@mcp-abap-adt/adt-strategies` | 0.29.0 | **0.30.0** (to confirm) | takes over the reading of when the list is needed |
| `@mcp-abap-adt/adt-clients-legacy` | 0.12.0 | **0.13.0** (to confirm) | `answeringActivation` is gone; adt-clients `^49.0.0` |

Order of publication: interfaces-adt 34.0.0 → adt-strategies → adt-clients →
adt-clients-legacy (the repository's `publishOrder`). Nothing builds against an
unpublished interfaces-adt: the step that moves the three packages onto `^34.0.0`
waits until 34.0.0 is on the registry.

### Dependency ranges and the registry gates

R1. **Ranges.** All three packages move to interfaces-adt `^34.0.0`.
    adt-clients' devDependency and legacy's dependency on adt-strategies both
    move from `^0.29.0` to `^0.30.0`, because `^0.29.0` excludes 0.30.0.
    Legacy moves to adt-clients `^49.0.0`. Each change runs
    `npm install --package-lock-only` at the root, with the lockfile in the same
    commit.
R2. **A registry gate per package, before each step that needs it.**
    - Before R1's interfaces-adt step: `npm view @mcp-abap-adt/interfaces-adt@34.0.0 version`
      answers 34.0.0.
    - At the release, before each package publishes: every range it declares
      resolves on the registry (`npm view <dep>@<range> version`). Its siblings
      in this release resolve only after they are published, in `publishOrder`.
    - A package whose dependency does not resolve yet waits. It is never
      published against a workspace link. If the registry lags, the result is
      "not visible yet" and there is no republish.
R3. **The lockfile** after every install: no `"link": true` except the three
    workspace siblings (CLAUDE.md, "Code Standards"), and every third-party
    entry `resolved` from `registry.npmjs.org`. A `package.json` in the release
    has no `file:`, `link:` or `workspace:` specifier.
R4. **A clean install after publishing.** In an empty directory outside the
    repository: `npm init -y`, then
    `npm install @mcp-abap-adt/adt-clients@49.0.0 @mcp-abap-adt/adt-strategies@0.30.0 @mcp-abap-adt/adt-clients-legacy@0.13.0 --ignore-scripts`.
    The installed tree must hold interfaces-adt 34.x. A `require` of each
    package's entry point must load.

## Part A — interfaces-adt 34.0.0 (its own PR in mcp-abap-adt-interfaces)

A dependency in another repository, so it needs its own PR. It holds types and
documentation only.

A1. **Remove the patch contract** from `src/adt/IAdtTableSettings.ts` and from
    `index.ts`: `IAdtTableSettingsPatchable`, `ITableSettingsPatchConfig`,
    `IAdtTableSettingsPatchHeaders` and `IAdtTableSettingsPatchOptions`. Keep
    `ITableSettingsChangesOf<V>` / `ITableSettingsChanges` (the pure patch takes
    them), `TABLE_SETTINGS_MEDIA_TYPE`, `ITableSettingsReadOf<V>` and
    `ITableSettingsUpdateConfig<V>`. Move the measured facts that sat on the
    patch's JSDoc (SAP resets a setting left out; the charset beside `If-Match`
    is answered `412 SADT_RESOURCE/043`; the area-key count is cleared when the
    type is not `G`) to `IAdtTableSettingsUpdatable` and `ITableSettingsChangesOf`,
    with their tags.
A2. **`__typechecks__/tableSettings.ts`**: remove the patcher cases. Keep the
    change-set cases (`{}`, `{ buffering: {} }`, the cloud-only
    `isWritableByAMDP`).
A3. **`IAdtAnalyseContext.activation`** (`src/adt/IAdtObject.ts`): the type stays.
    Its JSDoc changes from "only a member that activates fills it" to: no
    member fills it; a caller that read the inactive list after an activation
    hands it to its `analyse` itself. Do the same for the sentence at
    `IAdtUtilities.ts:788`.
A4. **Decision 53** in `docs/architecture/DECISIONS.md`: "A table settings
    change is the caller's read, patch and write". It supersedes decision 51
    and records the owner's rule. It moves the freshness argument of decision 51
    to the caller: a read made under the lock, right before the PUT, with that
    read's ETag as `If-Match`. Its "what would change it" is decision 51's
    condition. Mark decision 51 superseded, and keep its text.
A5. README (the line-20 summary and "A table's technical settings"), CHANGELOG
    34.0.0 with a migration note (`patchMetadata` → `readMetadata` +
    `patchTableSettings` + `updateMetadata`), and the version bump with the
    regenerated lockfile.

## Part B — adt-clients 49.0.0: `activate` sends the activation alone

### Members whose signature does not change, whose behaviour does

Every member that runs through `answeringActivation` today, 28 in all: each
object handler's `activate` (access control, append structure, authorization
field, behavior definition, class and its includes (`AdtClassMemberBase`), data
element, DDL, domain, enhancement, feature toggle, function group, function
include, function module, include, interface, metadata extension, program,
scalar function and its implementation, service, service definition, structure,
table, table type, transformation), `AdtClass.activateTestClasses` and
`AdtUtils.activateObjects`. Each sends `POST /sap/bc/adt/activation` once and
answers it through `answering`. Its `analyse` is called with
`(verdict, answer)` and never with a third argument.

### Removed

- `answeringActivation` (exported from `index.core.ts` for the legacy
  overrides) and the private `activationExchange` and `keepingRequests`
  (`src/utils/activationUtils.ts`).
- `src/utils/activationReading.ts` (`unstatedOutcome`, `namedIn`,
  `severityLetter`, the copy of adt-strategies' `severity()`). After the split the
  client reads nothing of an activation's answer.

### Steps

B1. **A failing test first:** `capabilities/behaviour.test.ts` gets the
    assertion "issues exactly one request" for every manifest member, and its
    existing endpoint checks stay. A test of its own goes in
    `unit/utils/activationOneRequest.test.ts` and runs each of the 28 members
    against two recorded answers from `corpus/adt/answers/`: a silent checklist
    (`activationExecuted="false"` with no message) and an unstated one (no
    `activationExecuted` and one `W`). For each, it asserts exactly one recorded
    request: method `POST`, URL `/sap/bc/adt/activation?method=activate…`
    (`activateObjects` included). It also asserts that `analyse` was called
    with no third argument. The test is red on 48.0.0, which sends a second
    request (`GET …/inactiveobjects`). `patchMetadata` is not in the
    capability manifest; Part C's C0 covers it.
B1a. **The URIs a member sends, pinned for the consumer.** Today `named` comes
    from the POST body. After the split, the consumer builds the URIs itself
    with the exported `buildObjectUri`. A unit test,
    `unit/utils/activationNamesItsUris.test.ts`, takes each activation path on a
    recording connection and compares the POST body's `adtcore:uri` values with
    `buildObjectUri(code, name, parent)` for the same arguments. The paths are:
    each of the 28 members, a parented object (`FUGR/FF`, `FUGR/I`), the class
    includes and `activateTestClasses`, a multi-object `activateObjects`, the
    legacy `AdtFunctionGroupLegacy` override (in legacy's tests), and the
    irregular codes (`GROUP_ONLY_ADDRESS_OF`, `VIEW/DV`). Where a member sends
    some other URI (a class include naming its class, say), the test records
    the fact. The member's JSDoc then names the URI it sends, and the consumer
    recipe (H2) uses that rule; it is not guessed. With the URIs pinned, a
    mismatch cannot report a still-inactive object as activated.
B2. Every member moves from `answeringActivation` to `answering`, one commit per
    group of handlers. Then remove `answeringActivation`, `activationExchange`,
    `keepingRequests` and the `fetchInactiveObjects` import from
    `activationUtils.ts`.
B3. Delete `activationReading.ts` and its tests (`activationReading.test.ts`,
    `activationEquivalence.test.ts` (the pin of the severity copy against
    adt-strategies), `activationRead.test.ts`), and their entries in
    `parserReadings.test.ts.snap`. Before the deletion, every case is moved, so
    none is lost:
    - The cases about the reading (which checklists leave the outcome unstated,
      the severity table) go to adt-strategies' tests (Part D).
    - The cases about the composition go to an inventory in this plan's PR
      description and are written again in the mcp-abap-adt follow-up (H2).
      They cover: the read after a silent or an unstated checklist, a refused
      read, a read with no response, analysis with and without `analyse`, the
      session mark (which answer's mark the result carries), and a credential
      refusal SAP never saw, thrown as it came.
    - The recorded answers they use stay in `corpus/adt/answers/`.
B4. `publicApiSurface.test.ts`: remove `answeringActivation`.
    `consumerSequencesStayOut.test.ts`: add `answeringActivation` to the names
    that must not come back as an export.
B5. **Proof that it is load-bearing:** put the list read back into one member and
    watch B1 go red. Then revert.

## Part C — adt-clients 49.0.0: the table settings, read, patch and write

### Removed

- `AdtTableSettings.patchMetadata` (all three overloads) and the exported type
  `TableSettingsPatchConfig<V>`.
- The constructor option `variant: 'cloud'` (`TableSettingsVariantOption<V>`) and
  the field `declaredCloud`: the patch's cloud check was their only reader. The
  type parameter `V` stays, and `AdtClientCloud.getTableSettings` keeps typing
  the handler `'cloud'`. A direct construction passes no `variant`.
- `src/core/tableSettings/readDocument.ts`: the library's own second reading of
  the settings document. After the split the caller's read is a strategy's
  (adt-strategies `tableSettings` / `cloudTableSettings`, decision 15), and
  those readings are already strict: every setting or a throw naming the one
  missing, and on the cloud `isWritableByAMDP` or a throw.
- The runtime top-level check `namesASetting`, pending the owner's ruling
  (see "Open points"): `ITableSettingsChangesOf<V>` (`AtLeastOne`) already
  refuses an empty change set at compile time.
  **The question to answer: inside adt-clients, does `changes` ever come from
  outside the type system?** No. `changes` reaches the library only as the
  typed argument of `patchMetadata` today and of `patchTableSettings` after the
  split. adt-clients builds no change set from a document, a network answer,
  a file, the environment or user input, and it parses no tool argument. A
  change set that comes from outside the type system, such as an MCP tool's
  JSON, is built and checked in mcp-abap-adt (`changesOf` / `cloudChangesOf`
  and `writeOrRefuse` in `handleUpdateTableSettings.ts`), where H3 keeps the
  "names no setting" refusal and tests it. Under the owner's rule (a runtime
  check only for values from outside the type system) the check therefore
  leaves the library. Its test, `tableSettings.test.ts`, "names no setting",
  moves to H3. If the owner rules to keep it, it goes into
  `patchTableSettings` as an `ok: false` refusal `names-no-setting`, with its
  own test, and the rest of the plan does not change.

### Added

A pure function, exported from `index.core.ts` beside the `patch<Type>Document`
functions (decision 19). It sends no request:

```
patchTableSettings<V extends AdtModernVariant>(
  read: { readonly description: string; readonly settings: ITableSettingsReadOf<V> },
  changes: ITableSettingsChangesOf<V>,
): TableSettingsPatch<V>

type TableSettingsPatch<V> =
  | { readonly ok: true;  readonly description: string; readonly settings: ITableSettingsReadOf<V> }
  | { readonly ok: false; readonly reason: 'area-key-fields-need-type-g'; readonly message: string }
```

`read` is what adt-strategies' `tableSettings` (on premise) or
`cloudTableSettings` (cloud) answers. Its `etag` is not taken here; the caller
passes it to `updateMetadata` as `ifMatch`. The overlay is today's
`mergeSettings`: a setting not named keeps the value read, `buffering` is
overlaid field by field, `translation` by its `value`, and the cloud's
`isWritableByAMDP` is written as read unless named. One refusal stays, an
`areaKeyFields` change whose resulting type is not `G`. The type of `read`
decides by variant whether `isWritableByAMDP` is there. The patch's answer
goes straight into `updateMetadata`'s
`ITableSettingsUpdateConfig<V>` together with `tableName` and
`transportRequest`.

Unchanged: `readMetadata`, `updateMetadata` (it already drops the charset when
`ifMatch` is given), `lock` and `unlock`.

### Steps

C0. **The second request, shown before it goes:** a recording-connection test
    in `tableSettings.test.ts` asserts that 48.0.0's `patchMetadata` sends two
    requests (the `GET`, then the `PUT`). It is green on 48.0.0 and is the
    oracle of the split, as 43c was for the message class. C3 deletes it along
    with the member, and C4's three-call test replaces it.
C1. **A failing test first:** `unit/core/tableSettings/patch.test.ts` runs
    `patchTableSettings` on the reads of both releases' recorded documents
    (`corpus/adt/documents/`, read through the strategies). Cases: every rule
    of the overlay, the `G` refusal, and the cloud `isWritableByAMDP` kept and
    changed. A typecheck goes in `typechecks/exact/tableSettingsVariants.ts`: an
    on-premise read with `isWritableByAMDP` and an empty change set do not
    compile, and the cloud patch's answer is assignable to
    `ITableSettingsUpdateConfig<'cloud'>`. All red until C2.
C2. Add `patchTableSettings` in `src/core/tableSettings/patch.ts` (the body of
    `merge.ts`, reshaped). Export it and its answer type, and remove `merge.ts`.
C3. Remove `patchMetadata`, `TableSettingsPatchConfig`, the `variant` option,
    `declaredCloud`, `readDocument.ts` and `namesASetting`. Change the callers
    inside the repository: `AdtClient.getTableSettings` and
    `AdtClientVariants.ts` (the construction and the JSDoc), and legacy's
    `absentHandlers.ts` (the `patchMetadata` override, its snapshot and
    `legacyMembers.ts`).
C4. Convert the unit `patchMetadata` cases in `tableSettings.test.ts` to the
    caller's three calls on a recording connection (on the wire), each call
    counted on its own:
    - `readMetadata` makes exactly one request: the GET with the v2 Accept.
    - `patchTableSettings` makes zero requests. The connection's record is
      unchanged across the call, and the test also runs it with no connection
      at all.
    - `updateMetadata` makes exactly one request: the PUT with `If-Match`
      equal to the recorded ETag, `Content-Type` with no charset, `lockHandle`
      and `corrNr`, and the whole document.
    `updateMetadata`'s existing empty-lock-handle throw stays in the library,
    with its test: it is the guard of the one request it sends.
C5. `publicApiSurface.test.ts`: add `patchTableSettings`, remove
    `TableSettingsPatchConfig`. `noRegexInDocumentPatches.test.ts` covers the
    new file.
C6. Load-bearing proof: break each overlay rule and the `G` refusal one at a
    time and watch its own case go red, with a unique assertion for each
    (memory: mutate each half). Then revert.

## Part D — adt-strategies 0.30.0

D1. **One classification, shared.** `readActivationRefusal`
    (`src/refusals/read.ts`) already decides the two cases where the list
    decides: `declaredNotActivated && messages.length === 0`, and
    `unstated && messages.every(LIST_DECIDES_BESIDE)`. That predicate moves
    into one internal function of adt-strategies over the parsed checklist,
    answering `'silent' | 'unstated' | undefined`, and `readActivationRefusal`
    calls it in place of its two inline conditions. A refactor with no change
    in behaviour: the existing activation tests stay green across it.
D2. **Export it as a reading of the wire answer:**
    `readUnstatedActivation(answer: IAdtWireResponse): 'silent' | 'unstated' | undefined`.
    It answers `undefined` for a non-2xx status or a document that is not
    `chkl:messages`, and otherwise the shared function's answer. There is no
    second predicate and no copy of `severity()`. Its tests are the cases moved
    in B3. A test pins that the two agree: on every recorded checklist,
    `readUnstatedActivation` answers non-`undefined` exactly when
    `readActivationRefusal` without a list answers "could not be decided". A
    mutation of the shared predicate turns both red.
D3. `analyseActivation` and `analyseAny` keep their behaviour: they read
    `context.activation` when the caller hands it. Their JSDoc changes from
    "the member hands" to "the caller hands, after reading the list itself".
    The README changes the same way (see G7). So does ERRATA.md (adt-strategies'
    copy is built from adt-clients' `docs/usage/ERRATA.md`).
D4. Move onto interfaces-adt `^34.0.0` once it is published (Part A, R2).
    CHANGELOG 0.30.0.

## Part E — adt-clients-legacy 0.13.0

E0. **A failing test first:** `legacyActivation.test.ts` asserts that after a
    silent checklist the override records exactly one request, the POST, and
    that its `analyse` gets no context. It is red before E1, because 0.12.0
    reads the list.
E1. `AdtFunctionGroupLegacy`'s activation override goes from
    `answeringActivation` to `answering`, so it sends one request and E0 turns
    green. The override's URIs are in B1a.
E2. `absentHandlers.ts` (see C3). `docs/LEGACY.md`: the inactive-list line. The
    dependency becomes adt-clients `^49.0.0` and interfaces-adt `^34.0.0`. CHANGELOG
    0.13.0.

## Part F — integration tests (live)

The library's integration tests are consumers, so each composes what it needs:

F1. `integration/shared/activationAnswers.test.ts` and every suite that judges an
    activation by the list: a test helper, `helpers/activationJudged.ts`.
    It runs `activate`, then `readUnstatedActivation`, then
    `getUtils().getInactiveObjects()` when the reading says so, then
    `analyseActivation(verdict, answer, { activation: { named, inactiveObjects } })`,
    with `named` built by `buildObjectUri`. The suites that only need the
    activation's own verdict are left alone.
F2. `integration/core/tableSettings/TableSettings.test.ts`: the cycle LOCK →
    `readMetadata` (working area, `cloudTableSettings` on the cloud) →
    `patchTableSettings` → `updateMetadata` with `ifMatch` → UNLOCK → activate the
    table, then read back what SAP stored: every setting not named is unchanged,
    and on the cloud `isWritableByAMDP` is kept.
F3. Live runs, by `npm run test:detached`: **on premise** and **cloud** each run
    the full integration suite, because every activating member changed and this
    is a major (memory: failing tests are fixed before a release). Each run's log
    is checked for every failure, and each failure is fixed before the tag. The
    legacy live cycles (`packages/adt-clients-legacy`, `npm run test:live`) run on
    the legacy system for E1. Live runs need the owner's go.

## Part G — documentation

G1. `packages/adt-clients/CLAUDE.md` is the controller's to change, with the
    owner's approval of the text, and is not edited in this PR's code steps. Its
    "One endpoint, one member" paragraph ("The one exception is activation …")
    and the table-settings mention are listed in the PR for that approval.
G2. README: the "One endpoint, one member" text; "Activation: what activated, and
    which endpoint" (the client sends one request, and the read and its use are
    the caller's, with the recipe); the table settings section (lines around
    36, 850, 993 and 1033): `patchMetadata` becomes the three calls with
    `patchTableSettings`; the class comment's example in `AdtTableSettings.ts`
    becomes the same.
G3. `docs/usage/CLIENT_API_REFERENCE.md` (the activation context, the settings),
    `docs/usage/ERRATA.md`, `docs/architecture/DECISIONS.md`: a new adt-clients
    decision, "An activation sends the activation alone". It supersedes the
    exception kept for fr0ster/mcp-abap-adt#351/#360, and the table-settings
    entry points to interfaces-adt decision 53. `docs/usage/MIGRATION-45.md`
    stays as it was, since it is history. Its pointer goes in the new note.
G4. **`docs/usage/MIGRATION-49.md`**, the migration note:
    - an activation no longer reads the inactive list: a caller that relied on
      `analyseActivation` deciding a silent or unstated checklist calls
      `readUnstatedActivation` (adt-strategies), `getInactiveObjects` and
      `analyseActivation` with the context itself, with the recipe;
    - `answeringActivation` is gone: a handler class built on the package uses
      `answering`;
    - `patchMetadata` is gone: under the lock, `readMetadata`
      (`version: 'inactive'`, the `tableSettings` / `cloudTableSettings`
      strategy) → `patchTableSettings` → `updateMetadata` with `ifMatch: read.etag`,
      with the recipe; a read with no ETag is the caller's to refuse;
    - the `variant` constructor option of `AdtTableSettings` is gone.
    - the runtime validation that moved: the library no longer refuses, at
      run time, a read with no ETag, an incomplete settings document, a cloud
      read without `isWritableByAMDP` or (pending the ruling) a change set that
      names no setting. The caller checks each before `updateMetadata`, as the
      recipe shows. `updateMetadata` still throws on an empty lock handle.
      `patchTableSettings` still refuses an `areaKeyFields` change whose type
      is not `G`. On the cloud, `cloudTableSettings` throws on a read without
      `isWritableByAMDP`.
G5. CHANGELOG 49.0.0 (dated on every edit, the date checked on the release day),
    with the breaking changes and the pointer to MIGRATION-49. The versions of
    strategies and legacy are confirmed with the owner before the entries are
    written (CLAUDE.md: ask which version).
G7. **A repository-wide audit of the prose.** `check:docs` checks only the
    imports, so a search of the three packages finds every sentence about the
    old contract, and each one is changed or removed. The search covers
    `src/**/*.ts` JSDoc, `README.md`, `docs/**`, `scripts/**`,
    `src/__tests__/README.md` and `docs/development/` (`RUNNING_TESTS.md`,
    `BUILDER_TEST_PATTERN.md`), and each package's README and docs. It matches
    `inactiveobjects`, `inactive list`, `IAdtAnalyseContext`,
    `context.activation`, `answeringActivation`, `patchMetadata`,
    `TableSettingsPatchConfig` and `one exception`. Named already:
    - the `AdtUtils.activateObjects` JSDoc ("the inactive list is read once
      and handed to `analyse`");
    - the `AdtClient.getTableSettings` JSDoc;
    - adt-strategies' README prose (lines around 127 and 157, the `readAdtRefusal`
      row at 175, and any example that relies on a member handing the list);
    - the testing docs and the examples that show an activation judged by the
      list.
    The search's hits go in the PR as a checklist, each ticked with its commit.
    Released CHANGELOG entries and old MIGRATION notes stay as they are.
G6. `npm run check:docs` (every name the docs import exists) and the root
    `npm run check` before the PR leaves draft. Then `docs/superpowers/` loses
    this plan before the release, and what it still owes goes into the PR
    description.

## Part H — the consumer follow-up in mcp-abap-adt (its own PR, after 49 is published)

Its own repository, task and PR, opened once adt-clients 49.0.0, adt-strategies
0.30.0 and interfaces-adt 34.0.0 are on the registry. It never builds against
the unpublished packages.

H1. Dependencies: adt-clients `^49.0.0`, adt-strategies `^0.30.0`, interfaces-adt
    `^34.0.0`. Check the lockfile for `"link": true` and for anything not
    resolved from the registry.
H2. **One activation recipe** in mcp-abap-adt (for example
    `src/lib/activation/activateJudged.ts`), used by every handler that
    activates today with `analyse: analyseActivation`: 55 files in `src`
    (`handleActivateObject` and every high-level create, update and delete
    handler that activates). It:
    1. sends the member's activation with an `analyse` that records the
       **original starting verdict** (the library's own, before any strategy)
       and the activation's answer. The decision is not made there: the
       recipe calls `analyseActivation` itself, once, in step 3;
    2. when `readUnstatedActivation(answer)` answers `silent` or `unstated`, it
       reads `getUtils().getInactiveObjects()`, keeping the answer whole, a
       refusal's response included. A credential refusal SAP never saw, which
       either request throws, propagates unchanged: the recipe does not catch
       it;
    3. answers `analyseActivation(startingVerdict, activationAnswer, { activation: { named, inactiveObjects } })`.
       `named` follows the rule B1a pinned for that member (`buildObjectUri`
       for the code, name and parent the member was given, or the URI B1a
       recorded). The two responses keep their roles: the activation's answer
       is what a cleared verdict is read from, and the list is only a fact;
    4. keeps 48.0.0's behaviour when the read fails. After `silent`, the call
       fails with the read's cause and response, worded as 48.0.0 worded it
       ("The activation's outcome could not be decided: …"). After `unstated`,
       the starting verdict stays, with the refusal's response as the list, or
       no context when no response came back;
    5. keeps the session marks as 48.0.0 set them. A failure built from the
       read carries the read's code and no activation mark. A cleared success
       carries the activation answer's mark. A marked read after an unmarked
       activation leaves no mark on the answer.
    Its unit tests are the composition cases B3 inventoried, rewritten over the
    recorded answers: the silent and unstated checklists, a refused read, a read
    with no response, with and without `analyse`, the three mark cases, and the
    credential refusal thrown as it came.
H3. **The settings recipe** in `handleUpdateTableSettings.ts`
    (`patchSettings` / `patchTableSettingsUnderLock`, and the compact
    `handleUpdateUnderLock` branch): under the caller's lock, `readMetadata`
    (`version: 'inactive'`, `tableSettings` on premise, `cloudTableSettings` on
    the cloud, through `adtClientOf`'s declared variant), then
    `patchTableSettings`, then `updateMetadata` with `headers` the media type
    with no charset and `ifMatch: read.etag`. The `.ts` header comment and the
    handler's tool description drop "the patch is adt-clients'".
    **Every guard the library's patch had is carried to the recipe.** Each gets
    a test that shows no PUT is sent:
    - an empty lock handle: refused before any request (`updateMetadata`
      throws as well, and the recipe refuses first);
    - a read that failed: its failure is answered, with no patch and no PUT;
    - an ETag missing or empty: refused, "nothing was written";
    - an incomplete document: the strict strategy's throw is answered as a
      failure, with no PUT;
    - a cloud read without `isWritableByAMDP`: `cloudTableSettings` throws, and
      the variant comes from `adtClientOf`, never from the answer;
    - a change set that names no setting: refused from the tool's input
      (`writeOrRefuse`), whatever the owner rules for the library;
    - an `areaKeyFields` change whose resulting buffering type is not `G`:
      `patchTableSettings`' `ok: false`, answered as a refusal.
H4. Live: the table settings tools and the activation tools on onprem and
    cloud, as the server's live coverage rules require. Its CHANGELOG and its
    docs follow the server's own release rules.

## Open points for the owner's review

- The plan's place: `docs/superpowers/plans/` per this repository's CLAUDE.md
  ("Plans and Specs"), not `docs/superpowers/`.
- The versions of adt-strategies (0.30.0) and adt-clients-legacy (0.13.0).
- `readUnstatedActivation` moves to adt-strategies. The reading has to live
  somewhere once the client reads nothing, and decision 15 puts readings in
  adt-strategies. The alternative: mcp-abap-adt reads the list whenever
  `analyseActivation` without context answers "could not be decided". That
  needs no new export, but it matches on a message.
- The `named` uris come from `buildObjectUri` in the consumer, because the
  consumer no longer sees the request body. The alternative: `analyseActivation`
  matches the list by name and type instead of by uri. That is a change to
  adt-strategies' reading, and needs its own measurement. B1a pins the
  `buildObjectUri` rule against every POST body first.
- The removal of the `variant: 'cloud'` constructor option. Strict cloud
  strategy selection stays (`cloudTableSettings`, chosen by the declared
  variant).
- The `namesASetting` runtime check: removal under "static types first"
  (`changes` never comes from outside the type system inside adt-clients; see
  Part C, "Removed"), or kept in `patchTableSettings` as a refusal. The review
  asked to keep it; the owner decides.
