# Plan: an activation activates, or says it did not

Goal: `2026-11-09-activation-751-goal.md`. Spec (approved): `2026-11-09-activation-751-spec.md`
(D1–D8, decisions Q1–Q7). This plan breaks the spec into steps, in release
order. It holds no code: code is written at each step, test first.

**Every step follows the same discipline.**
- **Red first.** Write the tests named for the step, run them, and see them fail
  for the reason the step names.
- **Then the change.** Make the change, and see the tests go green.
- **Then the mutations.** Apply each mutation listed for the step on its own:
  its test must go red. Then revert it. One half of a rule at a time; every
  assertion is unique to its rule.
- **Then the gate.** Commit by path, push to the step's PR, and check the PR's CI.

**Gates by repository.**

| Repository | Gate |
|---|---|
| adt-clients | at the root: `npm run build`, `npm run test:check`, `npm run lint:check`, `npm test` (unit suites, no SAP system) |
| interfaces | `npm run check` |
| server | `npm run build`, `npm run test:check`, `npm run lint:check`, and its unit suite. The live integration suites are not part of the gate. |

**Rules that bind every step.**
- No cast, no `any`, no regex.
- No timeout and no retry.
- No `analyse ??` fallback.
- No system id in a tracked file (`notesNameNoSystem`).
- No `npx`.
- Long runs start with `~/.claude/scripts/start-detached` and are waited on with
  `wait-pid`. Never `pgrep -f`.

**Releases and owner publish points**, marked ⛳ below:
- **R1**: interfaces-adt.
- **R2**: adt-strategies, adt-clients and adt-clients-legacy, published from PR #303.
- **R3**: the server, published from PR #346.

Each release follows the same sequence:
1. The final review approves and CI is green.
2. The PR is merged and tagged.
3. The publish checkout is readied: the main checkout at the tag, built, every
   package to publish tagged at HEAD.
4. The owner runs the publish.
5. A clean install from the registry, outside the repository, proves the release.

Versions below are proposals. Each CHANGELOG step asks the owner for the
version first (`CLAUDE.md`).

---

## Part A — interfaces-adt (repository `mcp-abap-adt-interfaces`)

The interfaces repository gets its own PR for this task. Work happens in its
own worktree, `.worktrees/activation-751`, on branch `fix/activation-751` taken
from `master`; the main checkout is shared and keeps its branch. The PR
description links fr0ster/mcp-abap-adt#351 and PR #303.

### A1. The activation option (D3)
- **What changes.** `IAdtActivationOptions<E>` extends `IAdtOperationOptions<E>`
  with `preauditRequested?: boolean`. Both overloads of `IAdtActivatable.activate`
  take `{ headers } & IAdtActivationOptions<E>`.
- **Files.** `packages/interfaces-adt/src/adt/IAdtCapabilities.ts`,
  `src/adt/IAdtObject.ts`, `src/index.ts`.
- **Tests (red first).** A compile-only check in `src/__typechecks__/`:
  - a call to `activate(config, { headers, preauditRequested: false })`
    compiles;
  - an implementer whose `activate` declares `IAdtOperationOptions` still
    satisfies `IAdtActivatable`;
  - `preauditRequested: 'no'` does not compile (`@ts-expect-error`).
- **Mutations.**
  - Remove the field: the call fails to compile.
  - Narrow the overload back to `IAdtOperationOptions`: the call fails to
    compile.
- **Gate.** `npm run check`. `check:surface` names the new export.

### A2. The facts the activation reading judges by (D1, Q7)
- **What changes.** `IAnalyse<E>` gets an optional third parameter
  `context?: IAdtAnalyseContext`. It carries
  `activation?: { named: readonly string[]; inactiveObjects: IAdtWireResponse }`:
  - `named` holds the uris of the references the activation request sent;
  - `inactiveObjects` is the answer to the one
    `GET /activation/inactiveobjects`.

  This is where the list travels to the reading (spec D1, "the plan's to fix").
  A two-parameter `analyse` stays assignable.
- **Files.** `src/adt/IAdtObject.ts` (`IAnalyse`, the new type, its doc comment
  stating that only an activation member fills `activation`), `src/index.ts`.
