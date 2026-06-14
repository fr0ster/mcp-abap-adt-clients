# Feature Toggle Core Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full feature-toggle support (`FTG2/FT`) as a new core module under `src/core/featureToggle/`, exposing `IAdtObject`-compatible CRUD + lifecycle plus five domain methods (`switchOn`, `switchOff`, `getRuntimeState`, `checkState`, `readSource`) through a specialized `IFeatureToggleObject` interface.

**Architecture:**
- New core module `src/core/featureToggle/` following the DDIC-style pattern established by `src/core/authorizationField/` (XML metadata via `blue:blueSource` envelope) combined with a source-bearing pattern, except the "source" payload at `…/source/main` is JSON, not ABAP text.
- Specialized public interface `IFeatureToggleObject extends IAdtObject<IFeatureToggleConfig, IFeatureToggleState>` carries the domain methods statically; factory `AdtClient.getFeatureToggle()` returns that type — no casts at call sites.
- Hybrid payload split: XML for metadata (`blue:blueSource` root); JSON for source (`toggle.content.v2+json`), state (`states.v1+asjson`), check (`toggle.check.result.v1+asjson`), toggle (`related.toggle.parameters.v1+asjson`).

**Tech Stack:** TypeScript strict, CommonJS, Node.js ≥18, Biome (lint + format), `fast-xml-parser` for XML, native `JSON.parse`/`stringify` for JSON, Jest integration tests. No new runtime dependencies.

**Verification source:** `docs/superpowers/specs/2026-04-19-feature-toggle-client-design.md`. Endpoints cross-checked against sapcli + `docs/discovery/*.xml` (cloud MDD and E19 modern on-prem verified; E77 legacy unsupported).

**Endpoints (canonical):**
- Collection: `/sap/bc/adt/sfw/featuretoggles`
- Object: `/sap/bc/adt/sfw/featuretoggles/{name}` (name lower-cased + url-encoded per sapcli `quote_plus`)
- Source: `/sap/bc/adt/sfw/featuretoggles/{name}/source/main`
- States (runtime): `/sap/bc/adt/sfw/featuretoggles/{name}/states`
- Check (pre-flight): `/sap/bc/adt/sfw/featuretoggles/{name}/check`
- Toggle (switch on/off): `/sap/bc/adt/sfw/featuretoggles/{name}/toggle`
- Deletion: standard `/sap/bc/adt/deletion/check` + `/sap/bc/adt/deletion/delete`
- Activation: standard `/sap/bc/adt/activation`
- Check (syntactic): standard `/sap/bc/adt/checkruns?reporters=abapCheckRun`

**XML namespaces:**
- Metadata root: `blue:blueSource` → `xmlns:blue="http://www.sap.com/wbobj/blue"`
- Plus `xmlns:adtcore="http://www.sap.com/adt/core"` and `xmlns:abapsource="http://www.sap.com/adt/abapsource"` when present

**Branch policy.** Per project convention for the sapcli-separate-clients roadmap, this is implemented on a dedicated feature branch forked from `main` (NOT from `proposal/sapcli-separate-clients`). Branch name: `feature/feature-toggle-core-module`.

---

## File Structure (18 files + 4 cross-cutting updates)

### New `src/core/featureToggle/` module (16 files)

```
src/core/featureToggle/
  AdtFeatureToggle.ts      # handler — implements IFeatureToggleObject
  types.ts                 # IFeatureToggleObject, IFeatureToggleConfig, IFeatureToggleState, sub-types, ICreateFeatureToggleParams, IToggleFeatureToggleParams
  xmlBuilder.ts            # builds blue:blueSource XML for create/update metadata
  create.ts                # POST /sfw/featuretoggles — metadata XML
  read.ts                  # GET /sfw/featuretoggles/{name} — metadata XML
  readSource.ts            # GET /sfw/featuretoggles/{name}/source/main — JSON
  update.ts                # PUT /sfw/featuretoggles/{name}?lockHandle= — metadata XML
  updateSource.ts          # PUT /sfw/featuretoggles/{name}/source/main?lockHandle= — JSON
  delete.ts                # POST /deletion/check + /deletion/delete
  lock.ts                  # POST /sfw/featuretoggles/{name}?_action=LOCK&accessMode=MODIFY
  unlock.ts                # POST /sfw/featuretoggles/{name}?_action=UNLOCK&lockHandle=
  check.ts                 # POST /checkruns?reporters=abapCheckRun (canonical)
  activation.ts            # POST /activation
  validation.ts            # pre-create name validation (lightweight probe)
  getState.ts              # GET /sfw/featuretoggles/{name}/states — JSON domain
  checkState.ts            # POST /sfw/featuretoggles/{name}/check — JSON domain
  switch.ts                # POST /sfw/featuretoggles/{name}/toggle — JSON domain (used by switchOn/switchOff)
  index.ts                 # barrel export of IFeatureToggleObject + types + class
```

### Cross-cutting updates

- `src/constants/contentTypes.ts` — add 7 new constants
- `src/clients/AdtClient.ts` — add `getFeatureToggle()` factory + imports
- `src/index.ts` — export `IFeatureToggleObject`, `IFeatureToggleConfig`, `IFeatureToggleState`, sub-types
- `src/__tests__/helpers/test-config.yaml.template` — add `create_feature_toggle` section
- `src/__tests__/integration/core/featureToggle/FeatureToggle.test.ts` — new integration test
- `CLAUDE.md` — bump count 24 → 25, add `featureToggle` to module list
- `README.md`, `CHANGELOG.md`, `docs/usage/CLIENT_API_REFERENCE.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/LEGACY.md` — per the #21 pattern
- `docs/usage/ADT_OBJECT_ENTITIES.md` — regenerate via `npm run adt:entities` after code lands

---

## Phase A: Scaffold types and content-type constants

### Task A1: types.ts — public and internal types

**Files:**
- Create: `src/core/featureToggle/types.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/core/featureToggle
```

- [ ] **Step 2: Write `types.ts`**

