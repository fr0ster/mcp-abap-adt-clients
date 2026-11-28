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
    assertion "issues exactly one request" for every manifest member. A test of
    its own goes in `unit/utils/activationOneRequest.test.ts`: each of the 28
    members, given a recorded silent checklist and a recorded unstated one
    (`activationExecuted="false"` with no message; no `activationExecuted` and one
    `W`, from `corpus/adt/answers/`), sends one request, the POST, and its
    `analyse` gets no context. Both are red on 48.0.0. `patchMetadata` is in the
    same assertion and stays red until Part C.
B2. Every member moves from `answeringActivation` to `answering`, one commit per
    group of handlers. Then remove `answeringActivation`, `activationExchange`,
    `keepingRequests` and the `fetchInactiveObjects` import from
    `activationUtils.ts`.
B3. Delete `activationReading.ts` and its tests (`activationReading.test.ts`,
    `activationEquivalence.test.ts` (the pin of the severity copy against
    adt-strategies), `activationRead.test.ts`), and their entries in
    `parserReadings.test.ts.snap`. Before the deletion, move every case they hold
    that is about the reading (which checklists leave the outcome unstated) to
    adt-strategies' tests (Part D), so no case is lost.
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
- The runtime top-level check `namesASetting`: `ITableSettingsChangesOf<V>`
  (`AtLeastOne`) already refuses an empty change set at compile time.

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
    caller's three calls on a recording connection (on the wire): the GET with
    the v2 Accept, then the PUT with `If-Match` equal to the recorded ETag,
    `Content-Type` with no charset, `lockHandle` and `corrNr`, and the whole
    document. Two requests from two members, each counted.
C5. `publicApiSurface.test.ts`: add `patchTableSettings`, remove
    `TableSettingsPatchConfig`. `noRegexInDocumentPatches.test.ts` covers the
    new file.
C6. Load-bearing proof: break each overlay rule and the `G` refusal one at a
    time and watch its own case go red, with a unique assertion for each
    (memory: mutate each half). Then revert.

## Part D — adt-strategies 0.30.0

D1. **Export the reading of when the list is needed**, which until now was
    adt-clients' private copy:
    `readUnstatedActivation(answer: IAdtWireResponse): 'silent' | 'unstated' | undefined`.
    It is the same table: a 2xx `chkl:messages` with `activationExecuted="false"`
    and no message is `silent`; one with no `activationExecuted` and only
    `W`/`I`/`S` messages (read by `severity()` itself, so no copy is left) is
    `unstated`; anything else is `undefined`. Its tests are the cases moved in B3.
D2. `analyseActivation` and `analyseAny` stay as they are: they read
    `context.activation` when the caller hands it. Their JSDoc and the README
    row change from "the member hands" to "the caller hands, after reading the
    list itself". ERRATA.md (adt-strategies' copy is built from adt-clients'
    `docs/usage/ERRATA.md`).
D3. Move onto interfaces-adt `^34.0.0` once it is published (Part A). CHANGELOG
    0.30.0.

## Part E — adt-clients-legacy 0.13.0

E1. `AdtFunctionGroupLegacy`'s activation override goes from
    `answeringActivation` to `answering`, so it sends one request.
    `legacyActivation.test.ts` asserts one request after a silent checklist.
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
G5. CHANGELOG 49.0.0 (dated on every edit, the date checked on the release day),
    with the breaking changes and the pointer to MIGRATION-49. The versions of
    strategies and legacy are confirmed with the owner before the entries are
    written (CLAUDE.md: ask which version).
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
    1. sends the member's activation with an `analyse` that keeps the starting
       verdict and the answer and answers through `analyseActivation`;
    2. when `readUnstatedActivation(answer)` answers `silent` or `unstated`, it
       reads `getUtils().getInactiveObjects()` (the answer kept whole, a
       refusal's response included);
    3. answers `analyseActivation(verdict, answer, { activation: { named, inactiveObjects } })`,
       with `named` from `buildObjectUri` for the same code, name and parent the
       member was given (`activateObjectCarriesUri.test.ts` already pins that
       equality for `handleActivateObject`);
    4. keeps 48.0.0's behaviour when the read fails: after `silent`, the call
       fails, carrying the read's response; after `unstated`, the starting
       verdict stays, with the refusal's response as the list, or no context
       when none came back.
    Unit tests replay the recorded answers: the silent and unstated checklists,
    a refused read and a read with no response.
H3. **The settings recipe** in `handleUpdateTableSettings.ts`
    (`patchSettings` / `patchTableSettingsUnderLock`, and the compact
    `handleUpdateUnderLock` branch): under the caller's lock, `readMetadata`
    (`version: 'inactive'`, `tableSettings` on premise, `cloudTableSettings` on
    the cloud, through `adtClientOf`'s declared variant), then no ETag means a
    refusal and nothing written, then `patchTableSettings`, where a refusal means
    nothing written, then `updateMetadata` with `headers` the media type with no
    charset and `ifMatch: read.etag`. The `.ts` header comment and the handler's
    tool description drop "the patch is adt-clients'".
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
  adt-strategies' reading, and needs its own measurement.
- The removal of the `variant: 'cloud'` constructor option and of the runtime
  `namesASetting` check (static types first).
