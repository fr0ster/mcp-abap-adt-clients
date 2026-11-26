# Plan: no casts and no regular expressions in production code

The goal is `docs/superpowers/2026-11-26-no-casts-no-regex-goal.md`, and the spec is
`docs/superpowers/specs/2026-11-26-no-casts-no-regex-spec.md`. This plan is the task broken
into steps, in the order the releases depend on each other:

1. the interfaces-adt PR;
2. the guard;
3. adt-strategies;
4. adt-clients;
5. adt-clients-legacy;
6. the release.

It holds no code. Each implementing step works test first.

## Rules for every step

- **One task, one PR here.** All work in this repository goes into PR #333 on
  `refactor/no-casts-no-regex`, in the worktree `.worktrees/no-casts-regex`. The
  interfaces-adt change is the one separate PR, in its own repository.
- **Every commit builds.** Each commit leaves all three packages compiling and their unit
  suites green. If a change in one package forces a change in another (a clients signature
  that a legacy override must follow), both go in the same commit.
- **Small commits, by path.** Each logical change is its own commit, with the session's
  trailer. Every commit is pushed before an external review. CI is checked after every push,
  and CI's own step list (build, `test:check`, `lint:check` and tests of every package) is
  run locally before pushing.
- **Proof by kind** (spec section 7):
  - A **type-only** change: each package's `dist/**/*.js` is snapshotted before and must be
    byte-identical after.
  - A **runtime change meant to behave the same**: an equivalence test (an oracle or a
    differential test) comes first and is green against the old code. Then the code changes,
    and the same test stays green.
  - A **decided change** (D2, C1–C5): an intended-change test comes first and **fails
    against the old code**. The failure is watched, and the test passes after the change.
    Its equivalence counterpart, if it has one, stays green throughout.
  - Each step below says which kind it is.
- **Load-bearing.** Each rule a test protects is broken once on purpose, the test is
  watched go red, and the change is reverted. One conjunct is broken at a time.
- **Review per stage.** When a stage is complete and pushed, it gets an external review.
  Findings are checked against the goal and spec. A finding outside scope is reported to the
  owner, not fixed.
- **Live runs need the owner's go.** A step that talks to an SAP system says so when it is
  ready, names the suites and what they do on the system, and waits.
- **Registry only.** No `file:`, `link:`, `npm link` or workspace link to interfaces-adt at
  any point. After every install, the lockfile is checked for `"link": true` and for
  anything not resolved from the registry. The only allowed link is a workspace sibling of
  this repository.
- **No exception list.** A guard finding is fixed in the code. The boundary-reader and
  reader-module lists of `tools/sourceRules.js` change only with the owner's approval.
- **CLAUDE.md** is not edited by this task. Any change it needs is proposed to the owner.

**Counts per package**, from spec section 2. These make each stage's completion measurable:

| | adt-strategies | adt-clients | adt-clients-legacy |
|---|---:|---:|---:|
| K1 | 11 | 36 | 2 |
| K2 (D1), inventory | 0 | 217 | 20 |
| K2 type-only (name, source, lock handle) / runtime conversions | 0 | 188 / 29 | 20 / 0 |
| K3 (D2) | 28 | 0 | 0 |
| K4 | 0 | 11 (verdict 8, C1, C2, slot lookup) | 30 (verdict 29, C5) |
| K5 | 13 | 29 | 0 |
| K6 / K7 / K8 | 0 | 3 / 4 / 1 | 0 |
| `Partial` config parameters (D1) | 0 | 455 in 54 files | 39 |
| D3 signatures | 0 | 598 in 63 files | 105 in 23 files |
| Y any-flow | 9 | 9 | 1 |
| N (known) | 5 | 1 | 0 |
| R | 14 | 18 | 0 |
| P (counted, C6) | 8 | 9 (6 typed, replaced) | 0 |

The guard's inventory (step 10) replaces these with its own counts. Any additional site it
finds joins its package's stage (step 12).

## Stage 1: interfaces-adt (its own repository, its own PR)

**Scope**: spec D1, C3, and the interfaces-adt half of C4.

1. **Open the PR.** In `mcp-abap-adt-interfaces`, in a worktree on a new branch, open one
   PR. It links #304 and PR #333 and quotes the decided text of D1, C3 and C4 from the spec.
