# ScalarFunctionImplementation (DSFI/SFI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full CRUD + lifecycle client for CDS scalar function implementations (`DSFI/SFI`),
exposed as `AdtClient.getScalarFunctionImplementation()`, completing the scalar-function feature.

**Architecture:** A self-contained core module `src/core/scalarFunctionImplementation/` that is a
near-exact mirror of `src/core/scalarFunction/` (already on this branch), differing in: base URL
`/sap/bc/adt/ddic/dsfi`, a blues **v2** create envelope carrying a base64 `additionalCreationProperties`
that binds the implementation to its scalar function (`{scalarFunctionName, engineValue}`), and a
concrete validation endpoint. Plus `buildObjectUri` cases so the consumer can group-activate the
DSFD+DSFI pair.

**Tech Stack:** TypeScript (strict, CommonJS), `fast-xml-parser`, Jest (`ts-jest`, `--runInBand`), Biome.

## Spec

`docs/superpowers/specs/2026-06-23-scalar-function-implementation-dsfi-design.md`

## Reference (read once)

- `src/core/scalarFunction/` — the template module. Every DSFI file is a copy of its scalarFunction
  counterpart with the deltas this plan lists. Read `create.ts`, `read.ts`, `update.ts`, `lock.ts`,
  `unlock.ts`, `check.ts`, `activation.ts`, `validation.ts`, `delete.ts`, `AdtScalarFunction.ts`,
  `index.ts`, `types.ts` before starting.
- `src/utils/checkRun.ts` (`getObjectUri`), `src/utils/activationUtils.ts` (`buildObjectUri`),
  `src/constants/contentTypes.ts`, `src/utils/xml.ts` (`escapeXmlAttr`).

## Global Constraints

- All code/comments in **English**. Biome: **single quotes, semicolons, 2-space indent**. `npm run lint:check` clean before each commit.
- Do **not** change `package.json` / jest configs / add dependencies. Do **not** add a new jest config.
- Unit tests run under the existing `jest.config.js`: `npx jest <path> --runInBand` (`.env` is configured; globalSetup connects to SAP).
- `noExplicitAny: warn` in production (`any` allowed only in test mocks).
- URL paths: name **lower-cased** + `encodeSapObjectName`-encoded. Create envelope: object identifiers (name, package) **upper-cased**; `scalarFunctionName` inside the JSON **upper-cased**.
- `corrNr` and `lockHandle` always `encodeURIComponent`-encoded.
- Create-envelope attribute values escaped via `escapeXmlAttr`.
- Session reset `setSessionType('stateless')` in a `finally` on update-cleanup and public `unlock()`.
- Narrow validation fallback: only HTTP **404/405/501** → `validationSupported:false`; everything else propagates.
- Build gate: `npm run build:fast && npm run lint:check`.

## File Structure

- Modify `src/constants/contentTypes.ts`, `src/utils/checkRun.ts`, `src/utils/activationUtils.ts`.
- Create `src/core/scalarFunctionImplementation/{types,create,read,update,lock,unlock,check,activation,validation,delete,AdtScalarFunctionImplementation,index}.ts`.
- Modify `src/clients/AdtClient.ts`, `src/index.ts`.
- Create unit tests under `src/__tests__/unit/core/scalarFunctionImplementation/`.
- Create integration test `src/__tests__/integration/core/scalarFunctionImplementation/ScalarFunctionImplementation.test.ts` + entry in `src/__tests__/helpers/test-config.yaml.template`.

---

## Task 1: Foundations — content types, checkRun + buildObjectUri mappings

**Files:**
- Modify: `src/constants/contentTypes.ts`, `src/utils/checkRun.ts`, `src/utils/activationUtils.ts`
- Test: `src/__tests__/unit/utils/dsfiMappings.test.ts`

**Interfaces:**
- Produces: `CT_SCALAR_FUNCTION_IMPL`, `ACCEPT_SCALAR_FUNCTION_IMPL`; `getObjectUri('scalar_function_implementation'|'dsfi/sfi', n)` → `/sap/bc/adt/ddic/dsfi/{lower}`; `buildObjectUri(n,'DSFI/SFI')` → `/sap/bc/adt/ddic/dsfi/{lower}` and `buildObjectUri(n,'DSFD/SCF')` → `/sap/bc/adt/ddic/dsfd/sources/{lower}`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/utils/dsfiMappings.test.ts
import { getObjectUri } from '../../../utils/checkRun';
import { buildObjectUri } from '../../../utils/activationUtils';

