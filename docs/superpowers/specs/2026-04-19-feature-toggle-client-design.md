# Design: Feature Toggle as a core module (`src/core/featureToggle/`)

Date: 2026-04-19
Status: Variant A selected — ready for implementation planning
Parent: `docs/superpowers/specs/2026-04-19-sapcli-separate-clients-proposal.md` (roadmap item #1)

> **Per-class variant-selection pattern.** Each class in the sapcli-separate-clients roadmap gets its own three-variant design document. The variant choice is resolved independently per class. Feature toggle — Variant A: users need both to **create/manage feature toggle artifacts** and to **switch their state**. The other two variants (minimal and extended separate client) were rejected because they only covered state management.

## 1. Goal

Add full feature-toggle support to `@mcp-abap-adt/adt-clients` as a core module under `src/core/featureToggle/`, following the same `IAdtObject<Config, State>` architecture that backs the existing 24 core modules. The public API must be exposed through a **specialized interface** (`IFeatureToggleObject extends IAdtObject<...>`) so the feature-toggle-specific methods stay statically visible on the factory return type instead of being hidden behind casts.

## 2. Scope

**In scope:**
- Full CRUD + lifecycle per `IFeatureToggleObject extends IAdtObject<IFeatureToggleConfig, IFeatureToggleState>`: `validate`, `create`, `read`, `readMetadata`, `update`, `delete`, `lock`, `unlock`, `check`, `activate`, `readTransport`.
- Hybrid payload handling: XML metadata (`blue:blueSource`) + JSON source (rollout / toggledPackages / attributes) + JSON state/check/toggle responses.
- Feature-toggle domain methods layered on top of the generic interface: `switchOn`, `switchOff`, `getRuntimeState`, plus `check` for pre-flight and `readSource` for the JSON rollout body.
- New `adtClient.getFeatureToggle()` factory method on `AdtClient`.

**Explicitly out of scope for v1 (may be added later):**
- Analytics surface: `/logs`, `/dependencies/validate` (cloud) vs `/validation` (E19), `/objects` (cloud) vs `/objects/types` (E19). Per-environment divergence is large enough that v1 punts; v2 can add a focused `readDependencies` / `readLogs` after live traces confirm per-environment behaviour.
- `$configuration` and `$schema` — UI-driven form templates. Consumers that need dynamic form rendering can reach `connection.makeAdtRequest` directly; the toggle client does not wrap them.
- `attributes/attributeKeys` / `attributes/attributeValues` — value-help endpoints for the authoring UI. Same rationale as above.

## 3. Verified evidence

### 3.1 sapcli reference (`sap/adt/featuretoggle.py`, `sap/cli/featuretoggle.py`)

Implemented surface:

- `GET /sap/bc/adt/sfw/featuretoggles/{name}/states` → runtime state (client + user level) as JSON
  - Accept `application/vnd.sap.adt.states.v1+asjson`
  - Body: `{ STATES: { NAME, CLIENT_STATE, CLIENT_CHANGED_BY, CLIENT_CHANGED_ON, USER_STATE, CLIENT_STATES[], USER_STATES[] } }`
- `POST /sap/bc/adt/sfw/featuretoggles/{name}/toggle` → flip ON/OFF
  - Content-Type `application/vnd.sap.adt.related.toggle.parameters.v1+asjson`
  - Body `{ TOGGLE_PARAMETERS: { IS_USER_SPECIFIC: bool, STATE: "on" | "off", TRANSPORT_REQUEST?: string } }`

Documented but not wired from sapcli CLI:

- `POST /sap/bc/adt/sfw/featuretoggles/{name}/check`
  - Accept `application/vnd.sap.adt.toggle.check.result.v1+asjson`
  - Content-Type `application/vnd.sap.adt.toggle.check.parameters.v1+asjson`
  - Result: `{ RESULT: { CURRENT_STATE, TRANSPORT_PACKAGE, TRANSPORT_URI, CUSTOMIZING_TRANSPORT_ALLOWED } }`

Referenced metadata surface (from GET of the object itself):

- XML root `<blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue">` with adtcore attributes (`name`, `type="FTG2/FT"`, `description`, `responsible`, `masterLanguage`, `masterSystem`, `version`, `changedAt/changedBy`, `createdAt/createdBy`, `language`, `descriptionTextLimit`)
- `<adtcore:packageRef …/>` child
- Atom links to `source/main` (JSON rollout body), `source/main/versions`, GUI link, `schema`, `configuration`
- Source payload at `…/source/main` is JSON: `{ header, rollout, toggledPackages[], relatedToggles[], attributes[] }`

State enum: `"on" | "off" | "undefined"`.

### 3.2 Discovery corpus (`docs/discovery/discovery_cloud_mdd_raw.xml`, `endpoints_cloud_mdd.txt`, `endpoints_onprem_modern_e19.txt`)

All under `/sap/bc/adt/sfw/`:

- `featuretoggles` (collection)
- `featuretoggles/$configuration`, `featuretoggles/$schema`
- `featuretoggles/attributes/attributeKeys`, `featuretoggles/attributes/attributeValues`
- `featuretoggles/{object_name}` with `?corrNr,lockHandle,version,accessMode,_action` — full CRUD + lock/unlock contract
- `featuretoggles/{object_name}/check`
- `featuretoggles/{object_name}/dependencies/validate` (cloud MDD) / `featuretoggles/validation` (E19 modern on-prem)
- `featuretoggles/{object_name}/logs` (cloud MDD)
- `featuretoggles/{object_name}/objects` (cloud MDD) / `featuretoggles/objects/types` (E19)

Verified in the captured snapshots for **cloud MDD** and **modern on-prem E19**. Not seen on E77 (legacy) in current discovery. Per-class implementation should still probe a live modern on-prem target before promising write support, but `available_in` does not need to start cloud-only on discovery grounds.

Availability planning: `available_in: ["cloud", "onprem"]` provisionally; keep `legacy` unsupported unless later evidence proves otherwise. The implementation plan should decide whether write operations stay enabled on both environments immediately or whether tests roll out cloud-first while on-prem write support is validated.

## 4. Public API shape

### 4.1 Factory on `AdtClient`

```ts
getFeatureToggle(): IFeatureToggleObject;
```

The returned handler is a standalone instance of `AdtFeatureToggle`, but the factory returns the specialized public interface `IFeatureToggleObject`, not the narrower `IAdtObject`. This preserves static type visibility for `switchOn`, `switchOff`, `getRuntimeState`, `checkState`, and `readSource` and avoids a cast-based API.

### 4.2 Config type

```ts
export interface IFeatureToggleConfig {
  featureToggleName: string;            // required — uppercase name of the FT artifact
  packageName?: string;                  // required for create
  description?: string;                  // required for create/update
  transportRequest?: string;
  masterSystem?: string;
  responsible?: string;

  // Source body — optional at create (empty FT), required for meaningful update
  // Shape mirrors the JSON payload at .../source/main
  source?: IFeatureToggleSource;

  onLock?: (lockHandle: string) => void;
}

export interface IFeatureToggleSource {
  header?: IFeatureToggleHeader;
  rollout?: IFeatureToggleRollout;
  toggledPackages?: string[];
  relatedToggles?: string[];
  attributes?: IFeatureToggleAttribute[];
}

export interface IFeatureToggleHeader {
  description?: string;
  originalLanguage?: string;       // 'en', 'de', ...
  abapLanguageVersion?: string;    // 'standard', 'cloudDevelopment', ...
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

export interface IFeatureTogglePlanning {
  referenceProduct?: string;                                    // 'S4HANA OD', ...
  releaseToCustomer?: { version: string; sp: string };
  generalAvailability?: { version: string; sp: string };
  generalRollout?: { version: string; sp: string };
}

export interface IFeatureToggleAttribute {
  key: string;                 // 'LC2_LIFECYCLE_STATUS', 'LC2_ROLLOUT_STRATEGY', ...
  value: string;
}
```

### 4.3 State type

```ts
export interface IFeatureToggleState extends IAdtObjectState {
  // Inherits readResult, validationResponse, createResult, updateResult, errors, etc.
  // Plus feature-toggle-specific optional fields populated by domain methods:
  runtimeState?: IFeatureToggleRuntimeState;      // populated by getRuntimeState()
  checkResult?: IFeatureToggleCheckResult;         // populated by check() extended form
  sourceResult?: IFeatureToggleSource;             // populated by readSource()
}

export type FeatureToggleState = 'on' | 'off' | 'undefined';

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

export interface IFeatureToggleCheckResult {
  currentState: FeatureToggleState;
  transportPackage?: string;
  transportUri?: string;
  customizingTransportAllowed: boolean;
}
```

### 4.4 Specialized object interface

```ts
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
```

### 4.5 Domain methods (layered on top of `IAdtObject`)

```ts
class AdtFeatureToggle implements IFeatureToggleObject {
  // ...standard IAdtObject methods...

  /**
   * Switch the toggle ON, binding the change to a transport request.
   * Client-level by default; pass userSpecific: true for user-scoped.
   */
  switchOn(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IFeatureToggleState>;

  /**
   * Switch the toggle OFF. Same shape as switchOn.
   * Note: the toggle's rollout.reversible flag must permit OFF after activation.
   */
  switchOff(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IFeatureToggleState>;

  /**
   * Fetch the current runtime state (client-level aggregate + per-client + per-user).
   */
  getRuntimeState(
    config: Partial<IFeatureToggleConfig>,
  ): Promise<IFeatureToggleState>;

  /**
   * Pre-flight check before a toggle. Returns current state plus transport binding
   * info (package, URI, whether a customizing transport is allowed).
   */
  checkState(
    config: Partial<IFeatureToggleConfig>,
    opts?: { userSpecific?: boolean },
  ): Promise<IFeatureToggleState>;

  /**
   * Read the JSON source body at .../source/main (rollout + toggledPackages + attributes).
   * Parallel to AdtFunctionInclude.readSource, but returns structured JSON, not text.
   */
  readSource(
    config: Partial<IFeatureToggleConfig>,
    version?: 'active' | 'inactive',
  ): Promise<IFeatureToggleState>;
}
```

`check` (canonical `IAdtObject.check`) stays available — it hits `/checkruns?reporters=abapCheckRun` for syntactic validation, same as every other core module. `checkState` is the feature-toggle-specific `/check` endpoint that returns transport-binding info. The names are deliberately different to avoid confusion between the two checks.

### 4.5 Low-level parameter types (snake_case, internal)

Same pattern as `ICreateAuthorizationFieldParams` / `ICreateFunctionIncludeParams`: snake_case wire-format mirror used only by the low-level files. Not exported from `index.ts`.

```ts
export interface ICreateFeatureToggleParams {
  feature_toggle_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  source?: IFeatureToggleSource;  // JSON, not snake_case — it goes verbatim into the source PUT
}

export interface IToggleFeatureToggleParams {
  feature_toggle_name: string;
  state: 'on' | 'off';
  is_user_specific: boolean;
  transport_request?: string;
}
```

## 5. Architectural placement and module layout

```
src/core/featureToggle/
  AdtFeatureToggle.ts        # handler class — implements IFeatureToggleObject
  types.ts                   # IFeatureToggleConfig, IFeatureToggleState, IFeatureToggleObject, ICreateFeatureToggleParams, sub-types
  xmlBuilder.ts              # builds the blue:blueSource root element for create/update metadata
  create.ts                  # POST /sfw/featuretoggles — metadata only
  read.ts                    # GET /sfw/featuretoggles/{name} — metadata XML
  readSource.ts              # GET /sfw/featuretoggles/{name}/source/main — JSON
  update.ts                  # PUT /sfw/featuretoggles/{name}?lockHandle= — metadata XML
  updateSource.ts            # PUT /sfw/featuretoggles/{name}/source/main?lockHandle= — JSON
  delete.ts                  # POST /deletion/check + /deletion/delete
  lock.ts                    # POST /sfw/featuretoggles/{name}?_action=LOCK&accessMode=MODIFY
  unlock.ts                  # POST /sfw/featuretoggles/{name}?_action=UNLOCK&lockHandle=
  check.ts                   # POST /checkruns?reporters=abapCheckRun (canonical check)
  activation.ts              # POST /activation
  validation.ts              # pre-create name validation (probe via GET or dedicated endpoint if available)
  getState.ts                # GET /sfw/featuretoggles/{name}/states — domain: runtime state
  checkState.ts              # POST /sfw/featuretoggles/{name}/check — domain: pre-flight with transport info
  switch.ts                  # POST /sfw/featuretoggles/{name}/toggle — domain: switch on/off
  index.ts                   # barrel exports
```

Counts: 16 files, larger than `authorizationField` (12) and `functionInclude` (14) because of the hybrid-payload split (XML metadata file + JSON source file) combined with the domain-specific state operations.

## 6. Operation chains

### 6.1 Canonical (copies from `AdtProgram`/`AdtFunctionInclude` — source-bearing template, but "source" here is JSON, not text/plain)

- **create:** validate → create (metadata XML) → if `source` provided: stateful → lock → stateless → updateSource (JSON PUT) → stateful → unlock → stateless → activate
- **update:** stateful → lock → stateless → check (inactive version with JSON source if provided) → updateMetadata (XML, if description/packageRef changed) → updateSource (if `source` provided) → stateful → unlock → stateless → check → activate → read with long polling → error cleanup
- **delete:** checkDeletion → delete

### 6.2 Domain chains

- **switchOn / switchOff:** `checkState(userSpecific)` → if `CUSTOMIZING_TRANSPORT_ALLOWED && transportRequest` → POST `/toggle` with `TOGGLE_PARAMETERS: { IS_USER_SPECIFIC, STATE, TRANSPORT_REQUEST }`. No lock/activate. Populates `state.runtimeState` via fresh `getRuntimeState()` afterwards.
- **getRuntimeState:** GET `/states` (stateless). Single request, parse JSON, populate `state.runtimeState`.
- **checkState:** POST `/check` (stateless) with `{ PARAMETERS: { IS_USER_SPECIFIC } }`. Populates `state.checkResult`.
- **readSource:** GET `/source/main` (stateless). Parse JSON, populate `state.sourceResult`.

## 7. Non-decisions (fixed constraints shared with the rest of the library)

- **Transport:** `IAbapConnection` only. No RFC, no direct axios.
- **JSON parsing:** Native `JSON.parse`. Hand-rolled types in `types.ts`. No schema validation library — shape is enforced at assignment and via TS types only.
- **XML parsing:** `fast-xml-parser` as for the rest of the library.
- **Content-type constants:** Added to `src/constants/contentTypes.ts` — `ACCEPT_FEATURE_TOGGLE_METADATA`, `CT_FEATURE_TOGGLE_METADATA` (for `blue:blueSource`), `ACCEPT_FEATURE_TOGGLE_STATES`, `ACCEPT_FEATURE_TOGGLE_CHECK_RESULT`, `CT_FEATURE_TOGGLE_CHECK_PARAMETERS`, `CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS`, `CT_FEATURE_TOGGLE_SOURCE` (`application/vnd.sap.adt.toggle.content.v2+json`).
- **Accept negotiation:** Integrate with the existing `wrapConnectionAcceptNegotiation` wrapper.
- **Environment gating:** `available_in: ["cloud", "onprem"]` provisionally based on current discovery. `legacy` unsupported. Final gating decided after the implementation plan runs an on-prem write probe.
- **Transport-request binding:** `switchOn` / `switchOff` **require** `transportRequest` (matches sapcli's required `--corrnr`). Domain methods that don't mutate (`getRuntimeState`, `checkState`, `readSource`) don't need it.
- **Encoding:** `encodeURIComponent` (equivalent of sapcli's `quote_plus`) on the feature-toggle name segment.
- **Documentation:** Follow the `#21` pattern — update README, CLIENT_API_REFERENCE, ARCHITECTURE, LEGACY, ADT_OBJECT_ENTITIES, CLAUDE.md count (24 → 25).
- **Test fixture:** Create a Z-prefixed FT under `ZAC_SHR_PKG`. If cloud trial's JWT-expiry pattern makes create flaky, fall back to `available_in: ["onprem"]` for the create-chain test while keeping `["cloud", "onprem"]` for read-only domain methods.

## 8. Impact on the roadmap proposal

The roadmap (`2026-04-19-sapcli-separate-clients-proposal.md`) listed `AdtFeatureToggleClient` as roadmap item #1. Accepting Variant A means:

- Feature toggle is **no longer a separate client**. Section 3.3 of the roadmap removed.
- The recommended PR ordering becomes 4 separate clients (BSP → FLP → abapGit → gCTS) — feature toggle graduates to the same "core module" bucket as `authorizationField` and is released through the ordinary core-module PR workflow.
- The "pattern baseline" slot the proposal gave to feature toggle now shifts to **BSP** (still small, but its separate-client nature is real — no FTG-like CRUD to promote it to core).

The roadmap proposal document will be amended in the same PR that delivers this spec.

## 9. Verification sources

This design was adjusted after cross-checking against:

- `~/prj/sapcli` — `sap/adt/featuretoggle.py`, `sap/cli/featuretoggle.py`.
- `docs/discovery/discovery_{cloud_mdd,e19,e77,trial}_raw.xml` + `docs/discovery/endpoints_{cloud_mdd,onprem_modern_e19}.txt`.
- `src/__tests__/helpers/test-config.yaml.template` — for the `cloud` / `onprem` / `legacy` vocabulary.

Not every claim is discovery-backed to the same degree. Per-environment endpoint divergence (cloud vs E19) is noted in section 3.2; the implementation plan must resolve it (e.g. accept both paths, or restrict to the intersection).

## 10. Open questions for the implementation plan

These do not affect variant selection but need resolution before code lands:

- **Cross-environment sub-resource divergence.** Cloud `dependencies/validate` vs E19 `validation`, cloud `objects` vs E19 `objects/types`. Because analytics endpoints are out of scope for v1, this bites only if we later extend. Decision can wait.
- **`IAdtClientOptions` vs runtime-style options object.** Per the roadmap-review note #5, `AdtClient` and `AdtRuntimeClient` don't share a contract. This module lives in `src/core/` like the others, so it inherits the existing core-module options shape (no new contract needed); flagged here only for completeness.
- **Test data lifecycle.** Feature toggles bind to packages; the shared test package `ZAC_SHR_PKG` may or may not permit FTG2/FT creation on every target. Probe during test bring-up; if write is blocked, gate to read-only tests with `available_in: ["onprem"]`.
- **Source-round-trip fidelity.** The JSON source payload has SAP-maintained fields (LC2_* attribute keys) that may be server-populated after create. Round-trip tests (read after create → compare) likely need field-subset matching, not full equality.

## 11. Next step

Invoke `writing-plans` to produce `docs/superpowers/plans/2026-04-19-feature-toggle.md` with task-by-task TDD-oriented implementation.