2. **D1, the name.** `AdtObjectIdentity` takes the config's own name key alongside its
   parent keys, and each capability interface names the key it requires. The PR settles the
   exact parameter shape and records it in its description.
3. **D1, the source and the lock handle.** The members that send them get options that
   require them: `update` (`source`, `lockHandle`), `updateMetadata` (`source`,
   `lockHandle`), and the local class includes' `validate` and `check` (the config's
   `source`). `IAdtOperationOptions` stays optional for every other member.
4. **C3, drawn from both implementing packages.** List every member whose implementation
   can return the library's own error with `analyse` given. That means, from the helper each
   member calls:
   - in adt-clients: the no-answer fallback after `analyse` (`adtResponse.ts:502–522`,
     `systemInfo.ts:185–194`, `structuredExchange.ts:189–197`) and chain steps;
   - in adt-clients-legacy: every refusal and every override that answers one, including
     every operation of the 20 types `AdtClientLegacy` answers as absent
     (`AdtClientLegacy.ts:588–1009`, spec section 5, C5);
   - any interface member that either package implements in such a way.

   Attach the list to the PR, and give those members' generic overloads
   `IAdtResponse<T, E | IAdtError>`, or `E | IAbapGitStructuredError` for the abapGit
   facts. A member missed here would need another interfaces-adt release, so the list is
   reviewed against both packages' source before the merge.
5. **C4.** Remove the deprecated old-form abapGit declarations it carries:
   `IAbapGitLinkArgs` with `remoteUser` and `remotePassword`, the old external-repo
   credentials args, and the old-form overloads.
6. **Type tests** in that repository's form for steps 2–5, covering both what compiles and
   what is refused.
7. **Docs** in that repository: its CHANGELOG, a migration note, and every README section,
   guide and usage example that shows an identity, `update` or `updateMetadata` options,
   the generic error type, or the abapGit link forms. The examples are compiled by that
   repository's check.
8. **Release.** Before tagging, every dependency range resolves on the registry and the
   lockfile holds nothing linked. After its review and merge, it is tagged in its own
   versioning. **The owner publishes.** After the publish, a clean install of the published
   version from the registry, outside every repository, proves it installs. Nothing below
   builds against it until then.

## Stage 2: the guard, in this repository

**Scope**: spec sections 1 and 6.

9. **Write the guard's own tests first.** In-memory programs for every case listed in spec
   section 6, under C, Y, N, R and P, both refused and allowed.
10. **`tools/sourceRules.js`, then the inventory.** Implement spec section 1 until those
    tests pass, using the TypeScript compiler API only, with no regex. Then take the
    inventory with `--inventory` and compare it with spec section 2, per kind and per site.
    The differences, the N rule's full list included, are reported to the owner.
11. **A baseline that refuses any new finding.** Each package gets
    `src/__tests__/unit/sourceRules.test.ts`. It compares the package's findings with a
    committed baseline. The guard's result carries `text`, the node's source text with
    whitespace collapsed (spec section 6), and the baseline is a **multiset** keyed by
    `{ file, rule, kind, text }`, with a count per key and no line numbers.
    - A key whose findings exceed its count fails the test, so a new violation cannot hide
      behind a removed one, and two identical casts on one line count twice.
    - A key with fewer findings than its count also fails the test, so the baseline shrinks
      with each fix. At the end of each package's stage
    the baseline is empty and is deleted, and the test asserts `[]`.
12. **Assign every newly found site.** Each site step 10 found beyond spec section 2 is
    added to this plan, in its package's stage, as its own step. Each such step names its
    kind's replacement from spec section 3 and its proof: a type-only `dist` comparison, or
    an oracle test for a runtime change. A new N site gets the K6/N treatment and a test that
    its callers' results are unchanged.

## Stage 3: adt-strategies

**Scope**: its K1, K3 (D2), K5, N, Y, R and P sites, plus any assigned by step 12.

13. **No interfaces-adt upgrade here.** strategies stays on the current interfaces-adt. Its
    range rises in step 40, in the same commit as clients and legacy. adt-clients compiles
    adt-strategies' `src` (`tsconfig.test.json`), so a strategies built on one interfaces-adt
    major and a clients built on another would not build together.
