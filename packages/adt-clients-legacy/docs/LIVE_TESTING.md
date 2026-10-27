# Live checks against a 7.40 system: an overlay and an environment of its own

The live checks of `@mcp-abap-adt/adt-clients-legacy`
(`src/__tests__/integration/legacy/`, run from `packages/adt-clients-legacy`)
run against a SAP_BASIS 7.40 SP04 system over RFC. They use the harness of
`packages/adt-clients` (the overlay loader, the session configuration, the
recorder, the header pairs) by relative path, so the configuration is that
package's: the tracked base and an overlay of its own per system, named for
every run by `MCP_TEST_OVERLAY` (resolved against `packages/adt-clients`; see
[Test Config Schema](../../adt-clients/docs/development/TEST_CONFIG_SCHEMA.md)):

- In `packages/adt-clients`:
  `MCP_TEST_OVERLAY=src/__tests__/helpers/test-config.overlay.<system>.yaml npm run test:init -- onprem`,
  then fill in the required keys and add the legacy block of this package's
  form (`src/__tests__/helpers/overlays/legacy.yaml`, every line commented):
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
| `npm run legacy:teardown` | runs teardown — locks, every ZLG7 object in scope (fixtures included), inactive versions; deletes the DDL sources over ADT; runs remove — every marked request of the user (none is ever released), the TADIR entries no request holds any more, package `ZLG7_TEST` on a fresh marked request, that request and the package's entry; then deletes the env classes over ADT (`ZCL_LG7_ENV_RUN` too, where a manual setup left it) — only when REMOVE reported no error, so it can run again. A credential refusal stops it at once |
| `npm run legacy:uninstall` | deletes only the env classes over ADT — `ZCL_LG7_ENV`, its runners and `ZCL_LG7_ENV_RUN`, each that is there, in `$TMP` and of the session user; the manual runner's last step |

