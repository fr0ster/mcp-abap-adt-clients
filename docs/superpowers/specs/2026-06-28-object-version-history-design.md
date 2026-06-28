# Object Version History — Design Spec

> Status: **design approved in brainstorm; pending spec review → plan.**
> Spans `@mcp-abap-adt/interfaces` (contract) + `@mcp-abap-adt/adt-clients`
> (all `IAdtObject` implementations). The MCP-server consumer (`mcp-abap-adt`)
> is **out of scope** — it adapts on its own update. Each step is externally
> reviewed before proceeding.

## Goal

Expose SAP object **version history** (version management) as a first-class
read capability on the ADT object contract: list the versions of an object's
source and fetch the source of a specific version.

## Architecture principles (from brainstorm)

1. **Each `IAdtObject` implementation is the single point of responsibility for
   its own endpoints.** Every `AdtXxx` class builds its own version URIs. There
   is no central per-type URI switch.
2. **Endpoints are fully encapsulated in adt-clients.** Outward (to the
   consumer) only **our interface** and **our typed errors** are exposed — never
   raw `IAdtResponse`/axios objects or raw HTTP status codes.
3. **Try, don't pre-classify.** No hardcoded "this type supports versions"
   table. An implementation builds its URI and performs the GET; SAP decides.
4. **Translate, don't leak.** A "no version resource" answer from SAP (404/406)
   is translated by the implementation into a typed `UnsupportedOperation`
   error from the interface package — not propagated as a raw HTTP error.

## Findings (empirically confirmed on trial, 2026-06-28)

ADT exposes version history as a **conventional sub-resource** of the source
URI. It is **NOT in the ADT discovery document** (raw discovery for
trial/e19/e77 has no `/versions` template; `version` appears only as a query
param). Derived per object type; verified by live probe, not docs.

### Version list — `Accept: application/atom+xml;type=feed`

| Object kind | Version-list URI |
|---|---|
| Table / DDIC source | `/sap/bc/adt/ddic/tables/{name}/source/main/versions` |
| Class — main source | `/sap/bc/adt/oo/classes/{name}/includes/main/versions` |
| Class — local includes | `/sap/bc/adt/oo/classes/{name}/includes/{definitions\|implementations\|testclasses}/versions` (CCDEF / CCIMP / CCAU) |

Class via `…/source/main/versions` → 404 (classes are per-include). Response is
an Atom feed:

```xml
<atom:feed>
  <atom:title>Version List of ZAC_SHR_BTABL (TABL)</atom:title>
  <atom:entry>
    <atom:author><atom:name>CB9980008038</atom:name></atom:author>
    <atom:content type="text/plain"
      src="/sap/bc/adt/ddic/tables/zac_shr_btabl/source/main/versions/19700101101123/00000/content"/>
    <atom:id>00000</atom:id>
    <atom:updated>2026-06-14T16:25:57Z</atom:updated>
  </atom:entry>
</atom:feed>
```

### Version source — `GET <content@src>` with `Accept: text/plain` → 200

Returns that version's source code (confirmed against `ZAC_SHR_DMP01`).

### Coverage caveat

Only **table** and **class (all includes)** are probe-verified. Function module,
program, interface, DDL/CDS, and others are **unverified** — each must be
probe-checked during implementation (idea 3 above means an unverified type will
simply surface `UnsupportedOperation` if its guessed URI 404s).

## Interface contract (`@mcp-abap-adt/interfaces`)

New on the base `IAdtObject<Config, State>`:

```ts
export interface IObjectVersion {
  /** Version number, e.g. '00000'. */
  versionId: string;
  /** atom:author/name — the user who created the version (optional). */
  author?: string;
  /** atom:updated — ISO timestamp (optional). */
  updatedAt?: string;
  /** atom:title — e.g. 'Version List of X (TABL)' (optional). */
  title?: string;
  /** atom:content@src — opaque URI to fetch this version's source. */
  contentUri: string;
}

interface IAdtObject<TConfig, TReadResult> {
  // …existing members…

  /**
   * List the version history of this object's source. Identity is passed per
   * call, like every other IAdtObject method (the implementations are stateless
   * factories) — e.g. `getVersions({ className: 'ZCL_X' })`.
   * @throws AdtOperationError with code UNSUPPORTED_OPERATION when the object
   *         has no version resource (SAP 404/406, or a non-source object type).
   *         Never leaks raw HTTP.
   */
  getVersions(config: Partial<TConfig>): Promise<IObjectVersion[]>;

  /**
   * Fetch the source code of a specific version.
   * @param contentUri the opaque `contentUri` from a getVersions() entry. It is
   *        a complete URI, so no config is needed.
   */
  getVersionSource(contentUri: string): Promise<string>;
}
```

> **Identity per call.** `IAdtObject<TConfig, TReadResult>` is a stateless
> factory — every method takes `config: Partial<TConfig>` (`read(config, …)`,
> `lock(config)`, …). `getVersions` follows that shape; `getVersionSource` does
> not, because its `contentUri` already encodes the full path.

