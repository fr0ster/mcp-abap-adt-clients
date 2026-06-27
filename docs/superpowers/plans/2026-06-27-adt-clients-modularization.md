# adt-clients Modularization & Interface-Boundary Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@mcp-abap-adt/interfaces` the single source of interfaces/types/constants and let consumers pull only what they need from `@mcp-abap-adt/adt-clients`, without all-or-nothing install/runtime cost.

**Architecture:** Three repos, library side only — `@mcp-abap-adt/interfaces` (pure contracts) and `@mcp-abap-adt/adt-clients` (concrete impl). The consumer `@mcp-abap-adt/core` is **out of scope** — it adapts to the new boundaries on its own next update. Work proceeds in phases; the breaking phases (1, 2, 3B) land together in **one major `adt-clients` release**; `interfaces` gets an additive minor.

**Tech Stack:** TypeScript (strict, CommonJS output), Biome, Jest (integration-heavy; unit tests SAP-free), npm workspaces of sibling repos resolved from the npm registry.

## Global Constraints

- Repo paths: interfaces = `/home/okyslytsia/prj/mcp-abap-adt-interfaces`, adt-clients = `/home/okyslytsia/prj/mcp-abap-adt-clients`.
- All artifacts in English; Biome config = single quotes, semicolons, 2-space indent.
- Never bump `package.json` version without explicit user request; after a bump run `npm install --package-lock-only` and commit the lockfile in the same commit.
- No `"link": true` in any `package-lock.json` — all deps resolve from the npm registry. Verify after every `npm install`.
- Interface-only communication: all runtime code depends on `IAbapConnection`, never a concrete connection.
- Each phase is a separate branch + PR off `main`. Breaking phases must NOT be released piecemeal — tag the major only after Phases 1–3 land.
- Verification baseline for every task: `npm run build` clean (Biome + tsc) and the existing unit suite green (`SAP_URL= npx jest src/__tests__/unit`). Integration tests are trial-gated and run only when explicitly requested (needs the trial browser profile up).

---

## File Structure

- `interfaces/src/adt/IAdtSharedTypes.ts` — **new**: the promoted public read-only contract types (object-type unions, ObjectReference, where-used result/param types, package-hierarchy, search params). One file, contract-only.
- `interfaces/src/index.ts` — add the new export.
- `adt-clients/src/core/shared/types.ts` — strip the promoted types; re-`import type` them from interfaces for internal use.
- `adt-clients/src/core/shared/index.ts` — stop aliasing the promoted types locally (consumers get them from interfaces).
- `adt-clients/src/index.ts` — remove the interface-type re-export block; add a per-group `exports` subpath strategy.
- `adt-clients/src/core/service/types.ts`, `adt-clients/src/runtime/systemMessages/types.ts`, `adt-clients/src/executors/index.ts` — drop interface re-exports.
- `adt-clients/package.json` — `yaml` → devDeps; `exports` subpath map; (Phase 3B) split out `abapgit`/`ws` packages.
- `adt-clients/src/index.core.ts`, `index.runtime.ts`, `index.batch.ts`, `index.ws.ts`, `index.abapgit.ts`, `index.executors.ts` — **new** subpath entry barrels (Phase 3A).

---

## Phase 0 — Hygiene (non-breaking, standalone)

### Task 0.1: Move dead `yaml` prod dependency to devDependencies

**Files:**
- Modify: `adt-clients/package.json` (dependencies → devDependencies for `yaml`)
- Modify: `adt-clients/package-lock.json` (regenerated)

**Interfaces:** Produces: nothing code-facing; reduces install surface.

- [ ] **Step 1: Confirm `yaml` is unused in `src/`**

Run: `cd /home/okyslytsia/prj/mcp-abap-adt-clients && grep -rnE "from 'yaml'|require\('yaml'\)|from \"yaml\"" src/ | grep -v __tests__`
Expected: no output (yaml only used in tests/config).

- [ ] **Step 2: Move the entry**

In `adt-clients/package.json`, cut `"yaml": "^2.3.4"` from `"dependencies"` and add it under `"devDependencies"` (keep alphabetical order).

- [ ] **Step 3: Regenerate lockfile and verify no link entries**

