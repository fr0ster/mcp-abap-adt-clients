# Object Version History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `getVersions(config)` / `getVersionSource(contentUri)` to the `IAdtObject` contract and implement them in every `AdtXxx`, so consumers can list an object's SAP version history and fetch a specific version's source.

**Architecture:** `@mcp-abap-adt/interfaces` gains the contract (types, two methods, one error code) — a MAJOR bump. `@mcp-abap-adt/adt-clients` implements it: source-bearing types build their own `<sourceUri>/versions` (or class `includes/{type}/versions`) URI, GET an Atom feed, parse it; non-source types throw `UNSUPPORTED_OPERATION`. Three pure helpers are shared (`parseVersionsFeed`, `throwUnsupportedVersions`, `throwVersionsError`); all endpoint/URI knowledge stays in each `AdtXxx`. Both the list GET and the content GET wrap every failure via `throwVersionsError` — nothing raw leaks outward.

**Tech Stack:** TypeScript (strict, CommonJS), Jest (ts-jest; unit tests SAP-free, integration trial-gated), Biome, `fast-xml-parser`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-28-object-version-history-design.md`. Read it first.
- Repo paths: interfaces = `/home/okyslytsia/prj/mcp-abap-adt-interfaces`, adt-clients = `/home/okyslytsia/prj/mcp-abap-adt-clients`.
- All artifacts in English; Biome = single quotes, semicolons, 2-space indent.
- Never bump `package.json` version without explicit user request; after a bump run `npm install --package-lock-only` and commit the lockfile in the same commit. No `"link": true` in any lockfile.
- Outward, expose ONLY the interface + typed errors — never raw `IAdtResponse`/axios.
- Each `AdtXxx` owns its own endpoint URIs; the only shared code is the three pure helpers. Both GETs (list + content) must wrap failures via `throwVersionsError` — no raw `IAdtResponse`/axios outward.
- Unit-test verification baseline for every adt-clients task: `npm run build` clean (Biome + tsc) and `SAP_URL= npx jest src/__tests__/unit` green. Integration tests are trial-gated (need the trial browser profile up) and run only when explicitly requested.
- Version-list URI shape is probe-verified ONLY for table + class so far. Any other source type's URI is a candidate that MUST be probe-verified before the type is marked supported.

---

## File Structure

- `interfaces/src/adt/IAdtObject.ts` — add `IObjectVersion`, `UNSUPPORTED_OPERATION` to `AdtObjectErrorCodes`, and the two methods on `IAdtObject`.
- `interfaces/src/index.ts` — uses a **selective** export for `./adt/IAdtObject` (not `export *`); Task 1.1 adds `IObjectVersion` to that export list. `AdtObjectErrorCodes` is already re-exported.
- `adt-clients/src/core/shared/versions.ts` — **new**: the three pure helpers `parseVersionsFeed(xml)`, `throwUnsupportedVersions()`, `throwVersionsError(error, detail)`. Zero endpoint knowledge.
- `adt-clients/src/core/{type}/versions.ts` — **new per type**: low-level `getXxxVersions(connection, config)` (build URI, GET feed, parse) and `getXxxVersionSource(connection, contentUri)`.
- `adt-clients/src/core/{type}/AdtXxx.ts` — add the two methods, delegating to `{type}/versions.ts` (source types) or `throwUnsupportedVersions` (non-source).
- `adt-clients/src/__tests__/unit/versionsParse.test.ts` — **new**: `parseVersionsFeed` + `throwUnsupportedVersions` + `throwVersionsError` unit tests.
- `adt-clients/src/__tests__/integration/core/{type}/...Versions.test.ts` — per verified type.

---

## Phase 1 — interfaces contract (MAJOR)

### Task 1.1: Add `IObjectVersion`, error code, and the two methods to `IAdtObject`

**Files:**
- Modify: `interfaces/src/adt/IAdtObject.ts`
- Test: `interfaces` has no runtime to test; verification is `npm run build`.

**Interfaces:**
- Produces: `IObjectVersion`; `AdtObjectErrorCodes.UNSUPPORTED_OPERATION = 'ADT_UNSUPPORTED_OPERATION'`; `IAdtObject.getVersions(config: Partial<TConfig>): Promise<IObjectVersion[]>`; `IAdtObject.getVersionSource(contentUri: string): Promise<string>`.

- [ ] **Step 1: Add the error code**

In `interfaces/src/adt/IAdtObject.ts`, inside the `AdtObjectErrorCodes` object literal, add (keep the trailing `as const`):
```ts
  /** Operation not supported for this object type (e.g. version history on a non-source object) */
  UNSUPPORTED_OPERATION: 'ADT_UNSUPPORTED_OPERATION',
