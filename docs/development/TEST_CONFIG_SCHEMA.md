# Test Config Schema

All integration tests use `src/__tests__/helpers/test-config.yaml`.
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

## Notes

- `BaseTester` resolves params via `TestConfigResolver`.
- Read-only tests pull names from `standard_objects` if not provided in params.
- Shared dependencies use `available_in` to skip objects not available in certain environments (e.g. programs are not available on cloud).
- Setup/teardown scripts respect `available_in` — items are skipped if the current environment doesn't match.
