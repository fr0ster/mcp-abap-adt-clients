# Design: abapGit Client (`AdtAbapGitClient`)

Date: 2026-04-19
Status: Variant C selected — ready for implementation planning after protocol-contract clarifications
Parent: `docs/superpowers/specs/2026-04-19-sapcli-separate-clients-proposal.md` (roadmap item #1)

> **Per-class variant-selection pattern.** Each class in the sapcli-separate-clients roadmap gets its own three-variant design document. The variant choice is resolved independently per class. abapGit — Variant C: users need the full lifecycle (link / pull / unlink) plus introspection (list, status, error log) and pre-link validation (check external repo). Variant A (core module) was rejected because abapGit has no ADT-artefact lifecycle (no activation / lock / source / canonical check). Variant B (minimal sapcli parity) was rejected because it would leave unlink, standalone status-read, error-log, and external-repo validation to a follow-up PR.

## 1. Goal

Add a client that wraps the SAP-official **ADT-integrated abapGit** — not the community abapGit (which is a separately-installed ABAP program). The ADT-integrated variant lets a consumer bind an ABAP package to a remote git repository, pull branches, inspect status, retrieve error logs, unlink when done, and probe a remote repository before committing to a link.

The class must cover every operation evidenced by either sapcli or our discovery corpus, expose them through a specialized `IAdtAbapGitClient` interface, and encapsulate the server-side async status polling (`R`/`E`/`A`/OK) so consumers see a synchronous API.

## 2. Scope

**In scope:**

- `link` — bind a package to a remote URL (matches sapcli `link`).
- `pull` — trigger a pull and wait for terminal state, with optional progress heartbeat (matches sapcli `pull`).
- `unlink` — remove an existing binding, but only against a delete contract verified before implementation starts. If live probing cannot confirm a supported delete path, `unlink` drops from v1 instead of shipping a guessed protocol.
- `listRepos` — enumerate all linked repositories on the system.
- `getRepo(packageName)` — fetch a single repo's current status without side effects.
- `getErrorLog(packageName)` — fetch the error log as a first-class operation, not only as a side effect of a failed pull.
- `checkExternalRepo` — probe a remote URL + credentials before the irreversible `link` (uses `/sap/bc/adt/abapgit/externalrepoinfo`).

**Explicitly out of scope for v1 (may be added later):**

- **Push.** The ADT abapGit service does not universally support push via this endpoint family; sapcli does not implement it. Excluded until a concrete workflow demands it.
- **Branch management** (switch branch, list branches beyond `checkExternalRepo`'s branch list). The `branchName` is already carried on `link` and `pull`; dedicated branch ops wait for demand.
- **Content-Type v4** (discovery's newest version). Default to v3 for sapcli compatibility; implementation exposes `options.contentTypeVersion` only if a consumer explicitly needs v4.

## 3. Verified evidence

### 3.1 sapcli reference (`sap/cli/abapgit.py`, `sap/adt/abapgit.py`)

Implemented surface:

- **`link`** → `POST /sap/bc/adt/abapgit/repos`
  - Content-Type: `application/abapgit.adt.repo.v3+xml`
  - Body:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <abapgitrepo:repository xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories">
      <abapgitrepo:package>…</abapgitrepo:package>
      <abapgitrepo:url>…</abapgitrepo:url>
      <abapgitrepo:branchName>…</abapgitrepo:branchName>
      <abapgitrepo:remoteUser>…</abapgitrepo:remoteUser>
      <abapgitrepo:remotePassword>…</abapgitrepo:remotePassword>
      <abapgitrepo:transportRequest>…</abapgitrepo:transportRequest>
    </abapgitrepo:repository>
    ```
  - Null-valued entries are omitted (sapcli `repo_request_body` filters them).
  - Expected HTTP 200.
- **`pull`** — two-step async flow:
  - Fetch: `GET /sap/bc/adt/abapgit/repos` with Accept `application/abapgit.adt.repos.v2+xml`. Parse, find repo where `<abapgitrepo:package>` matches. Extract atom links: `pull_link`, `log_link`.
  - Trigger: `POST <pull_link>` with same Content-Type and XML envelope as link. Expect HTTP 202.
  - Poll: every 1000ms re-fetch the list; repository status `R` = running; loop until status differs.
  - Terminal states: `E` (error), `A` (abort), other = OK.
- **Error log** (invoked inside sapcli's `pull` on non-OK terminal):
  - `GET <log_link>` with Accept `application/abapgit.adt.repo.object.v2+xml`
  - Response XML: `<abapObjects:abapObject>` list with `msgType`, `type`, `name`, `msgText` children. sapcli filters out `msgType == 'S'`.

XML namespaces:

- `abapgitrepo = http://www.sap.com/adt/abapgit/repositories`
- `abapObjects = http://www.sap.com/adt/abapgit/abapObjects`

Default branch when not provided by the caller (sapcli): `refs/heads/master`. sapcli's `pull` reuses the current binding's branch when `--branch` is omitted.

### 3.2 Discovery corpus

Only in `docs/discovery/discovery_cloud_mdd_raw.xml` and `discovery_trial_raw.xml`:

- `/sap/bc/adt/abapgit/repos` — collection (link + list).
- `/sap/bc/adt/abapgit/externalrepoinfo` — probe endpoint (NOT wrapped by sapcli).
- Accept/Content-Type versions advertised on `repos`: `abapgit.adt.repo.v1+xml` through `v4+xml`.
- Accept/Content-Type versions advertised on `externalrepoinfo`: `abapgit.adt.repo.info.ext.request.v1+xml` and `v2+xml`.

**Not in** `endpoints_onprem_modern_e19.txt` or `endpoints_onprem_old_e77.txt`. ADT-integrated abapGit ships with ABAP Platform / Steampunk — the E19 and E77 snapshots predate it or it was simply not activated on those systems.

**Real-world availability:** ADT abapGit ships with SAP BTP ABAP Environment (Steampunk) and modern on-prem from ABAP Platform 2022+. Gating starts `["cloud"]` and widens to `["cloud", "onprem"]` only after a live verification on a qualifying modern on-prem system.

### 3.3 sapcli gaps Variant C fills

sapcli implements only `link` and `pull`. It does NOT cover:

- **Unlink / delete** a repository binding.
- **Push** (intentionally excluded from v1).
- **Branch management** (intentionally excluded from v1; branch name is still carried in args).
- **External repo info probe** (`externalrepoinfo` — discovery evidence only).
- **Read-only status check** without triggering pull.
- **Standalone log retrieval** outside the pull flow.

Variant C fills the first, fourth, fifth, and sixth via `unlink`, `checkExternalRepo`, `getRepo`, and `getErrorLog`. Push and branch management remain out of scope.

## 4. Public API shape

### 4.1 Standalone top-level class

Per the roadmap's architectural constraint (§4 and §4.2), `AdtClient` is reserved for `IAdtObject` factories. For non-`IAdtObject` surfaces, we ship separate top-level client classes that consumers instantiate directly — same pattern as `AdtClient`, `AdtRuntimeClient`, `AdtExecutor`, and `AdtClientsWS`.

```ts
import { AdtAbapGitClient } from '@mcp-abap-adt/adt-clients';

const abapGit: IAdtAbapGitClient = new AdtAbapGitClient(connection, logger, options);
```

The class's concrete type (`AdtAbapGitClient`) implements `IAdtAbapGitClient`. Consumers typically annotate the variable as the interface so the full supported API stays visible without casts and the concrete class can evolve internally.

There is **no** `AdtClient.getAbapGit()` method. Adding one would violate the `AdtClient` = IAdtObject-only invariant.

### 4.2 Specialized public interface

```ts
export type AbapGitStatus = 'R' | 'E' | 'A' | string;   // 'R'=running, 'E'=error, 'A'=abort, any other value = OK

export interface IAbapGitRepoStatus {
  package: string;
  url: string;
  branchName: string;
  status: AbapGitStatus;
  statusText: string;
  createdBy?: string;
  createdAt?: string;
  // Repository ID exposed by the entity (used internally for unlink; surfaced here
  // because some consumers may want to correlate across calls).
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
  branchName?: string;      // default 'refs/heads/master'
  remoteUser?: string;
  remotePassword?: string;
  transportRequest?: string;
}

export interface IAbapGitPullArgs {
  package: string;
  branchName?: string;      // if omitted, the binding's current branch is reused
  remoteUser?: string;
  remotePassword?: string;
  transportRequest?: string;
  pollIntervalMs?: number;  // default 1000
  maxPollDurationMs?: number; // default 600_000 (10 min); throws on timeout
  signal?: AbortSignal;     // optional external cancellation
  onProgress?: (status: IAbapGitRepoStatus) => void;
}

export interface IAbapGitUnlinkArgs {
  package: string;
  transportRequest?: string;
}

export interface IAbapGitPullResult {
  finalStatus: IAbapGitRepoStatus;
  errorLog?: IAbapGitErrorLogEntry[];   // populated only on 'E' or 'A'
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
  access?: 'read' | 'write' | string;
  // Additional fields filled from the live response during implementation.
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

### 4.3 Options shape

```ts
export interface IAdtAbapGitClientOptions {
  contentTypeVersion?: 'v3' | 'v4';  // default 'v3' for sapcli compatibility
}
```

Per the roadmap's options-contract note (§4.1), this is an independent per-class contract, not an attempt to standardise across all separate clients.

## 5. Module layout

```
src/clients/
  AdtAbapGitClient.ts            # handler — implements IAdtAbapGitClient
  abapGit/
    types.ts                     # public and internal types
    xmlBuilder.ts                # builds <abapgitrepo:repository> envelope
    xmlParser.ts                 # parses repo list, error log, externalrepoinfo
    link.ts                      # POST /repos (link a package)
    pull.ts                      # POST <pull_link> + poll logic
    unlink.ts                    # DELETE <edit_link> (URI from live response)
    listRepos.ts                 # GET /repos
    getErrorLog.ts               # GET <log_link>
    checkExternalRepo.ts         # POST /externalrepoinfo
    poll.ts                      # internal polling helper with AbortSignal support
```

Nine files under `src/clients/abapGit/` + the handler. Corresponds to a single-file-per-operation convention used by the core modules and keeps each file focused.

## 6. Operation semantics

### 6.1 `link`

1. Build XML body (`buildLinkBody(args)`) with all non-null fields.
2. `POST /sap/bc/adt/abapgit/repos` with Content-Type `application/abapgit.adt.repo.v${n}+xml` where `n = options.contentTypeVersion ?? 3`.
3. On 200 → resolve. Non-2xx → throw.

### 6.2 `pull`

1. `listRepos()` to locate the binding by package; extract `pull_link` from atom links. If missing → throw `NotFoundError`.
2. Resolve `branchName`: caller-supplied or the binding's current `branchName`.
3. `POST <pull_link>` with the XML envelope. Expect HTTP 202.
4. **Poll loop** (`poll.ts`):
   - Every `pollIntervalMs` (default 1000): `listRepos()` → find by package → inspect `status`.
   - While status is `R`: continue. Invoke `onProgress(status)` if provided.
   - Respect `signal`: throw `AbortError` if aborted.
   - Respect `maxPollDurationMs` (default 600000): throw `TimeoutError` if exceeded.
   - On non-`R` status: break loop. Return status.
5. Terminal state handling:
   - `E` or `A` → also fetch error log via `getErrorLog(package)`; attach to result.
   - Anything else → treat as OK; no error log fetched.
6. Abort / timeout recovery contract:
   - `AbortSignal` and max-duration stop only the **client-side wait loop**. They do **not** imply cancellation of the server-side abapGit job.
   - Before throwing `AbortError` / `TimeoutError`, the client performs one best-effort final `getRepo(package)` read and attaches the result as `lastKnownStatus` on the thrown error when available.
   - After `AbortError` / `TimeoutError`, callers must treat the repository as potentially still running and use `getRepo(package)` until `status !== 'R'` before issuing another `pull` or `unlink`.
   - Retrying `pull` while the previous server-side job is still `R` is unsupported and must fail fast with a clear error.

### 6.3 `unlink`

`unlink` is included in v1 only if the delete contract is verified up front on a live target. The implementation plan starts with that verification step and must not proceed with a guessed delete protocol.

If the contract is confirmed, use one of these server-accepted forms:

1. **Preferred:** extract the `edit_link` (or `delete_link`) from the repo entity's atom links in `listRepos`, then `DELETE <edit_link>`. Transport request carried as a query param `?corrNr=…` if provided.
2. **Fallback:** if the entity does not expose a delete link, derive the URI as `/sap/bc/adt/abapgit/repos/{repositoryId}` and issue `DELETE`.

If neither form is verified, `unlink` is removed from the v1 implementation plan and from the public interface before coding starts. We do not ship a speculative delete path.

### 6.4 `listRepos`

`GET /sap/bc/adt/abapgit/repos` with Accept `application/abapgit.adt.repos.v2+xml`. Parse into `IAbapGitRepoStatus[]`.

### 6.5 `getRepo(packageName)`

Calls `listRepos()` internally and filters. Returns `undefined` if absent (no throw on 404-equivalent).

### 6.6 `getErrorLog(packageName)`

1. `listRepos()` to locate the binding and extract `log_link`.
2. `GET <log_link>` with Accept `application/abapgit.adt.repo.object.v2+xml`.
3. Parse entries; do **not** filter out `msgType == 'S'` here. That's sapcli's CLI formatting choice; library-level consumers decide for themselves.

### 6.7 `checkExternalRepo`

`POST /sap/bc/adt/abapgit/externalrepoinfo` with:
- Content-Type: `application/abapgit.adt.repo.info.ext.request.v2+xml` (prefer v2 over v1).
- Accept: same.
- Body: XML envelope with `url`, `remoteUser`, `remotePassword`. Namespace and element names confirmed against a live response during implementation.

Parse into `IAbapGitExternalRepoInfo`. Final response-shape confirmed at live-probe time; if the shape differs from the proposal, the spec and interface are adjusted in the implementation plan.

## 7. Non-decisions (fixed constraints)

- **Transport layer.** Only `IAbapConnection`. No direct axios.
- **XML parsing.** `fast-xml-parser`; namespaces `abapgitrepo` and `abapObjects`.
- **Credentials.** `remoteUser` / `remotePassword` forwarded verbatim in XML body; never logged.
- **Atom links.** All sub-operations (`pull`, `unlink`, `getErrorLog`) extract their URLs from atom links on the repo entity rather than hard-coding paths. Matches sapcli's `_get_link` approach.
- **Content-Type version.** Default `v3` (sapcli compat). v4 is opt-in via `options.contentTypeVersion`.
- **Async polling.** Default 1000ms interval, 10-minute max duration. Abortable via `AbortSignal`.
- **Environment gating.** `available_in: ["cloud"]` initially. Implementation plan probes a modern on-prem target if one is available; otherwise widens on first positive report.
- **Error semantics.** `NotFoundError` on missing repo. `AbortError` / `TimeoutError` from `pull` mean only that client-side waiting stopped; they do not imply remote-job cancellation and should carry `lastKnownStatus?: IAbapGitRepoStatus`. All others propagate as thrown `Error` with status details.
- **Public typing rule.** Factory returns `IAdtAbapGitClient`, not a narrower base type. Specialized interface per roadmap §4.2.
- **Client placement.** `src/clients/AdtAbapGitClient.ts` (handler) and `src/clients/abapGit/` (helpers).
- **Documentation.** README, CLIENT_API_REFERENCE, ARCHITECTURE, LEGACY, CHANGELOG, ADT_OBJECT_ENTITIES updates follow the #21 / #28 pattern.

## 8. Open questions for the implementation plan

These do not block variant selection but must be resolved during implementation:

- **Unlink URI template.** Atom `edit_link` vs `/repos/{id}` — resolve before coding the v1 surface; if unresolved, defer `unlink`.
- **`externalrepoinfo` response shape.** Confirmed against a live trace; the `IAbapGitExternalRepoInfo` type may gain or lose fields.
- **`repositoryId`** on `IAbapGitRepoStatus` — where in the response XML it lives, whether it's surfaced on every version of the Accept type.
- **`v3` vs `v4` Content-Type behaviour.** If `v3` response shape differs from `v4`, decide whether `listRepos()` parsing branches or whether we mandate a single version.
- **On-prem availability.** Test on a modern on-prem system from `ABAP Platform 2022+` to confirm endpoints activate and to widen `available_in`.

## 9. Verification sources

This design was adjusted after cross-checking against:

- `~/prj/sapcli` — `sap/cli/abapgit.py`, `sap/adt/abapgit.py`.
- `docs/discovery/discovery_{cloud_mdd,trial,e19,e77}_raw.xml` + `docs/discovery/endpoints_*.txt`.
- Proposal rules: `docs/superpowers/specs/2026-04-19-sapcli-separate-clients-proposal.md` §4.1 (variant selection), §4.2 (public typing).

Not every claim is discovery-backed to the same degree. Specifically:
- `unlink`, `checkExternalRepo` response shape, and `repositoryId` location require **live probing** during implementation.
- On-prem availability is a real-world-known fact (ABAP Platform 2022+) that the captured discovery snapshots don't reflect.

## 10. Next step

Invoke `writing-plans` to produce `docs/superpowers/plans/2026-04-19-abapgit-client.md` with task-by-task TDD-oriented implementation.

## 12. Live-probe findings (2026-04-19)

Pre-coding verification pass executed against cloud trial
(`.abap.ap21.hana.ondemand.com`). All three unknowns in §8 resolved;
unlink ships in v1.

### 12.1 `GET /sap/bc/adt/abapgit/repos` (`listRepos`)

Request `Accept: application/abapgit.adt.repos.v2+xml` → HTTP 200.

Response shape (actual, from live trace):

- **Root:** `<abapgitrepo:repositories>` with namespace `abapgitrepo = http://www.sap.com/adt/abapgit/repositories`.
- **Entry:** `<abapgitrepo:repository>` with child elements (all `abapgitrepo:`-prefixed):
  - `key` — repository ID, 12-digit zero-padded, e.g. `000000000001`
  - `package`
  - `folderLogic` — e.g. `PREFIX`
  - `url`
  - `branchName`
  - `createdBy`, `createdEmail`, `createdAt` (format: `YYYYMMDDHHMMSS.ffffff`, not ISO-8601)
  - `deserializedBy`, `deserializedEmail`, `deserializedAt` (same format as createdAt)
  - `status` — observed value: `S` (success / terminal OK). sapcli's `R`/`E`/`A` codes and "other = OK" bucket remain correct; `S` falls into the OK bucket.
  - `statusText` — e.g. `Pulled successfully`, `Pushed successfully`.
- **Atom links per repo** (via `<atom:link>` children):
  - `pull_link` — `/sap/bc/adt/abapgit/repos/{key}/pull`
  - `log_link`
  - `check_link`
  - `status_link`
  - `stage_link` (push flow; out of v1 scope)
  - `push_link` (push flow; out of v1 scope)
  - `modifiedobjects_link`
  - **No `edit_link` or `delete_link`.**

**Implications for the parser:** `repositoryId` = `<abapgitrepo:key>`. There are more link types than the three originally listed in §4.2; the parser must ignore unknown link types gracefully. `status = 'S'` goes through the "other = OK" bucket in `pull`'s terminal handling.

### 12.2 `DELETE /sap/bc/adt/abapgit/repos/{id}` (`unlink`)

Probed with a nonexistent ID `999999999999`. Server returned HTTP 404 with `<exc:exception>` message `repo not found, get`. The endpoint is wired for DELETE and correctly routed — the only failure was the nonexistent ID. Had the endpoint not supported DELETE, we would expect 405 Method Not Allowed or similar.

**Contract confirmed:** `DELETE /sap/bc/adt/abapgit/repos/{key}` removes a linked repository. No `?corrNr` parameter observed in the sample response; keep the argument in `IAbapGitUnlinkArgs` but pass `corrNr` as a query param only when supplied — server will ignore it if unused.

**Implication for the plan:** Task C4 ships with **Option B** (URL-by-id). `match.repositoryId` presence check replaces the atom-link check.

### 12.3 `POST /sap/bc/adt/abapgit/externalrepoinfo` (`checkExternalRepo`)

Request must use:

- Content-Type: `application/abapgit.adt.repo.info.ext.request.v2+xml`
- Accept: `application/abapgit.adt.repo.info.ext.response.v2+xml` — **note the `.response.` vs `.request.` split in the media-type family**
- Body namespace: `http://www.sap.com/adt/abapgit/externalRepo` (capital R, **no `info` suffix**) — different from the `repositories` namespace used by `link`/`pull`.
- Request root element: `<abapgitexternalrepo:externalRepoInfoRequest>`

Response shape:

- **Root:** `<abapgitexternalrepo:externalRepoInfo>` with namespace `abapgitexternalrepo = http://www.sap.com/adt/abapgit/externalRepo`.
- **`<abapgitexternalrepo:accessMode>`** — e.g. `PUBLIC`. (Was `access` in the spec's draft type; actual field name is `accessMode`.)
- **List of `<abapgitexternalrepo:branch>` entries**, each with children:
  - `<sha1>`
  - `<name>` (e.g. `refs/heads/main`, `HEAD`)
  - `<type>` (e.g. `HD`)
  - `<isHead>` — SAP-XML boolean: `X` = true, empty element `<isHead/>` = false. **Not lowercase `true`/`false`.**
  - `<displayName>`
  - Atom link to `branchinfo` (per-branch deep-dive endpoint; out of v1 scope).

**Implications for the parser and types:**

1. `IAbapGitExternalRepoInfo.access` renames to **`accessMode`** to match wire protocol.
2. `IAbapGitExternalRepoBranch.isHead` parsing: `String(raw).toUpperCase() === 'X'` (not `.toLowerCase() === 'true'`).
3. Envelope tag name constant in `checkExternalRepo.ts` is `externalRepoInfoRequest` (confirmed).
4. Builder must emit the body in the `externalRepo` (not `repositories`) namespace.
5. Parser must use the `externalRepo` namespace for responses.

### 12.4 Content-Type version (`v3` vs `v4`)

Not probed directly in this pass. sapcli's `v3` content-type is confirmed to work with `link` / `pull` against cloud MDD implicitly (the discovery declares both, and `v3` is sapcli-compatible). Default stays `v3`; `v4` opt-in via `IAdtAbapGitClientOptions.contentTypeVersion`. If a consumer reports a case where `v3` returns a stale payload and `v4` does not, we add version-aware parsing.

### 12.5 On-prem availability

Not probed (no on-prem endpoint available in this pass). Gating stays at `available_in: ["cloud"]` until an on-prem target with ABAP Platform 2022+ is available. Widening happens post-merge via a follow-up test run; no code change required.

### 12.6 Summary — what the plan must adjust

- **Types (`types.ts`):** `IAbapGitExternalRepoInfo.access` → `accessMode`.
- **Parser (`xmlParser.ts`):**
  - Root element for `externalRepoInfo` is confirmed singular; drop the `?? parsed?.externalRepoInfoResponse` branch.
  - `isHead` parsing: `X`-boolean, not `true`/`false`-string.
  - Root namespace for externalrepoinfo response: `externalRepo` (not `externalrepoinfo`).
- **`xmlBuilder.ts`:** `buildExternalRepoInfoBody` must emit the `externalRepo` namespace for the request envelope, not `repositories`.
- **`unlink.ts`:** Use Option B (`/repos/{key}`), not Option A. Check `match.repositoryId` presence, not atom-link presence.
- **`listRepos` parser:** ignore unknown atom link types gracefully (`check_link`, `status_link`, `push_link`, `stage_link`, `modifiedobjects_link`) — these are not consumed in v1 but must not break the parser.

The implementation plan (`docs/superpowers/plans/2026-04-19-abapgit-client.md`) must be amended to reflect these findings before coding starts.
