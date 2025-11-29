# Operation Delays in Builder Tests

## Overview

Builder integration tests use configurable delays between SAP operations to ensure the system has time to commit state changes. Without these delays, tests may fail with 404 errors or lock handle errors due to SAP's asynchronous processing.

## Configuration

### Global Configuration (test-config.yaml)

Set default delays for all tests in `src/__tests__/helpers/test-config.yaml`:

```yaml
test_settings:
  # Operation delays (milliseconds)
  operation_delays:
    lock: 3000      # Delay after lock operation
    unlock: 3000    # Delay after unlock operation
    update: 3000    # Delay after update operation
    create: 3000    # Delay after create operation
    default: 3000   # Default delay for any operation
```

**Default values**: 3000ms (3 seconds) for all operations.

### Test-Specific Overrides

Override delays for individual test cases by adding `operation_delays` to the test case params:

```yaml
create_class:
  test_cases:
    - name: "builder_class"
      enabled: true
      params:
        class_name: "ZADT_BLD_CLS01"
        description: "Test class"
        # Override delays for this specific test
        operation_delays:
          lock: 5000      # 5 seconds for lock (slower system)
          unlock: 4000    # 4 seconds for unlock
          update: 5000    # 5 seconds for update
          create: 3000    # 3 seconds for create
```

## Usage in Tests

Import the helper function:

```typescript
const {
  getOperationDelay
} = require('../../helpers/test-helper');
```

Use it in your test delays:

```typescript
// After lock operation
await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));

// After update operation
await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));

// After unlock operation
await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));

// After create operation
await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
```

## Delay Resolution Order

The `getOperationDelay(operation, testCase)` function resolves delays in this priority:

1. **Test case override**: `testCase.params.operation_delays[operation]`
2. **Global operation delay**: `test_settings.operation_delays[operation]`
3. **Legacy delay setting**: `test_settings.timeouts.delay`
4. **Hardcoded default**: `3000` ms

## When to Use Delays

Add delays after these critical operations:

### 1. After `create()`
```typescript
await builder.create();
await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
```
**Why**: SAP needs time to commit object metadata before the object can be locked or read.

### 2. After `lock()`
```typescript
await builder.lock();
await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
```
**Why**: Lock state must be persisted before update operations can proceed.

### 3. After `update()`
```typescript
await builder.update();
await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
```
**Why**: Source code changes need time to be stored before checks or activation.

### 4. After `unlock()`
```typescript
await builder.unlock();
await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
```
**Why**: Lock must be released completely before activation can succeed.

## Common Issues

### Tests Pass Individually But Fail in Groups

**Symptom**: Tests pass when run alone but fail with 404 or lock errors when run as a suite.

**Solution**: Increase operation delays in `test-config.yaml`:

```yaml
test_settings:
  operation_delays:
    lock: 5000      # Increase from 3s to 5s
    unlock: 5000
    update: 5000
    create: 5000
```

### Tests Fail on Slower SAP Systems

**Symptom**: Tests consistently fail with timing-related errors on cloud or slower systems.

**Solution**: Use test-specific overrides for problematic tests:

```yaml
create_class:
  test_cases:
    - name: "builder_class_slow_system"
      enabled: true
      params:
        class_name: "ZADT_BLD_CLS01"
        operation_delays:
          lock: 10000     # 10 seconds for very slow systems
          unlock: 10000
          update: 10000
          create: 10000
```

## Implementation Status

### Updated Files

**Core Infrastructure:**
- ✅ `src/__tests__/helpers/test-helper.js` - Added `getOperationDelay()` function
- ✅ `src/__tests__/helpers/test-config.yaml` - Added `operation_delays` section with 3s defaults
- ✅ `src/__tests__/helpers/test-config.yaml.template` - Added configuration template with examples
- ✅ `jest.config.js` - Configured for sequential test execution (`maxWorkers: 1`, `maxConcurrency: 1`)

**Builder Tests (All Updated):**
- ✅ `ClassBuilder.test.ts` - Uses `getOperationDelay()` for lock, update, unlock
- ✅ `InterfaceBuilder.test.ts` - Uses `getOperationDelay()` for create, lock, update, unlock  
- ✅ `ViewBuilder.test.ts` - Uses `getOperationDelay()` for create, lock, update, unlock
- ✅ `ProgramBuilder.test.ts` - Uses `getOperationDelay()` for create, lock, update, unlock
- ✅ `TableBuilder.test.ts` - Uses `getOperationDelay()` for create, lock, update, unlock
- ✅ `StructureBuilder.test.ts` - Uses `getOperationDelay()` for create, lock, update, unlock
- ✅ `DomainBuilder.test.ts` - Uses `getOperationDelay()` for create, lock, update, unlock

