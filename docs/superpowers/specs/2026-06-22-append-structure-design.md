# Design: Append Structure (TABL/DS append) client

**Date:** 2026-06-22
**Status:** Approved
**Object type:** Append structure — ADT type `TABL/DS`, endpoint base `/sap/bc/adt/ddic/structures`,
created with a `base_structure` template (the table/structure being extended) and `extend type ...`
source.

## Goal

Add a full CRUD + lifecycle client for **append structures**, exposed as
`AdtClient.getAppendStructure()` returning `IAdtObject<IAppendStructureConfig,
IAppendStructureState>`. An append is a standalone named DDIC object (e.g. `ZOK_S_APPEND`) that
extends a base table or structure.

## Why a dedicated module (not the existing `structure` module)

The existing `structure` module (`src/core/structure/`) hits the **same endpoint and same
`adtcore:type="TABL/DS"`** with the same `blue:blueSource` envelope and `/source/main` update — but
it creates a *plain* structure (`define structure ...`). An append differs in two ways that justify
a separate, clearly-named handler (per the user's explicit "full CRUD class" decision):

1. the create envelope carries an `adtcore:adtTemplate` block naming the **base object**
   (`base_structure`); a plain structure has no template;
2. the source is `extend type {base} with {name} { ... }`, not `define structure`.

A dedicated `AppendStructure` keeps the append's required `baseObject` field and distinct
semantics out of the plain-structure API, and matches the per-type-handler convention.

## Wire contract (captured from a live TRL system, ADT 3.60)

Object names are lower-cased in the URL path (trace used `zok_s_append`).

| Step | Method / URL | Body / headers |
|---|---|---|
| **create** | `POST /sap/bc/adt/ddic/structures[?corrNr={tr}]` | blues envelope w/ template (below); `Content-Type: application/vnd.sap.adt.structures.v2+xml`; `Accept: application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml` |
| **update source** | `PUT /sap/bc/adt/ddic/structures/{name}/source/main?lockHandle={h}[&corrNr={tr}]` | `extend type` source; `Content-Type: text/plain; charset=utf-8`; `Accept: text/plain` (from trace) |
| **read source** | `GET /sap/bc/adt/ddic/structures/{name}/source/main[?version={v}]` | `Accept: text/plain` |
| **read metadata** | `GET /sap/bc/adt/ddic/structures/{name}[?version={v}]` | `Accept: application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml` |
| **transport** | `GET /sap/bc/adt/ddic/structures/{name}/transport` | `Accept: application/vnd.sap.adt.transportorganizer.v1+xml` |
| **lock / unlock / check / activate / delete** | same generic ADT patterns as `structure` | as in `structure` |

**Source of truth = the live trace, not the existing `structure` module.** The create headers/URL
match `structure` exactly, but the update **`Accept` differs**: `structure/update.ts` sends
`Accept: application/xml, application/json, text/plain, */*`, whereas the captured PUT trace sends
`Accept: text/plain`. We follow the trace (`Accept: text/plain`) and assert it in a unit test, so
the divergence is intentional and locked, not an accidental copy.

### Create envelope (exact shape from trace)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="{description}" adtcore:language="{lang}"
  adtcore:name="{NAME}" adtcore:type="TABL/DS"
  adtcore:masterLanguage="{lang}"
  adtcore:masterSystem="{sys}" adtcore:responsible="{user}">
  <adtcore:adtTemplate>
    <adtcore:adtProperty adtcore:key="base_structure">{BASE}</adtcore:adtProperty>
  </adtcore:adtTemplate>
  <adtcore:packageRef adtcore:name="{PACKAGE}"/>
</blue:blueSource>
```

- `base_structure` = the table or structure being extended (`baseObject`, **required**). The
  template key is **always `base_structure`**, whether the base is a table or a structure — see
  "Base object" below.
- `masterSystem` / `responsible` emitted only when present (conditional, same as `structure`).
- `description` limited to 60 chars via `limitDescription`.
- **Case normalization (from trace):** the URL path is lower-cased, but the **envelope uses
  upper-case** object identifiers — the trace shows `ZOK_S_APPEND` / `ZMCP_SHR_STRU` /
  `ZMCP_SHR_PKG`, and `structure/create.ts` already `.toUpperCase()`s name + package. The append
  envelope therefore `.toUpperCase()`s **`name`, `base`, and `package`** (the three object
  identifiers) before XML-escaping. Unit-tested (lower-case input → upper-case in the envelope,
  lower-case in the URL).
- **XML escaping (improvement over `structure`):** after upper-casing, all interpolated attribute
  values (`description`, `name`, `package`, `base`, `masterSystem`, `responsible`) are XML-escaped
  (`& < > " '`) via a small `escapeXmlAttr()` helper. The existing `structure` create does not
  escape — we do not replicate that latent bug. Unit-tested.

### Append source (NOT sent by `create()`)

```
@EndUserText.label : '{label}'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
extend type {base} with {name} {
  {fields}
}
```

`create()` performs the metadata POST only (see "create() semantics"). Real source is supplied via
`update()` afterwards. We do not auto-seed source (no placeholder fields), consistent with the
scalar-function design.

### Base object

The class supports appending to both a **table** and a **structure** (user requirement). The config
carries a single `baseObject` field — the **name** of the base table or structure.

**Both base kinds use the identical wire contract — CONFIRMED by two live traces:**
- structure base `ZMCP_SHR_STRU` → `adtProperty adtcore:key="base_structure"`, source
  `extend type zmcp_shr_stru with ...`;
- table base `ZMCP_VIEW_TBL02` → **same** `adtProperty adtcore:key="base_structure"`, **same**
  `extend type zmcp_view_tbl02 with ...` source dialect.

The template key is therefore a constant `base_structure` regardless of base kind. **No
`baseObjectType` discriminator and no template-key branching are needed** (dropped per YAGNI — they
would be dead parameters with zero wire effect). `baseObject` may name either kind; SAP resolves the
referenced object itself. This closes the former open item.

## Module layout — `src/core/appendStructure/`

Mirror of `structure` / `serviceDefinition`, file-for-file:

- `AdtAppendStructure.ts` — `IAdtObject` handler, `objectType = 'AppendStructure'`, operation
  chains (create / read / readMetadata / readTransport / update / delete / activate / check / lock /
  unlock). Same chain shape as `AdtServiceDefinition`, with the hardening below.
- `types.ts` — `ICreateAppendStructureParams`, `IUpdateAppendStructureParams`,
  `IDeleteAppendStructureParams` (low-level), `IAppendStructureConfig` (camelCase:
  `appendStructureName`, `baseObject` (**required for create** — name of the base table or
  structure), `packageName`, `description`, `transportRequest`, `sourceCode`, `masterLanguage`),
  `IAppendStructureState extends IAdtObjectState` (adds optional `validationSupported?: boolean`).
- `create.ts` — builds the (upper-cased, escaped) blues envelope **with** the
  `adtTemplate/adtProperty adtcore:key="base_structure"` block; POST with the structures
  Content-Type. Low-level `create()` is metadata-only (mirrors `structure/create.ts`).
- `read.ts` — `getAppendStructure` (metadata), `getAppendStructureSource`,
  `getAppendStructureTransport`; URLs built directly; Accept negotiation via
  `makeAdtRequestWithAcceptNegotiation`.
- `update.ts` — PUT `/source/main?lockHandle=...&corrNr=...`, `Content-Type: text/plain;
  charset=utf-8`; `corrNr` always `encodeURIComponent`-encoded. **Deliberate hardening:**
  `structure/update.ts` interpolates `&corrNr=${transportRequest}` **raw** (no encoding) — do NOT
  copy that; encode it. (`structure/update.ts` does already `encodeURIComponent` the `lockHandle`;
  only `corrNr` is raw there.)
- `delete.ts` — `checkDeletion` + `deleteAppendStructure` (deletion-check POST + deletion POST).
  **Lowercase fix:** both build the object URI from the lower-cased, encoded name
  (`encodeSapObjectName(name.toLowerCase())`); the `structure`/`serviceDefinition` delete functions
  do not lowercase — we do, for wire-contract consistency. Unit tests assert the lowercased
  `adtcore:uri` in both XML payloads.
- `lock.ts` / `unlock.ts` — generic ADT lock/unlock against the structures URL, per `structure`.
- `check.ts` — check messages against active/inactive version, per `structure`.
- `activation.ts` — activate via the generic activation endpoint, per `structure`.
- `validation.ts` — name validation. **Open item:** exact endpoint/dataname unconfirmed; implement
  by analogy and confirm at test time. **Narrow fallback:** only HTTP **404 / 405 / 501** →
  `validate()` returns `validationSupported: false` and does NOT throw; **all other failures
  propagate** (401/403/timeouts/5xx are real, never masked as "unsupported").
- `index.ts` — `export { AdtAppendStructure }`, `export * from './types'`, `AdtAppendStructureType`
  alias.

## create() semantics (explicit)

`AdtAppendStructure.create(config)`:
1. Validates required fields (`appendStructureName`, `baseObject`, `packageName`, `description`).
2. POSTs the metadata envelope (with the `base_structure` template) only. **No source upload, no
   lock/update/unlock/activate during create** (matches `structure`/`serviceDefinition`).
3. Returns `state.createResult`. The object now exists (inactive) carrying the server's default
   `extend type` skeleton.

Source passed to `create()` — via **either** `config.sourceCode` **or** `options.sourceCode` — is a
documented no-op for `create()` (kept for a later `update`). Both paths asserted by a unit test.

## Error handling

Based on `structure`, with the same **session-reset hardening** as the scalar-function design:

- **Guaranteed session reset.** The cleanup-unlock in the update chain and the public `unlock()`
  put `setSessionType('stateless')` in a **`finally`**, so the session is always reset even if the
  unlock itself throws (the copied code resets only after a successful unlock). Unit test: unlock
  throws → session still ends `stateless`.
- `read()` returns `undefined` on 404; optional `deleteOnFailure` / `activateOnUpdate` honored via
  `IAdtOperationOptions`.
- `corrNr` always `encodeURIComponent`-encoded on create and update URLs.

## Integration points

1. **checkRun object-type mapping (REQUIRED, in scope)** — `check()` routes through
   `runCheckRun(connection, 'append_structure', ...)` → `getObjectUri()` in
   `src/utils/checkRun.ts`. The append type is `TABL/DS`, which does **not** match the existing
   `structure`/`stru/dt` or `table`/`tabl/dt` cases, so without a new case it throws
   `Unsupported object type`. Add:
   ```ts
   case 'append_structure':
   case 'tabl/ds':
     return `/sap/bc/adt/ddic/structures/${encodedName}`;
   ```
   (The append object is addressable at the same `/ddic/structures/{name}` path as the PUT source
   target.) Single targeted addition, distinct from the broader maps in point 5.
2. **Content type** — reuse existing `CT_STRUCTURE` (`application/vnd.sap.adt.structures.v2+xml`)
   and the existing structure Accept string. Add a named `ACCEPT_APPEND_STRUCTURE` alias only if it
   improves clarity; otherwise reuse the structure constants (no new media type — same wire types).
3. **AdtClient** — add `getAppendStructure(): IAdtObject<IAppendStructureConfig,
   IAppendStructureState>` returning `new AdtAppendStructure(connection, logger, systemContext)`,
   next to `getStructure()`.
4. **Public API** (`src/index.ts`) — export `AdtAppendStructure`, `AdtAppendStructureType`,
   `IAppendStructureConfig`, `IAppendStructureState` (+ low-level param types per existing
   convention).
5. **Broader object-type maps** (`AdtUtils` / `whereUsed` / `typeInfo`) — **out of scope** for v1
   (where-used/search by this type added later if needed). Distinct from the in-scope checkRun
   mapping in point 1.

## Testing

### Unit tests (REQUIRED — offline, do not depend on a live system)

Under `src/__tests__/unit/appendStructure/` (pure functions + mock `IAbapConnection`):

- **create envelope** — exact `blue:blueSource` string incl. the `adtTemplate/adtProperty` block,
  `adtcore:type="TABL/DS"`, conditional `masterSystem`/`responsible`, `packageRef`, 60-char
  description limit.
- **template key constant** — the envelope always emits `adtProperty adtcore:key="base_structure"`,
  asserted for both a structure-name base and a table-name base (a change to the key would be a
  deliberate, test-breaking edit).
- **case normalization** — lower-case input `name`/`base`/`package` appear **upper-cased** in the
  envelope but **lower-cased** in the URL path.
- **XML escaping** — `description`/`name`/`package`/`base` with `& < > " '` escaped correctly
  (after upper-casing).
- **URL building** — name lower-cased + `encodeSapObjectName`-encoded; `?corrNr=` only when a
  transport is present and always `encodeURIComponent`-encoded; update URL carries `lockHandle`
  (+ optional `corrNr`); read `version` query.
- **headers (per operation, do not conflate)** — create: `Content-Type:
  application/vnd.sap.adt.structures.v2+xml`; update (PUT): `Content-Type: text/plain;
  charset=utf-8` **and `Accept: text/plain`** (from trace — explicitly NOT the
  `application/xml, ...` Accept that `structure/update.ts` uses); read source (GET): `Accept:
  text/plain`; read metadata: blues+structures Accept.
- **checkRun URI** — `getObjectUri('append_structure', 'ZOK_S_APPEND')` and
  `getObjectUri('tabl/ds', ...)` both return `/sap/bc/adt/ddic/structures/zok_s_append` (no throw).
- **handler chains via mock connection** — update-chain failure forces unlock and ends
  `setSessionType('stateless')` even when unlock throws; `read()` 404 → `undefined`; `create()`
  does NOT lock/update (source no-op, both `config` and `options` paths); `create()` requires
  `baseObject`; `validate()` 404/405/501 → `validationSupported: false`, 403/timeout/500 re-throw.

### Integration test (live system, gated)

Under `src/__tests__/integration/core/appendStructure/`, mirroring the `structure` integration
test: create (with a base) → read → update (`extend type` source) → activate → delete, idempotent
(delete-if-exists before create). **Two base cases are exercised** for regression coverage — one
`structure` base and one `table` base (both confirmed to use `base_structure`); this guards against
a future divergence. Add an `append_structure` entry to
`src/__tests__/helpers/test-config.yaml.template` (append name, base structure name, base table
name, package).

**Skip mechanism (single, non-contradictory contract — same as scalar function).** `available_in`
is a static hint and does not prove support. Discovery is only a positive fast-path, never a skip
trigger (`fetchDiscoveryEndpoints()` swallows errors → empty `Set`, so "unavailable" is
indistinguishable from "absent"):

- endpoint found via `isEndpointInDiscovery(endpoints, '/sap/bc/adt/ddic/structures')` → supported,
  run suite;
- not found, or discovery empty/unavailable → inconclusive, fall through to the real `create`;
- `create` returns **404 / 405 / 501** → skip (logged per the project's skip-logging convention);
- any other status (success, or 401/403/timeout/5xx) → not a skip (success proceeds; the rest are
  real failures).

(The structures endpoint itself is old and always present, so the suite will normally run; the skip
path mainly guards exotic/locked-down systems.)

During the integration phase, confirm against the live system:
- create POST is accepted with the template block (both base kinds);
- `validation.ts` endpoint shape and its unsupported status codes;
- that `create()` alone yields the server default `extend type` skeleton.

## Out of scope (YAGNI)

- where-used / search / package-hierarchy registration for the new type;
- batch-client wiring (same mechanical pattern can follow later);
- append targets other than tables/structures.
