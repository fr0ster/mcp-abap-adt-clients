# AuthorizationField & FunctionInclude Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new ADT object types — `authorizationField` (SUSO / `AUTH`) and `functionInclude` (`FUGR/I`) — as core modules following the existing `IAdtObject<Config, State>` architecture, with full CRUD + lifecycle, content-type registry entries, `AdtClient` factory wiring, public exports, and integration tests.

**Architecture:**
- `authorizationField` is DDIC-style XML-only — structurally modelled on `src/core/dataElement/`. Endpoint `/sap/bc/adt/aps/iam/auth/{name}`, Content-Type `application/vnd.sap.adt.blues.v1+xml`.
- `functionInclude` is source-bearing, nested under a function group — structurally modelled on `src/core/program/` + parent-aware URL composition. Endpoint `/sap/bc/adt/functions/groups/{groupName}/includes/{includeName}`, metadata Content-Type `application/vnd.sap.adt.functions.fincludes.v2+xml`, source at `.../source/main` with `text/plain`.
- Both reuse the existing infrastructure: shared `ADTObject` lock/unlock contract (`?_action=LOCK|UNLOCK`), `checkruns` check flow, `/sap/bc/adt/activation` activation, `TestConfigResolver` test wiring, `IAdtContentTypes` for header resolution, `wrapConnectionAcceptNegotiation` for 406 handling.

**Tech Stack:** TypeScript strict, CommonJS output, Node.js ≥18, Biome (lint+format), `fast-xml-parser` for XML, `axios` (via connection), Jest for integration tests. No new runtime dependencies.

**Verification source:** Contracts taken from `docs/superpowers/specs/2026-04-18-auth-field-and-function-include-design.md`, cross-checked against `~/prj/sapcli` reference implementation and `docs/discovery/discovery_e19_raw.xml` + `endpoints_*.txt`.

**Endpoints (canonical — do not re-derive):**
- AuthField collection: `/sap/bc/adt/aps/iam/auth`
- AuthField object: `/sap/bc/adt/aps/iam/auth/{name}`
- AuthField validation: `/sap/bc/adt/aps/iam/auth/validation`
- FunctionInclude collection: `/sap/bc/adt/functions/groups/{groupName}/includes`
- FunctionInclude object: `/sap/bc/adt/functions/groups/{groupName}/includes/{includeName}`
- FunctionInclude source: `/sap/bc/adt/functions/groups/{groupName}/includes/{includeName}/source/main`

**XML namespaces:**
- AuthField: `xmlns:auth="http://www.sap.com/iam/auth"`, `xmlns:adtcore="http://www.sap.com/adt/core"`
- FunctionInclude: `xmlns:finclude="http://www.sap.com/adt/functions/fincludes"`, `xmlns:adtcore="http://www.sap.com/adt/core"`

---

## File Structure

### authorizationField (12 files)

```
src/core/authorizationField/
  AdtAuthorizationField.ts   # handler class, operation chains
  types.ts                   # IAuthorizationFieldConfig, IAuthorizationFieldState, ICreateAuthorizationFieldParams
  create.ts                  # POST /aps/iam/auth
  read.ts                    # GET /aps/iam/auth/{name}
  update.ts                  # PUT /aps/iam/auth/{name}?lockHandle=
  delete.ts                  # POST /deletion/check + /deletion/delete
  lock.ts                    # POST /aps/iam/auth/{name}?_action=LOCK
  unlock.ts                  # POST /aps/iam/auth/{name}?_action=UNLOCK
  check.ts                   # POST /checkruns?reporters=abapCheckRun
  activation.ts              # POST /activation
  validation.ts              # POST /aps/iam/auth/validation
  index.ts                   # public re-exports
```

### functionInclude (13 files)

```
src/core/functionInclude/
  AdtFunctionInclude.ts
  types.ts
  create.ts                  # POST /functions/groups/{group}/includes
  read.ts                    # GET /functions/groups/{group}/includes/{name}
  readSource.ts              # GET .../source/main
  update.ts                  # PUT /functions/groups/{group}/includes/{name}?lockHandle= (metadata XML)
  updateSource.ts            # PUT .../source/main?lockHandle= (text/plain)
  delete.ts                  # POST /deletion/check + /deletion/delete
  lock.ts                    # POST .../{name}?_action=LOCK
  unlock.ts                  # POST .../{name}?_action=UNLOCK
  check.ts                   # POST /checkruns?reporters=abapCheckRun (with source via contentTypes)
  activation.ts              # POST /activation
  validation.ts              # POST /functions/groups/validation (reusing function-group validation endpoint; verify during bring-up)
  index.ts
```

### Shared / integration

```
src/core/shared/contentTypes.ts             # add 5 methods: authorizationFieldCreate/Read/Update, functionIncludeCreate/Read/Update (+Source)
src/clients/AdtClient.ts                    # add getAuthorizationField(), getFunctionInclude()
src/index.ts                                # export IXxxConfig, IXxxState, classes
src/__tests__/integration/core/authorizationField/AuthorizationField.test.ts
src/__tests__/integration/core/functionInclude/FunctionInclude.test.ts
src/__tests__/helpers/test-config.yaml.template  # add authorization_field and function_include sections
CLAUDE.md                                   # bump count 22 → 24, add to type list
```

---

## Phase A: authorizationField module

### Task A1: Scaffold authorizationField directory and types

**Files:**
- Create: `src/core/authorizationField/types.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/core/authorizationField
```

- [ ] **Step 2: Write `types.ts`**

