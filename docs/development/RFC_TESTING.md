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

### test-config.yaml

Set `connection_type: "rfc"` in the environment section:

```yaml
environment:
  connection_type: "rfc"        # Use RFC transport instead of HTTP
  default_package: "$TMP"
  default_master_system: "E19"
```

When `connection_type` is `"rfc"`, the test session config overrides `authType` to `"rfc"` regardless of `SAP_AUTH_TYPE` in `.env`.

### .env Files

System-specific `.env` files (e.g., `e19.env`, `e77.env`) contain SAP credentials:

```env
SAP_URL=http://saphost:8000
SAP_USERNAME=DEVELOPER
SAP_PASSWORD=secret
SAP_CLIENT=100
SAP_AUTH_TYPE=basic
```

Copy the appropriate file to `.env` before running tests:
```bash
cp e19.env .env
```

Or pass variables inline:
```bash
SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk' PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH" \
  SAP_URL=http://saphost:8000 SAP_USERNAME=DEV SAP_PASSWORD=secret SAP_CLIENT=100 \
  npx jest --runInBand
```

## Running Tests

```bash
# Full suite
npm test

# Specific object type
npx jest --runInBand integration/core/functionGroup

# With debug logs
DEBUG_ADT_TESTS=true npx jest --runInBand integration/core/class
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