```typescript
/**
 * Feature Toggle (FTG2/FT) module type definitions.
 *
 * Surface pairs the standard IAdtObject CRUD + lifecycle with five domain
 * methods for state management (switchOn / switchOff / getRuntimeState /
 * checkState / readSource). Consumers use the specialized
 * IFeatureToggleObject interface so the domain methods stay statically
 * visible on the factory return type.
 */

import type { IAdtObject, IAdtObjectState } from '@mcp-abap-adt/interfaces';

export type FeatureToggleState = 'on' | 'off' | 'undefined';

// --- Source payload (JSON at /source/main) --------------------------------

export interface IFeatureToggleHeader {
  description?: string;
  originalLanguage?: string;
  abapLanguageVersion?: string;
}

export interface IFeatureToggleReleasePlan {
  version: string;
  sp: string;
}

export interface IFeatureTogglePlanning {
  referenceProduct?: string;
  releaseToCustomer?: IFeatureToggleReleasePlan;
  generalAvailability?: IFeatureToggleReleasePlan;
  generalRollout?: IFeatureToggleReleasePlan;
}

export interface IFeatureToggleRollout {
  lifecycleStatus?: 'new' | 'inValidation' | 'released' | 'discontinued';
  validationStep?: 'internal' | 'releaseToCustomer' | string;
  rolloutStep?: 'releaseToCustomer' | 'generalAvailability' | 'generalRollout' | string;
  strategy?: 'immediate' | 'gradual' | string;
  finalDate?: string;
  event?: 'noRestriction' | string;
  planning?: IFeatureTogglePlanning;
  configurable?: boolean;
  defaultEnabledFor?: 'none' | 'someCustomers' | 'allCustomers' | string;
  reversible?: boolean;
}

export interface IFeatureToggleAttribute {
  key: string;
  value: string;
}

export interface IFeatureToggleSource {
  header?: IFeatureToggleHeader;
  rollout?: IFeatureToggleRollout;
  toggledPackages?: string[];
  relatedToggles?: string[];
  attributes?: IFeatureToggleAttribute[];
}

// --- Runtime state (JSON at /states) --------------------------------------

export interface IFeatureToggleClientLevel {
  client: string;
  description?: string;
  state: FeatureToggleState;
}

export interface IFeatureToggleUserLevel {
  user: string;
  state: FeatureToggleState;
}

export interface IFeatureToggleRuntimeState {
  name: string;
  clientState: FeatureToggleState;
  userState: FeatureToggleState;
  clientChangedBy?: string;
  clientChangedOn?: string;
  clientStates: IFeatureToggleClientLevel[];
  userStates: IFeatureToggleUserLevel[];
}

// --- Check result (JSON at /check) ----------------------------------------

export interface IFeatureToggleCheckStateResult {
  currentState: FeatureToggleState;
  transportPackage?: string;
  transportUri?: string;
  customizingTransportAllowed: boolean;
}

// --- Public config / state ------------------------------------------------

export interface IFeatureToggleConfig {
  featureToggleName: string;
  packageName?: string;
  description?: string;
  transportRequest?: string;
  masterSystem?: string;
  responsible?: string;
  source?: IFeatureToggleSource;
  onLock?: (lockHandle: string) => void;
}

export interface IFeatureToggleState extends IAdtObjectState {
  runtimeState?: IFeatureToggleRuntimeState;
  checkStateResult?: IFeatureToggleCheckStateResult;
  sourceResult?: IFeatureToggleSource;
}

// --- Specialized public interface ----------------------------------------

export interface IFeatureToggleObject
  extends IAdtObject<IFeatureToggleConfig, IFeatureToggleState> {
  switchOn(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IFeatureToggleState>;

  switchOff(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IFeatureToggleState>;

  getRuntimeState(
    config: Partial<IFeatureToggleConfig>,
  ): Promise<IFeatureToggleState>;

  checkState(
    config: Partial<IFeatureToggleConfig>,
    opts?: { userSpecific?: boolean },
  ): Promise<IFeatureToggleState>;

  readSource(
    config: Partial<IFeatureToggleConfig>,
    version?: 'active' | 'inactive',
  ): Promise<IFeatureToggleState>;
}

// --- Low-level wire-format params (snake_case, internal) ------------------

export interface ICreateFeatureToggleParams {
  feature_toggle_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  source?: IFeatureToggleSource;
}

export interface IDeleteFeatureToggleParams {
  feature_toggle_name: string;
  transport_request?: string;
}

export interface IToggleFeatureToggleParams {
  feature_toggle_name: string;
  state: 'on' | 'off';
  is_user_specific: boolean;
  transport_request?: string;
}
```

- [ ] **Step 3: Type-check**

Run: `npm run build:fast`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/core/featureToggle/types.ts
git commit -m "feat(featureToggle): add type definitions"
```

---

### Task A2: Content-type constants

**Files:**
- Modify: `src/constants/contentTypes.ts`

- [ ] **Step 1: Read** `src/constants/contentTypes.ts` — identify the block near `ACCEPT_AUTHORIZATION_FIELD` (DDIC XML pattern) and note the grouping convention.

- [ ] **Step 2: Append new constants** near the bottom of the file, before any trailing exports

```typescript
// Feature Toggles (FTG2/FT) — metadata uses the shared blues envelope
// same as APS IAM; state and domain endpoints use dedicated JSON types.
export const ACCEPT_FEATURE_TOGGLE_METADATA =
  'application/vnd.sap.adt.blues.v1+xml';
export const CT_FEATURE_TOGGLE_METADATA =
  'application/vnd.sap.adt.blues.v1+xml';
export const ACCEPT_FEATURE_TOGGLE_STATES =
  'application/vnd.sap.adt.states.v1+asjson';
export const ACCEPT_FEATURE_TOGGLE_CHECK_RESULT =
  'application/vnd.sap.adt.toggle.check.result.v1+asjson';
export const CT_FEATURE_TOGGLE_CHECK_PARAMETERS =
  'application/vnd.sap.adt.toggle.check.parameters.v1+asjson';
export const CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS =
  'application/vnd.sap.adt.related.toggle.parameters.v1+asjson';
export const CT_FEATURE_TOGGLE_SOURCE =
  'application/vnd.sap.adt.toggle.content.v2+json';
