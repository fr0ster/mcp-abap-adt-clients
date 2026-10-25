# Test Config Schema

The integration tests read **a base plus an overlay**, merged by the loader
(`loadTestConfig` in `src/__tests__/helpers/test-helper.js`, built on
`scripts/lib/testConfigOverlay.js`):

- **base** — `src/__tests__/helpers/test-config.yaml.template`, tracked. Fixtures,
  test cases, object names, timeouts: everything shared. Never copy it.
- **overlay** — `src/__tests__/helpers/test-config.overlay.yaml`, gitignored. Only
  what differs per system. Nothing that names an installation is tracked: the
  forms under `src/__tests__/helpers/overlays/` (`onprem.yaml`, `cloud.yaml`) are
  empty, with a comment per key and only type-level answers.

This document summarizes the schema used by `BaseTester` and `TestConfigResolver`
(the merged result).

## Setting up

```bash
npm run test:init -- onprem      # or: cloud — copies the form to test-config.overlay.yaml
# fill in every <PLACEHOLDER> in src/__tests__/helpers/test-config.overlay.yaml
npm run check:config             # does the overlay fit the base?
```

`test:init` does not guess the system type and never overwrites an overlay.

**One overlay per system.** A checkout that runs against several systems keeps
one overlay for each, and `MCP_TEST_OVERLAY` names the one a run reads —
relative to the repository root, or absolute. The pattern
`src/__tests__/helpers/test-config.overlay.*.yaml` is gitignored:

```bash
MCP_TEST_OVERLAY=src/__tests__/helpers/test-config.overlay.<system>.yaml npm run test:init -- onprem
MCP_TEST_OVERLAY=src/__tests__/helpers/test-config.overlay.<system>.yaml npm run check:config
MCP_TEST_OVERLAY=src/__tests__/helpers/test-config.overlay.<system>.yaml \
  MCP_ENV_PATH=~/.config/mcp-abap-adt/sessions/<system>.env npm test -- <path>
```

`test:init`, `test-config:migrate`, `check:config` and the loader all read the
variable. A named overlay that does not exist is refused; the default
`test-config.overlay.yaml` is never read in its place. The overlay says what the
system holds; which system and which user a run reaches is `MCP_ENV_PATH`'s, so
a run names both.

**Migrating from the old full `test-config.yaml`.** A full local copy is no longer
read: the loader refuses to start while it exists, because a copy goes stale when
the base moves (a section realigned by hand once replaced three on-prem values with
template placeholders). Run `npm run test-config:migrate`: it reads the old file,
writes `test-config.overlay.yaml` with the allowed keys' values (it prints key
names, never values) and refuses to overwrite an existing overlay. Then delete the
old file. If the old file lacks a required key, nothing is written and the key is
named.

## The overlay

Keys are written **flat**: each key is a path into the base, one per line. A test
case inside a list is picked by its `name` in brackets.

```yaml
"environment.system": "onprem"
"environment.default_package": "ZMY_PKG"
"create_package.test_cases[adt_package].params.package_name": "ZMY_PKG"
```

Only the keys in `ALLOWED_OVERLAY_KEYS` (`scripts/lib/testConfigOverlay.js`) may
appear; anything else is refused by name. The list:

| Key | |
|---|---|
| `environment.system`, `.default_package`, `.default_transport`, `.default_master_system` | required |
| `environment.verify_lock_released`, `environment.read_message_class_after_create` — booleans: whether the second-session lock-release check, and the message class's read right after its create, are made on this system. On, any refusal (a 404 included) fails; off, nothing is sent and the run logs a line naming the key. The forms state `true` on premise, `false` on cloud | required |
| `environment.validate_transformation_names` — boolean: whether the transformation flows validate the name (`/sap/bc/adt/xslt/validation`) before the create. On, any refusal (a 404 included) fails; off, nothing is sent and the run logs a line naming the key. The forms state `true`; `false` where the system has no such resource (a 404, measured on an on-premise system) | required |
| `shared_dependencies.package`, `.super_package`, `.software_component`, `.transport_layer`, `.record_changes` | required |
| `create_package.test_cases[adt_package].params.package_name`, `.software_component`, `.transport_layer` | required |
| `create_transport.test_cases[builder_transport].params.target_system` | required |
| `environment.connection_type` | optional (`"rfc"` / `"http"`) |
| `…[adt_scalar_function].params.scalar_function_name`, `…[adt_scalar_function_implementation].params.implementation_name`, `…[adt_append_structure].params.append_structure_name` | optional |
| `create_scalar_function…[adt_scalar_function].enabled`, `create_scalar_function_implementation…[adt_scalar_function_implementation].enabled`, `create_append_structure…[adt_append_structure].enabled`, `create_feature_toggle…[adt_feature_toggle].enabled`, `check_run…[class_check].enabled` — whether the case runs on this system; a refusal fails the test, it is never read as "not available here" | optional |
| `create_function_module…[adt_function_module].params.function_group_route`, `create_function_include…[adt_function_include].params.function_group_route` — `"shared"` (the base: the shared function group in the shared package) or `"default_package"` (the group in the case's or the default package, for a system with no shared package); the route's failure fails the test, the other route is never a recovery | optional |
| `atc_run…[adt_atc_run].enabled`, `.params.check_variant`, `.params.expected_message_id`, `.params.expected_priority`; `atc_object_kinds…[adt_atc_object_kinds].enabled`, `.params.check_variant` | optional |
| `enhancement.test_cases[program_host].params.program_name`, `[function_group_host].params.function_group_name`, `[include_host].params.include_name`, `.main_program` | optional |
| `environment.is_legacy` (boolean), `legacy_env.software_component`, `legacy_env.transport_layer`, `legacy_740.test_cases[<case>].enabled` for each of `legacy_deletes`, `legacy_refusals_send_nothing`, `legacy_unit_runners`, `legacy_function_include`, `legacy_transports`, `legacy_transportable` — a legacy system (SAP_BASIS < 7.50): its client, its live checks (off in the base) and the transportable package of its test environment; the base's `legacy_env` placeholders are refused when the environment is built | optional |

**Required** keys are those whose base line carries `# ← CHANGE` and holds only a
placeholder: the overlay must state them (an empty string is a statement), and the
loader refuses an overlay without one, naming it. An **optional** key has a valid
default in the base. `testConfigOverlay.test.ts` keeps the list and the template's
`← CHANGE` markers in step: a required key without the marker, and a marked line
whose key is not in the list, both fail the unit tests.

**Values are typed** (the rules live next to each key in `ALLOWED_OVERLAY_KEYS`).
An empty entry (`key:` with nothing after it, YAML `null`) is refused for every
key, because a consumer that finds a value absent falls back to another key
(an empty `shared_dependencies.package` once meant "use `default_package`").
`record_changes` and the `enabled` flags must be real booleans (`"true"` in quotes
is refused), `expected_priority` an integer, `environment.system` one of `onprem` /
`cloud`, `connection_type` one of `rfc` / `http`. A string must be non-empty except
where `""` is a statement: `default_transport` and the transport layers (a local
package or a cloud system has none), `default_master_system` and `target_system`
(cloud), the shared `software_component` (cloud), and `check_variant` (`""` asks
the system for its nominated variant). Every invalid key is reported in one error.

**The merged result is checked too.** After the merge, no `<PLACEHOLDER>` may remain
in `environment`, in `shared_dependencies`, or in any param of an *enabled* test
case. So turning `atc_run` on (`enabled: true`) without a `check_variant` of your own
is refused: the base's `<CHECK_VARIANT>` would reach the system. A disabled case may
keep its placeholders.

Also refused, each with the key named: a value that is still a `<PLACEHOLDER>`, a
nested value (keys are flat), a path the base does not have, and an overlay that is
not YAML. With **no overlay** the base alone is loaded with a warning, its values
being placeholders: the integration tests then register as configuration defects
(`isTestConfigTemplate()`), not as skips.

## Top-Level Keys

- `test_settings` - global toggles and defaults.
- `environment` - default package/transport, cleanup settings.
- `standard_objects` - registry of existing SAP objects for read-only tests.
- `<handler_name>` - per-test definitions (e.g., `create_class`, `read_service_definition`).
  - runtime handlers include `runtime_dumps` and `execute_class`.
  - `runtime_memory_snapshots` is kept as TODO (disabled) until endpoint compatibility is finalized.

## test_settings

```yaml
test_settings:
  allow_406: false
  operation_delays:
    create: 3000
    update: 3000
    lock: 3000
    unlock: 3000
    activate: 3000
    delete: 3000
    default: 3000
```

## environment

```yaml
environment:
  default_package: "ZPKG"
  default_transport: ""
  skip_cleanup: false
  cleanup_after_test: true
```

A legacy system (BASIS < 7.50) says so in its overlay, and its live checks
need `connection_type: "rfc"` beside it — the legacy client is supported over
RFC only; over HTTP they skip and say so:

```yaml
"environment.system": "onprem"
"environment.connection_type": "rfc"
"environment.is_legacy": true
```

## shared_dependencies

Persistent objects created via `npm run shared:setup`, deleted via `npm run shared:teardown`.
Each item supports `available_in` to control which environments it is created/deleted on.

```yaml
shared_dependencies:
  package: "ZAC_SHR_PKG"
  transport_request: ""
  tables:
    - name: "ZAC_SHR_ITABL"
      source: "..."
  views:
    - name: "ZAC_SHR_CDSUT_DDLS"
      source: "..."
  access_controls:
    - name: "ZAC_SHR_AC01"
      source: "..."
  behavior_definitions:
    - name: "ZAC_SHR_BIMP_DDLS"
      source: "..."
  service_definitions:
    - name: "ZAC_SHR_SRVD01"
      source: "..."
  classes:
    - name: "ZAC_SHR_RUN01"
      source: "..."
  interfaces:
    - name: "ZAC_SHR_IF01"
      source: "..."
  function_groups:
    - name: "ZAC_SHR_FUGR"
  function_modules:
    - name: "Z_AC_SHR_FM01"
      function_group: "ZAC_SHR_FUGR"
      source: "..."
  programs:
    - name: "ZAC_SHR_PROG"
      available_in: ["onprem", "legacy"]
```

Supported object types: `tables`, `views`, `access_controls`, `behavior_definitions`, `service_definitions`, `classes`, `interfaces`, `function_groups`, `function_modules`, `programs`.

## standard_objects

Used by read-only tests and shared utility tests. Each entry supports `available_in`.

```yaml
standard_objects:
  classes:
    - name: "ZAC_SHR_RUN01"
      available_in: ["onprem", "cloud"]
  interfaces:
    - name: "ZAC_SHR_IF01"
      available_in: ["onprem", "cloud"]
  service_definitions:
    - name: "ZAC_SHR_SRVD01"
      available_in: ["onprem", "cloud"]
  tables:
    - name: "T000"
      available_in: ["onprem"]
```

## Test Case Definition

Each handler has `test_cases` with `enabled`, `description`, and `params`:

```yaml
create_class:
  test_cases:
    - name: "adt_class"
      enabled: true
      description: "Create test class"
      params:
        class_name: "ZAC_CLS01"
        description: "Test"
        source_code: |
          CLASS ZAC_CLS01 DEFINITION.
```

Runtime examples:

```yaml
runtime_dumps:
  test_cases:
    - name: "adt_runtime_dumps"
      enabled: true
      params:
        top: 20
        inlinecount: "allpages"
        user: ""
        dump_id: ""

runtime_memory_snapshots:
  test_cases:
    - name: "adt_runtime_memory_snapshots"
      enabled: false
      params:
        user: ""
        original_user: ""
        snapshot_id: ""
```

### Common Params

- `package_name`, `transport_request`
- `operation_delays` (override per test)
- object-specific params (class_name, table_name, etc.)

## Available In

Use `available_in` to scope tests:

```yaml
available_in: ["onprem"]
```

## Group Activation

Tests multi-object activation (domain + data element + structure):

```yaml
group_activation:
  test_cases:
    - name: "adt_group_activation"
      enabled: true
      params:
        domain_name: "ZAC_DOM_GA01"
        data_element_name: "ZAC_DTEL_GA01"
        structure_name: "ZAC_STRU_GA01"
        structure_ddl_code: |
          define structure zac_stru_ga01 {
            mandt   : abap.clnt;
            ga_field : zac_dtel_ga01;
          }
```

The test includes pre-cleanup (delete leftovers from failed previous runs) and guaranteed unlock via try/finally.

## legacy_740

The live checks of the legacy client (`src/__tests__/integration/legacy/`) on a
SAP_BASIS 7.40 SP04 system. Off in `test-config.yaml.template`; the 7.40
system's overlay turns each on (`legacy_740.test_cases[<case>].enabled: true`,
the form's legacy block in `overlays/onprem.yaml`). They run only when
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

The 7.40 system's overlay also sets `legacy_env.software_component` and
`legacy_env.transport_layer` — the transportable package `ZLG7_TEST` the
environment creates. The base holds placeholders there, which the environment
refuses.

```yaml
"legacy_env.software_component": "ZCUSTOMER"
"legacy_env.transport_layer": "ZXYZ"
"legacy_740.test_cases[legacy_transports].enabled": true
```

## Notes

- `BaseTester` resolves params via `TestConfigResolver`.
- Read-only tests pull names from `standard_objects` if not provided in params.
- Shared dependencies use `available_in` to skip objects not available in certain environments (e.g. programs are not available on cloud).
- Setup/teardown scripts respect `available_in` — items are skipped if the current environment doesn't match.
