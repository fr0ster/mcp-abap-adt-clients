# Capability Type-Honesty Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every handler declare its **honest** capability set — `implements` only the atom interfaces it truly supports — retire the fat `IAdtObject` from all handlers (kept `@deprecated`), and narrow each `AdtClient.getXxx()` return type to that honest set, so calling a capability a handler lacks (e.g. `getDomain().getVersions()`) becomes a **compile error** instead of a runtime throw.

**Architecture:** The class bodies barely change — the substantive change is in the composition layer. In `@mcp-abap-adt/interfaces` we deprecate `IAdtObject` and add named composite types for the recurring capability profiles. In `adt-clients` each handler swaps `implements IAdtObject<C,S>` for its honest composite (named or inline intersection of atoms), and `AdtClient.getXxx()` return types narrow to match. Throwing stubs for unsupported capabilities stay in place (`@deprecated`, removed in a later release) — the narrowed return type is what enforces the compile error.

**Tech Stack:** TypeScript (strict, CommonJS), Biome, ts-jest, the TypeScript compiler API for the surface snapshot and `scripts/capability-matrix.mjs` for the honest-profile classification.

## Global Constraints

- All repository artifacts in English; communication with the user in the user's language.
- Never change `package.json` version without explicit request; the user chooses CHANGELOG versions.
- After a version change, run `npm install --package-lock-only` and commit the lockfile in the same commit.
- Dependencies resolve from the npm registry only; after every `npm install`, `package-lock.json` must have zero `"link": true`.
- The user runs `npm publish`, never the agent. The agent merges PRs, tags, GitHub-releases.
- Publish the interfaces dependency to npm FIRST; Phase B is blocked until the new interfaces version is on npm.
- Tests: never pipe through grep/tail/head — save the full log with `tee`, then read it.
- Unit tests without SAP: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand`.
- Biome: 0 errors; warning/info baseline 45/25 in adt-clients — do not increase.
- **This is a BREAKING change for adt-clients → major (8.0.0).** It only breaks consumer code that referenced capabilities a handler never supported (methods that always threw at runtime). No working code breaks. Coordinate with the consumer (`~/prj/mcp-abap-adt`): after publish, bump its dep and confirm it compiles.

**Repos:** interfaces `~/prj/mcp-abap-adt-interfaces` (default branch **master**); adt-clients `~/prj/mcp-abap-adt-clients` (branch **main**); consumer `~/prj/mcp-abap-adt`.

## The honest-profile classification (generated)

From `node scripts/capability-matrix.mjs`, each handler's honest atom set. Two profiles recur enough to be **named composites**; the rest are **inline intersections**.

**Named composite `IAdtSourceObject<C,S>`** = all seven atoms (`IAdtCrud & IAdtValidatable & IAdtCheckable & IAdtActivatable & IAdtLockable & IAdtVersionable & IAdtTransportAware`). **22 handlers:** AccessControl, AppendStructure, BehaviorDefinition, BehaviorImplementation, Class, DdicTableType, Ddl, Enhancement, FunctionModule, Interface, LocalDefinitions, LocalMacros, LocalTestClass, LocalTypes, MetadataExtension, Program, ScalarFunction, ScalarFunctionImplementation, ServiceDefinition, Structure, Table, Transformation.

**Named composite `IAdtNonVersionedObject<C,S>`** = the six atoms without `IAdtVersionable`. **3 handlers:** DataElement, Domain, FunctionGroup.

**Inline-list handlers** (distinct profiles). NOTE on syntax: a class's `implements`
clause takes a **comma-separated list** of interfaces, NOT an intersection —
`implements A & B` is a syntax error (TS1005). Use `implements A<...>, B<...>, ...`.
(Intersections are only valid in a *type position* — e.g. the `AdtClient` return
types in Task B4, and the `Adt<Type>Type` aliases, where `A & B` is fine.)

| Handler | Honest capability set (implements A, B, …) | Missing vs full |
|---|---|---|
| FunctionInclude | Crud, Validatable, Checkable, Activatable, Lockable, Versionable | TransportAware |
| AuthorizationField | Crud, Validatable, Checkable, Activatable, Lockable | Versionable, TransportAware |
| Package | Crud, Validatable, Checkable, Lockable, TransportAware | Activatable, Versionable |
| MessageClass | Crud, Validatable, Lockable | Checkable, Activatable, Versionable, TransportAware |
| MessageClassMessage | Crud | everything else |

**Special / deferred (NOT in this migration) — all implement a widening interface or are wrong-contract:**
- **ServiceBinding** — implements the widening `IAdtServiceBinding` (which `extends IAdtObject`), not plain `IAdtObject`. Reconciling the widening interface with the atoms is its own work. **Deferred.**
- **FeatureToggle** — implements `IFeatureToggleObject`, which `extends IAdtObject<IFeatureToggleConfig, IFeatureToggleState>` (verified `node_modules/@mcp-abap-adt/interfaces/.../IAdtFeatureToggle.d.ts:103`). Same situation as ServiceBinding: the widening interface would have to be updated in interfaces to extend the honest atoms instead of `IAdtObject`. **Deferred.**
- **Request (`AdtRequest`)** — matrix shows no complete atom; but its `update`/`delete` throws are DEFECTS, not domain limits: transport-request `update` = change the description, `delete` = only for empty requests (see memory `reference_transport_request_update_delete`). Honest profile requires fixing those first. **Deferred.**
- **UnitTest (`AdtUnitTest`)** and **CdsUnitTest** (extends it) — a test runner, wrong contract entirely. **Deferred.**

The **30 in-scope handlers** are the 22 full + 3 non-versioned + 5 inline (FunctionInclude, AuthorizationField, Package, MessageClass, MessageClassMessage). FeatureToggle moved to deferred.

---

## File Structure

**Phase A — interfaces:**
- Modify `src/adt/IAdtObject.ts` — add `@deprecated` to `IAdtObject`.
- Create `src/adt/IAdtComposites.ts` — `IAdtSourceObject`, `IAdtNonVersionedObject`, plus a compile-time proof that `IAdtSourceObject` ≡ `IAdtObject`.
- Modify `src/index.ts` — export the two composites.

**Phase B — adt-clients:**
- Modify each in-scope `src/core/<type>/Adt<Type>.ts` — swap the `implements` clause (class body otherwise unchanged; throwing stubs stay, marked `@deprecated`).
- Modify each in-scope `src/core/<type>/index.ts` — the public `export type Adt<Type>Type = IAdtObject<IXxxConfig, IXxxState>;` alias must narrow to the same honest composite the handler now implements (consumers can use these aliases directly, so they must not keep exposing unsupported capabilities).
- Modify `src/clients/AdtClient.ts` — narrow each in-scope `getXxx()` return type.
- Modify `src/clients/AdtClientLegacy.ts` if it re-declares any narrowed return type.

---

# PHASE A — interfaces (minor, e.g. 11.3.0)

Branch `feat/capability-composites` off **master**.

### Task A1: Deprecate IAdtObject + add the named composites with a proof

**Files:**
- Modify: `~/prj/mcp-abap-adt-interfaces/src/adt/IAdtObject.ts`
- Create: `~/prj/mcp-abap-adt-interfaces/src/adt/IAdtComposites.ts`

**Interfaces:**
- Consumes: the seven atoms from `IAdtCapabilities.ts` (shipped in 11.2.0), `IAdtObject`, `IClassConfig`/`IClassState`.
- Produces: `IAdtSourceObject<TConfig, TReadResult>`, `IAdtNonVersionedObject<TConfig, TReadResult>`.

- [ ] **Step 1: Branch**

```bash
cd ~/prj/mcp-abap-adt-interfaces && git checkout master && git pull && git checkout -b feat/capability-composites
```

- [ ] **Step 2: Deprecate `IAdtObject`**

In `src/adt/IAdtObject.ts`, add a JSDoc `@deprecated` tag to the `IAdtObject` interface declaration (do NOT change its members):

```ts
/**
 * @deprecated Since 11.3.0. Handlers now declare their honest capability set
 * (see IAdtComposites and the capability atoms). `IAdtObject` remains as the
 * full-capability composite for backward compatibility and will be removed in a
 * later major. New code should depend on the specific capability it needs.
 */