export const ACCEPT_FEATURE_TOGGLE_SOURCE = CT_FEATURE_TOGGLE_SOURCE;
```

- [ ] **Step 3: Verify**

Run: `npm run build:fast`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/constants/contentTypes.ts
git commit -m "feat(featureToggle): add content-type constants"
```

---

## Phase B: Low-level metadata CRUD

### Task B1: xmlBuilder.ts

**Files:**
- Create: `src/core/featureToggle/xmlBuilder.ts`
- Reference: `src/core/authorizationField/xmlBuilder.ts`

- [ ] **Step 1: Read** `src/core/authorizationField/xmlBuilder.ts` to confirm style (escapeXml helper, ordered attribute placement).

- [ ] **Step 2: Write `xmlBuilder.ts`**

```typescript
/**
 * XML builder for feature-toggle metadata.
 *
 * The metadata payload is the `blue:blueSource` envelope (same blues v1
 * envelope used by APS IAM auth) with adtcore attributes and a packageRef
 * child. Source body (rollout / toggledPackages / attributes) is JSON
 * handled separately by updateSource.ts.
 */

import type { ICreateFeatureToggleParams } from './types';

const NS_BLUE = 'http://www.sap.com/wbobj/blue';
const NS_ADTCORE = 'http://www.sap.com/adt/core';
const NS_ABAPSOURCE = 'http://www.sap.com/adt/abapsource';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildFeatureToggleXml(
  params: ICreateFeatureToggleParams,
): string {
  const name = params.feature_toggle_name.toUpperCase();
  const description = params.description ?? '';
  const pkg = params.package_name;

  const adtcoreAttrs = [
    `adtcore:name="${escapeXml(name)}"`,
    `adtcore:type="FTG2/FT"`,
    `adtcore:description="${escapeXml(description)}"`,
  ];
  if (params.master_system) {
    adtcoreAttrs.push(`adtcore:masterSystem="${escapeXml(params.master_system)}"`);
  }
  if (params.responsible) {
    adtcoreAttrs.push(`adtcore:responsible="${escapeXml(params.responsible)}"`);
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<blue:blueSource xmlns:blue="${NS_BLUE}" xmlns:adtcore="${NS_ADTCORE}" xmlns:abapsource="${NS_ABAPSOURCE}" ` +
    adtcoreAttrs.join(' ') +
    `>` +
    (pkg
      ? `<adtcore:packageRef adtcore:name="${escapeXml(pkg)}"/>`
      : '') +
    `</blue:blueSource>`
  );
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npm run build:fast
git add src/core/featureToggle/xmlBuilder.ts
git commit -m "feat(featureToggle): add XML builder for metadata"
```

---

### Task B2: create.ts + read.ts + update.ts + delete.ts

**Files:**
- Create: `src/core/featureToggle/create.ts`
- Create: `src/core/featureToggle/read.ts`
- Create: `src/core/featureToggle/update.ts`
- Create: `src/core/featureToggle/delete.ts`

- [ ] **Step 1: Read** `src/core/authorizationField/{create,read,update,delete}.ts` to copy the structural pattern.

- [ ] **Step 2: Write `create.ts`**

```typescript
import type {
  IAbapConnection,
  IAdtResponse as AxiosResponse,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_FEATURE_TOGGLE_METADATA,
  CT_FEATURE_TOGGLE_METADATA,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateFeatureToggleParams } from './types';
import { buildFeatureToggleXml } from './xmlBuilder';

export async function create(
  connection: IAbapConnection,
  args: ICreateFeatureToggleParams,
): Promise<AxiosResponse> {
  const xml = buildFeatureToggleXml(args);
  const params: Record<string, string> = {};
  if (args.transport_request) params.corrNr = args.transport_request;
  return connection.makeAdtRequest({
    method: 'POST',
    url: '/sap/bc/adt/sfw/featuretoggles',
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_METADATA,
      Accept: ACCEPT_FEATURE_TOGGLE_METADATA,
    },
    params,
    data: xml,
  });
}
```

- [ ] **Step 3: Write `read.ts`**

```typescript
import type {
  IAbapConnection,
  IAdtResponse as AxiosResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_METADATA } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export interface IReadOptions {
  withLongPolling?: boolean;
}