14. **Snapshot the public surface.** Record strategies' `.d.ts` before any change, for
    step 22.
15. **K1, type-only.** Delete the casts, annotating the wider type where needed. `dist` is
    byte-identical.
16. **N parameter types, type-only.** The header readers take `IHttpHeaderValue | undefined`
    and the `tableSettings` readers take `ParsedElement`. `dist` is byte-identical.
17. **Y, runtime.** Each dependency `any` is bound to `unknown` and read with `parsed.ts`'s
    readers. Before each change, an oracle test runs the reader that changes over its
    recorded inputs: the parsed answers each site reads, from `corpus/adt/answers/` and the
    strategies' fixtures. Where binding to `unknown` adds no runtime code, the site is
    type-only and `dist` is compared instead.
18. **K5 readers, runtime.** First the table tests over the recorded answers and the
    constructed holders, against the old code. Then the `Node` and `Record` casts in
    `analyse.ts`, `atc.ts`, `traces.ts` and `parseSearchConfigurations.ts` become
    `parsed.ts` reads, and `analyse.ts:100, 102` uses `propertyOf`.
19. **D2, the trace readers.**
    - The **equivalence** test comes first: the recorded feeds read exactly as before. It is
      green against the old code.
    - The **intended-change** test, one per required field, comes next: with that field
      removed, the reading throws naming it. It fails against the old code, which returns
      `undefined`, and the failure is watched.
    - Then the 28 casts become throwing readers, and both tests pass.
20. **R scanners, runtime, one commit per pattern family.** For each, the differential test
    comes first: oracle, recorded inputs, edge cases, and the bounded exhaustive plus seeded
    random alphabet. Then the scanner. The families are:
    - `/runs/` ids;
    - the `aunit:run` uri and its fallback;
    - `T100KEY-V`;
    - the longtext link and `&amp;`;
    - trailing slashes;
    - trace id, sub-millisecond and leap second.
21. **P.** The guard checks the eight predicates' provenance. Any that fails is replaced as
    spec section 2, P describes, after a test of its callers' results.
22. **Public surface, first check.** Compare the `.d.ts` with step 14's snapshot. No
    difference is allowed yet, since nothing public changed and interfaces-adt is still the
    old one.
23. **Make the guard strict.** The baseline is empty, and the test asserts `[]`. Break each
    rule once in `src` and revert.
24. **Docs.** These go in:
    - `CHANGELOG.md`: D2, and the interfaces-adt range raised in step 40;
    - the published `ERRATA.md`, with the D2 entry;
    - the README: its trace readings section, its `analyse` section, and a "Migrating to
      <version>" section. That section is the migration note, because the package publishes
      only `dist`, `README.md`, `LICENSE`, `COPYING` and `ERRATA.md` (`package.json`
      `files`), so a note in a `docs/` directory would not reach its consumers;
    - every guide in spec section 8 that names a trace reading, and every example that reads
      traces, checked and still compiling.

    The version is a breaking 0.x release, as the goal states.
25. **Stage review.** Push, check CI, then run the external review.

## Stage 4: adt-clients

**Scope**: its K1, K2 (D1), K4 (D3, C1, C2, C3), K5, K6, K7, K8, Y, R and P sites, C4
(step 40), and any assigned by step 12.

**Part A runs against the current interfaces-adt**, so every commit builds before the
upgrade.

26. **Snapshot the public surface.** Record clients' and legacy's `.d.ts` before any change,
    for steps 44 and 56.
27. **K1, type-only.** Delete the casts. `dist` is byte-identical.
28. **Prepare C4, without removing anything yet.** List every test that uses the old abapGit
    form: `typechecks/exact/abapGitResults46.ts:42`, `unit/abapGitEntryPacked.test.ts:153`,
    and every other one that the compiler or a search finds. For each, write down the
    negative check it becomes and the new-form coverage it keeps. Nothing is removed yet:
    the class implements `IAdtAbapGitClient` of the current interfaces-adt, which still
    declares the old overloads, so removing them now would not compile.
29. **AbapGit slot lookup, type-only.** The results map is typed per slot. `dist` is
    byte-identical.
30. **C1.**
    - The **equivalence** test comes first: a batch member gets its part.
    - The **intended-change** type check comes next: a generic call
      `makeAdtRequest<X>(…)` is refused. It fails against the old code, and the failure is
      watched.
    - Then remove `<T, D>`.
