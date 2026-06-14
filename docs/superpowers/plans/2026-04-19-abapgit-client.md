# abapGit Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `AdtAbapGitClient` under `src/clients/` — a specialized separate client wrapping the SAP-official ADT-integrated abapGit (`/sap/bc/adt/abapgit/*`). Covers link, pull (with async status polling), unlink (conditional on verified delete contract), listRepos, getRepo, getErrorLog, and checkExternalRepo.

**Architecture:**
- Separate client, not a `src/core/` module (abapGit has no ADT-artefact lifecycle). Factory: `AdtClient.getAbapGit(options?)` returns `IAdtAbapGitClient` — specialized interface per roadmap §4.2.
- Sapcli parity for `link` / `pull` plus extended read operations (listRepos / getRepo / getErrorLog) and pre-link validation (checkExternalRepo). `unlink` only ships if its delete contract is verified on a live target in Phase Z.
- Async polling for `pull` is abstracted inside the client. `AbortSignal` and `maxPollDurationMs` stop only the client-side wait — the server-side job may continue. The client attaches `lastKnownStatus` to the thrown `AbortError` / `TimeoutError` so callers can recover.

**Tech Stack:** TypeScript strict, CommonJS, Node.js ≥18, Biome (lint + format), `fast-xml-parser` for XML, Jest integration tests. No new runtime dependencies.

**Verification source:** `docs/superpowers/specs/2026-04-19-abapgit-client-design.md`. Endpoints cross-checked against sapcli (`sap/cli/abapgit.py`, `sap/adt/abapgit.py`) + `docs/discovery/discovery_{cloud_mdd,trial}_raw.xml` (E19/E77 not in corpus).

**Endpoints (canonical):**
- Collection: `/sap/bc/adt/abapgit/repos`
- Single-repo sub-ops: via atom links on the repo entity (`pull_link`, `log_link`, and — if verified — `edit_link` / `delete_link`)
- External repo probe: `/sap/bc/adt/abapgit/externalrepoinfo`
- Default Content-Type: `application/abapgit.adt.repo.v3+xml` (sapcli-compat); `v4` opt-in via options

**XML namespaces:**
- Envelope: `abapgitrepo` → `http://www.sap.com/adt/abapgit/repositories`
- Error-log items: `abapObjects` → `http://www.sap.com/adt/abapgit/abapObjects`
- Atom links: `http://www.w3.org/2005/Atom`

**Branch policy.** Implemented on a dedicated feature branch forked from `main` (NOT from `proposal/sapcli-separate-clients`). Branch name: `feature/abapgit-client`.

---

## File Structure

### New module under `src/clients/abapGit/` (10 files)

```
src/clients/
  AdtAbapGitClient.ts           # handler class — implements IAdtAbapGitClient
  abapGit/
    types.ts                    # public + internal types, IAdtAbapGitClient, IAdtAbapGitClientOptions
    xmlBuilder.ts               # builds <abapgitrepo:repository> envelope for link/pull
    xmlParser.ts                # parses repo list, single repo, error log, externalrepoinfo
    link.ts                     # POST /repos — create binding
    pull.ts                     # POST <pull_link> + poll loop + lastKnownStatus handling
    unlink.ts                   # DELETE <edit_link> | /repos/{id} — conditional on Phase Z verification
    listRepos.ts                # GET /repos — returns IAbapGitRepoStatus[]
    getErrorLog.ts              # GET <log_link> — returns IAbapGitErrorLogEntry[]
    checkExternalRepo.ts        # POST /externalrepoinfo — returns IAbapGitExternalRepoInfo
    poll.ts                     # internal polling helper with AbortSignal + max-duration
```

### Cross-cutting updates

- `src/clients/AdtClient.ts` — add `getAbapGit()` factory + imports
- `src/index.ts` — export the specialized interface and all public types
- `src/__tests__/integration/clients/abapGit/AbapGit.test.ts` — new integration test (new fixture path `src/__tests__/integration/clients/` per roadmap §4)
- `src/__tests__/helpers/test-config.yaml.template` — add `abapgit_*` sections
- `CLAUDE.md` — add a short note about the new client alongside AdtClient / AdtRuntimeClient / AdtExecutor / AdtClientsWS
- `README.md`, `CHANGELOG.md`, `docs/usage/CLIENT_API_REFERENCE.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/LEGACY.md` — per the #21 / #28 pattern
- `docs/usage/ADT_OBJECT_ENTITIES.md` — regenerated via `npm run adt:entities`

---

## Phase Z: Pre-coding protocol verification

**This phase happens BEFORE any of the implementation phases below.** Per the spec (§2, §6.3, §8), `unlink` and `checkExternalRepo` ship only against a verified live contract. No speculative protocol path ships.

### Task Z1: Live-probe the abapGit endpoint family

**Files:** none (verification only — findings captured as a short report under `docs/superpowers/specs/2026-04-19-abapgit-client-design.md` as §12 "Live-probe findings").

- [ ] **Step 1: Confirm cloud trial JWT is fresh**

Run: `grep SAP_URL ~/prj/mcp-abap-adt-clients/.env`
Expected: points at the cloud trial. If JWT is expired, refresh before proceeding.

- [ ] **Step 2: Probe the collection (list)**

Run a one-off node script (`probe-abapgit.js` — kept locally, gitignored):

```javascript
require('dotenv').config();
const { createAbapConnection } = require('@mcp-abap-adt/connection');
(async () => {
  const conn = createAbapConnection({
    authType: 'jwt',
    url: process.env.SAP_URL,
    jwtToken: process.env.SAP_JWT_TOKEN,
    uaaUrl: process.env.SAP_UAA_URL,
    uaaClientId: process.env.SAP_UAA_CLIENT_ID,
    uaaClientSecret: process.env.SAP_UAA_CLIENT_SECRET,
  });
  const r = await conn.makeAdtRequest({
    method: 'GET',
    url: '/sap/bc/adt/abapgit/repos',
    headers: { Accept: 'application/abapgit.adt.repos.v2+xml' },
  });
  console.log('status:', r.status);
  console.log('first 2000 chars:', String(r.data).slice(0, 2000));
})();
```

Expected output: HTTP 200 with an XML list (may be empty). Record: exact root element name, atom links on each repo entry, whether `edit_link` / `delete_link` appears.

- [ ] **Step 3: If the list is empty, create one test repo via `link` manually**

Use a read-only public repo to avoid auth complications, e.g. `https://github.com/sap/abap-platform-refscen-flight` (public) or any public repo owned by user.

```javascript
await conn.makeAdtRequest({
  method: 'POST',
  url: '/sap/bc/adt/abapgit/repos',
  headers: { 'Content-Type': 'application/abapgit.adt.repo.v3+xml' },
  data: `<?xml version="1.0" encoding="UTF-8"?>
<abapgitrepo:repository xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories">
  <abapgitrepo:package>$TMP</abapgitrepo:package>
  <abapgitrepo:url>https://github.com/<user>/<repo></abapgitrepo:url>
  <abapgitrepo:branchName>refs/heads/main</abapgitrepo:branchName>