```

- [ ] **Step 2: Add the `IObjectVersion` type**

Above `export interface IAdtObject`, add:
```ts
/** One entry in an object's version history (from the ADT versions Atom feed). */
export interface IObjectVersion {
  /** Version number, e.g. '00000'. */
  versionId: string;
  /** The user who created the version (atom:author/name), if present. */
  author?: string;
  /** ISO timestamp of the version (atom:updated), if present. */
  updatedAt?: string;
  /** Feed title, e.g. 'Version List of ZCL_X (CLAS)', if present. */
  title?: string;
  /** Opaque, complete URI to fetch this version's source (atom:content@src). */
  contentUri: string;
}
```

- [ ] **Step 3: Add the two methods to `IAdtObject<TConfig, TReadResult>`**

Inside the interface body, after the existing members:
```ts
  /**
   * List the version history of this object's source. Identity is passed per
   * call (the implementations are stateless factories) — e.g.
   * `getVersions({ className: 'ZCL_X' })`.
   * @throws AdtOperationError(UNSUPPORTED_OPERATION) when the object has no
   *         version resource (SAP 404/406, or a non-source object type).
   *         Never leaks raw HTTP.
   */
  getVersions(config: Partial<TConfig>): Promise<IObjectVersion[]>;

  /**
   * Fetch the source code of a specific version.
   * @param contentUri the opaque, complete `contentUri` from a getVersions() entry.
   */
  getVersionSource(contentUri: string): Promise<string>;
```

- [ ] **Step 4: Export `IObjectVersion` from the package root**

`interfaces/src/index.ts` uses a **selective** export for this module
(`export type { IAdtObject, IAdtOperationOptions } from './adt/IAdtObject';` on
line 87) — `export *` is NOT used, so a new type is not re-exported
automatically. `AdtObjectErrorCodes` is already re-exported (line 88), so
`UNSUPPORTED_OPERATION` needs no change. Add `IObjectVersion` to the type export:
```ts
export type {
  IAdtObject,
  IAdtOperationOptions,
  IObjectVersion,
} from './adt/IAdtObject';
```

- [ ] **Step 5: Build interfaces**

Run: `cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run build`
Expected: clean compile. Confirm the root export resolves:
`node -e "const i=require('./dist/index.js'); console.log(i.AdtObjectErrorCodes.UNSUPPORTED_OPERATION)"` → prints `ADT_UNSUPPORTED_OPERATION`.

- [ ] **Step 6: Commit (interfaces repo)**

```bash
git add src/adt/IAdtObject.ts src/index.ts
git commit -m "feat!: add IObjectVersion + getVersions/getVersionSource to IAdtObject (UNSUPPORTED_OPERATION)"
```

This is a **breaking** (major) change — required methods added to an exported interface. Version bump is done at release time on explicit request.

### Task 1.2: Bridge the interfaces change into adt-clients (dependency update)

adt-clients currently depends on `@mcp-abap-adt/interfaces` **`^7.3.0`**, which does NOT contain `IObjectVersion` or `AdtObjectErrorCodes.UNSUPPORTED_OPERATION`. Phase 2 imports them, so the dependency must be updated first. This is an explicit, executable step — not an assumption.

**Files:**
- Modify: `adt-clients/package.json` (interfaces dep), `adt-clients/package-lock.json`

- [ ] **Step 1: Make the new interfaces build available locally**

From the interfaces repo (already built in Task 1.1):
```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
npm pack            # produces mcp-abap-adt-interfaces-<version>.tgz
```
Note the tarball path. (For the real release the user publishes the interfaces **major** to npm instead; the local tarball is only to develop/iterate before that publish.)

- [ ] **Step 2: Install the tarball into adt-clients**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
npm install /home/okyslytsia/prj/mcp-abap-adt-interfaces/mcp-abap-adt-interfaces-<version>.tgz
```

- [ ] **Step 3: Verify the new exports resolve and the lockfile is clean**

