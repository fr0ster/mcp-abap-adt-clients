# Capability Interfaces + Pilot Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Declare the capability-atom interfaces in `@mcp-abap-adt/interfaces`, then pilot the composition architecture in `adt-clients` by routing two lifecycle capabilities (lock/unlock, versions) through shared implementations on three existing handlers — with the public `IAdtObject` surface and observable behaviour unchanged.

**Architecture:** Phase A declares seven small capability interfaces next to `IAdtObject` (additive; `IAdtObject` stays byte-for-byte, and a compile-time proof asserts the intersection of the atoms is structurally identical to it). Phase B extracts two capability *implementations* — parameterized by a per-handler strategy — and converts `AdtClass`, `AdtDomain`, `AdtServiceDefinition` to compose them. `AdtClass` still `implements IAdtObject`; consumers see no change. The remaining 32 handlers, the error-envelope unification for activate/check, and the ATC client are explicitly out of scope — future plans.

**Tech Stack:** TypeScript (strict, CommonJS output), Biome (lint/format, single quotes, semicolons, 2-space indent), ts-jest, the TypeScript compiler API for the surface snapshot and the capability matrix.

## Global Constraints

- All repository artifacts (code, comments, commit messages, docs) in English; communication with the user in the user's language.
- Never change `package.json` version without explicit request; the user chooses CHANGELOG versions.
- After changing a version, run `npm install --package-lock-only` and commit the lockfile in the same commit.
- All dependencies resolve from the npm registry only. After every `npm install`, verify `package-lock.json` has zero `"link": true` entries.
- The user runs `npm publish`, never the agent. The agent merges PRs, tags, and creates GitHub releases; publishing is the maintainer's step.
- Publish the dependency (interfaces) to npm FIRST; Phase B is blocked until interfaces 11.2.0 is on npm.
- Tests: never pipe through grep/tail/head — save the full log with `tee`, then read the log file.
- Warn the user before launching trial integration tests (they need a browser with the right profile and a fresh JWT).
- Unit tests without SAP: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand`.
- Biome must pass with zero errors; the warning/info baseline is 45 warnings / 25 infos in adt-clients — do not increase it.
- Capability atoms are additive in Phase A: `IAdtObject` is NOT redefined, no handler is modified, no `AdtClient.getXxx()` return type is narrowed.

**Repos and paths:**
- interfaces: `/home/okyslytsia/prj/mcp-abap-adt-interfaces` (Phase A)
- adt-clients: `/home/okyslytsia/prj/mcp-abap-adt-clients` (Phase B)
- consumer: `/home/okyslytsia/prj/mcp-abap-adt` (Phase B verification only)
- Spec: `docs/superpowers/specs/2026-07-20-capability-interfaces-design.md`
- Capability matrix tool: `scripts/capability-matrix.mjs` (already present)

---

## File Structure

**Phase A — interfaces** (`src/adt/`):
- Create `src/adt/IAdtCapabilities.ts` — the seven atom interfaces + the correctness proof.
- Modify `src/index.ts` — export the atoms from the root barrel.

**Phase B — adt-clients** (`src/`):
- Create `src/core/shared/capabilities/types.ts` — `ICapabilityContext`, `ILockStrategy`, `IVersionsStrategy`, `INormalizedLock`.
- Create `src/core/shared/capabilities/LockCapability.ts` — shared lock/unlock implementation.
- Create `src/core/shared/capabilities/VersionsCapability.ts` — shared getVersions/getVersionSource implementation.
- Create `src/core/shared/capabilities/index.ts` — re-exports.
- Modify `src/core/class/AdtClass.ts`, `src/core/domain/AdtDomain.ts`, `src/core/serviceDefinition/AdtServiceDefinition.ts` — compose the capabilities.
- Create `src/__tests__/unit/core/capabilities/lockCapability.test.ts`, `versionsCapability.test.ts` — capability unit tests with a fake connection.
- Create `src/__tests__/unit/core/capabilities/conformance.test.ts` — table-driven behavioural conformance across the three pilot handlers.

---

# PHASE A — interfaces (release 11.2.0)

Branch: `feat/capability-atoms`, created from `main` (NOT from `feat/atc-unittest-types`; the ATC types stay on their own branch and are released separately when their client lands).

### Task A1: Declare the seven capability atom interfaces

**Files:**
- Create: `/home/okyslytsia/prj/mcp-abap-adt-interfaces/src/adt/IAdtCapabilities.ts`

**Interfaces:**
- Consumes: existing `IAdtObject` generics `<TConfig, TReadResult>` and `IAdtOperationOptions`, `IObjectVersion` from `./IAdtObject`.
- Produces: `IAdtCrud`, `IAdtValidatable`, `IAdtCheckable`, `IAdtActivatable`, `IAdtLockable`, `IAdtVersionable`, `IAdtTransportAware` — each generic over `<TConfig, TReadResult = TConfig>` (except `IAdtVersionable<TConfig>` and `IAdtLockable` which also carries `TReadResult` for `unlock`).

- [ ] **Step 1: Create the branch**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
git checkout main && git pull
git checkout -b feat/capability-atoms
```

- [ ] **Step 2: Write the atom interfaces**

Create `src/adt/IAdtCapabilities.ts`. Method signatures are copied verbatim from `IAdtObject` in `src/adt/IAdtObject.ts` so the intersection is structurally identical (Task A2 proves it):

