# Package master-language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover the `package` object type with the configurable master language (#105), shipped in adt-clients 5.6.0, bundled with the external behaviorDefinition namespace fix (PR #37) when that is merged first.

**Architecture:** `package` create params come from `@mcp-abap-adt/interfaces` (`ICreatePackageParams`, now with `master_language` in 7.3.0). The high-level `AdtPackage.create()` resolves `config.masterLanguage?.trim() || systemContext.masterLanguage?.trim() || undefined`; the low-level `create.ts` writes `params.master_language?.trim() || 'EN'` into both `adtcore:language` and `adtcore:masterLanguage`. Blank (empty/whitespace) = unset.

**Tech Stack:** TypeScript, Jest, Biome. Worktree `~/prj/mcp-abap-adt-clients-pkg`, branch `feat/package-master-language`. Spec: `docs/superpowers/specs/2026-06-13-package-master-language-design.md`.

---

### Task 1: Bundle base — merge #37, rebase, bump interfaces dep

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Merge PR #37 into main** (skip this task's #37 steps if not bundling)

```bash
gh pr merge 37 --repo fr0ster/mcp-abap-adt-clients --squash --delete-branch
```
Expected: state MERGED. If CI is `action_required` (fork), approve the run, confirm green, then merge.

- [ ] **Step 2: Rebase the worktree onto updated main**

```bash
cd ~/prj/mcp-abap-adt-clients-pkg
git fetch origin && git rebase origin/main
```
Expected: clean rebase; branch now includes #37.

- [ ] **Step 3: Bump interfaces dep to ^7.3.0 and install**

Set in `package.json`: `"@mcp-abap-adt/interfaces": "^7.3.0",` then:
```bash
npm install
```

- [ ] **Step 4: Verify install**

```bash
grep '"version"' node_modules/@mcp-abap-adt/interfaces/package.json | head -1
grep -c '"link": true' package-lock.json
grep -n "master_language" node_modules/@mcp-abap-adt/interfaces/dist/adt/IAdtPackage.d.ts
```
Expected: `7.3.0`; `0`; `master_language?: string` present.

---

### Task 2: Failing unit tests (full contract)

**Files:** Modify `src/__tests__/unit/core/masterLanguage.test.ts`

- [ ] **Step 1: Add imports** at the top of the file:

```typescript
import { AdtPackage } from '../../../core/package/AdtPackage';
import { createPackage } from '../../../core/package/create';
```

- [ ] **Step 2: Add the package describe block** inside the top-level `describe('masterLanguage on create', ...)`:

```typescript
  describe('package create master language', () => {
    function pkgBody(connection: IAbapConnection): string {
      const call = (connection.makeAdtRequest as jest.Mock).mock.calls.find(
        (c) => String(c[0]?.data).includes('pak:package'),
      );
      return String(call?.[0]?.data);
    }

    const baseParams = {
      package_name: 'ZAC_PKG_ML',
      super_package: 'ZLOCAL',
      description: 'master language probe',
      software_component: 'ZLOCAL',
      record_changes: false,
    };
    const baseConfig = {
      packageName: 'ZAC_PKG_ML',
      superPackage: 'ZLOCAL',
      description: 'master language probe',
      softwareComponent: 'ZLOCAL',
    };

    // High-level AdtPackage.create() resolution (cases 1-7)
    it('high-level: config language in both attributes', async () => {
      const c = mockConnection();
      await new AdtPackage(c, undefined, {}).create({ ...baseConfig, masterLanguage: 'DE' } as never);
      expect(pkgBody(c)).toContain('adtcore:language="DE"');
      expect(pkgBody(c)).toContain('adtcore:masterLanguage="DE"');
    });
    it('high-level: systemContext fallback', async () => {
      const c = mockConnection();
      await new AdtPackage(c, undefined, { masterLanguage: 'IT' }).create({ ...baseConfig } as never);
      expect(pkgBody(c)).toContain('adtcore:masterLanguage="IT"');
    });
    it('high-level: config overrides systemContext', async () => {
      const c = mockConnection();
      await new AdtPackage(c, undefined, { masterLanguage: 'IT' }).create({ ...baseConfig, masterLanguage: 'FR' } as never);
      expect(pkgBody(c)).toContain('adtcore:masterLanguage="FR"');
    });
    it('high-level: neither set → EN', async () => {
      const c = mockConnection();
      await new AdtPackage(c, undefined, {}).create({ ...baseConfig } as never);
      expect(pkgBody(c)).toContain('adtcore:masterLanguage="EN"');
    });
    it('high-level: empty config falls through to systemContext', async () => {
      const c = mockConnection();
      await new AdtPackage(c, undefined, { masterLanguage: 'IT' }).create({ ...baseConfig, masterLanguage: '' } as never);
      expect(pkgBody(c)).toContain('adtcore:masterLanguage="IT"');
    });
    it('high-level: whitespace config falls through to systemContext', async () => {
      const c = mockConnection();
      await new AdtPackage(c, undefined, { masterLanguage: 'IT' }).create({ ...baseConfig, masterLanguage: '   ' } as never);
      expect(pkgBody(c)).toContain('adtcore:masterLanguage="IT"');
    });
    it('high-level: surrounding spaces are trimmed', async () => {
      const c = mockConnection();
      await new AdtPackage(c, undefined, {}).create({ ...baseConfig, masterLanguage: ' DE ' } as never);
      expect(pkgBody(c)).toContain('adtcore:masterLanguage="DE"');
    });

    // Low-level createPackage() defensive trim (case 8)
    it('low-level: blank → EN, surrounding spaces trimmed', async () => {
      const c1 = mockConnection();
      await createPackage(c1, { ...baseParams, master_language: '   ' } as never);
      expect(pkgBody(c1)).toContain('adtcore:masterLanguage="EN"');
      const c2 = mockConnection();
      await createPackage(c2, { ...baseParams, master_language: ' DE ' } as never);
      expect(pkgBody(c2)).toContain('adtcore:masterLanguage="DE"');
    });
  });
```