31. **C2.**
    - The **equivalence** tests come first and are green against the old code: settlement
      on answer, on close and on timeout without a reader, and the next request on the same
      id.
    - The **intended-change** tests come next, and each fails against the old code:
      - settlement with a reader;
      - a reader that throws rejects only its own request;
      - type checks that the reader's return type is the answer's type, that a call without
        a reader answers `unknown`, and that the old caller-chosen `TResponse` without a
        reader is refused.

    Then add the two `request` overloads with the reader.
32. **K5 readers, runtime.** First the table tests (spec section 7: recorded refusals, an
    inherited `response`, a getter, primitives, `null`). Then add `propertyOf` and the
    `as…` readers beside `ownValue`, and change each site under its own policy, as the spec
    lists.
33. **K6, the profiler, runtime.** First the per-view tests and the unknown-view test. Then
    the handler map with `Object.hasOwn`.
34. **K7 `AdtService` (type-only) and K8 `AdtClient` (runtime).** `AdtService` keeps
    byte-identical `dist`. For K8, the error-shape test comes first, then `Object.assign`.
35. **Y.** Each `any` binding that adds no runtime code is type-only, with byte-identical
    `dist`. The runtime ones each get an oracle test first:
    - `callTimeout`: forwarding tests (a deadline on `makeAdtRequest`, other methods bound,
      non-function members, an extra method, an absent member). Then the Proxy trap.
    - The parser sites (`messageClass/xml.ts`, `tableSettings/readDocument.ts`,
      `debugger/abap.ts`, `activationUtils.ts`, `adtErrors.ts`, `lockHandle.ts`,
      `systemInfo.ts`): a test of the result each produces from its recorded or fixture
      input.
36. **The enhancement lock datum, runtime.** These tests come first:
    - `unlockAll()` on an abandoned enhancement lock sends the same unlock request as
      before;
    - every other lock tracker still releases as before: each handler family with a tracker
      gets one abandoned lock, `unlockAll()` runs, and the release request is compared.

    Then add the per-lock datum to `createLockTracker` and remove `lockedTypes`.
37. **D1, the 29 fields it does not require, an equivalence change.** For each internal function, a test
    against the old code comes first: called with `undefined` and with a value, it builds
    the same request. Then the parameter takes the contract's type, and the implicit
    conversions are written out.
38. **R scanners, runtime, one commit per family.** Differential tests come first, as in
    step 20, using the recorded `$batch`, where-used scope and ATC answers this task added,
    the discovery documents, and the existing recordings. The families are:
    - the multipart reader;
    - the where-used rewrite and the scope rewrap;
    - discovery hrefs;
    - the cloud host test;
    - `replaceAll('-', '')` at both sites.
39. **P.** Replace the six typed predicates (spec section 2, P), each after a test of its
    callers' narrowing results. The guard checks the other three.

**Part B is the upgrade, then the contract work.**

40. **Install the published interfaces-adt, together with C4, in a commit that builds.**
    - Raise the interfaces-adt range of **all three packages** and install from the
      registry, then check the lockfile.
    - In the same commit: remove the old abapGit form (the old overloads,
      `DeprecatedOptions`, the old builders `linkRepo` and the old external-repo check, their
      result slots, and their imports from interfaces-adt at `AdtAbapGitClient.ts:35`).
      Turn the tests listed in step 28 into negative checks that the old form is refused,
      keeping their new-form coverage.
    - Also make every other change the new contract forces for clients and legacy to
      compile, and nothing more. If the identity type's parameters changed, that means the
      `implements` clauses.

    The new form's tests stay green.
41. **D1, the members' parameters.** The 455 `Partial<I…Config>` parameters in 54 files take
    the interface's identity type or the required options type. They go one handler family
    per commit, and the legacy overrides of that family follow in the same commit if the
    compiler demands it. Then the family's type-only K2 casts are deleted: 188 in clients.
    The other 29 were converted in step 37. `dist` is byte-identical. Each family gets type checks: omitting the name, a required `source`
    or a required `lockHandle` is refused, and the full call compiles.