```ts
/**
 * Capability atoms — the methods of IAdtObject, partitioned so each method
 * belongs to exactly one small interface. See
 * docs/superpowers/specs/2026-07-20-capability-interfaces-design.md.
 *
 * These are ADDITIVE. IAdtObject is unchanged; a handler implementing the
 * atoms satisfies IAdtObject structurally (Task A2 proves the equivalence).
 */
import type {
  IAdtOperationOptions,
  IObjectVersion,
} from './IAdtObject';

/** create / read / readMetadata / update / delete — universal, never partial. */
export interface IAdtCrud<TConfig, TReadResult = TConfig> {
  create(config: TConfig, options?: IAdtOperationOptions): Promise<TReadResult>;
  read(
    config: Partial<TConfig>,
    version?: 'active' | 'inactive',
    options?: { withLongPolling?: boolean },
  ): Promise<TReadResult | undefined>;
  readMetadata(
    config: Partial<TConfig>,
    options?: { withLongPolling?: boolean; version?: 'active' | 'inactive' },
  ): Promise<TReadResult>;
  update(config: Partial<TConfig>, options?: IAdtOperationOptions): Promise<TReadResult>;
  delete(config: Partial<TConfig>): Promise<TReadResult>;
}

export interface IAdtValidatable<TConfig, TReadResult = TConfig> {
  validate(config: Partial<TConfig>): Promise<TReadResult>;
}

export interface IAdtCheckable<TConfig, TReadResult = TConfig> {
  check(config: Partial<TConfig>, status?: string): Promise<TReadResult>;
}

export interface IAdtActivatable<TConfig, TReadResult = TConfig> {
  activate(config: Partial<TConfig>): Promise<TReadResult>;
}

export interface IAdtLockable<TConfig, TReadResult = TConfig> {
  lock(config: Partial<TConfig>): Promise<string>;
  unlock(config: Partial<TConfig>, lockHandle: string): Promise<TReadResult>;
}

export interface IAdtVersionable<TConfig> {
  getVersions(config: Partial<TConfig>): Promise<IObjectVersion[]>;
  getVersionSource(contentUri: string): Promise<string>;
}

export interface IAdtTransportAware<TConfig, TReadResult = TConfig> {
  readTransport(
    config: Partial<TConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<TReadResult>;
}
```

- [ ] **Step 3: Build to confirm the file compiles**

Run: `cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run build`
Expected: exit 0, no diagnostics.

- [ ] **Step 4: Commit**

```bash
git add src/adt/IAdtCapabilities.ts
git commit -m "feat(atoms): declare the seven capability interfaces"
```

---

### Task A2: Add the correctness proof

**Files:**
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-interfaces/src/adt/IAdtCapabilities.ts` (append)

**Interfaces:**
- Consumes: the seven atoms from A1, `IAdtObject` from `./IAdtObject`, a concrete config/state pair to instantiate the proof (`IClassConfig`, `IClassState` from `./IAdtClass`).
- Produces: nothing exported; a compile-time assertion only.

- [ ] **Step 1: Append the proof**

Add to the end of `src/adt/IAdtCapabilities.ts`:

```ts
import type { IAdtObject } from './IAdtObject';
import type { IClassConfig, IClassState } from './IAdtClass';

/** Assertion helper: instantiating with `false` is a compile error. */
type Assert<T extends true> = T;

/** The intersection of every atom that composes IAdtObject. */
type AllAtoms<C, R> = IAdtCrud<C, R> &
  IAdtValidatable<C, R> &
  IAdtCheckable<C, R> &
  IAdtActivatable<C, R> &
  IAdtLockable<C, R> &
  IAdtVersionable<C> &
  IAdtTransportAware<C, R>;

/**
 * Proof that the partition is exact: IAdtObject and the atom intersection are
 * mutually assignable. Both directions are required. The generic parameters
 * are bound and the alias is instantiated below, or nothing is checked.
 */
type _PartitionIsExact<C, R> = [
  Assert<IAdtObject<C, R> extends AllAtoms<C, R> ? true : false>,
  Assert<AllAtoms<C, R> extends IAdtObject<C, R> ? true : false>,
];

// Instantiate at a concrete pair so the constraints are actually evaluated.
type _Check = _PartitionIsExact<IClassConfig, IClassState>;
```

- [ ] **Step 2: Build — expect PASS**

Run: `npm run build`
Expected: exit 0. The proof holds.

- [ ] **Step 3: Verify the proof actually checks — temporarily break it**

Edit `IAdtLockable` to remove the `unlock` method (comment it out). Run `npm run build`.
Expected: FAIL with `TS2344: Type 'false' does not satisfy the constraint 'true'` on `_PartitionIsExact`.
Then restore the `unlock` method and rebuild — exit 0.

This step produces no commit; it is a manual confirmation the assertion is load-bearing, mirroring the ATC vocabulary-guard discipline.

- [ ] **Step 4: Commit**

```bash
git add src/adt/IAdtCapabilities.ts
git commit -m "test(atoms): compile-time proof that the atoms partition IAdtObject exactly"
```

---

### Task A3: Export atoms from the barrel, version, changelog, PR

**Files:**
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-interfaces/src/index.ts`
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-interfaces/package.json` (version)
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-interfaces/CHANGELOG.md`

**Interfaces:**
- Consumes: the seven atoms from A1.
- Produces: the atoms exported from the package root, so `import type { IAdtLockable } from '@mcp-abap-adt/interfaces'` resolves.

- [ ] **Step 1: Add the barrel export block**

In `src/index.ts`, add (alphabetical position — after the `IAdtAppendStructure` export block, matching the existing ordering convention):

```ts
export type {
  IAdtActivatable,
  IAdtCheckable,
  IAdtCrud,
  IAdtLockable,
  IAdtTransportAware,
  IAdtValidatable,
  IAdtVersionable,
} from './adt/IAdtCapabilities';
```

- [ ] **Step 2: Build and confirm the exports resolve from the built barrel**

Run:
```bash
npm run build
node -e "const ts=require('typescript');const p=ts.createProgram(['dist/index.d.ts'],{});const s=p.getTypeChecker().getSymbolAtLocation(p.getSourceFile('dist/index.d.ts'));const n=p.getTypeChecker().getExportsOfModule(s).map(x=>x.getName());const want=['IAdtCrud','IAdtValidatable','IAdtCheckable','IAdtActivatable','IAdtLockable','IAdtVersionable','IAdtTransportAware'];const miss=want.filter(w=>!n.includes(w));console.log(miss.length?'MISSING: '+miss.join(', '):'all 7 atoms exported from root');"
```
Expected: `all 7 atoms exported from root`.

- [ ] **Step 3: Bump version to 11.2.0**

```bash
npm version 11.2.0 --no-git-tag-version
npm install --package-lock-only
grep -c '"link": true' package-lock.json
```
Expected: version line shows `11.2.0`; `"link": true` count is `0`.

- [ ] **Step 4: Add the CHANGELOG entry**

Prepend under the top heading in `CHANGELOG.md`:

```markdown
## [11.2.0] - 2026-07-20

### Added
- **Capability atom interfaces.** Seven small interfaces — `IAdtCrud`,
  `IAdtValidatable`, `IAdtCheckable`, `IAdtActivatable`, `IAdtLockable`,
  `IAdtVersionable`, `IAdtTransportAware` — partition the 13 methods of
  `IAdtObject` so each method belongs to exactly one. Purely additive:
  `IAdtObject` is unchanged, and a compile-time proof asserts the intersection
  of the atoms is structurally identical to it. Consumers may depend on a
  narrow capability instead of the whole contract.
```

- [ ] **Step 5: Commit and open the PR**

```bash
git add src/index.ts package.json package-lock.json CHANGELOG.md
git commit -m "release(11.2.0): export capability atoms from the root barrel"
git push -u origin feat/capability-atoms
gh pr create --title "release(11.2.0): capability atom interfaces" --body "Additive: seven capability atoms partitioning IAdtObject, with a compile-time exactness proof. IAdtObject unchanged. See docs/superpowers/specs/2026-07-20-capability-interfaces-design.md."
```

- [ ] **Step 6: STOP — publish gate**

Report to the user: PR opened, ready for review + merge + tag + **`npm publish` (user's step)**. Phase B does not begin until `@mcp-abap-adt/interfaces@11.2.0` is on npm.

---

# PHASE B — adt-clients pilot (after interfaces 11.2.0 is published)

Branch: `feat/capability-pilot`, created from `main`.

### Task B1: Consume 11.2.0 and capture the surface baseline

**Files:**
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-clients/package.json` (dependency floor)

**Interfaces:**
- Consumes: `@mcp-abap-adt/interfaces@11.2.0` (the atoms).
- Produces: a clean build against 11.2.0 and a recorded public-surface baseline for Task B8 to diff against.

- [ ] **Step 1: Create the branch and bump the dependency**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
git checkout main && git pull && git checkout -b feat/capability-pilot
# edit package.json: "@mcp-abap-adt/interfaces": "^11.2.0"
rm -rf node_modules/@mcp-abap-adt/interfaces
npm install @mcp-abap-adt/interfaces@11.2.0
grep -c '"link": true' package-lock.json
```
Expected: `"link": true` count is `0`.

- [ ] **Step 2: Build**

Run: `npm run build:fast`
Expected: exit 0.

- [ ] **Step 3: Capture the surface baseline**

The snapshot script `_surface-snapshot.mjs` is the one used for the 7.5.0 migration (git-excluded, in the project root). If absent, recreate it:

```js
import ts from 'typescript';
const entries=['index','index.core','index.runtime','index.batch','index.ws','index.abapgit','index.executors'];
const prog=ts.createProgram(entries.map(e=>`dist/${e}.d.ts`),{allowJs:true});
const ch=prog.getTypeChecker();
for(const e of entries){const sf=prog.getSourceFile(`dist/${e}.d.ts`);const s=sf&&ch.getSymbolAtLocation(sf);const names=s?ch.getExportsOfModule(s).map(x=>x.getName()).sort():[];console.log(`== ${e} ==`);console.log(names.join('\n'));}
```

Run: `node _surface-snapshot.mjs > /tmp/surface-before.txt && wc -l /tmp/surface-before.txt`
Expected: a line count is printed (the exact number is the baseline; Task B8 diffs against it).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: consume @mcp-abap-adt/interfaces ^11.2.0 (pre-pilot)"
```

---

### Task B2: Define the capability strategy types

**Files:**
- Create: `/home/okyslytsia/prj/mcp-abap-adt-clients/src/core/shared/capabilities/types.ts`

**Interfaces:**
- Consumes: `IAbapConnection`, `ILogger`, `IObjectVersion` from `@mcp-abap-adt/interfaces`.
- Produces: `ICapabilityContext`, `INormalizedLock`, `ILockStrategy`, `IVersionsStrategy`.

- [ ] **Step 1: Write the strategy types**

Create `src/core/shared/capabilities/types.ts`:

```ts
import type {
  IAbapConnection,
  ILogger,
  IObjectVersion,
} from '@mcp-abap-adt/interfaces';

/** The connection + logger every capability implementation needs. */
export interface ICapabilityContext {
  readonly connection: IAbapConnection;
  readonly logger?: ILogger;
}

/**
 * Normalized lock result. The per-type helpers return different shapes
 * (bare string vs { lockHandle, corrNr }); the capability normalizes up to
 * this superset. See the spec's "lock normalization contract".
 */
export interface INormalizedLock {
  lockHandle: string;
  corrNr?: string;
}

/**
 * Per-handler strategy for LockCapability. The handler supplies its own
 * endpoint knowledge — there is no centralized lifecycle-URI resolver
 * (buildObjectUri is for group operations only).
 *
 * `release` returns the handler's OWN state shape (e.g. `{ unlockResult,
 * errors: [] }`), not void — the current handlers put the ADT unlock response
 * into `state.unlockResult`, and dropping it would change observable behaviour.
 * The capability owns only the session toggling around it.
 */
export interface ILockStrategy<TConfig, TReadResult> {
  /** Extract the object name from config, or throw if missing. */
  nameOf(config: Partial<TConfig>): string;
  /** POST _action=LOCK, return the normalized handle. */
  acquire(ctx: ICapabilityContext, name: string): Promise<INormalizedLock>;
  /** POST _action=UNLOCK with the handle; build and return the handler state. */
  release(
    ctx: ICapabilityContext,
    name: string,
    lockHandle: string,
  ): Promise<TReadResult>;
}

/** Per-handler strategy for VersionsCapability. */
export interface IVersionsStrategy<TConfig> {
  nameOf(config: Partial<TConfig>): string;
  list(ctx: ICapabilityContext, name: string): Promise<IObjectVersion[]>;
  /** GET the content URI, return the source text. */
  source(ctx: ICapabilityContext, contentUri: string): Promise<string>;
}
```

- [ ] **Step 2: Build**

Run: `npm run build:fast`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/core/shared/capabilities/types.ts
git commit -m "feat(capabilities): strategy types for lock and versions"
```

---

### Task B3: LockCapability with the normalization contract (TDD)

**Files:**
- Create: `/home/okyslytsia/prj/mcp-abap-adt-clients/src/core/shared/capabilities/LockCapability.ts`
- Test: `/home/okyslytsia/prj/mcp-abap-adt-clients/src/__tests__/unit/core/capabilities/lockCapability.test.ts`

**Interfaces:**
- Consumes: `ICapabilityContext`, `INormalizedLock`, `ILockStrategy` from `./types`.
- Produces: `class LockCapability<TConfig, TReadResult> implements IAdtLockable<TConfig, TReadResult>` with constructor `(ctx: ICapabilityContext, strategy: ILockStrategy<TConfig, TReadResult>)`. Methods: `lock(config): Promise<string>`, `unlock(config, lockHandle): Promise<TReadResult>`. The state is built by `strategy.release`, so there is no `buildState` constructor param.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/capabilities/lockCapability.test.ts`:

```ts
import { LockCapability } from '../../../../core/shared/capabilities/LockCapability';
import type {
  ICapabilityContext,
  ILockStrategy,
} from '../../../../core/shared/capabilities/types';

type Cfg = { name?: string };

function fakeCtx(): ICapabilityContext & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    connection: {
      setSessionType: (t: string) => calls.push(`session:${t}`),
    } as any,
    logger: undefined,
  };
}