describe('DSFI/DSFD object-uri mappings', () => {
  it('checkRun.getObjectUri maps dsfi aliases', () => {
    expect(getObjectUri('scalar_function_implementation', 'ZOK_IMPL')).toBe(
      '/sap/bc/adt/ddic/dsfi/zok_impl',
    );
    expect(getObjectUri('dsfi/sfi', 'ZOK_IMPL')).toBe('/sap/bc/adt/ddic/dsfi/zok_impl');
  });

  it('buildObjectUri (group activation) maps DSFI/SFI and DSFD/SCF', () => {
    expect(buildObjectUri('ZOK_IMPL', 'DSFI/SFI')).toBe('/sap/bc/adt/ddic/dsfi/zok_impl');
    expect(buildObjectUri('ZOK_FUNC', 'DSFD/SCF')).toBe('/sap/bc/adt/ddic/dsfd/sources/zok_func');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/utils/dsfiMappings.test.ts --runInBand`
Expected: FAIL — `Unsupported object type` / wrong fallback URI.

- [ ] **Step 3: Add checkRun case**

In `src/utils/checkRun.ts` `getObjectUri`, after the `scalar_function`/`dsfd/scf` case:

```typescript
    case 'scalar_function_implementation':
    case 'dsfi/sfi':
      return `/sap/bc/adt/ddic/dsfi/${encodedName}`;
```

- [ ] **Step 4: Add buildObjectUri cases**

In `src/utils/activationUtils.ts`, inside the `switch (type.toUpperCase())`, add (near the other DDIC cases):

```typescript
    case 'DSFD/SCF':
      return `/sap/bc/adt/ddic/dsfd/sources/${lowerName}`;
    case 'DSFI/SFI':
      return `/sap/bc/adt/ddic/dsfi/${lowerName}`;
```

- [ ] **Step 5: Add content-type constants**

In `src/constants/contentTypes.ts`, after the scalar-function constants:

```typescript
// Scalar Function Implementations (DSFI/SFI) — blues v2 envelope
export const CT_SCALAR_FUNCTION_IMPL = 'application/vnd.sap.adt.blues.v2+xml';
export const ACCEPT_SCALAR_FUNCTION_IMPL =
  'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml';
```

- [ ] **Step 6: Run test + build + commit**

Run: `npx jest src/__tests__/unit/utils/dsfiMappings.test.ts --runInBand` → PASS (2).
Run: `npm run build:fast && npm run lint:check` → clean.

```bash
git add src/constants/contentTypes.ts src/utils/checkRun.ts src/utils/activationUtils.ts src/__tests__/unit/utils/dsfiMappings.test.ts
git commit -m "feat(checkRun,activationUtils,contentTypes): map DSFI/SFI + DSFD/SCF object types"
```

---

## Task 2: types + low-level create (blues v2 + base64 content)

**Files:**
- Create: `src/core/scalarFunctionImplementation/types.ts`, `create.ts`
- Test: `src/__tests__/unit/core/scalarFunctionImplementation/create.test.ts`

**Interfaces:**
- Produces: `ICreateScalarFunctionImplementationParams { implementation_name; scalar_function_name; engine_value?; description?; package_name; transport_request?; source_code?; masterSystem?; responsible?; masterLanguage? }`, `IUpdateScalarFunctionImplementationParams { implementation_name; source_code; transport_request? }`, `IDeleteScalarFunctionImplementationParams { implementation_name; transport_request? }`, `IScalarFunctionImplementationConfig { implementationName; scalarFunctionName; engineValue?; masterLanguage?; packageName?; transportRequest?; description?; sourceCode? }`, `IScalarFunctionImplementationState extends IAdtObjectState { validationSupported?: boolean }`.
- Produces: `create(connection, params): Promise<IAdtResponse>`; `buildServerDrivenContent(scalarFunctionName, engineValue): string` (base64).

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/scalarFunctionImplementation/create.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { create } from '../../../../core/scalarFunctionImplementation/create';

function mockConn(cap: { url?: string; data?: string; headers?: Record<string, string> }) {
  return {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      cap.url = r.url; cap.data = r.data; cap.headers = r.headers;
      return { status: 200, statusText: 'OK', headers: {}, data: '' } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
}

describe('scalarFunctionImplementation create', () => {
  it('POSTs blues v2 envelope with DSFI/SFI type + base64 server-driven content (sqlEngine default)', async () => {
    const cap: { url?: string; data?: string; headers?: Record<string, string> } = {};
    await create(mockConn(cap), {
      implementation_name: 'zok_test_func_sql',
      scalar_function_name: 'zok_test_func',
      package_name: 'zok_test',
      description: 'SF SQL Impl',
      masterSystem: 'TRL',
      responsible: 'CB9980008038',
    });
    expect(cap.url).toBe('/sap/bc/adt/ddic/dsfi');
    expect(cap.headers?.['Content-Type']).toBe('application/vnd.sap.adt.blues.v2+xml');
    expect(cap.data).toContain('adtcore:type="DSFI/SFI"');
    expect(cap.data).toContain('adtcore:name="ZOK_TEST_FUNC_SQL"');
    expect(cap.data).toContain('<adtcore:packageRef adtcore:name="ZOK_TEST"/>');
    expect(cap.data).toContain(
      '<adtcore:content adtcore:encoding="base64" adtcore:type="application/vnd.sap.adt.serverdriven.content.v1+json">',
    );
    // decode the base64 content
    const m = cap.data?.match(/serverdriven\.content\.v1\+json">([^<]+)</);
    const json = Buffer.from(m![1], 'base64').toString('utf-8');
    expect(json).toBe('{"scalarFunctionName":"ZOK_TEST_FUNC","engineValue":"sqlEngine"}');
  });

  it('honors engine_value=amdpEngine and encodes corrNr', async () => {
    const cap: { url?: string; data?: string } = {};
    await create(mockConn(cap as any), {
      implementation_name: 'zi',
      scalar_function_name: 'zf',
      package_name: 'zp',
      description: 'd',
      engine_value: 'amdpEngine',
      transport_request: 'TRLK9 1',
    });
    expect(cap.url).toBe('/sap/bc/adt/ddic/dsfi?corrNr=TRLK9%201');
    const m = cap.data?.match(/serverdriven\.content\.v1\+json">([^<]+)</);
    expect(Buffer.from(m![1], 'base64').toString('utf-8')).toBe(
      '{"scalarFunctionName":"ZF","engineValue":"amdpEngine"}',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/unit/core/scalarFunctionImplementation/create.test.ts --runInBand` → FAIL (module not found).

- [ ] **Step 3: Write `types.ts`**

```typescript
// src/core/scalarFunctionImplementation/types.ts
/**
 * ScalarFunctionImplementation (DSFI/SFI) module type definitions
 */
import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export type ScalarFunctionEngine = 'sqlEngine' | 'amdpEngine';

export interface ICreateScalarFunctionImplementationParams {
  implementation_name: string;
  scalar_function_name: string;
  engine_value?: ScalarFunctionEngine;
  description?: string;
  package_name: string;
  transport_request?: string;
  source_code?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IUpdateScalarFunctionImplementationParams {
  implementation_name: string;
  source_code: string;
  transport_request?: string;
}

export interface IDeleteScalarFunctionImplementationParams {
  implementation_name: string;
  transport_request?: string;
}

export interface IScalarFunctionImplementationConfig {
  implementationName: string;
  scalarFunctionName: string;
  engineValue?: ScalarFunctionEngine;
  masterLanguage?: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

export interface IScalarFunctionImplementationState extends IAdtObjectState {
  validationSupported?: boolean;
}
```

- [ ] **Step 4: Write `create.ts`**

```typescript
// src/core/scalarFunctionImplementation/create.ts
/**
 * ScalarFunctionImplementation create operations - Low-level functions
 * Metadata-only POST (blues v2 + server-driven content linking to the scalar function).
 */
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SCALAR_FUNCTION_IMPL,
  CT_SCALAR_FUNCTION_IMPL,
} from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { escapeXmlAttr } from '../../utils/xml';
import type {
  ICreateScalarFunctionImplementationParams,
  ScalarFunctionEngine,
} from './types';

/** base64 of {"scalarFunctionName":<upper>,"engineValue":<engine>} (key order fixed). */
export function buildServerDrivenContent(
  scalarFunctionName: string,
  engineValue: ScalarFunctionEngine,
): string {
  const json = JSON.stringify({
    scalarFunctionName: scalarFunctionName.toUpperCase(),
    engineValue,
  });
  return Buffer.from(json, 'utf-8').toString('base64');
}

export async function create(
  connection: IAbapConnection,
  args: ICreateScalarFunctionImplementationParams,
): Promise<AxiosResponse> {
  if (!args.implementation_name || !args.scalar_function_name || !args.package_name) {
    throw new Error(
      'Missing required parameters: implementation_name, scalar_function_name and package_name',
    );
  }

  const transport = args.transport_request?.trim();
  const url = `/sap/bc/adt/ddic/dsfi${transport ? `?corrNr=${encodeURIComponent(transport)}` : ''}`;

  const lang = args.masterLanguage || 'EN';
  const name = escapeXmlAttr(args.implementation_name.toUpperCase());
  const pkg = escapeXmlAttr(args.package_name.toUpperCase());
  const description = escapeXmlAttr(
    limitDescription(args.description || args.implementation_name),
  );
  const masterSystemAttr = args.masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(args.masterSystem)}"`
    : '';
  const responsibleAttr = args.responsible
    ? ` adtcore:responsible="${escapeXmlAttr(args.responsible)}"`
    : '';
  const content = buildServerDrivenContent(
    args.scalar_function_name,
    args.engine_value || 'sqlEngine',
  );

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${name}" adtcore:type="DSFI/SFI" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${pkg}"/>
  <blue:additionalCreationProperties>
    <adtcore:content adtcore:encoding="base64" adtcore:type="application/vnd.sap.adt.serverdriven.content.v1+json">${content}</adtcore:content>
  </blue:additionalCreationProperties>
</blue:blueSource>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept: ACCEPT_SCALAR_FUNCTION_IMPL,
      'Content-Type': CT_SCALAR_FUNCTION_IMPL,
    },
  });
}
```

- [ ] **Step 5: Run test → PASS (2). Build + commit**

```bash
npm run build:fast && npm run lint:check
git add src/core/scalarFunctionImplementation/types.ts src/core/scalarFunctionImplementation/create.ts src/__tests__/unit/core/scalarFunctionImplementation/create.test.ts
git commit -m "feat(scalarFunctionImplementation): types + low-level create (DSFI/SFI blues v2 + base64 content)"
```

---

## Task 3: read / update / lock / unlock

**Files:**
- Create: `src/core/scalarFunctionImplementation/{read,update,lock,unlock}.ts`
- Test: `src/__tests__/unit/core/scalarFunctionImplementation/wire.test.ts`

**Interfaces:**
- Produces: `getScalarFunctionImplementation(conn,name,version?,options?,logger?)` (metadata, Accept `ACCEPT_SCALAR_FUNCTION_IMPL`), `getScalarFunctionImplementationSource(...)` (Accept `ACCEPT_SOURCE`), `getScalarFunctionImplementationTransport(...)`, `updateScalarFunctionImplementation(conn,args,lockHandle)`, `lockScalarFunctionImplementation(conn,name): Promise<string>`, `unlockScalarFunctionImplementation(conn,name,lockHandle)`. Base URL `/sap/bc/adt/ddic/dsfi`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/scalarFunctionImplementation/wire.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { updateScalarFunctionImplementation } from '../../../../core/scalarFunctionImplementation/update';
import { getScalarFunctionImplementationSource } from '../../../../core/scalarFunctionImplementation/read';
import { unlockScalarFunctionImplementation } from '../../../../core/scalarFunctionImplementation/unlock';

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

describe('scalarFunctionImplementation wire', () => {
  it('update PUTs /source/main with encoded lockHandle+corrNr, text/plain', async () => {
    const { c, conn } = cap();
    await updateScalarFunctionImplementation(
      conn,
      { implementation_name: 'ZOK_IMPL', source_code: 'x', transport_request: 'TRLK9 1' },
      'LH/1',
    );
    expect(c.method).toBe('PUT');
    expect(c.url).toBe('/sap/bc/adt/ddic/dsfi/zok_impl/source/main?lockHandle=LH%2F1&corrNr=TRLK9%201');
    expect(c.headers?.['Content-Type']).toBe('text/plain; charset=utf-8');
  });

  it('read source GETs /source/main with version + Accept text/plain', async () => {
    const { c, conn } = cap();
    await getScalarFunctionImplementationSource(conn, 'ZOK_IMPL', 'inactive');
    expect(c.url).toBe('/sap/bc/adt/ddic/dsfi/zok_impl/source/main?version=inactive');
    expect(c.headers?.Accept).toBe('text/plain');
  });

  it('unlock POSTs _action=UNLOCK with encoded lockHandle', async () => {
    const { c, conn } = cap();
    await unlockScalarFunctionImplementation(conn, 'ZOK_IMPL', 'LH/1');
    expect(c.url).toBe('/sap/bc/adt/ddic/dsfi/zok_impl?_action=UNLOCK&lockHandle=LH%2F1');
  });
});
```