```typescript
/**
 * AuthorizationField (SUSO / AUTH) module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export interface ICreateAuthorizationFieldParams {
  authorization_field_name: string;   // required
  description?: string;               // required for create
  package_name: string;               // required
  transport_request?: string;
  master_system?: string;
  responsible?: string;

  // content — auth:content element
  field_name?: string;
  roll_name?: string;                 // data element reference
  check_table?: string;
  exit_fb?: string;
  abap_language_version?: string;
  search?: string;
  objexit?: string;
  domname?: string;
  outputlen?: string;
  convexit?: string;
  orglvlinfo?: string;
  col_searchhelp?: string;
  col_searchhelp_name?: string;
  col_searchhelp_descr?: string;
}

export interface IAuthorizationFieldConfig {
  authorizationFieldName: string;
  packageName?: string;               // required for create
  description?: string;               // required for create/validate
  transportRequest?: string;
  masterSystem?: string;
  responsible?: string;

  fieldName?: string;
  rollName?: string;
  checkTable?: string;
  exitFb?: string;
  abapLanguageVersion?: string;
  search?: string;
  objexit?: string;
  domname?: string;
  outputlen?: string;
  convexit?: string;
  orglvlinfo?: string;
  colSearchhelp?: string;
  colSearchhelpName?: string;
  colSearchhelpDescr?: string;

  onLock?: (lockHandle: string) => void;
}

export interface IAuthorizationFieldState extends IAdtObjectState {}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/authorizationField/types.ts
git commit -m "feat(authorizationField): add type definitions"
```

---

### Task A2: Implement `create.ts`

**Files:**
- Create: `src/core/authorizationField/create.ts`
- Reference: `src/core/dataElement/create.ts`

- [ ] **Step 1: Read `src/core/dataElement/create.ts`** — this is the closest DDIC-style template. Copy its structure.

- [ ] **Step 2: Write `create.ts`**

```typescript
import type { AxiosResponse } from 'axios';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ICreateAuthorizationFieldParams } from './types';

const NS_ADTCORE = 'http://www.sap.com/adt/core';
const NS_AUTH = 'http://www.sap.com/iam/auth';

export async function create(
  connection: IAbapConnection,
  args: ICreateAuthorizationFieldParams,
): Promise<AxiosResponse> {
  const name = args.authorization_field_name.toUpperCase();
  const description = args.description ?? '';
  const pkg = args.package_name;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<auth:authorizationField xmlns:auth="${NS_AUTH}" xmlns:adtcore="${NS_ADTCORE}" ` +
    `adtcore:name="${name}" adtcore:type="AUTH" adtcore:description="${escapeXml(description)}">` +
    `<adtcore:packageRef adtcore:name="${pkg}"/>` +
    `<auth:content>` +
    buildContentFields(args) +
    `</auth:content>` +
    `</auth:authorizationField>`;

  const params: Record<string, string> = {};
  if (args.transport_request) params.corrNr = args.transport_request;

  return connection.makeAdtRequest({
    method: 'POST',
    url: '/sap/bc/adt/aps/iam/auth',
    headers: {
      'Content-Type': 'application/vnd.sap.adt.blues.v1+xml',
      Accept: 'application/vnd.sap.adt.blues.v1+xml',
    },
    params,
    data: xml,
  });
}

function buildContentFields(args: ICreateAuthorizationFieldParams): string {
  const fields: Array<[string, string | undefined]> = [
    ['auth:fieldName', args.field_name],
    ['auth:rollName', args.roll_name],
    ['auth:checkTable', args.check_table],
    ['auth:exitFB', args.exit_fb],
    ['auth:abap_language_version', args.abap_language_version],
    ['auth:search', args.search],
    ['auth:objexit', args.objexit],
    ['auth:domname', args.domname],
    ['auth:outputlen', args.outputlen],
    ['auth:convexit', args.convexit],
    ['auth:orglvlinfo', args.orglvlinfo],
    ['auth:col_searchhelp', args.col_searchhelp],
    ['auth:col_searchhelp_name', args.col_searchhelp_name],
    ['auth:col_searchhelp_descr', args.col_searchhelp_descr],
  ];
  return fields
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([tag, v]) => `<${tag}>${escapeXml(String(v))}</${tag}>`)
    .join('');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 3: Type-check**

```bash
npm run build:fast
```

Expected: no errors from `src/core/authorizationField/create.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/core/authorizationField/create.ts
git commit -m "feat(authorizationField): add create"
```

---

### Task A3: Implement `read.ts`

- [ ] **Step 1: Read `src/core/dataElement/read.ts`** for the pattern.

- [ ] **Step 2: Write `read.ts`**