</abapgitrepo:repository>`,
});
```

Record: the HTTP status, response body, whether the link succeeds on trial with `$TMP` package.

- [ ] **Step 4: Probe `externalrepoinfo`**

```javascript
const r = await conn.makeAdtRequest({
  method: 'POST',
  url: '/sap/bc/adt/abapgit/externalrepoinfo',
  headers: {
    'Content-Type': 'application/abapgit.adt.repo.info.ext.request.v2+xml',
    Accept: 'application/abapgit.adt.repo.info.ext.request.v2+xml',
  },
  data: `<?xml version="1.0" encoding="UTF-8"?>
<abapgitrepo:externalRepoInfoRequest xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories">
  <abapgitrepo:url>https://github.com/<user>/<repo></abapgitrepo:url>
</abapgitrepo:externalRepoInfoRequest>`,
});
console.log('status:', r.status);
console.log('response:', String(r.data));
```

Record: response body shape, element names for branches, access field. This becomes the `IAbapGitExternalRepoInfo` contract.

- [ ] **Step 5: Probe delete**

Try both candidates against the created test repo:

**(a) Atom `edit_link` / `delete_link`:** use the href extracted from the list response, `DELETE` that URL.

**(b) `/repos/{id}`:** extract `repositoryId` (or equivalent) from the list response, `DELETE /sap/bc/adt/abapgit/repos/{id}`.

Record which returns 2xx. If neither does, record the error response so Phase B's unlink task can be DEFERRED.

- [ ] **Step 6: Write up findings**

Append a new section `## 12. Live-probe findings (2026-04-19)` to `docs/superpowers/specs/2026-04-19-abapgit-client-design.md` with:
- Confirmed response XML shape for `listRepos` (root element + repo entry elements + atom link types observed)
- `repositoryId` location (which element or attribute)
- Confirmed `externalrepoinfo` request envelope element name + response XML shape
- Confirmed delete contract: atom link, `/repos/{id}`, or DEFER-UNLINK
- Content-Type version used for each operation (v2 repos list is sapcli; confirm if v4 is required or optional)

Commit the spec update:

```bash
git add docs/superpowers/specs/2026-04-19-abapgit-client-design.md
git commit -m "docs(spec): abapGit live-probe findings for cloud trial"
```

- [ ] **Step 7: Decide v1 unlink**

If Phase Z confirms a delete contract → unlink stays in v1.
If neither candidate works on trial → remove `unlink` from `IAdtAbapGitClient` and from all implementation tasks (Task E3 below). Update Task A1's type definitions to omit `unlink` / `IAbapGitUnlinkArgs`.

This is the last step before coding begins. Do NOT proceed to Phase A without this decision recorded in the spec.

---

## Phase A: Types and scaffolding

### Task A1: `src/clients/abapGit/types.ts`

**Files:**
- Create: `src/clients/abapGit/types.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/clients/abapGit
```

- [ ] **Step 2: Write `types.ts`**

```typescript
/**
 * abapGit client type definitions.
 *
 * Public surface (IAdtAbapGitClient) covers the ADT-integrated abapGit
 * (/sap/bc/adt/abapgit/*). link and pull match sapcli parity; unlink,
 * listRepos, getRepo, getErrorLog, and checkExternalRepo extend beyond
 * sapcli with discovery-evidenced endpoints.
 *
 * Pull is asynchronous server-side. The client-side wait loop respects
 * AbortSignal and a max-duration cap; aborting or timing out stops the
 * client wait only — the server-side job may still be running, and
 * callers must poll getRepo(package) until status != 'R' before
 * re-issuing pull or unlink.
 */

export type AbapGitStatus = 'R' | 'E' | 'A' | string;

export interface IAbapGitRepoStatus {
  package: string;
  url: string;
  branchName: string;
  status: AbapGitStatus;
  statusText: string;
  createdBy?: string;
  createdAt?: string;
  repositoryId?: string;
}

export interface IAbapGitErrorLogEntry {
  msgType: 'E' | 'W' | 'I' | 'S' | string;
  objectType: string;
  objectName: string;
  messageText: string;
}

export interface IAbapGitLinkArgs {
  package: string;
  url: string;
  branchName?: string;
  remoteUser?: string;
  remotePassword?: string;
  transportRequest?: string;
}

export interface IAbapGitPullArgs {
  package: string;
  branchName?: string;
  remoteUser?: string;
  remotePassword?: string;
  transportRequest?: string;
  pollIntervalMs?: number;
  maxPollDurationMs?: number;
  signal?: AbortSignal;
  onProgress?: (status: IAbapGitRepoStatus) => void;
}

export interface IAbapGitPullResult {
  finalStatus: IAbapGitRepoStatus;
  errorLog?: IAbapGitErrorLogEntry[];
}

export interface IAbapGitUnlinkArgs {
  package: string;
  transportRequest?: string;
}

export interface IAbapGitExternalRepoCredentials {
  url: string;
  remoteUser?: string;
  remotePassword?: string;
}

export interface IAbapGitExternalRepoBranch {
  name: string;
  sha1: string;
  isHead: boolean;
  type?: string;
}

export interface IAbapGitExternalRepoInfo {
  branches: IAbapGitExternalRepoBranch[];
  accessMode?: 'PUBLIC' | 'PRIVATE' | string;   // from live probe — field is 'accessMode', not 'access'
}

export interface IAbapGitAbortedError extends Error {
  name: 'AbortError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

export interface IAbapGitTimeoutError extends Error {
  name: 'TimeoutError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

export interface IAdtAbapGitClientOptions {
  contentTypeVersion?: 'v3' | 'v4';
}

export interface IAdtAbapGitClient {
  link(args: IAbapGitLinkArgs): Promise<void>;
  pull(args: IAbapGitPullArgs): Promise<IAbapGitPullResult>;
  unlink(args: IAbapGitUnlinkArgs): Promise<void>;
  listRepos(): Promise<IAbapGitRepoStatus[]>;
  getRepo(packageName: string): Promise<IAbapGitRepoStatus | undefined>;
  getErrorLog(packageName: string): Promise<IAbapGitErrorLogEntry[]>;
  checkExternalRepo(args: IAbapGitExternalRepoCredentials): Promise<IAbapGitExternalRepoInfo>;
}
```

**If Phase Z deferred unlink**, omit the `unlink` method from `IAdtAbapGitClient` and omit `IAbapGitUnlinkArgs`.

- [ ] **Step 3: Type-check**

Run: `npm run build:fast`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/clients/abapGit/types.ts
git commit -m "feat(abapGit): add type definitions and IAdtAbapGitClient interface"
```

---

### Task A2: Content-type constants

**Files:**
- Modify: `src/constants/contentTypes.ts`

- [ ] **Step 1: Read** `src/constants/contentTypes.ts` to find the appropriate placement (alphabetical by object family).

- [ ] **Step 2: Append new constants near the bottom, before any trailing exports**

```typescript
// abapGit (/sap/bc/adt/abapgit/*)
// Envelope for the repository entity (sapcli parity: v3; v4 advertised
// in discovery but kept opt-in via IAdtAbapGitClientOptions.contentTypeVersion).
export const CT_ABAPGIT_REPO_V3 =
  'application/abapgit.adt.repo.v3+xml';