- [ ] **Step 2: Run → FAIL (modules not found).**

- [ ] **Step 3: Create the four files by copying the scalarFunction equivalents with these exact transformations.**

For each of `read.ts`, `update.ts`, `lock.ts`, `unlock.ts`: copy `src/core/scalarFunction/<file>.ts` to `src/core/scalarFunctionImplementation/<file>.ts` and apply:
- Rename every exported function `XxxScalarFunction` → `XxxScalarFunctionImplementation` (e.g. `getScalarFunctionSource`→`getScalarFunctionImplementationSource`, `updateScalarFunction`→`updateScalarFunctionImplementation`, `lockScalarFunction`→`lockScalarFunctionImplementation`, `unlockScalarFunction`→`unlockScalarFunctionImplementation`, and the metadata reader `getScalarFunction`→`getScalarFunctionImplementation`).
- Replace the base path `/sap/bc/adt/ddic/dsfd/sources` → `/sap/bc/adt/ddic/dsfi` everywhere.
- In `read.ts`, change the metadata Accept import/use from `ACCEPT_SCALAR_FUNCTION` → `ACCEPT_SCALAR_FUNCTION_IMPL`. Keep `ACCEPT_SOURCE` for the source read and `ACCEPT_TRANSPORT` for transport.
- In `update.ts`, the param type is `IUpdateScalarFunctionImplementationParams` and the field is `args.implementation_name` (was `scalar_function_name`).
- All other logic (encodeSapObjectName(name.toLowerCase()), encodeURIComponent for lockHandle/corrNr, CT_SOURCE, XMLParser LOCK_HANDLE extraction, `?_action=LOCK&accessMode=MODIFY`) stays identical.

