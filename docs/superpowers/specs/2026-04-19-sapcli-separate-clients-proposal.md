# Proposal: Separate ADT clients ported from sapcli

Date: 2026-04-19
Status: Proposal for per-class scoping and PR ordering

## 1. Goal

Extend `@mcp-abap-adt/adt-clients` with a set of **separate client classes** that wrap capabilities present in `~/prj/sapcli` but absent from the current library. Each capability is a self-contained ADT / OData surface that does not fit the `IAdtObject<Config, State>` per-type CRUD pattern and therefore must live next to `AdtClient` / `AdtRuntimeClient` / `AdtExecutor`, not inside `src/core/`.

This proposal **does not design any individual class**. It lists the candidates, fixes their rough shape, and locks the ordering so each class can be picked up in its own spec → plan → PR cycle later.

## 2. Scope boundaries

- Only features that fit the existing architectural conventions (interface-only connection via `IAbapConnection`, HTTP/ADT over the standard transport, no direct RFC).
- Only features genuinely distinct from the per-type CRUD handlers under `src/core/`.
- Out of scope: RFC-based features (STRUST, raw BAPI, RFC user admin) — RFC lives in `@mcp-abap-adt/connection`.
- Out of scope: anything already covered by `AdtClient` core modules or `AdtRuntimeClient` extensions.

## 3. Candidate classes

All names are working titles; final names may be refined during the per-class brainstorming.

### 3.1 `AdtGctsClient`

- **Purpose:** gCTS (git-enabled CTS) — repository lifecycle on the SAP server-side (clone, pull, push, branch management, commit history).
- **sapcli references:** `sap/cli/gcts.py`, `sap/rest/gcts/*`.
- **Endpoint family:** `/sap/bc/cts_abapvcs/repository/{rid}/*`, `/sap/bc/cts_abapvcs/gcts/*`.
- **Complexity:** Large. Requires async activity-tracking, long-running request handling, structured error parsing for git-specific failures.
- **Special considerations:**
  - gCTS responses are JSON, not XML — first non-XML dominant surface in this library.
  - Operations can be long-running (clone of large repos) → need cancellation / timeout policy.
  - Authentication for remote git — secrets stored server-side; client must pass credential-pointer, not secrets.

### 3.2 `AdtAbapGitClient`

- **Purpose:** abapGit repositories linked into the SAP system — link, unlink, pull, status, push (where supported), error log retrieval.
- **sapcli references:** `sap/cli/abapgit.py`, `sap/adt/abapgit.py`.
- **Endpoint family:** `/sap/bc/adt/abapgit/repos`, per-repo sub-resources.
- **Complexity:** Medium. Simpler than gCTS but still involves status polling and per-repo operation queueing.
- **Special considerations:**
  - Shares surface semantics with gCTS but uses the abapGit app-specific handler instead of the cts_abapvcs handler.
  - **Cloud presence verified** in `docs/discovery/discovery_cloud_mdd_raw.xml` and `discovery_trial_raw.xml` (`/sap/bc/adt/abapgit/repos`, `/sap/bc/adt/abapgit/externalrepoinfo`). The open question is feature parity (push, branch management), not baseline endpoint presence.

### 3.3 ~~`AdtFeatureToggleClient`~~ — graduated to `src/core/featureToggle/`

**Removed from separate-clients scope.** The per-class design for feature toggle (`docs/superpowers/specs/2026-04-19-feature-toggle-client-design.md`) selected Variant A: feature toggle is a legitimate ADT artifact (`adtcore:type="FTG2/FT"` with packageRef, lock/unlock, activation), and users need both to **create** custom feature toggles and to **switch** their state. The natural home is `src/core/featureToggle/` alongside the other 24 core modules, with domain methods (`switchOn` / `switchOff` / `getRuntimeState` / `checkState` / `readSource`) layered on top of the canonical `IAdtObject` surface. It ships through the ordinary core-module PR workflow, not through this roadmap.

