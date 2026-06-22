# Design: CDS Scalar Function (DSFD) client

**Date:** 2026-06-22
**Status:** Approved
**Object type:** CDS Scalar Function — ADT type `DSFD/SCF`, endpoint base `/sap/bc/adt/ddic/dsfd/sources`

## Goal

Add a full CRUD + lifecycle client for **CDS Scalar Functions** (`define scalar function ...`),
exposed as `AdtClient.getScalarFunction()` returning an `IAdtObject<IScalarFunctionConfig,
IScalarFunctionState>`. Mirror the existing `serviceDefinition` module, which is the closest
self-contained source-based DDIC handler.

## Why a new module (not an extension of `view`)

The object is source-based like CDS DDLS (`ddl/sources`), but:
- its **create envelope** is the generic `blue:blueSource` "blues" wrapper (like Table / Behavior
  Definition / Authorization Field), not the `ddl:ddlSource` wrapper;
- its lifecycle (lock → check → update via `/source/main` → unlock → activate, plus delete with
  deletion check) is identical to `serviceDefinition`.

A dedicated, self-contained module keeps per-type handlers isolated (matches the project's
"AdtClient = IAdtObject-only, CRUD-only" rule) and avoids special-casing inside `view`.

## Wire contract (captured from a live TRL system, ADT 3.60)

All object names are lower-cased in the URL path (same as `serviceDefinition`; trace used
`zok_test_func`).

| Step | Method / URL | Body / headers |
|---|---|---|
| **create** | `POST /sap/bc/adt/ddic/dsfd/sources[?corrNr={tr}]` | blues envelope (below), `Content-Type: application/vnd.sap.adt.blues.v1+xml` |
| **update source** | `PUT /sap/bc/adt/ddic/dsfd/sources/{name}/source/main?lockHandle={h}[&corrNr={tr}]` | source text, `Content-Type: text/plain; charset=utf-8`, `Accept: text/plain` |
| **read source** | `GET /sap/bc/adt/ddic/dsfd/sources/{name}/source/main[?version={v}]` | `Accept: text/plain` |
| **read metadata** | `GET /sap/bc/adt/ddic/dsfd/sources/{name}[?version={v}]` | `Accept: application/vnd.sap.adt.blues.v1+xml` |
| **transport** | `GET /sap/bc/adt/ddic/dsfd/sources/{name}/transport` | `Accept: application/vnd.sap.adt.transportorganizer.v1+xml` |
| **lock / unlock / check / activate / delete** | identical to `serviceDefinition` patterns (generic ADT endpoints) | as in `serviceDefinition` |

### Create envelope (exact shape from trace)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="{description}" adtcore:language="{lang}"
  adtcore:name="{NAME}" adtcore:type="DSFD/SCF"
  adtcore:masterLanguage="{lang}"
  adtcore:masterSystem="{sys}" adtcore:responsible="{user}">
  <adtcore:packageRef adtcore:name="{PACKAGE}"/>
</blue:blueSource>
```

`masterSystem` / `responsible` are emitted only when present (same conditional rendering as
`view`/`serviceDefinition` create). `description` is limited to 60 chars via `limitDescription`.

**XML escaping (improvement over existing modules):** all attribute values interpolated into the
envelope (`description`, `name`, `package`, `masterSystem`, `responsible`) must be XML-escaped
(`& < > " '`). The existing `view`/`serviceDefinition` create functions do NOT escape — that is a
latent bug; we do not replicate it. A small local `escapeXmlAttr()` helper (or a shared util if one
already exists) is used and unit-tested.

### Initial scalar-function source — NOT sent by `create()`

`create()` performs the metadata POST only (see "create() semantics" below). The
`define scalar function ... returns return_type` block the user saw in the trace is the **default
template the server generates** after create — the client never sends it. We deliberately do not
auto-seed any placeholder source, because the placeholder types (`parameter1_type`, `return_type`)
do not compile and would fail `check`/`activate`. Real source is supplied later by the consumer via
`update()`.

## Module layout — `src/core/scalarFunction/`

Mirror of `serviceDefinition`, file-for-file:

- `AdtScalarFunction.ts` — `IAdtObject` handler, `objectType = 'ScalarFunction'`, operation chains
  copied from `AdtServiceDefinition` (create / read / readMetadata / readTransport / update /
  delete / activate / check / lock / unlock).
- `types.ts` — `ICreateScalarFunctionParams`, `IUpdateScalarFunctionParams`,
  `IDeleteScalarFunctionParams` (snake_case low-level), `IScalarFunctionConfig` (camelCase:
  `scalarFunctionName`, `packageName`, `description`, `transportRequest`, `sourceCode`,
  `masterLanguage`), `IScalarFunctionState extends IAdtObjectState` (adds optional
  `validationSupported?: boolean` for the narrow validation-fallback contract).
