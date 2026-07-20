# Type promotion to `@mcp-abap-adt/interfaces` — design

## Problem

Consumer-facing types are **duplicated** across two packages. For the ~28
existing ADT object types, adt-clients defines its low-level param interfaces
(`ICreate/Read/Update/DeleteXxxParams`) locally in `src/core/*/types.ts` and
uses those local copies; `@mcp-abap-adt/interfaces` **also** defines copies in
`src/adt/IAdtXxx.ts`. The two are hand-synced and **drift** — e.g.
`ICreateClassParams` has 12 fields in adt-clients vs 11 in interfaces;
`ICreateDomainParams` 16 vs 14; `ICreateTableParams` 7 vs 6. The `source_code`
drift shipped in production (adt-clients 7.4.3 vs interfaces 9.2.x) and had to be
fixed separately (interfaces 10.0.0 + adt-clients 7.4.4).

Additionally, the high-level `IXxxConfig` / `IXxxState` types (consumer-facing —
callers pass config, receive state) live **only** locally in adt-clients; they
are not in interfaces at all.

Per the standing rule (`feedback_types_constants_from_interfaces`): everything a
consumer touches belongs in `@mcp-abap-adt/interfaces`, imported by adt-clients.
This design consolidates the duplicated/consumer-facing types into interfaces as
the single source of truth.

## Scope

**In scope:** the ~28 existing object-type modules' consumer-facing types:
- Low-level param interfaces (`ICreate/Read/Update/DeleteXxxParams`) — 48 are
  duplicated in interfaces (stale); the rest are adt-clients-local only.
- `IXxxConfig` / `IXxxState` — local-only, promoted as new additions to
  interfaces.
- Per-module option / result types that a consumer passes or receives.