export const CT_ABAPGIT_REPO_V4 =
  'application/abapgit.adt.repo.v4+xml';

// Accept for the repo list (sapcli uses v2; v4 advertised in discovery).
export const ACCEPT_ABAPGIT_REPOS_V2 =
  'application/abapgit.adt.repos.v2+xml';

// Accept/Content-Type for the error log (sapcli parity).
export const CT_ABAPGIT_REPO_OBJECT_V2 =
  'application/abapgit.adt.repo.object.v2+xml';

// External-repo probe — Phase Z confirmed that request and response
// use different media-type families (request vs response sub-path).
export const CT_ABAPGIT_EXTERNAL_REPO_INFO_REQUEST_V2 =
  'application/abapgit.adt.repo.info.ext.request.v2+xml';
export const ACCEPT_ABAPGIT_EXTERNAL_REPO_INFO_RESPONSE_V2 =
  'application/abapgit.adt.repo.info.ext.response.v2+xml';
```

- [ ] **Step 3: Verify and commit**

```bash
npm run build:fast
git add src/constants/contentTypes.ts
git commit -m "feat(abapGit): add content-type constants"
```

---

## Phase B: XML builder and parser

### Task B1: `src/clients/abapGit/xmlBuilder.ts`

**Files:**
- Create: `src/clients/abapGit/xmlBuilder.ts`

- [ ] **Step 1: Write `xmlBuilder.ts`**

```typescript
/**
 * XML builders for abapGit request envelopes.
 *
 * Matches sapcli's repo_request_body helper: null-valued fields are
 * omitted. Envelope element name is <abapgitrepo:repository> for link
 * and pull; externalrepoinfo uses its own envelope.
 */

import type {
  IAbapGitExternalRepoCredentials,
  IAbapGitLinkArgs,
  IAbapGitPullArgs,
} from './types';

const NS_ABAPGITREPO = 'http://www.sap.com/adt/abapgit/repositories';
// Phase Z confirmed: externalrepoinfo uses a distinct namespace (capital R, no "info" suffix).
const NS_ABAPGIT_EXTERNAL_REPO = 'http://www.sap.com/adt/abapgit/externalRepo';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function childRepo(tag: string, value: string | undefined): string {
  if (value === undefined || value === null) return '';
  return `<abapgitrepo:${tag}>${escapeXml(value)}</abapgitrepo:${tag}>`;
}

function childExternalRepo(tag: string, value: string | undefined): string {
  if (value === undefined || value === null) return '';
  return `<abapgitexternalrepo:${tag}>${escapeXml(value)}</abapgitexternalrepo:${tag}>`;
}

export function buildLinkBody(args: IAbapGitLinkArgs): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitrepo:repository xmlns:abapgitrepo="${NS_ABAPGITREPO}">` +
    childRepo('package', args.package) +
    childRepo('url', args.url) +
    childRepo('branchName', args.branchName ?? 'refs/heads/master') +
    childRepo('remoteUser', args.remoteUser) +
    childRepo('remotePassword', args.remotePassword) +
    childRepo('transportRequest', args.transportRequest) +
    `</abapgitrepo:repository>`
  );
}

export function buildPullBody(
  args: IAbapGitPullArgs,
  resolvedBranch: string,
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitrepo:repository xmlns:abapgitrepo="${NS_ABAPGITREPO}">` +
    childRepo('package', args.package) +
    childRepo('branchName', resolvedBranch) +
    childRepo('remoteUser', args.remoteUser) +
    childRepo('remotePassword', args.remotePassword) +
    childRepo('transportRequest', args.transportRequest) +
    `</abapgitrepo:repository>`
  );
}

