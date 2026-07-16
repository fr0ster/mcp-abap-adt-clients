# Dead / misleading API-surface cleanup (7.4.3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove two dead/misleading API surfaces — the no-op `source_code` on 5 `ICreateXxxParams`, and the ignored `withLongPolling` plumbing in featureToggle's low-level read — without breaking the published API.

**Architecture:** Two independent cleanups plus a release. `source_code`: delete the field from the 4 internal create-params and their 3 dead pass-throughs, keep + `@deprecated` the one publicly-exported field (`ICreateEnhancementParams`). featureToggle: delete the unused `_options`/local `IReadOptions` from `readFeatureToggle`, keep the public handler signatures (mandated by `IAdtObject`), document that SFW readiness is a plain GET. Guarded by three characterization tests (enhancement public-surface, serviceDefinition create metadata-only, featureToggle no-long-polling) plus the TypeScript build.

**Tech Stack:** TypeScript (strict, CommonJS), Jest + ts-jest, Biome, published types via `@mcp-abap-adt/interfaces`.

## Global Constraints

- Code, comments, error messages in English. Comments explain "why" not "what".
- Biome: single quotes, semicolons always, indent 2 spaces.
- Never change `package.json` version except in the explicit release task.
- After changing the version, run `npm install --package-lock-only` and commit the lockfile in the same commit. Verify `package-lock.json` has no `"link": true`.
- Run unit tests offline with `MCP_ENV_PATH=/tmp/nonexistent-env` prefix (skips the SAP preflight in globalSetup that aborts on an expired trial JWT).
- Do NOT touch `program` (genuinely uploads source via camelCase `sourceCode`), the `IUpdateXxxParams` `source_code` fields (live), or the shared `IReadOptions` in `src/core/shared/types.ts` (its `withLongPolling` is honored elsewhere).
- Branch already checked out: `cleanup/dead-api-surface-7.4.3`.

## File Structure

- `src/core/{accessControl,functionInclude,scalarFunction,serviceDefinition}/types.ts` — remove `source_code?` from the `ICreateXxxParams` interface.
- `src/core/enhancement/types.ts` — keep `source_code?` on `ICreateEnhancementParams`, add `@deprecated`.
- `src/core/accessControl/AdtAccessControl.ts`, `src/core/serviceDefinition/AdtServiceDefinition.ts` — remove the dead `source_code:` line from `create()`.
- `src/core/functionInclude/AdtFunctionInclude.ts` — remove the dead `source_code: config.sourceCode` line from `buildCreateParams`.
- `src/core/featureToggle/read.ts` — remove local `IReadOptions` + the unused `_options` param.
- `src/core/featureToggle/AdtFeatureToggle.ts` — drop the `IReadOptions` import, retype `read()` options inline, stop forwarding options to `readFeatureToggle`, drop the no-op `{ withLongPolling: true }` from the two internal readiness reads, add a doc comment.
- `src/__tests__/unit/core/enhancementCreateParamsSurface.test.ts` — NEW: public-barrel type guard.
- `src/__tests__/unit/core/serviceDefinitionCreateMetadataOnly.test.ts` — NEW: representative create() metadata-only wire test.
- `src/__tests__/unit/core/featureToggleNoLongPolling.test.ts` — NEW: wire guard.

---

### Task 1: Public-surface guard for `ICreateEnhancementParams.source_code`

Characterization test first — it passes against current code and must keep passing after Task 2's field removals. It pins the compatibility decision (the one public field stays) so an accidental future removal fails a test, not just a consumer's build.

**Files:**
- Test (create): `src/__tests__/unit/core/enhancementCreateParamsSurface.test.ts`