42. **D3 overloads, one commit per handler family.** The 598 clients signatures get the
    interfaces' two overloads, and `dist` is byte-identical. Each family gets type checks:
    a generic call with `analyse` compiles, a generic call without it is refused, and a
    default call compiles.
43. **C3, the helpers.** `answering`, `answeringExchange`, `answeringActivation`,
    `systemInfo`, `chain` and the abapGit facts exchange return `E | IAdtError` (or
    `E | IAbapGitStructuredError`) on the library's own paths, with no cast. The members
    follow the interfaces-adt types. Tests:
    - type checks for each such path;
    - a spy showing that `analyse` is called exactly as before: once, with the verdict and
      `undefined`, on the no-answer path, before the library's fallback.
44. **Public surface.** Compare strategies' `.d.ts` with step 14's snapshot again, now after
    its interfaces-adt upgrade in step 40. The only differences allowed are the
    interfaces-adt types it uses or re-exports. Then compare clients' `.d.ts` with step 26's
    snapshot. The only differences
    allowed are those D1–D3 and C1–C4 name, and any other is a defect, fixed before going
    on.
45. **Make the guard strict.** The baseline is empty, and the test asserts `[]`. Break each
    rule once in `src` and revert.
46. **Live run.** Tell the owner the stage is ready for its live run, and wait for the go.
    Then run the changed members' integration suites on premise and on ABAP Cloud.
47. **Docs.** Every guide spec section 8 lists for adt-clients. These go in:
    - `CHANGELOG.md`;
    - `docs/usage/MIGRATION-<major>.md`, covering D1–D3 and C1–C4 and linked from the
      README's migration list;
    - every README and `docs/usage/` example whose call changed, compiled through
      `tsconfig.test.json`;
    - the README sections on identities, `analyse` and error typing, batches, WebSocket and
      abapGit.
48. **Stage review.** Push, check CI, then run the external review.

## Stage 5: adt-clients-legacy

**Scope**: its K1, K2 (D1), K4 (D3 and C3 across every override, C5), Y, and any assigned
by step 12. Steps 41–43 may already have moved some overrides, where the compiler demanded
it, and this stage finishes the rest.

49. **The baseline surface** is the legacy `.d.ts` recorded in step 26.
50. **K1, type-only.** Delete the casts. `dist` is byte-identical.
51. **D1, the overrides' parameters.** Every legacy override that still declares a
    `Partial<I…Config>` (39 sites; for example `AdtClassLegacy.ts:54`) takes the identity
    type of the member it overrides. Then the K2 casts are deleted (20), and `dist` is
    byte-identical. Type checks on the legacy classes: omitting the name, `source` or
    `lockHandle` is refused, and the full call compiles.
52. **D3 on every override.** All 105 legacy signatures get the overload pair, refusing ones
    and non-refusing ones alike (such as `ClassTestRunnerLegacy.ts:43`), and `dist` is
    byte-identical. The positive and negative type checks are those of step 42.
53. **C3 for the legacy refusals.** The refusal is typed `E | IAdtError`, with no cast. Tests:
    the refusal is answered, no request is sent (a recording connection sees none), and
    `analyse` is never called (a spy sees no call, as today).
54. **C5, all 20 absent types** (spec section 5, C5: `AdtClientLegacy.ts:588–1009`).
    - The **equivalence** tests come first and are green against the old code: each
      operation answers the same refusal (origin, code and message), no request is sent
      (a recording connection sees none), and construction sends none.
    - The **intended-change** tests come next, and each fails against the old code: the
      handler is an instance of the modern class and of its `*AbsentLegacy` class, and every
      public or protected member of the modern class, read from its TypeScript declarations,
      is overridden on the subclass.
    - Migrate the test helpers that recognise an absent handler as a plain object to the
      subclass form, with the same strictness: `legacyRegistrations.ts:284–305`
      (`isAbsentOnLegacy`), `legacyMemberInventory.test.ts:293–305`, and
      `legacyIntegrationHeadersOf.test.ts:202`, which excludes absent handlers by
      `Object.getPrototypeOf(handler) === Object.prototype`. That test also gets an
      intended-change case showing the subclass form is still excluded.
    - Then add the 20 `*AbsentLegacy` subclasses. Each overrides the public and protected
      members with the refusal. Private helpers cannot be overridden (TS2415), and they stay
      unreachable because every operation that calls them is overridden. Switch the factory
      to construct the subclasses, and remove `absentOnLegacy`, which also removes its Y
      site.

    The legacy rules' existing tests (`legacyClassesOnlyOverride`,
    `legacyStaysInLegacyClasses`) stay green.