```bash
node -e "const i=require('@mcp-abap-adt/interfaces'); if(!i.AdtObjectErrorCodes.UNSUPPORTED_OPERATION) throw new Error('missing'); console.log('ok')"
grep -c '"link": true' package-lock.json   # must be 0
```
Expected: `ok`, and `0` link entries.

- [ ] **Step 4: Commit the dependency bump**

```bash
git add package.json package-lock.json
git commit -m "build(deps): bump @mcp-abap-adt/interfaces for IObjectVersion + UNSUPPORTED_OPERATION"
```

> **Release note:** at release, repoint `package.json` to the **published** interfaces major version (not the tarball) and re-run Step 3's link check; the tarball/file dependency must NOT ship in the released `package-lock.json`.

---

## Phase 2 — shared pure helpers (adt-clients)

### Task 2.1: `parseVersionsFeed` and `throwUnsupportedVersions`

**Files:**
- Create: `adt-clients/src/core/shared/versions.ts`
- Test: `adt-clients/src/__tests__/unit/versionsParse.test.ts`

**Interfaces:**
- Consumes: `IObjectVersion`, `AdtOperationError`, `AdtObjectErrorCodes` from `@mcp-abap-adt/interfaces` — available only after Task 1.2 (dependency bridge).
- Produces: `parseVersionsFeed(xml: string): IObjectVersion[]`; `throwUnsupportedVersions(detail?: string): never`; `throwVersionsError(error: unknown, detail: string): never`.

- [ ] **Step 1: Write the failing test**

```ts
// adt-clients/src/__tests__/unit/versionsParse.test.ts
import {
  parseVersionsFeed,
  throwUnsupportedVersions,
} from '../../core/shared/versions';

const FEED = `<?xml version="1.0" encoding="utf-8"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:adtcore="http://www.sap.com/adt/core"><atom:title>Version List of ZAC_SHR_BTABL (TABL)</atom:title><atom:entry><atom:author><atom:name>CB9980008038</atom:name></atom:author><atom:content type="text/plain" src="/sap/bc/adt/ddic/tables/zac_shr_btabl/source/main/versions/19700101101123/00000/content"/><atom:id>00000</atom:id><atom:updated>2026-06-14T16:25:57Z</atom:updated></atom:entry></atom:feed>`;

const EMPTY = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Version List of X</atom:title></atom:feed>`;

describe('parseVersionsFeed', () => {
  it('parses a single-entry feed', () => {
    const v = parseVersionsFeed(FEED);
    expect(v).toHaveLength(1);
    expect(v[0]).toEqual({
      versionId: '00000',
      author: 'CB9980008038',
      updatedAt: '2026-06-14T16:25:57Z',
      title: 'Version List of ZAC_SHR_BTABL (TABL)',
      contentUri:
        '/sap/bc/adt/ddic/tables/zac_shr_btabl/source/main/versions/19700101101123/00000/content',
    });
  });

  it('returns [] for a feed with no entries', () => {
    expect(parseVersionsFeed(EMPTY)).toEqual([]);
  });
});

describe('throwUnsupportedVersions', () => {
  it('throws AdtOperationError with UNSUPPORTED_OPERATION', () => {
    expect(() => throwUnsupportedVersions('ZPACK')).toThrow();
    try {
      throwUnsupportedVersions('ZPACK');
    } catch (e: any) {
      expect(e.code).toBe('ADT_UNSUPPORTED_OPERATION');
    }
  });
});

describe('throwVersionsError', () => {
  it('maps 404/406 to UNSUPPORTED_OPERATION', () => {
    for (const status of [404, 406]) {
      try {
        throwVersionsError({ response: { status } }, 'ZT');
      } catch (e: any) {
        expect(e.code).toBe('ADT_UNSUPPORTED_OPERATION');
      }
    }
  });

  it('wraps any other failure in AdtOperationError (status + originalError, no raw axios)', () => {
    const original = { response: { status: 500 }, message: 'boom' };
    try {
      throwVersionsError(original, 'ZT');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AdtOperationError); // not the raw object
      expect(e.code).toBeUndefined(); // 500 is not "unsupported"
      expect(e.status).toBe(500);
      expect(e.originalError).toBe(original);
    }
  });
});
```

(Add `AdtOperationError` to the test's imports: `import { AdtOperationError } from '@mcp-abap-adt/interfaces';`.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/okyslytsia/prj/mcp-abap-adt-clients && SAP_URL= npx jest src/__tests__/unit/versionsParse.test.ts`
Expected: FAIL — module `../../core/shared/versions` not found.