```typescript
import type { AxiosResponse } from 'axios';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';

export interface IReadOptions {
  withLongPolling?: boolean;
}

export async function readAuthorizationField(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
  _options?: IReadOptions,
): Promise<AxiosResponse> {
  const encoded = encodeURIComponent(name.toUpperCase());
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/aps/iam/auth/${encoded}`,
    params: { version },
    headers: {
      Accept: 'application/vnd.sap.adt.blues.v1+xml',
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/authorizationField/read.ts
git commit -m "feat(authorizationField): add read"
```

---

### Task A4: Implement `lock.ts` and `unlock.ts`

- [ ] **Step 1: Read `src/core/dataElement/lock.ts`** and `unlock.ts`.

- [ ] **Step 2: Write `lock.ts`**

```typescript
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';

export async function lockAuthorizationField(
  connection: IAbapConnection,
  name: string,
  logger?: ILogger,
): Promise<string> {
  const encoded = encodeURIComponent(name.toUpperCase());
  const resp = await connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/aps/iam/auth/${encoded}`,
    params: { _action: 'LOCK', accessMode: 'MODIFY' },
    headers: {
      'X-sap-adt-sessiontype': 'stateful',
      Accept:
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result2,' +
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result',
    },
  });
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const parsed = parser.parse(resp.data);
  const handle = parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
  if (!handle) {
    logger?.error?.(`AuthorizationField lock: no LOCK_HANDLE in response`);
    throw new Error(`AuthorizationField ${name}: lock response has no LOCK_HANDLE`);
  }
  return String(handle);
}
```

- [ ] **Step 3: Write `unlock.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';

export async function unlockAuthorizationField(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<void> {
  const encoded = encodeURIComponent(name.toUpperCase());
  await connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/aps/iam/auth/${encoded}`,
    params: { _action: 'UNLOCK', lockHandle },
    headers: {
      'X-sap-adt-sessiontype': 'stateful',
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/core/authorizationField/lock.ts src/core/authorizationField/unlock.ts
git commit -m "feat(authorizationField): add lock/unlock"
```

---

### Task A5: Implement `update.ts`

- [ ] **Step 1: Read `src/core/dataElement/update.ts`**.

- [ ] **Step 2: Write `update.ts`**

```typescript
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { ICreateAuthorizationFieldParams } from './types';

const NS_ADTCORE = 'http://www.sap.com/adt/core';
const NS_AUTH = 'http://www.sap.com/iam/auth';

export async function updateAuthorizationField(
  connection: IAbapConnection,
  params: ICreateAuthorizationFieldParams,
  lockHandle: string,
  _logger?: ILogger,
): Promise<void> {
  const name = params.authorization_field_name.toUpperCase();
  const encoded = encodeURIComponent(name);

  const xml = buildUpdateXml(params);

  const query: Record<string, string> = { lockHandle };
  if (params.transport_request) query.corrNr = params.transport_request;

  await connection.makeAdtRequest({
    method: 'PUT',
    url: `/sap/bc/adt/aps/iam/auth/${encoded}`,
    headers: {
      'Content-Type': 'application/vnd.sap.adt.blues.v1+xml',
      Accept: 'application/vnd.sap.adt.blues.v1+xml',
      'X-sap-adt-sessiontype': 'stateful',
    },
    params: query,
    data: xml,
  });
}

function buildUpdateXml(p: ICreateAuthorizationFieldParams): string {
  const name = p.authorization_field_name.toUpperCase();
  const desc = p.description ?? '';
  const fields: Array<[string, string | undefined]> = [
    ['auth:fieldName', p.field_name],
    ['auth:rollName', p.roll_name],
    ['auth:checkTable', p.check_table],
    ['auth:exitFB', p.exit_fb],
    ['auth:abap_language_version', p.abap_language_version],
    ['auth:search', p.search],
    ['auth:objexit', p.objexit],
    ['auth:domname', p.domname],
    ['auth:outputlen', p.outputlen],
    ['auth:convexit', p.convexit],
    ['auth:orglvlinfo', p.orglvlinfo],
    ['auth:col_searchhelp', p.col_searchhelp],
    ['auth:col_searchhelp_name', p.col_searchhelp_name],
    ['auth:col_searchhelp_descr', p.col_searchhelp_descr],
  ];
  const content = fields
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([tag, v]) => `<${tag}>${escapeXml(String(v))}</${tag}>`)
    .join('');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<auth:authorizationField xmlns:auth="${NS_AUTH}" xmlns:adtcore="${NS_ADTCORE}" ` +
    `adtcore:name="${name}" adtcore:type="AUTH" adtcore:description="${escapeXml(desc)}">` +
    (p.package_name ? `<adtcore:packageRef adtcore:name="${p.package_name}"/>` : '') +
    `<auth:content>${content}</auth:content>` +
    `</auth:authorizationField>`
  );
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/authorizationField/update.ts
git commit -m "feat(authorizationField): add update"
```

---

### Task A6: Implement `delete.ts`

- [ ] **Step 1: Read `src/core/dataElement/delete.ts`** — copy the deletion-check + deletion-delete pattern verbatim, changing only:
  - Object URI: `/sap/bc/adt/aps/iam/auth/{encoded}`
  - Object type: `AUTH`

- [ ] **Step 2: Write `delete.ts`** following the dataElement template exactly, substituting URI and type. Export `checkDeletion()` and `deleteAuthorizationField()`.

- [ ] **Step 3: Commit**

```bash
git add src/core/authorizationField/delete.ts
git commit -m "feat(authorizationField): add delete"
```

---

### Task A7: Implement `check.ts`, `activation.ts`, `validation.ts`

- [ ] **Step 1: Read the three corresponding files in `src/core/dataElement/`**.

- [ ] **Step 2: Write `check.ts`** — POST `/sap/bc/adt/checkruns?reporters=abapCheckRun` with object URI `/sap/bc/adt/aps/iam/auth/{encoded}`. Signature:

```typescript
export async function checkAuthorizationField(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive',
  xmlContent?: string,
): Promise<AxiosResponse>
```

Body shape: copy from `dataElement/check.ts`, substitute object URI.

- [ ] **Step 3: Write `activation.ts`** — POST `/sap/bc/adt/activation` with an XML list referencing the object URI. Copy from `dataElement/activation.ts` with URI substitution.

- [ ] **Step 4: Write `validation.ts`** — POST `/sap/bc/adt/aps/iam/auth/validation` with query params `objname`, `packagename`, `description`. Copy `dataElement/validation.ts` and change the endpoint to `/sap/bc/adt/aps/iam/auth/validation`.

- [ ] **Step 5: Commit**

```bash
git add src/core/authorizationField/check.ts src/core/authorizationField/activation.ts src/core/authorizationField/validation.ts
git commit -m "feat(authorizationField): add check, activation, validation"
```

---

### Task A8: Implement `AdtAuthorizationField.ts` handler

**Files:**
- Create: `src/core/authorizationField/AdtAuthorizationField.ts`
- Reference: `src/core/dataElement/AdtDataElement.ts`

- [ ] **Step 1: Read `src/core/dataElement/AdtDataElement.ts`** fully. This is the closest template.

- [ ] **Step 2: Write `AdtAuthorizationField.ts`**

Copy the `AdtDataElement` class structure, applying these substitutions:
- Class name: `AdtAuthorizationField`
- Config type: `IAuthorizationFieldConfig`
- State type: `IAuthorizationFieldState`
- Params type: `ICreateAuthorizationFieldParams`
- Low-level function imports: `create`, `readAuthorizationField`, `updateAuthorizationField`, `deleteAuthorizationField`, `checkDeletion`, `lockAuthorizationField`, `unlockAuthorizationField`, `checkAuthorizationField`, `activateAuthorizationField`, `validateAuthorizationFieldName`
- Object name getter: use `config.authorizationFieldName`
- Config-to-params mapping in `buildCreateParams()`: map all camelCase fields to snake_case per `types.ts`

Operation chains (exact order from `AdtDataElement`):
- **create:** validate required (`authorizationFieldName`, `packageName`, `description`) → `create()` → activate (optional via config)
- **update:** `setSessionType('stateful')` → `lockAuthorizationField()` → `setSessionType('stateless')` → `checkAuthorizationField('inactive', xmlContent?)` → `updateAuthorizationField(lockHandle)` → `read(withLongPolling: true)` → `setSessionType('stateful')` → `unlockAuthorizationField()` → `setSessionType('stateless')` → `checkAuthorizationField('inactive')` → `activateAuthorizationField()` + read with retry → error cleanup: unlock + stateless
- **delete:** `checkDeletion()` → `deleteAuthorizationField()`
- **activate, check, lock, unlock, readTransport, readMetadata:** copy 1:1 from AdtDataElement

- [ ] **Step 3: Type-check**

```bash
npm run build:fast
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/authorizationField/AdtAuthorizationField.ts
git commit -m "feat(authorizationField): add handler class"
```

---

### Task A9: Write `index.ts` for authorizationField

- [ ] **Step 1: Write `src/core/authorizationField/index.ts`**

```typescript
export { AdtAuthorizationField } from './AdtAuthorizationField';
export type {
  IAuthorizationFieldConfig,
  IAuthorizationFieldState,
  ICreateAuthorizationFieldParams,
} from './types';
```

- [ ] **Step 2: Commit**

```bash
git add src/core/authorizationField/index.ts
git commit -m "feat(authorizationField): add barrel export"
```

---

## Phase B: functionInclude module

### Task B1: Scaffold and types

**Files:**
- Create: `src/core/functionInclude/types.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/core/functionInclude
```

- [ ] **Step 2: Write `types.ts`**

```typescript
/**
 * FunctionInclude (FUGR/I) module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export interface ICreateFunctionIncludeParams {
  function_group_name: string;       // required
  include_name: string;              // required
  description?: string;              // required for create
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  source_code?: string;              // optional at create
}

export interface IFunctionIncludeConfig {
  functionGroupName: string;
  includeName: string;
  description?: string;
  transportRequest?: string;
  masterSystem?: string;
  responsible?: string;
  sourceCode?: string;
  sessionId?: string;
  onLock?: (lockHandle: string) => void;
}

export interface IFunctionIncludeState extends IAdtObjectState {}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/functionInclude/types.ts
git commit -m "feat(functionInclude): add type definitions"
```

---

### Task B2: Implement `create.ts`

- [ ] **Step 1: Read `src/core/program/create.ts`** for source-bearing template.

- [ ] **Step 2: Write `create.ts`**

```typescript
import type { AxiosResponse } from 'axios';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ICreateFunctionIncludeParams } from './types';

const NS_ADTCORE = 'http://www.sap.com/adt/core';
const NS_FINCLUDE = 'http://www.sap.com/adt/functions/fincludes';

export async function create(
  connection: IAbapConnection,
  args: ICreateFunctionIncludeParams,
): Promise<AxiosResponse> {
  const group = args.function_group_name.toLowerCase();
  const name = args.include_name.toUpperCase();
  const description = args.description ?? '';

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<finclude:abapFunctionGroupInclude xmlns:finclude="${NS_FINCLUDE}" xmlns:adtcore="${NS_ADTCORE}" ` +
    `adtcore:name="${name}" adtcore:type="FUGR/I" adtcore:description="${escapeXml(description)}">` +
    `<adtcore:containerRef adtcore:uri="/sap/bc/adt/functions/groups/${group}" ` +
    `adtcore:type="FUGR/F" adtcore:name="${group.toUpperCase()}"/>` +
    `</finclude:abapFunctionGroupInclude>`;

  const params: Record<string, string> = {};
  if (args.transport_request) params.corrNr = args.transport_request;

  return connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/functions/groups/${group}/includes`,
    headers: {
      'Content-Type': 'application/vnd.sap.adt.functions.fincludes.v2+xml',
      Accept: 'application/vnd.sap.adt.functions.fincludes.v2+xml',
    },
    params,
    data: xml,
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/functionInclude/create.ts
git commit -m "feat(functionInclude): add create"
```

---

### Task B3: Implement `read.ts` and `readSource.ts`

- [ ] **Step 1: Write `read.ts`**

```typescript
import type { AxiosResponse } from 'axios';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';

export interface IReadOptions {
  withLongPolling?: boolean;
}

export async function readFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  version: 'active' | 'inactive' = 'active',
  _options?: IReadOptions,
): Promise<AxiosResponse> {
  const group = groupName.toLowerCase();
  const name = encodeURIComponent(includeName.toUpperCase());
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/functions/groups/${group}/includes/${name}`,
    params: { version },
    headers: {
      Accept:
        'application/vnd.sap.adt.functions.fincludes.v2+xml, application/vnd.sap.adt.functions.fincludes+xml',
    },
  });
}
```

- [ ] **Step 2: Write `readSource.ts`**

```typescript
import type { AxiosResponse } from 'axios';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';

