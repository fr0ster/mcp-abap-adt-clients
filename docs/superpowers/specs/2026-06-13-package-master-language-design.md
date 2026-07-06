# adt-clients: master language for `package` create — design

**Scope:** `@mcp-abap-adt/adt-clients` only. Issue fr0ster/mcp-abap-adt#105.

## Context

#105 makes the master/original language of created objects configurable
instead of hardcoded `EN`. The language is delivered via the **create payload**
(`adtcore:language` / `adtcore:masterLanguage`).

**Resolution semantics (fixed, consistent at every step):** a *blank* value —
empty **or whitespace-only** — is treated as *unset* and falls through;
a non-blank value is **trimmed** and used. Each tier evaluates `value?.trim()`:
truthy → use the trimmed value, else fall to the next tier; floor is `'EN'`:

```
config.masterLanguage?.trim() || systemContext.masterLanguage?.trim() || 'EN'
```

So `''` and `'  '` fall through (do not shadow a lower tier), `' DE '` →
`'DE'`. `?.trim()` is applied at every layer that resolves the value (both the
high-level `AdtPackage.create()` and the low-level `create.ts`), so a blank can
never reach the XML. This is intentionally stricter than the `||`/`??` pattern
the 14 already-shipped types use; unifying them is part of the deferred
interface-realignment follow-up.

This shipped in **adt-clients 5.5.0** for every language-aware object type
**except `package`**. Consumer-side wiring (the `SAP_LANGUAGE` default, the
inbound `X-SAP-Language` header override, and the per-call `master_language`
tool parameter) is a separate effort and **out of scope here**.

## Why package was missed

`package` is the only object type whose create params (`ICreatePackageParams`)
are sourced from `@mcp-abap-adt/interfaces` rather than defined locally in
adt-clients. #105 added `masterLanguage` to the local copies, so package was not
covered. (Realigning the other local copies to the interface-first pattern is a
separate, deferred follow-up — not this spec.)

The interface field is already in place: **interfaces 7.3.0** added
`ICreatePackageParams.master_language` (and dropped the unused
`ISapConfig.language`). This spec consumes that.

## Change (adt-clients)

Dependency: bump `@mcp-abap-adt/interfaces` to `^7.3.0`.

1. **`src/core/package/types.ts`** — `IPackageConfig`: add `masterLanguage?: string`.
   (`ICreatePackageParams` stays re-exported from interfaces; its
   `master_language` now exists upstream.)
2. **`src/core/package/AdtPackage.ts`** — in `create()`, pass into the
   `createPackage(...)` params object (next to `master_system` / `responsible`):
   `master_language: config.masterLanguage?.trim() || this.systemContext.masterLanguage?.trim() || undefined`.
   Blank (empty/whitespace) `config.masterLanguage` falls through to
   `systemContext`; both blank → `undefined` (the low-level applies the `EN`
   floor).
3. **`src/core/package/create.ts`** — replace the hardcoded
   `adtcore:language="EN"` and `adtcore:masterLanguage="EN"` with a single
   `const lang = params.master_language?.trim() || 'EN'` used for **both**
   attributes (defensive trim here too, so a direct low-level caller can't put a
   blank into the XML).

No behaviour change when `masterLanguage` is unset (still `EN`). Additive.

## Bundled in the same release (not part of this design)

**PR #37** — `fix(behaviorDefinition): URL-encode namespaced object names in ADT
paths` (external contributor, commit `ff59b2f`, currently only on branch
`fix/bdef-namespace-url-encoding` — **NOT yet in `main`**). Independent,
self-contained bugfix with its own unit tests.

In scope of this release: **merge #37 into `main` first**, then branch the
package change off the updated `main` (so the package build/tests also exercise
#37). Both ship in 5.6.0 to avoid two publish cycles. If #37 is not merged, the
package change releases on its own and this bundling note does not apply.

## Release

**adt-clients 5.6.0** (minor: additive package language support; **plus the #37
behaviorDefinition fix if it is merged into `main` first** — see the bundling
section. If #37 is not bundled, 5.6.0 ships the package change alone and the
CHANGELOG omits the #37 entry).
Release checklist (mirrors 5.5.0): bump `version` in `package.json`, update root
`version` in `package-lock.json` (×2), add a `CHANGELOG.md` entry, verify the
lockfile has no `link:true`/`file:` entries. Bump + release (merge + tag) by the
assistant; `npm publish` by the user.

## Testing

- Extend `src/__tests__/unit/core/masterLanguage.test.ts` with package cases
  that lock the **full contract** (deterministic, mock connection, no live
  system):
  1. given `config.masterLanguage='DE'` → create POST has **both**
     `adtcore:language="DE"` **and** `adtcore:masterLanguage="DE"`;
  2. no config, `systemContext.masterLanguage='IT'` → both attributes `IT`
     (systemContext fallback);
  3. `config.masterLanguage='FR'` over `systemContext='IT'` → both `FR`
     (config priority);
  4. neither set → both `EN` (floor);
  5. `config.masterLanguage=''` with `systemContext='IT'` → both `IT`
     (empty treated as unset);
  6. `config.masterLanguage='   '` (whitespace) with `systemContext='IT'` →
     both `IT` (whitespace treated as unset — guards the `.trim()` path);
  7. `config.masterLanguage=' DE '` → both `DE` (trimmed value used).

  Cases 1–7 exercise the high-level `AdtPackage.create()` resolution. Add a
  **low-level** case that calls `createPackage(...)` directly (no `AdtPackage`),
  guarding the defensive trim in `create.ts`:
  8. `createPackage({ …, master_language: '   ' })` → both attributes `EN`;
     `createPackage({ …, master_language: ' DE ' })` → both `DE`.
- Existing integration coverage (`MasterLanguage.test.ts`, config-driven) is
  class-based; package persistence is verifiable on a multi-language system but
  not required for this change (wire assertion suffices, mirroring 5.5.0).

## Out of scope

- Consumer (`mcp-abap-adt`) tiers: `SAP_LANGUAGE` default (already shipped in
  7.0.2), inbound `X-SAP-Language` header override, per-call `master_language`
  tool parameter.
- Realigning the 14 local `ICreate*Params` to `@mcp-abap-adt/interfaces`.
- Any outbound SAP session language.
