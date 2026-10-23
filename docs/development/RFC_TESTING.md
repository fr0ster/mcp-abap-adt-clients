# RFC Testing Guide

## Environment Setup

### Required Environment Variables

Before running tests with RFC connections, set these variables in your shell:

**PowerShell:**
```powershell
$env:SAPNWRFC_HOME = "C:\nwrfcsdk\nwrfcsdk"
$env:PATH = "C:\nwrfcsdk\nwrfcsdk\lib;$env:PATH"
```

**Bash:**
```bash
export SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk'   # Windows path on Git Bash
export PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH"
# or on Linux/macOS:
export SAPNWRFC_HOME=~/nwrfcsdk
export PATH=$SAPNWRFC_HOME/lib:$PATH
export LD_LIBRARY_PATH=$SAPNWRFC_HOME/lib:$LD_LIBRARY_PATH
```

> **Important:** `dotenv` does not expand `$PATH`/`%PATH%` or `~`, so these variables cannot be set via `.env` files. They must be set in the shell session before running tests.

### The binding: prebuilt, no install script

The transport is `@mcp-abap-adt/sap-rfc-lite` (0.3.x), an `optionalDependencies`
entry of `@mcp-abap-adt/connection`, installed nested:

```
node_modules/@mcp-abap-adt/connection/node_modules/@mcp-abap-adt/sap-rfc-lite
```

— never at the top level, so looking for it there suggests it is absent when
it is not.

It has no install script: `npm ci` compiles nothing and needs no SDK. It
carries a prebuilt binding for linux-x64 (glibc), darwin-arm64 and win32-x64,
loaded at run time with the SDK's libraries on the library path (the variables
above).

On any other platform (a musl Linux, an Intel Mac, linux-arm64) there is no
prebuild and nothing in this repository builds one: build sap-rfc-lite's
binding from its own repository (its README, "Installation" — `npm ci`,
`npm run prebuild:native` with `SAPNWRFC_HOME` and a C++ toolchain, `npm pack`)
and install the package you built.

Without a usable binding every RFC run stops in `globalSetup`:

```
@mcp-abap-adt/sap-rfc-lite is not available … Cannot find module
```

### test-config.yaml

Set `connection_type: "rfc"` in the environment section:

```yaml
environment:
  system: "onprem"              # Which system. Stated, never inferred
  connection_type: "rfc"        # Use RFC transport instead of HTTP
  default_package: "$TMP"
  default_master_system: "SID"
```

When `connection_type` is `"rfc"`, the test session config overrides `authType` to `"rfc"` regardless of `SAP_AUTH_TYPE` in `.env`.

`system` is separate from `connection_type` and both are required: the first says
which system is on the other end, the second says how to reach it. RFC is an
on-prem transport, but stating one does not state the other — the helper builds
the connection from both.

### .env Files

System-specific `.env` files (e.g., `<system>.env`, `<other-system>.env`) contain SAP credentials:

```env
SAP_URL=http://saphost:8000
SAP_USERNAME=DEVELOPER
SAP_PASSWORD=secret
SAP_CLIENT=100
SAP_AUTH_TYPE=basic
SAP_UNICODE=false          # Set to false for non-unicode legacy systems
```

#### SAP_UNICODE

Controls the `chkrun:contentType` attribute in checkRun XML payloads for class includes and source artifacts:

- `SAP_UNICODE=false` — uses `text/plain` (required for non-unicode legacy systems like a BASIS 7.40 system)
- `SAP_UNICODE=true` or omitted — uses `text/plain; charset=utf-8` (default for modern/unicode systems)

If this is set incorrectly, checkRun returns `notProcessed` with `"Dirty Source: Wrong content type"`.
The value is read in `resolveSystemContext()` and passed to `AdtContentTypesBase(unicode)` which provides `sourceArtifactContentType()`.

Copy the appropriate file to `.env` before running tests:
```bash
cp <system>.env .env
```

Or pass variables inline:
```bash
SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk' PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH" \
  SAP_URL=http://saphost:8000 SAP_USERNAME=DEV SAP_PASSWORD=secret SAP_CLIENT=100 \
  npm test
```

## Running Tests

```bash
# Full suite
npm test

# Specific object type
npm test -- integration/core/functionGroup

# With debug logs
DEBUG_ADT_TESTS=true npm test -- integration/core/class
```

## The 7.40 system: a configuration and an environment of its own

The live checks of the legacy client (`src/__tests__/integration/legacy/`) run
against a SAP_BASIS 7.40 SP04 system over RFC, with a configuration of their own
— not the main system's `test-config.yaml`:

- `src/__tests__/helpers/test-config.legacy-740.yaml.template`: copy it to
  `test-config.legacy-740.yaml` (gitignored) and edit the lines marked
  `# ← CHANGE` (the system ID, and the software component and transport layer of
  the transportable package the environment creates). Only the `legacy_740`
  cases are in it, all enabled; `is_legacy: true`, `connection_type: "rfc"`.
- `MCP_TEST_CONFIG_PATH` names the configuration a run loads. Set, it is that
  file or the run fails naming it — there is no fallback to `test-config.yaml`
  or a template. `npm run check:config` then compares it with the template
  beside it (`<file>.template`). `MCP_ENV_PATH` names the `.env` with that
  system's credentials.

