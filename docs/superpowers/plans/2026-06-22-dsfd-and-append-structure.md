# ScalarFunction (DSFD/SCF) + AppendStructure (TABL/DS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new source-based DDIC CRUD clients — `AdtClient.getScalarFunction()` (CDS scalar
functions, `DSFD/SCF`) and `AdtClient.getAppendStructure()` (append structures, `TABL/DS`).

**Architecture:** Each is a self-contained core module mirroring `src/core/serviceDefinition/`
(metadata-only create via a `blue:blueSource` envelope, source edited via `/source/main`, full
lock → check → update → unlock → activate lifecycle). Both share two small foundations: a shared
XML-attribute escape helper and `checkRun` object-type mappings.

**Tech Stack:** TypeScript (strict, CommonJS), `fast-xml-parser`, Jest (`ts-jest`, `--runInBand`),
Biome. Depends only on `@mcp-abap-adt/interfaces` types and the existing connection abstraction.

## Specs

- `docs/superpowers/specs/2026-06-22-scalar-function-dsfd-design.md`
- `docs/superpowers/specs/2026-06-22-append-structure-design.md`

## Global Constraints

- All code, comments, error messages in **English**.
- Biome style: **single quotes, semicolons always, 2-space indent**. Run `npm run lint` before each commit.
- Do **not** change `package.json` version. Do not add dependencies.
- `noExplicitAny: warn` in production code (avoid `any`; use the `IAdtResponse`/`HttpError` types).
- Names are **lower-cased + `encodeSapObjectName`-encoded in URL paths**, but **upper-cased in the create XML envelope** (object identifiers: name, base, package).
- `corrNr` and `lockHandle` are **always `encodeURIComponent`-encoded** in URLs.
- All create-envelope attribute values are **XML-escaped** via the shared `escapeXmlAttr` (Task 1).
- Validation fallback is **narrow**: only HTTP **404 / 405 / 501** mean "unsupported"; every other error propagates.
- Session reset (`setSessionType('stateless')`) on the update-cleanup path and public `unlock()` is in a **`finally`**.
- Build/lint/test gate before every commit: `npm run build:fast && npm run lint:check`. Unit tests: `npx jest src/__tests__/unit/<area> --runInBand`.

## Reference implementations (read these once before starting)

- `src/core/serviceDefinition/` — the canonical source-based module (create/read/update/lock/unlock/check/activation/validation/delete + `AdtServiceDefinition.ts` handler). **Both new modules are structural copies of it**, differing only in URL base, envelope, and `adtcore:type`.
- `src/core/structure/create.ts` — confirms the append `blue:blueSource` + `TABL/DS` envelope and headers.
- `src/utils/checkRun.ts` — `getObjectUri()` switch (Task 2).
- `src/constants/contentTypes.ts` — content-type constants (Task 2).

## File Structure

**Foundation**
- Create `src/utils/xml.ts` — shared `escapeXmlAttr`.
- Modify `src/utils/checkRun.ts` — add 4 object-type cases.
- Modify `src/constants/contentTypes.ts` — add scalar-function + append-structure media types.

**Module A — `src/core/scalarFunction/`** (`AdtScalarFunction.ts`, `types.ts`, `create.ts`, `read.ts`, `update.ts`, `lock.ts`, `unlock.ts`, `check.ts`, `activation.ts`, `validation.ts`, `delete.ts`, `index.ts`)

**Module B — `src/core/appendStructure/`** (same file set, `AdtAppendStructure.ts` …)

**Wiring** — `src/clients/AdtClient.ts`, `src/index.ts`.

**Tests** — `src/__tests__/unit/core/scalarFunction/`, `src/__tests__/unit/core/appendStructure/`, `src/__tests__/integration/core/scalarFunction/`, `src/__tests__/integration/core/appendStructure/`, `src/__tests__/helpers/test-config.yaml.template`.

---

## Task 1: Shared XML-attribute escape helper

**Files:**
- Create: `src/utils/xml.ts`
- Test: `src/__tests__/unit/utils/xml.test.ts`

**Interfaces:**
- Produces: `escapeXmlAttr(value: string): string` — escapes `& < > " '` for safe XML attribute interpolation.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/utils/xml.test.ts
import { escapeXmlAttr } from '../../../utils/xml';