export function buildExternalRepoInfoBody(
  args: IAbapGitExternalRepoCredentials,
): string {
  // Phase Z confirmed the request envelope element name and namespace.
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<abapgitexternalrepo:externalRepoInfoRequest xmlns:abapgitexternalrepo="${NS_ABAPGIT_EXTERNAL_REPO}">` +
    childExternalRepo('url', args.url) +
    childExternalRepo('remoteUser', args.remoteUser) +
    childExternalRepo('remotePassword', args.remotePassword) +
    `</abapgitexternalrepo:externalRepoInfoRequest>`
  );
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npm run build:fast
git add src/clients/abapGit/xmlBuilder.ts
git commit -m "feat(abapGit): add XML envelope builder"
```

---

### Task B2: `src/clients/abapGit/xmlParser.ts`

**Files:**
- Create: `src/clients/abapGit/xmlParser.ts`

- [ ] **Step 1: Read Phase Z findings** (§12 of the spec) to confirm element names for `repositoryId`, atom-link types, and `externalrepoinfo` response shape.

- [ ] **Step 2: Write `xmlParser.ts`**

```typescript
/**
 * XML parsers for abapGit responses.
 *
 * Uses fast-xml-parser (already a project dependency). Namespace
 * handling: the parser preserves prefixes but we index by the suffix
 * after the colon for brevity. Element names below correspond to the
 * abapGit XSDs confirmed during Phase Z.
 */

import { XMLParser } from 'fast-xml-parser';
import type {
  IAbapGitErrorLogEntry,
  IAbapGitExternalRepoBranch,
  IAbapGitExternalRepoInfo,
  IAbapGitRepoStatus,
} from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  isArray: (name) =>
    name === 'repository' || name === 'abapObject' || name === 'branch' || name === 'link',
});

function asString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export interface IRepoEntityAtomLinks {
  pullLink?: string;
  logLink?: string;
  // Phase Z confirmed no edit_link / delete_link is ever emitted by the
  // server. Delete is performed via DELETE /repos/{key}, not via an
  // atom link. Additional link types (check_link, status_link,
  // stage_link, push_link, modifiedobjects_link) exist but are out
  // of v1 scope.
}

export interface IRepoEntityParsed extends IAbapGitRepoStatus {
  atomLinks: IRepoEntityAtomLinks;
}

function parseAtomLinks(repoNode: any): IRepoEntityAtomLinks {
  const links = Array.isArray(repoNode?.link) ? repoNode.link : [];
  const out: IRepoEntityAtomLinks = {};
  for (const link of links) {
    const type = asString(link?.type);
    const href = asString(link?.href);
    if (!href) continue;
    // Phase Z confirmed available link types: pull_link, log_link,
    // check_link, status_link, stage_link, push_link, modifiedobjects_link.
    // Only pull_link and log_link are consumed in v1; unknown types are
    // ignored silently (stage/push are out of v1 scope per spec §2).
    if (type === 'pull_link') out.pullLink = href;
    else if (type === 'log_link') out.logLink = href;
  }
  return out;
}

function parseRepoEntity(repoNode: any): IRepoEntityParsed {
  return {
    package: asString(repoNode?.package),
    url: asString(repoNode?.url),
    branchName: asString(repoNode?.branchName),
    status: asString(repoNode?.status),
    statusText: asString(repoNode?.statusText),
    createdBy: asString(repoNode?.createdBy) || undefined,
    createdAt: asString(repoNode?.createdAt) || undefined,
    repositoryId:
      asString(repoNode?.repositoryId) || asString(repoNode?.key) || undefined,
    atomLinks: parseAtomLinks(repoNode),
  };
}

export function parseRepoList(xml: string): IRepoEntityParsed[] {
  const parsed = parser.parse(xml) as any;
  // Root element name observed in Phase Z: 'repositories' (confirmed).
  const repos = parsed?.repositories?.repository ?? [];
  return (Array.isArray(repos) ? repos : [repos]).filter(Boolean).map(parseRepoEntity);
}

export function parseErrorLog(xml: string): IAbapGitErrorLogEntry[] {
  const parsed = parser.parse(xml) as any;
  // Root element name observed in Phase Z: 'abapObjects' (confirmed).
  const items = parsed?.abapObjects?.abapObject ?? [];
  return (Array.isArray(items) ? items : [items]).filter(Boolean).map((o: any) => ({
    msgType: asString(o?.msgType),
    objectType: asString(o?.type),
    objectName: asString(o?.name),
    messageText: asString(o?.msgText),
  }));
}

export function parseExternalRepoInfo(xml: string): IAbapGitExternalRepoInfo {
  const parsed = parser.parse(xml) as any;
  // Root confirmed by Phase Z: <abapgitexternalrepo:externalRepoInfo>
  // in namespace http://www.sap.com/adt/abapgit/externalRepo (capital R).
  // The parser strips namespace prefixes, so we read 'externalRepoInfo'.
  const root = parsed?.externalRepoInfo ?? {};
  const rawBranches = root?.branch ?? [];
  const branches: IAbapGitExternalRepoBranch[] = (Array.isArray(rawBranches) ? rawBranches : [rawBranches])
    .filter(Boolean)
    .map((b: any) => ({
      name: asString(b?.name),
      sha1: asString(b?.sha1),
      // SAP-XML boolean convention: 'X' = true, empty element = false.
      isHead: String(asString(b?.isHead)).toUpperCase() === 'X',
      type: asString(b?.type) || undefined,
    }));
  return {
    branches,
    accessMode: asString(root?.accessMode) || undefined,
  };
}
```

Phase-Z-confirmed: the externalrepoinfo response uses a distinct namespace (`externalRepo`) and a `<branch>` list directly under the root (no `<branches>` wrapper). The `isHead` flag uses SAP-XML `X`/empty boolean convention, not lowercase `true`/`false`.

- [ ] **Step 3: Type-check and commit**

```bash
npm run build:fast
git add src/clients/abapGit/xmlParser.ts
git commit -m "feat(abapGit): add XML response parser"
```

---

## Phase C: Low-level HTTP operations

### Task C1: `link.ts` and `listRepos.ts`

**Files:**
- Create: `src/clients/abapGit/link.ts`
- Create: `src/clients/abapGit/listRepos.ts`

- [ ] **Step 1: Write `link.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  CT_ABAPGIT_REPO_V3,
  CT_ABAPGIT_REPO_V4,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import type { IAbapGitLinkArgs } from './types';
import { buildLinkBody } from './xmlBuilder';

export async function linkRepo(
  connection: IAbapConnection,
  args: IAbapGitLinkArgs,
  contentTypeVersion: 'v3' | 'v4' = 'v3',
): Promise<void> {
  const ct =
    contentTypeVersion === 'v4' ? CT_ABAPGIT_REPO_V4 : CT_ABAPGIT_REPO_V3;
  await connection.makeAdtRequest({
    method: 'POST',
    url: '/sap/bc/adt/abapgit/repos',
    timeout: getTimeout('default'),
    headers: { 'Content-Type': ct, Accept: ct },
    data: buildLinkBody(args),
  });
}
```

- [ ] **Step 2: Write `listRepos.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { ACCEPT_ABAPGIT_REPOS_V2 } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import { parseRepoList, type IRepoEntityParsed } from './xmlParser';

export async function listRepos(
  connection: IAbapConnection,
): Promise<IRepoEntityParsed[]> {
  const resp = await connection.makeAdtRequest({
    method: 'GET',
    url: '/sap/bc/adt/abapgit/repos',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_ABAPGIT_REPOS_V2 },
  });
  return parseRepoList(String(resp.data));
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npm run build:fast
git add src/clients/abapGit/link.ts src/clients/abapGit/listRepos.ts
git commit -m "feat(abapGit): add link and listRepos low-level ops"
```

---

### Task C2: `poll.ts` and `pull.ts`

**Files:**
- Create: `src/clients/abapGit/poll.ts`
- Create: `src/clients/abapGit/pull.ts`

- [ ] **Step 1: Write `poll.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { listRepos } from './listRepos';
import type { IAbapGitRepoStatus } from './types';

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_MAX_DURATION_MS = 10 * 60 * 1000;

class AbapGitAbortError extends Error {
  name = 'AbortError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

class AbapGitTimeoutError extends Error {
  name = 'TimeoutError';
  lastKnownStatus?: IAbapGitRepoStatus;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbapGitAbortError('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbapGitAbortError('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function pollUntilTerminal(
  connection: IAbapConnection,
  packageName: string,
  opts?: {
    pollIntervalMs?: number;
    maxPollDurationMs?: number;
    signal?: AbortSignal;
    onProgress?: (status: IAbapGitRepoStatus) => void;
  },
): Promise<IAbapGitRepoStatus> {
  const interval = opts?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxDuration = opts?.maxPollDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const deadline = Date.now() + maxDuration;
  let lastKnown: IAbapGitRepoStatus | undefined;

  while (true) {
    if (opts?.signal?.aborted) {
      const err = new AbapGitAbortError('aborted');
      err.lastKnownStatus = lastKnown;
      throw err;
    }
    if (Date.now() > deadline) {
      const err = new AbapGitTimeoutError(
        `abapGit pull did not finish within ${maxDuration}ms`,
      );
      err.lastKnownStatus = lastKnown;
      throw err;
    }

    const repos = await listRepos(connection);
    const match = repos.find((r) => r.package.toUpperCase() === packageName.toUpperCase());
    if (match) {
      lastKnown = {
        package: match.package,
        url: match.url,
        branchName: match.branchName,
        status: match.status,
        statusText: match.statusText,
        createdBy: match.createdBy,
        createdAt: match.createdAt,
        repositoryId: match.repositoryId,
      };
      opts?.onProgress?.(lastKnown);
      if (match.status !== 'R') {
        return lastKnown;
      }
    }

    try {
      await sleep(interval, opts?.signal);
    } catch (sleepErr) {
      if (sleepErr instanceof AbapGitAbortError) {
        sleepErr.lastKnownStatus = lastKnown;
      }
      throw sleepErr;
    }
  }
}
```

- [ ] **Step 2: Write `pull.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  CT_ABAPGIT_REPO_V3,
  CT_ABAPGIT_REPO_V4,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import { getErrorLog } from './getErrorLog';
import { listRepos } from './listRepos';
import { pollUntilTerminal } from './poll';
import type {
  IAbapGitPullArgs,
  IAbapGitPullResult,
  IAbapGitRepoStatus,
} from './types';
import { buildPullBody } from './xmlBuilder';

export async function pullRepo(
  connection: IAbapConnection,
  args: IAbapGitPullArgs,
  contentTypeVersion: 'v3' | 'v4' = 'v3',
): Promise<IAbapGitPullResult> {
  const repos = await listRepos(connection);
  const match = repos.find(
    (r) => r.package.toUpperCase() === args.package.toUpperCase(),
  );
  if (!match) {
    throw new Error(`abapGit repository for package '${args.package}' not found`);
  }
  if (!match.atomLinks.pullLink) {
    throw new Error(
      `abapGit repository '${args.package}': response missing pull_link atom link`,
    );
  }

  const resolvedBranch = args.branchName ?? match.branchName;
  const ct = contentTypeVersion === 'v4' ? CT_ABAPGIT_REPO_V4 : CT_ABAPGIT_REPO_V3;

  await connection.makeAdtRequest({
    method: 'POST',
    url: match.atomLinks.pullLink,
    timeout: getTimeout('default'),
    headers: { 'Content-Type': ct, Accept: ct },
    data: buildPullBody(args, resolvedBranch),
  });

  const terminal: IAbapGitRepoStatus = await pollUntilTerminal(connection, args.package, {
    pollIntervalMs: args.pollIntervalMs,
    maxPollDurationMs: args.maxPollDurationMs,
    signal: args.signal,
    onProgress: args.onProgress,
  });

  const result: IAbapGitPullResult = { finalStatus: terminal };
  if (terminal.status === 'E' || terminal.status === 'A') {
    try {
      result.errorLog = await getErrorLog(connection, args.package);
    } catch {
      // Error log is best-effort. If it fails, return the result without it.
    }
  }
  return result;
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npm run build:fast
git add src/clients/abapGit/poll.ts src/clients/abapGit/pull.ts
git commit -m "feat(abapGit): add pull with async polling and abort/timeout contract"
```

---

### Task C3: `getErrorLog.ts` and `checkExternalRepo.ts`

**Files:**
- Create: `src/clients/abapGit/getErrorLog.ts`
- Create: `src/clients/abapGit/checkExternalRepo.ts`

- [ ] **Step 1: Write `getErrorLog.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { CT_ABAPGIT_REPO_OBJECT_V2 } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import { listRepos } from './listRepos';
import type { IAbapGitErrorLogEntry } from './types';
import { parseErrorLog } from './xmlParser';

export async function getErrorLog(
  connection: IAbapConnection,
  packageName: string,
): Promise<IAbapGitErrorLogEntry[]> {
  const repos = await listRepos(connection);
  const match = repos.find(
    (r) => r.package.toUpperCase() === packageName.toUpperCase(),
  );
  if (!match) {
    throw new Error(`abapGit repository for package '${packageName}' not found`);
  }
  if (!match.atomLinks.logLink) {
    return [];
  }
  const resp = await connection.makeAdtRequest({
    method: 'GET',
    url: match.atomLinks.logLink,
    timeout: getTimeout('default'),
    headers: { Accept: CT_ABAPGIT_REPO_OBJECT_V2 },
  });
  return parseErrorLog(String(resp.data));
}
```

- [ ] **Step 2: Write `checkExternalRepo.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_ABAPGIT_EXTERNAL_REPO_INFO_RESPONSE_V2,
  CT_ABAPGIT_EXTERNAL_REPO_INFO_REQUEST_V2,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import type {
  IAbapGitExternalRepoCredentials,
  IAbapGitExternalRepoInfo,
} from './types';
import { buildExternalRepoInfoBody } from './xmlBuilder';
import { parseExternalRepoInfo } from './xmlParser';

export async function checkExternalRepo(
  connection: IAbapConnection,
  args: IAbapGitExternalRepoCredentials,
): Promise<IAbapGitExternalRepoInfo> {
  // Phase Z confirmed: request/response use DIFFERENT media-type families:
  //   Content-Type = application/abapgit.adt.repo.info.ext.request.v2+xml
  //   Accept       = application/abapgit.adt.repo.info.ext.response.v2+xml
  const resp = await connection.makeAdtRequest({
    method: 'POST',
    url: '/sap/bc/adt/abapgit/externalrepoinfo',
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_ABAPGIT_EXTERNAL_REPO_INFO_REQUEST_V2,
      Accept: ACCEPT_ABAPGIT_EXTERNAL_REPO_INFO_RESPONSE_V2,
    },
    data: buildExternalRepoInfoBody(args),
  });
  return parseExternalRepoInfo(String(resp.data));
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npm run build:fast
git add src/clients/abapGit/getErrorLog.ts src/clients/abapGit/checkExternalRepo.ts
git commit -m "feat(abapGit): add getErrorLog and checkExternalRepo low-level ops"
```

---

### Task C4: `unlink.ts`

Phase Z confirmed **Option B** for unlink: `DELETE /sap/bc/adt/abapgit/repos/{key}` is wired (nonexistent-ID probe returned 404 "repo not found, get", not 405 Method Not Allowed). No `edit_link` / `delete_link` atom entry exists on the repo entity. `repositoryId` = `<abapgitrepo:key>`.

**Files:**
- Create: `src/clients/abapGit/unlink.ts`

- [ ] **Step 1: Write `unlink.ts`**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { listRepos } from './listRepos';
import type { IAbapGitUnlinkArgs } from './types';

export async function unlinkRepo(
  connection: IAbapConnection,
  args: IAbapGitUnlinkArgs,
): Promise<void> {
  const repos = await listRepos(connection);
  const match = repos.find(
    (r) => r.package.toUpperCase() === args.package.toUpperCase(),
  );
  if (!match) {
    throw new Error(`abapGit repository for package '${args.package}' not found`);
  }
  if (!match.repositoryId) {
    throw new Error(
      `abapGit repository '${args.package}': response missing <abapgitrepo:key>`,
    );
  }
  const params: Record<string, string> = {};
  if (args.transportRequest) params.corrNr = args.transportRequest;
  await connection.makeAdtRequest({
    method: 'DELETE',
    url: `/sap/bc/adt/abapgit/repos/${encodeURIComponent(match.repositoryId)}`,
    timeout: getTimeout('default'),
    params,
  });
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npm run build:fast
git add src/clients/abapGit/unlink.ts
git commit -m "feat(abapGit): add unlink via /repos/{key} (Phase Z verified)"
```

---

## Phase D: Handler class

### Task D1: `src/clients/AdtAbapGitClient.ts`

**Files:**
- Create: `src/clients/AdtAbapGitClient.ts`

- [ ] **Step 1: Read** `src/clients/AdtRuntimeClient.ts` for the closest non-core-module client style (constructor shape, logger usage).

- [ ] **Step 2: Write `AdtAbapGitClient.ts`**

```typescript
/**
 * ADT-integrated abapGit client.
 *
 * Implements IAdtAbapGitClient. All HTTP operations are delegated to
 * low-level functions in ./abapGit/*; this class owns the
 * options/state, enforces the public contract, and keeps the surface
 * cast-free at call sites by returning the specialized interface from
 * the AdtClient factory.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { checkExternalRepo } from './abapGit/checkExternalRepo';
import { getErrorLog } from './abapGit/getErrorLog';
import { linkRepo } from './abapGit/link';
import { listRepos as listReposLowLevel } from './abapGit/listRepos';
import { pullRepo } from './abapGit/pull';
import type {
  IAbapGitErrorLogEntry,
  IAbapGitExternalRepoCredentials,
  IAbapGitExternalRepoInfo,
  IAbapGitLinkArgs,
  IAbapGitPullArgs,
  IAbapGitPullResult,
  IAbapGitRepoStatus,
  IAbapGitUnlinkArgs,
  IAdtAbapGitClient,
  IAdtAbapGitClientOptions,
} from './abapGit/types';
import { unlinkRepo } from './abapGit/unlink';

function toPublicRepoStatus(r: {
  package: string;
  url: string;
  branchName: string;
  status: string;
  statusText: string;
  createdBy?: string;
  createdAt?: string;
  repositoryId?: string;
}): IAbapGitRepoStatus {
  return {
    package: r.package,
    url: r.url,
    branchName: r.branchName,
    status: r.status,
    statusText: r.statusText,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    repositoryId: r.repositoryId,
  };
}

export class AdtAbapGitClient implements IAdtAbapGitClient {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly contentTypeVersion: 'v3' | 'v4';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    options?: IAdtAbapGitClientOptions,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.contentTypeVersion = options?.contentTypeVersion ?? 'v3';
  }

  async link(args: IAbapGitLinkArgs): Promise<void> {
    this.logger?.debug?.(
      `AdtAbapGitClient.link: package=${args.package} url=${args.url}`,
    );
    await linkRepo(this.connection, args, this.contentTypeVersion);
  }

  async pull(args: IAbapGitPullArgs): Promise<IAbapGitPullResult> {
    this.logger?.debug?.(`AdtAbapGitClient.pull: package=${args.package}`);
    return pullRepo(this.connection, args, this.contentTypeVersion);
  }

  async unlink(args: IAbapGitUnlinkArgs): Promise<void> {
    this.logger?.debug?.(`AdtAbapGitClient.unlink: package=${args.package}`);
    await unlinkRepo(this.connection, args);
  }

  async listRepos(): Promise<IAbapGitRepoStatus[]> {
    const rows = await listReposLowLevel(this.connection);
    return rows.map(toPublicRepoStatus);
  }

  async getRepo(packageName: string): Promise<IAbapGitRepoStatus | undefined> {
    const repos = await this.listRepos();
    return repos.find(
      (r) => r.package.toUpperCase() === packageName.toUpperCase(),
    );
  }

  async getErrorLog(packageName: string): Promise<IAbapGitErrorLogEntry[]> {
    return getErrorLog(this.connection, packageName);
  }

  async checkExternalRepo(
    args: IAbapGitExternalRepoCredentials,
  ): Promise<IAbapGitExternalRepoInfo> {
    return checkExternalRepo(this.connection, args);
  }
}
```

**If Phase Z deferred unlink**, remove the `unlink` method, remove the import of `unlinkRepo`, and update `types.ts` (see Task A1).

- [ ] **Step 3: Write barrel export `src/clients/abapGit/index.ts`**

```typescript
export { AdtAbapGitClient } from '../AdtAbapGitClient';
export type {
  AbapGitStatus,
  IAbapGitErrorLogEntry,
  IAbapGitExternalRepoBranch,
  IAbapGitExternalRepoCredentials,
  IAbapGitExternalRepoInfo,
  IAbapGitLinkArgs,
  IAbapGitPullArgs,
  IAbapGitPullResult,
  IAbapGitRepoStatus,
  IAbapGitUnlinkArgs,
  IAdtAbapGitClient,
  IAdtAbapGitClientOptions,
} from './types';
```

If Phase Z deferred unlink, omit `IAbapGitUnlinkArgs`.

- [ ] **Step 4: Type-check and commit**

```bash
npm run build:fast
git add src/clients/AdtAbapGitClient.ts src/clients/abapGit/index.ts
git commit -m "feat(abapGit): add handler class and barrel export"
```

---

## Phase E: Public exports (standalone top-level client)

**Architectural rule.** `AdtClient` is reserved for `IAdtObject` factories. Separate clients like `AdtAbapGitClient` are **standalone top-level classes** — consumers instantiate them directly via `new AdtAbapGitClient(connection, logger, options)`. This phase does **not** touch `src/clients/AdtClient.ts`; it only exposes the new class and its types from the public entry point.

### Task E1: Public exports in `src/index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Read** `src/index.ts` — find the block that exports client classes (likely separate from the `core/*` exports).

- [ ] **Step 2: Append new exports**

```typescript
export { AdtAbapGitClient } from './clients/AdtAbapGitClient';
export type {
  AbapGitStatus,
  IAbapGitErrorLogEntry,
  IAbapGitExternalRepoBranch,
  IAbapGitExternalRepoCredentials,
  IAbapGitExternalRepoInfo,
  IAbapGitLinkArgs,
  IAbapGitPullArgs,
  IAbapGitPullResult,
  IAbapGitRepoStatus,
  IAbapGitUnlinkArgs,
  IAdtAbapGitClient,
  IAdtAbapGitClientOptions,
} from './clients/abapGit/index';
```

If Phase Z deferred unlink, omit `IAbapGitUnlinkArgs`.

- [ ] **Step 3: Full build**

```bash
npm run build
```

Expected: clean (Biome + tsc).

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(abapGit): export AdtAbapGitClient and IAdtAbapGitClient*"
```

Note: `src/clients/AdtClient.ts` is **not** modified in this phase. The architectural rule is that `AdtClient` only produces `IAdtObject<Config, State>` factories; separate clients stand alone.

---

## Phase F: Integration tests and yaml template

### Task F1: `test-config.yaml.template`

**Files:**
- Modify: `src/__tests__/helpers/test-config.yaml.template`

- [ ] **Step 1: Append a new section near the end, before any trailer**

```yaml
# abapGit client — only on systems that activate the ADT abapGit app
# (ABAP Platform 2022+ or SAP BTP ABAP Environment / Steampunk).
abapgit:
  test_cases:
    - name: "list_repos"
      enabled: true
      available_in: ["cloud"]
      description: "List all linked abapGit repositories"
      params: {}
    - name: "check_external_repo"
      enabled: true
      available_in: ["cloud"]
      description: "Probe a public read-only git repo"
      params:
        url: "https://github.com/SAP/abap-platform-refscen-flight"
    - name: "link_pull_unlink_flow"
      enabled: false   # disabled by default: mutates the target system
      available_in: ["cloud"]
      description: "Full link → pull → unlink cycle against a disposable package"
      params:
        package: "ZAC_SHR_ABAPGIT_TEST"
        url: "https://github.com/SAP/abap-platform-refscen-flight"
        branch: "refs/heads/main"
```

- [ ] **Step 2: Commit**

```bash
git add src/__tests__/helpers/test-config.yaml.template
git commit -m "test: add abapgit section to test-config template"
```

---

### Task F2: Integration test

**Files:**
- Create: `src/__tests__/integration/clients/abapGit/AbapGit.test.ts`

- [ ] **Step 1: Read** an existing non-core-module test as scaffold — e.g. `src/__tests__/integration/batch/BatchClient.test.ts` for the `clients/` fixture path style.

- [ ] **Step 2: Create directory**

```bash
mkdir -p src/__tests__/integration/clients/abapGit
```

- [ ] **Step 3: Write `AbapGit.test.ts`**

```typescript
/**
 * AbapGit client integration tests.
 *
 * AdtAbapGitClient is a standalone top-level class, instantiated
 * directly — not accessed via a factory on AdtClient (which is
 * reserved for IAdtObject implementations only).
 *
 * - listRepos: always runs (read-only, no mutation)
 * - checkExternalRepo: always runs (read-only probe)
 * - link_pull_unlink_flow: gated behind the test-config enabled flag
 *   AND available_in. Mutates the target system.
 *
 * Debug flags:
 *   DEBUG_ADT_TESTS=true     — test harness logs
 *   DEBUG_ADT_LIBS=true      — library runtime logs
 */

import * as dotenv from 'dotenv';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import { getConfig } from '../../../helpers/sessionConfig';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { AdtAbapGitClient } from '../../../../clients/AdtAbapGitClient';
import type { IAdtAbapGitClient } from '../../../../clients/abapGit';

dotenv.config();

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  getTimeout,
} = require('../../../helpers/test-helper');

describe('AbapGit (standalone AdtAbapGitClient)', () => {
  let connection: IAbapConnection;
  let abapGit: IAdtAbapGitClient;
  let isCloudSystem = false;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, createConnectionLogger('abapgit'));
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      abapGit = new AdtAbapGitClient(connection, createLibraryLogger('abapgit'));
      hasConfig = true;
    } catch (err) {
      createTestsLogger('abapgit').warn(
        `beforeAll setup failed: ${(err as Error).message}`,
      );
    }
  }, 120_000);

  afterAll(async () => {
    if (connection) await (connection as any).disconnect?.();
  });

  const listCase = getTestCaseDefinition('abapgit', 'list_repos');
  const listAvailable = listCase
    ? (listCase.available_in as string[]).includes(isCloudSystem ? 'cloud' : 'onprem')
    : false;

  (listAvailable ? it : it.skip)(
    'should list abapGit repositories',
    async () => {
      if (!hasConfig) throw new Error('test config missing');
      const repos = await abapGit.listRepos();
      expect(Array.isArray(repos)).toBe(true);
      for (const r of repos) {
        expect(typeof r.package).toBe('string');
        expect(typeof r.url).toBe('string');
        expect(typeof r.status).toBe('string');
      }
    },
    getTimeout('test'),
  );

  const checkCase = getEnabledTestCase('abapgit', 'check_external_repo');
  (checkCase ? it : it.skip)(
    'should probe an external repo',
    async () => {
      if (!hasConfig || !checkCase) throw new Error('test config missing');
      const info = await abapGit.checkExternalRepo({
        url: checkCase.params.url,
      });
      expect(Array.isArray(info.branches)).toBe(true);
    },
    getTimeout('test'),
  );

  const flowCase = getEnabledTestCase('abapgit', 'link_pull_unlink_flow');
  (flowCase ? it : it.skip)(
    'should execute link → pull → unlink flow',
    async () => {
      if (!hasConfig || !flowCase) throw new Error('test config missing');

      await abapGit.link({
        package: flowCase.params.package,
        url: flowCase.params.url,
        branchName: flowCase.params.branch,
      });

      const pullResult = await abapGit.pull({
        package: flowCase.params.package,
        branchName: flowCase.params.branch,
        pollIntervalMs: 2000,
        maxPollDurationMs: 300_000,
      });
      expect(pullResult.finalStatus.status).not.toBe('R');

      // Cleanup: unlink if the method is available on this build.
      if (typeof (abapGit as any).unlink === 'function') {
        await abapGit.unlink({ package: flowCase.params.package });
      }
    },
    getTimeout('test'),
  );
});
```

- [ ] **Step 4: Type-check tests**

Run: `npm run test:check:integration`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/integration/clients/abapGit
git commit -m "test(abapGit): add integration tests for list, probe, and flow"
```

