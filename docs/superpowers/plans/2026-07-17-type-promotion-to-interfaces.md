# Type promotion to `@mcp-abap-adt/interfaces` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@mcp-abap-adt/interfaces` the single definition site for the ~28 object-type modules' consumer-facing types (params, `Config`/`State`, option/result types); adt-clients imports and re-exports them and deletes its local type declarations.

**Architecture:** Two releases. **A (interfaces):** reconcile each existing param copy to be structurally identical to adt-clients' current shape (verbatim), and add the local-only `Config`/`State`/option/result types — driven by a structural-diff report generated first. **B (adt-clients, after A publishes):** bump the interfaces dep, then per module replace the type declarations in `src/core/*/types.ts` with `export type { … } from '@mcp-abap-adt/interfaces'`, keeping runtime exports, and verify the public surface is unchanged.

**Tech Stack:** TypeScript (strict, CommonJS), Jest + ts-jest, Biome. Two repos: `~/prj/mcp-abap-adt-interfaces` (master) and `~/prj/mcp-abap-adt-clients` (main).

## Global Constraints

- **Preserve field names/optionality/nested shapes verbatim from adt-clients** — adt-clients is the source of truth. Do NOT normalize casing; low-level params legitimately mix snake_case with camelCase (`masterSystem`, `masterLanguage`).
- **Move type declarations only.** Runtime exports in `types.ts` (`enhancement/types.ts`: `ENHANCEMENT_TYPE_CODES`, `getEnhancementBaseUrl`, `getEnhancementUri`, `supportsSourceCode`, `isImplementationType`, `isSpotType`; `service/types.ts`: `resolveBindingVariant`) stay in adt-clients. Runtime refactor is out of scope.
- **Versioning (interfaces):** purely-additive-with-optional-fields → minor. Any incompatible change — required-field addition, field removal, tightened optionality, or changed nested shape — → **major**. Decided from the Task 1 diff report.
- **adt-clients re-exports** the promoted names so its public API is unchanged (non-breaking).
- **Out of scope:** ATC + synchronous-ABAP-Unit types (interfaces #17, adt-clients #68, server #147) — handled separately from the `mcp-abap-adt` side. Do not touch the `atc` module, `unitTest` sync types, or #17.
- Run unit tests offline: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand` (skips the SAP preflight). Baseline: 348 tests / 67 suites green.
- After any interfaces dep bump in adt-clients: `rm -rf node_modules/@mcp-abap-adt/interfaces && npm install @mcp-abap-adt/interfaces@<v>`, then verify `package-lock.json` has no `"link": true` and resolves from the registry.
- Never publish to npm from the agent — the user publishes. Interfaces must be published before adt-clients (Release B) starts.

## Module inventory (30 `types.ts`; ATC/unitTest-sync excluded from promotion content)

Params + Config/State live in `src/core/<module>/types.ts`. Counts (params / config+state): accessControl 3/2, appendStructure 3/2, authorizationField 1/2, behaviorDefinition 1/2 (+9 other type decls), behaviorImplementation 1/2, class 2/2, dataElement 3/2, ddl 3/2, domain 3/2, enhancement 3/2 (**runtime**), featureToggle 2/3 (+ option types), functionGroup 3/2, functionInclude 1/2, functionModule 3/2, interface 3/2, messageClass 2/4, metadataExtension 0/2, package 0/2, program 3/2, scalarFunction 3/2, scalarFunctionImplementation 3/2, serviceDefinition 3/2, service 5/2 (+ many, **runtime**), structure 3/2, table 3/2, tabletype 3/2, transformation 3/2, transport 1/2, unitTest 0/2. `shared/types.ts` holds 25 shared type decls (treated in Task 6).

---

## PHASE A — interfaces (repo `~/prj/mcp-abap-adt-interfaces`, branch `feat/promote-types`)

### Task A1: Structural-diff report (the worklist)

Produces the authoritative per-type diff that drives every later reconciliation task and decides the interfaces version. No product code yet.

**Files:**
- Create: `~/prj/mcp-abap-adt-interfaces/scripts/type-promotion-diff.mjs` (throwaway tooling; deleted in Task A9)
- Output: `~/prj/mcp-abap-adt-interfaces/type-promotion-diff.md` (git-ignored scratch)

- [ ] **Step 1: Write the diff script**

A Node ESM script that, for every `src/core/<module>/types.ts` in adt-clients (path: `../mcp-abap-adt-clients/src/core/*/types.ts`), extracts each exported `interface`/`type` block and compares it to the same-named declaration in `../mcp-abap-adt-interfaces/src/adt/IAdt<Module>.ts` (and `src/adt/*.ts` generally). For each type report one of: `ADD` (missing in interfaces), `MATCH`, `DIFF` (present but structurally different — list the differing lines). Exclude the `atc` module and the unitTest sync types (`IUnitTestRunSyncOptions`, `IUnitTestSummary`, `IUnitTestAlert`, `IUnitTestMethodResult`, `UnitTestObjectType`, `UnitTestRunScope`). Text-level block comparison (normalize whitespace) is sufficient — this is a worklist, not a compiler.

```js
// scripts/type-promotion-diff.mjs — throwaway. Enumerate adt-clients type blocks,
// compare to interfaces same-named blocks, classify ADD/MATCH/DIFF, write markdown.
// (Full implementation written during the task; ~80 lines of fs + regex block parsing.)
```

- [ ] **Step 2: Run it, write the report**

Run: `node scripts/type-promotion-diff.mjs > type-promotion-diff.md`
Expected: a markdown table per module listing every promoted type as ADD / MATCH / DIFF, with the differing lines for DIFFs. Confirm known cases appear: `IUpdateDomainParams.package_name` optionality DIFF, `IFixedValue` shape DIFF.

- [ ] **Step 3: Decide the interfaces version from the report**

Scan the DIFF entries. If every DIFF is an added optional field (and every ADD is optional) → **minor** (next: 10.1.0). If any DIFF/ADD is a required-field addition, field removal, tightened optionality, or changed nested shape → **major** (next: 11.0.0). Record the decision and the list of incompatible types at the top of `type-promotion-diff.md`.

- [ ] **Step 4: Commit the script (report stays git-ignored)**

```bash
cd ~/prj/mcp-abap-adt-interfaces
echo "type-promotion-diff.md" >> .gitignore
git add scripts/type-promotion-diff.mjs .gitignore
git commit -m "chore(promotion): structural-diff tooling for type promotion"
```

**Interfaces:** the report classifies every type as ADD/MATCH/DIFF and fixes the target version. Tasks A2-A5 consume it.

---

### Task A2: Reconcile params — batch 1 (modules A–F)

Reconcile each param interface so the interfaces copy is byte-identical (modulo formatting) to adt-clients' current shape, per the Task A1 report. Batch 1: accessControl, appendStructure, authorizationField, behaviorDefinition, behaviorImplementation, class, dataElement, ddl, domain, enhancement, featureToggle, functionGroup, functionInclude, functionModule.

**Files:**
- Modify: `~/prj/mcp-abap-adt-interfaces/src/adt/IAdt<Module>.ts` for each batch-1 module (params sections only).

**Interfaces:**
- Consumes: Task A1 report (which types are ADD/DIFF and the exact differing lines).
- Produces: interfaces param interfaces structurally identical to adt-clients'.

- [ ] **Step 1: For each module in the batch, apply the report's ADD/DIFF items**

Worked pattern (module = `domain`, from the report). adt-clients `src/core/domain/types.ts` is the source of truth; copy its `ICreate/Read/Update/DeleteDomainParams` verbatim into `src/adt/IAdtDomain.ts`. Example DIFF fix — `IUpdateDomainParams.package_name`:

```ts
// interfaces IAdtDomain.ts — BEFORE (drifted)
  package_name?: string;
// AFTER (match adt-clients, which has it required)
  package_name: string;
```

And the `IFixedValue` nested-shape DIFF — replace the interfaces shape with adt-clients':

```ts
// interfaces — BEFORE
export interface IFixedValue { low: string; high?: string; description?: string; }
// AFTER (adt-clients shape, verbatim)
export interface IFixedValue { low: string; text: string; }
```

Repeat for every ADD/DIFF the report lists for each batch-1 module. Do NOT touch runtime exports (enhancement). Copy field names verbatim (keep `masterSystem`/`masterLanguage` camelCase).

- [ ] **Step 2: Build**

Run: `cd ~/prj/mcp-abap-adt-interfaces && npm run build`
Expected: clean (exit 0).

- [ ] **Step 3: Re-run the diff for batch-1 modules — expect MATCH**

Run: `node scripts/type-promotion-diff.mjs | grep -A2 -E "domain|class|enhancement"` (spot-check)
Expected: batch-1 param types now report MATCH (no DIFF/ADD).

- [ ] **Step 4: Commit**

```bash
git add src/adt/
git commit -m "feat(promotion): reconcile params to adt-clients shape — batch 1 (accessControl..functionModule)"
```

---

### Task A3: Reconcile params — batch 2 (modules I–Z)

Same pattern as A2 for: interface, messageClass, program, scalarFunction, scalarFunctionImplementation, serviceDefinition, service, structure, table, tabletype, transformation, transport. (metadataExtension, package, unitTest have 0 params.) Do NOT touch `service/types.ts` runtime `resolveBindingVariant`.

**Files:**
- Modify: `~/prj/mcp-abap-adt-interfaces/src/adt/IAdt<Module>.ts` for each batch-2 module.

**Interfaces:**
- Consumes: Task A1 report.
- Produces: all param interfaces reconciled.

- [ ] **Step 1: Apply the report's ADD/DIFF items per module** (same worked pattern as Task A2 Step 1 — copy adt-clients' param shape verbatim into the interfaces file).
- [ ] **Step 2: Build** — `npm run build`, expect exit 0.
- [ ] **Step 3: Full diff re-run — expect zero param DIFF/ADD across all modules**

Run: `node scripts/type-promotion-diff.mjs | grep -E "DIFF|ADD" | grep -iE "Params" || echo "all params MATCH"`
Expected: `all params MATCH`.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(promotion): reconcile params to adt-clients shape — batch 2 (interface..transport)"
```

---

### Task A4: Add `Config`/`State` types to interfaces

Promote the `IXxxConfig`/`IXxxState` types (local-only in adt-clients) into interfaces as new additions, verbatim. Add them to the matching `src/adt/IAdt<Module>.ts` and export from `src/index.ts`.

**Files:**
- Modify: `~/prj/mcp-abap-adt-interfaces/src/adt/IAdt<Module>.ts` (add `IXxxConfig`, `IXxxState`), `src/index.ts` (export them).

**Interfaces:**
- Consumes: adt-clients `src/core/*/types.ts` `IXxxConfig`/`IXxxState` blocks.
- Produces: `IXxxConfig`/`IXxxState` available from `@mcp-abap-adt/interfaces` for all ~28 modules.

- [ ] **Step 1: For each module, copy its `IXxxConfig`/`IXxxState` verbatim into the interfaces file and add to `src/index.ts` exports.**

`IXxxState` extends `IAdtObjectState` (already in interfaces) — keep the `extends`. Config stays camelCase (high-level). Worked example (`serviceDefinition`):

```ts
// interfaces IAdtServiceDefinition.ts — ADD (copied verbatim from adt-clients src/core/serviceDefinition/types.ts)
export interface IServiceDefinitionConfig {
  serviceDefinitionName: string;
  masterLanguage?: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}
export interface IServiceDefinitionState extends IAdtObjectState {
  readSourceResult?: IAdtResponse;
}
```

- [ ] **Step 2: Build** — `npm run build`, expect exit 0.
- [ ] **Step 3: Commit**

```bash
git commit -am "feat(promotion): add IXxxConfig/IXxxState to interfaces for all object-type modules"
```

---

### Task A5: Add option/result and remaining consumer-facing type decls

Promote the remaining consumer-facing non-param, non-config/state type declarations that a caller passes or receives (e.g. option types like `IReadOptions`-locals, `behaviorDefinition`'s extra decls, `messageClass` message types, `service` binding decls, `shared` types callers use). Per Task A1, only the ones a consumer touches; skip purely-internal implementation types. Exclude ATC/unitTest-sync.

**Files:**
- Modify: `~/prj/mcp-abap-adt-interfaces/src/adt/IAdt<Module>.ts`, `src/index.ts`.

**Interfaces:**
- Consumes: Task A1 report's non-param/config/state consumer-facing types.
- Produces: all in-scope consumer-facing types available from interfaces.

- [ ] **Step 1: Promote each remaining in-scope type verbatim; export from `src/index.ts`.** (Same copy-verbatim pattern.) For any type that is purely an internal implementation detail — not passed to or returned from a public `IAdtObject` method — leave it local in adt-clients and note it in the commit body.
- [ ] **Step 2: Build** — `npm run build`, expect exit 0.
- [ ] **Step 3: Commit**

```bash
git commit -am "feat(promotion): add remaining consumer-facing option/result types to interfaces"
```

---

### Task A6: Version bump, changelog, lockfile

**Files:**
- Modify: `~/prj/mcp-abap-adt-interfaces/package.json`, `package-lock.json`, `CHANGELOG.md`.

- [ ] **Step 1: Set the version from Task A1's decision** (minor 10.1.0 if additive-only; major 11.0.0 if any incompatible change). Edit `package.json`.
- [ ] **Step 2: `npm install --package-lock-only`; verify the version in `package-lock.json` and `grep -c '"link": true' package-lock.json` → 0.**
- [ ] **Step 3: Add the CHANGELOG entry** under a new version heading — list the promoted categories (params reconciled to adt-clients shape, `Config`/`State` added, option/result types added) and, if major, the specific incompatible reconciliations (from A1) under a `### Changed (BREAKING)` subsection.
- [ ] **Step 4: Build + commit**

Run: `npm run build` (exit 0).
```bash
git commit -am "release(<v>): promote object-type consumer-facing types to interfaces"
```

---

### Task A7: Delete the diff tooling, open PR

- [ ] **Step 1: Remove the throwaway script and its gitignore line**

```bash
cd ~/prj/mcp-abap-adt-interfaces
git rm scripts/type-promotion-diff.mjs
# remove the type-promotion-diff.md line from .gitignore
```

- [ ] **Step 2: Build once more** — `npm run build`, exit 0.
- [ ] **Step 3: Commit + push + open PR**

```bash
git commit -am "chore(promotion): remove diff tooling"
git push -u origin feat/promote-types
```
Open the PR (title `release(<v>): promote object-type consumer-facing types to interfaces`, body: what was promoted, the version rationale from A1, breaking list if major). Do NOT merge — await review.

- [ ] **Step 4: After review + merge: tag + GitHub release; STOP — user publishes**

Merge (squash), sync master, `git tag -a v<v>`, push tag, create the GitHub release (this repo has no CI auto-release). Then tell the user: `cd ~/prj/mcp-abap-adt-interfaces && npm publish`. **Phase B does not start until the user confirms publish.**

---

## PHASE B — adt-clients (repo `~/prj/mcp-abap-adt-clients`, branch `feat/consume-promoted-types`) — AFTER interfaces `<v>` is published

### Task B1: Bump interfaces dep + capture the public-surface baseline

**Files:**
- Modify: `package.json`, `package-lock.json`.
- Create: `~/…/scratchpad/surface-before.txt` (baseline; not committed).

- [ ] **Step 1: Capture the public-surface baseline from the CURRENT build**

Run (before any change): `npm run build:fast` then enumerate exported type names from each published entry point's `.d.ts`:
```bash
for e in index index.core index.runtime index.batch index.ws index.abapgit index.executors; do
  echo "== $e =="; grep -ohE "export (type )?\{[^}]*\}" dist/$e.d.ts 2>/dev/null;
done > /tmp/claude-*/…/scratchpad/surface-before.txt
```
(Resolve the scratchpad path at run time.) This is the invariant to preserve.

- [ ] **Step 2: Bump the dep and force-refresh**

Edit `package.json`: `"@mcp-abap-adt/interfaces": "^<v>"`. Then:
```bash
rm -rf node_modules/@mcp-abap-adt/interfaces
npm install @mcp-abap-adt/interfaces@<v>
npm install --package-lock-only
```
Verify: `cat node_modules/@mcp-abap-adt/interfaces/package.json | grep version` shows `<v>`; `grep -c '"link": true' package-lock.json` → 0.

- [ ] **Step 3: Build (still on local types) — must be green**

Run: `npm run build:fast` — exit 0 (nothing consumes the promoted types yet; this just proves the dep bump is clean).

- [ ] **Step 4: Commit**

```bash
git commit -am "chore: bump @mcp-abap-adt/interfaces to ^<v> (pre-promotion)"
```

---

### Task B2: Replace local type declarations with re-exports — params, batch 1

For each module in batch 1 (same list as Task A2), in `src/core/<module>/types.ts`: remove the param `interface` declarations and replace with `export type { … } from '@mcp-abap-adt/interfaces'`. **Keep all runtime exports and any not-yet-promoted local types.** The module barrel `src/core/<module>/index.ts` keeps its `export * from './types'`, so the re-exported names still flow to `./core`.

**Files:**
- Modify: `src/core/<module>/types.ts` for each batch-1 module.

**Interfaces:**
- Consumes: interfaces `<v>` (params now defined there).
- Produces: adt-clients param types sourced from interfaces; local decls gone.

- [ ] **Step 1: Worked pattern (module = `serviceDefinition`)**

`src/core/serviceDefinition/types.ts` — replace the local param interfaces with a re-export, keep the rest:
```ts
// BEFORE
export interface ICreateServiceDefinitionParams { /* … */ }
export interface IUpdateServiceDefinitionParams { /* … */ }
export interface IDeleteServiceDefinitionParams { /* … */ }
// AFTER
export type {
  ICreateServiceDefinitionParams,
  IUpdateServiceDefinitionParams,
  IDeleteServiceDefinitionParams,
} from '@mcp-abap-adt/interfaces';
```
Local `IXxxConfig`/`IXxxState` stay for now (handled in B4). Files that import these params from `./types` (create.ts etc.) are unaffected — the name still resolves.

- [ ] **Step 2: Build** — `npm run build:fast`, exit 0. A failure means a residual structural mismatch (the interfaces type ≠ what adt-clients code uses) → fix the interfaces side is impossible now (published); instead this proves Phase A reconciliation missed a case — STOP and report as BLOCKED with the exact type.
- [ ] **Step 3: Full unit suite** — `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand`, all pass (348).
- [ ] **Step 4: Commit** — `git commit -am "refactor(types): source params from interfaces — batch 1"`.

---

### Task B3: Replace local param declarations with re-exports — params, batch 2

Same as B2 for batch-2 modules (Task A3 list). Keep `service/types.ts` runtime `resolveBindingVariant` and `enhancement/types.ts` runtime helpers.

**Files:**
- Modify: `src/core/<module>/types.ts` for each batch-2 module.

- [ ] **Step 1: Apply the B2 pattern per batch-2 module** (re-export params from interfaces; keep runtime + config/state).
- [ ] **Step 2: Build** — `npm run build:fast`, exit 0.
- [ ] **Step 3: Full unit suite** — 348 pass.
- [ ] **Step 4: Commit** — `git commit -am "refactor(types): source params from interfaces — batch 2"`.

---

### Task B4: Re-export `Config`/`State` and promoted option/result types from interfaces

For every module, replace the local `IXxxConfig`/`IXxxState` (and any option/result types promoted in A5) with re-exports from interfaces. Keep runtime exports.

**Files:**
- Modify: `src/core/<module>/types.ts` (all ~28 modules).

- [ ] **Step 1: Per module, replace the local `Config`/`State`/promoted-option declarations with `export type { IXxxConfig, IXxxState, … } from '@mcp-abap-adt/interfaces'`.** Worked example (`serviceDefinition`): the `IServiceDefinitionConfig`/`IServiceDefinitionState` blocks become a re-export line. Leave any type NOT promoted in Phase A as a local declaration (and note it).
- [ ] **Step 2: Build** — `npm run build:fast`, exit 0.
- [ ] **Step 3: Full unit suite** — 348 pass.
- [ ] **Step 4: Commit** — `git commit -am "refactor(types): source Config/State + option types from interfaces"`.

---

### Task B5: Public-surface verification + lint

**Files:** none (verification only).

- [ ] **Step 1: Rebuild and capture the surface AFTER**

Run: `npm run build:fast` then the same enumeration as B1 Step 1 into `surface-after.txt`.

- [ ] **Step 2: Diff before/after — must be identical**

Run: `diff <scratchpad>/surface-before.txt <scratchpad>/surface-after.txt`
Expected: no differences (the re-exports preserved every published type name). Any difference is a regression — fix the offending module's re-export to restore the missing name.

- [ ] **Step 3: Lint** — `npm run lint:check`, exit 0.

---

### Task B6: Version, changelog, release (adt-clients)

**Files:**
- Modify: `package.json`, `package-lock.json`, `CHANGELOG.md`.

- [ ] **Step 1: Bump adt-clients version** (minor — internal consolidation, non-breaking public API; e.g. 7.5.0). Edit `package.json`; `npm install --package-lock-only`; verify lock version + no `"link": true`.
- [ ] **Step 2: CHANGELOG entry** — "Object-type consumer-facing types (params, `Config`/`State`, option/result) now sourced from `@mcp-abap-adt/interfaces@^<v>` and re-exported; local declarations removed. Public API unchanged (verified by surface snapshot). Runtime helpers unaffected."
- [ ] **Step 3: Verify + commit**

Run: `npm run build:fast && npm run lint:check && MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand` — all green.
```bash
git commit -am "release(7.5.0): source object-type types from interfaces; re-export to keep public API"
```

- [ ] **Step 4: Push, PR, (review), merge, tag, GitHub release; STOP — user publishes**

Push `feat/consume-promoted-types`, open PR, await review, merge (squash), sync main, `git tag -a v7.5.0`, push tag (CI creates the release — update notes), then tell the user to `npm publish` adt-clients.

---

## Self-Review

**Spec coverage:**
- Reconcile drift, adt-clients truth, verbatim shapes → Tasks A1 (diff), A2/A3 (params). ✓
- Structural diff incl optionality/nested/required-vs-optional → Task A1 Step 3 + A2/A3 apply. ✓
- Preserve verbatim casing (masterSystem) → Global Constraints + A2 pattern. ✓
- Promote Config/State (local-only → new) → Task A4. ✓
- Promote option/result types → Task A5. ✓
- Move type declarations only; keep runtime → Global Constraints + A3/B3 notes (enhancement, service). ✓
- Version from diff (minor vs major) → A1 Step 3, A6 Step 1. ✓
- adt-clients import + re-export (non-breaking) → B2/B3/B4. ✓
- Public-surface snapshot against published entry points via .d.ts → B1 Step 1, B5. ✓
- Two releases, interfaces-first, user publishes → A7, B6, phase gate. ✓
- ATC excluded → Global Constraints + A1 exclusions. ✓
- Force-refresh dep + no link:true → B1 Step 2. ✓

**Placeholder scan:** The per-type reconciliation content is intentionally diff-driven (Task A1 output), not pre-transcribed — the pattern + worked examples (domain/IFixedValue, serviceDefinition) are concrete; the diff report supplies each module's exact items. The diff-script body is described (fs + regex, ~80 lines) rather than written out; this is deliberate throwaway tooling. No TBD/TODO in product steps.

**Type consistency:** re-export names in B2/B3/B4 match the interface names reconciled/added in A2–A5 (`ICreateServiceDefinitionParams`, `IServiceDefinitionConfig`, …). Version placeholder `<v>` is the single value decided in A1/A6 and consumed in B1.