describe('escapeXmlAttr', () => {
  it('escapes all five XML attribute metacharacters', () => {
    expect(escapeXmlAttr(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeXmlAttr('ZOK_TEST_FUNC')).toBe('ZOK_TEST_FUNC');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/utils/xml.test.ts --runInBand`
Expected: FAIL — `Cannot find module '../../../utils/xml'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/xml.ts
/**
 * Escape a value for safe interpolation into an XML attribute.
 * Covers all five attribute metacharacters (the existing per-module
 * escapers omit the apostrophe; this shared helper does not).
 */
export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/unit/utils/xml.test.ts --runInBand`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/xml.ts src/__tests__/unit/utils/xml.test.ts
git commit -m "feat(utils): add shared escapeXmlAttr helper"
```

---

## Task 2: checkRun object-type mappings + content-type constants

**Files:**
- Modify: `src/utils/checkRun.ts` (the `getObjectUri` switch, around lines 76-84)
- Modify: `src/constants/contentTypes.ts`
- Test: `src/__tests__/unit/utils/checkRunObjectUri.test.ts`

**Interfaces:**
- Produces: `getObjectUri('scalar_function' | 'dsfd/scf', name)` → `/sap/bc/adt/ddic/dsfd/sources/{lower}`; `getObjectUri('append_structure' | 'tabl/ds', name)` → `/sap/bc/adt/ddic/structures/{lower}`.
- Produces: constants `CT_SCALAR_FUNCTION`, `ACCEPT_SCALAR_FUNCTION`, `ACCEPT_APPEND_STRUCTURE` (reuse `CT_STRUCTURE` for append create).

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/utils/checkRunObjectUri.test.ts
import { getObjectUri } from '../../../utils/checkRun';

describe('getObjectUri — new DDIC source types', () => {
  it('maps scalar_function and dsfd/scf to the dsfd sources path', () => {
    expect(getObjectUri('scalar_function', 'ZOK_TEST_FUNC')).toBe(
      '/sap/bc/adt/ddic/dsfd/sources/zok_test_func',
    );
    expect(getObjectUri('dsfd/scf', 'ZOK_TEST_FUNC')).toBe(
      '/sap/bc/adt/ddic/dsfd/sources/zok_test_func',
    );
  });

  it('maps append_structure and tabl/ds to the structures path', () => {
    expect(getObjectUri('append_structure', 'ZOK_S_APPEND')).toBe(
      '/sap/bc/adt/ddic/structures/zok_s_append',
    );
    expect(getObjectUri('tabl/ds', 'ZOK_S_APPEND')).toBe(
      '/sap/bc/adt/ddic/structures/zok_s_append',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/utils/checkRunObjectUri.test.ts --runInBand`
Expected: FAIL — throws `Unsupported object type: scalar_function`.

- [ ] **Step 3: Add the switch cases**

In `src/utils/checkRun.ts`, inside `getObjectUri`, add immediately after the `service_definition` case (before `access_control`):

```typescript
    case 'scalar_function':
    case 'dsfd/scf':
      return `/sap/bc/adt/ddic/dsfd/sources/${encodedName}`;
    case 'append_structure':
    case 'tabl/ds':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
```

- [ ] **Step 4: Add content-type constants**

In `src/constants/contentTypes.ts`, after the `CT_VIEW` block, add:

```typescript
// Scalar Functions (CDS DSFD/SCF) — uses the shared blues envelope
export const ACCEPT_SCALAR_FUNCTION = 'application/vnd.sap.adt.blues.v1+xml';
export const CT_SCALAR_FUNCTION = 'application/vnd.sap.adt.blues.v1+xml';

// Append Structures (TABL/DS) — blues envelope, structures media type for create
export const ACCEPT_APPEND_STRUCTURE =
  'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/unit/utils/checkRunObjectUri.test.ts --runInBand`
Expected: PASS (2 tests).

- [ ] **Step 6: Build + lint + commit**

```bash
npm run build:fast && npm run lint:check
git add src/utils/checkRun.ts src/constants/contentTypes.ts src/__tests__/unit/utils/checkRunObjectUri.test.ts
git commit -m "feat(checkRun,contentTypes): map scalar_function + append_structure object types"
```

---

## Task 3: ScalarFunction types + low-level create

**Files:**
- Create: `src/core/scalarFunction/types.ts`, `src/core/scalarFunction/create.ts`
- Test: `src/__tests__/unit/core/scalarFunction/create.test.ts`

**Interfaces:**
- Produces types: `ICreateScalarFunctionParams { scalar_function_name; description?; package_name; transport_request?; source_code?; masterSystem?; responsible?; masterLanguage? }`, `IUpdateScalarFunctionParams { scalar_function_name; source_code; transport_request? }`, `IDeleteScalarFunctionParams { scalar_function_name; transport_request? }`, `IScalarFunctionConfig { scalarFunctionName; masterLanguage?; packageName?; transportRequest?; description?; sourceCode? }`, `IScalarFunctionState extends IAdtObjectState { validationSupported?: boolean }`.
- Produces: `create(connection, params: ICreateScalarFunctionParams): Promise<IAdtResponse>` — POSTs the metadata-only `blue:blueSource` envelope (`adtcore:type="DSFD/SCF"`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/scalarFunction/create.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { create } from '../../../../core/scalarFunction/create';

function mockConn(capture: { url?: string; data?: string; headers?: Record<string, string> }) {
  return {
    makeAdtRequest: async (req: any): Promise<IAdtResponse> => {
      capture.url = req.url;
      capture.data = req.data;
      capture.headers = req.headers;
      return { status: 200, statusText: 'OK', headers: {}, data: '' } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
}

describe('scalarFunction create', () => {
  it('POSTs a blues envelope with DSFD/SCF type, upper-cased name/package, escaped description', async () => {
    const cap: { url?: string; data?: string; headers?: Record<string, string> } = {};
    await create(mockConn(cap), {
      scalar_function_name: 'zok_test_func',
      package_name: 'zok_test',
      description: 'A & B',
      masterSystem: 'TRL',
      responsible: 'CB9980008038',
    });

    expect(cap.url).toBe('/sap/bc/adt/ddic/dsfd/sources');
    expect(cap.headers?.['Content-Type']).toBe('application/vnd.sap.adt.blues.v1+xml');
    expect(cap.data).toContain('<blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue"');
    expect(cap.data).toContain('adtcore:type="DSFD/SCF"');
    expect(cap.data).toContain('adtcore:name="ZOK_TEST_FUNC"');
    expect(cap.data).toContain('adtcore:masterSystem="TRL"');
    expect(cap.data).toContain('adtcore:responsible="CB9980008038"');
    expect(cap.data).toContain('adtcore:description="A &amp; B"');
    expect(cap.data).toContain('<adtcore:packageRef adtcore:name="ZOK_TEST"/>');
  });

  it('appends encoded corrNr when a transport is supplied and omits masterSystem when absent', async () => {
    const cap: { url?: string; data?: string } = {};
    await create(mockConn(cap as any), {
      scalar_function_name: 'zok_f',
      package_name: 'zok_test',
      description: 'd',
      transport_request: 'TRLK9 00001',
    });
    expect(cap.url).toBe('/sap/bc/adt/ddic/dsfd/sources?corrNr=TRLK9%2000001');
    expect(cap.data).not.toContain('masterSystem');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/scalarFunction/create.test.ts --runInBand`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `types.ts`**

```typescript
// src/core/scalarFunction/types.ts
/**
 * ScalarFunction (CDS DSFD/SCF) module type definitions
 */
import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateScalarFunctionParams {
  scalar_function_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  source_code?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IUpdateScalarFunctionParams {
  scalar_function_name: string;
  source_code: string;
  transport_request?: string;
}

export interface IDeleteScalarFunctionParams {
  scalar_function_name: string;
  transport_request?: string;
}

// Handler configuration (camelCase)
export interface IScalarFunctionConfig {
  scalarFunctionName: string;
  masterLanguage?: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

export interface IScalarFunctionState extends IAdtObjectState {
  /** false only when the validation endpoint returned 404/405/501 (unsupported) */
  validationSupported?: boolean;
}
```

- [ ] **Step 4: Write `create.ts`**

```typescript
// src/core/scalarFunction/create.ts
/**
 * ScalarFunction create operations - Low-level functions
 * Metadata-only POST (no source upload). Use AdtScalarFunction.update() for source.
 */
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SCALAR_FUNCTION, CT_SCALAR_FUNCTION } from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateScalarFunctionParams } from './types';

export async function create(
  connection: IAbapConnection,
  args: ICreateScalarFunctionParams,
): Promise<AxiosResponse> {
  if (!args.scalar_function_name || !args.package_name) {
    throw new Error('Missing required parameters: scalar_function_name and package_name');
  }

  const transport = args.transport_request?.trim();
  const url = `/sap/bc/adt/ddic/dsfd/sources${
    transport ? `?corrNr=${encodeURIComponent(transport)}` : ''
  }`;

  const lang = args.masterLanguage || 'EN';
  const name = escapeXmlAttr(args.scalar_function_name.toUpperCase());
  const pkg = escapeXmlAttr(args.package_name.toUpperCase());
  const description = escapeXmlAttr(
    limitDescription(args.description || args.scalar_function_name),
  );
  const masterSystemAttr = args.masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(args.masterSystem)}"`
    : '';
  const responsibleAttr = args.responsible
    ? ` adtcore:responsible="${escapeXmlAttr(args.responsible)}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${name}" adtcore:type="DSFD/SCF" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${pkg}"/>
</blue:blueSource>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: { Accept: ACCEPT_SCALAR_FUNCTION, 'Content-Type': CT_SCALAR_FUNCTION },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/unit/core/scalarFunction/create.test.ts --runInBand`
Expected: PASS (2 tests).

- [ ] **Step 6: Build + lint + commit**

```bash
npm run build:fast && npm run lint:check
git add src/core/scalarFunction/types.ts src/core/scalarFunction/create.ts src/__tests__/unit/core/scalarFunction/create.test.ts
git commit -m "feat(scalarFunction): types + low-level create (DSFD/SCF blues envelope)"
```

---

## Task 4: ScalarFunction read / update / lock / unlock

**Files:**
- Create: `src/core/scalarFunction/read.ts`, `update.ts`, `lock.ts`, `unlock.ts`
- Test: `src/__tests__/unit/core/scalarFunction/wire.test.ts`

**Interfaces:**
- Consumes: `IUpdateScalarFunctionParams` (Task 3).
- Produces: `getScalarFunction(conn, name, version?, options?, logger?)`, `getScalarFunctionSource(conn, name, version?, options?, logger?)`, `getScalarFunctionTransport(conn, name, options?)`, `updateScalarFunction(conn, args, lockHandle)`, `lockScalarFunction(conn, name): Promise<string>`, `unlockScalarFunction(conn, name, lockHandle)`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/scalarFunction/wire.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { updateScalarFunction } from '../../../../core/scalarFunction/update';
import { getScalarFunctionSource } from '../../../../core/scalarFunction/read';
import { unlockScalarFunction } from '../../../../core/scalarFunction/unlock';

function cap() {
  const c: { url?: string; method?: string; headers?: Record<string, string>; data?: string } = {};
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      c.url = r.url; c.method = r.method; c.headers = r.headers; c.data = r.data;
      return { status: 200, statusText: 'OK', headers: {}, data: '' } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { c, conn };
}

describe('scalarFunction wire', () => {
  it('update PUTs source/main with encoded lockHandle + corrNr and text/plain content-type', async () => {
    const { c, conn } = cap();
    await updateScalarFunction(
      conn,
      { scalar_function_name: 'ZOK_TEST_FUNC', source_code: 'define scalar function ...', transport_request: 'TRLK9 1' },
      'LH/1',
    );
    expect(c.method).toBe('PUT');
    expect(c.url).toBe('/sap/bc/adt/ddic/dsfd/sources/zok_test_func/source/main?lockHandle=LH%2F1&corrNr=TRLK9%201');
    expect(c.headers?.['Content-Type']).toBe('text/plain; charset=utf-8');
  });

  it('read source GETs source/main with version and Accept text/plain', async () => {
    const { c, conn } = cap();
    await getScalarFunctionSource(conn, 'ZOK_TEST_FUNC', 'active');
    expect(c.method).toBe('GET');
    expect(c.url).toBe('/sap/bc/adt/ddic/dsfd/sources/zok_test_func/source/main?version=active');
    expect(c.headers?.Accept).toBe('text/plain');
  });

  it('unlock POSTs _action=UNLOCK with encoded lockHandle', async () => {
    const { c, conn } = cap();
    await unlockScalarFunction(conn, 'ZOK_TEST_FUNC', 'LH/1');
    expect(c.url).toBe('/sap/bc/adt/ddic/dsfd/sources/zok_test_func?_action=UNLOCK&lockHandle=LH%2F1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/scalarFunction/wire.test.ts --runInBand`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `read.ts`**

```typescript
// src/core/scalarFunction/read.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SCALAR_FUNCTION,
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
} from '../../constants/contentTypes';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

function buildQuery(version?: string, options?: IReadOptions): string {
  const q: string[] = [];
  if (version) q.push(`version=${version}`);
  if (options?.withLongPolling) q.push('withLongPolling=true');
  return q.length ? `?${q.join('&')}` : '';
}

export async function getScalarFunction(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encodeSapObjectName(name.toLowerCase())}${buildQuery(version, options)}`;
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    { url, method: 'GET', timeout: getTimeout('default'), headers: { Accept: options?.accept ?? ACCEPT_SCALAR_FUNCTION } },
    { logger },
  );
}

export async function getScalarFunctionSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encodeSapObjectName(name.toLowerCase())}/source/main${buildQuery(version, options)}`;
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    { url, method: 'GET', timeout: getTimeout('default'), headers: { Accept: options?.accept ?? ACCEPT_SOURCE } },
    { logger },
  );
}

export async function getScalarFunctionTransport(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encodeSapObjectName(name.toLowerCase())}/transport${query}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: options?.accept ?? ACCEPT_TRANSPORT },
  });
}
```

- [ ] **Step 4: Write `update.ts`**

```typescript
// src/core/scalarFunction/update.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateScalarFunctionParams } from './types';

export async function updateScalarFunction(
  connection: IAbapConnection,
  args: IUpdateScalarFunctionParams,
  lockHandle: string,
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(args.scalar_function_name.toLowerCase());
  const corrNrParam = args.transport_request
    ? `&corrNr=${encodeURIComponent(args.transport_request)}`
    : '';
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encoded}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers: { Accept: ACCEPT_SOURCE, 'Content-Type': CT_SOURCE },
  });
}
```

- [ ] **Step 5: Write `lock.ts`**

```typescript
// src/core/scalarFunction/lock.ts
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function lockScalarFunction(
  connection: IAbapConnection,
  name: string,
): Promise<string> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encoded}?_action=LOCK&accessMode=MODIFY`;
  const response = await connection.makeAdtRequest({
    method: 'POST',
    url,
    headers: { Accept: ACCEPT_LOCK },
    timeout: getTimeout('default'),
  });
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const result = parser.parse(response.data);
  const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
  if (!lockHandle) throw new Error('Failed to extract lock handle from response');
  return lockHandle;
}
```

- [ ] **Step 6: Write `unlock.ts`**

```typescript
// src/core/scalarFunction/unlock.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function unlockScalarFunction(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
  return connection.makeAdtRequest({ url, method: 'POST', timeout: getTimeout('default') });
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest src/__tests__/unit/core/scalarFunction/wire.test.ts --runInBand`
Expected: PASS (3 tests).

- [ ] **Step 8: Build + lint + commit**

```bash
npm run build:fast && npm run lint:check
git add src/core/scalarFunction/read.ts src/core/scalarFunction/update.ts src/core/scalarFunction/lock.ts src/core/scalarFunction/unlock.ts src/__tests__/unit/core/scalarFunction/wire.test.ts
git commit -m "feat(scalarFunction): read/update/lock/unlock wire functions"
```

---

## Task 5: ScalarFunction check / activation / validation / delete

**Files:**
- Create: `src/core/scalarFunction/check.ts`, `activation.ts`, `validation.ts`, `delete.ts`
- Test: `src/__tests__/unit/core/scalarFunction/delete.test.ts`

**Interfaces:**
- Consumes: `runCheckRun`/`parseCheckRunResponse` (checkRun.ts), `IDeleteScalarFunctionParams` (Task 3).
- Produces: `checkScalarFunction(conn, name, version?, sourceCode?)`, `activateScalarFunction(conn, name)`, `validateScalarFunctionName(conn, name, description?)`, `checkDeletion(conn, params)`, `deleteScalarFunction(conn, params)`.

- [ ] **Step 1: Write the failing test (delete lowercases the URI in both payloads)**

```typescript
// src/__tests__/unit/core/scalarFunction/delete.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { checkDeletion, deleteScalarFunction } from '../../../../core/scalarFunction/delete';

function capConn() {
  const calls: Array<{ url: string; data?: string }> = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      calls.push({ url: r.url, data: r.data });
      return { status: 200, statusText: 'OK', headers: {}, data: '' } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { calls, conn };
}

describe('scalarFunction delete', () => {
  it('checkDeletion uses the lower-cased object URI', async () => {
    const { calls, conn } = capConn();
    await checkDeletion(conn, { scalar_function_name: 'ZOK_TEST_FUNC' });
    expect(calls[0].data).toContain('adtcore:uri="/sap/bc/adt/ddic/dsfd/sources/zok_test_func"');
  });

  it('delete uses the lower-cased object URI', async () => {
    const { calls, conn } = capConn();
    await deleteScalarFunction(conn, { scalar_function_name: 'ZOK_TEST_FUNC' });
    expect(calls[0].data).toContain('adtcore:uri="/sap/bc/adt/ddic/dsfd/sources/zok_test_func"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/scalarFunction/delete.test.ts --runInBand`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `check.ts`**

```typescript
// src/core/scalarFunction/check.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

export async function checkScalarFunction(
  connection: IAbapConnection,
  name: string,
  version: string = 'inactive',
  sourceCode?: string,
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'scalar_function', name, version, 'abapCheckRun', sourceCode);
  const checkResult = parseCheckRunResponse(response);
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Scalar function check failed: ${errorMessages}`);
  }
  return response;
}
```

- [ ] **Step 4: Write `activation.ts`**

```typescript
// src/core/scalarFunction/activation.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

function buildActivationXml(name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/dsfd/sources/${encodeSapObjectName(name.toLowerCase())}" adtcore:name="${name.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

function parseActivationResponse(response: AxiosResponse): { success: boolean; message: string } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  try {
    const result = parser.parse(response.data);
    const properties = result['chkl:messages']?.['chkl:properties'];
    if (properties) {
      const activated = properties.activationExecuted === 'true' || properties.activationExecuted === true;
      const checked = properties.checkExecuted === 'true' || properties.checkExecuted === true;
      return { success: activated && checked, message: activated ? 'Scalar function activated successfully' : 'Activation failed' };
    }
    return { success: false, message: 'Unknown activation status' };
  } catch (error) {
    return { success: false, message: `Failed to parse activation response: ${error}` };
  }
}

export async function activateScalarFunction(
  connection: IAbapConnection,
  name: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: buildActivationXml(name),
    headers: { Accept: 'application/xml', 'Content-Type': 'application/xml' },
  });
  const activationResult = parseActivationResponse(response);
  if (!activationResult.success) {
    throw new Error(`Scalar function activation failed: ${activationResult.message}`);
  }
  return response;
}
```

- [ ] **Step 5: Write `validation.ts`**

> NOTE: the DSFD validation `objtype` is unconfirmed (spec open item). `dsfdscf` is a best-effort
> value; if wrong the server returns 404/405/501, which the handler maps to
> `validationSupported: false` — it never blocks create.

```typescript
// src/core/scalarFunction/validation.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

export async function validateScalarFunctionName(
  connection: IAbapConnection,
  name: string,
  description?: string,
): Promise<AxiosResponse> {
  const queryParams = new URLSearchParams({ objtype: 'dsfdscf', objname: name });
  if (description) queryParams.append('description', description);
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/ddic/dsfd/sources/validation?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VALIDATION },
  });
}
```

- [ ] **Step 6: Write `delete.ts`**

```typescript
// src/core/scalarFunction/delete.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IDeleteScalarFunctionParams } from './types';

function objectUri(name: string): string {
  return `/sap/bc/adt/ddic/dsfd/sources/${encodeSapObjectName(name.toLowerCase())}`;
}

export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteScalarFunctionParams,
): Promise<AxiosResponse> {
  if (!params.scalar_function_name) throw new Error('scalar_function_name is required');
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(params.scalar_function_name)}"/>
</del:checkRequest>`;
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/deletion/check`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: { Accept: ACCEPT_DELETION_CHECK, 'Content-Type': CT_DELETION_CHECK },
  });
}

export async function deleteScalarFunction(
  connection: IAbapConnection,
  params: IDeleteScalarFunctionParams,
): Promise<AxiosResponse> {
  if (!params.scalar_function_name) throw new Error('scalar_function_name is required');
  const transportNumberTag = params.transport_request?.trim()
    ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
    : '<del:transportNumber/>';
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(params.scalar_function_name)}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;
  const response = await connection.makeAdtRequest({
    url: `/sap/bc/adt/deletion/delete`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: { Accept: ACCEPT_DELETION, 'Content-Type': CT_DELETION },
  });
  return {
    ...response,
    data: {
      success: true,
      scalar_function_name: params.scalar_function_name,
      object_uri: objectUri(params.scalar_function_name),
      transport_request: params.transport_request || 'local',
      message: `Scalar function ${params.scalar_function_name} deleted successfully`,
    },
  } as AxiosResponse;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest src/__tests__/unit/core/scalarFunction/delete.test.ts --runInBand`
Expected: PASS (2 tests).

- [ ] **Step 8: Build + lint + commit**

```bash
npm run build:fast && npm run lint:check
git add src/core/scalarFunction/check.ts src/core/scalarFunction/activation.ts src/core/scalarFunction/validation.ts src/core/scalarFunction/delete.ts src/__tests__/unit/core/scalarFunction/delete.test.ts
git commit -m "feat(scalarFunction): check/activation/validation/delete low-level functions"
```

---

## Task 6: AdtScalarFunction handler + index

**Files:**
- Create: `src/core/scalarFunction/AdtScalarFunction.ts`, `src/core/scalarFunction/index.ts`
- Test: `src/__tests__/unit/core/scalarFunction/handler.test.ts`

**Interfaces:**
- Consumes: all Task 3-5 functions, `IAdtSystemContext` (from `../../clients/AdtClient`), `IReadOptions`.
- Produces: `class AdtScalarFunction implements IAdtObject<IScalarFunctionConfig, IScalarFunctionState>` with `objectType='ScalarFunction'`; `type AdtScalarFunctionType`. Key behaviors: `create()` is metadata-only (no lock/update); `update()` runs lock→check→PUT→unlock(finally stateless)→check→optional activate; `read()` returns `undefined` on 404; `validate()` maps 404/405/501 to `{ validationSupported: false }` and rethrows everything else.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/scalarFunction/handler.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtScalarFunction } from '../../../../core/scalarFunction/AdtScalarFunction';

type Call = { url: string; method?: string };
function makeConn(handler: (r: any) => Partial<IAdtResponse> | Error) {
  const sessionTypes: string[] = [];
  const calls: Call[] = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      calls.push({ url: r.url, method: r.method });
      const res = handler(r);
      if (res instanceof Error) throw res;
      return { status: 200, statusText: 'OK', headers: {}, data: '', ...res } as IAdtResponse;
    },
    setSessionType: (t: string) => { sessionTypes.push(t); },
  } as unknown as IAbapConnection;
  return { conn, sessionTypes, calls };
}

describe('AdtScalarFunction handler', () => {
  it('create() only POSTs metadata — no lock/update even if sourceCode is given', async () => {
    const { conn, calls } = makeConn(() => ({ data: '' }));
    const sf = new AdtScalarFunction(conn);
    await sf.create({ scalarFunctionName: 'ZOK_F', packageName: 'ZPKG', description: 'd', sourceCode: 'X' }, { sourceCode: 'Y' });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/ddic/dsfd/sources');
  });

  it('read() returns undefined on 404', async () => {
    const { conn } = makeConn(() => Object.assign(new Error('not found'), { response: { status: 404 } }));
    const sf = new AdtScalarFunction(conn);
    const result = await sf.read({ scalarFunctionName: 'ZOK_F' });
    expect(result).toBeUndefined();
  });

  it('validate() maps 404/405/501 to validationSupported:false without throwing', async () => {
    const { conn } = makeConn(() => Object.assign(new Error('nope'), { response: { status: 405 } }));
    const sf = new AdtScalarFunction(conn);
    const state = await sf.validate({ scalarFunctionName: 'ZOK_F' });
    expect(state.validationSupported).toBe(false);
    expect(state.errors).toHaveLength(0);
  });

  it('validate() rethrows non-unsupported errors (e.g. 403)', async () => {
    const { conn } = makeConn(() => Object.assign(new Error('forbidden'), { response: { status: 403 } }));
    const sf = new AdtScalarFunction(conn);
    await expect(sf.validate({ scalarFunctionName: 'ZOK_F' })).rejects.toThrow('forbidden');
  });

  it('public unlock() resets session to stateless even when unlock throws', async () => {
    const { conn, sessionTypes } = makeConn((r) =>
      r.url.includes('_action=UNLOCK') ? new Error('unlock boom') : ({ data: '' }),
    );
    const sf = new AdtScalarFunction(conn);
    await expect(sf.unlock({ scalarFunctionName: 'ZOK_F' }, 'LH1')).rejects.toThrow('unlock boom');
    expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/scalarFunction/handler.test.ts --runInBand`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `AdtScalarFunction.ts`**

```typescript
// src/core/scalarFunction/AdtScalarFunction.ts
/**
 * AdtScalarFunction - High-level CRUD for CDS scalar functions (DSFD/SCF).
 * Mirrors AdtServiceDefinition; create() is metadata-only, source via update().
 */
import type {
  HttpError,
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { safeErrorMessage } from '../../utils/internalUtils';
import type { IReadOptions } from '../shared/types';
import { activateScalarFunction } from './activation';
import { checkScalarFunction } from './check';
import { create as createScalarFunction } from './create';
import { checkDeletion, deleteScalarFunction } from './delete';
import { lockScalarFunction } from './lock';
import {
  getScalarFunction,
  getScalarFunctionSource,
  getScalarFunctionTransport,
} from './read';
import type { IScalarFunctionConfig, IScalarFunctionState } from './types';
import { unlockScalarFunction } from './unlock';
import { updateScalarFunction } from './update';
import { validateScalarFunctionName } from './validation';

const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);

export class AdtScalarFunction
  implements IAdtObject<IScalarFunctionConfig, IScalarFunctionState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'ScalarFunction';

  constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
  }

  async validate(config: Partial<IScalarFunctionConfig>): Promise<IScalarFunctionState> {
    const state: IScalarFunctionState = { errors: [] };
    if (!config.scalarFunctionName) {
      const error = new Error('Scalar function name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    try {
      state.validationResponse = await validateScalarFunctionName(
        this.connection,
        config.scalarFunctionName,
        config.description,
      );
      state.validationSupported = true;
      return state;
    } catch (error) {
      const status = (error as HttpError)?.response?.status;
      if (status && VALIDATION_UNSUPPORTED_STATUSES.has(status)) {
        state.validationSupported = false;
        return state;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger?.error('validate', safeErrorMessage(err));
      throw err;
    }
  }

  async create(
    config: IScalarFunctionConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IScalarFunctionState> {
    const state: IScalarFunctionState = { errors: [] };
    if (!config.scalarFunctionName) throw new Error('Scalar function name is required');
    if (!config.packageName) throw new Error('Package name is required');
    if (!config.description) throw new Error('Description is required');
    try {
      state.createResult = await createScalarFunction(this.connection, {
        scalar_function_name: config.scalarFunctionName,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        description: config.description,
        masterSystem: this.systemContext.masterSystem,
        responsible: this.systemContext.responsible,
        masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
      });
      return state;
    } catch (error) {
      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async read(
    config: Partial<IScalarFunctionConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IScalarFunctionState | undefined> {
    if (!config.scalarFunctionName) throw new Error('Scalar function name is required');
    try {
      const response = await getScalarFunctionSource(
        this.connection,
        config.scalarFunctionName,
        version,
        options,
        this.logger,
      );
      return { readResult: response, errors: [] };
    } catch (error) {
      if ((error as HttpError).response?.status === 404) return undefined;
      throw error;
    }
  }

  async readMetadata(
    config: Partial<IScalarFunctionConfig>,
    options?: IReadOptions,
  ): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName) throw new Error('Scalar function name is required');
    const response = await getScalarFunction(
      this.connection,
      config.scalarFunctionName,
      'inactive',
      options,
      this.logger,
    );
    return { metadataResult: response, errors: [] };
  }

  async readTransport(
    config: Partial<IScalarFunctionConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName) throw new Error('Scalar function name is required');
    const response = await getScalarFunctionTransport(
      this.connection,
      config.scalarFunctionName,
      options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined,
    );
    return { transportResult: response, errors: [] };
  }

  async update(
    config: Partial<IScalarFunctionConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName) throw new Error('Scalar function name is required');

    if (options?.lockHandle) {
      const codeToUpdate = options?.sourceCode || config.sourceCode;
      if (!codeToUpdate) throw new Error('Source code is required for update');
      const updateResult = await updateScalarFunction(
        this.connection,
        {
          scalar_function_name: config.scalarFunctionName,
          source_code: codeToUpdate,
          transport_request: config.transportRequest,
        },
        options.lockHandle,
      );
      return { updateResult, errors: [] };
    }

    let lockHandle: string | undefined;
    try {
      this.connection.setSessionType('stateful');
      lockHandle = await lockScalarFunction(this.connection, config.scalarFunctionName);

      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        await checkScalarFunction(this.connection, config.scalarFunctionName, 'inactive', codeToCheck);
        await updateScalarFunction(
          this.connection,
          {
            scalar_function_name: config.scalarFunctionName,
            source_code: codeToCheck,
            transport_request: config.transportRequest,
          },
          lockHandle,
        );
      }

      if (lockHandle) {
        this.connection.setSessionType('stateful');
        try {
          await unlockScalarFunction(this.connection, config.scalarFunctionName, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
        }
        lockHandle = undefined;
      }

      await checkScalarFunction(this.connection, config.scalarFunctionName, 'inactive');

      if (options?.activateOnUpdate) {
        const activateResult = await activateScalarFunction(this.connection, config.scalarFunctionName);
        return { activateResult, errors: [] };
      }

      const readResult = await getScalarFunctionSource(this.connection, config.scalarFunctionName);
      return { readResult, errors: [] };
    } catch (error) {
      if (lockHandle) {
        try {
          this.connection.setSessionType('stateful');
          await unlockScalarFunction(this.connection, config.scalarFunctionName, lockHandle);
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', safeErrorMessage(unlockError));
        } finally {
          this.connection.setSessionType('stateless');
        }
      } else {
        this.connection.setSessionType('stateless');
      }
      if (options?.deleteOnFailure) {
        try {
          await deleteScalarFunction(this.connection, {
            scalar_function_name: config.scalarFunctionName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete after failure:', safeErrorMessage(deleteError));
        }
      }
      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async delete(config: Partial<IScalarFunctionConfig>): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName) throw new Error('Scalar function name is required');
    try {
      await checkDeletion(this.connection, {
        scalar_function_name: config.scalarFunctionName,
        transport_request: config.transportRequest,
      });
      const deleteResult = await deleteScalarFunction(this.connection, {
        scalar_function_name: config.scalarFunctionName,
        transport_request: config.transportRequest,
      });
      return { deleteResult, errors: [] };
    } catch (error) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async activate(config: Partial<IScalarFunctionConfig>): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName) throw new Error('Scalar function name is required');
    const result = await activateScalarFunction(this.connection, config.scalarFunctionName);
    return { activateResult: result, errors: [] };
  }

  async check(config: Partial<IScalarFunctionConfig>, status?: string): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName) throw new Error('Scalar function name is required');
    const version = status === 'active' ? 'active' : 'inactive';
    const checkResult = await checkScalarFunction(this.connection, config.scalarFunctionName, version);
    return { checkResult, errors: [] };
  }

  async lock(config: Partial<IScalarFunctionConfig>): Promise<string> {
    if (!config.scalarFunctionName) throw new Error('Scalar function name is required');
    this.connection.setSessionType('stateful');
    return lockScalarFunction(this.connection, config.scalarFunctionName);
  }

  async unlock(config: Partial<IScalarFunctionConfig>, lockHandle: string): Promise<IScalarFunctionState> {
    if (!config.scalarFunctionName) throw new Error('Scalar function name is required');
    this.connection.setSessionType('stateful');
    try {
      const unlockResult = await unlockScalarFunction(this.connection, config.scalarFunctionName, lockHandle);
      return { unlockResult, errors: [] };
    } finally {
      this.connection.setSessionType('stateless');
    }
  }
}
```

- [ ] **Step 4: Write `index.ts`**

```typescript
// src/core/scalarFunction/index.ts
import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IScalarFunctionConfig, IScalarFunctionState } from './types';

export { AdtScalarFunction } from './AdtScalarFunction';
export * from './types';

export type AdtScalarFunctionType = IAdtObject<IScalarFunctionConfig, IScalarFunctionState>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/unit/core/scalarFunction/handler.test.ts --runInBand`
Expected: PASS (5 tests).

- [ ] **Step 6: Build + lint + commit**

```bash
npm run build:fast && npm run lint:check
git add src/core/scalarFunction/AdtScalarFunction.ts src/core/scalarFunction/index.ts src/__tests__/unit/core/scalarFunction/handler.test.ts
git commit -m "feat(scalarFunction): AdtScalarFunction handler with hardened session reset + validation fallback"
```

---

## Task 7: Wire ScalarFunction into AdtClient + public API

**Files:**
- Modify: `src/clients/AdtClient.ts` (imports near line 16-90; factory near `getServiceDefinition()` ~line 387)
- Modify: `src/index.ts` (export block near line 213-217)
- Test: `src/__tests__/unit/core/scalarFunction/factory.test.ts`

**Interfaces:**
- Consumes: `AdtScalarFunction`, `IScalarFunctionConfig`, `IScalarFunctionState`, `AdtScalarFunctionType`.
- Produces: `AdtClient.getScalarFunction(): IAdtObject<IScalarFunctionConfig, IScalarFunctionState>`; public exports of the type + handler.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/scalarFunction/factory.test.ts
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../../clients/AdtClient';

describe('AdtClient.getScalarFunction', () => {
  it('returns a handler whose objectType is ScalarFunction', () => {
    const client = new AdtClient({} as IAbapConnection);
    const handler = client.getScalarFunction();
    expect((handler as { objectType: string }).objectType).toBe('ScalarFunction');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/scalarFunction/factory.test.ts --runInBand`
Expected: FAIL — `getScalarFunction` is not a function.

- [ ] **Step 3: Add the import to `AdtClient.ts`**

Add alongside the other `../core/*` imports (keep alphabetical grouping near `serviceDefinition`):

```typescript
import {
  AdtScalarFunction,
  type IScalarFunctionConfig,
  type IScalarFunctionState,
} from '../core/scalarFunction';
```

- [ ] **Step 4: Add the factory method to `AdtClient.ts`**

Immediately after `getServiceDefinition()` (~line 396):

```typescript
  /**
   * Get high-level operations for CDS Scalar Function (DSFD/SCF) objects
   */
  getScalarFunction(): IAdtObject<IScalarFunctionConfig, IScalarFunctionState> {
    return new AdtScalarFunction(this.connection, this.logger, this.systemContext);
  }
```

- [ ] **Step 5: Add exports to `src/index.ts`**

After the `serviceDefinition` export block (~line 217):

```typescript
export { AdtScalarFunction } from './core/scalarFunction';
export type {
  AdtScalarFunctionType,
  IScalarFunctionConfig,
  IScalarFunctionState,
} from './core/scalarFunction';
```

- [ ] **Step 6: Run test + full build**

Run: `npx jest src/__tests__/unit/core/scalarFunction/factory.test.ts --runInBand`
Expected: PASS.
Run: `npm run build:fast && npm run lint:check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/clients/AdtClient.ts src/index.ts src/__tests__/unit/core/scalarFunction/factory.test.ts
git commit -m "feat(AdtClient): expose getScalarFunction + public ScalarFunction exports"
```

---

## Task 8: ScalarFunction integration test + config template

**Files:**
- Create: `src/__tests__/integration/core/scalarFunction/ScalarFunction.test.ts`
- Modify: `src/__tests__/helpers/test-config.yaml.template`

**Interfaces:**
- Consumes: `AdtClient.getScalarFunction()`, the test helpers (`TestConfigResolver`, connection bootstrap) used by `src/__tests__/integration/core/serviceDefinition/ServiceDefinition.test.ts`.

- [ ] **Step 1: Read the reference integration test**

Read `src/__tests__/integration/core/serviceDefinition/ServiceDefinition.test.ts` end-to-end to copy the exact connection/config bootstrap, `describeXxx` env gating, and skip-logging helpers this repo uses. Reuse them verbatim; only the object operations differ.

- [ ] **Step 2: Add the config entry**

In `src/__tests__/helpers/test-config.yaml.template`, add under the object-types section:

```yaml
  scalar_function:
    name: ZADT_SCALAR_FUNC          # ← CHANGE if needed
    # available_in is a hint only; the suite probes discovery + create at runtime
```

- [ ] **Step 3: Write the integration test (discovery-then-create skip gate)**

```typescript
// src/__tests__/integration/core/scalarFunction/ScalarFunction.test.ts
import {
  fetchDiscoveryEndpoints,
  isEndpointInDiscovery,
} from '../../../../utils/discoveryEndpoints';
// Reuse the SAME bootstrap/gating imports as ServiceDefinition.test.ts.

const SKIP_STATUSES = new Set([404, 405, 501]);
const DSFD_ENDPOINT = '/sap/bc/adt/ddic/dsfd/sources';

describe('ScalarFunction (DSFD/SCF) integration', () => {
  // Bootstrap connection + AdtClient EXACTLY as ServiceDefinition.test.ts does.
  // const { client, connection, config } = ...

  it('create → read → update → activate → delete (skips only on 404/405/501)', async () => {
    // 1) Discovery positive fast-path (never a skip trigger).
    let supported = false;
    try {
      const endpoints = await fetchDiscoveryEndpoints(connection);
      supported = isEndpointInDiscovery(endpoints, DSFD_ENDPOINT);
    } catch {
      supported = false; // inconclusive — fall through to create
    }

    const sf = client.getScalarFunction();
    const name = config.scalarFunctionName; // resolved from test-config
    const pkg = config.packageName;

    // idempotent cleanup
    try { await sf.delete({ scalarFunctionName: name }); } catch { /* ignore */ }

    // 2) create (also resolves "supported" when discovery was inconclusive)
    try {
      await sf.create({ scalarFunctionName: name, packageName: pkg, description: 'ADT test scalar fn' });
      supported = true;
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      if (!supported && status && SKIP_STATUSES.has(status)) {
        console.log(`SKIP: DSFD unsupported on this system (status ${status})`);
        return;
      }
      throw e;
    }

    // 3) update with real source + activate
    const source =
      `define scalar function ${name}\n` +
      `  with parameters p1 : abap.int4\n` +
      `  returns abap.int4\n` +
      `  implemented by method zcl_x=>m;`;
    await sf.update({ scalarFunctionName: name, sourceCode: source }, { activateOnUpdate: true });

    // 4) read back
    const read = await sf.read({ scalarFunctionName: name }, 'active');
    expect(read?.readResult?.status).toBe(200);

    // 5) delete
    const del = await sf.delete({ scalarFunctionName: name });
    expect(del.deleteResult).toBeDefined();
  });
});
```

> The `source` above is illustrative; during execution adjust the body to one that activates on the
> target system (the implementing method must exist, or use a self-contained body the system
> accepts). The structural flow — not the exact DDL — is what this task locks in.

- [ ] **Step 4: Type-check the integration test**

Run: `npm run test:check:integration`
Expected: no type errors for the new file.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/integration/core/scalarFunction/ScalarFunction.test.ts src/__tests__/helpers/test-config.yaml.template
git commit -m "test(scalarFunction): integration suite with discovery-then-create skip gate"
```

---

## Task 9: AppendStructure types + low-level create (with template)

**Files:**
- Create: `src/core/appendStructure/types.ts`, `src/core/appendStructure/create.ts`
- Test: `src/__tests__/unit/core/appendStructure/create.test.ts`

**Interfaces:**
- Produces types: `ICreateAppendStructureParams { append_structure_name; base_object; description?; package_name; transport_request?; masterSystem?; responsible?; masterLanguage? }`, `IUpdateAppendStructureParams { append_structure_name; source_code; transport_request? }`, `IDeleteAppendStructureParams { append_structure_name; transport_request? }`, `IAppendStructureConfig { appendStructureName; baseObject?; masterLanguage?; packageName?; transportRequest?; description?; sourceCode? }`, `IAppendStructureState extends IAdtObjectState { validationSupported?: boolean }`.
- Produces: `create(connection, params): Promise<IAdtResponse>` — POSTs a `blue:blueSource` envelope with `adtcore:type="TABL/DS"` and an `adtTemplate/adtProperty adtcore:key="base_structure"` block.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/appendStructure/create.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { create } from '../../../../core/appendStructure/create';

function mockConn(capture: { url?: string; data?: string; headers?: Record<string, string> }) {
  return {
    makeAdtRequest: async (req: any): Promise<IAdtResponse> => {
      capture.url = req.url; capture.data = req.data; capture.headers = req.headers;
      return { status: 200, statusText: 'OK', headers: {}, data: '' } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
}

describe('appendStructure create', () => {
  it('POSTs a blues+template envelope (TABL/DS, base_structure), upper-cased identifiers', async () => {
    const cap: { url?: string; data?: string; headers?: Record<string, string> } = {};
    await create(mockConn(cap), {
      append_structure_name: 'zok_s_append',
      base_object: 'zmcp_shr_stru',
      package_name: 'zmcp_shr_pkg',
      description: 'Test',
      masterSystem: 'TRL',
      responsible: 'CB9980008038',
    });
    expect(cap.url).toBe('/sap/bc/adt/ddic/structures');
    expect(cap.headers?.['Content-Type']).toBe('application/vnd.sap.adt.structures.v2+xml');
    expect(cap.data).toContain('adtcore:type="TABL/DS"');
    expect(cap.data).toContain('adtcore:name="ZOK_S_APPEND"');
    expect(cap.data).toContain('<adtcore:adtProperty adtcore:key="base_structure">ZMCP_SHR_STRU</adtcore:adtProperty>');
    expect(cap.data).toContain('<adtcore:packageRef adtcore:name="ZMCP_SHR_PKG"/>');
  });

  it('works identically for a table base (same base_structure key)', async () => {
    const cap: { data?: string } = {};
    await create(mockConn(cap as any), {
      append_structure_name: 'zok_s_append_t',
      base_object: 'zmcp_view_tbl02',
      package_name: 'zmcp_shr_pkg',
      description: 'Test',
    });
    expect(cap.data).toContain('<adtcore:adtProperty adtcore:key="base_structure">ZMCP_VIEW_TBL02</adtcore:adtProperty>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/appendStructure/create.test.ts --runInBand`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `types.ts`**

```typescript
// src/core/appendStructure/types.ts
/**
 * AppendStructure (TABL/DS append) module type definitions
 */
import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export interface ICreateAppendStructureParams {
  append_structure_name: string;
  base_object: string; // name of the base table OR structure being extended
  description?: string;
  package_name: string;
  transport_request?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IUpdateAppendStructureParams {
  append_structure_name: string;
  source_code: string;
  transport_request?: string;
}

export interface IDeleteAppendStructureParams {
  append_structure_name: string;
  transport_request?: string;
}

export interface IAppendStructureConfig {
  appendStructureName: string;
  baseObject?: string; // required for create (validated in handler)
  masterLanguage?: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

export interface IAppendStructureState extends IAdtObjectState {
  validationSupported?: boolean;
}
```

- [ ] **Step 4: Write `create.ts`**

```typescript
// src/core/appendStructure/create.ts
/**
 * AppendStructure create operations - Low-level functions
 * Metadata-only POST with base_structure template; source via update().
 */
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_APPEND_STRUCTURE, CT_STRUCTURE } from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateAppendStructureParams } from './types';

export async function create(
  connection: IAbapConnection,
  args: ICreateAppendStructureParams,
): Promise<AxiosResponse> {
  if (!args.append_structure_name || !args.base_object || !args.package_name) {
    throw new Error('Missing required parameters: append_structure_name, base_object, package_name');
  }

  const transport = args.transport_request?.trim();
  const url = `/sap/bc/adt/ddic/structures${
    transport ? `?corrNr=${encodeURIComponent(transport)}` : ''
  }`;

  const lang = args.masterLanguage || 'EN';
  const name = escapeXmlAttr(args.append_structure_name.toUpperCase());
  const base = escapeXmlAttr(args.base_object.toUpperCase());
  const pkg = escapeXmlAttr(args.package_name.toUpperCase());
  const description = escapeXmlAttr(
    limitDescription(args.description || args.append_structure_name),
  );
  const masterSystemAttr = args.masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(args.masterSystem)}"`
    : '';
  const responsibleAttr = args.responsible
    ? ` adtcore:responsible="${escapeXmlAttr(args.responsible)}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${name}" adtcore:type="TABL/DS" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:adtTemplate>
    <adtcore:adtProperty adtcore:key="base_structure">${base}</adtcore:adtProperty>
  </adtcore:adtTemplate>
  <adtcore:packageRef adtcore:name="${pkg}"/>
</blue:blueSource>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: { Accept: ACCEPT_APPEND_STRUCTURE, 'Content-Type': CT_STRUCTURE },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/unit/core/appendStructure/create.test.ts --runInBand`
Expected: PASS (2 tests).

- [ ] **Step 6: Build + lint + commit**

```bash
npm run build:fast && npm run lint:check
git add src/core/appendStructure/types.ts src/core/appendStructure/create.ts src/__tests__/unit/core/appendStructure/create.test.ts
git commit -m "feat(appendStructure): types + low-level create (TABL/DS template envelope)"
```

---

## Task 10: AppendStructure read / update / lock / unlock

**Files:**
- Create: `src/core/appendStructure/read.ts`, `update.ts`, `lock.ts`, `unlock.ts`
- Test: `src/__tests__/unit/core/appendStructure/wire.test.ts`

**Interfaces:**
- Consumes: `IUpdateAppendStructureParams` (Task 9).
- Produces: `getAppendStructure`, `getAppendStructureSource`, `getAppendStructureTransport`, `updateAppendStructure(conn, args, lockHandle)`, `lockAppendStructure(conn, name): Promise<string>`, `unlockAppendStructure(conn, name, lockHandle)`. All URLs use base `/sap/bc/adt/ddic/structures`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/appendStructure/wire.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { updateAppendStructure } from '../../../../core/appendStructure/update';
import { getAppendStructureSource } from '../../../../core/appendStructure/read';
import { unlockAppendStructure } from '../../../../core/appendStructure/unlock';

function cap() {
  const c: { url?: string; method?: string; headers?: Record<string, string> } = {};
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      c.url = r.url; c.method = r.method; c.headers = r.headers;
      return { status: 200, statusText: 'OK', headers: {}, data: '' } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { c, conn };
}

describe('appendStructure wire', () => {
  it('update PUTs source/main with encoded lockHandle + corrNr, text/plain, Accept text/plain', async () => {
    const { c, conn } = cap();
    await updateAppendStructure(
      conn,
      { append_structure_name: 'ZOK_S_APPEND', source_code: 'extend type ...', transport_request: 'TRLK9 1' },
      'LH/1',
    );
    expect(c.method).toBe('PUT');
    expect(c.url).toBe('/sap/bc/adt/ddic/structures/zok_s_append/source/main?lockHandle=LH%2F1&corrNr=TRLK9%201');
    expect(c.headers?.['Content-Type']).toBe('text/plain; charset=utf-8');
    expect(c.headers?.Accept).toBe('text/plain'); // from trace, NOT structure/update.ts's xml accept
  });

  it('read source GETs source/main with version and Accept text/plain', async () => {
    const { c, conn } = cap();
    await getAppendStructureSource(conn, 'ZOK_S_APPEND', 'active');
    expect(c.url).toBe('/sap/bc/adt/ddic/structures/zok_s_append/source/main?version=active');
    expect(c.headers?.Accept).toBe('text/plain');
  });

  it('unlock POSTs _action=UNLOCK with encoded lockHandle', async () => {
    const { c, conn } = cap();
    await unlockAppendStructure(conn, 'ZOK_S_APPEND', 'LH/1');
    expect(c.url).toBe('/sap/bc/adt/ddic/structures/zok_s_append?_action=UNLOCK&lockHandle=LH%2F1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/appendStructure/wire.test.ts --runInBand`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `read.ts`** (identical to Task 4's read.ts but base path `/sap/bc/adt/ddic/structures` and metadata Accept `ACCEPT_APPEND_STRUCTURE`)

```typescript
// src/core/appendStructure/read.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_APPEND_STRUCTURE,
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
} from '../../constants/contentTypes';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

function buildQuery(version?: string, options?: IReadOptions): string {
  const q: string[] = [];
  if (version) q.push(`version=${version}`);
  if (options?.withLongPolling) q.push('withLongPolling=true');
  return q.length ? `?${q.join('&')}` : '';
}

export async function getAppendStructure(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(name.toLowerCase())}${buildQuery(version, options)}`;
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    { url, method: 'GET', timeout: getTimeout('default'), headers: { Accept: options?.accept ?? ACCEPT_APPEND_STRUCTURE } },
    { logger },
  );
}

export async function getAppendStructureSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(name.toLowerCase())}/source/main${buildQuery(version, options)}`;
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    { url, method: 'GET', timeout: getTimeout('default'), headers: { Accept: options?.accept ?? ACCEPT_SOURCE } },
    { logger },
  );
}

export async function getAppendStructureTransport(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(name.toLowerCase())}/transport${query}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: options?.accept ?? ACCEPT_TRANSPORT },
  });
}
```

- [ ] **Step 4: Write `update.ts`** (Accept `text/plain` per trace, base structures path)

```typescript
// src/core/appendStructure/update.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateAppendStructureParams } from './types';

export async function updateAppendStructure(
  connection: IAbapConnection,
  args: IUpdateAppendStructureParams,
  lockHandle: string,
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(args.append_structure_name.toLowerCase());
  const corrNrParam = args.transport_request
    ? `&corrNr=${encodeURIComponent(args.transport_request)}`
    : '';
  const url = `/sap/bc/adt/ddic/structures/${encoded}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers: { Accept: ACCEPT_SOURCE, 'Content-Type': CT_SOURCE },
  });
}
```

- [ ] **Step 5: Write `lock.ts`** (base structures path)

```typescript
// src/core/appendStructure/lock.ts
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function lockAppendStructure(
  connection: IAbapConnection,
  name: string,
): Promise<string> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `/sap/bc/adt/ddic/structures/${encoded}?_action=LOCK&accessMode=MODIFY`;
  const response = await connection.makeAdtRequest({
    method: 'POST',
    url,
    headers: { Accept: ACCEPT_LOCK },
    timeout: getTimeout('default'),
  });
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const result = parser.parse(response.data);
  const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
  if (!lockHandle) throw new Error('Failed to extract lock handle from response');
  return lockHandle;
}
```

- [ ] **Step 6: Write `unlock.ts`** (base structures path)

```typescript
// src/core/appendStructure/unlock.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function unlockAppendStructure(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `/sap/bc/adt/ddic/structures/${encoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
  return connection.makeAdtRequest({ url, method: 'POST', timeout: getTimeout('default') });
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest src/__tests__/unit/core/appendStructure/wire.test.ts --runInBand`
Expected: PASS (3 tests).

- [ ] **Step 8: Build + lint + commit**

```bash
npm run build:fast && npm run lint:check
git add src/core/appendStructure/read.ts src/core/appendStructure/update.ts src/core/appendStructure/lock.ts src/core/appendStructure/unlock.ts src/__tests__/unit/core/appendStructure/wire.test.ts
git commit -m "feat(appendStructure): read/update/lock/unlock wire functions"
```

---

## Task 11: AppendStructure check / activation / validation / delete

**Files:**
- Create: `src/core/appendStructure/check.ts`, `activation.ts`, `validation.ts`, `delete.ts`
- Test: `src/__tests__/unit/core/appendStructure/delete.test.ts`

**Interfaces:**
- Produces: `checkAppendStructure(conn, name, version?, sourceCode?)` (uses `runCheckRun(..., 'append_structure', ...)`), `activateAppendStructure(conn, name)`, `validateAppendStructureName(conn, name, description?)`, `checkDeletion(conn, params)`, `deleteAppendStructure(conn, params)`.

- [ ] **Step 1: Write the failing test (lowercased delete URIs)**

```typescript
// src/__tests__/unit/core/appendStructure/delete.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { checkDeletion, deleteAppendStructure } from '../../../../core/appendStructure/delete';

function capConn() {
  const calls: Array<{ data?: string }> = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      calls.push({ data: r.data });
      return { status: 200, statusText: 'OK', headers: {}, data: '' } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { calls, conn };
}

describe('appendStructure delete', () => {
  it('checkDeletion uses the lower-cased structures URI', async () => {
    const { calls, conn } = capConn();
    await checkDeletion(conn, { append_structure_name: 'ZOK_S_APPEND' });
    expect(calls[0].data).toContain('adtcore:uri="/sap/bc/adt/ddic/structures/zok_s_append"');
  });

  it('delete uses the lower-cased structures URI', async () => {
    const { calls, conn } = capConn();
    await deleteAppendStructure(conn, { append_structure_name: 'ZOK_S_APPEND' });
    expect(calls[0].data).toContain('adtcore:uri="/sap/bc/adt/ddic/structures/zok_s_append"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/appendStructure/delete.test.ts --runInBand`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `check.ts`**

```typescript
// src/core/appendStructure/check.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

export async function checkAppendStructure(
  connection: IAbapConnection,
  name: string,
  version: string = 'inactive',
  sourceCode?: string,
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'append_structure', name, version, 'abapCheckRun', sourceCode);
  const checkResult = parseCheckRunResponse(response);
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Append structure check failed: ${errorMessages}`);
  }
  return response;
}
```

- [ ] **Step 4: Write `activation.ts`** (structures URI base)

```typescript
// src/core/appendStructure/activation.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

function buildActivationXml(name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/structures/${encodeSapObjectName(name.toLowerCase())}" adtcore:name="${name.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

function parseActivationResponse(response: AxiosResponse): { success: boolean; message: string } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  try {
    const result = parser.parse(response.data);
    const properties = result['chkl:messages']?.['chkl:properties'];
    if (properties) {
      const activated = properties.activationExecuted === 'true' || properties.activationExecuted === true;
      const checked = properties.checkExecuted === 'true' || properties.checkExecuted === true;
      return { success: activated && checked, message: activated ? 'Append structure activated successfully' : 'Activation failed' };
    }
    return { success: false, message: 'Unknown activation status' };
  } catch (error) {
    return { success: false, message: `Failed to parse activation response: ${error}` };
  }
}

export async function activateAppendStructure(
  connection: IAbapConnection,
  name: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: buildActivationXml(name),
    headers: { Accept: 'application/xml', 'Content-Type': 'application/xml' },
  });
  const activationResult = parseActivationResponse(response);
  if (!activationResult.success) {
    throw new Error(`Append structure activation failed: ${activationResult.message}`);
  }
  return response;
}
```

- [ ] **Step 5: Write `validation.ts`**

> NOTE: append-structure validation `objtype` is unconfirmed; `tablds` is best-effort. Wrong values
> return 404/405/501 → handler maps to `validationSupported: false`.

```typescript
// src/core/appendStructure/validation.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

export async function validateAppendStructureName(
  connection: IAbapConnection,
  name: string,
  description?: string,
): Promise<AxiosResponse> {
  const queryParams = new URLSearchParams({ objtype: 'tablds', objname: name });
  if (description) queryParams.append('description', description);
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/ddic/structures/validation?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VALIDATION },
  });
}
```

- [ ] **Step 6: Write `delete.ts`**

```typescript
// src/core/appendStructure/delete.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IDeleteAppendStructureParams } from './types';

function objectUri(name: string): string {
  return `/sap/bc/adt/ddic/structures/${encodeSapObjectName(name.toLowerCase())}`;
}

export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteAppendStructureParams,
): Promise<AxiosResponse> {
  if (!params.append_structure_name) throw new Error('append_structure_name is required');
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(params.append_structure_name)}"/>
</del:checkRequest>`;
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/deletion/check`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: { Accept: ACCEPT_DELETION_CHECK, 'Content-Type': CT_DELETION_CHECK },
  });
}

export async function deleteAppendStructure(
  connection: IAbapConnection,
  params: IDeleteAppendStructureParams,
): Promise<AxiosResponse> {
  if (!params.append_structure_name) throw new Error('append_structure_name is required');
  const transportNumberTag = params.transport_request?.trim()
    ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
    : '<del:transportNumber/>';
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(params.append_structure_name)}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;
  const response = await connection.makeAdtRequest({
    url: `/sap/bc/adt/deletion/delete`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: { Accept: ACCEPT_DELETION, 'Content-Type': CT_DELETION },
  });
  return {
    ...response,
    data: {
      success: true,
      append_structure_name: params.append_structure_name,
      object_uri: objectUri(params.append_structure_name),
      transport_request: params.transport_request || 'local',
      message: `Append structure ${params.append_structure_name} deleted successfully`,
    },
  } as AxiosResponse;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest src/__tests__/unit/core/appendStructure/delete.test.ts --runInBand`
Expected: PASS (2 tests).

- [ ] **Step 8: Build + lint + commit**

```bash
npm run build:fast && npm run lint:check
git add src/core/appendStructure/check.ts src/core/appendStructure/activation.ts src/core/appendStructure/validation.ts src/core/appendStructure/delete.ts src/__tests__/unit/core/appendStructure/delete.test.ts
git commit -m "feat(appendStructure): check/activation/validation/delete low-level functions"
```

---

## Task 12: AdtAppendStructure handler + index

**Files:**
- Create: `src/core/appendStructure/AdtAppendStructure.ts`, `src/core/appendStructure/index.ts`
- Test: `src/__tests__/unit/core/appendStructure/handler.test.ts`

**Interfaces:**
- Produces: `class AdtAppendStructure implements IAdtObject<IAppendStructureConfig, IAppendStructureState>` with `objectType='AppendStructure'`; `type AdtAppendStructureType`. Same chain/hardening as `AdtScalarFunction`; **create() additionally requires `baseObject`** and passes it as `base_object`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/appendStructure/handler.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtAppendStructure } from '../../../../core/appendStructure/AdtAppendStructure';

function makeConn(handler: (r: any) => Partial<IAdtResponse> | Error) {
  const sessionTypes: string[] = [];
  const calls: Array<{ url: string; method?: string }> = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      calls.push({ url: r.url, method: r.method });
      const res = handler(r);
      if (res instanceof Error) throw res;
      return { status: 200, statusText: 'OK', headers: {}, data: '', ...res } as IAdtResponse;
    },
    setSessionType: (t: string) => { sessionTypes.push(t); },
  } as unknown as IAbapConnection;
  return { conn, sessionTypes, calls };
}

describe('AdtAppendStructure handler', () => {
  it('create() requires baseObject', async () => {
    const { conn } = makeConn(() => ({ data: '' }));
    const as = new AdtAppendStructure(conn);
    await expect(
      as.create({ appendStructureName: 'ZOK_S', packageName: 'ZPKG', description: 'd' }),
    ).rejects.toThrow(/base/i);
  });

  it('create() only POSTs metadata (no lock/update) with a valid baseObject', async () => {
    const { conn, calls } = makeConn(() => ({ data: '' }));
    const as = new AdtAppendStructure(conn);
    await as.create({ appendStructureName: 'ZOK_S', baseObject: 'ZBASE', packageName: 'ZPKG', description: 'd' });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/ddic/structures');
  });

  it('public unlock() resets to stateless even when unlock throws', async () => {
    const { conn, sessionTypes } = makeConn((r) =>
      r.url.includes('_action=UNLOCK') ? new Error('unlock boom') : ({ data: '' }),
    );
    const as = new AdtAppendStructure(conn);
    await expect(as.unlock({ appendStructureName: 'ZOK_S' }, 'LH1')).rejects.toThrow('unlock boom');
    expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
  });

  it('validate() maps 501 to validationSupported:false', async () => {
    const { conn } = makeConn(() => Object.assign(new Error('nope'), { response: { status: 501 } }));
    const as = new AdtAppendStructure(conn);
    const state = await as.validate({ appendStructureName: 'ZOK_S' });
    expect(state.validationSupported).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/appendStructure/handler.test.ts --runInBand`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `AdtAppendStructure.ts`**

> This is the Task 6 handler adapted: rename Scalar→Append, `scalarFunctionName`→`appendStructureName`,
> import from `./` append functions, and add `baseObject` handling in `create()`/`validate`-not-needed.
> Full code:

```typescript
// src/core/appendStructure/AdtAppendStructure.ts
/**
 * AdtAppendStructure - High-level CRUD for append structures (TABL/DS).
 * create() is metadata-only (requires baseObject); source via update().
 */
import type {
  HttpError,
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { safeErrorMessage } from '../../utils/internalUtils';
import type { IReadOptions } from '../shared/types';
import { activateAppendStructure } from './activation';
import { checkAppendStructure } from './check';
import { create as createAppendStructure } from './create';
import { checkDeletion, deleteAppendStructure } from './delete';
import { lockAppendStructure } from './lock';
import {
  getAppendStructure,
  getAppendStructureSource,
  getAppendStructureTransport,
} from './read';
import type { IAppendStructureConfig, IAppendStructureState } from './types';
import { unlockAppendStructure } from './unlock';
import { updateAppendStructure } from './update';
import { validateAppendStructureName } from './validation';

const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);

export class AdtAppendStructure
  implements IAdtObject<IAppendStructureConfig, IAppendStructureState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'AppendStructure';

  constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
  }

  async validate(config: Partial<IAppendStructureConfig>): Promise<IAppendStructureState> {
    const state: IAppendStructureState = { errors: [] };
    if (!config.appendStructureName) {
      const error = new Error('Append structure name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }
    try {
      state.validationResponse = await validateAppendStructureName(
        this.connection,
        config.appendStructureName,
        config.description,
      );
      state.validationSupported = true;
      return state;
    } catch (error) {
      const status = (error as HttpError)?.response?.status;
      if (status && VALIDATION_UNSUPPORTED_STATUSES.has(status)) {
        state.validationSupported = false;
        return state;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger?.error('validate', safeErrorMessage(err));
      throw err;
    }
  }

  async create(
    config: IAppendStructureConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IAppendStructureState> {
    const state: IAppendStructureState = { errors: [] };
    if (!config.appendStructureName) throw new Error('Append structure name is required');
    if (!config.baseObject) throw new Error('Base object is required');
    if (!config.packageName) throw new Error('Package name is required');
    if (!config.description) throw new Error('Description is required');
    try {
      state.createResult = await createAppendStructure(this.connection, {
        append_structure_name: config.appendStructureName,
        base_object: config.baseObject,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        description: config.description,
        masterSystem: this.systemContext.masterSystem,
        responsible: this.systemContext.responsible,
        masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
      });
      return state;
    } catch (error) {
      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async read(
    config: Partial<IAppendStructureConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IAppendStructureState | undefined> {
    if (!config.appendStructureName) throw new Error('Append structure name is required');
    try {
      const response = await getAppendStructureSource(
        this.connection,
        config.appendStructureName,
        version,
        options,
        this.logger,
      );
      return { readResult: response, errors: [] };
    } catch (error) {
      if ((error as HttpError).response?.status === 404) return undefined;
      throw error;
    }
  }

  async readMetadata(
    config: Partial<IAppendStructureConfig>,
    options?: IReadOptions,
  ): Promise<IAppendStructureState> {
    if (!config.appendStructureName) throw new Error('Append structure name is required');
    const response = await getAppendStructure(
      this.connection,
      config.appendStructureName,
      'inactive',
      options,
      this.logger,
    );
    return { metadataResult: response, errors: [] };
  }

  async readTransport(
    config: Partial<IAppendStructureConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IAppendStructureState> {
    if (!config.appendStructureName) throw new Error('Append structure name is required');
    const response = await getAppendStructureTransport(
      this.connection,
      config.appendStructureName,
      options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined,
    );
    return { transportResult: response, errors: [] };
  }

  async update(
    config: Partial<IAppendStructureConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAppendStructureState> {
    if (!config.appendStructureName) throw new Error('Append structure name is required');

    if (options?.lockHandle) {
      const codeToUpdate = options?.sourceCode || config.sourceCode;
      if (!codeToUpdate) throw new Error('Source code is required for update');
      const updateResult = await updateAppendStructure(
        this.connection,
        {
          append_structure_name: config.appendStructureName,
          source_code: codeToUpdate,
          transport_request: config.transportRequest,
        },
        options.lockHandle,
      );
      return { updateResult, errors: [] };
    }

    let lockHandle: string | undefined;
    try {
      this.connection.setSessionType('stateful');
      lockHandle = await lockAppendStructure(this.connection, config.appendStructureName);

      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        await checkAppendStructure(this.connection, config.appendStructureName, 'inactive', codeToCheck);
        await updateAppendStructure(
          this.connection,
          {
            append_structure_name: config.appendStructureName,
            source_code: codeToCheck,
            transport_request: config.transportRequest,
          },
          lockHandle,
        );
      }

      if (lockHandle) {
        this.connection.setSessionType('stateful');
        try {
          await unlockAppendStructure(this.connection, config.appendStructureName, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
        }
        lockHandle = undefined;
      }

      await checkAppendStructure(this.connection, config.appendStructureName, 'inactive');

      if (options?.activateOnUpdate) {
        const activateResult = await activateAppendStructure(this.connection, config.appendStructureName);
        return { activateResult, errors: [] };
      }

      const readResult = await getAppendStructureSource(this.connection, config.appendStructureName);
      return { readResult, errors: [] };
    } catch (error) {
      if (lockHandle) {
        try {
          this.connection.setSessionType('stateful');
          await unlockAppendStructure(this.connection, config.appendStructureName, lockHandle);
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', safeErrorMessage(unlockError));
        } finally {
          this.connection.setSessionType('stateless');
        }
      } else {
        this.connection.setSessionType('stateless');
      }
      if (options?.deleteOnFailure) {
        try {
          await deleteAppendStructure(this.connection, {
            append_structure_name: config.appendStructureName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete after failure:', safeErrorMessage(deleteError));
        }
      }
      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async delete(config: Partial<IAppendStructureConfig>): Promise<IAppendStructureState> {
    if (!config.appendStructureName) throw new Error('Append structure name is required');
    try {
      await checkDeletion(this.connection, {
        append_structure_name: config.appendStructureName,
        transport_request: config.transportRequest,
      });
      const deleteResult = await deleteAppendStructure(this.connection, {
        append_structure_name: config.appendStructureName,
        transport_request: config.transportRequest,
      });
      return { deleteResult, errors: [] };
    } catch (error) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  async activate(config: Partial<IAppendStructureConfig>): Promise<IAppendStructureState> {
    if (!config.appendStructureName) throw new Error('Append structure name is required');
    const result = await activateAppendStructure(this.connection, config.appendStructureName);
    return { activateResult: result, errors: [] };
  }

  async check(config: Partial<IAppendStructureConfig>, status?: string): Promise<IAppendStructureState> {
    if (!config.appendStructureName) throw new Error('Append structure name is required');
    const version = status === 'active' ? 'active' : 'inactive';
    const checkResult = await checkAppendStructure(this.connection, config.appendStructureName, version);
    return { checkResult, errors: [] };
  }

  async lock(config: Partial<IAppendStructureConfig>): Promise<string> {
    if (!config.appendStructureName) throw new Error('Append structure name is required');
    this.connection.setSessionType('stateful');
    return lockAppendStructure(this.connection, config.appendStructureName);
  }

  async unlock(config: Partial<IAppendStructureConfig>, lockHandle: string): Promise<IAppendStructureState> {
    if (!config.appendStructureName) throw new Error('Append structure name is required');
    this.connection.setSessionType('stateful');
    try {
      const unlockResult = await unlockAppendStructure(this.connection, config.appendStructureName, lockHandle);
      return { unlockResult, errors: [] };
    } finally {
      this.connection.setSessionType('stateless');
    }
  }
}
```

- [ ] **Step 4: Write `index.ts`**

```typescript
// src/core/appendStructure/index.ts
import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IAppendStructureConfig, IAppendStructureState } from './types';

export { AdtAppendStructure } from './AdtAppendStructure';
export * from './types';

export type AdtAppendStructureType = IAdtObject<IAppendStructureConfig, IAppendStructureState>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/unit/core/appendStructure/handler.test.ts --runInBand`
Expected: PASS (4 tests).

- [ ] **Step 6: Build + lint + commit**

```bash
npm run build:fast && npm run lint:check
git add src/core/appendStructure/AdtAppendStructure.ts src/core/appendStructure/index.ts src/__tests__/unit/core/appendStructure/handler.test.ts
git commit -m "feat(appendStructure): AdtAppendStructure handler (baseObject required, hardened session reset)"
```

---

## Task 13: Wire AppendStructure into AdtClient + public API

**Files:**
- Modify: `src/clients/AdtClient.ts` (import + factory near `getStructure()` ~line 276 / near `getScalarFunction()`)
- Modify: `src/index.ts`
- Test: `src/__tests__/unit/core/appendStructure/factory.test.ts`

**Interfaces:**
- Produces: `AdtClient.getAppendStructure(): IAdtObject<IAppendStructureConfig, IAppendStructureState>`; public exports.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/appendStructure/factory.test.ts
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../../clients/AdtClient';

describe('AdtClient.getAppendStructure', () => {
  it('returns a handler whose objectType is AppendStructure', () => {
    const client = new AdtClient({} as IAbapConnection);
    const handler = client.getAppendStructure();
    expect((handler as { objectType: string }).objectType).toBe('AppendStructure');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/appendStructure/factory.test.ts --runInBand`
Expected: FAIL — `getAppendStructure` is not a function.

- [ ] **Step 3: Add the import to `AdtClient.ts`**

```typescript
import {
  AdtAppendStructure,
  type IAppendStructureConfig,
  type IAppendStructureState,
} from '../core/appendStructure';
```

- [ ] **Step 4: Add the factory method to `AdtClient.ts`** (next to `getScalarFunction()`)

```typescript
  /**
   * Get high-level operations for Append Structure (TABL/DS) objects
   */
  getAppendStructure(): IAdtObject<IAppendStructureConfig, IAppendStructureState> {
    return new AdtAppendStructure(this.connection, this.logger, this.systemContext);
  }
```

- [ ] **Step 5: Add exports to `src/index.ts`** (next to the ScalarFunction exports)

```typescript
export { AdtAppendStructure } from './core/appendStructure';
export type {
  AdtAppendStructureType,
  IAppendStructureConfig,
  IAppendStructureState,
} from './core/appendStructure';
```

- [ ] **Step 6: Run test + full build**

Run: `npx jest src/__tests__/unit/core/appendStructure/factory.test.ts --runInBand`
Expected: PASS.
Run: `npm run build:fast && npm run lint:check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/clients/AdtClient.ts src/index.ts src/__tests__/unit/core/appendStructure/factory.test.ts
git commit -m "feat(AdtClient): expose getAppendStructure + public AppendStructure exports"
```

---

## Task 14: AppendStructure integration test + config (table + structure base)

**Files:**
- Create: `src/__tests__/integration/core/appendStructure/AppendStructure.test.ts`
- Modify: `src/__tests__/helpers/test-config.yaml.template`

**Interfaces:**
- Consumes: `AdtClient.getAppendStructure()`, the shared integration bootstrap/gating helpers.

- [ ] **Step 1: Read the reference integration test**

Read `src/__tests__/integration/core/serviceDefinition/ServiceDefinition.test.ts` (and `structure` if present) for the exact bootstrap + gating to reuse verbatim.

- [ ] **Step 2: Add config entries**

In `src/__tests__/helpers/test-config.yaml.template`, add:

```yaml
  append_structure:
    name: ZADT_S_APPEND             # ← CHANGE if needed
    base_structure: ZADT_BASE_STRU  # ← an existing structure to append to
    base_table: ZADT_BASE_TABLE     # ← an existing transparent table to append to
```

- [ ] **Step 3: Write the integration test (both bases, discovery-then-create gate)**

```typescript
// src/__tests__/integration/core/appendStructure/AppendStructure.test.ts
import {
  fetchDiscoveryEndpoints,
  isEndpointInDiscovery,
} from '../../../../utils/discoveryEndpoints';
// Reuse the SAME bootstrap/gating imports as ServiceDefinition.test.ts.

const SKIP_STATUSES = new Set([404, 405, 501]);
const STRUCTURES_ENDPOINT = '/sap/bc/adt/ddic/structures';

describe('AppendStructure (TABL/DS) integration', () => {
  // Bootstrap connection + AdtClient EXACTLY as ServiceDefinition.test.ts does.
  // const { client, connection, config } = ...

  const cases: Array<{ label: string; baseKey: 'base_structure' | 'base_table' }> = [
    { label: 'structure base', baseKey: 'base_structure' },
    { label: 'table base', baseKey: 'base_table' },
  ];

  for (const { label, baseKey } of cases) {
    it(`${label}: create → read → update → activate → delete`, async () => {
      const as = client.getAppendStructure();
      const name = `${config.appendStructureName}_${baseKey === 'base_table' ? 'T' : 'S'}`;
      const base = config[baseKey]; // resolved from test-config
      const pkg = config.packageName;

      let supported = false;
      try {
        const endpoints = await fetchDiscoveryEndpoints(connection);
        supported = isEndpointInDiscovery(endpoints, STRUCTURES_ENDPOINT);
      } catch { supported = false; }

      try { await as.delete({ appendStructureName: name }); } catch { /* ignore */ }

      try {
        await as.create({ appendStructureName: name, baseObject: base, packageName: pkg, description: 'ADT append test' });
        supported = true;
      } catch (e) {
        const status = (e as { response?: { status?: number } }).response?.status;
        if (!supported && status && SKIP_STATUSES.has(status)) {
          console.log(`SKIP: append structures unsupported on this system (status ${status})`);
          return;
        }
        throw e;
      }

      const source =
        `@EndUserText.label : 'ADT append test'\n` +
        `@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE\n` +
        `extend type ${base} with ${name} {\n  zz_append : abap.char( 10 );\n}`;
      await as.update({ appendStructureName: name, sourceCode: source }, { activateOnUpdate: true });

      const read = await as.read({ appendStructureName: name }, 'active');
      expect(read?.readResult?.status).toBe(200);

      const del = await as.delete({ appendStructureName: name });
      expect(del.deleteResult).toBeDefined();
    });
  }
});
```

- [ ] **Step 4: Type-check the integration test**

Run: `npm run test:check:integration`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/integration/core/appendStructure/AppendStructure.test.ts src/__tests__/helpers/test-config.yaml.template
git commit -m "test(appendStructure): integration suite covering structure + table base"
```

---

## Task 15: Full unit suite + final gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite for both modules + foundations**

Run: `npx jest src/__tests__/unit/utils/xml.test.ts src/__tests__/unit/utils/checkRunObjectUri.test.ts src/__tests__/unit/core/scalarFunction src/__tests__/unit/core/appendStructure --runInBand`
Expected: all green.

- [ ] **Step 2: Full build + lint + integration type-check**

Run: `npm run build && npm run test:check:integration`
Expected: clean build, no type errors. (`npm run build` runs lint + tsc.)

- [ ] **Step 3 (optional, requires live system + .env): run integration suites**

Run: `npm test -- integration/core/scalarFunction 2>&1 | tee test-run.log` then read `test-run.log`.
Run: `npm test -- integration/core/appendStructure 2>&1 | tee test-run.log` then read `test-run.log`.
Confirm: suites either pass or log a clear SKIP (404/405/501) — never a silent pass. Capture real
responses to confirm the provisional validation `objtype` values and (if validation 404s) leave
`validationSupported:false` behavior as designed.

- [ ] **Step 4: Delete the implemented specs and plan (per repo convention)**

Per `CLAUDE.md`, specs/plans live in-tree only while active. Once merged, remove them:

```bash
git rm docs/superpowers/specs/2026-06-22-scalar-function-dsfd-design.md \
       docs/superpowers/specs/2026-06-22-append-structure-design.md \
       docs/superpowers/plans/2026-06-22-dsfd-and-append-structure.md
git commit -m "chore(docs): remove implemented DSFD + append-structure specs and plan"
```

> Do this only after the feature is merged/accepted. While work is in progress, keep them.

---

## Self-Review

**Spec coverage (scalar function):** envelope/type/headers (T3), source/main update + read + lock/unlock (T4), check via checkRun mapping (T2,T5), activation/validation/delete (T5), handler chain + session-reset finally + validation fallback + create no-op (T6), factory + exports (T7), integration + skip gate (T8). ✓

**Spec coverage (append structure):** template envelope w/ `base_structure` + uppercase + escaping (T9), Accept:text/plain divergence + lock/unlock/read (T10), check mapping + activation/validation/delete + lowercase delete URIs (T2,T11), handler w/ required baseObject + hardening (T12), factory + exports (T13), integration covering BOTH bases (T14). ✓

**Cross-cutting:** shared `escapeXmlAttr` (T1), checkRun cases for all four type strings (T2), encoded `corrNr`/`lockHandle` (T4/T10), discovery-then-create skip contract (T8/T14). ✓

**Type consistency:** handler method names (`create/read/readMetadata/readTransport/update/delete/activate/check/lock/unlock/validate`) match `IAdtObject` usage across both modules; low-level function names referenced by handlers (Produces blocks) match their defining tasks; config field names (`scalarFunctionName`, `appendStructureName`, `baseObject`) are consistent between types, handler, factory, and tests. ✓

**Open items carried into execution (not blockers):** validation `objtype` values (`dsfdscf`, `tablds`) are provisional and self-heal via the narrow fallback; integration source bodies are illustrative and adjusted at run time to ones the target system activates.