---

### Task F3: Run tests live

**Files:** none new; live verification.

- [ ] **Step 1: Copy the template sections into the real `test-config.yaml`** (local, gitignored).

- [ ] **Step 2: Refresh JWT if needed, then run**

```bash
DEBUG_ADT_TESTS=true npm test -- integration/clients/abapGit 2>&1 | tee test-abapgit.log
```

Expected: `list_repos` and `check_external_repo` run; the flow test is `enabled: false` by default, so it skips.

- [ ] **Step 3: Read the log and fix any issues in place**

Common expected issues:
- HTTP 406 on `externalrepoinfo` → response envelope name differs from what Phase Z recorded. Update `EXTERNAL_REPO_INFO_REQUEST_TAG` in `checkExternalRepo.ts`.
- `parseExternalRepoInfo` returns no branches → root element name differs. Update `xmlParser.ts`.
- Empty repo list is normal on a system that never linked anything.

Each fix is a separate commit (e.g. `fix(abapGit): align externalrepoinfo envelope with live response`).

- [ ] **Step 4: Remove the log**

```bash
rm test-abapgit.log
```

---

## Phase G: Documentation and release prep

### Task G1: User-facing docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/usage/CLIENT_API_REFERENCE.md`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Modify: `docs/architecture/LEGACY.md`

