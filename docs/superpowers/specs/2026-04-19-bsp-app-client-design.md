# Design: BSP Application Client (three variants for review)

Date: 2026-04-19
Status: Three-variant proposal awaiting user decision
Parent: `docs/superpowers/specs/2026-04-19-sapcli-separate-clients-proposal.md` (roadmap item #1 of four remaining separate clients — pattern baseline slot)

> **Per-class variant-selection pattern.** Each class in the sapcli-separate-clients roadmap gets its own three-variant design document. The variant choice is resolved independently per class. Per the roadmap's variant-selection rule (§4.1), the default starting assumption for BSP is **Variant C** (service-like, orchestration-heavy). Variants A and B remain on the table for completeness and to make the architectural argument explicit.

## 1. Goal

Add a client for uploading, inspecting, and deleting BSP/UI5 applications in the ABAP repository. This covers the workflow a developer needs when shipping a Fiori/UI5 front-end artifact to an ABAP system: package a zip archive and push it to a BSP namespace, inspect what is there, and remove the application when done.

## 2. Why three variants

The BSP surface presents two orthogonal design choices that compound into three meaningful architectural variants:

1. **Architectural shape.** A real ADT repository object (IAdtObject) vs a focused separate client.
2. **Transport family.** OData v2 via `UI5/ABAP_REPOSITORY_SRV` (what sapcli uses) vs ADT filestore at `/sap/bc/adt/filestore/ui5-bsp/*` (what Eclipse ADT uses and our own discovery verified on every target including legacy E77).

Variant A explores whether BSP fits IAdtObject. Variant B is a narrow sapcli-parity wrapper over OData v2. Variant C is the extended separate client that covers both worlds.

## 3. Verified evidence

### 3.1 sapcli reference (`sap/cli/bsp.py`)

Dependencies and style:

- Uses `pyodata` OData v2 client — not raw HTTP.
- Entity set: `Repositories`.
- Service URL: **`UI5/ABAP_REPOSITORY_SRV`** — explicitly bound at the command-group registration site (`sap/cli/__init__.py:111`):
  ```python
  (partial(odata_connection_from_args, 'UI5/ABAP_REPOSITORY_SRV'), sap.cli.bsp.CommandGroup())
  ```
- sapcli shares this OData-v2 pattern across all its UI-related commands — BSP uses `UI5/ABAP_REPOSITORY_SRV`, FLP uses `UI2/PAGE_BUILDER_CUST` (same line 112). Any minimal OData-v2 helper we implement is reusable between the two.
- **sapcli does NOT use ADT filestore.** A repo-wide grep for `filestore`, `ui5-bsp`, `deploy-storage`, and `ui5-rt-version` returns zero hits in sapcli's source tree. There are no code comments or docstrings explaining the choice — the OData-v2 path appears historically established, not argued for in code. Our design therefore treats ADT filestore as a new transport that needs live verification, while OData v2 is the fully-sapcli-documented fallback.

Commands:

- **`upload --bsp --package --app --corrnr`**
  - Read zip archive from the local filesystem; base64-encode.
  - Probe `Repositories.get_entity(Name=bsp)`. If 404 → `create_entity()`; otherwise `update_entity(Name=bsp)`.
  - POST body payload: `{ Name, Package, ZipArchive }` (ZipArchive = base64 of the zip bytes).
  - Custom OData query params (via pyodata `.custom(...)`): `CodePage=UTF8`, `TransportRequest=<corrnr>`, `client=<sap-client>`.
  - Target system prerequisite (from sapcli docstring): `trnspace` editflag for `/0CUST/` and `/0SAP/` namespaces, plus disabling of `GATEWAY_VIRUSCAN_PROFILE`.
- **`stat --bsp`** → `Repositories.get_entity(Name=bsp).execute()`. Prints `Name`, `Package`, `Description`. Returns exit code `NOT_FOUND` on 404.
- **`delete --bsp --corrnr`** → `Repositories.delete_entity(Name=bsp).custom('TransportRequest', corrnr).execute()`. 404 silently tolerated.

### 3.2 Discovery corpus (ADT filestore)

From `docs/discovery/discovery_{cloud_mdd,e19,e77,trial}_raw.xml`:

- `/sap/bc/adt/filestore/ui5-bsp` (collection) — present on **all four** targets (cloud MDD, modern on-prem E19, legacy E77, trial).
- `/sap/bc/adt/filestore/ui5-bsp/objects` — sub-resource, all four targets.
- `/sap/bc/adt/filestore/ui5-bsp/deploy-storage` — all four targets.
- `/sap/bc/adt/filestore/ui5-bsp/ui5-rt-version` — all four targets.

Crucially, this is **the only sapcli-referenced capability that discovery verifies on E77 (legacy)**. The OData v2 path sapcli uses has no legacy-friendly guarantee in our corpus; ADT filestore is the only transport proven to work everywhere.

The exact semantics of the three ADT filestore sub-resources (which one accepts a zip, which returns a listing, which reports the UI5 runtime version, how transport is bound) are **not** spelled out in the discovery XML. Live probing is required before a final content-shape commitment.

### 3.3 Repository pattern notes

- sapcli's upload logic (`create` or `update` depending on whether the entity already exists) is a client-side upsert — the OData service does not expose a single "upsert" operation, so sapcli does the read-before-write itself.
- Transport binding is always by corrnr passed as a custom query param, never via the XML/JSON payload.

## 4. Variant A — core module under `src/core/bspApp/`

**Shape.** Treat a BSP application as an `IAdtObject<IBspAppConfig, IBspAppState>` with canonical CRUD + lifecycle. Factory: `AdtClient.getBspApp()`.

**Why it could fit.** A BSP application does have an identity (BSP name), a package, and lifecycle that approximates create / update / delete.

**Why it does NOT fit.**

- No lock/unlock semantics — neither sapcli nor discovery surface an `?_action=LOCK` contract for BSP.
- No activation chain — BSP upload is immediate; there is no separate "activation" step after the data is pushed.
- The source payload is a **binary zip archive**, not XML metadata plus ABAP text. The `IAdtObject` template expects either pure XML (DDIC-style) or XML metadata + `text/plain` source; neither matches.
- The canonical `IAdtObject.check()` endpoint (`/checkruns?reporters=abapCheckRun`) is not meaningful for a BSP repository — there is no ABAP syntax to check.
- The canonical `read` returns structured metadata; BSP's read returns a package reference and description, with the zip archive itself typically not returned.

**Verdict.** Variant A is architecturally misaligned. Forcing BSP into `IAdtObject` would leave a handler where roughly half the interface methods are stubs. Reject this variant.

## 5. Variant B — minimal separate client (sapcli parity, OData v2)

**Shape.** New file `src/clients/AdtBspAppClient.ts`. Factory: `AdtClient.getBspApp()` returns the specialized `IAdtBspAppClient`. Transport: OData v2 over `UI5/ABAP_REPOSITORY_SRV` (hand-rolled minimal OData v2 — no `pyodata`-style dependency added).

**Public surface** (sapcli parity exactly):

```ts
interface IBspAppClientStat {
  name: string;
  package: string;
  description?: string;
}

interface IAdtBspAppClient {
  upload(args: {
    name: string;
    package: string;
    zipArchive: Buffer | Uint8Array | string;    // string = already base64
    transportRequest: string;
    codePage?: 'UTF8' | string;                   // defaults to UTF8
  }): Promise<void>;

  stat(name: string): Promise<IBspAppClientStat | undefined>;   // undefined on 404

  delete(args: { name: string; transportRequest: string }): Promise<void>;
}
```

**Pros.**

- Smallest honest surface — only what sapcli ships, proven useful in practice.
- OData v2 contract is fully specified by sapcli; no live-probing risk on day one.
- Roadmap-aligned: Variant B is the narrow-subset default and matches the pattern-baseline slot well.

**Cons.**

- OData v2 path is **not verified on legacy E77** in our discovery. Sapcli works against it in practice, but a fresh port would need live verification before declaring E77 support.
- Requires at least a minimal OData v2 helper (URL building, metadata fetching for EntitySets, `.custom(...)` query-param emulation). No existing library utility covers this; we'd hand-roll a tiny slice (no metadata introspection, fixed service URL, fixed EntitySet).
- Leaves the ADT-native filestore path unused even though discovery proves it exists everywhere — future-v2 work if we ever want Eclipse-ADT-parity.
- sapcli-targetted prerequisites (`trnspace editflag`, `GATEWAY_VIRUSCAN_PROFILE`) are server-side configuration the library cannot enforce. Must be documented, not implemented.

**Verdict.** Right if the goal is exact sapcli parity with smallest code surface. Postpones the question of which transport is long-term correct.

## 6. Variant C — extended separate client (recommended)

**Shape.** New file `src/clients/AdtBspAppClient.ts`. Factory: `AdtClient.getBspApp()` returns `IAdtBspAppClient`. Transport chosen at **runtime via `AdtBspAppClientOptions.transport`**:

```ts
type BspAppTransport = 'adt-filestore' | 'odata-v2';

interface IAdtBspAppClientOptions {
  transport?: BspAppTransport;   // default 'adt-filestore' where available; falls back to 'odata-v2'
}
```

The `'adt-filestore'` mode talks to `/sap/bc/adt/filestore/ui5-bsp/*` (discovery-verified on all four environments including legacy). The `'odata-v2'` mode preserves the sapcli-compatible path for systems that only expose `UI5/ABAP_REPOSITORY_SRV`. The library tries the ADT path first unless the caller pins a specific mode.

**Public surface** (sapcli parity plus ADT-native extras):

```ts
interface IBspAppClientStat {
  name: string;
  package: string;
  description?: string;
  ui5RuntimeVersion?: string;   // from /filestore/ui5-bsp/ui5-rt-version (ADT mode only)
  // Additional fields populated when the chosen transport returns them; callers
  // must tolerate missing fields in either mode.
}

interface IBspAppClientObject {
  name: string;
  contentType?: string;
  path?: string;
}

interface IAdtBspAppClient {
  // Core (both modes)
  upload(args: {
    name: string;
    package: string;
    zipArchive: Buffer | Uint8Array | string;
    transportRequest: string;
    codePage?: 'UTF8' | string;
  }): Promise<void>;

  stat(name: string): Promise<IBspAppClientStat | undefined>;

  delete(args: { name: string; transportRequest: string }): Promise<void>;

  // ADT filestore extras (throw NotSupportedError in odata-v2 mode)
  listObjects(name: string): Promise<IBspAppClientObject[]>;    // /filestore/ui5-bsp/objects?bsp=...
  getUi5RuntimeVersion(): Promise<string>;                       // /filestore/ui5-bsp/ui5-rt-version
}
```

**Pros.**

- Covers every useful operation that either transport exposes — no successor v2 work needed for the common cases.
- Proven-everywhere transport (ADT filestore) is the primary path; sapcli-compatible path stays available as fallback.
- Single import, single mental model for consumers; transport choice is a runtime option, not a compile-time fork.
- ADT filestore reuses the existing `IAbapConnection` HTTP session; no new OData-v2 helper needed for the primary path. A small OData-v2 helper is implemented only for the fallback, with reduced scope (just the three operations, no metadata introspection).

**Cons.**

- Both transports must be maintained — double the surface area.
- ADT filestore semantics for upload (which sub-resource accepts the zip, what payload wrapper, how transport binds) are **not** fully known from our discovery corpus. Live verification is mandatory during implementation; if ADT filestore turns out to only support listing and read-only inspection, the upload path falls back to OData v2 anyway.
- `listObjects` and `getUi5RuntimeVersion` have no sapcli precedent — their request/response shapes must be reverse-engineered from live traces.

**Verdict.** Recommended. Fits the roadmap's default "Variant C" position for separate clients. Keeps sapcli parity intact while gaining legacy-friendly transport and ADT-native extras.

## 7. Non-decisions (fixed constraints shared across all variants)

Regardless of A/B/C:

- **Transport layer.** Only `IAbapConnection`. No RFC.
- **OData v2 helper, if needed.** Hand-rolled inside the module (`src/clients/bspApp/odataV2.ts`). Minimal: URL building with `$filter` / `$format`, entity upsert, entity delete, custom query param append. No schema introspection, no general-purpose client.
- **Zip handling.** Accept `Buffer | Uint8Array | string`. When `string`, assume the caller already base64-encoded. Never read from disk — file I/O is the caller's responsibility.
- **Transport-request binding.** `upload` and `delete` require `transportRequest`; `stat` / `listObjects` / `getUi5RuntimeVersion` do not.
- **Environment gating.** Default `available_in: ["onprem", "cloud"]`. `legacy` remains in the provisional list IF the chosen transport works there; ADT filestore is verified on E77 by discovery, so Variant C can start with `["onprem", "cloud", "legacy"]` from day one. OData-v2 mode: legacy support depends on live verification.
- **Error handling.** 404 on `stat` and `delete` returns `undefined` / no-op (sapcli behaviour). Other errors propagate as thrown `Error`.
- **Public typing rule.** Factory returns `IAdtBspAppClient`, not a narrower base type. Specialized interface per roadmap §4.2.
- **Client placement.** `src/clients/AdtBspAppClient.ts`. Low-level helpers under `src/clients/bspApp/*`.
- **Documentation.** README, CLIENT_API_REFERENCE, ARCHITECTURE, LEGACY updates follow the #21 / #28 pattern.

## 8. Comparison summary

| Aspect | A (core module) | B (minimal client) | C (extended client) |
|---|---|---|---|
| Architectural fit | Forced; ~half the IAdtObject methods are stubs | Clean separate client | Clean separate client |
| Transport(s) | n/a | OData v2 only | ADT filestore primary + OData v2 fallback |
| sapcli parity | Partial (CRUD maps, lifecycle stubs) | Exact | Exact + extras |
| Legacy (E77) support | Not applicable — rejected | Depends on live probe | **Verified** by discovery (ADT filestore) |
| Code surface | Medium (core module + content-types + tests) | Small | Medium |
| Risk | Architectural — rejected | Low — contract fully sapcli-documented | Medium — ADT filestore semantics need live probe |
| Matches roadmap default | No (roadmap defaults to C) | Acceptable narrow-fallback | **Yes** |
| Analytics / extras | None | None | `listObjects`, `getUi5RuntimeVersion` |

## 9. What is NOT decided here

- Exact ADT filestore upload semantics (which sub-resource, what payload wrapper, response shape). Must be resolved during Variant C implementation via live probing — if it turns out to be unusable for upload, Variant C downgrades to Variant B's OData-v2-only path with a transport option retained for future upgrade.
- Whether `listObjects` takes the BSP name as a query param or as a URL segment — discovery shows `/filestore/ui5-bsp/objects` as a collection but not the per-BSP binding.
- Whether `getUi5RuntimeVersion` is system-global or per-BSP — likely global, but confirm via live trace.
- Exact public method names (we may bikeshed `upload` vs `deploy`, `stat` vs `get`, `listObjects` vs `contents`). Final names in the implementation plan.
- Cross-cutting options shape (per roadmap §4.1 note — `AdtClient` and `AdtRuntimeClient` differ). Variant C picks `IAdtBspAppClientOptions` as a fresh per-class contract; broader standardisation waits for more data points.

## 10. Decision criteria

Pick **A** if:
- You want uniformity with the rest of `src/core/` and accept that half the IAdtObject surface will be stubs.
- (Recommendation: don't pick A. BSP doesn't match the pattern.)

Pick **B** if:
- "Ship narrow sapcli parity fast" is the priority.
- You accept that legacy-E77 support is unverified until someone runs the suite there.
- You're comfortable reopening the design later if the ADT filestore path becomes interesting.

Pick **C** if:
- You want one authoritative BSP client that covers both transports.
- ADT-filestore-verified legacy support matters (E77 coverage out of the box).
- You're budgeted for live probing of ADT filestore during implementation.

## 11. Next step

User picks A, B, or C (or a hybrid). After selection:

1. Update this document to carry only the chosen variant (prune the other two).
2. Proceed to `writing-plans` for the implementation plan.

This document intentionally does not proceed further until the choice is made.