- [ ] **Step 4: Run → PASS (3). Build + commit.**

```bash
npm run build:fast && npm run lint:check
git add src/core/scalarFunctionImplementation/read.ts src/core/scalarFunctionImplementation/update.ts src/core/scalarFunctionImplementation/lock.ts src/core/scalarFunctionImplementation/unlock.ts src/__tests__/unit/core/scalarFunctionImplementation/wire.test.ts
git commit -m "feat(scalarFunctionImplementation): read/update/lock/unlock wire functions"
```

---

## Task 4: check / activation / validation / delete

**Files:**
- Create: `src/core/scalarFunctionImplementation/{check,activation,validation,delete}.ts`
- Test: `src/__tests__/unit/core/scalarFunctionImplementation/delete.test.ts`

**Interfaces:**
- Produces: `checkScalarFunctionImplementation(conn,name,version?,sourceCode?)` (uses `runCheckRun(conn,'scalar_function_implementation',...)`), `activateScalarFunctionImplementation(conn,name)`, `validateScalarFunctionImplementationName(conn,name,description?)`, `checkDeletion(conn,params)`, `deleteScalarFunctionImplementation(conn,params)`.

- [ ] **Step 1: Write the failing test (lowercased delete URIs)**

```typescript
// src/__tests__/unit/core/scalarFunctionImplementation/delete.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import {
  checkDeletion,
  deleteScalarFunctionImplementation,
} from '../../../../core/scalarFunctionImplementation/delete';

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

describe('scalarFunctionImplementation delete', () => {
  it('checkDeletion uses the lower-cased dsfi URI', async () => {
    const { calls, conn } = capConn();
    await checkDeletion(conn, { implementation_name: 'ZOK_IMPL' });
    expect(calls[0].data).toContain('adtcore:uri="/sap/bc/adt/ddic/dsfi/zok_impl"');
  });

  it('delete uses the lower-cased dsfi URI', async () => {
    const { calls, conn } = capConn();
    await deleteScalarFunctionImplementation(conn, { implementation_name: 'ZOK_IMPL' });
    expect(calls[0].data).toContain('adtcore:uri="/sap/bc/adt/ddic/dsfi/zok_impl"');
  });
});
```