### 3.4–3.5 UI-tier group (BSP + FLP) — PENDING INVESTIGATION

**Not shipped to production until a concrete consumer workflow justifies them.** Both surfaces concern UI-tier artifacts (Fiori app upload via BSP; Fiori Launchpad page-builder customisation via FLP) and neither has a proven demand from the library's current user base. They form one group because they share the same constraint: we don't yet know **what we actually need from them**. Each may be reactivated, reshaped, or dropped outright once a real use-case surfaces.

Kept as paper designs for when investigation resumes:

#### 3.4 `AdtFlpBuilderClient`

- **Purpose:** Fiori Launchpad page builder — catalogs, groups, tiles driven by YAML/JSON config.
- **sapcli references:** `sap/cli/flp.py`, `sap/flp/builder.py`.
- **Endpoint family:** OData v2 service `/sap/opu/odata/UI2/PAGE_BUILDER_CUST` (+ related).

#### 3.5 `AdtBspAppClient`

- **Purpose:** Upload and manage BSP / UI5 applications in the ABAP repository.
- **sapcli references:** `sap/cli/bsp.py`.
- **Endpoint family:** Two candidate surfaces (see per-class design `docs/superpowers/specs/2026-04-19-bsp-app-client-design.md`):
  - **ADT filestore** at `/sap/bc/adt/filestore/ui5-bsp/*` — discovery-verified on all targets including E77 legacy.
  - **External OData v2** via `UI5/ABAP_REPOSITORY_SRV` — the sapcli-documented path.
- **Limitation noted during review:** BSP covers only the final "upload zip → BSP namespace" step; the archive must be pre-built by external tooling (ui5 CLI, webpack, vite). A meaningful BSP client needs an accompanying build-integration story that is out of scope for this library.

## 4. Architectural constraints (shared across all candidates)

All candidate classes must:

- **Be standalone top-level classes**, following the existing pattern used by `AdtClient`, `AdtRuntimeClient`, `AdtExecutor`, and `AdtClientsWS`. Users instantiate them directly: `new AdtAbapGitClient(connection, logger, options)`. There is **no** factory method on `AdtClient` — `AdtClient` only produces `IAdtObject<Config, State>` implementations. For every non-`IAdtObject` interface, a separate top-level client class serves as its own factory surface.
- Accept `IAbapConnection` + `ILogger` via constructor. The **options contract** (`IAdtClientOptions`-style vs a reduced runtime-style object vs a new shared contract) is NOT yet standard across the repo — `AdtClient` and `AdtRuntimeClient` currently differ. Each per-class spec **must explicitly choose** one of these shapes and justify the pick; a cross-cutting decision can happen later if a pattern emerges.
- Depend only on the `IAbapConnection` interface. No RFC, no direct transport.
- Expose zero-argument (or config-object-only) public methods — per-operation identity (repo name, toggle id) lives in the argument objects, not in the constructor or as additional factories.
- Live under `src/clients/` (or `src/runtime/` if runtime-adjacent) alongside existing top-level clients, NOT under `src/core/`.
- Integrate with the existing Accept/content-type correction wrapper when applicable.
- Ship with integration tests under `src/__tests__/integration/clients/{clientName}/` (new fixture path; no existing folder) using the established `TestConfigResolver` / `BaseTester` helpers where they fit.
- Use the **3-level environment vocabulary** in `available_in`: `cloud`, `onprem`, `legacy` — matching the existing `test-config.yaml.template` convention (e.g. `["onprem", "legacy"]`, `["legacy"]`). Each per-class spec must explicitly state legacy behaviour (supported, read-only, or unsupported) rather than collapsing it into a single non-cloud bucket.

### 4.1 Variant-selection rule (`A` / `B` / `C`)

Per-class design docs use the same three-variant pattern, but the default choice differs by surface shape:

- **Variant A** fits only when the ADT surface is fundamentally a **repository object** with a real object identity and lifecycle: collection endpoint, object URI, metadata payload, package binding, lock/unlock, activation, source/main or equivalent.
- **Variant B** is a narrow fallback for a deliberately reduced wrapper. It is acceptable only when v1 intentionally exposes a subset of the surface and explicitly does **not** aim to be the main long-term API.
- **Variant C** is the default for **separate clients** in this roadmap: service-like, orchestration-heavy, repository-management, OData multi-entity, or long-running operational surfaces that do not naturally map to `IAdtObject<Config, State>`.

Applied to the current roadmap:

- `AdtAbapGitClient`: default starting assumption is **Variant C**
- `AdtGctsClient`: default starting assumption is **Variant C**
- `AdtBspAppClient`: default starting assumption is **Variant C** — **deferred** (see §3.5)
- `AdtFlpBuilderClient`: default starting assumption is **Variant C** — **deferred** (see §3.4)
- `FeatureToggle`: selected **Variant A** in its own design doc because the evidence points to a real ADT artifact (`FTG2/FT`) rather than a service-only surface

`~/prj/sapcli` is useful for endpoint traces, headers, payloads, and operation sequences, but **not** as the primary architectural argument for `A` vs `B` vs `C`, because sapcli models many unrelated surfaces as separate manager classes.

### 4.2 Public typing rule

- Every new public class with API beyond a shared base contract must have its own **specialized public interface**.
- Separate clients therefore expose dedicated interfaces such as `IAdtBspAppClient`, `IAdtFlpBuilderClient`, `IAdtAbapGitClient`, `IAdtGctsClient` (final names decided per spec).
- Core modules that extend `IAdtObject<Config, State>` with domain methods must expose a specialized interface that extends `IAdtObject<...>` and includes those methods.
- **Separate clients are standalone top-level classes**, not factory methods on `AdtClient`. `AdtClient` only manufactures `IAdtObject` implementations. Each separate client's concrete class implements its own specialized interface; consumers `new` the class directly.
- For core-module domain methods, the (existing) `AdtClient.getXxx()` factory returns the specialized interface (e.g. `IFeatureToggleObject`), not the narrower `IAdtObject<...>` — so the full supported API stays statically visible without casts.

## 5. Recommended PR ordering

One PR per class. Rationale: each endpoint family has its own semantics, auth quirks, and test needs. Bundling would produce a review nightmare.

| Order | Class | Why this slot |
|---|---|---|
| 1 | `AdtAbapGitClient` | **Pattern baseline.** Widest everyday use-case (ABAP source version control); discovery-verified on cloud + on-prem; medium scope. Validates the "separate client in current architecture" contract end-to-end (factory placement, public API style, test harness) with a broadly-useful feature rather than a niche one. |
| 2 | `AdtGctsClient` | Largest scope, most unknowns, but complements #1 — abapGit is VCS, gCTS is transport-system-with-git. Different workloads, different audiences. Benefits from lessons learned in #1 (async polling, repo-lifecycle vocabulary, error parsing). |
| (deferred) | `AdtBspAppClient` | Covers only the final "upload zip → BSP namespace" step of a longer UI5/Fiori deploy pipeline (archive must be pre-built by external tooling). See `2026-04-19-bsp-app-client-design.md` (Deferred). Reactivate when build-tool integration becomes in-scope or a user workflow explicitly requires BSP upload. |
| (deferred) | `AdtFlpBuilderClient` | Fiori Launchpad page-builder customisation is even narrower than BSP. Deferred alongside BSP — reactivate only if a concrete consumer workflow demands it. |

(Feature toggle is no longer in this list — see section 3.3; it ships as a core module.)

Each PR is self-contained and independently releasable as a **minor** version bump per semver (new public API, no breaking changes).

## 6. Per-class workflow

For each class in the ordered list:

1. **Spec** — new `docs/superpowers/specs/YYYY-MM-DD-<class-name>-design.md` with:
   - Verified endpoint list (cross-check sapcli + `docs/discovery/*.xml`)
   - Public API shape (config types, state types, constructor signature)
   - Operation chains (any lifecycle / polling logic)
   - Test strategy and environment gating
2. **Implementation plan** — `docs/superpowers/plans/YYYY-MM-DD-<class-name>.md` via `writing-plans` skill.
3. **Execution** — subagent-driven-development (same pattern used for #19).
4. **PR** — bundled with docs updates (README, CLIENT_API_REFERENCE, ARCHITECTURE, LEGACY, ADT_OBJECT_ENTITIES or equivalent).
5. **Post-merge** — version bump (minor), CHANGELOG, tag, release. User publishes to npm.

Each spec may independently drop a candidate from scope if verification against discovery/sapcli reveals the endpoint family is unsuitable for the current architecture (e.g. requires RFC, requires a transport the connection layer does not expose, or demands state beyond what `IAbapConnection` supports).

## 7. Risks and open questions

- **JSON vs XML responses.** gCTS is JSON-first. The library has a heavily XML-centric parsing pipeline. Need to decide: per-client JSON handling (simpler) vs shared JSON utility (DRY). Recommendation: per-client for now; extract shared helper only after the second JSON-consuming client appears.
- **OData v2 surface.** We will consume two OData v2 services (BSP, FLP). Decision on minimal inline helper vs shared utility should be taken in the #2 spec, not here.
- **Cloud availability matrix.** The cloud story differs per surface: `abapgit/repos` and `abapgit/externalrepoinfo` are present on cloud MDD and trial; `sfw/featuretoggles*` is present on cloud MDD; `filestore/ui5-bsp/*` is present across all targets. gCTS cloud coverage is partial. Each per-class spec must still verify its specific surface against `docs/discovery/*.xml` and set `available_in` using the 3-level vocabulary (`cloud` / `onprem` / `legacy`) accordingly.
- **Test environment.** Some operations (git push / pull, BSP upload) require test fixtures (remote git repos, BSP archives) that do not exist in the current test infrastructure. Each spec must enumerate what fixtures it needs and how they are provisioned.

## 8. What this proposal is not

- Not a design spec for any individual class — those come one per class in their own documents.
- Not a commitment to implement all four remaining candidates. The ordering is a recommendation; at any point after a completed PR the user may stop, reorder, or drop remaining items. (Feature toggle graduated to the `src/core/` workflow after its own per-class design chose Variant A.)
- Not a schedule. No dates, no velocity estimates. Each class ships when its spec/plan/PR cycle completes.

## 9. Verification sources

This proposal was adjusted after cross-checking against:

- `~/prj/sapcli` — reference implementation, especially `sap/cli/{gcts,abapgit,featuretoggle,flp,bsp}.py` and corresponding `sap/adt/*.py` modules.
- `docs/discovery/discovery_{cloud_mdd,e19,e77,trial}_raw.xml` + `docs/discovery/endpoints_{cloud_mdd,onprem_modern_e19,onprem_old_e77}.txt` — live discovery snapshots.
- `src/__tests__/helpers/test-config.yaml.template` — for the 3-level `cloud` / `onprem` / `legacy` environment vocabulary.

Endpoint paths, content types, and availability claims in sections 3 and 4 are derived from a combination of sapcli references and local discovery snapshots; not every claim is discovery-backed to the same degree. Per-class specs must re-verify their own surface against the same sources, because this proposal compresses evidence — it does not replace it.

## 10. Next step

Feature toggle graduated to `src/core/featureToggle/` and moves ahead via the core-module workflow. BSP and FLP have been deferred (see §3.4, §3.5). Next in the separate-clients roadmap: **#1: `AdtAbapGitClient`** — broadest everyday use-case and discovery-verified on cloud + on-prem.
