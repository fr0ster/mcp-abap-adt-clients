# Migrating the family off the facade

**Status:** step 1 done and published, step 2 done for `adt@^8.0.0` and needing
a second pass, step 3 blocked on the publish below. Delete this file when it is
done or abandoned.

**Blocked on one publish.** Interfaces PR #105 — reviewed, pushed, not published
— moves `HttpError` to `-network`, `XmlNode` to `-utils` and `ITimeoutConfig`
*into* `-adt`, and splits authentication into `-auth` 1.2.0 and the new
`-auth-sap` 1.0.0. **Three of the steps below therefore repoint imports, not just
ranges**, and every one of them is cheaper done once, after the publish, than
done now against 8.0.0 and again after.

`@mcp-abap-adt/interfaces` is deleted (decision 34 in `mcp-abap-adt-interfaces`).
npm still serves 51.0.0 to everyone pinned to it, so nothing is broken and
nothing is urgent — but no contract change reaches a consumer until it moves.

**Priority is `@mcp-abap-adt/adt-clients`.** So the order below is not "most
consumers first": it is *what unblocks it*, then the rest by how many
repositories a step frees.

**`mcp-abap-adt` is not part of this plan.** It is being migrated on its own,
and it is not an argument for any ordering here: what it needs from this family
is a released `adt-clients`, which is step 3. Its own facade imports and the five
names that exist in no package are that migration's work, not this one's — they
are recorded at the bottom so the measurement is not lost, and for no other
reason.

## What is on the registry

| package | on the registry | in the tree, awaiting publish |
|---|---|---|
| `interfaces-adt` | 8.0.0 | **9.0.0** — 53 exports leave, `ITimeoutConfig` arrives |
| `interfaces-network` | 1.1.0 | **2.0.0** — gains `HttpError`, loses `ITimeoutConfig` |
| `interfaces-auth` | 1.1.0 | **1.2.0** — gains 32 authentication symbols |
| `interfaces-auth-sap` | — | **1.0.0** — new: the SAP and BTP half of authentication |
| `interfaces-calm` | 1.0.0 | **1.0.1** — takes `-network@^2.0.0` |
| `interfaces-utils` | 1.0.0 | **1.1.0** — gains `XmlNode` |
| `interfaces` | 51.0.0 | **deleted from the repository; nothing further ships** |

The right-hand column is interfaces PR #105, reviewed and pushed, not yet
published. **Every step below that names a version names the right-hand one**:
the authentication contracts a consumer needs are in `-auth` and `-auth-sap`
only from those versions on, so a repoint made against 8.0.0 would have to be
made twice. Decision 35 in that repository states the placement rule the split
follows.

## Where every repository stands

Re-measured 2026-09-23 **after** the split, by resolving every name each
repository imports from any `@mcp-abap-adt/interfaces*` package against what the
six built packages export. The `.wt-mcp-*` directories are worktrees of
`mcp-abap-adt`, not repositories, and are not listed.

| repository | declares | names | adt | auth | auth-sap | calm | network | utils |
|---|---|---|---|---|---|---|---|---|
| `mcp-abap-adt-clients` | **direct**, `adt@^8.0.0` | 138 | **127** | 1 | 1 | — | 6 | 3 |
| `mcp-abap-connection` | **direct**, `adt@^8.0.0` | 26 | 10 | 5 | 4 | — | 6 | 1 |
| `mcp-abap-adt-proxy` | **direct**, `adt@^6.0.0`, `network@^1.0.0` | 17 | **0** | 1 | 1 | — | 15 | — |
| `mcp-abap-adt-header-validator` | facade `^0.1.16` | 24 | **0** | 2 | 5 | — | 17 | — |
| `mcp-abap-adt-auth-providers` | facade `^11.6.0` | 18 | **0** | 16 | 1 | — | — | 1 |
| `mcp-abap-adt-auth-broker` | facade `^2.3.0` | 11 | **0** | 5 | 5 | — | — | 1 |
| `mcp-abap-adt-auth-stores` | facade `^5.0.0` | 8 | **0** | 2 | 5 | — | — | 1 |
| `cloud-llm-hub` | facade `^11.3.0` | 8 | 2 | — | — | — | 5 | 1 |
| `mcp-calm-server` | facade `^7.1.0` | 8 | **0** | 2 | 1 | 4 | — | 1 |
| `mcp-calm-client` | facade `^7.1.0` | 6 | **0** | 1 | — | 4 | — | 1 |
| `mcp-abap-adt-logger` | `utils@^1.0.0` | 2 | **0** | — | — | — | — | 2 |
| `mcp-abap-adt-gcts-client` | facade `^7.0.0` | **0** | — | — | — | — | — | — |
| `mcp-reports-server` | facade `^7.1.0` | **0** | — | — | — | — | — | — |

