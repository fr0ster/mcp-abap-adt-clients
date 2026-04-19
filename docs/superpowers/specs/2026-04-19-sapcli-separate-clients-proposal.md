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
  - Shares surface semantics with gCTS but uses the abapGit app-specific OData/REST instead of the cts_abapvcs handler.
  - On-prem-only in most systems; cloud variant should be probed during spec stage.

### 3.3 `AdtFeatureToggleClient`

- **Purpose:** Read and toggle state of ABAP feature toggles (`cl_abap_feature*` family), tied to CTS via corrnr.
- **sapcli references:** `sap/cli/featuretoggle.py`, `sap/adt/featuretoggle.py`.
- **Endpoint family:** `/sap/bc/adt/feature-toggles/*`.
- **Complexity:** Small. State machine (off / on / deleted) with corrnr binding.
- **Special considerations:** Use this class as the **pattern baseline** for "separate client in the current architecture" — small enough to exercise conventions (constructor shape, public API style, test harness wiring) before committing to larger classes.

### 3.4 `AdtFlpBuilderClient`

- **Purpose:** Fiori Launchpad page builder — catalogs, groups, tiles driven by YAML/JSON config.
- **sapcli references:** `sap/cli/flp.py`, `sap/flp/builder.py`.
- **Endpoint family:** OData v2 service `/sap/opu/odata/UI2/PAGE_BUILDER_CUST` (+ related).
- **Complexity:** Small–Medium. Most of the work is mapping YAML → CRUD sequence on known OData entities.
- **Special considerations:**
  - OData v2 — first OData v2 consumer in this library. Must decide whether to lean on an existing OData client (if any is already a dev-dep elsewhere) or implement a minimal inline client. Proposal recommends the latter to keep the dependency footprint unchanged.

### 3.5 `AdtBspAppClient`

- **Purpose:** Upload and manage BSP / UI5 applications in the ABAP repository.
- **sapcli references:** `sap/cli/bsp.py`.
- **Endpoint family:** UI5 `ABAP_REPOSITORY_SRV` OData v2 service (binary archive as base64 payload).
- **Complexity:** Small. Straightforward binary-upload + corrnr binding.
- **Special considerations:** Uses the same OData v2 transport as `AdtFlpBuilderClient` — share the minimal v2 helper between them if we implement one.

## 4. Architectural constraints (shared across all candidates)

All candidate classes must:

- Accept `IAbapConnection` + `ILogger` (and optionally `IAdtSystemContext` / `IAdtClientOptions`) via constructor, matching `AdtClient` / `AdtRuntimeClient` conventions.
- Depend only on the `IAbapConnection` interface. No RFC, no direct transport.
- Expose zero-argument factory methods — identity / repo-name / toggle-id lives in config objects, not factory parameters.
- Live under `src/clients/` (or `src/runtime/` if runtime-adjacent) alongside existing top-level clients, NOT under `src/core/`.
- Integrate with the existing Accept/content-type correction wrapper when applicable.
- Ship with integration tests under `src/__tests__/integration/clients/{clientName}/` (new fixture path; no existing folder) using the established `TestConfigResolver` / `BaseTester` helpers where they fit.
- Add `on-prem` vs `cloud` `available_in` gating from day one (some surfaces are on-prem-only — gCTS cloud story differs from on-prem).

## 5. Recommended PR ordering

One PR per class. Rationale: each endpoint family has its own semantics, auth quirks, and test needs. Bundling would produce a review nightmare.

| Order | Class | Why this slot |
|---|---|---|
| 1 | `AdtFeatureToggleClient` | **Pattern baseline.** Small, fast to ship, validates the "separate client in current architecture" contract end-to-end (factory placement, public API style, test harness) before tackling larger scopes. |
| 2 | `AdtBspAppClient` | Introduces the minimal OData v2 helper that `AdtFlpBuilderClient` can then reuse. Small surface, isolated. |
| 3 | `AdtFlpBuilderClient` | Reuses the OData v2 helper from #2. |
| 4 | `AdtAbapGitClient` | Medium scope. Prepares the ground for gCTS (shared repo-lifecycle vocabulary). |
| 5 | `AdtGctsClient` | Largest scope, most unknowns. Benefits from lessons learned in #1–#4 (async polling, OData helpers, error parsing). |

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
- **Cloud availability matrix.** Several of these surfaces are on-prem-only (gCTS cloud story is partial; abapGit largely on-prem). Each spec must verify cloud availability from `docs/discovery/` and set `available_in` accordingly before implementation.
- **Test environment.** Some operations (git push / pull, BSP upload) require test fixtures (remote git repos, BSP archives) that do not exist in the current test infrastructure. Each spec must enumerate what fixtures it needs and how they are provisioned.

## 8. What this proposal is not

- Not a design spec for any individual class — those come one per class in their own documents.
- Not a commitment to implement all five. The ordering is a recommendation; at any point after a completed PR the user may stop, reorder, or drop remaining items.
- Not a schedule. No dates, no velocity estimates. Each class ships when its spec/plan/PR cycle completes.

## 9. Next step

After this proposal is accepted, start the spec cycle for **#1: `AdtFeatureToggleClient`** (or a different ordering if the user reprioritises).