**Tests Not Requiring Delays:**
- ❌ `TransportBuilder.test.ts` - No lock/unlock workflow
- ❌ `PackageBuilder.test.ts` - Has hardcoded 2s delays (different workflow)

**Documentation:**
- ✅ `docs/OPERATION_DELAYS.md` - Comprehensive guide (this file)

## Performance Tuning

### For Fast Systems
Reduce delays to speed up test execution:

```yaml
test_settings:
  operation_delays:
    lock: 1000      # 1 second might be enough
    unlock: 1000
    update: 1000
    create: 1000
```

### For Slow/Cloud Systems
Increase delays for reliability:

```yaml
test_settings:
  operation_delays:
    lock: 5000      # 5 seconds for safety
    unlock: 5000
    update: 5000
    create: 5000
```

### For Development
Use longer delays to ensure test stability:

```yaml
test_settings:
  operation_delays:
    default: 5000   # Conservative default
```

## API Reference

### `getOperationDelay(operation, testCase?)`

Returns the delay in milliseconds for a specific operation.

**Parameters**:
- `operation` (string): Operation type - `'lock'`, `'unlock'`, `'update'`, `'create'`, or `'default'`
- `testCase` (object, optional): Test case object with potential `params.operation_delays` override

**Returns**: Number (milliseconds)

**Example**:
```typescript
const delay = getOperationDelay('lock', testCase);
// Returns test-specific override, global setting, or default (3000ms)
```

## Migration Guide

### Migration from Hardcoded to Configurable Delays

**Changes Made:**

1. **Increased default delays**: Changed from 2 seconds to **3 seconds** for better reliability
2. **Centralized configuration**: All delays now configurable via YAML
3. **Test-specific overrides**: Each test can have custom delays
4. **Sequential execution**: Tests always run one at a time to prevent SAP object conflicts

### Before (Hardcoded Delays - v0.x.x)
```typescript
await builder.lock();
await new Promise(resolve => setTimeout(resolve, 2000)); // Hardcoded 2s
```

### After (Configurable Delays - v1.x.x)
```typescript
await builder.lock();
await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
// Uses 3s by default, configurable in YAML
```

## Code Changes Summary

### Modified Files (19 total)

**Configuration Files (3):**
1. `src/__tests__/helpers/test-helper.js` - Added `getOperationDelay(operation, testCase)` function
2. `src/__tests__/helpers/test-config.yaml` - Added `operation_delays` section  
3. `src/__tests__/helpers/test-config.yaml.template` - Added template with examples
4. `jest.config.js` - Added `maxConcurrency: 1` for strict sequential execution

**Test Files (7 Builder tests):**
5. `src/__tests__/integration/class/ClassBuilder.test.ts`
6. `src/__tests__/integration/interface/InterfaceBuilder.test.ts`
7. `src/__tests__/integration/view/ViewBuilder.test.ts`
8. `src/__tests__/integration/program/ProgramBuilder.test.ts`
9. `src/__tests__/integration/table/TableBuilder.test.ts`
10. `src/__tests__/integration/structure/StructureBuilder.test.ts`
11. `src/__tests__/integration/domain/DomainBuilder.test.ts`

**Each test file updated:**
- Imported `getOperationDelay` from test-helper
- Replaced hardcoded delays (1000ms, 2000ms, 3000ms) with `getOperationDelay()` calls
- Added delays after: `create()`, `lock()`, `update()`, `unlock()` operations

## Troubleshooting

### Test Fails with "Object not found" after create()
- **Increase** `create` delay: Object metadata not yet committed
- Check SAP system performance

### Test Fails with "Invalid lock handle" after lock()
- **Increase** `lock` delay: Lock state not yet persisted
- Verify lock was successful before proceeding

### Test Fails during update()
- **Increase** `update` delay: Source code not yet stored
- Check for SAP errors in response

### Test Fails during activate() after unlock()
- **Increase** `unlock` delay: Lock not fully released
- Verify unlock was successful

## Best Practices

1. **Start with defaults**: Use 3000ms (3 seconds) as baseline
2. **Tune per environment**: Adjust based on SAP system performance
3. **Test in groups**: Always test with full suite, not individual tests
4. **Use overrides sparingly**: Only for specific problematic tests
5. **Document reasons**: Comment why specific delays are increased
6. **Monitor CI/CD**: Adjust delays if tests become flaky in automation

## Related Documentation

- [Test Configuration Schema](./TEST_CONFIG_SCHEMA.md)
- [Builder Test Pattern](./BUILDER_TEST_PATTERN.md)
- [Stateful Session Guide](./STATEFUL_SESSION_GUIDE.md)
