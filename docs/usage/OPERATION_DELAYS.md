# Operation Delays in Integration Tests

Integration tests use configurable delays between ADT operations to avoid transient 404/lock issues in SAP.

## Configuration

Set defaults in `src/__tests__/helpers/test-config.yaml`:

```yaml
test_settings:
  operation_delays:
    create: 3000
    update: 3000
    lock: 3000
    unlock: 3000
    activate: 3000
    delete: 3000
    default: 3000
```

Override per test case with `params.operation_delays`.

## BaseTester Behavior

`BaseTester` reads delays via `TestConfigResolver` and applies them around create/update/activate/delete steps.
You usually do not need to add manual sleeps in tests that use `BaseTester`.

## When You Still Need Manual Delays

Only when a test bypasses `BaseTester` and calls low-level functions directly.
