# Test Config Schema

All integration tests use `src/__tests__/helpers/test-config.yaml`.
This document summarizes the current schema used by `BaseTester` and `TestConfigResolver`.

## Top-Level Keys

- `test_settings` - global toggles and defaults.
- `environment` - default package/transport, cleanup settings.
- `standard_objects` - registry of existing SAP objects for read-only tests.
- `<handler_name>` - per-test definitions (e.g., `create_class`, `read_service_definition`).

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

## standard_objects

Used by read-only tests and shared utility tests.

```yaml
standard_objects:
  classes:
    - name: "CL_ABAP_CHAR_UTILITIES"
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
        class_name: "ZADT_CLS01"
        description: "Test"
        source_code: |
          CLASS ZADT_CLS01 DEFINITION.
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

## Notes

- `BaseTester` resolves params via `TestConfigResolver`.
- Read-only tests pull names from `standard_objects` if not provided in params.
