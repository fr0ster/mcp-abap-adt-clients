# Design: abapGit Client (three variants for review)

Date: 2026-04-19
Status: Three-variant proposal awaiting user decision
Parent: `docs/superpowers/specs/2026-04-19-sapcli-separate-clients-proposal.md` (roadmap item #1 — pattern baseline)

> **Per-class variant-selection pattern.** Each class in the sapcli-separate-clients roadmap gets its own three-variant design document. The variant choice is resolved independently per class. Per the roadmap variant-selection rule (§4.1), the default starting assumption for abapGit is **Variant C** (service-like, orchestration-heavy; multiple repos managed, polling lifecycle, not a single ADT object). Variants A and B remain on the table for completeness.

## 1. Goal

Add a client that wraps the SAP-official **ADT-integrated abapGit** — not the community abapGit (which is a separately-installed ABAP program). The ADT-integrated variant lets a consumer bind an ABAP package to a remote git repository, pull branches, inspect status, and retrieve error logs, all via the ADT HTTP API.

## 2. Why three variants

The abapGit surface presents the usual architectural choice — full IAdtObject lifecycle vs narrow sapcli-parity vs extended separate client — plus a domain-specific wrinkle: `link` and `pull` are **asynchronous** on the server, with a status-poll cycle (`R` = running, `E` = error, `A` = abort, others = OK). How we model the wait matters.

## 3. Verified evidence

### 3.1 sapcli reference (`sap/cli/abapgit.py`, `sap/adt/abapgit.py`)

Two CLI commands, two repository operations:

- **`link <package> <url> [--branch] [--remote-user] [--remote-password] [--corrnr]`**
  - `POST /sap/bc/adt/abapgit/repos`
  - Content-Type: `application/abapgit.adt.repo.v3+xml`
  - Body: XML envelope `<abapgitrepo:repository xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories">` with children `package`, `url`, `branchName`, `remoteUser`, `remotePassword`, `transportRequest` (all text; null-valued entries omitted).
  - Expected: HTTP 200.
- **`pull <package> [--branch] [--remote-user] [--remote-password] [--corrnr]`**
  - Fetch step: `GET /sap/bc/adt/abapgit/repos` with Accept `application/abapgit.adt.repos.v2+xml`. Parse XML, find repo whose child `<abapgitrepo:package>` equals the requested name. Extract atom links: `pull_link`, `log_link`.
  - Pull trigger: `POST <pull_link>` with Content-Type `application/abapgit.adt.repo.v3+xml`, same body envelope as link.
  - Expected: HTTP 202 (async accepted).
  - Poll: re-fetch the repo list every 1s; repository status `R` means running; loop until state is different.
  - Final states in sapcli code: `'E'` (error), `'A'` (abort), other (OK). On error/abort, fetch `log_link` and print log entries.
- **Error log retrieval** (invoked inside `pull`):
  - `GET <log_link>` with Accept `application/abapgit.adt.repo.object.v2+xml`
  - XML: list of `<object:abapObject xmlns:object="http://www.sap.com/adt/abapgit/abapObjects">` with children `msgType`, `type`, `name`, `msgText`. sapcli filters out `msgType == 'S'` (success noise).

Namespaces used by the XML envelopes:
- `abapgitrepo = http://www.sap.com/adt/abapgit/repositories` — repo entity
- `abapObjects = http://www.sap.com/adt/abapgit/abapObjects` — error log objects

### 3.2 Discovery corpus

Only in `docs/discovery/discovery_cloud_mdd_raw.xml` and `discovery_trial_raw.xml`:

- `/sap/bc/adt/abapgit/repos` — collection (link + list)
- `/sap/bc/adt/abapgit/externalrepoinfo` — probe endpoint (NOT used by sapcli)
- Accept/Content-Type versions advertised: `abapgit.adt.repo.v1+xml`, `…v2+xml`, `…v3+xml`, `…v4+xml`; plus `abapgit.adt.repo.info.ext.request.v1+xml`, `…v2+xml` for `externalrepoinfo`.

**Not in** `endpoints_onprem_modern_e19.txt` or `endpoints_onprem_old_e77.txt`. ADT-integrated abapGit ships with ABAP Platform / Steampunk — the E19 and E77 snapshots predate it or it was simply not activated on those systems. **Availability is cloud-only in our corpus.**

Real-world: ADT abapGit ships with SAP BTP ABAP Environment (Steampunk) and modern on-prem from ABAP Platform 2022+. Our gating starts at `["cloud"]` and widens only after live on-prem verification on a qualifying system.

### 3.3 sapcli coverage gaps

sapcli implements only `link` and `pull` (+ the log retrieval inside `pull`). It does NOT cover:

- **Unlink / delete** a repository binding (no `sap.adt.abapgit.Repository.unlink()`).
- **Push** (the ADT abapGit service does not universally support push; depends on the remote repo permissions and server configuration).
- **Branch management** (switch branch, list branches).
- **External repo info probe** (`externalrepoinfo` — discovery-only, no sapcli wrapper).
- **Read-only status check** without triggering pull.
- **Standalone log retrieval** (log is only printed as a side-effect of failed pulls in sapcli's CLI).
- **Content-Type v4** (sapcli hard-codes v3; discovery shows v4 available on cloud).

## 4. Variant A — core module under `src/core/abapGitRepo/`

**Shape.** Treat a repository-package binding as an `IAdtObject<IAbapGitRepoConfig, IAbapGitRepoState>` with canonical CRUD + lifecycle. The "object" identity is the ABAP package name — one package, one linked repo. `create` = link; `read` = fetch entity; `update` = re-link (change URL / branch); `delete` = unlink; `activate` = no-op; `readMetadata` = same as read; `check` = no-op.

**Why it could fit.**

- Package-to-repo binding does have an identity (package name) and a lifecycle (create / read / update / delete).
- Consumers discover `getAbapGitRepo()` next to other `getXxx()` factories and get a familiar shape.

**Why it does NOT fit.**

- **No canonical activation.** `/sap/bc/adt/activation` is meaningless for a repo binding — there is nothing to activate. The method becomes a stub.
- **No lock/unlock.** abapGit has no `?_action=LOCK` contract in sapcli or discovery. Concurrent access control is handled server-side via the async status machine, not ADT locks. `lock()` / `unlock()` become stubs.
- **No canonical check.** `/checkruns?reporters=abapCheckRun` does not apply to a repo binding. `check()` is a stub.
- **`pull` is not any canonical IAdtObject operation.** It does not fit `create`, `read`, `update`, `delete`, or `activate`. Forcing it into `update` would be misleading — a pull doesn't rewrite the binding metadata, it fetches remote code and applies it.
- **Async status polling is alien to the IAdtObject contract.** Every other core module operation is synchronous from the client's perspective. Adding polling to the base interface is a semantic stretch.

**Verdict.** Variant A leaves roughly half of the IAdtObject interface as stubs and still needs a `pull()` domain method tacked on. Reject — it shares BSP's problem of forcing an unrelated surface into the CRUD template.

## 5. Variant B — minimal separate client (sapcli parity)

**Shape.** New file `src/clients/AdtAbapGitClient.ts`. Factory: `AdtClient.getAbapGit()` returns `IAdtAbapGitClient`. Exactly sapcli's two operations:

```ts
interface IAbapGitLinkArgs {
  package: string;                 // ABAP package to bind
  url: string;                     // remote git repo URL
  branchName?: string;             // defaults to 'refs/heads/master' (sapcli parity)
  remoteUser?: string;
  remotePassword?: string;
  transportRequest?: string;
}

interface IAbapGitPullArgs {
  package: string;                 // locate binding by package
  branchName?: string;             // if absent, reuse the binding's current branch
  remoteUser?: string;
  remotePassword?: string;
  transportRequest?: string;
  pollIntervalMs?: number;         // default 1000 (sapcli parity)
  onProgress?: (status: IAbapGitRepoStatus) => void;   // optional heartbeat callback
}

type AbapGitStatus = 'R' | 'E' | 'A' | string;   // 'R'=running, 'E'=error, 'A'=abort, other=OK

interface IAbapGitRepoStatus {
  package: string;
  url: string;
  branchName: string;
  status: AbapGitStatus;
  statusText: string;
}

interface IAbapGitPullResult {
  finalStatus: IAbapGitRepoStatus;
  errorLog?: IAbapGitErrorLogEntry[];   // populated only on 'E' or 'A' (sapcli parity)
}

interface IAbapGitErrorLogEntry {
  msgType: string;   // 'E'|'W'|'I'|'S' — 'S' entries are filtered out
  objectType: string;
  objectName: string;
  messageText: string;
}

interface IAdtAbapGitClient {
  link(args: IAbapGitLinkArgs): Promise<void>;
  pull(args: IAbapGitPullArgs): Promise<IAbapGitPullResult>;
}
```

Internally the `pull` method encapsulates: locate → POST pull → poll every `pollIntervalMs` → fetch error log on terminal non-OK → return.

**Pros.**

- **Exact sapcli parity.** Everything proven in sapcli is covered, nothing more. YAGNI-clean.
- Smallest code surface; fastest to ship; smallest review footprint.
- Polling abstraction lives inside `pull` as an internal detail — consumers don't have to think about it unless they want `onProgress` heartbeats.

**Cons.**

- **No unlink.** If a consumer needs to remove a repo binding, they have to drop to raw HTTP or wait for v2.
- **No status-only check.** Every status probe triggers a full pull attempt — expensive and side-effectful.
- **No external repo info probe** — `externalrepoinfo` endpoint unused.
- **No way to enumerate linked repos** on a system — `listRepos` is a natural API that sapcli exposes only internally.

**Verdict.** Right if "port exactly what sapcli ships" is the priority and follow-up extensions are acceptable.

## 6. Variant C — extended separate client (recommended)

**Shape.** Same file and factory as B, but the surface is broader:

```ts
interface IAdtAbapGitClient {
  // Core (sapcli parity)
  link(args: IAbapGitLinkArgs): Promise<void>;
  pull(args: IAbapGitPullArgs): Promise<IAbapGitPullResult>;

  // Introspection (no sapcli wrapper, but all evidence-backed)
  listRepos(): Promise<IAbapGitRepoStatus[]>;                          // GET /repos
  getRepo(packageName: string): Promise<IAbapGitRepoStatus | undefined>;
  getErrorLog(packageName: string): Promise<IAbapGitErrorLogEntry[]>;  // uses the repo's log_link

  // Lifecycle (beyond sapcli)
  unlink(args: { package: string; transportRequest?: string }): Promise<void>;

  // External-repo probe (discovery-verified but unused in sapcli)
  checkExternalRepo(args: {
    url: string;
    remoteUser?: string;
    remotePassword?: string;
  }): Promise<IAbapGitExternalRepoInfo>;
}

interface IAbapGitExternalRepoInfo {
  branches: Array<{ name: string; sha1: string; isHead: boolean; type?: string }>;
  access?: 'read' | 'write' | string;
  // Concrete shape derived during implementation from a live probe of the endpoint.
}
```

`unlink` likely maps to `DELETE /sap/bc/adt/abapgit/repos/{id}` (the ID is the resource identifier returned on link) — the exact URI template has to be confirmed during implementation via a live call or a deeper parse of the existing `repos` entity's atom links (`delete_link` or `edit_link`). If the endpoint is missing on the target system, the method throws `NotSupportedError`.

`checkExternalRepo` hits `POST /sap/bc/adt/abapgit/externalrepoinfo` with Content-Type `application/abapgit.adt.repo.info.ext.request.v2+xml` (discovery advertises v1 and v2). Used to probe a remote URL for branch list and credentials validity before committing a link.

**Pros.**

- Covers every useful operation that discovery evidences or sapcli needs.
- `checkExternalRepo` is genuinely valuable: lets a caller validate a URL + credentials before the irreversible `link` step.
- `listRepos` and `getRepo(name)` expose read-only status checking without triggering side-effects (fixing one of Variant B's real gaps).
- `unlink` closes the lifecycle so consumers don't need to drop to raw HTTP for cleanup.

**Cons.**

- **Three endpoints beyond sapcli** require live verification of request/response shape. Specifically: `unlink` URI template, `externalrepoinfo` response schema, and whether `listRepos` / `getRepo` should use Accept v2 (sapcli) or v4 (discovery's newest).
- More surface = more tests, more docs, more maintenance.
- Medium risk: if `unlink` turns out to be server-gated by transport-authorization in a way that doesn't fit a simple DELETE, the API has to grow or the method has to return an error.

**Verdict.** Recommended. Fits the roadmap's Variant C default, closes sapcli's gaps in a principled way, and introduces only evidence-backed new methods.

## 7. Non-decisions (fixed constraints shared across all variants)

Regardless of A/B/C:

- **Transport layer.** Only `IAbapConnection`. No direct axios.
- **XML parsing.** `fast-xml-parser` as elsewhere. abapGit namespaces: `abapgitrepo` and `abapObjects`.
- **Namespace handling.** The repo envelope uses atom links (`<atom:link rel="pull_link" href="…"/>`); the client must extract these links dynamically rather than hard-coding the pull URL. This matches sapcli's `_get_link` helper.
- **Content-Type version.** Default to `v3` (sapcli-compatible) with a config override for `v4` if a consumer needs the newer schema. Runtime transparent fallback NOT planned for v1; fallback is opt-in.
- **Async polling.** Default interval 1000ms (sapcli parity), configurable via `pollIntervalMs`. Maximum poll duration bounded by `AbortSignal` or a default cap (e.g. 10 minutes) — TBD in implementation plan but documented as bounded.
- **Environment gating.** `available_in: ["cloud"]` initially. Widen to on-prem after a live verification on a system with ABAP Platform 2022+ that activates the ADT abapGit app.
- **Transport binding.** `transportRequest` optional on `link` and `pull` (sapcli treats it as optional); required only if the target system enforces transport binding on package changes.
- **Credentials.** `remoteUser` / `remotePassword` are forwarded verbatim in the XML body. Never logged. The server handles credential storage; client does not cache them.
- **Public typing rule.** Factory returns `IAdtAbapGitClient`, not a narrower base type. Specialized interface per roadmap §4.2.
- **Client placement.** `src/clients/AdtAbapGitClient.ts`. Low-level helpers under `src/clients/abapGit/*`.
- **Documentation.** README, CLIENT_API_REFERENCE, ARCHITECTURE, LEGACY, CHANGELOG, ADT_OBJECT_ENTITIES updates follow the #21 / #28 pattern.

## 8. Comparison summary

| Aspect | A (core module) | B (minimal client) | C (extended client) |
|---|---|---|---|
| Architectural fit | Forced; ~50% of IAdtObject methods are stubs | Clean separate client | Clean separate client |
| Scope | link + pull + CRUD stubs | link + pull (sapcli parity) | + unlink + listRepos + getRepo + getErrorLog + checkExternalRepo |
| sapcli parity | Partial | Exact | Exact + extras |
| Async polling | Awkward in IAdtObject | Encapsulated in `pull` | Encapsulated in `pull` |
| Cloud support | Yes | Yes | Yes |
| On-prem support | Unverified (ADT abapGit is Steampunk-era) | Unverified | Unverified |
| Legacy (E77) support | No endpoint | No endpoint | No endpoint |
| Code surface | Medium | Small | Medium |
| Risk | Architectural misfit | Low — fully sapcli-documented | Medium — 3 endpoints need live verification |
| Matches roadmap default | No | Acceptable narrow-fallback | **Yes** |

## 9. What is NOT decided here

- Exact `unlink` URI template — probably `DELETE` on the repo entity's `edit_link` or `delete_link`; must confirm during implementation.
- Exact `externalrepoinfo` response schema — only the Accept type is known from discovery; content-shape derived during a live probe.
- Whether to default Content-Type to `v3` (sapcli) or `v4` (newest in discovery). Recommendation: `v3` for compatibility; expose `options.contentTypeVersion` for opt-in newer.
- Whether `pull`'s `AbortSignal` / max-duration cap lives in args or in client options.
- Final method names (bikeshed in implementation plan): `link` vs `linkRepo`, `pull` vs `pullRepo`, `listRepos` vs `getRepos`, `checkExternalRepo` vs `probeRemote`.

## 10. Decision criteria

Pick **A** if:
- You want uniformity with `src/core/` and accept stub methods for half the interface.
- (Recommendation: don't pick A. abapGit doesn't match the pattern.)

Pick **B** if:
- "Ship narrow sapcli parity fast" is the priority.
- You accept that `unlink`, `listRepos`, `getErrorLog` outside of pull, and `externalrepoinfo` will need a v2 PR later.

Pick **C** if:
- You want one authoritative abapGit client covering everything discovery evidences.
- Pre-link validation (`checkExternalRepo`) and side-effect-free status queries matter for your workflow.
- You're budgeted for live verification of three endpoints during implementation.

## 11. Next step

User picks A, B, or C. After selection:

1. Update this document to carry only the chosen variant.
2. Proceed to `writing-plans` skill for the implementation plan.