Run: `npm install --package-lock-only && grep -c '"link": true' package-lock.json`
Expected: `0`.

- [ ] **Step 4: Build + unit suite green**

Run: `npm run build && SAP_URL= npx jest src/__tests__/unit`
Expected: build clean, all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): move unused 'yaml' from dependencies to devDependencies"
```

This task is releasable on its own as a **patch** if desired (non-breaking).

---

## Phase 1 — Enforce the "no re-export of interface types" rule (BREAKING)

Removes the leak that lets consumers import interface-owned symbols from `adt-clients`. After this, consumers must import those from `@mcp-abap-adt/interfaces` directly (the consumer adapts on its own update).

### Task 1.1: Remove the interface-type re-export block from the public barrel

**Files:**
- Modify: `adt-clients/src/index.ts:24-35` (the `export type { … } from '@mcp-abap-adt/interfaces'` block)
- Test: `adt-clients/src/__tests__/unit/publicApiBoundary.test.ts` (new guard)

**Interfaces:** Produces: a guard test asserting the barrel never re-exports interface-owned symbols.

- [ ] **Step 1: Write the failing guard test**

```ts
// adt-clients/src/__tests__/unit/publicApiBoundary.test.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

const INDEX = path.resolve(__dirname, '../../index.ts');

describe('public API boundary', () => {
  it('does not re-export anything from @mcp-abap-adt/interfaces', () => {
    const src = fs.readFileSync(INDEX, 'utf8');
    // No `export ... from '@mcp-abap-adt/interfaces'` (type or value).
    expect(src).not.toMatch(/export\s+(type\s+)?\{[^}]*\}\s+from\s+['"]@mcp-abap-adt\/interfaces['"]/s);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `SAP_URL= npx jest src/__tests__/unit/publicApiBoundary.test.ts`
Expected: FAIL (the re-export block at index.ts:24-35 still matches).

- [ ] **Step 3: Delete the re-export block**

Remove the entire block in `adt-clients/src/index.ts`:
```ts
// Export supporting types needed by client APIs
export type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtObject,
  IAdtResponse,
  ILogger,
  IWebSocketCloseInfo,
  IWebSocketConnectOptions,
  IWebSocketMessageEnvelope,
  IWebSocketMessageHandler,
  IWebSocketTransport,
} from '@mcp-abap-adt/interfaces';
```

- [ ] **Step 4: Run guard + build + unit suite**

Run: `SAP_URL= npx jest src/__tests__/unit/publicApiBoundary.test.ts && npm run build && SAP_URL= npx jest src/__tests__/unit`
Expected: guard PASS; build clean; unit suite green. (adt-clients' own code imports these from interfaces directly already, so internal compilation is unaffected.)

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/__tests__/unit/publicApiBoundary.test.ts
git commit -m "refactor!: stop re-exporting interface types from the public barrel"
```

### Task 1.2: Drop interface re-exports from submodule barrels

**Files:**
- Modify: `adt-clients/src/core/service/types.ts:10-11` (remove `export type { ServiceBindingVariant }` + `export { SERVICE_BINDING_VARIANT_MAP }` from interfaces)
- Modify: `adt-clients/src/runtime/systemMessages/types.ts:1` (remove `export … ISystemMessageEntry` from interfaces)
- Modify: `adt-clients/src/executors/index.ts:1` (remove `export … IExecutor` from interfaces)

**Interfaces:** Consumes: the Task 1.1 guard. Produces: a clean boundary — these symbols now come only from interfaces.

- [ ] **Step 1: Extend the guard to the submodule barrels**

Append to `publicApiBoundary.test.ts`:
```ts
it('submodule barrels do not re-export interface symbols', () => {
  const files = [
    'core/service/types.ts',
    'runtime/systemMessages/types.ts',
    'executors/index.ts',
  ].map((f) => path.resolve(__dirname, '../../', f));
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    expect(src).not.toMatch(/export\s+(type\s+)?\{[^}]*\}\s+from\s+['"]@mcp-abap-adt\/interfaces['"]/s);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `SAP_URL= npx jest src/__tests__/unit/publicApiBoundary.test.ts`
Expected: FAIL on the three barrels.

- [ ] **Step 3: Convert each re-export to a plain import**

In each file, change `export { … } from '@mcp-abap-adt/interfaces'` / `export type { … }` to a non-exporting `import type { … } from '@mcp-abap-adt/interfaces'` **only if the symbol is used internally**; if it is used only to re-publish, delete the line. Verify usage first per file:
Run: `grep -n "ServiceBindingVariant\|SERVICE_BINDING_VARIANT_MAP" src/core/service/*.ts`
Keep an `import` (not `export`) where the symbol is referenced; otherwise remove.

- [ ] **Step 4: Guard + build + unit suite green**

Run: `SAP_URL= npx jest src/__tests__/unit/publicApiBoundary.test.ts && npm run build && SAP_URL= npx jest src/__tests__/unit`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/service/types.ts src/runtime/systemMessages/types.ts src/executors/index.ts src/__tests__/unit/publicApiBoundary.test.ts
git commit -m "refactor!: drop interface re-exports from service/systemMessages/executors barrels"
```

---

## Phase 2 — Promote public read-only contract types into `interfaces` (BREAKING)

Moves the shared, consumer-facing data contracts out of adt-clients so a consumer can type results without depending on the concrete client. Scope = the read-only/shared types named in the design intent. `IXxxConfig`/`IXxxState` (28 modules) are deliberately **deferred** (see Phase 2-Deferred) because they are more tightly coupled to handler implementations.

### Task 2.1: Create the shared-types contract file in interfaces

**Files:**
- Create: `interfaces/src/adt/IAdtSharedTypes.ts`
- Modify: `interfaces/src/index.ts` (add `export * from './adt/IAdtSharedTypes'` or a curated `export type { … }`)

**Interfaces:** Produces (exact names — these are the public aliases consumers use today, moved verbatim):
`AdtObjectType`, `AdtSourceObjectType`, `ObjectReference` (from `IObjectReference`), `ReadOptions`/`IReadOptions`, `InactiveObjectsResponse`, `SearchObjectsParams`, `ISearchResult`, `GetSqlQueryParams`, `GetTableContentsParams`, `GetDiscoveryParams`, `GetWhereUsedScopeParams`, `GetWhereUsedParams`, `GetWhereUsedListParams`, `WhereUsedReference`, `WhereUsedListResult`, `VirtualFoldersPreselection`, `GetVirtualFoldersContentsParams`, `GetPackageHierarchyOptions`, `PackageHierarchySupportedType`, `PackageHierarchyCodeFormat`, `PackageHierarchyNode`, `GetPackageContentsListOptions`, `PackageContentItem`.

- [ ] **Step 1: Copy the type definitions verbatim into interfaces**

Move the bodies of these exports from `adt-clients/src/core/shared/types.ts` (lines per the inventory: `AdtObjectTypeLower`/`AdtObjectType` 5-31, `AdtSourceObjectType*` 33-56, `IObjectReference` 58-66, `IReadOptions` 67-75, `IInactiveObjectsResponse` 76-83, `ISearchObjectsParams` 84-92, `ISearchResult` 93-103, `IGetSqlQueryParams` 104-111, `IGetTableContentsParams` 112-119, `IGetDiscoveryParams` 120-127, `IGetWhereUsed*Params` 128-179, `IWhereUsedReference` 180-203, `IWhereUsedListResult` 204-221, `IVirtualFolders*` 222-237, `IGetPackageHierarchyOptions` 238-243, `PackageHierarchy*` 244-277, `IGetPackageContentsListOptions`/`IPackageContentItem` 278-303) into `interfaces/src/adt/IAdtSharedTypes.ts`, keeping the `I`-prefixed names.

**Note on `IReadOptions`:** interfaces already exports `IReadOptions` from `shared/IReadOptions`. Do NOT duplicate — instead `import type { IReadOptions } from '../shared/IReadOptions'` inside `IAdtSharedTypes.ts` if referenced, and drop the adt-clients local copy in Task 2.2. Reconcile the two definitions first:
Run: `diff <(sed -n '67,75p' /home/okyslytsia/prj/mcp-abap-adt-clients/src/core/shared/types.ts) /home/okyslytsia/prj/mcp-abap-adt-interfaces/src/shared/IReadOptions.ts`
If they differ, keep the interfaces version as canonical and note any field delta in the commit message.

- [ ] **Step 2: Export from the interfaces barrel**

In `interfaces/src/index.ts` add:
```ts
export * from './adt/IAdtSharedTypes';
```
(Place it in the `adt` domain group, matching existing ordering.)

- [ ] **Step 3: Build interfaces**

Run: `cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run build`
Expected: clean compile.

- [ ] **Step 4: Commit (interfaces repo)**

```bash
git add src/adt/IAdtSharedTypes.ts src/index.ts
git commit -m "feat: add shared ADT read-only contract types (object types, where-used, package hierarchy, search)"
```

- [ ] **Step 5: Publish a prerelease for local consumption** (only if adt-clients can't resolve via workspace)

If adt-clients resolves interfaces from the registry, publish a minor (e.g. with the user's approval) OR use `npm pack` + file install in a scratch dir to validate Task 2.2 before the real publish. Record which path was used.

### Task 2.2: Re-point adt-clients shared types to interfaces

**Files:**
- Modify: `adt-clients/src/core/shared/types.ts` (delete the promoted definitions; `import type` them from interfaces where still referenced internally)
- Modify: `adt-clients/src/core/shared/index.ts:17-40` (remove the local `export type { … as … } from './types'` aliases for promoted names — consumers now import from interfaces)
- Modify: `adt-clients/src/index.ts` (remove the corresponding shared-type names from the public surface if present)

**Interfaces:** Consumes: the new interfaces exports from Task 2.1.

- [ ] **Step 1: Bump the interfaces dep and install**

In `adt-clients/package.json` set `@mcp-abap-adt/interfaces` to the version published in Task 2.1; run `npm install --package-lock-only` and verify `grep -c '"link": true' package-lock.json` is `0`.

- [ ] **Step 2: Delete promoted definitions, keep internal imports**

In `adt-clients/src/core/shared/types.ts` remove the moved `export interface/type` blocks. Where adt-clients code still references them internally (e.g. `whereUsed.ts` uses `IGetWhereUsedListParams`, `IWhereUsedListResult`), add at the top:
```ts
import type {
  IGetWhereUsedListParams,
  IWhereUsedListResult,
  IWhereUsedReference,
  // …only the ones referenced internally
} from '@mcp-abap-adt/interfaces';
```
and re-export for intra-package callers that import from `./types`:
```ts
export type { IGetWhereUsedListParams, IWhereUsedListResult, IWhereUsedReference } from '@mcp-abap-adt/interfaces';
```
**Caveat:** re-exporting from `./types` is fine for INTERNAL module wiring, but `src/core/shared/index.ts` (the public barrel) must NOT alias them anymore — that is the boundary the guard enforces. Extend the Phase 1 guard to also assert `core/shared/index.ts` does not re-export interface types.

- [ ] **Step 3: Remove public aliases**

In `adt-clients/src/core/shared/index.ts` delete the `as ObjectReference`, `as SearchObjectsParams`, `as WhereUsedListResult`, etc. aliases (lines 17-40) for the promoted set. Leave any alias whose underlying type was NOT promoted.

- [ ] **Step 4: Build + full unit suite + typecheck tests**

Run: `npm run build && npm run test:check && SAP_URL= npx jest src/__tests__/unit`
Expected: clean. Any compile error points to an internal reference that needs the Step 2 internal import.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/core/shared/types.ts src/core/shared/index.ts src/index.ts src/__tests__/unit/publicApiBoundary.test.ts
git commit -m "refactor!: source shared ADT read-only types from @mcp-abap-adt/interfaces"
```

### Phase 2-Deferred (documented, not scheduled)

`IXxxConfig`/`IXxxState` for all 28 core modules and client-specific result types (`IAbapGit*`, `IFeatureToggle*`, debugger/executor params) remain in adt-clients for now — moving them is a second major and should be its own plan after Phases 1–3 ship and the consumer has adapted once. Record this explicitly in the CHANGELOG "Deferred" note.

---

## Phase 3 — Packaging so consumers pull only what they need

CommonJS has no tree-shaking, so the lever is **subpath entry points** (3A) and **physical extraction of clean leaves** (3B), not the dependency graph (already clean: `AdtClient` has zero static edges into runtime/batch/ws/executors).

### Task 3.1 (Strategy A): Subpath entry barrels + `exports` map

**Files:**
- Create: `adt-clients/src/index.core.ts`, `index.runtime.ts`, `index.batch.ts`, `index.ws.ts`, `index.abapgit.ts`, `index.executors.ts`
- Modify: `adt-clients/src/index.ts` (root barrel re-exports the group barrels — stays back-compatible)
- Modify: `adt-clients/package.json` (`exports` map + `typesVersions` for TS subpath types)
- Test: `adt-clients/src/__tests__/unit/subpathExports.test.ts`

**Interfaces:** Produces subpaths: `@mcp-abap-adt/adt-clients/core|runtime|batch|ws|abapgit|executors`.

- [ ] **Step 1: Write the failing subpath smoke test**

```ts
// adt-clients/src/__tests__/unit/subpathExports.test.ts
import { AdtClient } from '../../index.core';
import { AdtClientsWS } from '../../index.ws';
import { AdtAbapGitClient } from '../../index.abapgit';

describe('subpath entry barrels', () => {
  it('core exposes AdtClient without dragging runtime', () => {
    expect(typeof AdtClient).toBe('function');
  });
  it('ws and abapgit barrels resolve standalone', () => {
    expect(typeof AdtClientsWS).toBe('function');
    expect(typeof AdtAbapGitClient).toBe('function');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `SAP_URL= npx jest src/__tests__/unit/subpathExports.test.ts`
Expected: FAIL (the `index.core.ts` etc. files do not exist).

- [ ] **Step 3: Create the group barrels**

Each new `index.<group>.ts` re-exports exactly the symbols its group owns (split the current `src/index.ts` exports by group per the module map: core = `AdtClient`, `AdtClientLegacy`, `createAdtClient`, core `IXxxConfig/State`, `AdtUtils` surface; runtime = `AdtRuntimeClient` + runtime classes; batch = `AdtClientBatch`, `AdtRuntimeClientBatch`, `BatchRecordingConnection`; ws = `AdtClientsWS`, `DebuggerSessionClient`; abapgit = `AdtAbapGitClient`; executors = `AdtExecutor`). Then make `src/index.ts` re-export the group barrels so the root surface is unchanged.

- [ ] **Step 4: Add the `exports` map**

In `adt-clients/package.json`:
```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
  "./core": { "types": "./dist/index.core.d.ts", "default": "./dist/index.core.js" },
  "./runtime": { "types": "./dist/index.runtime.d.ts", "default": "./dist/index.runtime.js" },
  "./batch": { "types": "./dist/index.batch.d.ts", "default": "./dist/index.batch.js" },
  "./ws": { "types": "./dist/index.ws.d.ts", "default": "./dist/index.ws.js" },
  "./abapgit": { "types": "./dist/index.abapgit.d.ts", "default": "./dist/index.abapgit.js" },
  "./executors": { "types": "./dist/index.executors.d.ts", "default": "./dist/index.executors.js" }
}
```
Add a matching `typesVersions` block so older TS resolvers find the subpath `.d.ts`.

- [ ] **Step 5: Build, smoke test, full unit suite**

Run: `npm run build && SAP_URL= npx jest src/__tests__/unit`
Expected: clean; subpath smoke test passes; root barrel unchanged (back-compat).

- [ ] **Step 6: Commit**

```bash
git add src/index*.ts package.json src/__tests__/unit/subpathExports.test.ts
git commit -m "feat: per-group subpath exports (core/runtime/batch/ws/abapgit/executors)"
```

### Task 3.2 (Strategy B): Extract the two clean leaves as separate packages

**Files (new repos/packages):** `@mcp-abap-adt/adt-clients-abapgit`, `@mcp-abap-adt/adt-clients-ws`. Each gets `src/` moved from adt-clients `clients/abapGit/*` and `clients/AdtClientsWS.ts` + `DebuggerSessionClient`, plus `package.json`, `tsconfig`, CI.
- Modify: `adt-clients` to depend on and re-export from the two new packages (back-compat shim), or drop them from the root surface with a deprecation note.

**Interfaces:** Produces two installable packages whose only deps are `@mcp-abap-adt/interfaces` (+ `node:crypto` for ws; `constants`/`utils/timeouts` extracted to a tiny shared base or duplicated for abapgit).

- [ ] **Step 1: Decide the shared-base question**

`abapgit` needs `constants/contentTypes` + `utils/timeouts`; `ws` needs neither. Choose: (a) duplicate the 2 tiny helpers into `-abapgit`, or (b) create `@mcp-abap-adt/adt-clients-base` for shared primitives. Record the choice; (a) is lower-cost for just these two leaves.

- [ ] **Step 2: Scaffold `@mcp-abap-adt/adt-clients-ws`**

Move `src/clients/AdtClientsWS.ts` + the `DebuggerSessionClient` it pairs with into the new package; deps = `@mcp-abap-adt/interfaces` only. Build it standalone:
Run (new pkg dir): `npm install && npm run build`
Expected: clean; no import of core/runtime/batch.

- [ ] **Step 3: Scaffold `@mcp-abap-adt/adt-clients-abapgit`**

Move `src/clients/abapGit/*` + `AdtAbapGitClient`; deps = interfaces + the chosen base helpers. Build standalone.

- [ ] **Step 4: Re-point adt-clients**

In adt-clients, replace the in-tree ws/abapgit sources with dependencies on the new packages; update `src/index.ws.ts` / `src/index.abapgit.ts` to re-export from them (back-compat). `npm install --package-lock-only`, verify no `"link": true`.

- [ ] **Step 5: Build + full unit suite across all three packages**

Run in each package: `npm run build`; in adt-clients: `SAP_URL= npx jest src/__tests__/unit`.
Expected: all clean.

- [ ] **Step 6: Commit (per repo)**

```bash
# in each new package
git add -A && git commit -m "feat: initial @mcp-abap-adt/adt-clients-<ws|abapgit> package"
# in adt-clients
git add -A && git commit -m "refactor!: source ws/abapgit clients from dedicated packages"
```

### Strategy C (documented, deferred)

Full split (`-base/-core/-runtime/-batch/-executors`) requires first breaking two cycles — `core → clients` (`IAdtSystemContext`, ~27 `import type` sites; move the 3-field interface to a `-base`) and `runtime ↔ batch` (`runtime/debugger/abap.ts:23` needs `batch/buildBatchPayload`; extract that primitive to `-base`). Do this only if tarball size becomes a hard requirement; capture as a separate plan.

---

## Release

- [ ] **interfaces:** additive minor (new shared types). Publish first.
- [ ] **adt-clients:** one **major** bump covering Phases 1–3 (re-export removal + shared-type promotion + packaging are all breaking to the public surface). CHANGELOG must list: removed interface re-exports (import from `@mcp-abap-adt/interfaces`), shared read-only types moved to interfaces, new subpath exports, ws/abapgit extracted, `Deferred` note for Config/State + Strategy C. Update version only on explicit user request; run `npm install --package-lock-only` after.
- [ ] Tag `vX.0.0` on adt-clients `main` to trigger the release workflow; publish to npm separately (user does `npm publish`).
- [ ] Delete this plan file once all phases are implemented (history lives in git).

---

## Self-Review Notes

- **Spec coverage:** Q1 (consumer pulls from interfaces) → Phases 1 & 2 make interfaces the only source for interface types + shared contract types; consumer adaptation is explicitly out of scope per the user. Q2 (split for minimal pull) → Phase 3A (subpath, CJS-correct lever) + 3B (extract clean leaves) + Strategy C deferred. Hygiene (yaml) → Phase 0.
- **Boundary guard** (`publicApiBoundary.test.ts`) is the regression net for the no-re-export rule across `index.ts`, the three submodule barrels, and `core/shared/index.ts`.
- **Deferred & explicit:** Config/State promotion and Strategy C are documented, not scheduled, to keep the first major bounded.