export async function readFeatureToggle(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
  _options?: IReadOptions,
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

- [ ] **Step 4: Write `update.ts`**

```typescript
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_FEATURE_TOGGLE_METADATA,
  CT_FEATURE_TOGGLE_METADATA,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateFeatureToggleParams } from './types';
import { buildFeatureToggleXml } from './xmlBuilder';

export async function updateFeatureToggle(
  connection: IAbapConnection,
  params: ICreateFeatureToggleParams,
  lockHandle: string,
  _logger?: ILogger,
): Promise<void> {
  const encoded = encodeSapObjectName(params.feature_toggle_name.toLowerCase());
  const xml = buildFeatureToggleXml(params);
  const query: Record<string, string> = { lockHandle };
  if (params.transport_request) query.corrNr = params.transport_request;
  await connection.makeAdtRequest({
    method: 'PUT',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_METADATA,
      Accept: ACCEPT_FEATURE_TOGGLE_METADATA,
      'X-sap-adt-sessiontype': 'stateful',
    },
    params: query,
    data: xml,
  });
}
```

- [ ] **Step 5: Write `delete.ts`**

Copy the structure of `src/core/authorizationField/delete.ts`. Substitute:
- Object URI: `/sap/bc/adt/sfw/featuretoggles/${encoded}` (lower-cased name)
- Object type in deletion payload: `FTG2/FT`
- Params type: `IDeleteFeatureToggleParams` from `./types`
- Export `checkDeletion(connection, params)` and `deleteFeatureToggle(connection, params)` with the same signatures.

- [ ] **Step 6: Type-check and commit**

```bash
npm run build:fast
git add src/core/featureToggle/create.ts src/core/featureToggle/read.ts src/core/featureToggle/update.ts src/core/featureToggle/delete.ts
git commit -m "feat(featureToggle): add metadata CRUD (create, read, update, delete)"
```

---

## Phase C: Low-level state machine (lock/unlock/check/activation/validation)

### Task C1: lock.ts + unlock.ts

**Files:**
- Create: `src/core/featureToggle/lock.ts`
- Create: `src/core/featureToggle/unlock.ts`

- [ ] **Step 1: Write `lock.ts`**

```typescript
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function lockFeatureToggle(
  connection: IAbapConnection,
  name: string,
  logger?: ILogger,
): Promise<string> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const resp = await connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
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
    logger?.error?.(`FeatureToggle lock: no LOCK_HANDLE in response`);
    throw new Error(`FeatureToggle ${name}: lock response has no LOCK_HANDLE`);
  }
  return String(handle);
}
```

- [ ] **Step 2: Write `unlock.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function unlockFeatureToggle(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<void> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  await connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    params: { _action: 'UNLOCK', lockHandle },
    headers: { 'X-sap-adt-sessiontype': 'stateful' },
  });
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npm run build:fast
git add src/core/featureToggle/lock.ts src/core/featureToggle/unlock.ts
git commit -m "feat(featureToggle): add lock/unlock"
```

---

### Task C2: check.ts + activation.ts + validation.ts

**Files:**
- Create: `src/core/featureToggle/check.ts` — canonical check via `/checkruns?reporters=abapCheckRun`
- Create: `src/core/featureToggle/activation.ts` — standard `/sap/bc/adt/activation`
- Create: `src/core/featureToggle/validation.ts` — pre-create existence probe

- [ ] **Step 1: Read** `src/core/authorizationField/check.ts` and `src/core/authorizationField/activation.ts` to copy structure.

- [ ] **Step 2: Write `check.ts`**

Copy `src/core/authorizationField/check.ts`, substituting:
- Object URI builder: `/sap/bc/adt/sfw/featuretoggles/${encodeSapObjectName(name.toLowerCase())}`
- Exported function: `checkFeatureToggle(connection, name, version, xmlContent?)` returning `Promise<AxiosResponse>`

- [ ] **Step 3: Write `activation.ts`**

Copy `src/core/authorizationField/activation.ts`, substituting:
- Object URI builder same as above
- Exported function: `activateFeatureToggle(connection, name)` returning `Promise<AxiosResponse>`

- [ ] **Step 4: Write `validation.ts`**

Minimal pre-create probe: attempt a HEAD/GET on the collection URL, since there is no dedicated validation endpoint documented that works uniformly across cloud MDD (`dependencies/validate`) and E19 (`validation`). Keeping the probe at the collection level means no per-environment branching.

```typescript
import type {
  IAbapConnection,
  IAdtResponse as AxiosResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_METADATA } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

export async function validateFeatureToggleName(
  connection: IAbapConnection,
  name: string,
  _packageName?: string,
  _description?: string,
): Promise<AxiosResponse> {
  if (!name) {
    throw new Error('Feature toggle name is required');
  }
  return connection.makeAdtRequest({
    method: 'GET',
    url: '/sap/bc/adt/sfw/featuretoggles',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_METADATA },
  });
}
```

- [ ] **Step 5: Type-check and commit**

```bash
npm run build:fast
git add src/core/featureToggle/check.ts src/core/featureToggle/activation.ts src/core/featureToggle/validation.ts
git commit -m "feat(featureToggle): add check, activation, validation"
```

---

## Phase D: Domain operations (source + state + switch)

### Task D1: readSource.ts + updateSource.ts

**Files:**
- Create: `src/core/featureToggle/readSource.ts`
- Create: `src/core/featureToggle/updateSource.ts`

- [ ] **Step 1: Write `readSource.ts`**

```typescript
import type {
  IAbapConnection,
  IAdtResponse as AxiosResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function readFeatureToggleSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/source/main`,
    timeout: getTimeout('default'),
    params: { version },
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_SOURCE },
  });
}
```

- [ ] **Step 2: Write `updateSource.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { CT_FEATURE_TOGGLE_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IFeatureToggleSource } from './types';

export async function uploadFeatureToggleSource(
  connection: IAbapConnection,
  name: string,
  source: IFeatureToggleSource,
  lockHandle: string,
  transportRequest?: string,
): Promise<void> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const params: Record<string, string> = { lockHandle };
  if (transportRequest) params.corrNr = transportRequest;
  await connection.makeAdtRequest({
    method: 'PUT',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/source/main`,
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_SOURCE,
      'X-sap-adt-sessiontype': 'stateful',
    },
    params,
    data: JSON.stringify(source),
  });
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npm run build:fast
git add src/core/featureToggle/readSource.ts src/core/featureToggle/updateSource.ts
git commit -m "feat(featureToggle): add readSource/uploadSource (JSON /source/main)"
```

---

### Task D2: getState.ts + checkState.ts + switch.ts

**Files:**
- Create: `src/core/featureToggle/getState.ts`
- Create: `src/core/featureToggle/checkState.ts`
- Create: `src/core/featureToggle/switch.ts`

- [ ] **Step 1: Write `getState.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_STATES } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type {
  FeatureToggleState,
  IFeatureToggleRuntimeState,
} from './types';

function normaliseState(raw: unknown): FeatureToggleState {
  if (raw === 'on' || raw === 'off' || raw === 'undefined') return raw;
  return 'undefined';
}

export async function getFeatureToggleState(
  connection: IAbapConnection,
  name: string,
): Promise<IFeatureToggleRuntimeState> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const resp = await connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/states`,
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_STATES },
  });
  const parsed =
    typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
  const s = parsed?.STATES ?? {};
  return {
    name: String(s.NAME ?? name.toUpperCase()),
    clientState: normaliseState(s.CLIENT_STATE),
    userState: normaliseState(s.USER_STATE),
    clientChangedBy: s.CLIENT_CHANGED_BY || undefined,
    clientChangedOn: s.CLIENT_CHANGED_ON || undefined,
    clientStates: Array.isArray(s.CLIENT_STATES)
      ? s.CLIENT_STATES.map((c: any) => ({
          client: String(c.CLIENT),
          description: c.DESCRIPTION || undefined,
          state: normaliseState(c.STATE),
        }))
      : [],
    userStates: Array.isArray(s.USER_STATES)
      ? s.USER_STATES.map((u: any) => ({
          user: String(u.USER),
          state: normaliseState(u.STATE),
        }))
      : [],
  };
}
```

- [ ] **Step 2: Write `checkState.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_FEATURE_TOGGLE_CHECK_RESULT,
  CT_FEATURE_TOGGLE_CHECK_PARAMETERS,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type {
  FeatureToggleState,
  IFeatureToggleCheckStateResult,
} from './types';