- **Tests (red first).** Compile-only checks:
  - an `analyse` of two parameters is still an `IAnalyse`;
  - one of three parameters reads `context.activation.named` without a cast;
  - `named: [1]` does not compile.
- **Mutations.**
  - Make the parameter required: the two-parameter check goes red.
  - Remove `activation`: the three-parameter check goes red.
- **Gate.** `npm run check`.

### A3. The synchronous group member and its slot (D2)
- **What changes.**
  - A new atom `IAdtObjectActivation<TObjectActivation, V>` with the two
    overloads of `activateObjects(objects: IAdtGroupActivationReference<V>[], preauditRequested: boolean | undefined, options)`.
    It sits beside `IAdtTypedGroupLifecycle`, so no composite changes.
  - A new required slot `objectActivation` in `IUtilResults`. This makes the
    release a **major**: every full result set must name the slot.
- **Files.** `src/adt/IAdtUtilities.ts`, `src/index.ts`.
- **Tests (red first).** Compile-only checks:
  - a class implementing the atom compiles;
  - a result set without `objectActivation` does not satisfy `IUtilResults`;
  - a cloud reference with an on-premise-only code does not compile.
- **Mutations.**
  - Drop the slot: the "without" check stops failing.
  - Widen the reference type to `IObjectReference`: the code check stops failing.
- **Gate.** `npm run check`.

### A4. Documentation and version
- **Documentation.** The package README (the activation members, the option and
  the analyse context) and the CHANGELOG entry, with a "Migrating to 27.0.0"
  note: a full `IUtilResults` names `objectActivation`.
- **Version.** Proposed `interfaces-adt` 27.0.0. Ask the owner first, then
  regenerate the lockfile.
- **Gate.** `npm run check`. Push, then an external review, then CI green.

### ⛳ R1 — interfaces-adt 27.0.0
1. Merge, then tag `interfaces-adt-v27.0.0`.
2. Ready the publish checkout.
3. **The owner publishes.**
4. A clean install of `@mcp-abap-adt/interfaces-adt@27.0.0` outside the
   repository resolves.

**Hard stop:** nothing in Part B or later compiles before this is on the registry.
No link to the interfaces repository.

---

## Part B — adt-strategies (PR #303)

### B1. Ranges and corpus
- **Ranges.**
  - `@mcp-abap-adt/interfaces-adt` becomes `^27.0.0` in all three packages of
    this repository.
  - adt-clients' and the legacy package's devDependency on adt-strategies
    becomes `^0.22.0`. That is a link to the workspace sibling, which the
    standing exception allows.
  - Regenerate the lockfile. The only `"link": true` entries may be the three
    siblings.
- **Corpus** (spec D7), in `packages/adt-clients/corpus/adt/`:
  - `answers/activation-preaudit-still-inactive-751`: the issue's 8-entry
    `ioc:inactiveObjects`. Its `note` names the issue and says only two
    entries are shown there in full.
  - `answers/activation-sync-activated-751`: a `200` with an empty body.
  - `answers/activation-runs-absent-751`: a `404`.
  - `answers/activation-still-inactive`: copied from the server's
    `tests/fixtures/adt/`.
  - `discovery/system-description-751-partial`: the collections the issue lists,
    with a `note` saying it is partial.
  - The object names stay as the issue gives them. No system id appears.
- **Tests.** The corpus readers' existing tests (the sidecar shape, `bodyFile`
  present) and `notesNameNoSystem` cover the new files.
- **Gate.** The repository gate.

### B2. The activation reading (D1, Q1, Q2, Q7)
- **What changes.**
  - `readActivationRefusal` and `analyseActivation` answer the full table of
    spec D1:
    - `ioc:inactiveObjects` → not activated, `stillInactive` from each entry
      whose `ioc:ref` carries a name (the transport-only entry is skipped);
    - empty body → activated, whatever `preauditRequested` was;
    - any other document, or one that does not parse → not activated, "the
      answer does not state the activation";
    - `chkl:messages` with `activationExecuted="false"` and no message → judged
      by `context.activation`:
      - an entry of the list whose `uri`, or whose `parentUri`, is in `named`
        → not activated, those entries as `stillInactive`;
      - none → nothing to activate;
      - no `context.activation` → not activated, "the activation's outcome
        could not be decided";
    - the other `chkl:messages` rows stay as they are.
  - The list is read in either shape: `ioc:inactiveObjects`, or the flat 7.40
    `adtcore:objectReferences`.
  - New exported types `IAdtActivationFailure` (with `stillInactive`) and
    `IAdtStillInactive`. `analyseActivation` becomes
    `IAnalyse<IAdtActivationFailure>`.
  - Parsing uses fast-xml-parser only.
