# Test Cleanup Status

Status of integration tests regarding cleanup_after_test and skip_cleanup parameter support.

## Cleanup Parameters

- **`cleanup_after_test`** (global): If `false`, cleanup is disabled globally. Default: `true` if not set.
- **`skip_cleanup`** (test-specific or global): If `true`, cleanup is skipped for specific test or globally.

Cleanup should be performed only if:
- `cleanup_after_test !== false` AND
- `skip_cleanup !== true`

## Test Status

### ✅ Updated (Cleanup parameters checked)

| Test File | Status | Notes |
|-----------|--------|-------|
| `table/Table.test.ts` | ✅ Complete | Cleanup checked in test body and catch block |
| `view/View.test.ts` | ✅ Complete | Cleanup checked in test body, catch block, and afterEach |
| `functionModule/FunctionModule.test.ts` | ✅ Complete | Cleanup checked in test body and catch block |
| `serviceDefinition/ServiceDefinition.test.ts` | ✅ Complete | Cleanup checked in test body, catch block, and finally |

### ✅ Updated (Cleanup parameters checked)

| Test File | Status | Notes |
|-----------|--------|-------|
| `dataElement/DataElement.test.ts` | ✅ Complete | Cleanup checked in test body and afterEach |
| `class/Class.test.ts` | ✅ Complete | Cleanup checked in test body and catch block |
| `interface/Interface.test.ts` | ✅ Complete | Cleanup checked in test body and catch block |
| `domain/Domain.test.ts` | ✅ Complete | Cleanup checked in test body and catch block |
| `structure/Structure.test.ts` | ✅ Complete | Cleanup checked in test body and catch block |
| `behaviorDefinition/BehaviorDefinition.test.ts` | ✅ Complete | Cleanup checked in catch block and finally |
| `behaviorImplementation/BehaviorImplementation.test.ts` | ✅ Complete | Cleanup checked in catch block and finally |
| `metadataExtension/MetadataExtension.test.ts` | ✅ Complete | Cleanup checked in catch block and finally |
| `functionGroup/FunctionGroup.test.ts` | ✅ Complete | Cleanup checked in test body and catch block |
| `package/Package.test.ts` | ✅ Complete | Cleanup checked in test body and catch block |
| `program/Program.test.ts` | ✅ Complete | Cleanup checked in test body and catch block |

### ℹ️ No Cleanup Required

| Test File | Reason |
|-----------|--------|
| `class/run.test.ts` | Read-only test (unit test execution) |
| `shared/*.test.ts` | Shared utilities, no object creation |
| `transport/Transport.test.ts` | Transport operations, no object cleanup needed |

## Implementation Pattern

All tests should follow this pattern:

```typescript
// At the start of test (after config setup)
const envConfig = getEnvironmentConfig();
const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
const globalSkipCleanup = envConfig.skip_cleanup === true;
const skipCleanup = testCase.params.skip_cleanup !== undefined
  ? testCase.params.skip_cleanup === true
  : globalSkipCleanup;
const shouldCleanup = cleanupAfterTest && !skipCleanup;

// In test body (successful completion)
if (shouldCleanup) {
  await client.getObject().delete({ ... });
} else {
  testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - object left for analysis: ${objectName}`);
}

// In catch block (error cleanup)
if (shouldCleanup && objectCreated) {
  try {
    await client.getObject().delete({ ... });
  } catch (cleanupError) {
    testsLogger.warn?.(`Cleanup failed:`, cleanupError);
  }
} else if (!shouldCleanup && objectCreated) {
  testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - object left for analysis: ${objectName}`);
}

// In finally block (if present)
if (shouldCleanup && objectCreated) {
  try {
    await client.getObject().delete({ ... });
  } catch (cleanupError) {
    testsLogger.warn?.(`Cleanup failed:`, cleanupError);
  }
} else if (!shouldCleanup && objectCreated) {
  testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - object left for analysis: ${objectName}`);
}

// In afterEach (if present)
const envConfig = getEnvironmentConfig();
const cleanupAfterTest = envConfig.cleanup_after_test !== false;
const globalSkipCleanup = envConfig.skip_cleanup === true;
const skipCleanup = testCase?.params?.skip_cleanup !== undefined
  ? testCase.params.skip_cleanup === true
  : globalSkipCleanup;
const shouldCleanup = cleanupAfterTest && !skipCleanup;

if (shouldCleanup && objectCreated && objectName) {
  try {
    await client.getObject().delete({ ... });
  } catch (error) {
    testsLogger.warn?.(`Failed to cleanup:`, error);
  }
} else if (!shouldCleanup && objectCreated && objectName) {
  testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - object left for analysis:`, objectName);
}
```

## Required Import

All tests need to import `getEnvironmentConfig`:

```typescript
const {
  // ... other imports
  getEnvironmentConfig
} = require('../../helpers/test-helper');
```

## Summary

- **Total tests with cleanup:** 15
- **Updated:** 15 ✅ (All tests now check cleanup_after_test and skip_cleanup)
- **Pending:** 0
- **No cleanup needed:** 3+ (run.test.ts, shared/*, transport/*)

## Last Updated

2025-12-11 - All tests updated to check cleanup_after_test and skip_cleanup parameters

## Verification

All 15 tests with cleanup operations now properly check:
- `cleanup_after_test` (global parameter) - defaults to `true` if not set
- `skip_cleanup` (test-specific or global parameter) - if `true`, cleanup is skipped

Cleanup is performed only when: `cleanup_after_test !== false` AND `skip_cleanup !== true`