**Out of scope (explicit):** the ATC + synchronous-ABAP-Unit feature types
(interfaces PR #17, adt-clients PR #68, server PR #147). Those are being born and
placed by the user from the `mcp-abap-adt` side and are handled separately. This
plan does not touch them.

Also out of scope: subpath/split packaging and any runtime refactor — this is a
types-only consolidation.

## Approach — interfaces is canonical

1. **Reconcile drift, adt-clients is the source of truth.** adt-clients' local
   type shapes reflect what actually runs against SAP, so each interfaces copy is
   rewritten to be **structurally identical** to adt-clients' current shape —
   field names, optionality, and nested shapes all copied **verbatim**. The
   reconciliation compares full structure, not just field presence:
   - Add an **optional** field adt-clients has and interfaces lacks (e.g.
     `ICreateClassParams` 12 vs 11, where the extra field is `?:`) — additive,
     non-breaking.
   - Add a **required** field adt-clients has and interfaces lacks — this is
     **breaking** for these input param interfaces: a consumer that constructs the
     object must now supply the field, so it takes the major path (same as the
     incompatible changes below).
   - **Any incompatible change to an interfaces type is potentially breaking**,
     not only field removals: an optionality change (e.g.
     `IUpdateDomainParams.package_name` is `?: string` in interfaces but required
     `: string` in adt-clients), or a nested/structural difference (e.g.
     `IFixedValue` is `{ low; text }` in adt-clients but `{ low; high?;
     description? }` in interfaces) both change the exported type incompatibly.
   - Implementation does a **per-type structural diff** and flags every
     incompatible change. If any exist (removals, tightened optionality, changed
     nested shapes), the interfaces release takes the **major** path. Purely
     additive reconciliation stays minor.
   - Field **names are preserved verbatim from adt-clients** — do NOT normalize
     casing. adt-clients low-level params legitimately mix snake_case with
     camelCase (`masterSystem`, `masterLanguage` sit inside otherwise-snake_case
     `ICreateClassParams`/`ICreateDomainParams`/…); normalizing them would break
     the running client. Copy exactly what adt-clients has.

2. **Promote local-only types.** `IXxxConfig` / `IXxxState` and any local option/
   result types are added to interfaces (new, additive).

3. **adt-clients imports + re-exports — type declarations only.** adt-clients
   imports every promoted type from interfaces and re-exports it so its public API
   is unchanged (non-breaking for adt-clients consumers). This supersedes the
   older "no re-export" guidance for this migration — the re-export keeps existing
   `@mcp-abap-adt/adt-clients` imports working while making interfaces the single
   definition site.
   - **Only TYPE declarations move.** Many `src/core/*/types.ts` files also export
     **runtime values/functions** — e.g. `enhancement/types.ts` exports
     `ENHANCEMENT_TYPE_CODES`, `getEnhancementBaseUrl`, `getEnhancementUri`,
     `supportsSourceCode`, `isImplementationType`, `isSpotType`; `service/types.ts`
     exports `resolveBindingVariant`. Runtime refactor is out of scope: these stay
     in adt-clients (in `types.ts` or a deliberately-moved local module). Only the
     `interface`/`type` declarations are removed from `types.ts` and re-pointed at
     interfaces; a `types.ts` that mixes both keeps its runtime exports and loses
     only its type declarations (replaced by `export type { … } from
     '@mcp-abap-adt/interfaces'`).

## Release structure — two releases

Staging lives in **milestones (commits) inside two PRs**, not in separate
releases (minimizes the user's manual `npm publish` count to two).

- **Release A — interfaces** (one PR, one publish): reconcile/add all param
  types (M1), add all `Config`/`State` (M2), add option/result types (M3). Minor
  bump if the reconciliation is purely additive; **major** if the per-type
  structural diff turns up any incompatible change (field removal, tightened
  optionality, or changed nested shape — see Approach §1).
- **Release B — adt-clients** (one PR, after interfaces is published): bump the
  interfaces dep to the new version, then import + re-export + delete-local per
  category (M1 params, M2 config/state, M3 options/results, M4 index/re-export
  tidy). Patch/minor bump — non-breaking (re-export preserves the public API).

Ordering follows the publish-interfaces-first rule: interfaces merges → tags →
GitHub-release → **user publishes** → adt-clients realigns.

## Testing / verification

- **Build (`tsc`) is the primary proof** at every milestone: after a local type
  is deleted and imported from interfaces, a clean compile proves the interfaces
  type is shape-compatible and resolves. A failure pinpoints a residual drift to
  reconcile.
- Full unit suite offline via `MCP_ENV_PATH=/tmp/nonexistent-env npx jest
  src/__tests__/unit` — green after every milestone (currently 348/67).
- `npm run lint:check` exit 0.
- **Public-surface snapshot — defined precisely.** The published surface is the
  package `exports` entry points only: `.` (root `src/index.ts`), `./core`
  (`src/index.core.ts`), and `./runtime`, `./batch`, `./ws`, `./abapgit`,
  `./executors`. Deep paths like `./core/class` are NOT published, so the
  per-module barrels (`src/core/*/index.ts`, which do `export * from './types'`)
  matter only insofar as they feed `./core`. The invariant to hold: **the set of
  type names exported from each published entry point's built `dist/*.d.ts` is
  identical before and after** the migration. Capture it by enumerating exported
  type identifiers from the compiled `.d.ts` of each entry point (not from source
  greps, which miss `export *` fan-out). Because each module barrel keeps its
  `export * from './types'` and `types.ts` re-exports the promoted names from
  interfaces, the fan-out set is preserved by construction; the snapshot verifies
  it empirically.
- `package-lock.json` resolves interfaces from the npm registry (no
  `"link": true`) after the dep bump.

## Risks

- **Large diffs** across ≥28 modules — mitigated by per-category milestones with
  a green gate each, and by the mechanical nature (import-swap + delete).
- **Hidden breaking change** during drift reconciliation — not just removals but
  optionality changes and divergent nested shapes (e.g. `IFixedValue`) also break
  the interfaces type. Mitigated by a per-type **structural** diff (not field
  count) before editing each interfaces copy; any incompatible change is flagged
  and folds into a major interfaces bump.
- **Re-export drift** — if a promoted type is renamed, the re-export must keep the
  old name; the public-surface snapshot catches any accidental change.
- **Two-package ordering** — adt-clients work is blocked until interfaces is
  published; the plan sequences them and does not start Release B before the new
  interfaces version is on npm.