- **Files.** `packages/adt-strategies/src/refusals/read.ts`, `refusals/analyse.ts`,
  `src/index.ts`.
- **Tests (red first).** In `src/__tests__/analyse.test.ts` and `readings.test.ts`,
  one case per row of D1, on recorded answers:

  | Case | Recording | Expected |
  |---|---|---|
  | `ioc` on 751 | `activation-preaudit-still-inactive-751` | 8 named `stillInactive`, no transport entry |
  | `ioc` with a transport entry | `activation-still-inactive` | the transport entry is skipped |
  | `ioc` on S/4HANA 2025 | `activation-group-alone-s4-2025` 01 | not activated |
  | empty body, preaudit `true` | `activation-class-basis-740` 01 | activated |
  | empty body, preaudit `false` | `activation-sync-activated-751` | activated |
  | unknown or unparsable document | inline | not activated |
  | Q7, something left inactive | `activation-group-alone-s4-2025` 04 with list 05 | not activated, the group in `stillInactive` |
  | Q7, a re-activation | `activation-reactivate-active-s4-2025` 03 with list 04 | nothing to activate |
  | Q7, matched by `parentUri` | inline | not activated |
  | Q7, the transport-only entry | inline | never counted |
  | Q7, the 7.40 flat list | inline | read like the `ioc` list |
  | Q7 without context | `activation-nothing-to-activate` | not activated |
  | Q7 on ABAP cloud, empty list | `activation-nothing-to-activate` | nothing to activate |
  | `E` refusal | `refusal-activation-fails` | unchanged (Q6) |
  | activated | `activation-success-verdict` | unchanged |

  `IAdtActivationFailure` is checked statically in a typecheck file: no cast
  reads `stillInactive`.
- **Mutations.** Each must turn its own case red:
  - remove the `ioc` branch;
  - stop skipping the transport entry;
  - read an empty body as not activated;
  - read an unknown document as activated;
  - match by `uri` only, dropping `parentUri`;
  - count every list entry, not only the named ones;
  - answer "nothing to activate" when there is no context;
  - drop the flat-list reader;
  - turn the `E` row into a success.
- **Gate.** The repository gate.

### B3. The discovery reading (D2)
- **What changes.** `utilDiscoveryCollections: IResultStrategy<ReadonlySet<string>>`:
  - every `app:collection/@href` that is a path, read with fast-xml-parser;
  - a `2xx` with no `app:service` is read as an empty set, and the consumer
    answers that as "discovery not readable" (D2).
  - An exported constant `ACTIVATION_RUNS_COLLECTION`
    (`/sap/bc/adt/activation/runs`), for an exact `has`.
- **Files.** `src/results/utils.ts`, `src/index.ts`.
- **Tests (red first).** `utilReadings.test.ts`:
  - runs listed in the S/4HANA 2025 and ABAP cloud recordings;
  - runs absent in the 7.40 recording and in the 751 partial one;
  - an inline collection `/sap/bc/adt/activation/runsx` does not count as runs;
  - absolute `href`s are skipped;
  - a non-discovery document gives the empty set.
- **Mutations.**
  - A prefix match: the `runsx` case goes red.
  - Keep absolute `href`s: their case goes red.
- **Gate.** The repository gate.

### B4. Surface, documentation and version
- **Surface.** `publicApi.test.ts` names the new exports.
- **Documentation.**
  - `packages/adt-clients/docs/usage/ERRATA.md` (copied into the strategies
    build) and `ANSWER_SHAPES.md`: the activation table of D1 with the D8
    measurements, written by release, never by system.
  - The package README.
  - The CHANGELOG: proposed 0.22.0, version asked first. It states that
    `analyseActivation` is stricter: an `ioc` answer, an unknown document, and
    a silent checklist without its list are now failures.