**Read the `adt` column.** Eight repositories take **zero** from the ADT
contract, where before the split the auth trio took 10, 7 and 17 and
`header-validator` 7. What is left is `adt-clients` (127, which is the point of
the package), the connector (10, all of them the connection contract),
`cloud-llm-hub` (2: `IAbapConnection`, `IAdtResponse`) and nobody else. That is
the criterion met rather than asserted.

Two rows need a footnote. `mcp-abap-adt-gcts-client`'s `src/` is a nine-line
stub — the implementation that imports `IAbapConnection`, `IAbapRequestOptions`
and `IAdtResponse` lives in an unmerged worktree, so its 0 means "nothing
shipped yet", not "migrated". `mcp-reports-server` declares the facade in both
`dependencies` and `devDependencies` and imports nothing: the dependency is
simply dead.

## The order, and why

### 1. `mcp-abap-adt-logger` → `interfaces-utils@^1.0.0` — **done, published 0.4.0**

**One line, and it cleans eleven trees.** The logger is a dependency of eleven
repositories, `adt-clients` among them, and it drags `interfaces@^39.0.0` into
every one of their `node_modules`. In `adt-clients` that nested copy is the last
facade left in the tree. It imports exactly `ILogger` and `LogLevel`.

Do this first. It is the cheapest step in the plan, and the only one that cleans
`adt-clients`' tree without `adt-clients` changing at all.

**Done:** `@mcp-abap-adt/logger` 0.4.0 is on the registry, all eleven imports
repointed, and its tree holds exactly one `@mcp-abap-adt` package.

### 2. `mcp-abap-connection` → `interfaces-adt@^8.0.0`, then publish it — **done at 9.1.0, one pass still owed**

On `^6.0.0`, two majors behind, and **this has to come before `adt-clients`'
release, not after it.** `adt-clients` takes the connector as a dev dependency
and every SAP run goes through it, so until the connector moves, the run that
validates an `adt-clients` release is a run against a contract two majors old.

That is not hypothetical — it is the tree today:

```
node_modules/@mcp-abap-adt/interfaces-adt                        7.0.0
node_modules/@mcp-abap-adt/connection/node_modules/…/interfaces-adt   6.0.0
```

Two copies, because `adt-clients` declares `^7.0.0` and the connector `^6.0.0`.
npm nests the older one rather than failing, so nothing announces it; the SAP run
for `adt-clients` 22.0.0 already went through that tree.

`adt-clients` consumes it from the registry, so this step is not finished until
the connector is published — the range bump alone changes nothing downstream.

Small in itself: it already takes four of the five directly — `adt`, `auth`,
`network` and `utils`; it has no use for `calm`.

**Done:** `@mcp-abap-adt/connection` 9.1.0 is published on `adt@^8.0.0`,
`network@^1.1.0`, `utils@^1.0.0`, and the duplicate copy is gone from
`adt-clients`' tree.

**What it still owes, after interfaces 9.0.0 publishes.** It imports 15 names
from `interfaces-adt`, and **six of them left**: `ISapConfig`, `SapAuthType`,
`SapConnectionType` and `ICertificateMaterialLoader` to `interfaces-auth-sap`,
`ITokenRefresher` and `ITokenRefreshResult` to `interfaces-auth`. It declares
`-auth` already and must add `-auth-sap`; the nine that stay are ADT
(`IAbapConnection`, `IAbapRequestOptions`, `IAdtResponse`, `IAdtWireResponse`,
`ICriticalSection`, `IRequestProfiling`, `ISessionLifecycleAware`,
`ADT_SESSION_ERROR`, `AdtSessionErrorCode`). A minor release: nothing it exports
changes shape.