- [ ] **Step 1: `CLAUDE.md`** — add a short paragraph about `AdtAbapGitClient` in the "Client Classes" section, next to `AdtClient` / `AdtRuntimeClient` / `AdtExecutor` / `AdtClientsWS`. Note it's a standalone top-level class (not a factory on AdtClient).

- [ ] **Step 2: `README.md`** — add a row "abapGit repositories" in the Supported Features table with `✅` gated on modern systems.

- [ ] **Step 3: `CLIENT_API_REFERENCE.md`** — add a new section after the featureToggle block:

````markdown
### AbapGit (ADT-integrated)

`AdtAbapGitClient` is a **standalone top-level class**, not a factory on `AdtClient`. `AdtClient` is reserved for `IAdtObject<Config, State>` implementations — separate clients stand on their own and are instantiated directly, same pattern as `AdtClient`, `AdtRuntimeClient`, `AdtExecutor`, and `AdtClientsWS`.

```typescript
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtAbapGitClient } from '@mcp-abap-adt/adt-clients';
import type { IAdtAbapGitClient } from '@mcp-abap-adt/adt-clients';

const connection = createAbapConnection({ /* ... */ });
const abapGit: IAdtAbapGitClient = new AdtAbapGitClient(connection);

// Probe a remote repo before linking
const info = await abapGit.checkExternalRepo({
  url: 'https://github.com/SAP/abap-platform-refscen-flight',
});
console.log(info.branches.map((b) => b.name));

// Link a package to a remote repo
await abapGit.link({
  package: 'ZMY_PKG',
  url: 'https://github.com/SAP/abap-platform-refscen-flight',
  branchName: 'refs/heads/main',
});

// Pull — awaits async server-side job. AbortSignal stops only the
// client wait; the server may still be running.
const result = await abapGit.pull({
  package: 'ZMY_PKG',
  pollIntervalMs: 2000,
  maxPollDurationMs: 600_000,
  onProgress: (s) => console.log(`status: ${s.status} — ${s.statusText}`),
});
if (result.finalStatus.status === 'E' || result.finalStatus.status === 'A') {
  console.error('pull failed:', result.errorLog);
}

// Read status without triggering a pull
const repo = await abapGit.getRepo('ZMY_PKG');

// Unlink (if supported on the target system)
if (typeof (abapGit as any).unlink === 'function') {
  await abapGit.unlink({ package: 'ZMY_PKG' });
}
```