- **Gate.** The repository gate.

---

## Part C — adt-clients (PR #303)

### C1. `preauditRequested` on every single-object member (D3)
- **What changes.**
  - Every member that sends a single-object activation sends
    `options.preauditRequested ?? true`:
    - the `activate` members of §1.1 of the spec;
    - `AdtClassMemberBase.activate`;
    - `class.activateTestClasses`;
    - the service binding;
    - the behaviour implementation, which passes its options to the class.
  - `activateObjectInSession` loses its default, so the value is decided once,
    in the member.
  - The `behaviorDefinition` and `metadataExtension` helpers drop their unused
    defaults.
  - The nine files with their own URL literal build it from the value.
- **Files.** Every `src/core/*/activation.ts`, `metadataExtension/activate.ts`,
  `class/testclasses.ts`, `utils/activationUtils.ts`, each `Adt*.ts` whose
  `activate` takes the option, `core/service/AdtService.ts`.
- **Tests (red first).**
  - `unit/core/r2RequestShapes.test.ts`: every member, with no option, keeps its
    pinned `preauditRequested=true` (unchanged lines).
  - A new table test: every activation member with `preauditRequested: false`
    sends `false`. The list of members is taken from the type tables, so a new
    member cannot be missed.
- **Mutations.**
  - Hard-code `true` again in one helper caller: that member's `false` case
    goes red.
  - Change the default to `false`: `r2RequestShapes` goes red.
- **Gate.** The repository gate.

### C2. The one read for a silent checklist (Q7)
- **What changes.** One internal helper wraps every activation member that sends
  `POST /activation`: the members of C1 and C3's `activateObjects`.
  1. After the `POST`, the helper reads the answer.
  2. Only when the answer is a `2xx` `chkl:messages` with
     `activationExecuted="false"` and no `msg`, the helper sends one
     `GET /sap/bc/adt/activation/inactiveobjects`, with the `Accept` that
     `getInactiveObjects` sends. It then hands `analyse` the activation's answer
     and `{ activation: { named, inactiveObjects } }`. `named` holds the uris of
     the references the request sent.
  3. A read that fails is the call's failure, naming that the activation's
     outcome could not be decided. The read's response is carried, and
     `analyse` sees that verdict.
  4. Every other answer is handed on as it came, with no second request.

  The detection uses fast-xml-parser, not a regex. It is not exported. Its doc
  comment states the one exception to "a member issues one request" and cites
  spec D1 and Q7.
- **Files.** `src/utils/activationUtils.ts` (the helper, beside
  `activateObjectInSession`), `src/utils/adtResponse.ts` (`answering` passes a
  context to `analyse`), and the members of C1.
- **Tests (red first).** `unit/utils/activationRead.test.ts`, with a stub
  connection replaying recorded answers:
  - after `activation-group-alone-s4-2025` 04, exactly one `GET` follows and
    `analyse` receives the list 05 and the named uri;
  - after `activation-success-verdict`, an `ioc` answer, an empty body or a
    refusal, no `GET` follows;
  - a `500` on the `GET` ends the call as a failure carrying that response;
  - `named` equals the request's references, including both references of the
    function group.
- **Mutations.**
  - Read on every answer: the "no `GET`" cases go red.
  - Never read: the first case goes red.
  - Swallow a failed read as a success: the `500` case goes red.
  - Pass only the first reference as `named`: the function group case goes red.
- **Gate.** The repository gate.

### C3. `activateObjects` and its slot (D2)
- **What changes.**
  - A new `AdtUtils.activateObjects(objects, preauditRequested = false, options)`:
    one `POST /sap/bc/adt/activation?method=activate&preauditRequested=…` with
    the group body (uri, type, name per reference), through C2's helper, read
    by the `objectActivation` slot.
  - `utilDocuments` gains `objectActivation: rawDocument`.
  - `AdtUtils` implements A3's atom.
  - `activateObjectsGroup` is unchanged.
  - Both group members share the body builder, so the bodies cannot drift
    apart.