`npm run check:config` (also run before `test:live`) reads that one overlay
with the root's keys and the legacy keys, and says what does not fit. The root
package's own `check:config` knows the root keys only and refuses such an
overlay by its legacy keys: it is the check for a modern system's overlay.

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
`deleted, recorded in the request` and its row is left to the request until
`REMOVE` has deleted that request; then it is purged.
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
npm run test:live
npm run legacy:teardown        # when the environment is no longer needed
```

`npm run legacy:uninstall` deletes only the env classes (`ZCL_LG7_ENV`, its
runners, `ZCL_LG7_ENV_RUN`) over ADT — each that is there, in `$TMP` and of the
session user. `legacy:teardown` does that itself with the ABAP Unit runner; the
manual runner needs it as its last step.

## The manual runner

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
| 3 | npm | `LEGACY_ENV_REQUEST=<that request> npm run test:live`. Only `LegacyTransportable` reads it; without it that case skips, naming step 2. `STATUS` in SE24 reads the environment at any time (`npm run legacy:status` skips, naming it) |
| 4 | SE24 | `TEARDOWN` — locks, every ZLG7 object in scope (fixtures included), inactive versions; DDL sources are left for ADT, the request is kept |
| 5 | npm | `npm run legacy:teardown` — deletes the named DDL sources over ADT, nothing else |
| 6 | SE24 | `REMOVE` — every marked request of the user (none released), the TADIR entries no request holds, package `ZLG7_TEST` on a fresh marked request, that request and the package's entry; each failure stops the later steps. Run step 7 only when its `"ok"` is `true` |
| 7 | npm | `npm run legacy:uninstall` — deletes the env classes over ADT, `ZCL_LG7_ENV_RUN` included |

If step 1 fails on a lock or a leftover a crashed run holds, run `PREPARE`
(step 2) and step 1 again: both are idempotent. With the manual runner the
owner's report does not reach the npm side, so a DDL source the report marks
`LEFT-FOR-ADT` under a name no live case configures is not deleted by steps 1
and 5; `REMOVE` then reports package `ZLG7_TEST` as not empty if such a source
is in it. `LEGACY_ENV_REQUEST` beside `legacy_env.runner: "abap_unit"` is
refused, never ignored.

## The live checks

The suites below, and the nine cycle suites after them, were run whole on 7.40 SP04 on 2026-10-27: 15 suites, 385 tests, all passed (`T6-20261027`, recorded in [LEGACY.md](LEGACY.md)).
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
| `LegacyTransportable.test.ts` | `legacy_transportable` | in package `ZLG7_TEST` on the environment's request: create, lock → update with `corrNr` → unlock; the list and `readMetadata` name the request; lock → `DELETE ?lockHandle=&corrNr=` → unlock — the delete with `corrNr` and the populated list were measured by this suite on 2026-10-26 |

The cycle suites (`src/__tests__/integration/legacy/cycles/`) run one live
cycle per type 7.40 serves, each on its own `ZLG7_C_*` objects created in `$TMP`
by the test and deleted by it, also on failure, and assert the full ordered
request sequence, the status and the effect read back; a step 7.40 refuses is
asserted as the refusal with nothing sent. Each is a `legacy_740` case, off in
the base:

| File | `legacy_740` case |
|---|---|
| `ClassCycle.test.ts` | `legacy_cycle_class` |
| `ProgramCycle.test.ts` | `legacy_cycle_program` |
| `InterfaceCycle.test.ts` | `legacy_cycle_interface` |
| `FunctionGroupCycle.test.ts` | `legacy_cycle_function_group` |
| `FunctionIncludeCycle.test.ts` | `legacy_cycle_function_include` |
| `IncludeCycle.test.ts` | `legacy_cycle_include` |
| `DdlCycle.test.ts` | `legacy_cycle_ddl` |
| `MessageClassCycle.test.ts` | `legacy_cycle_message_class` |
| `UtilsReaders.test.ts` | `legacy_utils_readers` |

The include and the message class are not among the kinds `legacy:setup` knows,
so a crashed run's leftover of those two is removed by hand.

Run them as shown above: `npm run legacy:setup`, then `npm run test:live`, with
`MCP_TEST_OVERLAY` naming the 7.40 system's overlay and `MCP_ENV_PATH` its
`.env`. The package's `header:discovery` (the error corpus with the legacy
clients probed beside the modern ones) needs the root package built first
(`npm run build` at the repository root).

## Test configuration keys

The sections and keys the 7.40 system's overlay sets beside the root package's
(`packages/adt-clients`), registered by this package
(`src/__tests__/helpers/legacyTestConfig.ts`, `test-config.legacy.yaml`,
`scripts/legacyTestConfig.js`): `environment.is_legacy` (boolean),
`legacy_env.software_component`, `legacy_env.transport_layer`,
`legacy_env.runner` and `legacy_740.test_cases[<case>].enabled`. The live checks
(`src/__tests__/integration/legacy/`) are off in the base
(`test-config.legacy.yaml`); the 7.40 system's overlay turns each on
(`legacy_740.test_cases[<case>].enabled: true`, the form in
`src/__tests__/helpers/overlays/legacy.yaml`). They run only when
`environment.is_legacy` is `true` and `environment.connection_type` is `"rfc"`.
Every name carries the prefix `ZLG7` (`ZCL_LG7_*`, `ZIF_LG7_*`, `ZLG7*`,
`Z_LG7_*`), the prefix the test environment (`npm run legacy:setup` /
`legacy:teardown`) cleans and removes.

| Case | Params |
|---|---|
| `legacy_deletes` | the names of a class, program, interface, function group, function module and DDL source that do not exist yet |
| `legacy_refusals_send_nothing` | `class_name`, `program_name`: the fixtures, read for the `200` cases |
| `legacy_unit_runners` | `class_name`, `program_name`, `function_group_name`, `function_module_name`: the fixtures `legacy:setup` creates |
| `legacy_function_include` | `function_group_name`, `include_name` (`L<group>F01`): created and deleted by the test |
| `legacy_transports` | none |
| `legacy_transportable` | `program_name`: created in package `ZLG7_TEST` on the environment's request |
| `legacy_cycle_class`, `legacy_cycle_program`, `legacy_cycle_interface`, `legacy_cycle_function_group`, `legacy_cycle_function_include`, `legacy_cycle_include`, `legacy_cycle_ddl`, `legacy_cycle_message_class`, `legacy_utils_readers` | the names of the objects the cycle creates and deletes (`ZLG7_C_*`; a kind with a prefix of its own in the environment's guard — class `ZCL_LG7_`, interface `ZIF_LG7_`, function module `Z_LG7_`, function include `LZLG7` — keeps it), and for a DDL source its SQL view name |

The 7.40 system's overlay also sets `legacy_env.software_component` and
`legacy_env.transport_layer` — the transportable package `ZLG7_TEST` the
environment creates. The base holds placeholders there, which the environment
refuses. `legacy_env.runner` says how the env actions run: `abap_unit` (the
base) or `manual`, where the client's ABAP Unit risk limit refuses the runner
classes and the owner runs `ZCL_LG7_ENV_RUN` in SE24 (see
[the manual runner](#the-manual-runner)).

```yaml
"legacy_env.software_component": "ZCUSTOMER"
"legacy_env.transport_layer": "ZXYZ"
"legacy_740.test_cases[legacy_transports].enabled": true
```