- [ ] **Step 3: Run, verify they fail**

Run: `npx jest src/__tests__/unit/core/masterLanguage.test.ts -t "package create master language"`
Expected: FAIL — `create.ts` hardcodes `="EN"`; `IPackageConfig`/`AdtPackage.create()` don't yet carry `masterLanguage`.

---

### Task 3: Implement

**Files:** `src/core/package/types.ts`, `src/core/package/AdtPackage.ts`, `src/core/package/create.ts`

- [ ] **Step 1: `IPackageConfig` += masterLanguage** — in `src/core/package/types.ts`, after `masterSystem?: string;`:

```typescript
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
```

- [ ] **Step 2: `AdtPackage.create()`** — in the `await createPackage(this.connection, { ... })` params object, after `master_system: this.systemContext.masterSystem,`:

```typescript
        master_language:
          config.masterLanguage?.trim() ||
          this.systemContext.masterLanguage?.trim() ||
          undefined,
```

- [ ] **Step 3: `create.ts`** — after `const masterSystem = params.master_system;`:

```typescript
  const lang = params.master_language?.trim() || 'EN';
```
Then in `xmlBody`: `adtcore:language="EN"` → `adtcore:language="${lang}"` and `adtcore:masterLanguage="EN"` → `adtcore:masterLanguage="${lang}"`.

---

### Task 4: Verify

- [ ] **Step 1: Build** — `npm run build` → biome + tsc clean. (If biome flags formatting: `npm run lint`, then re-run.)
- [ ] **Step 2: Package tests** — `npx jest src/__tests__/unit/core/masterLanguage.test.ts -t "package create master language"` → PASS (8 cases).
- [ ] **Step 3: Full unit suite** — `npx jest src/__tests__/unit` → all PASS (prior + new package + #37 Namespace tests).

---

### Task 5: Version + CHANGELOG + lock

**Files:** `package.json`, `package-lock.json`, `CHANGELOG.md`

- [ ] **Step 1: Bump to 5.6.0** — `package.json` `"version": "5.6.0"`; `package-lock.json` root version (lines 3 and 9) → `5.6.0`.
- [ ] **Step 2: CHANGELOG** — add at top:

```markdown
## [5.6.0] - 2026-06-13

### Added
- **`package` create honours the configurable master language** (fr0ster/mcp-abap-adt#105). `IPackageConfig.masterLanguage` + `ICreatePackageParams.master_language` (interfaces 7.3.0) feed both `adtcore:language` and `adtcore:masterLanguage`; resolves `config.masterLanguage → systemContext.masterLanguage → EN`, treating blank (empty/whitespace) as unset. Default stays EN.

### Changed
- Bumped `@mcp-abap-adt/interfaces` from `^7.0.0` to `^7.3.0`.

### Fixed
- **behaviorDefinition: URL-encode namespaced object names in ADT paths** (#37). Wrapped names with `encodeSapObjectName(...)` across all path-based ops (lock/unlock/update/read/check/activate/delete). *(Include only if #37 was bundled.)*
```

- [ ] **Step 3: Verify lockfile** — `grep -cE '"link": true|"file:' package-lock.json` → `0`.

---

### Task 6: Commit, push, PR

- [ ] **Step 1: Commit**

```bash
git add src/core/package src/__tests__/unit/core/masterLanguage.test.ts docs/superpowers package.json package-lock.json CHANGELOG.md
git commit -m "feat(5.6.0): master language for package create (+ behaviorDefinition namespace fix #37 if bundled)"
```
(Do NOT stage the restored `docs/superpowers/specs/2026-04-14-*.md` — they are unchanged.)

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/package-master-language
gh pr create --repo fr0ster/mcp-abap-adt-clients --base main --head feat/package-master-language --title "feat(5.6.0): package master language (+ behaviorDefinition namespace fix #37)" --body "<summary + Refs #105>"
```
After merge: tag `v5.6.0`; user publishes.

---

## Out of scope
- Consumer (`mcp-abap-adt`) inbound `X-SAP-Language` header override + per-call `master_language` tool param.
- Realigning the 14 local `ICreate*Params` to `@mcp-abap-adt/interfaces`.