- **Files.** `src/core/shared/groupActivation.ts`, `AdtUtils.ts`,
  `utilResultSet.ts`, `src/index.core.ts`.
- **Tests (red first).**
  - A request shape for `activateObjects`: the default `false`, the body equal
    to `activateObjectsGroup`'s.
  - `activationRunSequence.test.ts` stays unchanged.
  - `utilsTypedAtoms.test.ts`, `servedCodes.test.ts`,
    `groupMembersRefuseUnknownTypes.test.ts` (an unknown type is refused with
    no request) and `publicApiSurface.test.ts` name the member and the slot.
- **Mutations.**
  - Send the new member to `/activation/runs`: its shape test goes red.
  - Drop the unknown-type guard: the refusal test goes red.
  - Remove the slot from `utilDocuments`: `test:check` goes red.
- **Gate.** The repository gate.

### C4. Documentation and version
- **Documentation.**
  - `docs/usage/CLIENT_API_REFERENCE.md`: the option, the new member, the read
    of Q7, and discovery as the consumer's choice, with an example that reads
    discovery and picks a member.
  - `README.md` activation section.
  - A new `docs/usage/MIGRATION-45.md`: `IUtilResults.objectActivation`; that
    `analyseActivation`'s new verdicts change what a caller sees; how to send
    the second step.
  - The CHANGELOG: proposed 45.0.0, version asked first.
- **Gate.** The repository gate, `check:docs`.

---

## Part D — adt-clients-legacy (PR #303)

### D1. 7.40 group and option (D5, Q3)
- **What changes.**
  - `AdtUtilsLegacy.activateObjectsGroup` refuses with no request, as
    `getActivationRun` does. Its message names the absent `/activation/runs`
    and points to `activateObjects`.
  - `activateObjects` is inherited unchanged.
  - `AdtFunctionGroupLegacy.activate` sends `options.preauditRequested ?? true`
    through C2's helper.
  - The `adt-clients` peer range becomes `^45.0.0`, and the devDependency
    becomes `^45.0.0` (a sibling link).
- **Files.** `src/core/shared/AdtUtilsLegacy.ts`,
  `src/core/functionGroup/AdtFunctionGroupLegacy.ts`, `package.json`.
- **Tests (red first).**
  - `unit/shared/legacyUtils.test.ts`: `activateObjectsGroup` answers the
    refusal with no request. The VIEW/DV case at `:362-373` moves to
    `activateObjects` and keeps its URL.
  - `unit/core/functionGroup/legacyActivation.test.ts`: `false` is sent when
    asked, `true` by default.
  - `legacyClassesOnlyOverride` and `legacyStaysInLegacyClasses` stay green.
- **Mutations.**
  - Restore the override's request: the refusal case goes red.
  - Hard-code `true`: the `false` case goes red.
- **Gate.** The repository gate.

### D2. Documentation and version
- **Documentation.**
  - `docs/LEGACY.md`: the member table, and the 7.40 measurement of D8 L1/L2.
  - The package README.
  - The CHANGELOG: proposed 0.9.0, a minor under the owner's legacy rule,
    version asked first.
- **Gate.** The repository gate. Push, then an external review, then CI green.

---

## Part E — live verification of the library (owner's go)

### E1. Live runs on S/4HANA 2025 and 7.40
- **Before anything runs.** Notify the owner that the stage is ready, and wait
  for the go. 7.40 is up only part of the day, so ask before using it. Name each
  run's session and overlay (`MCP_ENV_PATH`, `MCP_TEST_OVERLAY`). Launch with
  `npm run test:detached`, and read `test-run.log`.
- **On S/4HANA 2025, over HTTP**, extend the existing integration suites with
  the cases of D8, each one creating its own object and deleting it:
  1. A class in a transportable package, activated with the default:
     activated.
  2. A function group's reference alone, `preauditRequested=true`: "not
     activated", with the group in `stillInactive`.
  3. The second step, `activateObjects` with the `ioc` references and `false`:
     activated.
  4. The silent case, the reference alone with `false`: Q7 reads the list, and
     the answer is "not activated".
  5. A re-activation of an active class: Q7 reads an empty list, and the answer
     is "nothing to activate".
  6. Discovery lists runs, and `activateObjectsGroup` with the run sequence is
     unchanged.
