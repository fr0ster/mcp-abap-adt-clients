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

**A legacy run needs `connection_type: "rfc"`.** The legacy client is supported,
and measured on SAP_BASIS 7.40 SP04, over RFC only. With `is_legacy: true` and
`connection_type: "http"` the live checks of the legacy client skip, each with
the reason "the legacy client is supported over RFC only"
(`src/__tests__/helpers/legacyRfc.ts`, `describeLegacyRfc`).

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

## The 7.40 system: an overlay and an environment of its own

The live checks of the legacy client (`src/__tests__/integration/legacy/`) run
against a SAP_BASIS 7.40 SP04 system over RFC. Like any system, it has an
overlay of its own over the tracked base, named for every run by
`MCP_TEST_OVERLAY` (see [Test Config Schema](TEST_CONFIG_SCHEMA.md)):

- `MCP_TEST_OVERLAY=src/__tests__/helpers/test-config.overlay.<system>.yaml npm run test:init -- onprem`,
  then fill in the required keys and, from the form's legacy block:
  `environment.is_legacy: true`, `environment.connection_type: "rfc"`,
  `legacy_env.software_component` and `legacy_env.transport_layer` (the
  transportable package the environment creates), and `enabled: true` for each
  `legacy_740` case. The base keeps every `legacy_740` case off.
- `MCP_ENV_PATH` names the session `.env` with that system's credentials
  (`SAP_UNICODE=false` for a non-unicode system).

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
| `npm run legacy:teardown` | runs teardown — locks, every ZLG7 object in scope (fixtures included), inactive versions; deletes the DDL sources over ADT; runs remove — package `ZLG7_TEST`, every marked request of the user (none is ever released); then deletes the env classes over ADT (`ZCL_LG7_ENV_RUN` too, where a manual setup left it). A credential refusal stops it at once |
| `npm run legacy:uninstall` | deletes only the env classes over ADT — `ZCL_LG7_ENV`, its runners and `ZCL_LG7_ENV_RUN`, each that is there, in `$TMP` and of the session user; the manual runner's last step |

Reports go to `.legacy-env/<action>.json` (gitignored). Each command first asks
`isModernAdtSystem()` and refuses a system that answers
`/sap/bc/adt/core/discovery` — a modern one — before anything is installed.
Nothing outside the prefix `ZLG7` (`ZCL_LG7_*`, `ZIF_LG7_*`, `ZLG7*`,
`Z_LG7_*`) is touched, and of those only what is in package `ZLG7_TEST` or in
`$TMP` with the session user as its author: `objects_in_scope` selects an
object, in either package, only with TADIR `AUTHOR = sy-uname`, and every
delete reads the name, the TADIR package and the author again right before it.
A ZLG7-named object another user put in `ZLG7_TEST` or `$TMP` is never
touched. Package `ZLG7_TEST` is adopted or deleted only when `TDEVC-AS4USER`
and the TADIR author of its `DEVC` entry are both the session user; otherwise
the step reports an error and changes nothing. Over ADT, the env classes and
leftover DDL sources are written or deleted only when their metadata names the
session user as the person responsible (`adtcore:responsible`, which 7.40 SP04
sends on class and DDL source metadata); metadata that names no one, or an
unknown session user, refuses — delete such an object in SE80 as the test
user. An existing fixture function module (whose 7.40
metadata names no one) or test include (whose owner this side cannot read) is
never replaced: setup refuses when its active source differs. An object is
current only when its ACTIVE source is the one wanted; a written but inactive
source is activated on the next run and read back after the activation.
A transportable object a live check deleted keeps its TADIR row in
`ZLG7_TEST` until its request is released (none ever is): an object whose own
table (TRDIR, SEOCLASS, TLIBG, DDDDLSRC, T100A) no longer has it is reported
`deleted, recorded in the request` and its row is left to the request.
`TEARDOWN` deletes the function group `ZLG7_FX` whole, with every member in
it: the group is the test user's, and a module someone else adds to it is
theirs to agree with the group's owner.
A run of the live checks uses the fixtures and leaves them; only
`legacy:teardown` removes them.

```bash
export MCP_TEST_OVERLAY=src/__tests__/helpers/test-config.overlay.<system>.yaml
export MCP_ENV_PATH=$HOME/.config/mcp-abap-adt/sessions/<system>.env
export SAPNWRFC_HOME=$HOME/sap/nwrfcsdk PATH=$HOME/sap/nwrfcsdk/lib:$PATH \
  LD_LIBRARY_PATH=$HOME/.local/lib/sap-rfc-lite:$HOME/sap/nwrfcsdk/lib:$LD_LIBRARY_PATH
npm run legacy:setup
npm run test:detached -- integration/legacy
npm run legacy:teardown        # when the environment is no longer needed
```

`npm run legacy:uninstall` deletes only the env classes (`ZCL_LG7_ENV`, its
runners, `ZCL_LG7_ENV_RUN`) over ADT — each that is there, in `$TMP` and of the
session user. `legacy:teardown` does that itself with the ABAP Unit runner; the
manual runner needs it as its last step.

### The manual runner

A client may limit ABAP Unit below risk level `DANGEROUS`
(`SAUNIT_CLIENT_SETUP`): the runner classes are then refused with "No
execution, risk level of test class exceeds upper limit" and no `@@RESULT`
line comes back. There the overlay states

```yaml
"legacy_env.runner": "manual"
```