A new error code is added to the interface package's error set
(`AdtObjectErrorCodes`), e.g. `UNSUPPORTED_OPERATION`, so the consumer can catch
"this object isn't versioned" in interface terms.

## Implementation (`@mcp-abap-adt/adt-clients`)

- **Every `AdtXxx` in `src/core/*` implements `getVersions()` / `getVersionSource()`.**
  Two implementation patterns:

  **(a) Source-bearing types** build their own version-list URI and GET it:
  - `AdtTable` → `/ddic/tables/{name}/source/main/versions`
  - `AdtClass` (main) → `/oo/classes/{name}/includes/main/versions`
  - class local-include handlers (returned by `getLocalTypes()` /
    `getLocalDefinitions()` / `getLocalTestClass()` / `getLocalMacros()`) →
    their own `/oo/classes/{name}/includes/{includeType}/versions`
  - every other source-bearing type → `<sourceUri>/versions` is a **candidate
    shape that MUST be probe-verified per type before the type is marked
    supported** (only table + class are verified so far — see Coverage caveat).

  **(b) Non-source / pseudo objects** (`AdtPackage` (DEVC), `AdtTransport`,
  unit-test, and any test-only `IAdtObject` implementation) have no source URI,
  so they do NOT build one. They use an explicit shared helper
  `throwUnsupportedVersions(): never` (zero endpoint knowledge — it only throws
  `AdtOperationError(UNSUPPORTED_OPERATION)`), satisfying the contract without a
  pointless HTTP call. `getVersionSource` does the same.

- **GET semantics (pattern a):** `Accept: application/atom+xml;type=feed` for the
  list, `Accept: text/plain` for `getVersionSource`.
- **Error translation (pattern a):** BOTH the list GET and the content GET wrap
  every failure so nothing raw leaks. 404/406 "no suitable resource" →
  `AdtOperationError(code = UNSUPPORTED_OPERATION)`. Any other failure →
  `AdtOperationError` carrying `.status` and `.originalError` (no `code`
  required) — never a raw `IAdtResponse`/axios object outward.
- **Shared, zero endpoint knowledge:** three pure helpers in
  `src/core/shared/versions.ts` — `parseVersionsFeed(xml): IObjectVersion[]`
  (Atom feed → list; one/many/zero `atom:entry`), `throwUnsupportedVersions():
  never`, and `throwVersionsError(error, detail): never` (the shared translator:
  404/406 → unsupported, else wrap in `AdtOperationError`). They have no endpoint
  knowledge; URI construction and the GET stay in each `AdtXxx`, which call
  `throwVersionsError` from their catch.

## Cross-package sequencing (each step externally reviewed)

1. **interfaces — MAJOR (breaking):** add `IObjectVersion`, the two methods on
   `IAdtObject`, and the `UNSUPPORTED_OPERATION` error code. Adding **required**
   methods to an exported interface is source-breaking for every implementer
   (all `AdtXxx`, plus any consumer/test mocks of `IAdtObject`), so this is a
   major bump — not minor. (Making the methods optional was rejected: the design
   requires every implementation to provide them.) Publish.
2. **adt-clients — MAJOR:** bump interfaces dep; add `parseVersionsFeed` and
   `throwUnsupportedVersions` (SAP-free unit tests); implement the two methods on
   **all** `AdtXxx` (pattern a for source types, pattern b for non-source);
   per-type integration probe on trial to verify each source-type URI shape
   before marking it supported. This is breaking too (interface dep major); it
   can ride the modularization major
   ([[2026-06-27-adt-clients-modularization]]) if they land together.
3. The consumer is untouched; it picks up the new methods on its own update.

## Testing strategy

- **Unit (SAP-free):** `parseVersionsFeed` against a captured Atom fixture
  (single entry, multiple entries, empty feed); error-translation for a
  source-type `AdtXxx` with a fake connection returning 404/406 → asserts
  `UNSUPPORTED_OPERATION`; a non-source `AdtXxx` (e.g. `AdtPackage`) →
  `getVersions(config)` throws `UNSUPPORTED_OPERATION` with **no** HTTP call.
- **Integration (trial, browser profile required):** for each verified type,
  `getVersions(config)` returns a non-empty list with a usable `contentUri`, and
  `getVersionSource(contentUri)` returns source text. Probe each candidate
  source type to confirm its URI shape **before** marking it supported.

## Out of scope

- Writing/restoring/reverting versions (read-only here).
- Any consumer (`mcp-abap-adt`) changes.
- A version-diff API (consumers can diff two `getVersionSource` results).
- Object types whose version URI is not yet probe-verified are not "supported"
  by claim — they will simply surface `UNSUPPORTED_OPERATION` until verified.

## Lesson recorded

"Not in discovery" ≠ "endpoint does not exist". An earlier conclusion that ADT
had no versions endpoint was wrong — it came from probing one standard class
with the wrong `Accept` and over-generalizing. Verify empirically per type.