### 3. `mcp-abap-adt-clients` → `interfaces-adt@^9.0.0`, and the connector

Already direct on all four. It uses no header name and nothing from Cloud ALM,
and `IAdtWireResponse`/`IAdtHeaderValue` kept their names and shapes.

**The ranges are ready in the branch `chore/contracts-8-and-logger-0.4`** —
`adt@^8.0.0`, `network@^1.1.0`, `logger@^0.4.0`, dev `connection@^9.1.0` — built,
unit-green and SAP-verified, uncommitted, and `package.json` still says 21.0.0
because the version number is the maintainer's to give.

**Three contracts it imports moved, so this is a repoint as well as a bump.**
Measured on the branch: of 17 names it takes from `interfaces-adt`, exactly one
left — `HttpError`, in **14 files**, to `interfaces-network`. Plus `XmlNode` in
`src/core/shared/nodeStructure.ts` to `interfaces-utils`, and `ITimeoutConfig` in
`src/utils/timeouts.ts` the other way: from `interfaces-network` **to**
`interfaces-adt`. 16 files, no shape changes, and `tsc` catches every one that is
missed.

Ranges after the publish: `adt@^9.0.0`, `network@^2.0.0`, `utils@^1.1.0`,
`auth@^1.2.0` (two test helpers take `IAuthProvider`). It needs nothing from
`-auth-sap`.

Bump the connector's range with it, then **check the tree holds one copy of each
package before running anything** — `find node_modules -path "*interfaces-adt/package.json"`
answers it in one line, and it is the check whose absence let the duplication
above go unnoticed.

Verify with `npm run build`, the unit suites, and a full SAP run *after* both
bumps. That run is what a release rests on, so it has to be run against the
tree the release names.

> The merged 22.0.0 work is still untagged, and that release and these bumps can
> be the same one.

**Blocked on step 2 and on the interfaces publish.** `mcp-abap-adt` consumes this release and is waiting for
it, which is a reason to move promptly — not a reason to release it before the
tree it was tested in is the tree it ships against.

### 4. `mcp-abap-adt-proxy` → `network@^2.0.0`, `auth@^1.2.0`, `auth-sap@^1.0.0` — and **drops `adt` entirely**

A transparent proxy, so what moves is headers. It imports 17 contract names in
all, six of them from `-network` already; of the **11** it takes from
`interfaces-adt`, **nine are header names** now in `interfaces-network` —

```
HEADER_BTP_DESTINATION   HEADER_MCP_URL          HEADER_SAP_CLIENT
HEADER_SAP_DESTINATION   HEADER_SAP_DESTINATION_SERVICE
HEADER_SAP_JWT_TOKEN     HEADER_SAP_PASSWORD     HEADER_SAP_REFRESH_TOKEN
HEADER_SAP_UAA_CLIENT_SECRET
```

— and the two that were called "real ADT-side contracts" when this was written
are not: `IAuthorizationConfig` is in `interfaces-auth-sap` 1.0.0 and
`ITokenRefresher` in `interfaces-auth` 1.2.0. **So a transparent proxy ends up
importing nothing from the ADT contract at all**, which is the criterion working
rather than a surprise: it routes headers and refreshes tokens, and it never
reads an ABAP object.

It already imports six header names from `-network`, so the nine move from one
import statement to the other in six files: `src/index.ts`,
`src/proxy/btpProxy.ts`, `src/router/requestInterceptor.ts`,
`src/router/headerAnalyzer.ts` and two tests; `src/proxy/credentials.ts` and
`src/proxy/btpProxy.ts` take the other two from the auth packages. `-network` is
declared already; `-auth` and `-auth-sap` are new dependencies, and
`interfaces-adt` comes out of `package.json`.

### 5. The rest, by how much each frees

