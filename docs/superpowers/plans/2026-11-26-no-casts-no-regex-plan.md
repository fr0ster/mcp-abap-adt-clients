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
- **Small commits, by path.** Each logical change is its own commit, with the session's
  trailer. Every commit is pushed before an external review. CI is checked after every push,
  and CI's own step list (build, `test:check`, `lint:check` and tests of every package) is
  run locally before pushing.
- **Test first.**
  - For a runtime change, the oracle or differential test of spec section 7 is written and
    green against the old code. Then the code changes, and the same test stays green.
  - For a type-only change, the emitted `dist/**/*.js` is snapshotted before and compared
    after.
- **Load-bearing.** Each rule a test protects is broken once on purpose, the test is
  watched go red, and the change is reverted. One conjunct is broken at a time.
- **Review per stage.** When a stage is complete and pushed, it gets an external review.
  Findings are checked against the goal and spec before anything is changed for them. A
  finding outside scope is reported to the owner, not fixed.
- **Live runs need the owner's go.** A step that talks to an SAP system says so when it is
  ready and waits. Live runs are read-only on shared objects, except where an existing
  integration suite does more, and that is named in its step.
- **Registry only.** No `file:`, `link:`, `npm link` or workspace link to interfaces-adt at
  any point. After every install, the lockfile is checked for `"link": true` and for
  anything not resolved from the registry. The only allowed link is a workspace sibling of
  this repository.
- **No exception list.** A guard finding is fixed in the code. The boundary-reader and
  reader-module lists of `tools/sourceRules.js` change only with the owner's approval.
- **CLAUDE.md** is not edited by this task. Any change it needs is proposed to the owner.

## Stage 1: interfaces-adt (its own repository, its own PR)

**Scope**: spec D1, C3, and the interfaces-adt half of C4.

1. **Open the PR.** In `mcp-abap-adt-interfaces`, in a worktree on a new branch, open one
   PR for this change. It links #304 and PR #333 and quotes the decided text of D1, C3 and
   C4 from the spec.
2. **D1, the name.** `AdtObjectIdentity` takes the config's own name key alongside its
   parent keys, and each capability interface names the key it requires. The PR settles the
   exact parameter shape and records it in its description.
3. **D1, the source and the lock handle.** The options of the members that send them get
   option types that require them: `update` (`source`, `lockHandle`), `updateMetadata`
   (`source`, `lockHandle`), and the local class includes' `validate` and `check` (the
   config's `source`). `IAdtOperationOptions` stays optional for every other member.
4. **C3.** The generic overload of every member whose implementation can return the
   library's own error with `analyse` given answers `IAdtResponse<T, E | IAdtError>`. For
   abapGit facts, that is `E | IAbapGitStructuredError`. The list of members comes from the
   helper each adt-clients member calls (spec section 5, C3). It is drawn up from the
   adt-clients source and attached to the PR.
5. **C4.** Remove the deprecated old-form abapGit declarations it carries: `IAbapGitLinkArgs`
   with `remoteUser` and `remotePassword`, the old external-repo credentials args, and the
   old-form overloads, if declared there.
6. **Type tests** in that repository's own form for 2–5, both what compiles and what is
   refused.
7. **Docs and release** in that repository: its CHANGELOG and migration note. The version
   follows its own versioning. After its review and merge, it is tagged. **The owner
   publishes.** This stage is done when the version resolves from the registry; until then
   nothing below builds against it.

## Stage 2: the guard, in this repository

**Scope**: spec sections 1 and 6.

8. **Write the guard's own tests first.** In-memory programs for every case listed in spec
   section 6, under C, Y, N, R and P, both refused and allowed.
9. **`tools/sourceRules.js`.** Implement spec section 1 to make those tests pass: the
   C, Y, N, R and P rules, the boundary-reader and reader-module lists, `findForbidden`,
   and `--inventory`. It uses the TypeScript compiler API only, with no regex.
10. **Take the inventory with it.** Compare the result with spec section 2, per kind and per
    site. Any difference is reported to the owner before Stage 3: a site the guard finds
    that the spec missed, or the other way round. The N rule's full list, beyond the six
    known sites, is part of that report.
11. **Add a per-package test that reports without failing.** Add
    `src/__tests__/unit/sourceRules.test.ts` to each package, asserting the current finding
    count does not grow. It becomes `[]` at the end of each package's stage.

## Stage 3: adt-strategies

**Scope**: its K1, K3 (D2), K5, N, Y, R and P sites. It has no K2, K4, K6, K7 or K8.

12. **Install the published interfaces-adt.** Raise the range, install from the registry,
    and check the lockfile.
