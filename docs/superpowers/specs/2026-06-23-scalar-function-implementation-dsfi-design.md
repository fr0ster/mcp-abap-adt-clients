# Design: Scalar Function Implementation (DSFI/SFI) client

**Date:** 2026-06-23
**Status:** Approved
**Object type:** Scalar function implementation — ADT type `DSFI/SFI`, endpoint base
`/sap/bc/adt/ddic/dsfi`. The implementation half of a CDS scalar function: a `DSFD/SCF`
definition (signature) is implemented by a `DSFI/SFI` object bound to it via a server-driven
content property (`engineValue` = `sqlEngine` or `amdpEngine`).

## Goal

Add a full CRUD + lifecycle client for **scalar function implementations**, exposed as
`AdtClient.getScalarFunctionImplementation()` returning
`IAdtObject<IScalarFunctionImplementationConfig, IScalarFunctionImplementationState>`.

This completes the scalar-function feature: the existing `ScalarFunction` client (DSFD/SCF, PR #48)
creates only the **signature**, which cannot activate on its own — it requires a companion DSFI
implementation. Both are independent per-type CRUD handlers; **the consumer orchestrates** creating
the pair and activating them together (via the existing `AdtClient.getUtils().activateObjectsGroup`).
The AMDP route's ABAP class (for `engineValue=amdpEngine`) is created via the existing
`getClass()` — out of scope here.

**Group activation needs object-URI cases.** `activateObjectsGroup` resolves each object's URI via
`buildObjectUri` in `src/utils/activationUtils.ts` — a switch **separate** from
`checkRun.getObjectUri`. It currently has no case for `DSFI/SFI` **nor `DSFD/SCF`** (the latter is a
latent gap from PR #48), so group-activating the pair would produce wrong fallback URIs. This spec
adds **both** cases to `buildObjectUri` so the consumer's `activateObjectsGroup([DSFD, DSFI])` works.

## Dependency on PR #48

This builds on `feat/dsfd-and-append-structure` (PR #48): it reuses `escapeXmlAttr`
(`src/utils/xml.ts`) and the `getObjectUri` switch in `src/utils/checkRun.ts`. Branch this work off
that branch (or off `main` after #48 merges).

## Wire contract

`create` is captured from a live TRL system (ADT 3.60). Source/main, lock, and read follow the
established source-based pattern (`serviceDefinition`/`scalarFunction`) and are confirmed live by the
integration suite on trial (same approach that validated DSFD/append). **Activation is NOT confirmed
live here:** the client exposes a single-object `activate()` (built by analogy, covered by unit
tests), but the integration test does not activate the pair — pair/group activation is the
consumer's concern (out of scope), so no activated object is asserted.

Object name is lower-cased in URL paths; upper-cased in the create envelope (object identifiers).

| Step | Method / URL | Body / headers |
|---|---|---|
| **create** | `POST /sap/bc/adt/ddic/dsfi[?corrNr={tr}]` | blues v2 envelope (below); `Content-Type: application/vnd.sap.adt.blues.v2+xml`; `Accept: application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml` |
| **update source** | `PUT /sap/bc/adt/ddic/dsfi/{name}/source/main?lockHandle={h}[&corrNr={tr}]` | implementation source; `Content-Type: text/plain; charset=utf-8`; `Accept: text/plain` *(verify live)* |
| **read source** | `GET /sap/bc/adt/ddic/dsfi/{name}/source/main[?version={v}]` | `Accept: text/plain` *(verify live)* |
| **read metadata** | `GET /sap/bc/adt/ddic/dsfi/{name}[?version={v}]` | `Accept: application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml` *(verify live)* |
| **transport** | `GET /sap/bc/adt/ddic/dsfi/{name}/transport` | `Accept: application/vnd.sap.adt.transportorganizer.v1+xml` |
| **lock / unlock / check / activate / delete** | generic ADT patterns as in `scalarFunction` | as in `scalarFunction` |

### Create envelope (exact shape from trace)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="{description}" adtcore:language="{lang}"
  adtcore:name="{NAME}" adtcore:type="DSFI/SFI"
  adtcore:masterLanguage="{lang}"
  adtcore:masterSystem="{sys}" adtcore:responsible="{user}">
  <adtcore:packageRef adtcore:name="{PACKAGE}"/>
  <blue:additionalCreationProperties>
    <adtcore:content adtcore:encoding="base64"
      adtcore:type="application/vnd.sap.adt.serverdriven.content.v1+json">{BASE64}</adtcore:content>
  </blue:additionalCreationProperties>
</blue:blueSource>
```

`{BASE64}` = base64 of the **server-driven content JSON**, keys in this exact order:

```json
{"scalarFunctionName":"{SCALAR_FUNCTION_NAME}","engineValue":"{ENGINE}"}
```

- `scalarFunctionName` — the DSFD/SCF this DSFI implements (**required**), upper-cased.
- `engineValue` — `"sqlEngine"` (default; self-contained SQL source) or `"amdpEngine"` (links to an
  AMDP class created separately via `getClass()`).
- Built as `Buffer.from(JSON.stringify({ scalarFunctionName, engineValue }), 'utf-8').toString('base64')`.
- `name`/`package` upper-cased; `description`/`name`/`package`/`masterSystem`/`responsible` and the
  scalarFunctionName inside the JSON are XML/JSON-safe (envelope attrs via `escapeXmlAttr`; the JSON
  is base64-wrapped so needs no XML escaping). `description` limited to 60 chars via `limitDescription`.
- `masterSystem`/`responsible` emitted only when present (conditional, as elsewhere).

## Module layout — `src/core/scalarFunctionImplementation/`

Mirror of `src/core/scalarFunction/`, file-for-file:

- `AdtScalarFunctionImplementation.ts` — `IAdtObject` handler, `objectType =
  'ScalarFunctionImplementation'`. Same chain shape and hardening as `AdtScalarFunction`
  (create metadata-only; update lock→check→PUT→unlock(finally stateless)→check→optional activate,
  with the post-update/post-activate long-poll read; `read()` 404→undefined; narrow validation
  fallback 404/405/501).
- `types.ts` — `ICreateScalarFunctionImplementationParams` (snake_case incl. `scalar_function_name`,
  `engine_value`), `IUpdateScalarFunctionImplementationParams`,
  `IDeleteScalarFunctionImplementationParams`, `IScalarFunctionImplementationConfig` (camelCase:
  `implementationName`, `scalarFunctionName` (**required for create**),
  `engineValue?: 'sqlEngine' | 'amdpEngine'` (default `'sqlEngine'`), `packageName`, `description`,
  `transportRequest`, `sourceCode`, `masterLanguage`), `IScalarFunctionImplementationState extends
  IAdtObjectState { validationSupported?: boolean }`.
- `create.ts` — builds the (escaped, upper-cased) blues v2 envelope with the base64
  `additionalCreationProperties`; POST with the blues v2 Content-Type. Metadata-only (mirrors
  `scalarFunction/create.ts`). Includes a small `buildServerDrivenContent(scalarFunctionName,
  engineValue)` returning the base64 string.
- `read.ts` / `update.ts` / `lock.ts` / `unlock.ts` / `check.ts` / `activation.ts` /
  `validation.ts` / `delete.ts` — direct copies of the `scalarFunction` equivalents with base URL
  `/sap/bc/adt/ddic/dsfi`, `corrNr`/`lockHandle` `encodeURIComponent`-encoded, lower-cased delete
  URIs, `setSessionType('stateless')` in `finally`. `check.ts` uses
  `runCheckRun(conn, 'scalar_function_implementation', ...)`. `validation.ts` uses the concrete
  endpoint `POST /sap/bc/adt/ddic/dsfi/validation?objtype=dsfisfi&objname=...` (confirmed present in
  the system discovery document, category `dsfisfi/validation`); the 404/405/501 → `validationSupported:false`
  fallback remains only as a safety net, not as a substitute for the real contract. `activation.ts`
  builds the single-object activation XML
  against `/sap/bc/adt/ddic/dsfi/{name}` (group activation of the DSFD+DSFI pair is the consumer's
  job via `getUtils().activateObjectsGroup`).
- `index.ts` — `export { AdtScalarFunctionImplementation }`, `export * from './types'`,
  `AdtScalarFunctionImplementationType` alias.

## Integration points

1. **checkRun mapping (REQUIRED, in scope)** — add to `getObjectUri` in `src/utils/checkRun.ts`:
   ```ts
   case 'scalar_function_implementation':
   case 'dsfi/sfi':
     return `/sap/bc/adt/ddic/dsfi/${encodedName}`;
   ```
2. **Group-activation object-URI mapping (REQUIRED, in scope)** — add to `buildObjectUri` in
   `src/utils/activationUtils.ts` (the switch used by `activateObjectsGroup`), **both** types so the
   consumer can group-activate the pair:
   ```ts
   case 'DSFD/SCF':
     return `/sap/bc/adt/ddic/dsfd/sources/${lowerName}`;
   case 'DSFI/SFI':
     return `/sap/bc/adt/ddic/dsfi/${lowerName}`;
   ```
   (The `DSFD/SCF` case closes the PR #48 gap; without it `activateObjectsGroup` cannot activate a
   scalar function either.)
3. **Content types** — add to `src/constants/contentTypes.ts`:
   `CT_SCALAR_FUNCTION_IMPL = 'application/vnd.sap.adt.blues.v2+xml'` and
   `ACCEPT_SCALAR_FUNCTION_IMPL = 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml'`.
4. **AdtClient** — add `getScalarFunctionImplementation(): IAdtObject<...>` next to
   `getScalarFunction()`.
5. **Public API** (`src/index.ts`) — export `AdtScalarFunctionImplementation`,
   `AdtScalarFunctionImplementationType`, `IScalarFunctionImplementationConfig`,
   `IScalarFunctionImplementationState`.
6. **Broader object-type maps** (`AdtUtils`/`whereUsed`/`typeInfo`) — out of scope for v1.

## Testing

### Unit tests (REQUIRED — offline)

Under `src/__tests__/unit/core/scalarFunctionImplementation/`:
- **create envelope** — exact blues v2 string: `adtcore:type="DSFI/SFI"`, packageRef, the
  `additionalCreationProperties/adtcore:content` element with `encoding="base64"` and the correct
  media type; conditional `masterSystem`/`responsible`; 60-char description; name/package upper-cased.
- **server-driven content** — the base64 decodes to
  `{"scalarFunctionName":"...","engineValue":"sqlEngine"}` for the default and `"amdpEngine"` when
  set; key order is `scalarFunctionName` then `engineValue`; scalarFunctionName upper-cased.
- **XML escaping** — envelope attribute values escaped via `escapeXmlAttr`.
- **URL building** — lower-cased + `encodeSapObjectName`-encoded paths; `?corrNr=` only when present
  and `encodeURIComponent`-encoded; update URL carries encoded `lockHandle` (+ optional `corrNr`).
- **headers** — create `Content-Type: application/vnd.sap.adt.blues.v2+xml`; update `Content-Type:
  text/plain; charset=utf-8`; read source `Accept: text/plain`.
- **checkRun URI** — `getObjectUri('scalar_function_implementation'|'dsfi/sfi', 'ZOK')` →
  `/sap/bc/adt/ddic/dsfi/zok`.
- **group-activation URI** — `buildObjectUri('ZOK', 'DSFI/SFI')` → `/sap/bc/adt/ddic/dsfi/zok` and
  `buildObjectUri('ZOK', 'DSFD/SCF')` → `/sap/bc/adt/ddic/dsfd/sources/zok` (both new cases).
- **handler chains** — create requires `scalarFunctionName`; create is metadata-only (no
  lock/update, both `config`/`options` source paths); update happy-path issues PUT + long-poll
  read and ends `stateless`; unlock-throw still resets `stateless`; `read()` 404→undefined;
  `validate()` 404/405/501 → `validationSupported:false`, else rethrow.

### Integration test (live, gated)

Under `src/__tests__/integration/core/scalarFunctionImplementation/`, mirroring the `scalarFunction`
bootstrap + discovery-then-create skip gate (skip only on HTTP 404/405/501).

**Both source blocks are REQUIRED to run this suite, not optional.** The whole point is to confirm
the unverified PUT `/source/main` + lock/unlock/check contract live, so a missing source must **skip
the entire DSFI suite** (logged), never silently downgrade to a create/read-only flow that re-leaves
the gap unverified. The config carries **two distinctly-named keys** under
`create_scalar_function_implementation.params`:

- `scalar_function_source_code` — the DSFD **signature** source (for the companion scalar function);
- `source_code` — the DSFI **sqlEngine body** source (the implementation).

Exact valid syntax for both is determined live during implementation (the trial harness) and stored
in the real `src/__tests__/helpers/test-config.yaml`.

Because a DSFI references an existing DSFD with a coherent signature, the flow is:

1. `create` companion DSFD via `client.getScalarFunction()`, then **`update`** it with the configured
   **signature** source (inactive — no activate; a signature-only DSFD saves inactive). This gives
   the DSFI a real parameter interface to implement.
2. `create` the DSFI (`engineValue` defaults to `sqlEngine` — self-contained, no AMDP class).
3. **`update({ sourceCode })`** the DSFI — exercises PUT `/source/main`, lock/unlock, check, and the
   `text/plain; charset=utf-8` content type (live confirmation of those contracts).
4. **`read(..., 'inactive')`** the DSFI — exercises the source-read Accept (`/source/main`).
5. **`readMetadata({ implementationName })`** the DSFI — exercises the **metadata** endpoint
   `/sap/bc/adt/ddic/dsfi/{name}` + its blues v2 Accept (distinct from the source read above).
6. **clean up both** (delete DSFI then DSFD), with idempotent pre-cleanup.

Activation of the pair (group activation) stays **out of scope** for this test — it is the
consumer's concern — so the suite does not assert an active object. Add a
`create_scalar_function_implementation` entry to `src/__tests__/helpers/test-config.yaml.template`
(implementation name, `scalar_function_name`, package, `engine_value`, and the two distinct keys
`scalar_function_source_code` + `source_code`; with an inline note that the suite skips when either
source is absent).

This flow confirms live: create POST with the base64 `additionalCreationProperties`, PUT
`/source/main` URL + content type, lock/unlock, check, the source-read Accept **and** the metadata
Accept — closing the wire-contract gaps the unit tests cannot cover.

## Error handling

Identical to `scalarFunction`: guaranteed `finally` session reset on cleanup-unlock and public
`unlock()`; `read()` 404→undefined; `corrNr`/`lockHandle` always `encodeURIComponent`-encoded;
optional `deleteOnFailure`/`activateOnUpdate`.

## Out of scope (YAGNI)

- AMDP ABAP class creation (use `getClass()`); **orchestrating** the pair's group activation
  (the consumer calls `getUtils().activateObjectsGroup` — note the required `buildObjectUri` cases
  ARE in scope, integration point 2, so that call resolves correct URIs);
- shared-dependency fixtures / scalar-function activation test orchestration;
- where-used / search registration; batch-client wiring.