- **On 7.40, over RFC:**
  - the legacy cycles with `analyseActivation`, which reads every empty `200`
    as activated;
  - `activateObjects` over a group;
  - `activateObjectsGroup` refused with no request;
  - discovery without runs.
- **After the runs.** Every failure is fixed before release. A fix is never
  excused as pre-existing. The results go into `LEGACY.md` and the test docs,
  named by release.
- **Gate.** Both runs green.

### E2. Delete the working documents (before R2)
- Delete `docs/superpowers/2026-11-09-activation-751-goal.md`, `-spec.md` and
  `-plan.md`. They are fully implemented on the library side.
- Before deleting, write into PR #303's description what they still owe:
  - Part F (the server, #346);
  - the reporter's body for Q6;
  - the deprecations.

  Also write Part F into #346's description.
- **Gate.** The repository gate.

### ⛳ R2 — adt-strategies 0.22.0, adt-clients 45.0.0, adt-clients-legacy 0.9.0
1. The final review approves and CI is green; check every CHANGELOG date is the
   release day.
2. Merge PR #303, then tag `adt-strategies-v0.22.0`, `adt-clients-v45.0.0` and
   `adt-clients-legacy-v0.9.0`.
3. Ready the publish checkout at the tag, built.
4. Check that every package `package.json` declares only semver ranges.
5. **The owner runs** `npm run release:publish`, which publishes in
   `publishOrder`: strategies, then clients, then legacy.
6. A clean install of the three from the registry, outside the repository,
   resolves.

---

## Part F — the server (the existing PR #346, `refactor/static-types`)

These are the last steps. They are done in #346's worktree, coordinated with
whoever runs live tests there. They go into #346's 24.0.0 entry, not a new PR.

### F1. Ranges
- **What changes.** `@mcp-abap-adt/interfaces-adt` `^27.0.0`, `adt-strategies`
  `^0.22.0` and `adt-clients` `^45.0.0`, all from the registry. Regenerate the
  lockfile with no foreign link. `ourUtils` and any full utils result set name
  `objectActivation`.
- **Gate.** `npm run build`, `npm run test:check`.

### F2. "Not activated" reaches the caller (D6)
- **What changes.**
  - `terseActivation` loses its `ioc` branch and `activation_not_stated`.
  - `answer.ts` renders an `IAdtActivationFailure`'s `stillInactive` as
    `still_inactive: [{ name, type, uri, parent_uri? }]`, field by field.
- **Files.** `src/lib/strategies/projections.ts`, `src/lib/answer.ts`.
- **Tests (red first).**
  - `ActivateClass`, `ActivateObjects` on a single object, and
    `UpdateClass activate: true` answer `isError` with `still_inactive`, both
    over the 751 `ioc` recording and over Q7's not-activated case. Copy the
    recordings into `tests/fixtures/adt/`.
  - `strategyProjections.test.ts:83-85` is rewritten: no
    `activation_not_stated` is left.
  - `rapFixtures.ts` drops the field.
- **Mutations.**
  - Restore the `ioc` branch: the server test for "not a success" still goes
    red, because the failure precedes the projection. This shows the
    projection is no longer the line of defence.
  - Drop `still_inactive` rendering: its assertion goes red.
- **Gate.** The server gate.

### F3. `preaudit` on the single-object path (D6, Q4)
- **What changes.**
  - `activateFamily` passes `preauditRequested: preaudit` for every API.
  - `preauditDescription` says `preaudit` is sent on both paths (default
    `true`).
  - Only `ActivateObjects`, `ActivateObjectLow` and `HandlerActivate` take it.
- **Tests (red first).** `activateObjectPreaudit.test.ts` is rewritten:
  - one object of each single-activation code with `preaudit: false` sends
    `false`;
  - with no `preaudit`, it sends `true`;
  - the description no longer says "always sends preauditRequested=true".
- **Mutations.**
  - Drop the pass-through in one API branch: that code's case goes red.
- **Gate.** The server gate.

### F4. The group endpoint from discovery (D2, Q5)
- **What changes.** On every group activation, the group path reads discovery
  through `getUtils(…).getDiscovery` with `utilDiscoveryCollections`:
  - runs listed → today's three requests, unchanged;
  - runs not listed → `activateObjects(references, preaudit, { headers, analyse: analyseActivation })`,
    projected by `terseActivation`;
  - discovery failed or not readable → the failure, step `discovery`, with no
    activation request.
  - A new header key `utils.activateObjects`.
  - The `detail` description is updated.
- **Files.** `src/handlers/common/low/handleActivateObject.ts`,
  `src/lib/adtHeaders/` (the key), and the client contract the server composes
  (`src/lib/adtClientContract.ts`), which takes A3's atom.
- **Tests (red first)**, on recorded discovery:
  - S/4HANA 2025: runs requests;
  - 7.40 and 751 partial: one `POST /activation`;
  - a discovery `500`: an error with step `discovery` and no activation request;
  - a `404` from `/activation/runs` is not retried. The test counts requests.
  - `activationRunWait`, `activationCancelled`, `commonLowOperations`,
    `failureStep` and `activateObjectTypeCodes` are updated for the extra
    discovery `GET`.
- **Mutations.**
  - Skip the discovery read: the 751 case goes red.
  - Fall back to `/activation` on a `404`: the no-retry case goes red.
  - Use a prefix match: covered by B3.
  - Answer a failed discovery with runs: the `500` case goes red.
- **Gate.** The server gate.

### F5. Documentation
- **What changes.**
  - The tool descriptions and generated tool docs.
  - `README.md` / `docs/`: the activation answer, `still_inactive`, `preaudit`,
    and the discovery choice.
  - #346's CHANGELOG 24.0.0 entry and its migration note: `activation_not_stated`
    is gone, an `ioc` answer is an error, and the group path reads discovery.
- **Gate.** The server gate, docs checks.

### F6. Live verification of the server (owner's go)
- **Before anything runs.** Notify the owner and wait for the go.
- **On S/4HANA 2025:**
  1. `ActivateClass`: activated.
  2. `UpdateClass activate: true` on a function-group-like case that is left
     inactive: an error with `still_inactive`.
  3. `ActivateObjects` with `preaudit: false` and the listed references:
     activated.
  4. `ActivateObjects` with two objects goes through runs (discovery lists
     them).
- 7.40 is not served by this server (it does not use the legacy package).
- **After the runs.** Every failure is fixed before release.
- **Gate.** The run green.

### ⛳ R3 — the server 24.0.0 (#346)
1. The final review approves and CI is green.
2. Merge and tag.
3. Ready the publish checkout.
4. **The owner publishes** the server packages.
5. A clean install from the registry resolves.

---

## Close-out

- **The working documents** were deleted at E2, before R2. Nothing of this task
  stays in `docs/superpowers/`.
- **Deprecation of the older versions** (goal, out of scope: no backport).
  - **Prepared.** The exact `npm deprecate` lines, with this message: "Activation
    can report success when SAP activated nothing on SAP_BASIS 751 (fr0ster/mcp-abap-adt#351); upgrade to …".
    They are prepared for:
    - every published server package of the repository below 24.0.0
      (`@mcp-abap-adt/core` among them; the list is taken from the published
      names and checked with `npm view <name> versions`);
    - `@mcp-abap-adt/adt-clients@<45.0.0`;
    - `@mcp-abap-adt/adt-strategies@<0.22.0`.

    The ranges are given to the owner for confirmation.
  - **Run by the owner** after R3, never before the fixed versions are on the
    registry.
- **The issue.** A comment on fr0ster/mcp-abap-adt#351 is drafted and shown to
  the owner before posting. It names the fixed versions and asks the reporter to
  run 24.0.0 on 751. It also asks for the `chkl:messages` `E` body (Q6 (b)),
  which is added to the corpus when it arrives.
- **Reported, not built.**
  - The runs path's results can also answer `activationExecuted="false"`
    without a message. The server reads that as "nothing to activate". Q7's
    read applies only to the member that sent the activation, so the runs
    path's handling of that document is outside the approved spec. It goes to
    the owner as a note.