- [ ] **Step 3: Implement the helpers**

```ts
// adt-clients/src/core/shared/versions.ts
import {
  AdtObjectErrorCodes,
  AdtOperationError,
  type IObjectVersion,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

/** Parse an ADT versions Atom feed into a list of versions. Pure — no endpoints. */
export function parseVersionsFeed(xml: string): IObjectVersion[] {
  const root = parser.parse(xml) as Record<string, any>;
  const feed = root['atom:feed'] ?? root.feed;
  if (!feed) return [];
  const title = feed['atom:title'] ?? feed.title;
  const rawEntries = feed['atom:entry'] ?? feed.entry;
  const entries = Array.isArray(rawEntries)
    ? rawEntries
    : rawEntries
      ? [rawEntries]
      : [];
  return entries.map((e: Record<string, any>) => {
    const content = e['atom:content'] ?? e.content ?? {};
    const author = e['atom:author'] ?? e.author;
    return {
      versionId: String(e['atom:id'] ?? e.id ?? ''),
      author: author
        ? String(author['atom:name'] ?? author.name ?? '') || undefined
        : undefined,
      updatedAt: (e['atom:updated'] ?? e.updated)
        ? String(e['atom:updated'] ?? e.updated)
        : undefined,
      title: title ? String(title) : undefined,
      contentUri: String(content['@_src'] ?? ''),
    };
  });
}

/** Throw a typed "no version history" error. Used by non-source types and by
 *  source types when SAP reports the versions resource is absent (404/406). */
export function throwUnsupportedVersions(detail?: string): never {
  const e = new AdtOperationError(
    `Version history is not available${detail ? ` for ${detail}` : ''}`,
  );
  e.code = AdtObjectErrorCodes.UNSUPPORTED_OPERATION;
  throw e;
}

/** Translate ANY version-request failure into an interface-level error so no
 *  raw IAdtResponse/axios object ever leaks outward. 404/406 → unsupported;
 *  everything else → AdtOperationError carrying status + originalError.
 *  Call this from the catch of every version list/content GET. */
export function throwVersionsError(error: unknown, detail: string): never {
  const status = (error as any)?.response?.status ?? (error as any)?.status;
  if (status === 404 || status === 406) {
    throwUnsupportedVersions(detail);
  }
  const e = new AdtOperationError(`Failed to read version history for ${detail}`);
  if (typeof status === 'number') e.status = status;
  e.originalError = error;
  throw e;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `SAP_URL= npx jest src/__tests__/unit/versionsParse.test.ts`
Expected: PASS (parse: 2, throwUnsupportedVersions: 1, throwVersionsError: 2).

- [ ] **Step 5: Commit**

```bash
git add src/core/shared/versions.ts src/__tests__/unit/versionsParse.test.ts
git commit -m "feat(versions): shared parseVersionsFeed + throwUnsupportedVersions + throwVersionsError helpers"
```

---

## Phase 3 — first source type: table (verified URI)

### Task 3.1: `AdtTable.getVersions` / `getVersionSource`

**Files:**
- Create: `adt-clients/src/core/table/versions.ts`
- Modify: `adt-clients/src/core/table/AdtTable.ts` (add the two methods)
- Test: `adt-clients/src/__tests__/unit/tableVersions.test.ts`

**Interfaces:**
- Consumes: `parseVersionsFeed`, `throwVersionsError` (Task 2.1); `encodeSapObjectName` (`src/utils/internalUtils`); `getTimeout` (`src/utils/timeouts`).
- Produces: `getTableVersions(connection, config)`, `getTableVersionSource(connection, contentUri)`; `AdtTable.getVersions`, `AdtTable.getVersionSource`.

- [ ] **Step 1: Write the failing unit test (fake connection)**

```ts
// adt-clients/src/__tests__/unit/tableVersions.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import {
  getTableVersionSource,
  getTableVersions,
} from '../../core/table/versions';