13. **K1, type-only.** Snapshot `dist`, delete the casts, add the wider annotations where
    needed, and compare `dist`.
14. **Y and N, type-only where possible.** Bind each dependency `any` to `unknown`, type the
    header readers' parameters `IHttpHeaderValue | undefined` and the `tableSettings`
    readers' parameters `ParsedElement`, then compare `dist`.
15. **K5 readers.** Write the table tests of spec section 7 over the recorded answers and
    the constructed holders, against the old code. Then the `Node` and `Record` casts in
    `analyse.ts`, `atc.ts`, `traces.ts` and `parseSearchConfigurations.ts` become
    `parsed.ts` reads, and `analyse.ts:100, 102` uses `propertyOf`.
16. **D2, the trace readers.** Write one test per required field over the recorded feeds:
    it reads as before, and throws naming the field when that field is removed. Then
    replace the 28 casts with throwing readers.
17. **R scanners, one commit per pattern family.** For each, write the differential test
    first: oracle, recorded inputs, edge cases, and the bounded exhaustive plus seeded
    random alphabet. Then the scanner. The families are:
    - `/runs/` ids;
    - the `aunit:run` uri and its fallback;
    - `T100KEY-V`;
    - the longtext link and `&amp;`;
    - trailing slashes;
    - trace id, sub-millisecond and leap second.
18. **P.** Check the eight predicates' provenance with the guard. Any that fails is
    replaced as spec section 2, P describes.
19. **Make the guard strict.** The package's `sourceRules.test.ts` asserts `[]`. Break each
    rule once in `src` and revert.
20. **Docs.** `CHANGELOG.md` (D2, the interfaces-adt range), `ERRATA.md` and
    `ANSWER_SHAPES.md` where a trace reading's behaviour changed, and the migration note for
    D2. The version is a breaking 0.x release, as the goal states.
21. **Stage review.** Push, check CI, then run the external review.

## Stage 4: adt-clients

**Scope**: its K1, K2 (D1), K4 (D3, C1, C2, C3), K5, K6, K7, K8, Y, R and P sites, and C4.

22. **Install the published interfaces-adt.** Raise the range and install from the
    registry. Take adt-strategies through the workspace (the standing exception) at its new
    version. Check the lockfile.
23. **K1, type-only.** Snapshot `dist`, delete the casts and compare.
24. **D1, deletions.** The 144 name, 52 source and 12 lock-handle casts go, now that the
    contract types them, and `dist` is compared. Then the type checks for every capability
    family, with the omitted fields refused and the full calls compiling.
25. **D1, the 29 fields it does not require.** For each internal function, the test against
    the old code comes first, with `undefined` and with a value and the request it builds.
    Then the parameter takes the contract's type and the implicit conversions are written
    out.
26. **The enhancement lock datum.** Write the test (`unlockAll()` on an abandoned
    enhancement lock sends the same request), then add the per-lock datum to
    `createLockTracker` and remove `lockedTypes`.
27. **D3 overloads, one commit per handler family.** The 703 signatures get the
    interfaces' two overloads, and `dist` is compared per family. Then the type checks:
    generic with `analyse` compiles, generic without it is refused, and the default call
    compiles.
28. **C3, the helpers.** `answering`, `answeringExchange`, `answeringActivation`,
    `systemInfo`, `chain` and the abapGit facts exchange return `E | IAdtError` (or
    `E | IAbapGitStructuredError`) on the library's own paths with no cast. The members
    follow the interfaces-adt types. Type checks, and a spy test that `analyse` is not
    called on those paths.
29. **C1.** Test that a batch member gets its part, then remove `<T, D>` from
    `AdtBatchConnection.makeAdtRequest`, then add a type check that the generic form is
    refused.
30. **C2.** Write the settlement tests (answer, close, timeout, reader throws, next request
    on the same id), then add the two `request` overloads with the reader.
31. **C4.** Remove the old abapGit form: overloads, `DeprecatedOptions`, the old builders and
    the result slots. Type checks that old calls are refused; the new form's tests stay
    green.
32. **AbapGit slot lookup.** The results map is typed per slot. Type-only, so compare
    `dist`.
33. **K5 readers.** Write the table tests first (spec section 7: recorded refusals, an
    inherited `response`, a getter, primitives, `null`). Then add `propertyOf` and the
    `as…` readers beside `ownValue`, and change each site under its own policy, as the spec
    lists.
34. **K6, the profiler.** Write the view tests and the unknown-view test, then add the
    handler map with `Object.hasOwn`.
35. **K7 `AdtService` and K8 `AdtClient`.** `AdtService` is type-only, so compare `dist`.
    For K8, test the error's shape, then switch to `Object.assign`.
