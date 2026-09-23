# Migrating the family off the facade

**Status:** not started. Delete this file when it is done or abandoned.

`@mcp-abap-adt/interfaces` is deleted (decision 34 in `mcp-abap-adt-interfaces`).
npm still serves 51.0.0 to everyone pinned to it, so nothing is broken and
nothing is urgent — but no contract change reaches a consumer until it moves.

**Priority is `@mcp-abap-adt/adt-clients` and `mcp-abap-adt`.** So the order
below is not "most consumers first": it is *what unblocks those two first*, then
the rest by how many repositories a step frees.

## What is on the registry

| package | version | releases ever |
|---|---|---|
| `interfaces-adt` | 8.0.0 | 10 |
| `interfaces-network` | 1.1.0 | 2 |
| `interfaces-calm` | 1.0.0 | 1 |
| `interfaces-auth` | 1.1.0 | 2 |
| `interfaces-utils` | 1.0.0 | 1 |
| `interfaces` | 51.0.0 | **deleted from the repository; nothing further ships** |

## Where every repository stands

Measured 2026-09-23 by resolving each repository's imports against what the four
packages export. The `.wt-mcp-*` directories are worktrees of `mcp-abap-adt`,
not repositories, and are not listed.

| repository | declares | names it imports | resolves to |
|---|---|---|---|
| `mcp-abap-adt-clients` | **direct**, `adt@^7.0.0` | — | needs `^8.0.0` |
| `mcp-abap-connection` | **direct**, `adt@^6.0.0` | — | needs `^8.0.0` |
| `mcp-abap-adt-proxy` | **direct**, `adt@^6.0.0`, `network@^1.0.0` | — | header names moved: needs `network@^1.1.0` and its imports repointed |
| `mcp-abap-adt` | facade `^46.0.1` | 39 | adt 32, utils 2, **5 that exist nowhere** |
| `mcp-abap-adt-header-validator` | facade `^0.1.16` | 24 | **network 17**, adt 7 |
| `mcp-abap-adt-auth-providers` | facade `^11.6.0` | 18 | adt 17, utils 1 |
| `mcp-abap-adt-auth-broker` | facade `^2.3.0` | 11 | adt 10, utils 1 |
| `cloud-llm-hub` | facade `^11.3.0` | 8 | network 5, adt 2, utils 1 |
| `mcp-abap-adt-auth-stores` | facade `^5.0.0` | 8 | adt 7, utils 1 |
| `mcp-calm-server` | facade `^7.1.0` | 8 | **calm 4**, adt 3, utils 1 |
| `mcp-calm-client` | facade `^7.1.0` | 6 | **calm 4**, utils 1, adt 1 |
| `mcp-abap-adt-gcts-client` | facade `^7.0.0` | 4 | adt 3, utils 1 |
| `mcp-abap-adt-logger` | facade `^39.0.0` | **2** | utils 2 |
| `mcp-reports-server` | facade `^7.1.0` | **0** | nothing — the dependency is dead |

## The order, and why

### 1. `mcp-abap-adt-logger` → `interfaces-utils@^1.0.0`

**One line, and it cleans eleven trees.** The logger is a dependency of eleven
repositories **including both priorities**, and it drags `interfaces@^39.0.0`
into every one of their `node_modules`. In `adt-clients` that nested copy is the
last facade in the tree. It imports exactly `ILogger` and `LogLevel`.

Do this first. It is the cheapest step in the plan and the only one that touches
both priority repositories without either of them changing.

### 2. `mcp-abap-adt-clients` → `interfaces-adt@^8.0.0`

Already direct on all four. It uses no header name and nothing from Cloud ALM,
and `IAdtWireResponse`/`IAdtHeaderValue` kept their names and shapes, so this is
a range bump plus `npm install`. Verify with `npm run build`, the unit suites and
a full SAP run.

**Blocked on nothing. Blocks the server**, which consumes it.

> The merged 22.0.0 work is still untagged: `package.json` says 21.0.0 and the
> version number is the maintainer's to give. That release and this bump can be
> the same one.