const FEED = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Version List of ZT (TABL)</atom:title><atom:entry><atom:content type="text/plain" src="/sap/bc/adt/ddic/tables/zt/source/main/versions/1/00000/content"/><atom:id>00000</atom:id></atom:entry></atom:feed>`;

function conn(handler: (o: any) => Promise<IAdtResponse>): IAbapConnection {
  return { makeAdtRequest: handler } as unknown as IAbapConnection;
}

describe('getTableVersions', () => {
  it('GETs the source/main/versions URI with the atom-feed Accept and parses it', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return { data: FEED, status: 200, headers: {} } as IAdtResponse;
    });
    const list = await getTableVersions(c, { tableName: 'ZT' });
    expect(seen.url).toBe('/sap/bc/adt/ddic/tables/ZT/source/main/versions');
    expect(seen.headers.Accept).toContain('application/atom+xml;type=feed');
    expect(list).toHaveLength(1);
    expect(list[0].contentUri).toContain('/00000/content');
  });

  it('translates a 404 into UNSUPPORTED_OPERATION (no raw HTTP outward)', async () => {
    const c = conn(async () => {
      const err: any = new Error('not found');
      err.response = { status: 404 };
      throw err;
    });
    await expect(getTableVersions(c, { tableName: 'ZT' })).rejects.toMatchObject({
      code: 'ADT_UNSUPPORTED_OPERATION',
    });
  });
});

describe('getTableVersionSource', () => {
  it('GETs the opaque contentUri as text/plain', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return { data: 'DEFINE TABLE zt ...', status: 200, headers: {} } as IAdtResponse;
    });
    const src = await getTableVersionSource(c, '/sap/bc/adt/x/00000/content');
    expect(seen.url).toBe('/sap/bc/adt/x/00000/content');
    expect(seen.headers.Accept).toBe('text/plain');
    expect(src).toContain('DEFINE TABLE');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `SAP_URL= npx jest src/__tests__/unit/tableVersions.test.ts`
Expected: FAIL — `../../core/table/versions` not found.

- [ ] **Step 3: Implement `src/core/table/versions.ts`**

```ts
import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { ITableConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

export async function getTableVersions(
  connection: IAbapConnection,
  config: Partial<ITableConfig>,
): Promise<IObjectVersion[]> {
  if (!config.tableName) throw new Error('tableName is required');
  const url = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(config.tableName)}/source/main/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `table ${config.tableName}`);
  }
}

export async function getTableVersionSource(
  connection: IAbapConnection,
  contentUri: string,
): Promise<string> {
  try {
    const res = await connection.makeAdtRequest({
      url: contentUri,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: 'text/plain' },
    });
    return String(res.data);
  } catch (e) {
    throwVersionsError(e, 'version content');
  }
}
```

- [ ] **Step 4: Wire the methods into `AdtTable`**

In `src/core/table/AdtTable.ts`, add the imports and the two methods (delegating):
```ts
import { getTableVersions, getTableVersionSource } from './versions';
// …inside class AdtTable…
getVersions(config: Partial<ITableConfig>) {
  return getTableVersions(this.connection, config);
}
getVersionSource(contentUri: string) {
  return getTableVersionSource(this.connection, contentUri);
}
```

- [ ] **Step 5: Run unit tests + build**

Run: `SAP_URL= npx jest src/__tests__/unit/tableVersions.test.ts && npm run build`
Expected: PASS; build clean (AdtTable now satisfies the new `IAdtObject` members).

- [ ] **Step 6: Commit**

```bash
git add src/core/table/versions.ts src/core/table/AdtTable.ts src/__tests__/unit/tableVersions.test.ts
git commit -m "feat(versions): AdtTable.getVersions/getVersionSource (source/main/versions)"
```

### Task 3.2: Integration smoke for table versions (trial-gated)

**Files:**
- Test: `adt-clients/src/__tests__/integration/core/table/tableVersions.test.ts`

- [ ] **Step 1: Write the integration test** (mirrors `whereUsed.test.ts` setup: `getConfig`, `createAbapConnection`, `createTestAdtClient`). Use shared table `ZAC_SHR_BTABL`. Assert `getVersions({ tableName })` returns ≥1 entry with a `contentUri`, then `getVersionSource(contentUri)` returns a non-empty string. Self-skip when `hasConfig` is false (no `.env`).

- [ ] **Step 2: Run (only on request; needs trial browser profile up)**

Run: `cp trial.env .env && DEBUG_ADT_TESTS=true npm test -- integration/core/table/tableVersions 2>&1 | tee test-run.log`
Expected: PASS — list non-empty, source non-empty. (forceExit may truncate trailing logs — write counts to a scratch file if you need hard evidence.)

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/core/table/tableVersions.test.ts
git commit -m "test(versions): integration smoke for AdtTable versions on trial"
```