| repository | work |
|---|---|
| `mcp-reports-server` | **delete the dependency.** It declares the facade in both `dependencies` and `devDependencies` and imports nothing |
| `mcp-abap-adt-header-validator` | 24 names: **17 `network@^2.0.0`, 5 `auth-sap@^1.0.0`, 2 `auth@^1.2.0`, zero `adt`.** The repository most freed by the split — it validates headers and reads SAP authentication configuration, and never touched an ADT contract even while it depended on one |
| `mcp-calm-client`, `mcp-calm-server` | 4 names each to `interfaces-calm@^1.0.1`; the rest is `auth` (1 and 2), one `auth-sap` in the server, one `utils` each, **zero `adt`**. Both were pinned to facade 7 while ADT passed 50 |
| `mcp-abap-adt-auth-providers` | 18 names: 16 `auth@^1.2.0`, 1 `auth-sap@^1.0.0`, 1 `utils`, **zero `adt`** |
| `mcp-abap-adt-auth-broker` | 11 names: 5 `auth`, 5 `auth-sap`, 1 `utils`, **zero `adt`** |
| `mcp-abap-adt-auth-stores` | 8 names: 2 `auth`, 5 `auth-sap`, 1 `utils`, **zero `adt`** |
| | All three are what the split was for: they imported 17, 10 and 7 names from the ADT contract and not one was an ADT contract. All three need both halves, which is why the first accepting package could not decide placement and decision 35 exists |
| `mcp-abap-adt-gcts-client` | **drop the dependency for now.** Its `src/` is a nine-line stub that imports nothing; the implementation taking `IAbapConnection`, `IAbapRequestOptions` and `IAdtResponse` is in an unmerged worktree and will declare `adt@^9.0.0` when it lands |

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
| `adt-clients`, `mcp-abap-connection` | `adt@^8` → `^9` — one major, read |
| `mcp-abap-adt-proxy` | `adt@^6` off entirely; what it takes is `-network`, `-auth`, `-auth-sap` |
| `mcp-abap-adt-logger` | facade `^39` → `utils@^1`, but the two names it takes have never changed |
| `header-validator` `^0.1.16`, `auth-broker` `^2.3.0`, `auth-stores` `^5.0.0`, `auth-providers` `^11.6.0`, `calm-*` / `gcts` / `reports` `^7.x` | **40+ contract majors** |

Every name all of them import resolves against today's packages — that was
measured. It proves the names exist, not that they mean the same thing. So for
the last row the insurance is each repository's own tests after the build; where
there are none, one manual pass over the main path.

## What this plan no longer has to leave undone

It said the auth trio would move off the facade and still track ADT's releases,
because 51 of the 77 `interfaces-adt` symbols that non-`adt-clients` consumers
import were not ADT contracts. **That is fixed before the repoints, not after**,
which is the opposite of what this section first said, and the reason is
arithmetic: moving contracts after eleven repositories have migrated means
eleven repositories migrating twice. Doing it first costs one extra interfaces
release.

Where they went: 15 header names and 4 Cloud ALM in `interfaces-adt` 8.0.0; in
9.0.0, 32 authentication symbols to `interfaces-auth` 1.2.0 and 16 SAP/BTP ones
to the new `interfaces-auth-sap` 1.0.0, with `HttpError` to `-network` and
`XmlNode` to `-utils`. Measured after: `auth-broker`, `auth-stores`,
`auth-providers`, `header-validator`, `calm-*`, `logger` and `reports-server`
import **zero** names from `interfaces-adt`; `gcts-client` takes 3 and
`cloud-llm-hub` 2, all of them ADT over a connection.

The `interfaces-sap` question in that repository's `DECISIONS.md` is closed with
it, and not on the cadence evidence decision 26 asked for: decision 35 places a
contract by what its own fields name, which answered it without waiting.

## `cloud-llm-hub`, recorded and not planned

Same reason as below: it is being migrated on its own and is not to be edited
from here. Measured so the work is not re-measured — facade `^11.3.0`, 8 names:
**5 `interfaces-network`** (routing header names), 2 `interfaces-adt`
(`IAbapConnection`, `IAdtResponse` — an ADT consumer over a connection, the
criterion met) and 1 `interfaces-utils`.

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
- **One copy of each contract package per tree**, checked rather than assumed:
  `find node_modules -path "*interfaces-*/package.json"` and read the versions — six packages now, not five.
  Two copies is what a range one major behind looks like, npm nests the older
  one silently, and this plan exists partly because that went unnoticed in
  `adt-clients` for a whole release cycle.
- Every repository's build and test suite green on its own terms; a full SAP run
  for `adt-clients`.
