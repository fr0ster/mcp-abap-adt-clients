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

> **Important:** `dotenv` does not expand `$PATH`/`%PATH%` or `~`, so these variables cannot be set via session files. They must be set in the shell session before running tests.

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

### test-config.overlay.yaml

Set `environment.connection_type` in your overlay (an optional key; keys are
written flat, see [Test Config Schema](TEST_CONFIG_SCHEMA.md)):

```yaml
"environment.system": "onprem"          # Which system. Stated, never inferred
"environment.connection_type": "rfc"    # Use RFC transport instead of HTTP
"environment.default_package": "$TMP"
"environment.default_master_system": "SID"
```

`SAP_AUTH_TYPE` is required in every session file (`basic`, `jwt` or `xsuaa`): a missing or other value is refused, naming the key, and the mode is never read off the credentials. When `connection_type` is `"rfc"`, the test session config then overrides `authType` to `"rfc"`.

`system` is separate from `connection_type` and both are required: the first says
which system is on the other end, the second says how to reach it. RFC is an
on-prem transport, but stating one does not state the other — the helper builds
the connection from both.

### Session files

System-specific session files (`~/.config/mcp-abap-adt/sessions/<system>.env` on Linux/macOS, `~/Documents/mcp-abap-adt/sessions/<system>.env` on Windows) contain SAP credentials. The repository holds no `.env`; a run names its file with `MCP_ENV_PATH` (the helpers read the repository's `.env` only when it is unset). The file must carry `SAP_URL`, `SAP_USERNAME` (not `SAP_LOGIN`), `SAP_PASSWORD` and `SAP_CLIENT`; keep it in the session directory, mode 600:

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

Name the appropriate file before running tests:
```bash
MCP_ENV_PATH=~/.config/mcp-abap-adt/sessions/<system>.env npm test -- <path>
```

Or pass variables inline:
```bash
SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk' PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH" \
  SAP_URL=http://saphost:8000 SAP_USERNAME=DEV SAP_PASSWORD=secret SAP_CLIENT=100 SAP_AUTH_TYPE=basic \
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