- `create.ts` — builds the (escaped) blues envelope above; POST with blues Content-Type.
  Low-level `create()` is metadata-only (mirrors `serviceDefinition/create.ts`, which POSTs the
  envelope and ignores any source). See "create() semantics".
- `read.ts` — `getScalarFunction` (metadata), `getScalarFunctionSource`,
  `getScalarFunctionTransport`; URLs built directly, Accept negotiation via
  `makeAdtRequestWithAcceptNegotiation`.
- `update.ts` — PUT `/source/main?lockHandle=...&corrNr=...`, `Content-Type: text/plain; charset=utf-8`.
- `delete.ts` — `checkDeletion` + `deleteScalarFunction` (deletion-check POST + deletion POST),
  per srvd. **Lowercase fix:** both build the object URI from the **lower-cased**, encoded name
  (`encodeSapObjectName(name.toLowerCase())`). `serviceDefinition/delete.ts` does NOT lowercase —
  we do, to keep the wire contract consistent with create/update/read (trace used `zok_test_func`).
  Unit tests assert the lowercased `adtcore:uri` in **both** the deletion-check and the deletion
  request XML payloads.
- `lock.ts` / `unlock.ts` — generic ADT lock/unlock against the source URL, per srvd.
- `check.ts` — check messages against active/inactive version, per srvd.
- `activation.ts` — activate via the generic activation endpoint, per srvd.
- `validation.ts` — name validation. **Open item:** the exact validation endpoint/dataname for
  DSFD is unconfirmed; implement by analogy and confirm against the system in the test phase.
  **Fallback is narrow, not "swallow everything":** only HTTP **404 / 405 / 501** (endpoint not
  present / method not allowed / not implemented) are treated as "validation unsupported" — in that
  case `validate()` returns a state with `validationSupported: false` and does NOT throw, so it
  never blocks create. **All other failures propagate**: 401/403 (auth), timeouts, and 5xx server
  errors are real and must surface as thrown errors, never be masked as "unsupported".
- `index.ts` — `export { AdtScalarFunction }`, `export * from './types'`, and an
  `AdtScalarFunctionType` alias.

## create() semantics (explicit)

`AdtScalarFunction.create(config)`:
1. Validates required fields (`scalarFunctionName`, `packageName`, `description`).
2. POSTs the metadata envelope only. **No source is uploaded and no lock/update/unlock/activate
   happens during create** — this exactly matches `AdtServiceDefinition.create()`.
3. Returns `state.createResult`. The object now exists (inactive) carrying the server's default
   template source.

To give the function real source the consumer calls `update(config, { sourceCode, activateOnUpdate })`
afterwards, which runs the full lock → check → PUT `/source/main` → unlock → check → activate chain.
Source code passed to `create()` — via **either** `config.sourceCode` **or**
`options.sourceCode` — is therefore a documented no-op for `create()` (kept for parity /
convenience of a later `update`). Both paths are asserted by a unit test so the no-op is intentional
and visible, not a silent surprise.

## Integration points