---

## Phase 4 — class + local includes (verified URI; includes nuance)

### Task 4.1: `AdtClass.getVersions` (main include) + local-include handlers

**Files:**
- Create: `adt-clients/src/core/class/versions.ts`
- Modify: `adt-clients/src/core/class/AdtClass.ts` and the local-include `AdtXxx` classes returned by `getLocalTypes()` / `getLocalDefinitions()` / `getLocalTestClass()` / `getLocalMacros()`
- Test: `adt-clients/src/__tests__/unit/classVersions.test.ts`

**Interfaces:**
- Produces: `getClassIncludeVersions(connection, className, includeType)`, reusing the shared helpers; `AdtClass.getVersions` (uses `includeType='main'`); each local-include handler's `getVersions` (uses its own `includeType`).

- [ ] **Step 1: Write the failing unit test**

```ts
// adt-clients/src/__tests__/unit/classVersions.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { getClassIncludeVersions } from '../../core/class/versions';

const FEED = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Version List of ZCL=CCIMP (CINC)</atom:title><atom:entry><atom:content type="text/plain" src="/x/00000/content"/><atom:id>00000</atom:id></atom:entry></atom:feed>`;

function conn(h: (o: any) => Promise<IAdtResponse>): IAbapConnection {
  return { makeAdtRequest: h } as unknown as IAbapConnection;
}

describe('getClassIncludeVersions', () => {
  it('builds includes/{includeType}/versions (NOT source/main)', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return { data: FEED, status: 200, headers: {} } as IAdtResponse;
    });
    await getClassIncludeVersions(c, 'ZCL', 'implementations');
    expect(seen.url).toBe(
      '/sap/bc/adt/oo/classes/ZCL/includes/implementations/versions',
    );
    expect(seen.headers.Accept).toContain('application/atom+xml;type=feed');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `SAP_URL= npx jest src/__tests__/unit/classVersions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/class/versions.ts`**

```ts
import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

export type ClassIncludeType =
  | 'main'
  | 'definitions'
  | 'implementations'
  | 'testclasses'
  | 'macros';

export async function getClassIncludeVersions(
  connection: IAbapConnection,
  className: string,
  includeType: ClassIncludeType,
): Promise<IObjectVersion[]> {
  if (!className) throw new Error('className is required');
  const url = `/sap/bc/adt/oo/classes/${encodeSapObjectName(className)}/includes/${includeType}/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `class ${className} (${includeType})`);
  }
}

export async function getClassVersionSource(
  connection: IAbapConnection,
  contentUri: string,
): Promise<string> {
  try {
    const res = await connection.makeAdtRequest({
      url: contentUri,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: 'text/plain' },
    });
    return String(res.data);
  } catch (e) {
    throwVersionsError(e, 'version content');
  }
}
```

- [ ] **Step 4: Wire into `AdtClass` and the local-include handlers**

`AdtClass.getVersions(config)` → `getClassIncludeVersions(this.connection, config.className!, 'main')`; `getVersionSource` → `getClassVersionSource`.

The local-include accessor → `includeType` mapping is **verified against the code** (each `AdtLocalXxx.read()` calls the matching `getClass*Include`), so use exactly:

| Accessor | Class | reads include | `includeType` |
|---|---|---|---|
| `getLocalDefinitions()` | `AdtLocalDefinitions` | `getClassDefinitionsInclude` | `'definitions'` (CCDEF) |
| `getLocalTypes()` | `AdtLocalTypes` | `getClassImplementationsInclude` | **`'implementations'`** (CCIMP) |
| `getLocalTestClass()` | `AdtLocalTestClass` | (testclasses) | `'testclasses'` (CCAU) |
| `getLocalMacros()` | `AdtLocalMacros` | `getClassMacrosInclude` | `'macros'` — **UNVERIFIED** (see below) |

Add `getVersions`/`getVersionSource` to each of `AdtLocalDefinitions`, `AdtLocalTypes`, `AdtLocalTestClass`, `AdtLocalMacros` (in `src/core/class/AdtLocal*.ts`), each passing its own `includeType` per the table.

**Macros caveat:** `includes/macros/versions` was NOT probe-verified (only main/definitions/implementations/testclasses were). In this step, **probe** `/sap/bc/adt/oo/classes/zac_shr_dmp01/includes/macros/versions` (Accept `application/atom+xml;type=feed`) on trial:
- if 200 → `AdtLocalMacros.getVersions` uses `getClassIncludeVersions(..., 'macros')` like the others;
- if 404/406 → `AdtLocalMacros.getVersions` instead calls `throwUnsupportedVersions('class macros')` (non-source pattern). Record which path was taken.

- [ ] **Step 5: Run unit tests + build**

Run: `SAP_URL= npx jest src/__tests__/unit/classVersions.test.ts && npm run build`
Expected: PASS; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/class/versions.ts src/core/class/*.ts src/__tests__/unit/classVersions.test.ts
git commit -m "feat(versions): AdtClass + local includes versions (includes/{type}/versions)"
```