- [ ] **Step 2: Run → FAIL (module not found).**

- [ ] **Step 3: Create `check.ts`, `activation.ts`, `delete.ts` by copying the scalarFunction equivalents with these transformations:**
- `check.ts`: rename `checkScalarFunction`→`checkScalarFunctionImplementation`; `runCheckRun(connection, 'scalar_function', ...)` → `runCheckRun(connection, 'scalar_function_implementation', ...)`; error text `Scalar function check failed:` → `Scalar function implementation check failed:`.
- `activation.ts`: rename `activateScalarFunction`→`activateScalarFunctionImplementation`; URI base `/sap/bc/adt/ddic/dsfd/sources/` → `/sap/bc/adt/ddic/dsfi/`; messages `Scalar function` → `Scalar function implementation`.
- `delete.ts`: rename functions to `*ScalarFunctionImplementation`; param type `IDeleteScalarFunctionImplementationParams`, field `implementation_name`; `objectUri` base `/sap/bc/adt/ddic/dsfi/`; result `data` keys use `implementation_name`/message accordingly.

- [ ] **Step 4: Write `validation.ts` (concrete endpoint, NOT provisional)**

```typescript
// src/core/scalarFunctionImplementation/validation.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate DSFI name. Endpoint confirmed present in system discovery
 * (category dsfisfi/validation): POST /sap/bc/adt/ddic/dsfi/validation?objtype=dsfisfi
 */
export async function validateScalarFunctionImplementationName(
  connection: IAbapConnection,
  name: string,
  description?: string,
): Promise<AxiosResponse> {
  const queryParams = new URLSearchParams({ objtype: 'dsfisfi', objname: name });
  if (description) queryParams.append('description', description);
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/ddic/dsfi/validation?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VALIDATION },
  });
}
```

- [ ] **Step 5: Run → PASS (2). Build + commit.**

```bash
npm run build:fast && npm run lint:check
git add src/core/scalarFunctionImplementation/check.ts src/core/scalarFunctionImplementation/activation.ts src/core/scalarFunctionImplementation/validation.ts src/core/scalarFunctionImplementation/delete.ts src/__tests__/unit/core/scalarFunctionImplementation/delete.test.ts
git commit -m "feat(scalarFunctionImplementation): check/activation/validation(dsfisfi)/delete low-level functions"
```

---

## Task 5: AdtScalarFunctionImplementation handler + index

**Files:**
- Create: `src/core/scalarFunctionImplementation/AdtScalarFunctionImplementation.ts`, `index.ts`
- Test: `src/__tests__/unit/core/scalarFunctionImplementation/handler.test.ts`

**Interfaces:**
- Produces: `class AdtScalarFunctionImplementation implements IAdtObject<IScalarFunctionImplementationConfig, IScalarFunctionImplementationState>`, `objectType='ScalarFunctionImplementation'`; `AdtScalarFunctionImplementationType`. Behaviors mirror `AdtScalarFunction`: create metadata-only (requires `scalarFunctionName`), update lock→check→PUT→long-poll read→unlock(finally stateless)→check→optional activate+long-poll, validate 404/405/501 fallback, read 404→undefined, public unlock finally-stateless.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/scalarFunctionImplementation/handler.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtScalarFunctionImplementation } from '../../../../core/scalarFunctionImplementation/AdtScalarFunctionImplementation';

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

const LOCK_XML =
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH1</LOCK_HANDLE></DATA></asx:values></asx:abap>';

