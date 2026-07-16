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

- **`source_code`: remove entirely.** Delete the field from the 9
  `ICreateXxxParams` and remove the dead pass-through in the 8 `create()`
  handlers. `program` is untouched — it is the only module that genuinely
  uploads source (as a separate step inside its create flow).

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
- No public API signature changes: `ICreateXxxParams` are internal (not exported
  from `src/index.ts`); the featureToggle public signatures stay per interface.

## Versioning

Both changes are internal-only, no published-API break → **patch bump 7.4.3**,
one PR.

## Testing

- **`source_code` removal:** the TypeScript build is the primary proof — no
  handler references the removed field. A unit test asserts a representative
  `create()` (e.g. serviceDefinition) issues a metadata-only POST with no source
  in the body.
- **`withLongPolling`:** a wire-level unit test asserts `readFeatureToggle` never
  appends `withLongPolling` to the request, documenting the deliberate choice
  not to send an unverified parameter.
- All tests run offline via `MCP_ENV_PATH=/tmp/nonexistent-env` (skips the SAP
  preflight in globalSetup).
- Full unit suite + `build:fast` + `lint:check` green before commit.

## Risk

Low. `source_code` removal is compile-checked across the tree; anyone who was
setting it on an internal create-params object gets a TS error pointing at a
field that never did anything. featureToggle keeps its public signature, so no
caller of the handler is affected.
