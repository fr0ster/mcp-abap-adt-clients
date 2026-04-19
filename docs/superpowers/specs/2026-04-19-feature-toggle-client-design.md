# Design: Feature Toggle support (three variants for review)

Date: 2026-04-19
Status: Three-variant proposal awaiting user decision
Parent: `docs/superpowers/specs/2026-04-19-sapcli-separate-clients-proposal.md` (roadmap item #1)

> **Per-class variant-selection pattern.** Each class in the sapcli-separate-clients roadmap gets its own design document of this shape. The variant choice (A / B / C) is resolved **independently per class**, not once for the whole roadmap. Implementation planning for a class does not start until its own variant is picked.

## 1. Goal

Add feature-toggle support to `@mcp-abap-adt/adt-clients`. This document presents **three architectural variants** with different scope and placement. The user picks one before implementation planning starts.

## 2. Why three variants

sapcli exposes a minimal state-toggling facade (`on`, `off`, `state`), but the underlying ADT surface `/sap/bc/adt/sfw/featuretoggles` supports a full ADT object lifecycle (an `FTG2/FT` type with lock/unlock/activate, source content, check, dependencies, logs, related objects). That range creates three legitimate design choices — match sapcli, cover the rich surface as a client, or treat it as another core object type.

## 3. Verified evidence

### 3.1 sapcli reference (`sap/adt/featuretoggle.py`, `sap/cli/featuretoggle.py`)

Implemented surface:

- `GET /sap/bc/adt/sfw/featuretoggles/{name}/states` → runtime state (client + user level) as JSON
  - Accept `application/vnd.sap.adt.states.v1+asjson`
  - Body shape: `{ STATES: { NAME, CLIENT_STATE, CLIENT_CHANGED_BY, CLIENT_CHANGED_ON, USER_STATE, CLIENT_STATES[], USER_STATES[] } }`
- `POST /sap/bc/adt/sfw/featuretoggles/{name}/toggle` → flip ON/OFF
  - Content-Type `application/vnd.sap.adt.related.toggle.parameters.v1+asjson`
  - Body `{ TOGGLE_PARAMETERS: { IS_USER_SPECIFIC: bool, STATE: "on" | "off", TRANSPORT_REQUEST?: string } }`

Documented but not wired from CLI:

- `POST /sap/bc/adt/sfw/featuretoggles/{name}/check`
  - Accept `application/vnd.sap.adt.toggle.check.result.v1+asjson`
  - Content-Type `application/vnd.sap.adt.toggle.check.parameters.v1+asjson`
  - Result: `{ RESULT: { CURRENT_STATE, TRANSPORT_PACKAGE, TRANSPORT_URI, CUSTOMIZING_TRANSPORT_ALLOWED } }`
- `POST /sap/bc/adt/sfw/featuretoggles/{name}/validate`
  - Accept `application/vnd.sap.adt.toggle.validation.result.v1+asjson`
  - Content-Type `application/vnd.sap.adt.toggle.validation.parameters.v1+asjson`

Referenced metadata surface (from the GET of the object itself):

- XML root `<blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue">` with adtcore attributes (`name`, `type="FTG2/FT"`, `description`, `responsible`, `masterLanguage`, `masterSystem`, `changedAt`, `changedBy`, `createdAt`, `createdBy`, `version`, etc.)
- `<adtcore:packageRef …/>` child
- Atom links to `source/main` (JSON rollout body), `source/main/versions`, GUI link, `schema`, `configuration`
- Source payload at `…/source/main` is JSON: `{ header, rollout, toggledPackages[], relatedToggles[], attributes[] }`

State enum: `"on" | "off" | "undefined"`.

### 3.2 Discovery corpus (`docs/discovery/discovery_cloud_mdd_raw.xml`, `endpoints_cloud_mdd.txt`, `endpoints_onprem_modern_e19.txt`)

All under `/sap/bc/adt/sfw/`:

- `featuretoggles` (collection)
- `featuretoggles/$configuration` (config template), `featuretoggles/$schema`
- `featuretoggles/attributes/attributeKeys`, `featuretoggles/attributes/attributeValues`
- `featuretoggles/{object_name}` with `?corrNr,lockHandle,version,accessMode,_action` — full CRUD + lock/unlock contract
- `featuretoggles/{object_name}/check`
- `featuretoggles/{object_name}/dependencies/validate`
- `featuretoggles/{object_name}/logs`
- `featuretoggles/{object_name}/objects`

Verified in the captured snapshots for **cloud MDD** and **modern on-prem E19**. Not seen on E77 (legacy) in current discovery. Per-class implementation should still probe a live modern on-prem target before promising write support, but `available_in` does not need to start cloud-only on discovery grounds.

Availability planning: `available_in: ["cloud", "onprem"]` provisionally; keep `legacy` unsupported unless later evidence proves otherwise. The implementation plan should decide whether write operations stay enabled on both environments immediately or whether tests roll out cloud-first while on-prem write support is validated.

## 4. Variant A — core module under `src/core/featureToggle/`

**Shape.** Treat feature toggle as an `IAdtObject<IFeatureToggleConfig, IFeatureToggleState>` — same pattern as `authorizationField` and the other 23 core modules. Full canonical operation chains: `create → check → lock → update → unlock → activate`, `update → …`, `delete → check(deletion) → delete`. Plus domain-specific methods layered on: `switchOn`, `switchOff`, `getRuntimeState`.

**Pros.**
- Fits the dominant pattern of the repo — consumers discover `getFeatureToggle()` on `AdtClient` next to `getDataElement()`, `getAuthorizationField()`, etc.
- Reuses existing infrastructure: content-type constants, XML builder, lock/unlock helpers, session transitions, test harness, `CLAUDE.md` count bump.
- Legitimate — the object genuinely IS an ADT-managed artifact with `adtcore:type="FTG2/FT"`, packageRef, and activation semantics.

**Cons.**
- **Contradicts the roadmap proposal** (`2026-04-19-sapcli-separate-clients-proposal.md`) which explicitly places `AdtFeatureToggleClient` as a separate client. Accepting A means updating section 3.3 of that proposal.
- **Mixed payload formats.** The object has XML metadata + JSON source at `/source/main` + JSON state/check/toggle/validate results. DDIC modules are pure XML; source-bearing modules are XML + text/plain. This is a **new hybrid** (XML + JSON) the `src/core/` pattern has not yet absorbed — either forces innovation in the shared core helpers or isolates all the JSON handling inside this one module.
- The rich sub-resource surface (`/logs`, `/dependencies/validate`, `/objects`, `$configuration`, `$schema`, `attributes/*`) has no natural home in the canonical CRUD chains. It would either attach as a loose set of extra methods (awkward) or get dropped.
- The sapcli use case (flip ON/OFF with corrnr) is NOT a standard CRUD operation — it's a state-machine command on an existing object. It sits oddly next to create/read/update/delete.

**Verdict.** Architecturally consistent for lifecycle, architecturally awkward for state-toggle + analytics.

## 5. Variant B — minimal separate client (sapcli parity)

**Shape.** New file `src/clients/AdtFeatureToggleClient.ts`. Factory: `adtClient.getFeatureToggle()` (or a standalone class consumers instantiate directly with `IAbapConnection`). Surface:

```ts
class AdtFeatureToggleClient {
  constructor(connection: IAbapConnection, logger?: ILogger, options?: ...);

  getRuntimeState(name: string): Promise<IFeatureToggleRuntimeState>;
  switchOn(name: string, opts: { transportRequest: string; userSpecific?: boolean }): Promise<void>;
  switchOff(name: string, opts: { transportRequest: string; userSpecific?: boolean }): Promise<void>;
}
```

Types:

```ts
type FeatureToggleState = 'on' | 'off' | 'undefined';

interface IFeatureToggleClientState {
  client: string;
  description?: string;
  state: FeatureToggleState;
}

interface IFeatureToggleRuntimeState {
  name: string;
  clientState: FeatureToggleState;  // aggregate of current session's client
  userState: FeatureToggleState;
  clientStates: IFeatureToggleClientState[];  // all clients
  userStates: Array<{ user: string; state: FeatureToggleState }>;
}

interface IFeatureToggleCheckResult {
  currentState: FeatureToggleState;
  transportPackage: string;
  transportUri: string;
  customizingTransportAllowed: boolean;
}
```

No create / no read-definition / no update / no delete / no lock / no activate / no analytics. Just the three operations sapcli ships: `state`, `on`, `off`.

**Pros.**
- **Matches the roadmap proposal exactly** — baseline size, baseline pattern for "separate client in current architecture".
- Smallest honest surface — only what is proven by existing sapcli usage. YAGNI for the rest.
- JSON-only — no XML parsing in this class at all. Keeps the first JSON-consuming client isolated and clean.
- Fastest to ship; fastest to review; easiest test scaffolding.

**Cons.**
- Users who need metadata (description, package, changedBy) or analytics (logs, dependencies) get nothing. They must drop to raw `connection.makeAdtRequest` or wait for v2 of this class.
- Does not exercise the repo's lock/activate flow — so the "pattern baseline" claim is partially unvalidated (the bigger clients will have to re-discover conventions).

**Verdict.** Right if the priority is to ship a usable fast client and postpone deeper work.

## 6. Variant C — extended separate client

**Shape.** Same file location as B (`src/clients/AdtFeatureToggleClient.ts`), same constructor, but richer surface:

```ts
class AdtFeatureToggleClient {
  constructor(connection: IAbapConnection, logger?: ILogger, options?: ...);

  // State (sapcli parity)
  getRuntimeState(name: string): Promise<IFeatureToggleRuntimeState>;
  switchOn(name: string, opts: { transportRequest: string; userSpecific?: boolean }): Promise<void>;
  switchOff(name: string, opts: { transportRequest: string; userSpecific?: boolean }): Promise<void>;

  // Pre-flight checks
  check(name: string, opts?: { userSpecific?: boolean }): Promise<IFeatureToggleCheckResult>;
  validate(name: string, opts: { state: FeatureToggleState; userSpecific?: boolean }): Promise<IFeatureToggleValidationResult>;

  // Read definition (lightweight metadata)
  readMetadata(name: string): Promise<IFeatureToggleMetadata>;  // parses the XML blueSource
  readSource(name: string): Promise<IFeatureToggleSource>;       // parses the JSON rollout body

  // Analytics
  listAffectedObjects(name: string): Promise<IFeatureToggleAffectedObject[]>;
  readDependencies(name: string): Promise<IFeatureToggleDependency[]>;
  readLogs(name: string): Promise<IFeatureToggleLogEntry[]>;
}
```

Types expand accordingly (kept out of this variant sketch to avoid premature bikeshedding; finalised in the implementation plan).

**Still out of scope for C:** create / delete / lock-unlock / activate / update of the toggle definition itself. Those remain the developer's job in ADT or a future extension.

**Pros.**
- Covers everything useful a consumer might ask for without reimplementing the underlying object lifecycle.
- Single client, one file per concern (state, check, metadata, analytics).
- Exercises mixed-payload parsing (XML metadata + JSON state / source / analytics) in a way the rest of the library hasn't yet faced — generates lessons for BSP/FLP/gCTS before those land.

**Cons.**
- **Roughly 3× the implementation effort of B** without 3× the user value for day-1 usage.
- Analytics methods (`listAffectedObjects`, `readDependencies`, `readLogs`) have no reference usage in sapcli — contract details (response shapes, edge cases) are only defined by live discovery against a specific system; bring-up cost is higher.
- Pre-flight `check` / `validate` distinction in sapcli comments is ambiguous; per-class implementation must nail down the semantic difference with live traces, raising scope risk.

**Verdict.** Right if the plan is "one well-rounded class, no successor work needed", and the user is willing to budget for the discovery work on analytics.

## 7. Non-decisions (same across all variants)

Regardless of A/B/C:

- **Transport:** Only `IAbapConnection`. No RFC, no direct axios.
- **JSON parsing:** Native `JSON.parse`; no new dependencies. Hand-roll types.
- **Content-type constants:** Added to `src/constants/contentTypes.ts` alongside the established `ACCEPT_*` / `CT_*` entries.
- **Accept negotiation:** Integrate with the existing `wrapConnectionAcceptNegotiation` wrapper. Feature-toggle endpoints are strict about Accept — expect 406 handling to matter.
- **Environment gating:** `available_in: ["cloud", "onprem"]` provisionally based on current discovery; keep `legacy` unsupported unless later evidence proves otherwise. The implementation plan should decide whether tests run on both environments immediately or stage write coverage after one live on-prem verification pass.
- **Transport-request binding:** `switchOn` / `switchOff` always require `transportRequest` (matches sapcli — `--corrnr` is marked `required`); `user-specific` toggles may skip it but the proposal keeps it required for safety. Final decision in the implementation plan.
- **Encoding:** `quote_plus` in sapcli → `encodeURIComponent` in TypeScript, applied to the feature-toggle name segment.
- **Documentation:** Updates to README, CLIENT_API_REFERENCE, ARCHITECTURE, LEGACY, ADT_OBJECT_ENTITIES follow the `#21` pattern from the auth-field / function-include release.

## 8. Comparison summary

| Aspect | A (core module) | B (minimal client) | C (extended client) |
|---|---|---|---|
| Architectural fit | Consistent with 24 existing core modules | New pattern (but sapcli-backed) | Same pattern as B, bigger surface |
| Scope | Full CRUD + state-toggle + maybe analytics | `state`, `on`, `off` | +`check`, +`validate`, +`readMetadata/readSource`, +analytics |
| Payload | Hybrid XML + JSON | JSON only | Hybrid XML + JSON |
| Effort | Medium–Large | Small | Medium |
| Matches roadmap proposal | No — requires updating proposal section 3.3 | Yes | Yes |
| Pattern-baseline value | Exercises core-module conventions already well-known | Exercises the new "separate client" contract minimally | Exercises the new contract under real complexity |
| Risk of rework | Moderate (hybrid payload in core is new) | Low | Moderate (analytics contract unknown) |
| Testability on cloud trial | Needs writeable FTG2/FT objects (may not be permitted) | Needs one readable feature toggle to `state` / `switch` | Same as B + analytics endpoints to read |

## 9. What is NOT decided here

- Final public method names (we may need `getState` vs `fetchState`, `switchOn` vs `enable` — bikeshed in the implementation plan, not now).
- Exact config/state TypeScript type names.
- Whether the class is created directly or via `AdtClient.getFeatureToggle()`. The proposal leans toward the factory pattern for consistency, but a standalone import-and-instantiate flow is also defensible — decide together with option choice.
- Cross-cutting options shape (per proposal review note #5 — `IAdtClientOptions` vs runtime-style vs new shared contract).

## 10. Decision criteria

Pick **A** if:
- You want uniformity with the rest of `src/core/` at the cost of one extra hybrid-payload shared-helper evolution.
- Plan to also cover feature-toggle lifecycle (create/delete) in-scope.

Pick **B** if:
- "Ship fast, validate the separate-client pattern, extend later" is the priority.
- The only near-term consumer need is ON/OFF switching with corrnr.
- You want to preserve roadmap-proposal ordering verbatim.

Pick **C** if:
- You want one definitive feature-toggle class, not an iterative v1 → v2 → v3.
- You're budgeted for the discovery work on `logs` / `dependencies` / `objects`.

## 11. Next step

User picks A, B, or C (or a hybrid variant). After selection:

1. Update this document to carry only the chosen variant (prune the other two).
2. Update `docs/superpowers/specs/2026-04-19-sapcli-separate-clients-proposal.md` if the choice was A (since the roadmap placement changes).
3. Proceed to `writing-plans` skill for the implementation plan.

This document intentionally does not proceed further until the choice is made.