describe('AdtScalarFunctionImplementation handler', () => {
  it('create() requires scalarFunctionName', async () => {
    const { conn } = makeConn(() => ({ data: '' }));
    const h = new AdtScalarFunctionImplementation(conn);
    await expect(
      h.create({ implementationName: 'ZI', packageName: 'ZP', description: 'd' } as any),
    ).rejects.toThrow(/scalar function/i);
  });

  it('create() is metadata-only (one POST, no lock/update)', async () => {
    const { conn, calls } = makeConn(() => ({ data: '' }));
    const h = new AdtScalarFunctionImplementation(conn);
    await h.create({ implementationName: 'ZI', scalarFunctionName: 'ZF', packageName: 'ZP', description: 'd', sourceCode: 'x' }, { sourceCode: 'y' });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/ddic/dsfi');
  });

  it('update() happy path: PUT then long-poll GET(active,withLongPolling); ends stateless', async () => {
    const { conn, calls, sessionTypes } = makeConn((r) => {
      if (r.url.includes('_action=LOCK')) return { data: LOCK_XML };
      return { data: '' };
    });
    const h = new AdtScalarFunctionImplementation(conn);
    await h.update({ implementationName: 'ZI', scalarFunctionName: 'ZF', sourceCode: 'src' });
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toContain('/sap/bc/adt/ddic/dsfi/zi/source/main');
    const poll = calls.find((c) => c.method === 'GET' && c.url.includes('version=active') && c.url.includes('withLongPolling=true'));
    expect(poll).toBeDefined();
    expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
  });

  it('read() returns undefined on 404', async () => {
    const { conn } = makeConn(() => Object.assign(new Error('nf'), { response: { status: 404 } }));
    const h = new AdtScalarFunctionImplementation(conn);
    expect(await h.read({ implementationName: 'ZI' })).toBeUndefined();
  });

  it('validate() maps 405 → validationSupported:false; public unlock resets stateless on throw', async () => {
    const v = makeConn(() => Object.assign(new Error('no'), { response: { status: 405 } }));
    const hv = new AdtScalarFunctionImplementation(v.conn);
    expect((await hv.validate({ implementationName: 'ZI' })).validationSupported).toBe(false);

    const u = makeConn((r) => (r.url.includes('_action=UNLOCK') ? new Error('boom') : { data: '' }));
    const hu = new AdtScalarFunctionImplementation(u.conn);
    await expect(hu.unlock({ implementationName: 'ZI' }, 'LH1')).rejects.toThrow('boom');
    expect(u.sessionTypes[u.sessionTypes.length - 1]).toBe('stateless');
  });
});
```

- [ ] **Step 2: Run → FAIL (module not found).**

- [ ] **Step 3: Create `AdtScalarFunctionImplementation.ts` by copying `src/core/scalarFunction/AdtScalarFunction.ts` and applying:**
- Class/type rename `AdtScalarFunction`→`AdtScalarFunctionImplementation`, config/state types → `IScalarFunctionImplementationConfig`/`IScalarFunctionImplementationState`, `objectType = 'ScalarFunctionImplementation'`.
- Imports from `./create|read|update|lock|unlock|check|activation|validation|delete` resolve to the renamed functions (`*ScalarFunctionImplementation*`).
- Everywhere the config field `config.scalarFunctionName` was used as the OBJECT name, use `config.implementationName` (the DSFI's own name) for read/update/lock/unlock/check/activate/delete/validate. **Exception:** `create()` ALSO requires and forwards `config.scalarFunctionName` (the function it implements) and `config.engineValue` to the low-level `create` params (`scalar_function_name`, `engine_value`) — alongside `implementation_name`, `package_name`, `description`, masterSystem/responsible/masterLanguage from systemContext/config.
- `create()` validation: require `implementationName`, `scalarFunctionName`, `packageName`, `description` (throw with clear messages). Keep metadata-only (no source upload).
- Long-poll reads (after PUT, after activate) call `this.read({ implementationName: config.implementationName }, 'active', { withLongPolling: true })`.

- [ ] **Step 4: Write `index.ts`**

```typescript
// src/core/scalarFunctionImplementation/index.ts
import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type {
  IScalarFunctionImplementationConfig,
  IScalarFunctionImplementationState,
} from './types';

export { AdtScalarFunctionImplementation } from './AdtScalarFunctionImplementation';
export * from './types';

export type AdtScalarFunctionImplementationType = IAdtObject<
  IScalarFunctionImplementationConfig,
  IScalarFunctionImplementationState
>;
```

- [ ] **Step 5: Run → PASS (5). Build + commit.**

```bash
npm run build:fast && npm run lint:check
git add src/core/scalarFunctionImplementation/AdtScalarFunctionImplementation.ts src/core/scalarFunctionImplementation/index.ts src/__tests__/unit/core/scalarFunctionImplementation/handler.test.ts
git commit -m "feat(scalarFunctionImplementation): AdtScalarFunctionImplementation handler (metadata-only create, hardened lifecycle)"
```

---

## Task 6: Wire into AdtClient + public API

**Files:**
- Modify: `src/clients/AdtClient.ts`, `src/index.ts`
- Test: `src/__tests__/unit/core/scalarFunctionImplementation/factory.test.ts`

**Interfaces:**
- Produces: `AdtClient.getScalarFunctionImplementation(): IAdtObject<IScalarFunctionImplementationConfig, IScalarFunctionImplementationState>`; public exports of class + types.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/core/scalarFunctionImplementation/factory.test.ts
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../../clients/AdtClient';

describe('AdtClient.getScalarFunctionImplementation', () => {
  it('returns a handler whose objectType is ScalarFunctionImplementation', () => {
    const client = new AdtClient({} as IAbapConnection);
    const handler = client.getScalarFunctionImplementation();
    expect((handler as { objectType: string }).objectType).toBe('ScalarFunctionImplementation');
  });
});
```

- [ ] **Step 2: Run → FAIL (`getScalarFunctionImplementation` is not a function).**

- [ ] **Step 3: Add import to `AdtClient.ts`** (next to the `../core/scalarFunction` import):

```typescript
import {
  AdtScalarFunctionImplementation,
  type IScalarFunctionImplementationConfig,
  type IScalarFunctionImplementationState,
} from '../core/scalarFunctionImplementation';
```

- [ ] **Step 4: Add the factory method** (immediately after `getScalarFunction()`):

```typescript
  /**
   * Get high-level operations for Scalar Function Implementation (DSFI/SFI) objects
   */
  getScalarFunctionImplementation(): IAdtObject<
    IScalarFunctionImplementationConfig,
    IScalarFunctionImplementationState
  > {
    return new AdtScalarFunctionImplementation(
      this.connection,
      this.logger,
      this.systemContext,
    );
  }
```