### 3. `mcp-abap-connection` → `interfaces-adt@^8.0.0`

On `^6.0.0`, two majors behind. Both priority repositories run their tests
through it, so a stale contract here is a stale contract in their test trees.
Small: it takes four packages directly already.

### 4. `mcp-abap-adt` → the four packages, and the five orphans

The priority consumer, and the only repository with real work in it.

- 32 names from `interfaces-adt`, 2 from `interfaces-utils` — an import path.
- **Five names exist in no package**: `IAdtObject`, `IClassState`,
  `ICdsUnitTestState`, `IBehaviorDefinitionValidationParams`,
  `IPackageContentItem`. They were removed at earlier majors and survive only in
  the facade version the server is pinned to.
  - **Three are dead imports** — `IClassState`, `ICdsUnitTestState`,
    `IBehaviorDefinitionValidationParams` are imported and never used. Delete
    the import.
  - `IAdtObject` is used in 4 files (`handlers/.../*Version*`) and 1 test. It was
    the fat composite removed in interfaces 29.0.0; the capability atoms replace
    it, and `adt-clients`' factory return types are the honest narrowed sets.
  - `IPackageContentItem` is used in 1 file (`lib/search-source/packageEnumerator.ts`).
    A reading shape; the consumer declares its own now.
- Do it **after** step 2, so the server moves to the new `adt-clients` and the
  new contract in one migration rather than two.

### 5. `mcp-abap-adt-proxy` → `network@^1.1.0`, `adt@^8.0.0`

The only repository whose *imports* must move rather than just its ranges: it
reads header names, and every header name is in `interfaces-network` now. It is
already direct on both packages, so this is a repoint plus two bumps.

### 6. The rest, by how much each frees

| repository | work |
|---|---|
| `mcp-reports-server` | **delete the dependency.** It declares the facade in both `dependencies` and `devDependencies` and imports nothing |
| `mcp-abap-adt-header-validator` | 17 names to `network`, 7 to `adt`. The repository most freed by the split: it imports 24 names and not one is an ADT contract |
| `mcp-calm-client`, `mcp-calm-server` | 4 names each to `interfaces-calm@^1.0.0`, the rest to `adt`/`utils`. Both were pinned to facade 7 while ADT passed 50 |
| `mcp-abap-adt-auth-broker`, `-auth-stores`, `-auth-providers` | mostly `adt`, one `utils` each. **They stay coupled to ADT's release rate**, because the auth and store contracts are in `interfaces-adt` — see below |
| `mcp-abap-adt-gcts-client` | 3 `adt`, 1 `utils` |
| `cloud-llm-hub` | 5 `network`, 2 `adt`, 1 `utils` |

## What this plan does not fix

**51 of the 77 `interfaces-adt` symbols that non-`adt-clients` consumers import
are not ADT contracts:** 24 authentication, 4 credential stores, 4
configuration, and — until 8.0.0 — 15 header names and 4 Cloud ALM. The headers
and Cloud ALM are done. The rest means the auth trio will move off the facade
and still track ADT's releases.

`interfaces-auth` exists, has had two releases ever, and holds six symbols. The
28 authentication and store contracts belong in it. That is the
`interfaces-sap` / `interfaces-auth` question in the interfaces repository's
`DECISIONS.md`, and decision 26's premise — "only the ABAP family accepts them"
— is already refuted by measurement: `mcp-calm-*` is not ABAP and imports
`ITokenProvider`, `ITokenRefresher` and `ISessionStore`.

**Do it after the migration, not during.** Moving contracts while eleven
repositories are mid-migration means each of them migrating twice.

## Done means

- No repository declares `@mcp-abap-adt/interfaces`.
- No `node_modules` tree under `~/prj` holds a copy of it — which requires step 1,
  since the logger is what puts one there.
- Every repository's build, typecheck and test suite green on its own terms; a
  full SAP run for `adt-clients` and `mcp-abap-adt`.
- The five orphan names are gone from `mcp-abap-adt`, and what replaced each one
  is written down — the composite and the reading shape especially, because
  "deleted at a major" is not an answer to "so what do I use".