36. **Y.** Bind every dependency `any` to `unknown`. For `callTimeout`, write the forwarding
    tests first (spec section 7), then change the Proxy trap.
37. **R scanners, one commit per family.** Differential tests first, as in step 17. Use the
    recorded `$batch`, where-used scope and ATC answers this task added, the discovery
    documents, and the existing recordings. The families are:
    - the multipart reader;
    - the where-used rewrite and the scope rewrap;
    - discovery hrefs;
    - the cloud host test;
    - `replaceAll('-', '')` at both sites.
38. **P.** Replace the six typed predicates (spec section 2, P), each after a test of its
    callers' narrowing results, then check the rest with the guard.
39. **Public surface.** Diff the package's `.d.ts` before and after. The only differences
    allowed are those D1–D3 and C1–C4 name, and any other difference is a defect, fixed
    before going on.
40. **Make the guard strict.** Assert `[]`, then break each rule once in `src` and revert.
41. **Live run.** When the stage is green, tell the owner it is ready for its live run, and
    wait for the go. Then run the changed members' integration suites on premise and on
    ABAP Cloud. Each suite is named in the message, with what it does on the system. The
    test data comes from the existing overlays.
42. **Docs.** `CHANGELOG.md`; `docs/usage/MIGRATION-<major>.md`, covering D1–D3 and C1–C4
    and linked from the README's migration list; every README and `docs/usage/` example
    whose call changed, compiled through `tsconfig.test.json`; and the README sections on
    identities, `analyse` and error typing, batches, WebSocket and abapGit.
43. **Stage review.** Push, check CI, then run the external review.

## Stage 5: adt-clients-legacy

**Scope**: its K1, K2 (D1), K4 (D3 and C3, the legacy refusals) and C5.

44. **Ranges.** adt-clients goes through the workspace at its new major, and interfaces-adt
    from the registry. Check the lockfile.
45. **K1 and K2.** Delete the casts (type-only) and compare `dist`.
46. **D3 and C3 for the legacy refusals.** The overload pairs, with the refusal typed
    `E | IAdtError` and no cast. Tests: the refusal is answered, no request is sent (a
    recording connection sees none), and `analyse` is not called.
47. **C5.** Write the tests first: each absent handler answers the refusal, sends no
    request, and overrides every member of the modern prototype chain. Then add the eight
    `*AbsentLegacy` subclasses, switch the factory to construct them, and remove
    `absentOnLegacy`. The legacy rules' existing tests (`legacyClassesOnlyOverride`,
    `legacyStaysInLegacyClasses`) stay green.
48. **Public surface `.d.ts` diff**, as in step 39.
49. **Make the guard strict**, as in step 40.
50. **Live run on the legacy system.** Wait for the go, then run the legacy package's live
    cycles for the changed handlers, as `docs/LIVE_TESTING.md` describes.
51. **Docs.** The legacy README, `docs/LEGACY.md`, `CHANGELOG.md`, and a migration note
    for C5 and the inherited D1 and D3.
52. **Stage review.** Push, check CI, then run the external review.

## Stage 6: release

53. **Full gate.** Run the root `npm run check`, and the full integration suites on premise
    and on ABAP Cloud with the owner's go. Every failure is fixed before tagging.
54. **Working documents go.** Delete the goal, spec and plan in the last commit before the
    merge. Move what they still owe into the PR description: mcp-abap-adt adopting the new
    majors, and anything the interfaces-adt PR left for later.
55. **Merge** after the external review approves and CI is green.
56. **Tag and publish, in order.** adt-strategies, then adt-clients, then
    adt-clients-legacy, each tagged `<directory>-v<version>` on the main checkout at the
    merge. Before each tag, every range resolves on the registry and the only
    `"link": true` entries are workspace siblings. **The owner publishes each package**, and
    the next one is tagged only once the previous one resolves from the registry.
57. **Clean install.** After each publish, install the package from the registry into an
    empty directory outside the repository, to prove it installs.
58. **Hand-over.** Report the published versions and the migration notes for mcp-abap-adt,
    which takes the new majors in its own work.

## Decisions this plan rests on

- The release order is interfaces-adt, then adt-strategies, then adt-clients, then
  adt-clients-legacy, each built only against what is already published or is a workspace
  sibling.
- adt-strategies ships a breaking 0.x release: D2 changes its public trace readings, and its
  interfaces-adt range crosses a breaking release. adt-clients and adt-clients-legacy ship
  majors. interfaces-adt follows its own versioning.
- The guard is built before any site changes, so every later stage is measured by the same
  definition the inventory used.
- There is no exception list. A site the guard finds is fixed in the code.