- [ ] **Step 5: Add exports to `src/index.ts`** (next to the ScalarFunction exports):

```typescript
export { AdtScalarFunctionImplementation } from './core/scalarFunctionImplementation';
export type {
  AdtScalarFunctionImplementationType,
  IScalarFunctionImplementationConfig,
  IScalarFunctionImplementationState,
} from './core/scalarFunctionImplementation';
```

- [ ] **Step 6: Run → PASS. Full build + commit.**

```bash
npx jest src/__tests__/unit/core/scalarFunctionImplementation/factory.test.ts --runInBand
npm run build:fast && npm run lint:check
git add src/clients/AdtClient.ts src/index.ts src/__tests__/unit/core/scalarFunctionImplementation/factory.test.ts
git commit -m "feat(AdtClient): expose getScalarFunctionImplementation + public exports"
```

---

## Task 7: Integration test + config template

**Files:**
- Create: `src/__tests__/integration/core/scalarFunctionImplementation/ScalarFunctionImplementation.test.ts`
- Modify: `src/__tests__/helpers/test-config.yaml.template`

**Interfaces:**
- Consumes: `AdtClient.getScalarFunctionImplementation()`, `AdtClient.getScalarFunction()`, the shared integration bootstrap/gating used by `src/__tests__/integration/core/scalarFunction/ScalarFunction.test.ts`.

- [ ] **Step 1: Read the reference** `src/__tests__/integration/core/scalarFunction/ScalarFunction.test.ts` end-to-end and reuse its EXACT bootstrap (dotenv/MCP_ENV_PATH, loggers, `beforeAll` with `connect()`/`isCloudEnvironment`/`resolveSystemContext`/`createTestAdtClient`, suite-scope `hasConfig`/`isCloudSystem`, `TestConfigResolver`, `getEnabledTestCase`, skip gate). Also read how `create_scalar_function` is shaped in the template.

- [ ] **Step 2: Add the config template entry** to `src/__tests__/helpers/test-config.yaml.template`:

```yaml
create_scalar_function_implementation:
  test_cases:
    - name: "adt_scalar_function_implementation"
      enabled: true
      description: "DSFI reserved for AdtScalarFunctionImplementation tests"
      params:
        implementation_name: "ZADT_SCALAR_FUNC_SQL"  # ← CHANGE if needed
        scalar_function_name: "ZADT_SCALAR_FUNC"     # companion DSFD created by the test
        engine_value: "sqlEngine"
        description: "AdtScalarFunctionImplementation integration test"
        # package_name: "ZAC_PKG01"  # Uses environment.default_package if omitted
        # REQUIRED to run the suite — without BOTH sources the whole DSFI suite SKIPS.
        # scalar_function_source_code: the DSFD signature; source_code: the DSFI sqlEngine body.
        # Exact valid syntax is confirmed live during implementation and stored here.
        # scalar_function_source_code: |
        #   define scalar function ZADT_SCALAR_FUNC
        #     with parameters p_input : abap.int4
        #     returns abap.int4
        # source_code: |
        #   <DSFI sqlEngine body — confirmed live>
```

- [ ] **Step 3: Write the integration test** mirroring the scalarFunction bootstrap, with the required-source skip gate and the full flow.

```typescript
// src/__tests__/integration/core/scalarFunctionImplementation/ScalarFunctionImplementation.test.ts
// Reuse the SAME bootstrap/import block as ScalarFunction.test.ts (loggers, dotenv,
// beforeAll connect + resolveSystemContext + createTestAdtClient, hasConfig/isCloudSystem).
import { getEnabledTestCase } from '../../../helpers/test-helper';
// ...same imports as the reference test...

const SKIP_STATUSES = new Set([404, 405, 501]);

describe('ScalarFunctionImplementation (DSFI/SFI) integration', () => {
  // const { client, connection, config bootstrap } EXACTLY as ScalarFunction.test.ts

  it(
    'companion DSFD signature → DSFI create → update → read → readMetadata → delete',
    async () => {
      const testCase = getEnabledTestCase(
        'create_scalar_function_implementation',
        'adt_scalar_function_implementation',
      );
      const sigSource: string | undefined = testCase?.params?.scalar_function_source_code;
      const implSource: string | undefined = testCase?.params?.source_code;

      // REQUIRED-source gate: without BOTH sources, skip the WHOLE suite (no downgrade).
      if (!hasConfig || !sigSource || !implSource) {
        // logTestSkip(...): 'requires scalar_function_source_code + source_code'
        return;
      }

      const sf = client.getScalarFunction();
      const dsfi = client.getScalarFunctionImplementation();
      const funcName = testCase!.params!.scalar_function_name as string;
      const implName = testCase!.params!.implementation_name as string;
      const packageName = resolver.getPackageName() || (testCase!.params!.package_name as string);

      // idempotent cleanup (impl first, then function)
      try { await dsfi.delete({ implementationName: implName }); } catch { /* ignore */ }
      try { await sf.delete({ scalarFunctionName: funcName }); } catch { /* ignore */ }

      // 1) companion DSFD + signature (inactive, no activate)
      try {
        await sf.create({ scalarFunctionName: funcName, packageName, description: 'companion' });
      } catch (e) {
        const s = (e as { response?: { status?: number } }).response?.status;
        if (s && SKIP_STATUSES.has(s)) { /* logTestSkip */ return; }
        throw e;
      }
      const sfLock = await sf.lock({ scalarFunctionName: funcName });
      await sf.update({ scalarFunctionName: funcName, sourceCode: sigSource }, { lockHandle: sfLock });
      await sf.unlock({ scalarFunctionName: funcName }, sfLock);

      // 2) DSFI create
      try {
        await dsfi.create({ implementationName: implName, scalarFunctionName: funcName, engineValue: 'sqlEngine', packageName, description: 'impl' });
      } catch (e) {
        const s = (e as { response?: { status?: number } }).response?.status;
        if (s && SKIP_STATUSES.has(s)) { try { await sf.delete({ scalarFunctionName: funcName }); } catch {} /* logTestSkip */ return; }
        throw e;
      }

      // 3) DSFI update source (exercises PUT /source/main, lock/unlock, check)
      await dsfi.update({ implementationName: implName, sourceCode: implSource });

      // 4) DSFI read source + 5) readMetadata
      const read = await dsfi.read({ implementationName: implName }, 'inactive');
      expect(read?.readResult).toBeDefined();
      const meta = await dsfi.readMetadata({ implementationName: implName });
      expect(meta.metadataResult).toBeDefined();

      // 6) cleanup both
      await dsfi.delete({ implementationName: implName });
      await sf.delete({ scalarFunctionName: funcName });
    },
    getTimeout('test'),
  );
});
```

