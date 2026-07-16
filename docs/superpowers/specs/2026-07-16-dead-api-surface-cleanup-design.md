# Dead / misleading API-surface cleanup (7.4.3)

## Problem

Two internal API surfaces claim capabilities the code never delivers:

1. **`source_code` in `ICreateXxxParams`** — declared in 9 modules
   (accessControl, appendStructure, enhancement, functionInclude, interface,
   scalarFunctionImplementation, scalarFunction, serviceDefinition,
   transformation), never read by any `create.ts`. In 8 of them the high-level
   `create()` even populates it (`source_code: options?.sourceCode || …`), a
   dead pass-through. By design `create()` posts metadata only — the source is
   written by a later `update()`, mirroring Eclipse ADT (verified live for SRVD
   in 7.4.1). The field is a no-op that misleads callers into thinking `create()`
   uploads source.

2. **`withLongPolling` in featureToggle's read path** — `readFeatureToggle`
   accepts `_options?: IReadOptions` (a featureToggle-local duplicate of the
   shared type) but ignores it, so `withLongPolling` is never appended to the
   request. Every other module wires it into the URL; featureToggle silently
   drops it.

Both were deferred from the 7.4.1/7.4.2 readiness-read work.

## Scope decisions

- **`source_code`: remove the dead pass-through everywhere; remove the field
  from the 8 internal types, deprecate it on the 1 public type.**

  Of the 9 `ICreateXxxParams`, eight are internal (not exported from
  `src/index.ts` — confirmed absent from the built `dist/index*.d.ts`):
  accessControl, appendStructure, functionInclude, interface,
  scalarFunctionImplementation, scalarFunction, serviceDefinition,
  transformation. The field is deleted from all eight.

  The ninth, **`ICreateEnhancementParams`, is publicly exported**
  (`src/index.core.ts:80` → root `src/index.ts:25` → present in
  `dist/index.core.d.ts`). Deleting `source_code?: string` there
  (`src/core/enhancement/types.ts:46`) would be a source-level break for TS
  consumers referencing the field. To keep the release non-breaking, the public
  field is **kept and marked `@deprecated`** ("no-op — `create()` posts metadata
  only; source is written by `update()`"), while its dead runtime pass-through in
  `AdtEnhancement.create()` is removed like the others.

  Note: `enhancement/types.ts` also declares `source_code` on the *update* params
  (`:55`, required) — that one is live (enhancement update writes source) and is
  NOT touched. Only the create-params field is deprecated.

  In all 9 modules the dead pass-through in the high-level `create()` (8 of them
  set `source_code:` on the low-level call; `interface` does not) is removed.
  `program` is untouched — it is the only module that genuinely uploads source
  (as a separate step inside its create flow).

- **`withLongPolling`: remove the dead plumbing only.** The published
  `IAdtObject` interface (`@mcp-abap-adt/interfaces`,
  `IAdtObject.d.ts:169-187`) **mandates** that `read()` and `readMetadata()`
  accept `options.withLongPolling`. `AdtFeatureToggle implements IAdtObject`, so
  its public `read()`/`readMetadata()` signatures MUST keep the option — removing
  them would break the published contract. Therefore:
  - Remove the unused `_options?: IReadOptions` parameter from
    `readFeatureToggle` and the featureToggle-local duplicate `IReadOptions`.
  - Keep `withLongPolling` on the public `read()`/`readMetadata()` (interface).
  - Add a doc comment: feature-toggle readiness is a plain GET; long polling is
    not sent because the SFW endpoint's support could not be verified from the
    cloud trial (SFW is on-prem). Wiring it is left to a future on-prem probe.
  - Drop the internal threading of `withLongPolling` in featureToggle's own
    readiness reads where it went nowhere.

## Non-goals

- The shared `IReadOptions` (`src/core/shared/types.ts`) is untouched — its
  `withLongPolling` is honored by the 15 source-bearing handlers.
- `program` create is untouched.
- No public API break: the 8 internal `ICreateXxxParams` are not exported; the
  public `ICreateEnhancementParams` keeps its `source_code` field (deprecated,
  not removed); the featureToggle public signatures stay per interface.

## Versioning

No published-API break — the one public field (`ICreateEnhancementParams.
source_code`) is preserved as `@deprecated`, everything else removed is internal.
→ **patch bump 7.4.3**, one PR.

## Testing

- **`source_code` removal (internal 8):** the TypeScript build is the primary
  proof — no handler references the removed field. A unit test asserts a
  representative `create()` (e.g. serviceDefinition) issues a metadata-only POST
  with no source in the body.
- **Public API-surface guard (enhancement):** a type-level unit test asserts the
  intended public surface is preserved — `ICreateEnhancementParams` still carries
  an optional `source_code` field (compile-time: a value of the type may set it,
  and omitting it is valid). This pins the compatibility decision so an
  accidental future removal fails a test, not just a downstream consumer's build.
  (`@deprecated` is a doc annotation and is not itself type-checkable; the test
  guards the field's continued existence.)
- **`withLongPolling`:** a wire-level unit test asserts `readFeatureToggle` never
  appends `withLongPolling` to the request, documenting the deliberate choice
  not to send an unverified parameter.
- All tests run offline via `MCP_ENV_PATH=/tmp/nonexistent-env` (skips the SAP
  preflight in globalSetup).
- Full unit suite + `build:fast` + `lint:check` green before commit.

## Risk

Low. The 8 internal `source_code` removals are compile-checked across the tree;
those types are not part of the published surface, so no external consumer is
affected. The one public type (`ICreateEnhancementParams`) keeps its field, so no
external TS build breaks. featureToggle keeps its public signature per interface,
so no caller of the handler is affected. Net published-API delta: one field newly
annotated `@deprecated`.