export async function readFunctionIncludeSource(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  version: 'active' | 'inactive' = 'active',
): Promise<AxiosResponse> {
  const group = groupName.toLowerCase();
  const name = encodeURIComponent(includeName.toUpperCase());
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/functions/groups/${group}/includes/${name}/source/main`,
    params: { version },
    headers: {
      Accept: 'text/plain',
    },
    responseType: 'text',
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/functionInclude/read.ts src/core/functionInclude/readSource.ts
git commit -m "feat(functionInclude): add read and readSource"
```

---

### Task B4: Implement `lock.ts` and `unlock.ts`

- [ ] **Step 1: Write `lock.ts` and `unlock.ts`** following the same pattern as Task A4, substituting URLs. URL for both:

```
/sap/bc/adt/functions/groups/{group}/includes/{encodedName}
```

Signatures:

```typescript
export async function lockFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  logger?: ILogger,
): Promise<string>;

export async function unlockFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  lockHandle: string,
): Promise<void>;
```

- [ ] **Step 2: Commit**

```bash
git add src/core/functionInclude/lock.ts src/core/functionInclude/unlock.ts
git commit -m "feat(functionInclude): add lock/unlock"
```

---

### Task B5: Implement `update.ts` and `updateSource.ts`

- [ ] **Step 1: Write `update.ts`** — metadata-only PUT with XML

```typescript
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { ICreateFunctionIncludeParams } from './types';

const NS_ADTCORE = 'http://www.sap.com/adt/core';
const NS_FINCLUDE = 'http://www.sap.com/adt/functions/fincludes';

export async function updateFunctionInclude(
  connection: IAbapConnection,
  params: ICreateFunctionIncludeParams,
  lockHandle: string,
  _logger?: ILogger,
): Promise<void> {
  const group = params.function_group_name.toLowerCase();
  const name = params.include_name.toUpperCase();
  const encoded = encodeURIComponent(name);
  const description = params.description ?? '';

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<finclude:abapFunctionGroupInclude xmlns:finclude="${NS_FINCLUDE}" xmlns:adtcore="${NS_ADTCORE}" ` +
    `adtcore:name="${name}" adtcore:type="FUGR/I" adtcore:description="${escapeXml(description)}">` +
    `<adtcore:containerRef adtcore:uri="/sap/bc/adt/functions/groups/${group}" ` +
    `adtcore:type="FUGR/F" adtcore:name="${group.toUpperCase()}"/>` +
    `</finclude:abapFunctionGroupInclude>`;

  const query: Record<string, string> = { lockHandle };
  if (params.transport_request) query.corrNr = params.transport_request;

  await connection.makeAdtRequest({
    method: 'PUT',
    url: `/sap/bc/adt/functions/groups/${group}/includes/${encoded}`,
    headers: {
      'Content-Type': 'application/vnd.sap.adt.functions.fincludes.v2+xml',
      Accept: 'application/vnd.sap.adt.functions.fincludes.v2+xml',
      'X-sap-adt-sessiontype': 'stateful',
    },
    params: query,
    data: xml,
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Write `updateSource.ts`** — source PUT with `text/plain`

Read `src/core/program/update.ts` for the source-upload pattern (`uploadProgramSource` function).

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';

export async function uploadFunctionIncludeSource(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  sourceCode: string,
  lockHandle: string,
  unicode: boolean,
  transportRequest?: string,
): Promise<void> {
  const group = groupName.toLowerCase();
  const encoded = encodeURIComponent(includeName.toUpperCase());
  const contentType = unicode ? 'text/plain; charset=utf-8' : 'text/plain';
  const params: Record<string, string> = { lockHandle };
  if (transportRequest) params.corrNr = transportRequest;

  await connection.makeAdtRequest({
    method: 'PUT',
    url: `/sap/bc/adt/functions/groups/${group}/includes/${encoded}/source/main`,
    headers: {
      'Content-Type': contentType,
      'X-sap-adt-sessiontype': 'stateful',
    },
    params,
    data: sourceCode,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/functionInclude/update.ts src/core/functionInclude/updateSource.ts
git commit -m "feat(functionInclude): add update and updateSource"
```

---

### Task B6: Implement `delete.ts`, `check.ts`, `activation.ts`, `validation.ts`

- [ ] **Step 1: Write `delete.ts`** — copy the dataElement delete pattern, substituting URI `/sap/bc/adt/functions/groups/{group}/includes/{encoded}` and type `FUGR/I`.

- [ ] **Step 2: Write `check.ts`** — copy `src/core/program/check.ts` (source-bearing check pattern). It must accept an optional `sourceContentType` parameter resolved from `contentTypes.sourceArtifactContentType()`, and build a checkrun payload with `<chkrun:artifacts>` referring to `.../source/main` plus base64-encoded source when provided.

- [ ] **Step 3: Write `activation.ts`** — copy from `src/core/program/activation.ts`, substitute object URI.

- [ ] **Step 4: Write `validation.ts`** — FunctionInclude does not have a dedicated validation endpoint in sapcli. Export a thin validator that checks required fields (`functionGroupName`, `includeName`, `description`) and does a HEAD/GET on the parent group to confirm it exists:

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';

export async function validateFunctionIncludeName(
  connection: IAbapConnection,
  groupName: string,
  _includeName: string,
): Promise<void> {
  const group = groupName.toLowerCase();
  await connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/functions/groups/${group}`,
    headers: { Accept: 'application/vnd.sap.adt.functions.groups.v3+xml' },
  });
}
```

If during bring-up a proper FUGR/I validation endpoint is discovered, replace this stub. Leave a TODO-free comment explaining the chosen approach.

- [ ] **Step 5: Commit**

```bash
git add src/core/functionInclude/delete.ts src/core/functionInclude/check.ts src/core/functionInclude/activation.ts src/core/functionInclude/validation.ts
git commit -m "feat(functionInclude): add delete, check, activation, validation"
```

---

### Task B7: Implement `AdtFunctionInclude.ts` handler

- [ ] **Step 1: Read `src/core/program/AdtProgram.ts`** — this is the source-bearing template.

- [ ] **Step 2: Write `AdtFunctionInclude.ts`** mirroring `AdtProgram` with substitutions:
- Constructor signature:

```typescript
constructor(
  connection: IAbapConnection,
  logger?: ILogger,
  systemContext?: IAdtSystemContext,
  contentTypes?: IAdtContentTypes,
)
```

- All operations take `IFunctionIncludeConfig` which carries both `functionGroupName` and `includeName`; use the pair everywhere a program handler uses a single name.
- `buildCreateParams()` maps camelCase config to snake_case params for the low-level funcs.
- Operation chains, exact order (from AdtProgram):
  - **create:** validate required → `validateFunctionIncludeName()` (parent exists) → `create()` → if `sourceCode` provided: `setSessionType('stateful')` → `lockFunctionInclude()` → `setSessionType('stateless')` → `uploadFunctionIncludeSource()` → `setSessionType('stateful')` → `unlockFunctionInclude()` → `setSessionType('stateless')` → `activateFunctionInclude()`
  - **update:** stateful → lock → stateless → `checkFunctionInclude('inactive', sourceCode, sourceContentType)` → `updateFunctionInclude()` (metadata if description changed) → `uploadFunctionIncludeSource()` (if sourceCode provided) → stateful → unlock → stateless → `checkFunctionInclude('inactive')` → `activateFunctionInclude()` + read polling → error cleanup
  - **delete:** `checkDeletion()` → `deleteFunctionInclude()`
- `sourceContentType` resolution: `this.contentTypes?.sourceArtifactContentType() ?? 'text/plain'`
- `readMetadata` vs `read`: `read()` returns metadata via `readFunctionInclude()`; add `readSource()` method on the handler that calls `readFunctionIncludeSource()` (mirrors `AdtProgram.readSource`).

- [ ] **Step 3: Type-check**

```bash
npm run build:fast
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/functionInclude/AdtFunctionInclude.ts
git commit -m "feat(functionInclude): add handler class"
```

---

### Task B8: Write `index.ts`

- [ ] **Step 1: Write `src/core/functionInclude/index.ts`**

```typescript
export { AdtFunctionInclude } from './AdtFunctionInclude';
export type {
  IFunctionIncludeConfig,
  IFunctionIncludeState,
  ICreateFunctionIncludeParams,
} from './types';
```

- [ ] **Step 2: Commit**

```bash
git add src/core/functionInclude/index.ts
git commit -m "feat(functionInclude): add barrel export"
```

---

## Phase C: Content-types registry

### Task C1: Extend `IAdtContentTypes` interface and base class

**Files:**
- Modify: `src/core/shared/contentTypes.ts`

- [ ] **Step 1: Read `src/core/shared/contentTypes.ts`** (the interface and the `AdtContentTypesBase`/`AdtContentTypesModern` classes).

- [ ] **Step 2: Add to `IAdtContentTypes` interface**

```typescript
// AuthorizationField
authorizationFieldCreate(): IAdtHeaders;
authorizationFieldRead(): IAdtHeaders;
authorizationFieldUpdate(): IAdtHeaders;

// FunctionInclude
functionIncludeCreate(): IAdtHeaders;
functionIncludeRead(): IAdtHeaders;
functionIncludeUpdate(): IAdtHeaders;
```

- [ ] **Step 3: Implement in `AdtContentTypesBase`**

```typescript
authorizationFieldCreate(): IAdtHeaders {
  return {
    accept: 'application/vnd.sap.adt.blues.v1+xml',
    contentType: 'application/vnd.sap.adt.blues.v1+xml',
  };
}
authorizationFieldRead(): IAdtHeaders {
  return {
    accept: 'application/vnd.sap.adt.blues.v1+xml',
    contentType: 'application/vnd.sap.adt.blues.v1+xml',
  };
}
authorizationFieldUpdate(): IAdtHeaders {
  return this.authorizationFieldCreate();
}

functionIncludeCreate(): IAdtHeaders {
  return {
    accept: 'application/vnd.sap.adt.functions.fincludes.v2+xml, application/vnd.sap.adt.functions.fincludes+xml',
    contentType: 'application/vnd.sap.adt.functions.fincludes.v2+xml',
  };
}
functionIncludeRead(): IAdtHeaders {
  return this.functionIncludeCreate();
}
functionIncludeUpdate(): IAdtHeaders {
  return this.functionIncludeCreate();
}
```

If `AdtContentTypesModern` differs, add overrides with v2-only Accept values; otherwise let it inherit the base.

- [ ] **Step 4: Replace literal content-type strings in the new modules**

In all six low-level files (`authorizationField/create.ts`, `read.ts`, `update.ts` and `functionInclude/create.ts`, `read.ts`, `update.ts`), accept a `contentTypes: IAdtContentTypes` parameter and resolve headers via it instead of hardcoded strings. The handler classes already hold `this.contentTypes` (FunctionInclude) — for AuthField, add `contentTypes?: IAdtContentTypes` to its constructor and pass it through.

Example diff in `authorizationField/create.ts`:

```typescript
import type { IAdtContentTypes } from '../shared/contentTypes';

export async function create(
  connection: IAbapConnection,
  args: ICreateAuthorizationFieldParams,
  contentTypes: IAdtContentTypes,
): Promise<AxiosResponse> {
  const headers = contentTypes.authorizationFieldCreate();
  // ...
  return connection.makeAdtRequest({
    // ...
    headers: { 'Content-Type': headers.contentType, Accept: headers.accept },
    // ...
  });
}
```

- [ ] **Step 5: Update both handler classes** to pass `contentTypes` into every low-level call that needs headers.

- [ ] **Step 6: Type-check**

```bash
npm run build:fast
```

- [ ] **Step 7: Commit**

```bash
git add src/core/shared/contentTypes.ts src/core/authorizationField src/core/functionInclude
git commit -m "feat(contentTypes): register authorizationField and functionInclude"
```

---

## Phase D: AdtClient factory wiring

### Task D1: Add factory methods

**Files:**
- Modify: `src/clients/AdtClient.ts`

- [ ] **Step 1: Read the region around `getDataElement()` and `getProgram()` in `AdtClient.ts`** (approx. lines 192–440).

- [ ] **Step 2: Add imports at the top**

```typescript
import { AdtAuthorizationField } from '../core/authorizationField';
import type { IAuthorizationFieldConfig, IAuthorizationFieldState } from '../core/authorizationField';
import { AdtFunctionInclude } from '../core/functionInclude';
import type { IFunctionIncludeConfig, IFunctionIncludeState } from '../core/functionInclude';
```

- [ ] **Step 3: Add factory methods near the existing DDIC/source groupings**

```typescript
public getAuthorizationField(): IAdtObject<IAuthorizationFieldConfig, IAuthorizationFieldState> {
  return new AdtAuthorizationField(this.connection, this.logger, this.systemContext, this.contentTypes);
}

public getFunctionInclude(): IAdtObject<IFunctionIncludeConfig, IFunctionIncludeState> {
  return new AdtFunctionInclude(this.connection, this.logger, this.systemContext, this.contentTypes);
}
```

- [ ] **Step 4: Type-check**

```bash
npm run build:fast
```

- [ ] **Step 5: Commit**

```bash
git add src/clients/AdtClient.ts
git commit -m "feat(AdtClient): add getAuthorizationField and getFunctionInclude factories"
```

---

## Phase E: Public exports

### Task E1: Export from `src/index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Read the file around line 96–99** (existing dataElement export).

- [ ] **Step 2: Append new exports** (next to the dataElement export block)

```typescript
export type {
  IAuthorizationFieldConfig,
  IAuthorizationFieldState,
} from './core/authorizationField';

export type {
  IFunctionIncludeConfig,
  IFunctionIncludeState,
} from './core/functionInclude';
```

- [ ] **Step 3: Type-check and lint**

```bash
npm run build
```

Expected: clean build, no lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: export IAuthorizationField* and IFunctionInclude* types"
```

---

## Phase F: Tests and config fixture

### Task F1: Extend `test-config.yaml.template`

**Files:**
- Modify: `src/__tests__/helpers/test-config.yaml.template`

- [ ] **Step 1: Read the existing template** — look at `data_element` and `program` sections as references.

- [ ] **Step 2: Append two new sections**

```yaml
# AuthorizationField — SUSO / AUTH
# NOTE: creation may be restricted on cloud; start with onprem
authorization_field:
  available_in: ["onprem"]
  default_name: "ZAC_AUTHFLD01"
  description: "Test authorization field"
  roll_name: ""              # optional data element
  check_table: ""
  test_cases:
    - name: "crud_flow"
      enabled: true
      params:
        authorization_field_name: "ZAC_AUTHFLD01"
        description: "Test authorization field"

# FunctionInclude — FUGR/I
function_include:
  available_in: ["onprem", "cloud"]
  default_function_group: "ZAC_FUGR01"    # must exist; created by shared:setup or manually
  default_include_name: "ZAC_FUINC01"
  description: "Test function group include"
  test_cases:
    - name: "crud_flow"
      enabled: true
      params:
        function_group_name: "ZAC_FUGR01"
        include_name: "ZAC_FUINC01"
        description: "Test function group include"
        source_code: |
          * Initial include body
          WRITE: / 'hello'.
```

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/helpers/test-config.yaml.template
git commit -m "test: add authorization_field and function_include to test-config template"
```

---

### Task F2: Write AuthorizationField integration test

**Files:**
- Create: `src/__tests__/integration/core/authorizationField/AuthorizationField.test.ts`

- [ ] **Step 1: Read `src/__tests__/integration/core/dataElement/DataElement.test.ts`** fully — copy its scaffolding (connection setup, client creation, config resolver, cleanup pattern).

- [ ] **Step 2: Write the test file**

Adapt the DataElement test, replacing:
- `getDataElement()` → `getAuthorizationField()`
- type section name: `data_element` → `authorization_field`
- object name field: `dataElementName` → `authorizationFieldName`
- type-kind logic (n/a here — remove type-kind blocks)

Required test cases:
- `should create, read, update, and delete an authorization field`
- `should skip when available_in does not include current environment`

Use `getEnabledTestCase('authorization_field', 'crud_flow')` to pull params. Mark `available_in: ["onprem"]` gating via `getEnvironmentConfig()`.

- [ ] **Step 3: Type-check tests**

```bash
npm run test:check:integration
```

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/integration/core/authorizationField
git commit -m "test(authorizationField): add integration test for CRUD flow"
```

---

### Task F3: Write FunctionInclude integration test

**Files:**
- Create: `src/__tests__/integration/core/functionInclude/FunctionInclude.test.ts`

- [ ] **Step 1: Read `src/__tests__/integration/core/program/Program.test.ts`** (or `FunctionModule.test.ts` if it exists) as the source-bearing template.

- [ ] **Step 2: Write the test file**

Adapt, substituting:
- `getProgram()` → `getFunctionInclude()`
- object name fields: `programName` → the pair `functionGroupName` + `includeName`
- Pre-test setup: ensure the function group (`function_group_name`) exists; if missing, create via `getFunctionGroup().create(...)` as a precondition, and delete it in `afterAll`.

Required cases:
- `should create include with initial source`
- `should read metadata and source`
- `should update source and re-activate`
- `should delete`

- [ ] **Step 3: Type-check**

```bash
npm run test:check:integration
```

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/integration/core/functionInclude
git commit -m "test(functionInclude): add integration test for CRUD+source flow"
```

---

### Task F4: Run the test suite end-to-end on an on-prem `.env`

- [ ] **Step 1: Confirm an on-prem `.env` exists and `test-config.yaml` has been locally filled**

```bash
ls -la .env src/__tests__/helpers/test-config.yaml
```

- [ ] **Step 2: Run the new suites, saving logs**

```bash
npm test -- integration/core/authorizationField 2>&1 | tee test-authfield.log
npm test -- integration/core/functionInclude 2>&1 | tee test-funcinc.log
```

- [ ] **Step 3: Read both logs and confirm pass**

Use the Read tool on the two `.log` files. Per project convention: never pipe through grep/tail/head.

- [ ] **Step 4: If failures, diagnose**

If tests fail due to endpoint mismatches (non-existent endpoints, wrong XML shape, unexpected content-type), fix the low-level modules inline. Do not skip or suppress. Commit fixes separately with messages describing the symptom and root cause.

- [ ] **Step 5: No commit from this task by itself** (only when fixes are required).

---

## Phase G: Documentation

### Task G1: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read `CLAUDE.md`** — find the "22 object-type modules" sentence and the enumerated list.

- [ ] **Step 2: Replace**

Change `22 object-type modules` → `24 object-type modules`, and add `authorizationField, functionInclude` to the list in the same sentence.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add authorizationField and functionInclude to module list"
```

---

### Task G2: Delete the design proposal document

Per the repo's feedback memo `feedback_design_specs.md`: design specs are removed after implementation lands.

**Files:**
- Delete: `docs/superpowers/specs/2026-04-18-auth-field-and-function-include-design.md`

- [ ] **Step 1: Delete the file**

```bash
git rm docs/superpowers/specs/2026-04-18-auth-field-and-function-include-design.md
```

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: remove implemented proposal spec"
```

---

## Phase H: Final verification

### Task H1: Full build and broader smoke test

- [ ] **Step 1: Clean build**

```bash
npm run build 2>&1 | tee build.log
```

Expected: green. Read `build.log` if anything is off.

- [ ] **Step 2: Run a broader slice to confirm no regressions**

```bash
npm test -- integration/core/dataElement 2>&1 | tee test-dataelement.log
npm test -- integration/core/program 2>&1 | tee test-program.log
```

Expected: green (these should not have been affected, but the content-types registry change touches them through the shared base class).

- [ ] **Step 3: Read both logs**

Confirm no regressions.

- [ ] **Step 4: If green, prepare PR**

```bash
git log --oneline main..HEAD
```

- [ ] **Step 5: Push and open PR** (only if user asks)

---

## Self-review checklist (run after plan is written, before execution)

- [x] Spec section 6.1 (FunctionInclude verified contracts) → Tasks B2–B6
- [x] Spec section 6.2 (AuthorizationField verified contracts) → Tasks A2–A7
- [x] Spec section 7 (zero-argument factory methods) → Task D1
- [x] Spec section 8.1 (IAuthorizationFieldConfig shape) → Task A1
- [x] Spec section 8.2 (IFunctionIncludeConfig shape) → Task B1
- [x] Spec section 9 (module layouts) → directory structure in File Structure block
- [x] Spec section 10 (canonical lifecycle chains) → Tasks A8 and B7 explicitly reference AdtDataElement and AdtProgram for chain order
- [x] Spec section 11 (IAdtContentTypes extension) → Phase C
- [x] Spec section 12 (integration-test-first, `available_in: ["onprem"]` gating) → Task F1, F2, F3
- [x] Spec section 14.3 (delete proposal after implementation) → Task G2

**Placeholder scan:** No "TBD", no "similar to Task X without showing code", no "add error handling" prose.

**Type consistency:**
- `lockFunctionInclude` signature `(connection, groupName, includeName, logger?)` — consistent across Tasks B4 and B7.
- `uploadFunctionIncludeSource` in Task B5 and referenced in B7.
- `checkFunctionInclude(connection, groupName, includeName, version, xmlContent?)` — accepts both group and include in B6 and B7.
- `contentTypes` parameter added in Phase C flows through to D1.