### Task 4.2: Integration smoke for class versions (trial-gated)

- [ ] Mirror Task 3.2 against shared class `ZAC_SHR_DMP01`: `getVersions({ className })` (main) returns ≥1 entry; `getVersionSource` returns source containing `CLASS zac_shr_dmp01`. Run only on request (trial browser up). Commit.

---

## Phase 5 — roll out to the remaining source types (probe-verify each)

### Task 5.1: One source type per sub-step, probe-verified before claiming support

For each remaining source-bearing type, repeat the Task 3.1 pattern in its own `src/core/{type}/versions.ts` + `AdtXxx` methods + unit test, **after** confirming its version URI by probe. Candidate URIs (MUST be probe-verified before marking supported):

| Type | `AdtXxx` | Candidate version-list URI |
|---|---|---|
| program | `AdtProgram` | `/sap/bc/adt/programs/programs/{name}/source/main/versions` |
| interface | `AdtInterface` | `/sap/bc/adt/oo/interfaces/{name}/source/main/versions` |
| function module | `AdtFunctionModule` | `/sap/bc/adt/functions/groups/{group}/fmodules/{name}/source/main/versions` |
| ddl / CDS | `AdtDdl` | `/sap/bc/adt/ddic/ddl/sources/{name}/source/main/versions` |
| structure | `AdtStructure` | `/sap/bc/adt/ddic/structures/{name}/source/main/versions` |

There is **no generic catch-all row**: every type ships its own exact, probed URI. A type not in this table is not in scope for Phase 5 — add it explicitly with its probed URI, or treat it as non-source in Phase 6.

