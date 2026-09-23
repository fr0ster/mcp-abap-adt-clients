# Migrating the family off the facade

**Status:** not started. Delete this file when it is done or abandoned.

`@mcp-abap-adt/interfaces` is deleted (decision 34 in `mcp-abap-adt-interfaces`).
npm still serves 51.0.0 to everyone pinned to it, so nothing is broken and
nothing is urgent — but no contract change reaches a consumer until it moves.

**Priority is `@mcp-abap-adt/adt-clients`.** So the order below is not "most
consumers first": it is *what unblocks it*, then the rest by how many
repositories a step frees.

**`mcp-abap-adt` is not part of this plan.** It is being migrated on its own,
and it is not an argument for any ordering here: what it needs from this family
is a released `adt-clients`, which is step 2. Its own facade imports and the five
names that exist in no package are that migration's work, not this one's — they
are recorded at the bottom so the measurement is not lost, and for no other
reason.

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
repositories, `adt-clients` among them, and it drags `interfaces@^39.0.0` into
every one of their `node_modules`. In `adt-clients` that nested copy is the last
facade left in the tree. It imports exactly `ILogger` and `LogLevel`.

Do this first. It is the cheapest step in the plan, and the only one that cleans
`adt-clients`' tree without `adt-clients` changing at all.

### 2. `mcp-abap-adt-clients` → `interfaces-adt@^8.0.0`

Already direct on all four. It uses no header name and nothing from Cloud ALM,
and `IAdtWireResponse`/`IAdtHeaderValue` kept their names and shapes, so this is
a range bump plus `npm install`. Verify with `npm run build`, the unit suites and
a full SAP run.

**Blocked on nothing.** `mcp-abap-adt` consumes it and is waiting for the
release, which is a reason to do it promptly — not a reason for it to be second.
It is second because everything else in this plan is smaller.

> The merged 22.0.0 work is still untagged: `package.json` says 21.0.0 and the
> version number is the maintainer's to give. That release and this bump can be
> the same one.

### 3. `mcp-abap-connection` → `interfaces-adt@^8.0.0`

On `^6.0.0`, two majors behind. `adt-clients` runs its tests through it, so a
stale contract here is a stale contract in its test tree. Small: it takes the
four packages directly already.

### 4. `mcp-abap-adt-proxy` → `network@^1.1.0`, `adt@^8.0.0`

The only repository whose *imports* must move rather than just its ranges, and a
transparent proxy, so what moves is headers. Measured: it takes **11** names from
`interfaces-adt`, of which **nine are header names** now in
`interfaces-network` —

```
HEADER_BTP_DESTINATION   HEADER_MCP_URL          HEADER_SAP_CLIENT
HEADER_SAP_DESTINATION   HEADER_SAP_DESTINATION_SERVICE
HEADER_SAP_JWT_TOKEN     HEADER_SAP_PASSWORD     HEADER_SAP_REFRESH_TOKEN
HEADER_SAP_UAA_CLIENT_SECRET
```

— and the two that stay are real ADT-side contracts: `IAuthorizationConfig` and
`ITokenRefresher`. It already imports six header names from `-network`, so nine
move from one import statement to the other in six files: `src/index.ts`,
`src/proxy/btpProxy.ts`, `src/router/requestInterceptor.ts` and three tests.

Both packages are already declared, so the rest is two range bumps.

### 5. The rest, by how much each frees

| repository | work |
|---|---|
| `mcp-reports-server` | **delete the dependency.** It declares the facade in both `dependencies` and `devDependencies` and imports nothing |
| `mcp-abap-adt-header-validator` | 17 names to `network`, 7 to `adt`. The repository most freed by the split: it imports 24 names and not one is an ADT contract |
| `mcp-calm-client`, `mcp-calm-server` | 4 names each to `interfaces-calm@^1.0.0`, the rest to `adt`/`utils`. Both were pinned to facade 7 while ADT passed 50 |
| `mcp-abap-adt-auth-broker`, `-auth-stores`, `-auth-providers` | mostly `adt`, one `utils` each. **They stay coupled to ADT's release rate**, because the auth and store contracts are in `interfaces-adt` — see below |
| `mcp-abap-adt-gcts-client` | 3 `adt`, 1 `utils` |
| `cloud-llm-hub` | 5 `network`, 2 `adt`, 1 `utils` |

## What reviews each step

**`adt-clients` is reviewed. The rest are repoints, and `tsc` is the reviewer.**
Every repository here has a `build` script, so an import that resolves nowhere,
or a name taken from the wrong package, fails to compile — constants included,
since `HEADER_*`, `CALM_SERVICES` and `ADT_NO_FAILURE` are values.

Five have no CI — `logger`, `header-validator`, `calm-client`, `calm-server`,
`reports-server` — so there `npm run build` before pushing *is* the check.

**What a compiler cannot catch is a name that still exists and changed shape**,
and the pins differ enormously in how much contract history each step crosses:

| repository | jump |
|---|---|
| `adt-clients`, `mcp-abap-connection`, `mcp-abap-adt-proxy` | `adt@^6`/`^7` → `^8` — one or two majors, both read |
| `mcp-abap-adt-logger` | facade `^39` → `utils@^1`, but the two names it takes have never changed |
| `header-validator` `^0.1.16`, `auth-broker` `^2.3.0`, `auth-stores` `^5.0.0`, `calm-*` / `gcts` / `reports` `^7.x`, `cloud-llm-hub` `^11.3.0` | **40+ contract majors** |

Every name all of them import resolves against today's packages — that was
measured. It proves the names exist, not that they mean the same thing. So for
the last row the insurance is each repository's own tests after the build; where
there are none, one manual pass over the main path.

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

## `mcp-abap-adt`, recorded and not planned

Not this plan's work — kept because the measurement was made and would otherwise
be repeated. Facade `^46.0.1`, 39 names: 32 from `interfaces-adt`, 2 from
`interfaces-utils`, and **five that exist in no package**, surviving only in the
facade version it is pinned to.

- **Three are dead imports** — `IClassState`, `ICdsUnitTestState` and
  `IBehaviorDefinitionValidationParams` are imported and never used.
- `IAdtObject` is used in 4 files (`handlers/.../*Version*`) and 1 test: the fat
  composite removed in interfaces 29.0.0, replaced by the capability atoms, with
  `adt-clients`' factory return types as the honest narrowed sets.
- `IPackageContentItem` is used in 1 file
  (`lib/search-source/packageEnumerator.ts`): a reading shape the consumer
  declares itself now.

## Done means

- No repository in this plan declares `@mcp-abap-adt/interfaces`.
- No `node_modules` tree under `~/prj` holds a copy of it — which requires step 1,
  since the logger is what puts one there.
- Every repository's build and test suite green on its own terms; a full SAP run
  for `adt-clients`.