(the base states `"abap_unit"`; nothing else is accepted) and the owner runs
each action in SAP GUI with `ZCL_LG7_ENV_RUN`
(`src/__tests__/integration/legacy/abap/zcl_lg7_env_run.clas.abap`): one static
method per action, each creating `ZCL_LG7_ENV`, calling the action and
returning its report lines — `@@LOG {json}` per step, `@@RESULT {json}` last,
whose `"ok"` must be `true`. In SE24: class `ZCL_LG7_ENV_RUN` → **Test (F8)** →
the method → **Execute (F8)** → double-click `RT_LINES`. The npm scripts do
only the ADT part around those steps, and run no ABAP Unit runner.

**Log on to SAP GUI as the `SAP_USERNAME`, in client `SAP_CLIENT`, of the
session file `MCP_ENV_PATH` names** (`~/.config/mcp-abap-adt/sessions/<destination>.env`,
never a file in the repository) — the user the npm steps run as. Everything `ZCL_LG7_ENV` does is tied to
`sy-uname`: the `$TMP` objects it takes (TADIR author), the locks it releases,
the request and task it creates and deletes. Every object it touches and the
package `ZLG7_TEST` must belong to that user; anything else the environment
refuses, with an error step, and leaves as it is. With ABAP Unit that was the ADT
session's user; in SE24 it is whoever is logged on. Another user would create
the request for themselves (the live checks would then write into another
user's request) and `TEARDOWN` / `REMOVE` would miss the test user's objects.

| # | Who | Step |
|---|---|---|
| 1 | npm | `npm run legacy:setup` — installs `ZCL_LG7_ENV` and `ZCL_LG7_ENV_RUN` (no runner class), deletes the DDL sources the live cases name (`ddl_name`) when a crashed run left one in `$TMP`, creates or refreshes the fixtures. The test title and `.legacy-env/setup.json` (`next`) name step 2 with the values |
| 2 | SE24 | `PREPARE` with `IV_SOFTWARE_COMPONENT` and `IV_TRANSPORT_LAYER` = the overlay's `legacy_env.software_component` and `transport_layer` — locks, leftovers, inactive versions, the request `ZLG7 LEGACY-TEST …`, package `ZLG7_TEST`. Its `@@RESULT` names the request |
| 3 | npm | `LEGACY_ENV_REQUEST=<that request> npm run test:detached -- integration/legacy`. Only `LegacyTransportable` reads it; without it that case skips, naming step 2. `STATUS` in SE24 reads the environment at any time (`npm run legacy:status` skips, naming it) |
| 4 | SE24 | `TEARDOWN` — locks, every ZLG7 object in scope (fixtures included), inactive versions; DDL sources are left for ADT, the request is kept |
| 5 | npm | `npm run legacy:teardown` — deletes the named DDL sources over ADT, nothing else |
| 6 | SE24 | `REMOVE` — package `ZLG7_TEST`, every marked request of the user (none released) |
| 7 | npm | `npm run legacy:uninstall` — deletes the env classes over ADT, `ZCL_LG7_ENV_RUN` included |

If step 1 fails on a lock or a leftover a crashed run holds, run `PREPARE`
(step 2) and step 1 again: both are idempotent. With the manual runner the
owner's report does not reach the npm side, so a DDL source the report marks
`LEFT-FOR-ADT` under a name no live case configures is not deleted by steps 1
and 5; `REMOVE` then reports package `ZLG7_TEST` as not empty if such a source
is in it. `LEGACY_ENV_REQUEST` beside `legacy_env.runner: "abap_unit"` is
refused, never ignored.

### The live checks

Written, not yet run: no result of theirs is recorded in `docs/architecture/LEGACY.md`.
Each runs under `describeLegacyRfc` — only when the loaded configuration says
`is_legacy: true` and `connection_type: "rfc"`, a skipped test naming the reason
otherwise — and every case is a `legacy_740` test case of the configuration
(`enabled: false` in `test-config.yaml.template`, enabled in the 7.40 system's overlay).
Refused members are asserted on a wire recorder (`helpers/requestRecorder.ts`),
not on a log: nothing may leave.

| File | `legacy_740` case | Checks |
|---|---|---|
| `LegacyDelete.test.ts` | `legacy_deletes` | class, program, interface, function group, function module, DDL source: lock → delete with the handle → unlock → the read answers `404`; a delete without a handle answers `400` for the first four. Creates and deletes only its own objects |
| `LegacyRefusals.test.ts` | `legacy_refusals_send_nothing` | every refused member — `checkDeletion`, the `absentOnLegacy` handlers, the rest — answers the refusal and sends nothing; `readObjectMetadata`/`readObjectSource` for a program and a class answer `200` |
| `LegacyUnitTests.test.ts` | `legacy_unit_runners` | class, program, function group `run`/`runSync` and function module `runSync` send one testruns POST with `<options>` and answer the fixtures' methods |
| `LegacyFunctionInclude.test.ts` | `legacy_function_include` | a function include created with the v1 pair, written under its lock, activated (its group is created and deleted by the test) |
| `LegacyTransports.test.ts` | `legacy_transports` | `list` and `readMetadata` send one GET to `/sap/bc/cts/transportrequests` and answer the user's list |
| `LegacyTransportable.test.ts` | `legacy_transportable` | in package `ZLG7_TEST` on the environment's request: create, lock → update with `corrNr` → unlock; the list and `readMetadata` name the request; lock → `DELETE ?lockHandle=&corrNr=` → unlock — measures what is not yet measured (a delete with `corrNr`, a populated list) |

Run them as shown above: `npm run legacy:setup`, then
`npm run test:detached -- integration/legacy`, with `MCP_TEST_OVERLAY` naming
the 7.40 system's overlay and `MCP_ENV_PATH` its `.env`.

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