- [ ] **Per type, Step A: probe** the candidate URI on trial (a throwaway probe like the ones in the spec's findings — GET with `Accept: application/atom+xml;type=feed`). If 200 → supported, **record the exact probed URI** in the type's `versions.ts`; if 404/406 → it is NOT a `source/main/versions` type (treat as non-source in Phase 6, or find its real shape by probing and record it).
- [ ] **Per type, Step B:** implement `{type}/versions.ts` + `AdtXxx` methods + unit test mirroring Task 3.1 (fake-connection: asserts the verified URL + Accept + parse; 404 → `UNSUPPORTED_OPERATION`).
- [ ] **Per type, Step C:** `SAP_URL= npx jest src/__tests__/unit/{type}Versions.test.ts && npm run build`; commit `feat(versions): Adt{Type} versions`.

`log()`/note any type dropped to "unsupported" because its probe returned 404 — do not silently claim support.

---

## Phase 6 — non-source types: explicit unsupported

### Task 6.1: `throwUnsupportedVersions` on non-source `AdtXxx`

**Files:**
- Modify: the non-source `AdtXxx` (e.g. `AdtPackage`, `AdtTransport`, unit-test object, and any other type whose Phase-5 probe returned 404) and any test-only `IAdtObject` implementations in `src/__tests__/`.

**Interfaces:**
- Consumes: `throwUnsupportedVersions` (Task 2.1).

- [ ] **Step 1: Write the failing unit test**

```ts
// adt-clients/src/__tests__/unit/packageVersions.test.ts
import { AdtPackage } from '../../core/package/AdtPackage';
import { noopLogger } from '../../utils/noopLogger';

describe('AdtPackage versions (unsupported)', () => {
  const pkg = new AdtPackage({ makeAdtRequest: jest.fn() } as any, noopLogger);
  it('getVersions throws UNSUPPORTED_OPERATION without any HTTP call', async () => {
    await expect(pkg.getVersions({ packageName: 'ZP' })).rejects.toMatchObject({
      code: 'ADT_UNSUPPORTED_OPERATION',
    });
  });
});
```
(Adjust the `AdtPackage` constructor call to match its real signature.)

- [ ] **Step 2: Run to verify it fails**

Run: `SAP_URL= npx jest src/__tests__/unit/packageVersions.test.ts`
Expected: FAIL — `getVersions` not implemented on `AdtPackage`.

- [ ] **Step 3: Implement on each non-source `AdtXxx`**

The methods MUST be `async` so the throw becomes a **rejected promise** (the
interface returns `Promise<…>`, and the unit test uses `.rejects`). A
synchronous `return throwUnsupportedVersions(...)` would throw before a promise
is returned and break `.rejects`.
```ts
import { throwUnsupportedVersions } from '../shared/versions';
// …inside the class…
async getVersions(_config: Partial<IPackageConfig>): Promise<IObjectVersion[]> {
  throwUnsupportedVersions('package'); // throws; in an async fn → rejected promise
}
async getVersionSource(_contentUri: string): Promise<string> {
  throwUnsupportedVersions('package');
}
```
(`throwUnsupportedVersions` is typed `: never`, so no `return` is needed and TS
accepts the `async` method's return type. Import `IObjectVersion` from
`@mcp-abap-adt/interfaces` for the annotation.)

- [ ] **Step 4: Run unit tests + build**

Run: `SAP_URL= npx jest src/__tests__/unit/packageVersions.test.ts && npm run build`
Expected: PASS; build clean — ALL `AdtXxx` now satisfy `IAdtObject`.

- [ ] **Step 5: Commit**

```bash
git add src/core/**/Adt*.ts src/__tests__/unit/packageVersions.test.ts
git commit -m "feat(versions): non-source types throw UNSUPPORTED_OPERATION"
```

---

## Phase 7 — finalize

### Task 7.1: Full build + unit suite + docs

- [ ] **Step 1:** `npm run build && SAP_URL= npx jest src/__tests__/unit` — all green; every `AdtXxx` compiles against the new `IAdtObject`.
- [ ] **Step 2 (MANDATORY — normalize the interfaces dependency):** Task 1.2 installed a **local tarball/file** dependency for development. Before any release/final commit it MUST be replaced with the **published** interfaces major. After the user publishes interfaces:
  ```bash
  # set the published major in package.json (e.g. "^8.0.0"), then:
  npm install --package-lock-only
  grep -nE '"@mcp-abap-adt/interfaces".*(file:|\.tgz)' package-lock.json   # must be EMPTY
  grep -c '"link": true' package-lock.json                                # must be 0
  ```
  Expected: no `file:`/`.tgz` reference to interfaces remains, `0` link entries. Commit `package.json` + `package-lock.json`. The build (`npm run build`) must still pass against the registry version. Do NOT proceed to release while a tarball/file dependency is present.
- [ ] **Step 3:** Add a short `getVersions`/`getVersionSource` example to `docs/usage/CLIENT_API_REFERENCE.md` (list + fetch source), matching the where-used example style.
- [ ] **Step 4:** Update `CHANGELOG.md` only on explicit user request, noting the interfaces **major** (added required `IAdtObject` methods) and adt-clients support.
- [ ] **Step 5:** Delete the spec and this plan file once implemented (history lives in git), per repo convention.
- [ ] **Step 6:** Commit.

---

## Self-Review Notes

- **Spec coverage:** contract (Task 1.1) ✓; shared pure helpers only (Task 2.1) ✓; per-impl URI ownership + source pattern (Tasks 3,4,5) ✓; non-source explicit pattern (Task 6) ✓; error translation 404/406 → `UNSUPPORTED_OPERATION`, no raw HTTP (Tasks 2,3,4,6) ✓; `getVersions(config)` identity-per-call (Task 1.1) ✓; probe-verify-before-support (Task 5) ✓; interfaces MAJOR (Task 1.1) ✓; consumer untouched ✓.
- **Type consistency:** `parseVersionsFeed` / `throwUnsupportedVersions` / `throwVersionsError` names used identically across Tasks 2–6; source-type list+content GETs both wrap via `throwVersionsError` (no raw HTTP outward); `getVersions(config: Partial<TConfig>)` / `getVersionSource(contentUri: string)` consistent with the spec contract; `UNSUPPORTED_OPERATION` = `'ADT_UNSUPPORTED_OPERATION'` consistent.
- **Probe caveat honored:** Phase 5 forbids claiming support for any type before its URI is probe-verified.