55. **Ranges stay as they are.** adt-clients stays at its current workspace version, and so
    do every sibling range. Only step 61's single commit moves the versions and ranges. The
    interfaces-adt range was already raised in step 40. Check the lockfile.
56. **Public surface.** Compare the `.d.ts` with step 26's legacy snapshot. The only
    differences allowed are those of D1, D3, C3 and C5.
57. **Make the guard strict**, as in step 45.
58. **Live run on the legacy system.** Wait for the go, then run the legacy package's live
    cycles for the changed handlers, as `docs/LIVE_TESTING.md` describes.
59. **Docs.** These go in:
    - the legacy README (its migration section), `docs/LEGACY.md` and
      `docs/LIVE_TESTING.md`, which describe the absent handlers;
    - `CHANGELOG.md`;
    - a migration note covering D1 and D3 on the legacy classes, C3 (a legacy refusal under
      a generic call is typed `E | IAdtError`) and C5 (absent handlers are subclasses);
    - every legacy example and guide that calls a changed member, checked and compiling.
60. **Stage review.** Push, check CI, then run the external review.

## Stage 6: release

61. **Sibling versions and ranges, in one commit.** Set the three new versions and, together
    with them, every range between the siblings:
    - adt-clients' `dependencies` on adt-strategies (`^0.28.2` today);
    - adt-clients-legacy's `devDependencies` on adt-strategies (`^0.28.0`) and on
      adt-clients (`^47.0.0`);
    - adt-clients-legacy's `peerDependencies` on adt-clients (`^46.1.0 || ^47.0.0`).

    Each points at the new breaking version, and npm regenerates the lockfile in the same
    commit. A breaking bump without its ranges would leave a sibling pointing across it, so
    no partial version change is committed.
62. **Full gate.** Run the root `npm run check`, and the full integration suites on premise
    and on ABAP Cloud with the owner's go. Every failure is fixed before tagging.
63. **Working documents go.** Delete the goal, spec and plan in the last commit before the
    merge. Move what they still owe into the PR description: mcp-abap-adt adopting the new
    majors, and anything the interfaces-adt PR left for later.
64. **Merge** after the external review approves and CI is green.
65. **Tag all three at the merge commit.** Tag
    `adt-strategies-v<version>`, `adt-clients-v<version>` and
    `adt-clients-legacy-v<version>` on the main checkout at the merge. This is what
    `tools/publish-changed.js` requires: its guard checks a tag at HEAD for every pending
    package (`:303` and after). Before tagging:
    - every third-party and interfaces-adt range resolves on the registry;
    - each workspace-sibling range names the version this release publishes;
    - the only `"link": true` entries are workspace siblings.
66. **One publish run.** **The owner runs** `npm run release:publish`. It runs
    `npm run check` once, publishes the pending packages in `publishOrder` (strategies,
    clients, legacy), and verifies at the end that each version is served. A version not yet
    served is reported by name (exit 2), and re-running publishes only what is missing.
67. **Clean install.** Install each of the three from the registry into an empty directory
    outside the repository, to prove it installs.
68. **Hand-over.** Report the published versions and the migration notes for mcp-abap-adt,
    which takes the new majors in its own work.

## Decisions this plan rests on

- **Release order**: interfaces-adt first, published and verified. Then this repository's
  three packages, published in one run in `publishOrder`, as `tools/publish-changed.js`
  does.
- **Upgrade order in adt-clients**: everything that does not need the new interfaces-adt
  comes first. Then the upgrade commit, which also carries C4's removal, because the current
  `IAdtAbapGitClient` still declares the old form. Then the contract work. Every commit
  builds.
- **Versions**: adt-strategies ships a breaking 0.x release, and adt-clients and
  adt-clients-legacy ship majors. interfaces-adt follows its own versioning.
- **The guard comes first**, with a baseline that refuses any new finding, so every later
  step is measured by the same definition the inventory used.
- **No exception list.** A site the guard finds is fixed in the code.