**Interfaces:**
- Consumes: `ICreateEnhancementParams` from the published barrel `src/index` (which re-exports `src/index.core`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the guard test**

```typescript
/**
 * Public API-surface guard: ICreateEnhancementParams is publicly exported
 * (src/index.core.ts -> src/index.ts). Its `source_code` field is a deprecated
 * no-op that is intentionally KEPT for backward compatibility (removing it would
 * break TS consumers). This test imports from the published barrel — not from
 * core/enhancement/types — so it guards the real exported surface, including the
 * barrel re-export. If the field or its export is removed, the type index below
 * stops compiling and this suite fails to build.
 */
import type { ICreateEnhancementParams } from '../../../index';

// Compile-time guards (checked by ts-jest at build):
// 1. The field still exists on the exported type.
type _FieldExists = ICreateEnhancementParams['source_code'];
// 2. It is still optional (undefined is assignable to it).
const _optional: _FieldExists = undefined;

describe('ICreateEnhancementParams public surface', () => {
  it('keeps source_code as an optional field on the published type', () => {
    // The real assertion is the compile-time type index above; this runtime
    // body exists so Jest registers a passing test once the file type-checks.
    expect(_optional).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test, verify it passes (green baseline)**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/enhancementCreateParamsSurface.test.ts --runInBand`
Expected: PASS, 1 test. (It compiles because `source_code` currently exists on the exported type.)

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/core/enhancementCreateParamsSurface.test.ts
git commit -m "test(enhancement): guard public ICreateEnhancementParams.source_code surface"
```

---

### Task 2: Remove dead `source_code` (4 internal fields, 3 pass-throughs) + deprecate the public one

**Files:**
- Test (create): `src/__tests__/unit/core/serviceDefinitionCreateMetadataOnly.test.ts`
- Modify: `src/core/accessControl/types.ts` (remove `source_code?` from `ICreateAccessControlParams`, line ~9)
- Modify: `src/core/functionInclude/types.ts` (remove `source_code?` from `ICreateFunctionIncludeParams`, line ~14)
- Modify: `src/core/scalarFunction/types.ts` (remove `source_code?` from `ICreateScalarFunctionParams`, line ~12)
- Modify: `src/core/serviceDefinition/types.ts` (remove `source_code?` from `ICreateServiceDefinitionParams`, line ~13)
- Modify: `src/core/enhancement/types.ts` (add `@deprecated` to `source_code?` on `ICreateEnhancementParams`, line ~46)
- Modify: `src/core/accessControl/AdtAccessControl.ts:143` (remove `source_code:` line)
- Modify: `src/core/serviceDefinition/AdtServiceDefinition.ts:148` (remove `source_code:` line)
- Modify: `src/core/functionInclude/AdtFunctionInclude.ts:118` (remove `source_code: config.sourceCode` line)

**Interfaces:**
- Consumes: the Task 1 guard test (must stay green — proves the public enhancement field survives).
- Produces: none consumed by later tasks.

- [ ] **Step 1: Write the representative create() metadata-only wire test**

Characterization test for the invariant this whole cleanup rests on: `create()`
posts metadata only, never source — even when `sourceCode` is supplied. It is
green before and after the removals (before: the pass-through set `source_code`
on the low-level params, but `create.ts` ignored it, so the POST body never
carried source; after: no pass-through at all). It guards against a future
regression that wires source into `create()`.

```typescript
/**
 * create() is metadata-only: the POST to the SRVD create endpoint carries the
 * object metadata (name, package, description) but never the source code, even
 * when sourceCode is passed. This is the invariant behind removing the dead
 * source_code create-param — source is written by update(), as in Eclipse ADT.
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtServiceDefinition } from '../../../core/serviceDefinition/AdtServiceDefinition';
import { createTestsLogger } from '../../helpers/testLogger';

const logger: ILogger = createTestsLogger();
const UNIQUE_SOURCE = 'define service ZUNIQUE_SRC_MARKER { expose ZFOO; }';

function fakeConn(): { conn: IAbapConnection; calls: any[] } {
  const calls: any[] = [];
  const makeAdtRequest = jest.fn(async (req: any) => {
    calls.push(req);
    return { status: 201, data: '' };
  });
  return {
    conn: { makeAdtRequest, setSessionType: jest.fn() } as unknown as IAbapConnection,
    calls,
  };
}

describe('AdtServiceDefinition.create is metadata-only', () => {
  it('does not put source code in the create POST body', async () => {
    const { conn, calls } = fakeConn();
    const handler = new AdtServiceDefinition(conn, logger);

    await handler.create(
      {
        serviceDefinitionName: 'ZMETA_ONLY',
        packageName: 'ZPKG',
        description: 'meta only',
        sourceCode: UNIQUE_SOURCE,
      },
      { sourceCode: UNIQUE_SOURCE },
    );

    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts.length).toBeGreaterThan(0);
    for (const req of posts) {
      const body = typeof req.data === 'string' ? req.data : JSON.stringify(req.data ?? '');
      expect(body).not.toContain('ZUNIQUE_SRC_MARKER');
    }
  });
});
```

- [ ] **Step 2: Run it, verify it passes (green baseline)**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/serviceDefinitionCreateMetadataOnly.test.ts --runInBand`
Expected: PASS, 1 test. (create() already never sends source; this pins that.)

- [ ] **Step 3: Commit the characterization test**

```bash
git add src/__tests__/unit/core/serviceDefinitionCreateMetadataOnly.test.ts
git commit -m "test(serviceDefinition): pin create() as metadata-only (no source in POST)"
```

- [ ] **Step 4: Deprecate the public enhancement field**

In `src/core/enhancement/types.ts`, the `ICreateEnhancementParams` interface, change:

```typescript
  source_code?: string; // For enhoxhh only
```
to:
```typescript
  /**
   * @deprecated No-op. `create()` posts metadata only; the source is written by
   * `update()`. Kept for backward compatibility — this field is never read.
   */
  source_code?: string; // For enhoxhh only
```

- [ ] **Step 5: Remove the field from the 4 internal create-params**

In each of these files, delete the `source_code?: string;` line **inside the `ICreateXxxParams` interface only** (leave any `source_code` on `IUpdateXxxParams` / other interfaces untouched):

- `src/core/accessControl/types.ts` — `ICreateAccessControlParams` → delete `  source_code?: string;`
- `src/core/functionInclude/types.ts` — `ICreateFunctionIncludeParams` → delete `  source_code?: string;`
- `src/core/scalarFunction/types.ts` — `ICreateScalarFunctionParams` → delete `  source_code?: string;`
- `src/core/serviceDefinition/types.ts` — `ICreateServiceDefinitionParams` → delete `  source_code?: string;`

- [ ] **Step 6: Remove the 3 dead create() pass-throughs**

`src/core/accessControl/AdtAccessControl.ts` — inside `create()`, delete the line:
```typescript
        source_code: options?.sourceCode || config.sourceCode,
```

`src/core/serviceDefinition/AdtServiceDefinition.ts` — inside `create()`, delete the line:
```typescript
        source_code: options?.sourceCode || config.sourceCode,
```

`src/core/functionInclude/AdtFunctionInclude.ts` — inside `buildCreateParams`, delete the line:
```typescript
      source_code: config.sourceCode,
```
(Do NOT touch the separate real source upload later in `create()` that reads `options?.sourceCode || config.sourceCode` and calls `uploadFunctionIncludeSource`.)

- [ ] **Step 7: Build — verify no dangling references to the removed fields**

Run: `npm run build:fast`
Expected: clean compile (exit 0). A failure here means some code still references a removed `ICreateXxxParams.source_code` — fix that reference (it was dead too).

- [ ] **Step 8: Run the guard tests + full unit suite**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand`
Expected: all PASS, including `enhancementCreateParamsSurface` (public field survived) and `serviceDefinitionCreateMetadataOnly` (create still metadata-only).

- [ ] **Step 9: Lint**

Run: `npm run lint:check`
Expected: exit 0 (pre-existing warnings in unrelated files are fine; no new errors in the touched files).

- [ ] **Step 10: Commit**

```bash
git add src/core/accessControl src/core/functionInclude src/core/scalarFunction src/core/serviceDefinition src/core/enhancement
git commit -m "refactor(create): drop dead source_code from create-params; deprecate public enhancement field

Remove the no-op source_code field from 4 internal ICreateXxxParams
(accessControl, functionInclude, scalarFunction, serviceDefinition) and the 3
dead create() pass-throughs (accessControl, serviceDefinition direct;
functionInclude buildCreateParams). create() posts metadata only; source is
written by update(). ICreateEnhancementParams is publicly exported, so its
field is kept and marked @deprecated instead of removed. program and the live
IUpdateXxxParams.source_code fields are untouched."
```

---

### Task 3: featureToggle — remove ignored `withLongPolling` plumbing

Characterization test first (passes now — featureToggle already never sends the param), then remove the dead plumbing while keeping the public handler signatures (mandated by `IAdtObject`).

**Files:**
- Test (create): `src/__tests__/unit/core/featureToggleNoLongPolling.test.ts`
- Modify: `src/core/featureToggle/read.ts` (remove local `IReadOptions` + `_options` param)
- Modify: `src/core/featureToggle/AdtFeatureToggle.ts` (import line 44, `read()` at 262-289, readiness reads at ~454 and ~507)

**Interfaces:**
- Consumes: `readFeatureToggle(connection, name, version?)` — final signature after this task (no options param).
- Produces: none consumed by later tasks.

- [ ] **Step 1: Write the wire guard test**

```typescript
/**
 * featureToggle readiness reads are a plain GET: the SFW endpoint's support for
 * withLongPolling could not be verified from the cloud trial (SFW is on-prem),
 * so we deliberately never send it. This test pins that — readFeatureToggle must
 * not put withLongPolling in the request URL or params. It guards against a
 * future "fix" that wires an unverified parameter.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { readFeatureToggle } from '../../../core/featureToggle/read';

function fakeConn(): { conn: IAbapConnection; calls: any[] } {
  const calls: any[] = [];
  const makeAdtRequest = jest.fn(async (req: any) => {
    calls.push(req);
    return { status: 200, data: '' };
  });
  return {
    conn: { makeAdtRequest, setSessionType: jest.fn() } as unknown as IAbapConnection,
    calls,
  };
}

describe('readFeatureToggle never sends withLongPolling', () => {
  it('omits withLongPolling from url and params', async () => {
    const { conn, calls } = fakeConn();
    await readFeatureToggle(conn, 'ZTEST_FT', 'inactive');
    expect(calls).toHaveLength(1);
    const req = calls[0];
    expect(String(req.url)).not.toContain('withLongPolling');
    expect(req.params?.withLongPolling).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it, verify it passes (green baseline)**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/featureToggleNoLongPolling.test.ts --runInBand`
Expected: PASS, 1 test.

- [ ] **Step 3: Remove local `IReadOptions` and the `_options` param from `read.ts`**

Replace the whole of `src/core/featureToggle/read.ts` with:

```typescript
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_METADATA } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

// NOTE: withLongPolling is intentionally not accepted here. The SFW feature-
// toggle endpoint's support for it is unverified (on-prem only), so readiness
// reads are a plain GET. The public AdtFeatureToggle.read()/readMetadata()
// still accept withLongPolling to satisfy IAdtObject, but it is not forwarded.
export async function readFeatureToggle(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    params: { version },
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_METADATA },
  });
}
```

- [ ] **Step 4: Fix the import in `AdtFeatureToggle.ts:44`**

Change:
```typescript
import { type IReadOptions, readFeatureToggle } from './read';
```
to:
```typescript
import { readFeatureToggle } from './read';
```

- [ ] **Step 5: Retype `read()` options inline and stop forwarding to `readFeatureToggle`**

In `AdtFeatureToggle.ts`, the `read()` method (around line 262). Change the signature option type:
```typescript
    options?: IReadOptions,
```
to (inline, matching `IAdtObject.read`):
```typescript
    // withLongPolling accepted per IAdtObject, but not forwarded: SFW readiness
    // is a plain GET (endpoint support unverified — on-prem only).
    options?: { withLongPolling?: boolean },
```
And change the `readFeatureToggle` call (currently passing `options`):
```typescript
      const response = await readFeatureToggle(
        this.connection,
        config.featureToggleName,
        version ?? 'active',
        options,
      );
```
to:
```typescript
      const response = await readFeatureToggle(
        this.connection,
        config.featureToggleName,
        version ?? 'active',
      );
```

- [ ] **Step 6: Drop the no-op `{ withLongPolling: true }` from the two internal readiness reads**

In `AdtFeatureToggle.ts` around line 451 (post-update readiness) change:
```typescript
        const readState = await this.read(
          { featureToggleName: fullConfig.featureToggleName },
          'inactive',
          { withLongPolling: true },
        );
```
to:
```typescript
        const readState = await this.read(
          { featureToggleName: fullConfig.featureToggleName },
          'inactive',
        );
```

And around line 504 (post-activation readiness) change:
```typescript
          const readState = await this.read(
            { featureToggleName: fullConfig.featureToggleName },
            'active',
            { withLongPolling: true },
          );
```
to:
```typescript
          const readState = await this.read(
            { featureToggleName: fullConfig.featureToggleName },
            'active',
          );
```

- [ ] **Step 7: Build**

Run: `npm run build:fast`
Expected: clean compile (exit 0). Confirms no remaining reference to the removed `IReadOptions` and that `read()` still satisfies `IAdtObject`.

- [ ] **Step 8: Run the wire test + full unit suite**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand`
Expected: all PASS, including `featureToggleNoLongPolling`.

- [ ] **Step 9: Lint**

Run: `npm run lint:check`
Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/core/featureToggle/read.ts src/core/featureToggle/AdtFeatureToggle.ts src/__tests__/unit/core/featureToggleNoLongPolling.test.ts
git commit -m "refactor(featureToggle): remove ignored withLongPolling plumbing from low-level read

readFeatureToggle accepted an _options/withLongPolling it never sent. Remove the
dead param and the local IReadOptions duplicate; keep the public read()/
readMetadata() signatures (mandated by IAdtObject) but document that SFW
readiness is a plain GET (endpoint support unverified, on-prem). Drop the two
no-op { withLongPolling: true } args from featureToggle's own readiness reads.
New wire test guards that readFeatureToggle never sends the parameter."
```

---

### Task 4: Open the PR

**Files:** none (git/gh only).

- [ ] **Step 1: Push the branch**

Run: `git push -u origin cleanup/dead-api-surface-7.4.3`

- [ ] **Step 2: Open the PR** (title + body summarizing both cleanups, the 5→4+1 split, the featureToggle interface constraint, and that it is internal-only / non-breaking → patch 7.4.3). Do NOT merge — await review.

---

### Task 5: Release 7.4.3 (after PR review + merge)

Follows the established flow (Claude merges + tags + GitHub-releases; user runs `npm publish`).

**Files:**
- Modify: `package.json` (version → 7.4.3)
- Modify: `package-lock.json` (via `npm install --package-lock-only`)
- Modify: `CHANGELOG.md` (new `## [7.4.3]` section)

- [ ] **Step 1: On a fresh `chore/release-7.4.3` branch off updated `main`, bump `package.json` version `7.4.2` → `7.4.3`.**

- [ ] **Step 2: Refresh the lockfile**

Run: `npm install --package-lock-only`
Then verify: `grep -c '"link": true' package-lock.json` → expect `0`, and the top-level version reads `7.4.3`.

- [ ] **Step 3: Add the CHANGELOG entry** under a new `## [7.4.3] - <date>` heading:

```markdown
## [7.4.3] - <date>

### Changed
- **Removed dead `source_code` from create-params.** The no-op `source_code`
  field is removed from 4 internal `ICreateXxxParams` (accessControl,
  functionInclude, scalarFunction, serviceDefinition) and its 3 dead `create()`
  pass-throughs. `create()` posts metadata only — source is written by
  `update()`. `ICreateEnhancementParams.source_code` is publicly exported, so it
  is kept and marked `@deprecated` rather than removed (no API break). `program`
  and the live `IUpdateXxxParams.source_code` fields are untouched.
- **featureToggle: removed ignored `withLongPolling` plumbing.** The low-level
  `readFeatureToggle` accepted a `withLongPolling` option it never sent. The dead
  parameter and its local `IReadOptions` duplicate are removed; the public
  `read()`/`readMetadata()` keep the option (mandated by `IAdtObject`) but it is
  documented as not forwarded — SFW readiness is a plain GET (endpoint support
  unverified, on-prem).

No published-API break: the one public field (`ICreateEnhancementParams.
source_code`) is preserved as `@deprecated`; everything else removed is internal.
```

- [ ] **Step 4: Verify, commit, PR, merge, tag**

Run: `npm run build:fast && npm run lint:check && MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit --runInBand`
Expected: build clean, lint exit 0, all unit tests pass.
Then commit (`package.json`, `package-lock.json`, `CHANGELOG.md`), open the release PR, merge after review, then `git tag -a v7.4.3` + push, and update the CI-created GitHub release notes. `npm publish` is the user's step.

---

## Self-Review

**Spec coverage:**
- source_code type-field removal (4 internal) → Task 2 Step 2. ✓
- enhancement public field deprecation → Task 2 Step 1; guarded by Task 1. ✓
- 3 create() pass-through removals → Task 2 Step 3. ✓
- functionInclude real upload untouched → Task 2 Step 3 explicit note. ✓
- featureToggle `_options`/local `IReadOptions` removal → Task 3 Steps 3-5. ✓
- public handler signatures kept per `IAdtObject` → Task 3 Step 5 (inline retype). ✓
- doc comment on SFW plain-GET → Task 3 Steps 3, 5. ✓
- API-surface guard imports from public barrel → Task 1 Step 1. ✓
- representative create() metadata-only POST test → Task 2 Step 1 (serviceDefinition). ✓
- wire test for no withLongPolling → Task 3 Step 1. ✓
- offline test runs via MCP_ENV_PATH → all test steps. ✓
- patch 7.4.3, one PR, established release flow → Tasks 4-5. ✓

**Placeholder scan:** `<date>` in Task 5 is a genuine runtime value (release date), not a plan gap. No other placeholders.

**Type consistency:** `readFeatureToggle(connection, name, version?)` final signature is consistent between Task 3 Step 3 (definition) and Steps 5-6 (call sites). `options?: { withLongPolling?: boolean }` matches `IAdtObject.read`. Guard test type index `ICreateEnhancementParams['source_code']` matches the kept field.