> The DSFD signature `update` uses the low-level `{ lockHandle }` path (no activate) so the
> signature is saved inactive without requiring the implementation to exist yet. The DSFI `update`
> uses the full chain. Adjust `sigSource`/`implSource` live so check passes; if the system rejects
> the inactive signature save, fall back to the standard `update` (the goal is a coherent pair the
> DSFI can be checked against).

- [ ] **Step 4: Type-check** `npm run test:check:integration` → clean. `npm run lint:check` → clean.

- [ ] **Step 5: Commit.**

```bash
git add src/__tests__/integration/core/scalarFunctionImplementation/ScalarFunctionImplementation.test.ts src/__tests__/helpers/test-config.yaml.template
git commit -m "test(scalarFunctionImplementation): integration suite (companion DSFD + DSFI create/update/read/readMetadata/delete)"
```

---

## Task 8: Full gate + live validation

- [ ] **Step 1: Full unit suite for the new module + foundations**

Run: `npx jest src/__tests__/unit/utils/dsfiMappings.test.ts src/__tests__/unit/core/scalarFunctionImplementation --runInBand` → all green.

- [ ] **Step 2: Full build + integration type-check**

Run: `npm run build && npm run test:check:integration` → clean.

- [ ] **Step 3 (live, needs `.env` from `trial.env`): determine the real DSFI sqlEngine + DSFD signature sources, fill `test-config.yaml`, run the suite**

Refresh `.env` from `trial.env`. Add `create_scalar_function_implementation` to the real
`src/__tests__/helpers/test-config.yaml` with `scalar_function_source_code` + `source_code` set to
syntactically valid values (iterate against the system until `check` passes — same approach used for
DSFD/append). Run:
`npm test -- integration/core/scalarFunctionImplementation 2>&1 | tee test-dsfi.log` then read the log.
Confirm: create POST accepted (base64 content), PUT `/source/main`, read + readMetadata, delete —
green. If `check` rejects a source, adjust the source (this is the live wire-contract confirmation
the spec calls for). Record the confirmed source in `test-config.yaml`.

- [ ] **Step 4: Delete the implemented spec + plan after merge** (per `CLAUDE.md`):

```bash
git rm docs/superpowers/specs/2026-06-23-scalar-function-implementation-dsfi-design.md \
       docs/superpowers/plans/2026-06-23-scalar-function-implementation-dsfi.md
git commit -m "chore(docs): remove implemented DSFI spec and plan"
```

---

## Self-Review

**Spec coverage:** content types + checkRun + buildObjectUri (T1); types + create blues v2 + base64 content + both engines (T2); read/update/lock/unlock with dsfi URLs (T3); check/activation/concrete validation/delete lowercased URIs (T4); handler with metadata-only create requiring scalarFunctionName + hardened lifecycle + long-poll (T5); factory + exports (T6); integration with companion DSFD + required-source gate + readMetadata step (T7); gate + live confirmation (T8). ✓

**Placeholders:** mechanical mirror files (T3/T4/T5) reference the concrete scalarFunction source files in-repo with an explicit, exhaustive list of string transformations — not "similar to a task". Full code is given for every non-mechanical file (create, validation, types, index) and every test. ✓

**Type consistency:** config field `implementationName` is the DSFI object name (read/update/lock/etc.); `scalarFunctionName` + `engineValue` are create-only (forwarded to `scalar_function_name`/`engine_value`); low-level functions named `*ScalarFunctionImplementation*`; checkRun key `scalar_function_implementation`; buildObjectUri types `DSFI/SFI` + `DSFD/SCF`. Consistent across tasks. ✓

**Open items carried to execution:** exact DSFI sqlEngine body + DSFD signature source syntax confirmed live in T8; source/main + metadata Accept confirmed by the T7 integration test.