The objects the checks need are prepared and removed by ABAP classes in the
system, one call each (the idea of mcp-test's environment classes): 7.40 SP04
has no `IF_OO_ADT_CLASSRUN`, so they run through ABAP Unit
(`POST /sap/bc/adt/abapunit/testruns`, measured there) and report as alerts,
`@@LOG {json}` per step and `@@RESULT {json}` last. Sources:
`src/__tests__/integration/legacy/abap/`; driver: `src/__tests__/helpers/legacyEnv.ts`.

| Command | Does |
|---|---|
| `npm run legacy:setup` | installs `ZCL_LG7_ENV` and its runners (`$TMP`, written only when the source differs); runs prepare — releases the user's locks on ZLG7 names, deletes leftovers (not the fixtures) and their inactive versions, reuses or creates the request `ZLG7 LEGACY-TEST …`, creates package `ZLG7_TEST`; deletes leftover DDL sources over ADT; creates or refreshes the fixtures in `$TMP` |
| `npm run legacy:status` | reads: the open request, the package, every ZLG7 object in scope |
| `npm run legacy:teardown` | runs teardown — locks, every ZLG7 object in scope (fixtures included), inactive versions; deletes the DDL sources over ADT; runs remove — package `ZLG7_TEST`, every marked request of the user (none is ever released); then deletes the env classes over ADT. A credential refusal stops it at once |

Reports go to `.legacy-env/<action>.json` (gitignored). Nothing outside the
prefix `ZLG7` (`ZCL_LG7_*`, `ZIF_LG7_*`, `ZLG7*`, `Z_LG7_*`) in `$TMP` or
`ZLG7_TEST` is touched; every delete checks the name and the TADIR package
first. The `$TMP` part of that scope is by name: a ZLG7-named object another
user put in `$TMP` is in it too, by design — the prefix is reserved for these
checks. A run of the live checks uses the fixtures and leaves them; only
`legacy:teardown` removes them.

```bash
export MCP_TEST_CONFIG_PATH=src/__tests__/helpers/test-config.legacy-740.yaml
export MCP_ENV_PATH=$HOME/<the 7.40 system>.env
export SAPNWRFC_HOME=$HOME/sap/nwrfcsdk PATH=$HOME/sap/nwrfcsdk/lib:$PATH \
  LD_LIBRARY_PATH=$HOME/.local/lib/sap-rfc-lite:$HOME/sap/nwrfcsdk/lib:$LD_LIBRARY_PATH
npm run legacy:setup
npm run test:detached -- integration/legacy
npm run legacy:teardown        # when the environment is no longer needed
```

## RFC-Specific Considerations

### Lock Handle Encoding

RFC returns base64 lock handles with characters like spaces, `+`, `=`. All `lockHandle` values in URL query parameters must use `encodeURIComponent()`. This is already handled in all update/unlock functions.

### Content Type Versioning

Legacy systems (BASIS < 7.50) don't support versioned content types. The `contentTypes` system (`AdtContentTypesBase` / `AdtContentTypesModern`) handles this automatically. Key differences:

| Operation | Legacy (Base) | Modern |
|-----------|--------------|--------|
| Class create | `application/vnd.sap.adt.oo.classes+xml` | `application/vnd.sap.adt.oo.classes.v4+xml` |
| Program create | `application/vnd.sap.adt.programs.programs+xml` | `application/vnd.sap.adt.programs.programs.v2+xml` |
| Source artifact (checkRun) | `text/plain` | `text/plain; charset=utf-8` |

### URLSearchParams and encodeSapObjectName

`encodeSapObjectName()` must NOT be used for values passed to `URLSearchParams`, because `URLSearchParams.toString()` already URL-encodes values. Using both causes double-encoding (e.g., `$TMP` -> `%24TMP` -> `%2524TMP`).

`encodeSapObjectName()` is only for URL **path segments** where no automatic encoding happens.

### Function Group Read Accept Header

The function group read endpoint via RFC does not accept specific content types — only `*/*` works. The `getFunctionGroup()` function omits the Accept header to let the server choose the response format.

### ensureObjectReady Cleaner

`BaseTester` resolves object names from config using camelCase property names (e.g., `config.functionGroupName`). The `loggerPrefix` is converted to camelCase: `'FunctionGroup'` -> `'functionGroup'` + `'Name'` = `'functionGroupName'`.

## Packages: one save per ABAP session

A package can be saved — created, updated or deleted — only once per ABAP
session; the next save from that session is refused with `PAK/058`. Over RFC
that bites from the create onward, because every call shares one session; over
HTTP every stateful lock → update → unlock counts.

The package lifecycle test works around it. `afterCreate` replaces the test's
session before the update, and the cleanup replaces it again before the delete
— `tester.recycleSession()`, which ends the session and opens its replacement on
a new connection instance (one instance is one SAP session since
`@mcp-abap-adt/connection` 16), never a second one beside it. The test runs over RFC as well as HTTP; it used to be
skipped over RFC.