**Availability.** The ADT-integrated abapGit surface ships with SAP BTP ABAP Environment (Steampunk) and modern on-prem from ABAP Platform 2022+. Legacy kernels (E77 and similar) do not expose `/sap/bc/adt/abapgit/*`.

**Async pull contract.** The server-side pull continues independently of the client-side wait. If you abort or hit the max-duration cap, the thrown `AbortError` / `TimeoutError` carries `lastKnownStatus` (when a read succeeded). The client must poll `getRepo(package)` until `status !== 'R'` before issuing another `pull` or `unlink`.
````

- [ ] **Step 4: `ARCHITECTURE.md`** — add `getAbapGit()` to the factories list.

- [ ] **Step 5: `LEGACY.md`** — add abapGit to "not supported on legacy (endpoint family absent)" table with endpoint `/sap/bc/adt/abapgit/*`.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md docs/
git commit -m "docs: register abapGit client in user-facing docs"
```

- [ ] **Step 7: Regenerate ADT_OBJECT_ENTITIES.md**

```bash
npm run adt:entities
git add docs/usage/ADT_OBJECT_ENTITIES.md
git commit -m "docs(entities): regenerate ADT_OBJECT_ENTITIES for abapGit client"
```

---

### Task G2: Final build and PR

**Files:** none new; verification only.

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 2: Commit count check**

```bash
git log --oneline main..HEAD
```

Expect ~15-17 commits across phases.

- [ ] **Step 3: Push and open PR** (only on user's explicit confirmation)

```bash
git push -u origin feature/abapgit-client
gh pr create --title "feat: add AdtAbapGitClient (ADT-integrated abapGit)" --body "$(cat <<'EOF'
## Summary
Adds `AdtAbapGitClient` — a specialized separate client under `src/clients/` that wraps SAP-official ADT-integrated abapGit (`/sap/bc/adt/abapgit/*`). Covers link, pull (with async status polling and an abort/timeout recovery contract), unlink (conditional on a verified delete protocol), listRepos, getRepo, getErrorLog, and checkExternalRepo.

