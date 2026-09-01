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

### Install with those variables set, too

Setting them before the tests is not enough — they have to be set when
dependencies are installed:

```bash
# Windows (Git Bash) — the SDK path is wherever it was unpacked
SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk' PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH" npm ci

# macOS
SAPNWRFC_HOME=~/nwrfcsdk PATH=$SAPNWRFC_HOME/lib:$PATH npm ci

# Linux
SAPNWRFC_HOME=~/nwrfcsdk PATH=$SAPNWRFC_HOME/lib:$PATH LD_LIBRARY_PATH=$SAPNWRFC_HOME/lib:$LD_LIBRARY_PATH npm ci
```

The transport is `@mcp-abap-adt/sap-rfc-lite`, an `optionalDependencies` entry
of `@mcp-abap-adt/connection` with a native build. **npm drops an optional
dependency whose build fails and reports nothing**, and the build needs the SDK.

Measured on the same lockfile: `npm ci` alone installs 1675 packages and no
binding; with the variables, 1678, placed at

```
node_modules/@mcp-abap-adt/connection/node_modules/@mcp-abap-adt/sap-rfc-lite
```

Nested — never at the top level, so looking for it there suggests it is absent
when it is not. Without it every RFC run stops in `globalSetup`:

```
@mcp-abap-adt/sap-rfc-lite is not available … Cannot find module
```

which names the package rather than the SDK that was missing an installation
earlier.

### test-config.yaml

Set `connection_type: "rfc"` in the environment section:

```yaml
environment:
  system: "onprem"              # Which system. Stated, never inferred
  connection_type: "rfc"        # Use RFC transport instead of HTTP
  default_package: "$TMP"
  default_master_system: "E19"
```

When `connection_type` is `"rfc"`, the test session config overrides `authType` to `"rfc"` regardless of `SAP_AUTH_TYPE` in `.env`.

`system` is separate from `connection_type` and both are required: the first says
which system is on the other end, the second says how to reach it. RFC is an
on-prem transport, but stating one does not state the other — the helper builds
the connection from both.

### .env Files

System-specific `.env` files (e.g., `e19.env`, `e77.env`) contain SAP credentials:

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

- `SAP_UNICODE=false` — uses `text/plain` (required for non-unicode legacy systems like E77)
- `SAP_UNICODE=true` or omitted — uses `text/plain; charset=utf-8` (default for modern/unicode systems)

If this is set incorrectly, checkRun returns `notProcessed` with `"Dirty Source: Wrong content type"`.
The value is read in `resolveSystemContext()` and passed to `AdtContentTypesBase(unicode)` which provides `sourceArtifactContentType()`.

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

## Known limitation: package update

Updating a package over RFC fails. `create`, `LOCK`, `UNLOCK` and `delete` all
work; only the `PUT` that saves a change is refused:

```
PUT /sap/bc/adt/packages/<name>?lockHandle=<ours>
  400  ExceptionResourceAlreadyExists   PAK/058  "Package <name> is already locked"
```

It is not the lock handle. Measured on E19 2026-08-31, the same endpoint in the
same session answers:

| Request | Answer |
| --- | --- |
| `PUT` with no `lockHandle` | 400 `ExceptionParameterNotFound`, `SADT_RESOURCE/017` |
| `PUT` with a made-up handle | 423 `ExceptionResourceInvalidLockHandle`, `SADT_RESOURCE/026` |
| a second `_action=LOCK` | 403 `ExceptionResourceNoAccess`, `EU/510` |
| `PUT` with our real handle | 400 `ExceptionResourceAlreadyExists`, `PAK/058` |

The parameter is read, the handle is validated, and ours passes — a `PUT` blind
to the lock would answer 423, exactly as the made-up handle does. The ADT
resource lock is recognised as ours, and a second one is refused under `EU/510`,
a different message class from the one the `PUT` reports. So the refusal comes
from a layer past the ADT lock: PAK's own, whose state does not survive the hop
between internal contexts that `SADT_REST_RFC_ENDPOINT` makes per call, while
the enqueue handle does — which is why the `UNLOCK` afterwards still answers 200.

**Packages only.** In the same RFC run 31 other updates pass — classes,
interfaces, domains, data elements, tables, structures, DDL, behaviour
definitions — and no `PAK` message appears anywhere else in the log. Every other
type keeps its state where a lock handle reaches it from any context; the package
is the one with a second locking layer of its own.

### The same layer blocks a delete after an update, on either transport

`PAK/058` is not confined to RFC. Over **HTTP**, a package the session has just
updated cannot be deleted by that session either: `deletion/check` answers
`isDeletable="true"`, and `deletion/delete` answers HTTP 200 carrying
`isDeleted="false"` and the same `PAK/058`. A delete from any other session
succeeds on the first attempt, immediately, while the first session is still
open — so it is ownership of the PAK state, not a delay. Retried for 30 seconds
inside the run it never succeeds; sent one second after the run ends it works.

The harness has the mechanism for this — `recycleTestSession()`, which reopens
the session before the cleanup delete — and the template now ships with
`cleanup_session_after_test: true`, so it runs. That is what makes the package
lifecycle test pass its cleanup over HTTP: the delete goes out on a session that
does not own the PAK state.

A `test-config.yaml` written before this change still carries `false` — the file
is not in git, and `check:config` compares top-level sections, so it will not
report the difference. If the package suite fails at cleanup with `PAK/058`,
that setting is the first thing to look at.

The failure it replaces was real, not swallowed: the object was left behind and
the next run met it — which then made that run skip its own workflow and report
green.

Why PAK takes the create path rather than the change path is **not established**,
and needs the ABAP side to answer. Until it is, this is a known limitation rather
than an open defect in this library: HTTP is the primary transport for modern
on-premise systems, and RFC exists for BASIS < 7.50 where package CRUD is not
supported regardless. The package lifecycle test is skipped over RFC with this
reason at the skip.