export interface IAdtObject<TConfig, TReadResult = TConfig> {
  // ... members unchanged ...
```

- [ ] **Step 3: Create the composites + proof**

Create `src/adt/IAdtComposites.ts`:

```ts
/**
 * Named capability composites for the recurring handler profiles. A handler
 * implements the composite that matches the capabilities it genuinely supports;
 * the fat IAdtObject is deprecated in favour of these.
 */
import type {
  IAdtActivatable,
  IAdtCheckable,
  IAdtCrud,
  IAdtLockable,
  IAdtTransportAware,
  IAdtValidatable,
  IAdtVersionable,
} from './IAdtCapabilities';
import type { IAdtObject } from './IAdtObject';
import type { IClassConfig, IClassState } from './IAdtClass';

/** Full capability set — source-backed objects (has /source/main → versions). */
export type IAdtSourceObject<TConfig, TReadResult = TConfig> = IAdtCrud<
  TConfig,
  TReadResult
> &
  IAdtValidatable<TConfig, TReadResult> &
  IAdtCheckable<TConfig, TReadResult> &
  IAdtActivatable<TConfig, TReadResult> &
  IAdtLockable<TConfig, TReadResult> &
  IAdtVersionable<TConfig> &
  IAdtTransportAware<TConfig, TReadResult>;

/** Objects with no source resource — everything except version history. */
export type IAdtNonVersionedObject<TConfig, TReadResult = TConfig> = IAdtCrud<
  TConfig,
  TReadResult
> &
  IAdtValidatable<TConfig, TReadResult> &
  IAdtCheckable<TConfig, TReadResult> &
  IAdtActivatable<TConfig, TReadResult> &
  IAdtLockable<TConfig, TReadResult> &
  IAdtTransportAware<TConfig, TReadResult>;

/** Assertion helper: instantiating with `false` is a compile error. */
type Assert<T extends true> = T;

/**
 * IAdtSourceObject must be structurally identical to the (deprecated) IAdtObject
 * — both directions — so switching a full handler from one to the other is a
 * no-op. Instantiated at a concrete pair, or nothing is checked.
 */
type _SourceEqualsObject<C, R> = [
  Assert<IAdtSourceObject<C, R> extends IAdtObject<C, R> ? true : false>,
  Assert<IAdtObject<C, R> extends IAdtSourceObject<C, R> ? true : false>,
];
type _Check = _SourceEqualsObject<IClassConfig, IClassState>;
```

- [ ] **Step 4: Build — expect clean**

Run: `cd ~/prj/mcp-abap-adt-interfaces && npm run build`
Expected: exit 0.

- [ ] **Step 5: Verify the proof bites — temporarily break it**

Remove `IAdtVersionable<TConfig> &` from `IAdtSourceObject`, run `npm run build`.
Expected: FAIL with `TS2344` on `_SourceEqualsObject` — without `IAdtVersionable`, the source composite no longer has all of `IAdtObject`'s methods, so `IAdtSourceObject extends IAdtObject` becomes `false` (the first assertion fails).
Restore the line, rebuild — exit 0. No commit of the broken state.

- [ ] **Step 6: Commit**

```bash
git add src/adt/IAdtObject.ts src/adt/IAdtComposites.ts
git commit -m "feat(composites): deprecate IAdtObject; add IAdtSourceObject/IAdtNonVersionedObject"
```

---

### Task A2: Barrel export, version, changelog, PR

**Files:**
- Modify: `~/prj/mcp-abap-adt-interfaces/src/index.ts`, `package.json`, `CHANGELOG.md`

- [ ] **Step 1: Export the composites**

In `src/index.ts`, add (alphabetical position):

```ts
export type {
  IAdtNonVersionedObject,
  IAdtSourceObject,
} from './adt/IAdtComposites';
```

- [ ] **Step 2: Build + verify exports**

```bash
npm run build
node -e "const ts=require('typescript');const p=ts.createProgram(['dist/index.d.ts'],{});const s=p.getTypeChecker().getSymbolAtLocation(p.getSourceFile('dist/index.d.ts'));const n=p.getTypeChecker().getExportsOfModule(s).map(x=>x.getName());const want=['IAdtSourceObject','IAdtNonVersionedObject'];console.log(want.every(w=>n.includes(w))?'both composites exported':'MISSING: '+want.filter(w=>!n.includes(w)));"
```
Expected: `both composites exported`.

- [ ] **Step 3: Version 11.3.0 + lockfile**

```bash
npm version 11.3.0 --no-git-tag-version && npm install --package-lock-only
grep -c '"link": true' package-lock.json
```
Expected: version 11.3.0; link:true count 0.

- [ ] **Step 4: CHANGELOG**

Prepend under the top heading:

```markdown
## [11.3.0] - 2026-07-21

### Added
- **Named capability composites** `IAdtSourceObject` (full capability set) and
  `IAdtNonVersionedObject` (all but version history), for handlers to declare
  their honest capability profile instead of the fat contract.

### Deprecated
- **`IAdtObject`.** It remains as the full-capability composite (structurally
  identical to `IAdtSourceObject`, asserted at compile time) for backward
  compatibility, and will be removed in a later major. New code should depend on
  the specific capability atoms or a composite.
```

- [ ] **Step 5: Commit, push, PR**

```bash
git add src/index.ts package.json package-lock.json CHANGELOG.md
git commit -m "release(11.3.0): export capability composites; deprecate IAdtObject"
git push -u origin feat/capability-composites
gh pr create --base master --title "release(11.3.0): capability composites + deprecate IAdtObject" --body "Additive: two named composites for the recurring handler profiles, plus an IAdtObject deprecation (kept as the full composite, proven structurally identical). Enables adt-clients handlers to declare honest capability sets."
```

- [ ] **Step 6: STOP — publish gate.** Report: PR opened, ready for review + merge + tag + **user `npm publish`**. Phase B is blocked until `@mcp-abap-adt/interfaces@11.3.0` is on npm.

---

# PHASE B — adt-clients (major 8.0.0, after 11.3.0 is published)

Branch `feat/capability-type-honesty` off **main**.

### Task B1: Consume 11.3.0 + surface baseline

- [ ] **Step 1:** `git checkout main && git pull && git checkout -b feat/capability-type-honesty`; set `"@mcp-abap-adt/interfaces": "^11.3.0"`; `rm -rf node_modules/@mcp-abap-adt/interfaces && npm install @mcp-abap-adt/interfaces@11.3.0`; confirm `grep -c '"link": true' package-lock.json` = 0.
- [ ] **Step 2:** `npm run build:fast` — exit 0.
- [ ] **Step 3:** capture baseline. `_surface-snapshot.mjs` lives in the project root but is **git-excluded** (`.git/info/exclude`) — it will be absent on a fresh checkout. If `test -f _surface-snapshot.mjs` fails, recreate it first:

```js
import ts from 'typescript';
const entries=['index','index.core','index.runtime','index.batch','index.ws','index.abapgit','index.executors'];
const prog=ts.createProgram(entries.map(e=>`dist/${e}.d.ts`),{allowJs:true});
const ch=prog.getTypeChecker();
for(const e of entries){const sf=prog.getSourceFile(`dist/${e}.d.ts`);const s=sf&&ch.getSymbolAtLocation(sf);const names=s?ch.getExportsOfModule(s).map(x=>x.getName()).sort():[];console.log(`== ${e} ==`);console.log(names.join('\n'));}
```

Capture TWO baselines:

1. **Export-name snapshot** (sanity — nothing should be added/removed): `node _surface-snapshot.mjs > /tmp/surface-before.txt`. This lists exported symbol *names* only.
2. **Declaration-surface baseline** (the one that matters — this migration changes SIGNATURES, not names, so a name diff would be empty). Concatenate every emitted `.d.ts` with its path so the diff has context:

```bash
find dist -name '*.d.ts' | sort | while read f; do echo "=== $f ==="; cat "$f"; done > /tmp/decl-before.txt
wc -l /tmp/surface-before.txt /tmp/decl-before.txt
```

`/tmp/decl-before.txt` contains the actual `.d.ts` signatures — `AdtClient.getDomain(): IAdtObject<...>`, `AdtDomainType = IAdtObject<...>`, etc. B5 diffs this to prove the return types and aliases narrowed exactly as intended. (`dist/` is gitignored, so we snapshot to `/tmp`, not git.)
- [ ] **Step 4:** commit `package.json` + `package-lock.json` — `chore: consume @mcp-abap-adt/interfaces ^11.3.0 (pre-migration)`.

---

### Task B2: Switch the 22 full handlers to `IAdtSourceObject`

**Files:** the 22 `src/core/<type>/Adt<Type>.ts` listed under `IAdtSourceObject` above.

**Interfaces:** Consumes `IAdtSourceObject` from `@mcp-abap-adt/interfaces`. Produces handlers whose declared type is `IAdtSourceObject<Config, State>` instead of `IAdtObject<Config, State>` — structurally identical (proven), so this is a no-op refactor for these 22; the build must stay green.

- [ ] **Step 1: For each of the 22 handlers, replace the implements clause.** Worked example (`AdtClass.ts`):

```ts
// BEFORE
export class AdtClass implements IAdtObject<IClassConfig, IClassState> {
// AFTER
export class AdtClass implements IAdtSourceObject<IClassConfig, IClassState> {
```

Update the import: replace `IAdtObject` with `IAdtSourceObject` from `@mcp-abap-adt/interfaces` (drop the `IAdtObject` import if now unused). Do NOT touch method bodies. For the 4 class-include handlers that `extends AdtClass`, they inherit — change only if they independently declare `implements IAdtObject` (check each; most just `extends AdtClass`).

Also update the sibling public alias in `src/core/<type>/index.ts` for each of the 22:
```ts
// BEFORE
export type AdtClassType = IAdtObject<IClassConfig, IClassState>;
// AFTER
export type AdtClassType = IAdtSourceObject<IClassConfig, IClassState>;
```
(import `IAdtSourceObject`, drop `IAdtObject` if now unused).

- [ ] **Step 2: Build** — `npm run build:fast`, exit 0. Because `IAdtSourceObject ≡ IAdtObject`, all 22 still satisfy their declared type. A failure means a handler was NOT actually full (matrix disagreement) → STOP and report which.
- [ ] **Step 3: Full unit suite** — `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand 2>&1 | tee /tmp/b2.log`, read it; all pass.
- [ ] **Step 4: Commit** — `refactor(types): 22 full handlers implement IAdtSourceObject`.

---

### Task B3: Switch the non-versioned + inline-profile handlers

**Files:** DataElement, Domain, FunctionGroup (→ `IAdtNonVersionedObject`); FunctionInclude, AuthorizationField, Package, MessageClass, MessageClassMessage (→ comma-separated implements per the table above). NOTE: FeatureToggle is NOT here — it is deferred (widening `IFeatureToggleObject`).

**Interfaces:** Consumes `IAdtNonVersionedObject` + the seven atoms (for inline intersections). Produces handlers whose declared type omits the capabilities they lack — so their throwing stubs are no longer part of the declared contract.

- [ ] **Step 1: Non-versioned trio.** For `AdtDataElement`, `AdtDomain`, `AdtFunctionGroup`: replace `implements IAdtObject<C,S>` with `implements IAdtNonVersionedObject<C,S>`. Mark the (now-not-declared) `getVersions`/`getVersionSource` throwing stubs `@deprecated`:

```ts
/** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
getVersions(config: Partial<IDomainConfig>): Promise<IObjectVersion[]> {
  return throwUnsupportedVersions('domain');
}
```

Also update each sibling alias in `src/core/<type>/index.ts`:
```ts
// AdtDomain/index.ts — BEFORE / AFTER
export type AdtDomainType = IAdtNonVersionedObject<IDomainConfig, IDomainState>;
```

- [ ] **Step 2: Inline-list handlers.** For each (FunctionInclude, AuthorizationField, Package, MessageClass, MessageClassMessage), replace the implements clause with the **comma-separated list** from the table (NOT `&` — that is a syntax error in an `implements` clause). Example (`AdtPackage.ts`):

```ts
import type {
  IAdtCheckable,
  IAdtCrud,
  IAdtLockable,
  IAdtTransportAware,
  IAdtValidatable,
} from '@mcp-abap-adt/interfaces';

export class AdtPackage
  implements
    IAdtCrud<IPackageConfig, IPackageState>,
    IAdtValidatable<IPackageConfig, IPackageState>,
    IAdtCheckable<IPackageConfig, IPackageState>,
    IAdtLockable<IPackageConfig, IPackageState>,
    IAdtTransportAware<IPackageConfig, IPackageState>
{
```

Mark the unsupported-capability stubs (`activate`/`getVersions`/… whichever the profile omits) `@deprecated`. Method bodies unchanged.

Then update the sibling alias in `src/core/<type>/index.ts`. Here a **type position** — so an intersection `&` IS valid (and matches the AdtClient return type in B4):
```ts
// AdtPackage/index.ts — BEFORE
export type AdtPackageType = IAdtObject<IPackageConfig, IPackageState>;
// AFTER
export type AdtPackageType = IAdtCrud<IPackageConfig, IPackageState> &
  IAdtValidatable<IPackageConfig, IPackageState> &
  IAdtCheckable<IPackageConfig, IPackageState> &
  IAdtLockable<IPackageConfig, IPackageState> &
  IAdtTransportAware<IPackageConfig, IPackageState>;
```

- [ ] **Step 3: Build** — `npm run build:fast`, exit 0. Here the build MUST still pass: the class still HAS the extra throwing methods (they just are not in the declared type), which is legal — a class may have more members than its `implements` clause requires.
- [ ] **Step 4: Full unit suite** — `... | tee /tmp/b3.log`, read it; all pass.
- [ ] **Step 5: Commit** — `refactor(types): non-full handlers implement their honest capability composite`.

---

### Task B4: Narrow `AdtClient.getXxx()` return types

**Files:** `src/clients/AdtClient.ts` (and `AdtClientLegacy.ts` if it re-declares any of these return types).

**Interfaces:** Consumes the composites + atoms. Produces `AdtClient` factory methods whose declared return type is the handler's honest composite — so `client.getDomain().getVersions()` no longer type-checks.

- [ ] **Step 1: For each in-scope factory method, narrow the return type to match the handler's `implements` clause.** Examples:

```ts
// full handler — was IAdtObject<...>, now IAdtSourceObject<...>
getClass(): IAdtSourceObject<IClassConfig, IClassState> { return new AdtClass(...); }
// non-versioned
getDomain(): IAdtNonVersionedObject<IDomainConfig, IDomainState> { return new AdtDomain(...); }
// inline profile
getPackage(): IAdtCrud<IPackageConfig, IPackageState> & IAdtValidatable<...> & IAdtCheckable<...> & IAdtLockable<...> & IAdtTransportAware<...> { return new AdtPackage(...); }
```

Leave the deferred ones (`getRequest`, `getUnitTest`, `getCdsUnitTest`, `getServiceBinding`, `getFeatureToggle`) returning their CURRENT type (`IAdtObject` / `IAdtServiceBinding` / `IFeatureToggleObject`) unchanged.

- [ ] **Step 2: Build** — `npm run build:fast`, exit 0.
- [ ] **Step 3: Add a compile-time guard test** proving the narrowing bites. Create `src/__tests__/unit/clients/returnTypeNarrowing.test.ts`:

```ts
import { AdtClient } from '../../../clients/AdtClient';

// Type-level only: @ts-expect-error asserts the call is a COMPILE error.
// If the narrowing regressed, @ts-expect-error itself errors (unused).
() => {
  const c = null as unknown as AdtClient;
  // domain has no version history — these must not type-check:
  // @ts-expect-error getVersions is not on the narrowed getDomain() type
  c.getDomain().getVersions({});
  // @ts-expect-error getVersionSource is not on the narrowed getDomain() type
  c.getDomain().getVersionSource('');
  // a full handler still exposes versions (no error expected):
  c.getClass().getVersions({});
};

it('return-type narrowing compiles as asserted', () => expect(true).toBe(true));
```

- [ ] **Step 4: Type-check the guard, then run it.** `build:fast` (`tsc -p tsconfig.json`) EXCLUDES `src/__tests__/**`, so it does NOT validate the `@ts-expect-error` lines. Use the test tsconfig: `npm run test:check 2>&1 | tee /tmp/b4-check.log`, read it — exit 0 means every `@ts-expect-error` matched a real error (if the narrowing regressed, an `@ts-expect-error` with no error becomes `TS2578: Unused '@ts-expect-error'` and this fails). Then run it: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/clients/returnTypeNarrowing.test.ts --runInBand 2>&1 | tee /tmp/b4.log`, read it; passes.
- [ ] **Step 5: Commit** — `feat(client)!: narrow getXxx() return types to honest capability composites`.

---

### Task B5: Declaration-surface verification + full suite + lint

- [ ] **Step 1: Regenerate both surfaces** — `npm run build:fast` then:
```bash
node _surface-snapshot.mjs > /tmp/surface-after.txt
find dist -name '*.d.ts' | sort | while read f; do echo "=== $f ==="; cat "$f"; done > /tmp/decl-after.txt
```
- [ ] **Step 2a: Export names unchanged** — `diff /tmp/surface-before.txt /tmp/surface-after.txt`, read it. Expected: **EMPTY** — this migration narrows signatures, it does not add or remove any exported symbol. A non-empty name diff means something was unexpectedly added/removed → STOP and report.
- [ ] **Step 2b: Declaration surface — exactly the intended narrowing** — `diff /tmp/decl-before.txt /tmp/decl-after.txt | tee /tmp/decl-diff.txt`, read the WHOLE file. This is the load-bearing check: every changed line must be one of
  - (a) an `AdtClient`/`AdtClientLegacy` `getXxx()` return type changing from `IAdtObject<...>` to the handler's honest composite;
  - (b) **`dist/batch/AdtClientBatch.d.ts`** `getXxx()` return types changing the same way — `AdtClientBatch.getXxx()` is `return this.innerClient.getXxx()` with **no explicit return type**, so its inferred type follows `AdtClient` and its `.d.ts` narrows automatically (it is a public `./batch` entrypoint, so this IS part of the intended surface change — no code change to AdtClientBatch itself);
  - (c) an `Adt<Type>Type` alias changing from `IAdtObject<...>` to the honest composite;
  - (d) an added `IAdtSourceObject`/`IAdtNonVersionedObject`/atom import in a `.d.ts`.

  There must be **no** change to any handler's own method signatures, and **no** `getXxx()` for a deferred handler (getRequest/getUnitTest/getCdsUnitTest/getServiceBinding/getFeatureToggle) changing — in `AdtClient` OR `AdtClientBatch`. Anything else in the diff → STOP and report.
- [ ] **Step 3: Full unit suite** — `... | tee /tmp/b5-unit.log`, read it; all pass (prior count + the new narrowing guard).
- [ ] **Step 4: Lint** — `npm run lint:check 2>&1 | tee /tmp/b5-lint.log`, read it; 0 errors, ≤ 45/25.
- [ ] **Step 5: Commit** — `test(types): return-type narrowing guard; surface reflects honest capability sets`.

---

### Task B6: Version, changelog, PR

- [ ] **Step 1: Ask the user for the version** — recommend **major 8.0.0** (return-type narrowing is a breaking API change, even though it only breaks always-throwing usage). Wait for confirmation.
- [ ] **Step 2:** `npm version <chosen> --no-git-tag-version && npm install --package-lock-only`; confirm link:true 0.
- [ ] **Step 3: CHANGELOG** — a `### Changed` (BREAKING) entry: handlers now declare honest capability sets; `AdtClient.getXxx()` (and, by inference, `AdtClientBatch.getXxx()`) return types narrowed so calling an unsupported capability (e.g. `getDomain().getVersions()`) is now a compile error instead of a runtime throw — this only breaks code that referenced methods that always threw. **Still wide (deferred, unchanged this release): `getFeatureToggle`, `getServiceBinding`, `getRequest`, `getUnitTest`, `getCdsUnitTest`** — these implement widening interfaces or are wrong-contract and will be narrowed in a follow-up. Requires interfaces `^11.3.0`.
- [ ] **Step 4: Commit, PR** — `git push -u origin feat/capability-type-honesty`; `gh pr create --base main --title "release(<chosen>): honest capability types (BREAKING)" --body "..."`. Report: PR ready for the user's external review; then merge + tag + GitHub release; **user publishes**.

---

### Task B7: Consumer coordination (after publish)

- [ ] **Step 1:** After the user publishes `<chosen>` to npm, bump `~/prj/mcp-abap-adt`'s `@mcp-abap-adt/adt-clients` dep to it (from the registry), run its build, read the log. Expected: compiles clean. If the consumer referenced a now-narrowed capability (a call that always threw), it fails to compile HERE — that is the migration surfacing a latent bug; fix the consumer call site or report it. Do NOT use a local tarball; resolve from the registry only.

---

## Out of scope (future work)

- **`AdtRequest`** — fix `update` (change description) and `delete` (empty requests only) per the domain truth, then give it its honest CRUD profile. See memory `reference_transport_request_update_delete`.
- **`AdtUnitTest` / `AdtCdsUnitTest`** — reconsider the contract (test runner, not an object).
- **`AdtServiceBinding`** — reconcile the widening `IAdtServiceBinding` with the atom composites.
- **Removing** the deprecated `IAdtObject` and the throwing stubs — a later major, once consumers have migrated.
- The activate/check error-envelope unification and further capability-implementation dedup — separate efforts.