1. **checkRun object-type mapping (REQUIRED, in scope)** — `check()` routes through
   `runCheckRun(connection, 'scalar_function', ...)` → `getObjectUri()` in
   `src/utils/checkRun.ts`, whose `switch` currently throws `Unsupported object type` for anything
   unlisted. Add a case:
   ```ts
   case 'scalar_function':
   case 'dsfd/scf':
     return `/sap/bc/adt/ddic/dsfd/sources/${encodedName}`;
   ```
   Without this, `check()` (and the update chain's inactive-check step) throws. This is a single,
   targeted addition — distinct from the broader object-type maps in point 5.
2. **Content type** — add to `src/constants/contentTypes.ts`:
   `CT_SCALAR_FUNCTION = 'application/vnd.sap.adt.blues.v1+xml'` and
   `ACCEPT_SCALAR_FUNCTION = 'application/vnd.sap.adt.blues.v1+xml'`
   (reuse the existing blues media type; new named constants for clarity/discoverability).
3. **AdtClient** — add `getScalarFunction(): IAdtObject<IScalarFunctionConfig,
   IScalarFunctionState>` returning `new AdtScalarFunction(connection, logger, systemContext)`,
   placed next to `getServiceDefinition()`.
4. **Public API** (`src/index.ts`) — export `AdtScalarFunction`, `AdtScalarFunctionType`,
   `IScalarFunctionConfig`, `IScalarFunctionState` (plus the low-level param types if the existing
   convention exports them).
5. **Broader object-type maps** (`AdtUtils` / `whereUsed` / `typeInfo`) — **out of scope** for v1.
   `serviceDefinition` does not register there either; where-used/search by this type can be added
   later if needed. Noted explicitly so the omission is intentional, not accidental. (Distinct from
   the checkRun mapping in point 1, which IS in scope and required.)

## Testing

### Unit tests (REQUIRED — do not depend on a live system)

The wire-shaping logic must be verified offline so an unsupported test system cannot leave the bulk
of the implementation unchecked. Under `src/__tests__/unit/scalarFunction/` (pure functions + a
mock `IAbapConnection`):

- **create envelope** — exact `blue:blueSource` string: namespace, `adtcore:type="DSFD/SCF"`,
  conditional `masterSystem`/`responsible`, `packageRef`, 60-char description limit.
- **XML escaping** — `description`/`name`/`package` containing `& < > " '` are escaped correctly.
- **URL building** — name lower-cased and `encodeSapObjectName`-encoded; `?corrNr=` appended only
  when a transport is present; update URL carries `lockHandle` (+ optional `corrNr`); source/meta
  read `version` query.
- **headers (per operation, do not conflate)** —
  - create: `Content-Type: application/vnd.sap.adt.blues.v1+xml`;
  - update (PUT `/source/main`): `Content-Type: text/plain; charset=utf-8`;
  - read source (GET `/source/main`): `Accept: text/plain` (i.e. `ACCEPT_SOURCE`, **no** charset);
  - read metadata: `Accept: application/vnd.sap.adt.blues.v1+xml`.
- **checkRun URI** — `getObjectUri('scalar_function', 'ZOK')` and `getObjectUri('dsfd/scf', ...)`
  both return `/sap/bc/adt/ddic/dsfd/sources/zok` (and no longer throw).
- **handler chains via mock connection** — update-chain failure forces unlock and
  `setSessionType('stateless')`; `read()` returns `undefined` on 404; `create()` does NOT call
  lock/update (source no-op assertion); `validate()` 404/405/501 → `validationSupported: false`,
  while 403/timeout/500 re-throw.

### Integration test (live system, gated)

Under `src/__tests__/integration/core/scalarFunction/`, mirroring the `serviceDefinition`
integration test: create → read → update (source) → activate → delete, idempotent
(delete-if-exists before create). Add a `scalar_function` entry to
`src/__tests__/helpers/test-config.yaml.template` (name + package), `available_in` gated — DSFD is
newer, likely cloud / modern on-prem only.

**Skip mechanism (single, non-contradictory contract).** `available_in` is a static hint and does
NOT prove the system actually supports DSFD. A metadata/source GET is **not** a valid probe — a
non-existent object returns 404 even on a DSFD-capable system, which would falsely skip the suite.

The probe has exactly **one decision rule** (discovery is only a positive fast-path, never a skip
trigger, because `fetchDiscoveryEndpoints()` swallows errors and returns an empty `Set`, making
"discovery unavailable" indistinguishable from "endpoint absent"):

- **Endpoint found in discovery** (`isEndpointInDiscovery(endpoints, '/sap/bc/adt/ddic/dsfd/sources')`
  is `true`) → **supported**, run the full suite.
- **Endpoint not found, OR discovery set empty/unavailable** → **inconclusive**, do NOT skip yet;
  fall through to the real `create` and let its status decide.
- **`create` returns 404 / 405 / 501** → DSFD unsupported on this system → **skip** (logged per the
  project's skip-logging convention).
- **Any other status from `create`** (success, or 401/403/timeout/5xx) → **not a skip**: success
  proceeds; 401/403/timeouts/5xx are real failures and must surface, never be masked as
  "unsupported".

This mirrors the validation-fallback status policy (404/405/501 = unsupported; everything else is
real) so the two are consistent.

During the integration phase, confirm against the live system:
- create POST `Content-Type` (blues v1) is accepted;
- `validation.ts` endpoint shape and which status codes it actually returns when unsupported;
- that `create()` alone (no source) succeeds and yields the server default template.

## Error handling

Based on `serviceDefinition`, with one **deliberate hardening** over the copied code:

- **Guaranteed session reset.** `serviceDefinition`'s cleanup resets `setSessionType('stateless')`
  only *after* a successful cleanup-unlock; if the cleanup-unlock itself throws (its inner
  `try/catch` only warns), the session is left `stateful`. The same gap exists in its public
  `unlock()` (throws before the reset). For scalar function we close both: the cleanup-unlock and
  the public `unlock()` put `setSessionType('stateless')` in a **`finally`** so the session is
  always reset regardless of unlock outcome. A unit test asserts: unlock throws → session still
  ends `stateless`.
- `read()` returns `undefined` on 404; on the update chain, force unlock (lockHandle preserved for
  cleanup) before the finally-reset; optional `deleteOnFailure` / `activateOnUpdate` honored via
  `IAdtOperationOptions`.
- **`corrNr` is always `encodeURIComponent`-encoded** on create and update URLs (the existing
  `serviceDefinition` create interpolates it raw — we do not replicate that).

## Out of scope (YAGNI)

- where-used / search / package-hierarchy registration for the new type;
- batch-client wiring (can follow the same mechanical pattern later if requested);
- any DSFD subtype other than `SCF` (scalar function).