## Context
- Design spec: `docs/superpowers/specs/2026-04-19-abapgit-client-design.md` (Variant C selected).
- Roadmap: `docs/superpowers/specs/2026-04-19-sapcli-separate-clients-proposal.md` item #1.
- Phase Z live-probe findings captured in the spec's §12.

## Architecture
- Specialized `IAdtAbapGitClient` interface per roadmap §4.2. Factory returns it directly — no cast at call sites.
- `AbortSignal` and `maxPollDurationMs` stop only the client-side wait loop. The server-side pull may continue. Thrown `AbortError` / `TimeoutError` carries `lastKnownStatus` for recovery.

## Test plan
- [x] `npm run build` — clean
- [x] `npm run test:check:integration` — clean
- [x] `npm test -- integration/clients/abapGit` against the cloud trial target — `listRepos` and `checkExternalRepo` pass; `link_pull_unlink_flow` is disabled by default (mutating).

## Outstanding
- On-prem verification on ABAP Platform 2022+ target — widens `available_in` to `["cloud", "onprem"]` post-merge if successful.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist

**Spec coverage:**
- [x] Spec §1 (Goal — ADT-integrated abapGit wrapper) → Tasks A1, D1, E1
- [x] Spec §2 in-scope (link, pull, unlink conditional, listRepos, getRepo, getErrorLog, checkExternalRepo) → Tasks A1, C1, C2, C3, C4, D1
- [x] Spec §2 out-of-scope (push, branch management, v4 default) → not implemented; version is opt-in via options (Task A2, D1)
- [x] Spec §3 verified evidence (endpoints, content-types, namespaces) → Tasks A2, B1, B2
- [x] Spec §4.1 factory signature `getAbapGit(options?)` → Task E1
- [x] Spec §4.2 `IAdtAbapGitClient` + supporting types → Task A1
- [x] Spec §4.3 `IAdtAbapGitClientOptions` with `contentTypeVersion` → Task A1, D1
- [x] Spec §5 module layout 10 files → Phases A–D
- [x] Spec §6.1 link semantics → Task C1
- [x] Spec §6.2 pull with abort/timeout recovery contract → Task C2
- [x] Spec §6.3 unlink conditional on verified delete protocol → Phase Z + Task C4 (guarded)
- [x] Spec §6.4 listRepos → Task C1
- [x] Spec §6.5 getRepo via client.listRepos() + filter → Task D1
- [x] Spec §6.6 getErrorLog as first-class method → Task C3
- [x] Spec §6.7 checkExternalRepo → Task C3
- [x] Spec §7 non-decisions (transport, XML parsing, credentials, atom links, content-type default v3, polling defaults, env gating, error semantics) → Tasks A1, A2, C2, C4, D1
- [x] Spec §8 open questions resolved before coding via Phase Z
- [x] Spec §9 verification sources — reflected in plan header

**Placeholder scan:** No `TBD` / `TODO` / "similar to Task X". Every code block is complete. The only conditional path (Task C4 unlink) is explicitly gated on Phase Z output with the decision rule spelled out.

**Type consistency:**
- `IAdtAbapGitClient` method signatures in Task A1 match class methods in Task D1 and factory return type in Task E1.
- `linkRepo`, `pullRepo`, `unlinkRepo`, `listRepos` (low-level) in Tasks C1/C2/C4 match handler imports in Task D1.
- `IAbapGitRepoStatus` optional `repositoryId` is populated by `parseRepoEntity` in Task B2 and surfaced through `toPublicRepoStatus` in Task D1.
- `contentTypeVersion: 'v3' | 'v4'` consistent across types.ts (A1), low-level link/pull (C1, C2), and handler (D1).