function normaliseState(raw: unknown): FeatureToggleState {
  if (raw === 'on' || raw === 'off' || raw === 'undefined') return raw;
  return 'undefined';
}

export async function checkFeatureToggleState(
  connection: IAbapConnection,
  name: string,
  opts?: { userSpecific?: boolean },
): Promise<IFeatureToggleCheckStateResult> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const body = {
    PARAMETERS: { IS_USER_SPECIFIC: Boolean(opts?.userSpecific) },
  };
  const resp = await connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/check`,
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_CHECK_PARAMETERS,
      Accept: ACCEPT_FEATURE_TOGGLE_CHECK_RESULT,
    },
    data: JSON.stringify(body),
  });
  const parsed =
    typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
  const r = parsed?.RESULT ?? {};
  return {
    currentState: normaliseState(r.CURRENT_STATE),
    transportPackage: r.TRANSPORT_PACKAGE || undefined,
    transportUri: r.TRANSPORT_URI || undefined,
    customizingTransportAllowed: Boolean(r.CUSTOMIZING_TRANSPORT_ALLOWED),
  };
}
```

- [ ] **Step 3: Write `switch.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IToggleFeatureToggleParams } from './types';

export async function toggleFeatureToggle(
  connection: IAbapConnection,
  params: IToggleFeatureToggleParams,
): Promise<void> {
  const encoded = encodeSapObjectName(params.feature_toggle_name.toLowerCase());
  const body: { TOGGLE_PARAMETERS: Record<string, unknown> } = {
    TOGGLE_PARAMETERS: {
      IS_USER_SPECIFIC: Boolean(params.is_user_specific),
      STATE: params.state,
    },
  };
  if (params.transport_request) {
    body.TOGGLE_PARAMETERS.TRANSPORT_REQUEST = params.transport_request;
  }
  await connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/toggle`,
    timeout: getTimeout('default'),
    headers: { 'Content-Type': CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS },
    data: JSON.stringify(body),
  });
}
```

- [ ] **Step 4: Type-check and commit**

```bash
npm run build:fast
git add src/core/featureToggle/getState.ts src/core/featureToggle/checkState.ts src/core/featureToggle/switch.ts
git commit -m "feat(featureToggle): add domain operations (getState, checkState, toggle)"
```

---

## Phase E: Handler class and barrel export

### Task E1: AdtFeatureToggle.ts handler

**Files:**
- Create: `src/core/featureToggle/AdtFeatureToggle.ts`
- Reference: `src/core/authorizationField/AdtAuthorizationField.ts`

- [ ] **Step 1: Read** the full file `src/core/authorizationField/AdtAuthorizationField.ts`. This is the closest structural template — same DDIC-style XML-only metadata flow.

- [ ] **Step 2: Write `AdtFeatureToggle.ts`**

Copy the class structure from `AdtAuthorizationField` with these substitutions:

- **Class declaration:**

```typescript
export class AdtFeatureToggle implements IFeatureToggleObject {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext?: IAdtSystemContext;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext;
  }
  // ...
}
```

- **Low-level imports** (top of file):

```typescript
import type {
  IAbapConnection,
  IAdtObjectState,
  IAdtOperationOptions,
  IAdtSystemContext,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { activateFeatureToggle } from './activation';
import { checkFeatureToggle } from './check';
import { checkFeatureToggleState } from './checkState';
import { create } from './create';
import { checkDeletion, deleteFeatureToggle } from './delete';
import { getFeatureToggleState } from './getState';
import { lockFeatureToggle } from './lock';
import { readFeatureToggle } from './read';
import { readFeatureToggleSource } from './readSource';
import { toggleFeatureToggle } from './switch';
import type {
  ICreateFeatureToggleParams,
  IDeleteFeatureToggleParams,
  IFeatureToggleConfig,
  IFeatureToggleObject,
  IFeatureToggleSource,
  IFeatureToggleState,
  IToggleFeatureToggleParams,
} from './types';
import { unlockFeatureToggle } from './unlock';
import { updateFeatureToggle } from './update';
import { uploadFeatureToggleSource } from './updateSource';
import { validateFeatureToggleName } from './validation';
```

- **Required methods from `IAdtObject`** (match `AdtAuthorizationField` call for call):
  - `validate(config)` — calls `validateFeatureToggleName(connection, config.featureToggleName, config.packageName, config.description)`; returns `{ validationResponse, errors: [] }`
  - `create(config, options?)` — validate required fields (`featureToggleName`, `packageName`, `description`); call `create(connection, params)` where `params = this.buildCreateParams(config)`; if `config.source` provided, run the source-upload sub-chain (stateful → lock → stateless → `uploadFeatureToggleSource` → stateful → unlock → stateless → `activateFeatureToggle`); store response into `state.createResult`; return state.
  - `read(config, version?, options?)` — calls `readFeatureToggle`; maps 404 to `undefined`; stores `state.readResult`.
  - `readMetadata(config, options?)` — delegates to `readFeatureToggle` (no separate metadata endpoint for FT; the object URI returns metadata).
  - `update(config, options?)` — canonical chain: `setSessionType('stateful')` → `lockFeatureToggle` → `setSessionType('stateless')` → `checkFeatureToggle('inactive', xmlContent)` if `options?.xmlContent` provided → `updateFeatureToggle` → if `config.source` provided → `uploadFeatureToggleSource` → `setSessionType('stateful')` → `unlockFeatureToggle` → `setSessionType('stateless')` → `checkFeatureToggle('inactive')` → `activateFeatureToggle` + read with retry → error cleanup (try unlock; then stateless).
  - `delete(config)` — `checkDeletion` → `deleteFeatureToggle`.
  - `activate(config)` — `activateFeatureToggle(connection, name)`; store `state.activateResult`.
  - `check(config, status?)` — `checkFeatureToggle(connection, name, status === 'inactive' ? 'inactive' : 'active')`; store `state.checkResult`.
  - `lock(config)` — setSessionType('stateful') → `lockFeatureToggle` → setSessionType('stateless') → invoke `config.onLock?.(lockHandle)`; return the string.
  - `unlock(config, lockHandle)` — setSessionType('stateful') → `unlockFeatureToggle` → setSessionType('stateless'); return state.
  - `readTransport(config, options?)` — return `{ errors: [{ method: 'readTransport', error: new Error('Not supported for feature toggles'), timestamp: new Date() }] }` as state (matches the `AdtAuthorizationField` pattern for unsupported transport queries; no dedicated `/transport` resource).

- **Domain methods** (specialized):

```typescript
  async switchOn(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IFeatureToggleState> {
    return this.switchTo(config, opts, 'on');
  }

  async switchOff(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IFeatureToggleState> {
    return this.switchTo(config, opts, 'off');
  }

  private async switchTo(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
    targetState: 'on' | 'off',
  ): Promise<IFeatureToggleState> {
    const name = this.requireName(config);
    const state: IFeatureToggleState = { errors: [] };
    try {
      await toggleFeatureToggle(this.connection, {
        feature_toggle_name: name,
        state: targetState,
        is_user_specific: Boolean(opts.userSpecific),
        transport_request: opts.transportRequest,
      });
      state.runtimeState = await getFeatureToggleState(this.connection, name);
    } catch (error) {
      state.errors.push({
        method: targetState === 'on' ? 'switchOn' : 'switchOff',
        error: error as Error,
        timestamp: new Date(),
      });
      throw error;
    }
    return state;
  }

  async getRuntimeState(
    config: Partial<IFeatureToggleConfig>,
  ): Promise<IFeatureToggleState> {
    const name = this.requireName(config);
    const state: IFeatureToggleState = { errors: [] };
    try {
      state.runtimeState = await getFeatureToggleState(this.connection, name);
    } catch (error) {
      state.errors.push({
        method: 'getRuntimeState',
        error: error as Error,
        timestamp: new Date(),
      });
      throw error;
    }
    return state;
  }

  async checkState(
    config: Partial<IFeatureToggleConfig>,
    opts?: { userSpecific?: boolean },
  ): Promise<IFeatureToggleState> {
    const name = this.requireName(config);
    const state: IFeatureToggleState = { errors: [] };
    try {
      state.checkStateResult = await checkFeatureToggleState(this.connection, name, opts);
    } catch (error) {
      state.errors.push({
        method: 'checkState',
        error: error as Error,
        timestamp: new Date(),
      });
      throw error;
    }
    return state;
  }

  async readSource(
    config: Partial<IFeatureToggleConfig>,
    version: 'active' | 'inactive' = 'active',
  ): Promise<IFeatureToggleState> {
    const name = this.requireName(config);
    const state: IFeatureToggleState = { errors: [] };
    try {
      const resp = await readFeatureToggleSource(this.connection, name, version);
      state.readResult = resp;
      const parsed =
        typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      state.sourceResult = parsed as IFeatureToggleSource;
    } catch (error) {
      state.errors.push({
        method: 'readSource',
        error: error as Error,
        timestamp: new Date(),
      });
      throw error;
    }
    return state;
  }

  private requireName(config: Partial<IFeatureToggleConfig>): string {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }
    return config.featureToggleName;
  }
```

- **`buildCreateParams(config)`** (private helper): map camelCase → snake_case plus `masterSystem`/`responsible` from `systemContext` when config doesn't override.

- [ ] **Step 3: Type-check**

Run: `npm run build:fast`

Expected: clean. If errors, fix before next step.

- [ ] **Step 4: Commit**

```bash
git add src/core/featureToggle/AdtFeatureToggle.ts
git commit -m "feat(featureToggle): add handler class implementing IFeatureToggleObject"
```

---

### Task E2: index.ts

**Files:**
- Create: `src/core/featureToggle/index.ts`

- [ ] **Step 1: Write `index.ts`**

```typescript
export { AdtFeatureToggle } from './AdtFeatureToggle';
export type {
  FeatureToggleState,
  ICreateFeatureToggleParams,
  IFeatureToggleAttribute,
  IFeatureToggleCheckStateResult,
  IFeatureToggleClientLevel,
  IFeatureToggleConfig,
  IFeatureToggleHeader,
  IFeatureToggleObject,
  IFeatureTogglePlanning,
  IFeatureToggleReleasePlan,
  IFeatureToggleRollout,
  IFeatureToggleRuntimeState,
  IFeatureToggleSource,
  IFeatureToggleState,
  IFeatureToggleUserLevel,
} from './types';
```

- [ ] **Step 2: Commit**

```bash
npm run build:fast
git add src/core/featureToggle/index.ts
git commit -m "feat(featureToggle): add barrel export"
```

---

## Phase F: AdtClient factory and public exports

### Task F1: AdtClient factory method

**Files:**
- Modify: `src/clients/AdtClient.ts`

- [ ] **Step 1: Read** the region around `getAuthorizationField()` in `src/clients/AdtClient.ts` (around line 252). Note exact import style and factory pattern.

- [ ] **Step 2: Add imports** at the top of `AdtClient.ts`, alphabetised into the existing import block:

```typescript
import { AdtFeatureToggle } from '../core/featureToggle';
import type {
  IFeatureToggleConfig,
  IFeatureToggleObject,
  IFeatureToggleState,
} from '../core/featureToggle';
```

- [ ] **Step 3: Add factory method** near the existing DDIC factories (e.g. right after `getAuthorizationField`):

```typescript
  getFeatureToggle(): IFeatureToggleObject {
    return new AdtFeatureToggle(this.connection, this.logger, this.systemContext);
  }
```

Return type is the specialized `IFeatureToggleObject`, NOT `IAdtObject<IFeatureToggleConfig, IFeatureToggleState>` — per the public-typing rule in the roadmap proposal §4.2.

- [ ] **Step 4: Type-check and commit**

```bash
npm run build:fast
git add src/clients/AdtClient.ts
git commit -m "feat(AdtClient): add getFeatureToggle factory returning IFeatureToggleObject"
```

---

### Task F2: src/index.ts exports

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Read** the block that exports `IAuthorizationField*` and `IFunctionInclude*` types in `src/index.ts`.

- [ ] **Step 2: Add a new export block** next to the existing ones (alphabetised):

```typescript
export type {
  FeatureToggleState,
  IFeatureToggleAttribute,
  IFeatureToggleCheckStateResult,
  IFeatureToggleClientLevel,
  IFeatureToggleConfig,
  IFeatureToggleHeader,
  IFeatureToggleObject,
  IFeatureTogglePlanning,
  IFeatureToggleReleasePlan,
  IFeatureToggleRollout,
  IFeatureToggleRuntimeState,
  IFeatureToggleSource,
  IFeatureToggleState,
  IFeatureToggleUserLevel,
} from './core/featureToggle';
```

- [ ] **Step 3: Full build and commit**

```bash
npm run build
git add src/index.ts
git commit -m "feat: export IFeatureToggle* types and IFeatureToggleObject"
```

Expected: clean (Biome + tsc).

---

## Phase G: Test configuration and integration test

### Task G1: Extend test-config.yaml.template

**Files:**
- Modify: `src/__tests__/helpers/test-config.yaml.template`

- [ ] **Step 1: Read** the section layout of `test-config.yaml.template` around `create_authorization_field`.

- [ ] **Step 2: Append a new section** (alphabetically placed between `create_enhancement_implementation` and `create_function_group`, or wherever fits the existing ordering):

```yaml
# Create Feature Toggle (FTG2/FT) — graduated from sapcli-separate-clients
# roadmap into src/core/ per the variant-A decision. Needs a writeable
# target system that permits creation of Z_* feature toggles; start with
# onprem only because cloud trial may not permit the FTG2/FT creation
# authorization.
create_feature_toggle:
  test_cases:
    - name: "adt_feature_toggle"
      enabled: true
      available_in: ["onprem"]
      description: "Feature toggle reserved for AdtFeatureToggle tests"
      params:
        feature_toggle_name: "ZAC_FT01"
        description: "AdtFeatureToggle workflow toggle"
        update_description: "AdtFeatureToggle workflow toggle (updated)"
```

Name `ZAC_FT01` stays within 30 characters (FTG2/FT name column is typically 30 chars; keep to 10-ish for safety).

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/helpers/test-config.yaml.template
git commit -m "test: add create_feature_toggle section to test-config template"
```

---

### Task G2: Integration test

**Files:**
- Create: `src/__tests__/integration/core/featureToggle/FeatureToggle.test.ts`

- [ ] **Step 1: Read** `src/__tests__/integration/core/authorizationField/AuthorizationField.test.ts` fully — this is the closest analogue (DDIC-style, XML-only metadata, no source, but FT has JSON source on top).

- [ ] **Step 2: Write the test file**

Adapt the AuthorizationField test with these changes:
- Factory: `client.getFeatureToggle()` (returns `IFeatureToggleObject`)
- Type section: `create_feature_toggle`, test case `adt_feature_toggle`
- Config field names: `featureToggleName`, `packageName`, `description`, optional `source`
- Pre-create cleanup pattern: probe existence via `readMetadata`, mark `objectExists` in `ensureObjectReady`.
- **Additional domain-method test cases** (beyond the BaseTester CRUD flow):
  - `should fetch runtime state` — call `client.getFeatureToggle().getRuntimeState({ featureToggleName })`; assert `state.runtimeState.name` equals uppercased name; assert `clientState ∈ {'on','off','undefined'}`.
  - `should check state (pre-flight)` — call `checkState({ featureToggleName })`; assert `checkStateResult.customizingTransportAllowed` is boolean.
  - `should read source` — call `readSource({ featureToggleName })` after create; assert `sourceResult` is defined and has the expected structure (object with optional `header`, `rollout`, etc.).
  - `should switch toggle on/off` — call `switchOn({ featureToggleName }, { transportRequest: DEFAULT_TRANSPORT })` followed by `switchOff(...)`; assert runtime state reflects the change on each step. Gate this block with a conditional `it.skip` if `DEFAULT_TRANSPORT` is absent in the test environment (cloud trial has no transport system).

- [ ] **Step 3: Type-check tests**

Run: `npm run test:check:integration`
Expected: clean TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/integration/core/featureToggle
git commit -m "test(featureToggle): add integration test for CRUD + domain methods"
```

---

### Task G3: Run the test suite and fix any surface issues

**Files:** (various — fix-ups only)

- [ ] **Step 1: Confirm local `.env` and `test-config.yaml` carry the new section** (copy the template section into the real yaml per usual convention). Note: cloud trial JWT may have expired — refresh before running.

- [ ] **Step 2: Run the new suite isolated**

```bash
DEBUG_ADT_TESTS=true DEBUG_ADT_LIBS=true npm test -- integration/core/featureToggle 2>&1 | tee test-ft.log
```

- [ ] **Step 3: Read the log**

Use the Read tool. Expect possible issues:
- HTTP 406 on any metadata endpoint → Accept header mismatch; verify against live server response (look for `Accepted content types:` in the exception body) and widen Accept in `src/constants/contentTypes.ts`.
- 500 "already exists" on repeat create → object from a prior run left behind; cleanup via a one-off node script (pattern from the authField/functionInclude bring-up).
- JSON parse errors in `getState` / `checkState` / `readSource` → response shape differs from sapcli docs; log the raw body and adjust `getState.ts` / `checkState.ts` to handle the real shape.
- 403 or similar auth failure on cloud trial for create — if persistent, mark the create test `available_in: ["onprem"]` only (already the default) and keep read-only tests cloud-capable.

- [ ] **Step 4: Fix issues in place and commit fixes separately**

Each fix gets its own commit with a descriptive message (pattern: `fix(featureToggle): {what and why}`). Do not bundle unrelated fixes.

- [ ] **Step 5: Run full core suite to confirm no regressions**

```bash
npm test -- integration/core 2>&1 | tee test-all.log
```

Expected: at most the pre-existing AccessControl flake (issue #20). Anything else is a regression to fix before proceeding.

---

## Phase H: Documentation and release prep

### Task H1: CLAUDE.md + user-facing docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/usage/CLIENT_API_REFERENCE.md`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Modify: `docs/architecture/LEGACY.md`

- [ ] **Step 1: Update `CLAUDE.md`** — find the line "24 object-type modules ...". Change `24` to `25` and append `featureToggle` to the enumeration.

- [ ] **Step 2: Update `README.md`** — add a row for Feature Toggle (FTG2/FT) in the Supported Object Types table, following the pattern used for `authorizationField` and `functionInclude`.

- [ ] **Step 3: Update `docs/usage/CLIENT_API_REFERENCE.md`** — add a paragraph with usage snippets for `client.getFeatureToggle()`, including at least one CRUD example and one `switchOn`/`switchOff` example.

- [ ] **Step 4: Update `docs/architecture/ARCHITECTURE.md`** — add `getFeatureToggle()` to the factories list.

- [ ] **Step 5: Update `docs/architecture/LEGACY.md`** — add a Feature Toggle row in the "Not supported on legacy" table (absent on E77 per discovery).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md docs/
git commit -m "docs: register featureToggle in user-facing docs"
```

- [ ] **Step 7: Regenerate ADT_OBJECT_ENTITIES.md** (machine-generated)

```bash
npm run adt:entities 2>&1 | tail -5
```

- [ ] **Step 8: Commit the regenerated doc**

```bash
git add docs/usage/ADT_OBJECT_ENTITIES.md
git commit -m "docs(entities): regenerate ADT_OBJECT_ENTITIES for featureToggle"
```

---

### Task H2: Full build and PR

**Files:** — none new; verification only.

- [ ] **Step 1: Final full build**

```bash
npm run build 2>&1 | tee build.log
```

Expected: clean (Biome + tsc). If errors, fix before proceeding.

- [ ] **Step 2: Confirm PR readiness**

```bash
git log --oneline main..HEAD
git diff main..HEAD --stat
```

Expect ~18 commits: 2 in Phase A, 3 in Phase B, 2 in Phase C, 2 in Phase D, 2 in Phase E, 2 in Phase F, 3 in Phase G (excluding fix-ups), 2 in Phase H.

- [ ] **Step 3: Push and open PR** (only if the user explicitly asks)

```bash
git push -u origin feature/feature-toggle-core-module
gh pr create --title "feat: add featureToggle core module (FTG2/FT with domain methods)" --body "$(cat <<'EOF'
## Summary
Adds a new core module `src/core/featureToggle/` implementing the `FTG2/FT` ADT object type with:
- Full `IAdtObject` CRUD + lifecycle (validate / create / read / update / delete / lock / unlock / check / activate).
- Hybrid payloads: XML metadata (`blue:blueSource` envelope) + JSON source at `/source/main`.
- Five domain methods exposed via a specialized `IFeatureToggleObject` interface: `switchOn`, `switchOff`, `getRuntimeState`, `checkState`, `readSource`.
- `AdtClient.getFeatureToggle()` returns `IFeatureToggleObject` (no casts required at call sites).

## Architecture rules followed
- Variant A per `docs/superpowers/specs/2026-04-19-feature-toggle-client-design.md`.
- Public-typing rule (roadmap proposal §4.2): factory returns specialized interface.
- `available_in: ["onprem"]` for the create/lifecycle tests; domain-read tests are cloud-capable but gated via the same test case for simplicity.

## Test plan
- [x] `npm run build` — clean
- [x] `npm test -- integration/core/featureToggle` on an on-prem target — full CRUD + domain tests pass
- [x] Full `integration/core` suite — no regressions beyond the pre-existing AccessControl flake (issue #20)

## Docs
- CLAUDE.md count bumped 24 → 25
- README, CLIENT_API_REFERENCE, ARCHITECTURE, LEGACY updated
- ADT_OBJECT_ENTITIES.md regenerated

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist

Spec coverage:
- [x] Spec §1 (Goal — core module + IFeatureToggleObject) → Tasks A1, E1, F1
- [x] Spec §2 (In scope — full CRUD + domain methods) → Phases A-F
- [x] Spec §3.1-3.2 (verified evidence — endpoints, content-types) → Task A2 constants + per-file Accept/Content-Type
- [x] Spec §4.1 (factory returns IFeatureToggleObject) → Task F1
- [x] Spec §4.2 (IFeatureToggleConfig shape) → Task A1
- [x] Spec §4.3 (IFeatureToggleState shape) → Task A1
- [x] Spec §4.4 (IFeatureToggleObject interface) → Task A1
- [x] Spec §4.5 (domain method bodies on class) → Task E1
- [x] Spec §5 (module file layout, 16 files) → All of Phase A-E (plan yields 18 files counting xmlBuilder + index)
- [x] Spec §6 (canonical + domain operation chains) → Task E1
- [x] Spec §7 (non-decisions — JSON, XML, encoding, content-types, docs pattern) → Tasks A2, E1, G1-G2, H1
- [x] Spec §8 (impact on roadmap) — already reflected in roadmap proposal, no task in this plan (separate roadmap document)
- [x] Spec §10 open questions — acknowledged but not blocking; per-question resolution deferred to the impl pass (G3 fix-ups)
- [x] Spec §11 (next step) — invokes this plan

Placeholder scan: no `TBD` / `TODO` / `add error handling` / "similar to ..." — every code block is complete.

Type consistency:
- `IFeatureToggleObject` signature in Task A1 matches `AdtFeatureToggle implements IFeatureToggleObject` in Task E1.
- `IFeatureToggleState` optional fields (`runtimeState`, `checkStateResult`, `sourceResult`) populated consistently in Task E1 domain methods.
- `ICreateFeatureToggleParams` wire-format (snake_case) used consistently in create.ts, update.ts, xmlBuilder.ts (A1, B1, B2).
- `toggleFeatureToggle` (low-level name in `switch.ts`) vs `switchOn`/`switchOff` (handler method names) — intentional split: wire function reads like the endpoint, handler method reads like domain action.
- `checkFeatureToggle` (canonical CRUD check in `check.ts`) vs `checkFeatureToggleState` (domain `/check` endpoint in `checkState.ts`) — intentional; Task E1 uses them in their respective canonical and domain methods.

Fixes applied inline. Plan ready.