type State = { unlockResult?: string; errors: string[] };

const strategy: ILockStrategy<Cfg, State> = {
  nameOf: (c) => {
    if (!c.name) throw new Error('name is required');
    return c.name;
  },
  acquire: async (ctx, name) => {
    (ctx as any).calls.push(`acquire:${name}`);
    return { lockHandle: 'H1', corrNr: 'C1' };
  },
  release: async (ctx, name, h) => {
    (ctx as any).calls.push(`release:${name}:${h}`);
    return { unlockResult: `R:${name}`, errors: [] };
  },
};

describe('LockCapability', () => {
  it('lock sets stateful, acquires, returns the handle', async () => {
    const ctx = fakeCtx();
    const cap = new LockCapability<Cfg, State>(ctx, strategy);
    const handle = await cap.lock({ name: 'ZFOO' });
    expect(handle).toBe('H1');
    expect(ctx.calls).toEqual(['session:stateful', 'acquire:ZFOO']);
  });

  it('unlock is stateful during release, restores stateless, returns state', async () => {
    const ctx = fakeCtx();
    const cap = new LockCapability<Cfg, State>(ctx, strategy);
    const state = await cap.unlock({ name: 'ZFOO' }, 'H1');
    // stateful BEFORE the UNLOCK (older BASIS), stateless AFTER.
    expect(ctx.calls).toEqual([
      'session:stateful',
      'release:ZFOO:H1',
      'session:stateless',
    ]);
    // the ADT unlock response is preserved in state.
    expect(state.unlockResult).toBe('R:ZFOO');
  });

  it('lock rethrows a missing name from the strategy', async () => {
    const ctx = fakeCtx();
    const cap = new LockCapability<Cfg, State>(ctx, strategy);
    await expect(cap.lock({})).rejects.toThrow('name is required');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/capabilities/lockCapability.test.ts --runInBand 2>&1 | tee /tmp/b3.log`
Then read `/tmp/b3.log`. Expected: FAIL — `Cannot find module '.../LockCapability'`.

- [ ] **Step 3: Write the implementation**

Create `src/core/shared/capabilities/LockCapability.ts`:

```ts
import type { IAdtLockable } from '@mcp-abap-adt/interfaces';
import type { ICapabilityContext, ILockStrategy } from './types';

/**
 * Shared lock/unlock for handlers whose lock differs only by endpoint and
 * name field. `lock` leaves the session stateful (the caller must unlock).
 * `unlock` runs the release inside a stateful request — older BASIS (#106)
 * only accepts UNLOCK while stateful — then restores stateless. The handler's
 * state shape (including the ADT `unlockResult`) is built by `strategy.release`
 * and returned unchanged. See the spec's IAdtLockable obligations — idempotent
 * unlock is a TARGET, not implemented here, and is left to the per-endpoint
 * probe + adaptation rule of the full-migration plan.
 *
 * DELIBERATELY byte-identical to the current handlers, including the failure
 * path: if `acquire`/`release` throws, the session is left as-is (stateful) and
 * the error propagates — exactly as today. Failure/abandonment handling is
 * DISTRIBUTED and this capability owns none of it:
 *   - the consumer largely owns lock/unlock atomicity (it decides when to lock
 *     and unlock);
 *   - adt-clients' `LockRegistry.unlockAll()` is a disposal safety net that
 *     raw-releases abandoned locks — deliberately WITHOUT toggling the session,
 *     because `unlockAll()` manages the session once for the whole batch;
 *   - the operation chain's create/update catch blocks also call
 *     setSessionType('stateless').
 * Adding a try/finally here would change behaviour and relocate responsibility
 * across those layers, so the atom-level "restore stateless on failure"
 * contract is deferred to the behavioural-conformance work (same bucket as
 * activate/check error unification), where all three layers are reconciled
 * rather than double-cleaned.
 */
export class LockCapability<TConfig, TReadResult>
  implements IAdtLockable<TConfig, TReadResult>
{
  constructor(
    private readonly ctx: ICapabilityContext,
    private readonly strategy: ILockStrategy<TConfig, TReadResult>,
  ) {}

  async lock(config: Partial<TConfig>): Promise<string> {
    const name = this.strategy.nameOf(config);
    // Stay stateful while the lock is held; the caller releases via unlock().
    this.ctx.connection.setSessionType('stateful');
    const { lockHandle } = await this.strategy.acquire(this.ctx, name);
    return lockHandle;
  }

  async unlock(
    config: Partial<TConfig>,
    lockHandle: string,
  ): Promise<TReadResult> {
    const name = this.strategy.nameOf(config);
    // UNLOCK must run stateful (older BASIS #106); restore stateless after.
    this.ctx.connection.setSessionType('stateful');
    const state = await this.strategy.release(this.ctx, name, lockHandle);
    this.ctx.connection.setSessionType('stateless');
    return state;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/capabilities/lockCapability.test.ts --runInBand 2>&1 | tee /tmp/b3.log`
Then read `/tmp/b3.log`. Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/shared/capabilities/LockCapability.ts src/__tests__/unit/core/capabilities/lockCapability.test.ts
git commit -m "feat(capabilities): LockCapability with normalized lock result"
```

---

### Task B4: VersionsCapability (TDD)

**Files:**
- Create: `/home/okyslytsia/prj/mcp-abap-adt-clients/src/core/shared/capabilities/VersionsCapability.ts`
- Test: `/home/okyslytsia/prj/mcp-abap-adt-clients/src/__tests__/unit/core/capabilities/versionsCapability.test.ts`

**Interfaces:**
- Consumes: `ICapabilityContext`, `IVersionsStrategy` from `./types`; `IObjectVersion` from `@mcp-abap-adt/interfaces`.
- Produces: `class VersionsCapability<TConfig> implements IAdtVersionable<TConfig>` with constructor `(ctx, strategy)`. Methods: `getVersions(config): Promise<IObjectVersion[]>`, `getVersionSource(contentUri): Promise<string>`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/capabilities/versionsCapability.test.ts`:

```ts
import { VersionsCapability } from '../../../../core/shared/capabilities/VersionsCapability';
import type {
  ICapabilityContext,
  IVersionsStrategy,
} from '../../../../core/shared/capabilities/types';

type Cfg = { name?: string };
const ctx: ICapabilityContext = { connection: {} as any, logger: undefined };

const strategy: IVersionsStrategy<Cfg> = {
  nameOf: (c) => {
    if (!c.name) throw new Error('name is required');
    return c.name;
  },
  list: async (_ctx, name) => [
    { version: '000001', versionTitle: name } as any,
  ],
  source: async (_ctx, uri) => `source-of:${uri}`,
};

describe('VersionsCapability', () => {
  it('getVersions delegates to the strategy', async () => {
    const cap = new VersionsCapability<Cfg>(ctx, strategy);
    const v = await cap.getVersions({ name: 'ZBAR' });
    expect(v).toHaveLength(1);
    expect(v[0].versionTitle).toBe('ZBAR');
  });

  it('getVersionSource delegates to the strategy', async () => {
    const cap = new VersionsCapability<Cfg>(ctx, strategy);
    expect(await cap.getVersionSource('/uri/1')).toBe('source-of:/uri/1');
  });

  it('getVersions rethrows a missing name', async () => {
    const cap = new VersionsCapability<Cfg>(ctx, strategy);
    await expect(cap.getVersions({})).rejects.toThrow('name is required');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/capabilities/versionsCapability.test.ts --runInBand 2>&1 | tee /tmp/b4.log`
Then read `/tmp/b4.log`. Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/core/shared/capabilities/VersionsCapability.ts`:

```ts
import type { IAdtVersionable, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { ICapabilityContext, IVersionsStrategy } from './types';

/**
 * Shared version history for source-backed objects. Types without a
 * /source/main resource do NOT compose this capability and do not implement
 * IAdtVersionable — absence is expressed structurally, not by throwing.
 */
export class VersionsCapability<TConfig>
  implements IAdtVersionable<TConfig>
{
  constructor(
    private readonly ctx: ICapabilityContext,
    private readonly strategy: IVersionsStrategy<TConfig>,
  ) {}

  getVersions(config: Partial<TConfig>): Promise<IObjectVersion[]> {
    const name = this.strategy.nameOf(config);
    return this.strategy.list(this.ctx, name);
  }

  getVersionSource(contentUri: string): Promise<string> {
    return this.strategy.source(this.ctx, contentUri);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/capabilities/versionsCapability.test.ts --runInBand 2>&1 | tee /tmp/b4.log`
Then read `/tmp/b4.log`. Expected: 3 passed.

- [ ] **Step 5: Add the barrel and commit**

Create `src/core/shared/capabilities/index.ts`:

```ts
export * from './types';
export { LockCapability } from './LockCapability';
export { VersionsCapability } from './VersionsCapability';
```

```bash
git add src/core/shared/capabilities/VersionsCapability.ts src/core/shared/capabilities/index.ts src/__tests__/unit/core/capabilities/versionsCapability.test.ts
git commit -m "feat(capabilities): VersionsCapability + barrel"
```

---

### Task B5: Convert AdtClass to compose the capabilities

**Files:**
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-clients/src/core/class/AdtClass.ts`

**Interfaces:**
- Consumes: `LockCapability`, `VersionsCapability`, `ICapabilityContext` from `../shared/capabilities`; the existing low-level `lockClass`, `unlockClass`, `getClassIncludeVersions`, `getClassVersionSource` (already imported in the module).
- Produces: `AdtClass` with `lock`/`unlock`/`getVersions`/`getVersionSource` routed through the capabilities; `create`/`read`/`update`/`delete`/`validate`/`check`/`activate`/`readTransport` unchanged; `implements IAdtObject<IClassConfig, IClassState>` unchanged.

- [ ] **Step 1: Add the capability instances and lock/versions strategies**

In `AdtClass.ts`, inside the class, add a private capability context and instances built from the existing low-level functions. The strategies wrap the current helpers so behaviour is byte-identical:

```ts
// near the other imports
import {
  LockCapability,
  VersionsCapability,
  type ICapabilityContext,
} from '../shared/capabilities';

// inside the class body
private get capCtx(): ICapabilityContext {
  return { connection: this.connection, logger: this.logger };
}

private readonly lockCap = new LockCapability<IClassConfig, IClassState>(
  this.capCtx,
  {
    nameOf: (c) => {
      if (!c.className) throw new Error('Class name is required');
      return c.className;
    },
    acquire: async (ctx, name) => ({
      lockHandle: await lockClass(ctx.connection, name),
    }),
    release: async (ctx, name, handle) => {
      const result = await unlockClass(ctx.connection, name, handle);
      return { unlockResult: result, errors: [] };
    },
  },
);

private readonly versionsCap = new VersionsCapability<IClassConfig>(
  this.capCtx,
  {
    nameOf: (c) => {
      if (!c.className) throw new Error('className is required');
      return c.className;
    },
    list: (ctx, name) => getClassIncludeVersions(ctx.connection, name, 'main'),
    source: (ctx, uri) => getClassVersionSource(ctx.connection, uri),
  },
);
```

Note: `AdtClass.lock` currently also calls `this.lockTracker.track(...)`. Preserve that — keep it in the handler `lock` wrapper (Step 2), not the capability, because the tracker is handler state.

**DO NOT TOUCH the constructor's `createLockTracker(...)` setup.** It passes a
raw-unlock thunk `(name, handle) => unlockClass(this.connection, name, handle)`
that deliberately does NOT toggle the session — it is the `LockRegistry.unlockAll()`
disposal safety net, and `unlockAll()` manages the session for the whole batch.
This is a SEPARATE unlock path from the `unlock()` method (which goes through the
capability and DOES toggle). Both must survive: only the lock/unlock/versions
method BODIES change; the constructor's tracker wiring stays exactly as it is.
The same applies to `AdtDomain` and `AdtServiceDefinition` in Tasks B6 and B7.

- [ ] **Step 2: Replace the four method bodies with capability delegation, preserving lock tracking**

Replace the existing `lock`, `unlock`, `getVersions`, `getVersionSource` method bodies:

```ts
async lock(config: Partial<IClassConfig>): Promise<string> {
  const handle = await this.lockCap.lock(config);
  this.lockTracker.track(config.className as string, handle);
  return handle;
}

async unlock(
  config: Partial<IClassConfig>,
  lockHandle: string,
): Promise<IClassState> {
  const state = await this.lockCap.unlock(config, lockHandle);
  this.lockTracker.untrack(config.className as string);
  return state;
}

getVersions(config: Partial<IClassConfig>): Promise<IObjectVersion[]> {
  return this.versionsCap.getVersions(config);
}

getVersionSource(contentUri: string): Promise<string> {
  return this.versionsCap.getVersionSource(contentUri);
}
```

The current `unlock` body (`src/core/class/AdtClass.ts`) is
`stateful → unlockClass → stateless → untrack → return { unlockResult, errors: [] }`.
The capability now owns `stateful → release(builds { unlockResult, errors }) → stateless`,
so the handler wrapper only adds the `untrack`. The state shape is identical; the
duplicate `setSessionType('stateless')` and the name-guard now live in the capability
and its strategy, so remove them from the handler body.

- [ ] **Step 3: Build**

Run: `npm run build:fast`
Expected: exit 0. If `AdtClass` no longer satisfies `IAdtObject`, the build fails here — that is the structural check doing its job.

- [ ] **Step 4: Run the class unit tests**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand 2>&1 | tee /tmp/b5.log`
Then read `/tmp/b5.log`. Expected: all pass (the prior 348 plus the 6 new capability tests = 354).

- [ ] **Step 5: Commit**

```bash
git add src/core/class/AdtClass.ts
git commit -m "refactor(class): compose LockCapability + VersionsCapability"
```

---

### Task B6: Convert AdtDomain — the no-versions case

**Files:**
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-clients/src/core/domain/AdtDomain.ts`

**Interfaces:**
- Consumes: `LockCapability` from `../shared/capabilities`; existing `lockDomain`, `unlockDomain`.
- Produces: `AdtDomain` with `lock`/`unlock` routed through `LockCapability`; `getVersions`/`getVersionSource` continue to call `throwUnsupportedVersions('domain')` — Domain does NOT compose `VersionsCapability`. This proves the absent-capability case.

- [ ] **Step 1: Add the LockCapability instance**

In `AdtDomain.ts`, mirror the AdtClass pattern but only for lock (Domain has no `/source/main`, so no VersionsCapability):

```ts
import {
  LockCapability,
  type ICapabilityContext,
} from '../shared/capabilities';

private get capCtx(): ICapabilityContext {
  return { connection: this.connection, logger: this.logger };
}

private readonly lockCap = new LockCapability<IDomainConfig, IDomainState>(
  this.capCtx,
  {
    nameOf: (c) => {
      if (!c.domainName) throw new Error('Domain name is required');
      return c.domainName;
    },
    acquire: async (ctx, name) => ({
      lockHandle: await lockDomain(ctx.connection, name),
    }),
    release: async (ctx, name, handle) => {
      const result = await unlockDomain(ctx.connection, name, handle);
      return { unlockResult: result, errors: [] };
    },
  },
);
```

(Confirm `lockDomain`/`unlockDomain` signatures first: `grep -n "export async function lockDomain" src/core/domain/lock.ts` and `.../unlockDomain .../ src/core/domain/unlock.ts` — both are `(connection, domainName, [lockHandle])`. If `lockDomain` returns `{ lockHandle }` rather than a bare string, adapt `acquire` to return it directly.)

- [ ] **Step 2: Replace lock/unlock, leave getVersions untouched**

Replace `AdtDomain.lock` and `AdtDomain.unlock` bodies with the capability delegation (mirroring B5 Step 2, using `domainName` and Domain's lock tracker if present). Do NOT touch `getVersions`/`getVersionSource` — they must still throw via `throwUnsupportedVersions('domain')`.

```ts
async lock(config: Partial<IDomainConfig>): Promise<string> {
  const handle = await this.lockCap.lock(config);
  this.lockTracker?.track(config.domainName as string, handle);
  return handle;
}

async unlock(
  config: Partial<IDomainConfig>,
  lockHandle: string,
): Promise<IDomainState> {
  const state = await this.lockCap.unlock(config, lockHandle);
  this.lockTracker?.untrack(config.domainName as string);
  return state;
}
```

- [ ] **Step 3: Build and unit test**

Run: `npm run build:fast && MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand 2>&1 | tee /tmp/b6.log`
Then read `/tmp/b6.log`. Expected: exit 0, all pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/domain/AdtDomain.ts
git commit -m "refactor(domain): compose LockCapability; versions stay unsupported"
```

---

### Task B7: Convert AdtServiceDefinition — capability reuse across a third type

**Files:**
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-clients/src/core/serviceDefinition/AdtServiceDefinition.ts`

**Interfaces:**
- Consumes: `LockCapability`, `VersionsCapability`; existing `lockServiceDefinition`, `unlockServiceDefinition`, `getServiceDefinitionVersions`, `getServiceDefinitionVersionSource`.
- Produces: `AdtServiceDefinition` with lock/unlock/versions routed through the same shared capabilities — proving reuse across a third, differently-endpointed type.

- [ ] **Step 1: Confirm the low-level names**

Run: `grep -n "export async function\|export function" src/core/serviceDefinition/lock.ts src/core/serviceDefinition/unlock.ts src/core/serviceDefinition/versions.ts`
Note the exact function names and use them in Step 2 (they may be `lockServiceDefinition` / `unlockServiceDefinition` / `getServiceDefinitionVersions` / `getServiceDefinitionVersionSource`).

- [ ] **Step 2: Add both capability instances and delegate**

Mirror B5 exactly, with `serviceDefinitionName` as the config field and the ServiceDefinition low-level functions in the strategies. Replace `lock`/`unlock`/`getVersions`/`getVersionSource` bodies with capability delegation, preserving any lock tracking.

```ts
import {
  LockCapability,
  VersionsCapability,
  type ICapabilityContext,
} from '../shared/capabilities';

private get capCtx(): ICapabilityContext {
  return { connection: this.connection, logger: this.logger };
}

private readonly lockCap = new LockCapability<IServiceDefinitionConfig, IServiceDefinitionState>(
  this.capCtx,
  {
    nameOf: (c) => {
      if (!c.serviceDefinitionName) throw new Error('Service definition name is required');
      return c.serviceDefinitionName;
    },
    acquire: async (ctx, name) => ({
      lockHandle: await lockServiceDefinition(ctx.connection, name),
    }),
    release: async (ctx, name, handle) => {
      const result = await unlockServiceDefinition(ctx.connection, name, handle);
      return { unlockResult: result, errors: [] };
    },
  },
);

private readonly versionsCap = new VersionsCapability<IServiceDefinitionConfig>(
  this.capCtx,
  {
    nameOf: (c) => {
      if (!c.serviceDefinitionName) throw new Error('serviceDefinitionName is required');
      return c.serviceDefinitionName;
    },
    // NOTE: getServiceDefinitionVersions takes a config, not a bare name —
    // the strategy re-wraps. (getClassIncludeVersions, by contrast, takes a
    // name; the two low-level shapes differ and the strategy absorbs that.)
    list: (ctx, name) =>
      getServiceDefinitionVersions(ctx.connection, {
        serviceDefinitionName: name,
      }),
    source: (ctx, uri) => getServiceDefinitionVersionSource(ctx.connection, uri),
  },
);
```

- [ ] **Step 3: Build and unit test**

Run: `npm run build:fast && MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand 2>&1 | tee /tmp/b7.log`
Then read `/tmp/b7.log`. Expected: exit 0, all pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/serviceDefinition/AdtServiceDefinition.ts
git commit -m "refactor(serviceDefinition): compose LockCapability + VersionsCapability"
```

---

### Task B8: Conformance tests + surface unchanged + full suite

**Files:**
- Create: `/home/okyslytsia/prj/mcp-abap-adt-clients/src/__tests__/unit/core/capabilities/conformance.test.ts`

**Interfaces:**
- Consumes: the three converted handlers (constructed with a fake connection).
- Produces: a table-driven test asserting the shared behavioural obligations hold identically across the three — specifically the older-BASIS ordering (stateful precedes the LOCK/UNLOCK request, stateless follows the UNLOCK) — plus a verified-unchanged public surface. The failure-path contract is deliberately NOT tested here (it is deferred; see LockCapability's docstring).

- [ ] **Step 1: Write the conformance test**

Create `src/__tests__/unit/core/capabilities/conformance.test.ts`. It asserts the lock/unlock session-toggle contract holds for every handler that composes `LockCapability`, using a fake connection that records `setSessionType` calls:

```ts
import { AdtClass } from '../../../../core/class/AdtClass';
import { AdtDomain } from '../../../../core/domain/AdtDomain';
import { AdtServiceDefinition } from '../../../../core/serviceDefinition/AdtServiceDefinition';

/**
 * Records session toggles AND requests in ONE ordered trace, so the test can
 * assert the older-BASIS ordering (stateful must precede the UNLOCK request,
 * stateless must follow it) rather than only the final session state.
 */
function recordingConnection() {
  const trace: string[] = [];
  return {
    trace,
    setSessionType: (t: string) => trace.push(`session:${t}`),
    makeAdtRequest: async (req: any) => {
      const url: string = req?.url ?? '';
      const action = /_action=(\w+)/.exec(url)?.[1] ?? 'GET';
      trace.push(`request:${action}`);
      return {
        status: 200,
        headers: {},
        // minimal LOCK response shape the low-level parsers accept
        data: `<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>`,
      };
    },
  } as any;
}

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;

const cases = [
  { name: 'AdtClass', make: (c: any) => new AdtClass(c, noopLogger), cfg: { className: 'ZC' } },
  { name: 'AdtDomain', make: (c: any) => new AdtDomain(c, noopLogger), cfg: { domainName: 'ZD' } },
  {
    name: 'AdtServiceDefinition',
    make: (c: any) => new AdtServiceDefinition(c, noopLogger),
    cfg: { serviceDefinitionName: 'ZS' },
  },
];

describe('LockCapability conformance across handlers', () => {
  it.each(cases)('$name: lock sets stateful before the LOCK request', async ({ make, cfg }) => {
    const conn = recordingConnection();
    const handler = make(conn);
    await handler.lock(cfg);
    const iSession = conn.trace.indexOf('session:stateful');
    const iRequest = conn.trace.findIndex((e: string) => e.startsWith('request:'));
    expect(iSession).toBeGreaterThanOrEqual(0);
    expect(iRequest).toBeGreaterThan(iSession); // stateful BEFORE the request
    // and the session is left stateful (the lock is held).
    expect(conn.trace.filter((e: string) => e.startsWith('session:')).pop()).toBe('session:stateful');
  });

  it.each(cases)('$name: unlock is stateful → UNLOCK → stateless, in order', async ({ make, cfg }) => {
    const conn = recordingConnection();
    const handler = make(conn);
    await handler.unlock(cfg, 'H1');
    const iStateful = conn.trace.indexOf('session:stateful');
    const iUnlock = conn.trace.indexOf('request:UNLOCK');
    const iStateless = conn.trace.indexOf('session:stateless');
    expect(iStateful).toBeGreaterThanOrEqual(0);
    expect(iUnlock).toBeGreaterThan(iStateful); // stateful BEFORE unlock (older BASIS)
    expect(iStateless).toBeGreaterThan(iUnlock); // stateless AFTER unlock
  });
});
```

(Adjust the constructor arity per handler if any takes options; confirm with `grep -n "constructor" src/core/class/AdtClass.ts`.)

- [ ] **Step 2: Run the conformance test**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/capabilities/conformance.test.ts --runInBand 2>&1 | tee /tmp/b8.log`
Then read `/tmp/b8.log`. Expected: 6 passed.

- [ ] **Step 3: Full unit suite**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand 2>&1 | tee /tmp/b8-unit.log`
Then read `/tmp/b8-unit.log`. Expected: all pass (~356).

- [ ] **Step 4: Public surface unchanged**

Run:
```bash
npm run build:fast
node _surface-snapshot.mjs > /tmp/surface-after.txt
diff /tmp/surface-before.txt /tmp/surface-after.txt && echo "SURFACE IDENTICAL"
```
Expected: `SURFACE IDENTICAL` (empty diff). A non-empty diff means the refactor changed the public API and must be fixed before proceeding.

- [ ] **Step 5: Lint**

Run: `npm run lint:check 2>&1 | tee /tmp/b8-lint.log`
Then read `/tmp/b8-lint.log`. Expected: 0 errors; warnings/infos at or below the 45/25 baseline.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/unit/core/capabilities/conformance.test.ts
git commit -m "test(capabilities): cross-handler lock/unlock conformance; surface unchanged"
```

---

### Task B9: Verify against the trial system and the consumer

**Files:** none (verification only).

- [ ] **Step 1: Warn the user, then run the three pilot integration suites on trial**

WARN the user first: trial integration needs a browser with the right profile and a fresh JWT. Then, with the user's go-ahead:

```bash
cp ~/.config/mcp-abap-adt/sessions/trial.env .env
npm test -- integration/core/class integration/core/domain integration/core/serviceDefinition 2>&1 | tee integration-pilot.log
```
Then read `integration-pilot.log` — read the summary block (`Test Suites:` … onward). Expected: the previously-passing tests for these three still pass; any pre-existing skips remain skips. A NEW failure that was passing before the refactor is a regression to investigate before release.

- [ ] **Step 2: Verify the consumer still builds and type-checks against the pilot build**

The consumer (`~/prj/mcp-abap-adt`) pins `@mcp-abap-adt/adt-clients` and exercises the `IAdtObject` surface. To prove transparency without publishing, point it at the local pilot build in a throwaway way (do NOT commit the consumer lockfile change):

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients && npm run build && npm pack
# produces mcp-abap-adt-adt-clients-<ver>.tgz
cd /home/okyslytsia/prj/mcp-abap-adt
npm install --no-save /home/okyslytsia/prj/mcp-abap-adt-clients/mcp-abap-adt-adt-clients-*.tgz
npm run build 2>&1 | tee /tmp/consumer-build.log
```
Then read `/tmp/consumer-build.log`. Expected: the consumer compiles clean against the pilot build — proof the `IAdtObject` surface is transparent. Restore the consumer's dependency afterward: `cd ~/prj/mcp-abap-adt && npm install` (re-pulls the published version; confirm no `"link": true` and no tarball path left in its lockfile).

- [ ] **Step 3: Record the verification outcome**

No commit. Summarize for the user: unit (count), trial integration (pass/skip/fail per suite with the actual numbers from the log), surface diff (empty), consumer build (clean). If anything regressed, STOP and report rather than proceeding to release.

---

### Task B10: Version, changelog, PR

**Files:**
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-clients/package.json` (version)
- Modify: `/home/okyslytsia/prj/mcp-abap-adt-clients/CHANGELOG.md`

- [ ] **Step 1: Ask the user for the version**

Per the global constraint, the user chooses the CHANGELOG version. Recommend **minor** (e.g. 7.6.0): additive and internal, public surface proven unchanged. Wait for confirmation.

- [ ] **Step 2: Bump and refresh the lockfile**

```bash
npm version <chosen> --no-git-tag-version
npm install --package-lock-only
grep -c '"link": true' package-lock.json
```
Expected: version updated; `"link": true` count `0`.

- [ ] **Step 3: Add the CHANGELOG entry**

```markdown
## [<chosen>] - 2026-07-20

### Changed
- **Pilot of the capability-composition architecture.** `AdtClass`, `AdtDomain`
  and `AdtServiceDefinition` now route lock/unlock (and, for the two
  source-backed types, version history) through shared `LockCapability` /
  `VersionsCapability` implementations parameterized by a per-handler strategy,
  instead of bespoke per-type wrappers. `AdtDomain` composes no
  `VersionsCapability` — it has no `/source/main`, so the absence is structural.
  Requires `@mcp-abap-adt/interfaces ^11.2.0` (the capability atoms).

No API change: the `IAdtObject` surface is byte-identical (verified across all
seven entry points) and behaviour is unchanged (unit + trial integration for
the three handlers, plus a clean consumer build against this release).
```

- [ ] **Step 4: Commit, PR, and stop at the release gate**

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "release(<chosen>): pilot capability composition on 3 handlers"
git push -u origin feat/capability-pilot
gh pr create --title "release(<chosen>): capability-composition pilot" --body "Routes lock/versions through shared capabilities on AdtClass/AdtDomain/AdtServiceDefinition. IAdtObject surface unchanged (empty diff across 7 entry points); consumer builds clean. Consumes interfaces ^11.2.0. Remaining 32 handlers, activate/check error-unification, and the ATC client are future plans."
```

Report to the user: PR opened, ready for review + merge + tag + GitHub release; **`npm publish` is the user's step**.

---

## Out of scope (future plans)

- The remaining 32 handlers — a separate migration plan, using the classification (fits-strategy vs bespoke) the spec requires; includes `AdtFunctionModule` (composite key), `AdtBehaviorImplementation` (delegates to `AdtClass`), `AdtMessageClassMessage` (double-lock).
- `ActivateCapability` / `CheckCapability` with error-envelope unification — a deliberate behavioural change; its own plan with conformance tests and a CHANGELOG note naming the changed error shapes.
- **The atom-level failure-path contract** (lock/unlock restore stateless on a thrown error). Today failure/abandonment handling is distributed — the consumer owns lock/unlock atomicity, `LockRegistry.unlockAll()` is a disposal safety net (raw release, no session toggle), and the operation chain's catch blocks also restore stateless. This pilot preserves all three exactly. Moving restoration into the capabilities is a deliberate behavioural change that must reconcile with all three layers (to avoid double-restore), so it belongs with the error-unification work, not here.
- `TransportCapability` extraction.
- Narrowing `AdtClient.getXxx()` return types (the breaking flip) and deprecating the fat contract.
- The ATC client + `runSync` + MCP tools, built on this architecture once proven.
- The search capability (`IAdtObjectHit` + breaking `adtType`→`type` normalization) — its own spec.
