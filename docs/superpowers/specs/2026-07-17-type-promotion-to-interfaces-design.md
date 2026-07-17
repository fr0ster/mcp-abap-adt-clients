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
   param shapes reflect what actually runs against SAP, so the interfaces copies
   are updated to match adt-clients' current shape.
   - A field present in adt-clients but missing in interfaces → **add** it to
     interfaces (non-breaking).
   - A field present in interfaces but absent from adt-clients → **removing** it
     from interfaces is a breaking type change. Each such case is flagged in the
     per-type diff during implementation; if any exist, they push the interfaces
     release to a major bump. (Interfaces copies are generally *behind*
     adt-clients, so most reconciliation is additions.)
   - Field **naming convention is preserved**: params stay snake_case (low-level);
     promoted `Config`/`State` stay camelCase (high-level).

2. **Promote local-only types.** `IXxxConfig` / `IXxxState` and any local option/
   result types are added to interfaces (new, additive).

3. **adt-clients imports + re-exports.** adt-clients imports every promoted type
   from interfaces, `export type`-re-exports the same names from its own index so
   its **public API is unchanged (non-breaking for adt-clients consumers)**, and
   deletes the local `./types` definitions. This supersedes the older
   "no re-export" guidance for this migration — the re-export keeps existing
   `@mcp-abap-adt/adt-clients` imports working while making interfaces the single
   definition site.

## Release structure — two releases

Staging lives in **milestones (commits) inside two PRs**, not in separate
releases (minimizes the user's manual `npm publish` count to two).

- **Release A — interfaces** (one PR, one publish): reconcile/add all param
  types (M1), add all `Config`/`State` (M2), add option/result types (M3). Minor
  bump if additions-only; major if any drift-removal is required (decided from
  the per-type diff).
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
- **Public-surface snapshot:** capture adt-clients' exported type names
  (`git grep`-style enumeration of `export type` from the index barrels) before
  and after — must be identical, proving the re-export kept the public API
  intact.
- `package-lock.json` resolves interfaces from the npm registry (no
  `"link": true`) after the dep bump.

## Risks

- **Large diffs** across ≥28 modules — mitigated by per-category milestones with
  a green gate each, and by the mechanical nature (import-swap + delete).
- **Hidden breaking removal** during drift reconciliation — mitigated by a
  per-type field diff before editing each interfaces copy; any interfaces-field
  removal is flagged and, if unavoidable, folds into a major interfaces bump.
- **Re-export drift** — if a promoted type is renamed, the re-export must keep the
  old name; the public-surface snapshot catches any accidental change.
- **Two-package ordering** — adt-clients work is blocked until interfaces is
  published; the plan sequences them and does not start Release B before the new
  interfaces version is on npm.
