# Dead / misleading API-surface cleanup (7.4.3)

## Problem

Two dead / misleading API surfaces claim capabilities the code never delivers
(one is internal, one — `ICreateEnhancementParams` — is publicly exported):

1. **`source_code` in `ICreateXxxParams`** — declared in **5** modules'
   *create* params (accessControl, enhancement, functionInclude, scalarFunction,
   serviceDefinition), never read by any `create.ts`. (A coarse grep for
   `source_code` matches 9 files, but in the other 4 — appendStructure,
   interface, scalarFunctionImplementation, transformation — the field lives on
   the *update* params, which are live and out of scope.) In three of the five
   (accessControl, serviceDefinition, functionInclude) the high-level `create()`
   also populates it on the low-level call — a dead pass-through (see Scope for
   the exact per-module breakdown). By design `create()` posts metadata only —
   the source is
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

- **`source_code`: two distinct removals — the type field, and the dead
  `create()` pass-through — which do NOT cover the same modules.** Verified
  against current code (see table). The low-level `create.ts` of all five ignores
  the snake_case `source_code` field (metadata-only POST). `program` is out of
  scope — it genuinely uploads source, reading the camelCase `sourceCode` config,
  not this dead `source_code` param.

  **(a) Type field `source_code` in `ICreateXxxParams` — 5 modules.** Four are
  internal (absent from the built `dist/index*.d.ts`): accessControl,
  functionInclude, scalarFunction, serviceDefinition → field deleted. The fifth,
  **`ICreateEnhancementParams`, is publicly exported** (`src/index.core.ts:80` →
  root `src/index.ts:25` → present in `dist/index.core.d.ts`), so deleting
  `source_code?: string` (`enhancement/types.ts:46`) would break TS consumers.
  It is **kept and marked `@deprecated`** ("no-op — `create()` posts metadata
  only; source is written by `update()`"). The four modules whose `source_code`
  lives only on their *update* params (appendStructure, interface,
  scalarFunctionImplementation, transformation) are NOT touched — those fields
  are live.

  **(b) Dead `create()` pass-through — exactly 3 modules.** Only these set the
  field on the low-level create call: `accessControl` and `serviceDefinition`
  (direct `source_code: options?.sourceCode || config.sourceCode`), and
  `functionInclude` (via `buildCreateParams`,
  `AdtFunctionInclude.ts:118 → source_code: config.sourceCode`). Removing the
  type field forces removing these three lines (they would otherwise not
  compile). accessControl, serviceDefinition and functionInclude are all in the
  five-module set (a); scalarFunction and enhancement declare the dead field but
  never pass it in `create()`.

  | module | create params declare `source_code` | type field (a) | create() pass-through (b) |
  |---|---|---|---|
  | accessControl | yes (internal) | remove | remove (direct) |
  | serviceDefinition | yes (internal) | remove | remove (direct) |
  | functionInclude | yes (internal) | remove | remove (`buildCreateParams:118`) |
  | scalarFunction | yes (internal) | remove | — none |
  | enhancement | yes (**public**) | **deprecate, keep** | — none |

  **Do NOT touch:** `functionInclude`'s real source upload — its `create()`
  genuinely uploads source via `uploadFunctionIncludeSource` (like `program`),
  reading `options?.sourceCode || config.sourceCode`; only the dead
  `buildCreateParams` field-set is removed. `enhancement/types.ts` also declares
  `source_code` on the *update* params (`:55`, required) — live, untouched.
  `program` is entirely out of scope.

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
- No public API break: the 4 internal `ICreateXxxParams` are not exported; the
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
  and omitting it is valid). **The test MUST import `ICreateEnhancementParams`
  from the published barrel (`src/index` or `src/index.core`), not from
  `src/core/enhancement/types`** — otherwise it guards the internal type while the
  public barrel export could still break. This pins the compatibility decision so
  an accidental future removal (of the field or its re-export) fails a test, not
  just a downstream consumer's build. (`@deprecated` is a doc annotation and is
  not itself type-checkable; the test guards the field's continued existence.)
- **`withLongPolling`:** a wire-level unit test asserts `readFeatureToggle` never
  appends `withLongPolling` to the request, documenting the deliberate choice
  not to send an unverified parameter.
- All tests run offline via `MCP_ENV_PATH=/tmp/nonexistent-env` (skips the SAP
  preflight in globalSetup).
- Full unit suite + `build:fast` + `lint:check` green before commit.

## Risk

Low. The 4 internal `source_code` removals are compile-checked across the tree;
those types are not part of the published surface, so no external consumer is
affected. The one public type (`ICreateEnhancementParams`) keeps its field, so no
external TS build breaks. featureToggle keeps its public signature per interface,
so no caller of the handler is affected. Net published-API delta: one field newly
annotated `@deprecated`.
