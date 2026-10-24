# Test Config Schema

All integration tests use `src/__tests__/helpers/test-config.yaml`, unless
`MCP_TEST_CONFIG_PATH` names another file — then that file or the run fails
naming it, with no fallback (the 7.40 system's own configuration,
`test-config.legacy-740.yaml`, is loaded this way; see
[RFC_TESTING.md](RFC_TESTING.md#the-740-system-a-configuration-and-an-environment-of-its-own)).
This document summarizes the current schema used by `BaseTester` and `TestConfigResolver`.

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

A legacy system (BASIS < 7.50) is `is_legacy: true`, and its live checks need
`connection_type: "rfc"` beside it — the legacy client is supported over RFC
only; over HTTP they skip and say so:

```yaml
environment:
  system: "onprem"
  connection_type: "rfc"
  is_legacy: true
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
SAP_BASIS 7.40 SP04 system. Disabled in `test-config.yaml.template`; all enabled
in `test-config.legacy-740.yaml.template`. They run only when
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

The 7.40 template also carries `legacy_env` — `software_component` and
`transport_layer` of the transportable package `ZLG7_TEST` the environment
creates.

```yaml
legacy_740:
  test_cases:
    - name: "legacy_transports"
      enabled: true
      available_in: ["legacy"]
      params: {}
```

## Notes

- `BaseTester` resolves params via `TestConfigResolver`.
- Read-only tests pull names from `standard_objects` if not provided in params.
- Shared dependencies use `available_in` to skip objects not available in certain environments (e.g. programs are not available on cloud).
- Setup/teardown scripts respect `available_in` — items are skipped if the current environment doesn't match.
