# Test Fixes Roadmap

**⚠️ ARCHIVED: This file is no longer active**  
**Current roadmap:** [../TEST_STRATEGY.md](../TEST_STRATEGY.md)

---

**Created:** 2025-11-17  
**Status:** ✅ Phase 1-2 Complete, ✅ Timeout Configuration Complete  
**Updated:** 2025-11-17  
**Goal:** Ensure tests properly handle authentication, save lock handles, cleanup test objects, and use centralized timeout configuration

---

## ✅ Recent Completions

### 🎯 Timeout Configuration System (NEW - COMPLETED 2025-11-17)
**Status:** ✅ COMPLETED

**Achievement:**
- Created centralized timeout configuration in `test-config.yaml`
- Added `getTimeout(operationType, handlerName?)` function to `test-helper.js`
- Migrated **80 test files** from hardcoded timeouts to YAML-based configuration
- Supports operation-specific defaults and optional handler-specific overrides

**Configuration in test-config.yaml:**
```yaml
test_settings:
  timeouts:
    default: 10000    # 10 seconds
    create: 10000     # Fast - create empty object
    read: 10000       # Fast - read metadata/source
    check: 10000      # Fast - syntax check
    lock: 10000       # Fast - lock object
    unlock: 10000     # Fast - unlock object
    update: 15000     # Medium - update content (slower)
    activate: 15000   # Medium - activate object (slower)
    delete: 10000     # Fast - delete object
    # Handler-specific overrides (optional):
    # create_class: 12000
```

**Usage pattern:**
```typescript
import { getTimeout } from '../../../../tests/test-helper';

it('should create object', async () => {
  // test code
}, getTimeout('create')); // Returns 10000 from YAML config
```

**Benefits:**
- ✅ Single source of truth for all timeouts
- ✅ Easy to adjust per operation type or specific handler
- ✅ Operation-specific defaults (10s for fast ops, 15s for slower)
- ✅ No more hardcoded `30000` or `15000` scattered across tests

---

## 📋 Issues Identified

### 1. ❌ Authentication / Connection Pattern
**Problem:** Some tests don't call `await connection.connect()` in setup, so auto-refresh doesn't trigger early and test fails with error in test body instead of SKIP.

**Files with issues:**
- `class/lock.test.ts` - doesn't call `connect()` in setup
- `view/lock.test.ts` - doesn't call `connect()` in setup
- `table/lock.test.ts` - doesn't call `connect()` in setup
- `interface/lock.test.ts` - doesn't call `connect()` in setup
- `domain/lock.test.ts` - doesn't call `connect()` in setup
- `program/lock.test.ts` - doesn't call `connect()` in setup
- `package/lock.test.ts` - doesn't call `connect()` in setup
- `functionGroup/lock.test.ts` - doesn't call `connect()` in setup
- `dataElement/lock.test.ts` - doesn't call `connect()` in setup
- `structure/lock.test.ts` - doesn't call `connect()` in setup

**Expected behavior:**
- ✅ `beforeEach/beforeAll` calls `await (connection as any).connect()`
- ✅ In `catch` calls `markAuthFailed(TEST_SUITE_NAME)`
- ✅ Tests skip if `hasAuthFailed(TEST_SUITE_NAME) === true`

---

### 2. ❌ Lock Persistence (saving lockHandles)
**Problem:** Tests obtain lockHandle but DON'T save it to `.locks/active-locks.json`, so unlock utilities can't find it.

**Files WITHOUT lockHandle saving:**
- ❌ `class/lock.test.ts`
- ❌ `view/lock.test.ts`
- ❌ `table/lock.test.ts`
- ❌ `interface/lock.test.ts`
- ❌ `domain/lock.test.ts`
- ❌ `program/lock.test.ts`
- ❌ `package/lock.test.ts`
- ❌ `functionGroup/lock.test.ts`
- ❌ `dataElement/lock.test.ts`
- ❌ `structure/lock.test.ts`

**Files WITH lockHandle saving:**
- ✅ `functionModule/lock.test.ts` (fixed)
- ✅ `functionModule/create.test.ts` (partially fixed)

**Expected behavior:**
```typescript
// After successful lock
if (lockTracking?.enabled) {
  registerTestLock(objectType, objectName, sessionId, lockHandle, functionGroupName?, __filename);
}

// After successful unlock
if (lockTracking?.enabled) {
  unregisterTestLock(objectType, objectName, functionGroupName?);
}
```

---

### 3. ❌ Post-Test Cleanup
**Problem:** Tests don't unlock objects before deletion, so cleanup fails if object is locked.

**Files with problematic cleanup:**
- ✅ `functionModule/create.test.ts` - partially fixed (unlocks before delete)
- ❌ `class/create.test.ts` - DOESN'T check lock registry before delete
- ❌ `program/create.test.ts` - DOESN'T check lock registry before delete
- ❌ `interface/create.test.ts` - DOESN'T check lock registry before delete
- ❌ `dataElement/create.test.ts` - DOESN'T check lock registry before delete
- ❌ `domain/create.test.ts` - DOESN'T check lock registry before delete
- ❌ `functionGroup/create.test.ts` - DOESN'T check lock registry before delete
- ❌ Other `*/create.test.ts` files

**Expected behavior:**
```typescript
// In cleanup before delete
const savedLock = getTestLock(objectType, objectName, functionGroupName);
if (savedLock) {
  try {
    await unlock...(connection, ..., savedLock.lockHandle, savedLock.sessionId);
    unregisterTestLock(objectType, objectName, functionGroupName);
    logger.debug(`✓ Unlocked ${objectName} using saved lock handle`);
  } catch (err) {
    logger.warn(`⚠️ Test left locked object: ${objectName}. Manual unlock required.`);
    logger.warn(`   Error: ${err.message}`);
  }
}
```

---

### 4. ❌ Test Logging & Skip Reporting
**Problem:** Tests skip silently without explaining why, making it hard to debug issues.

**Solution:** Use `testLogger` with configurable log levels:
- `LOG_LEVEL=error` - Only errors
- `LOG_LEVEL=warn` - Errors + warnings + skip reasons  
- `LOG_LEVEL=info` - Default (errors + warnings + info)
- `LOG_LEVEL=debug` - All logs (same as `DEBUG_TESTS=true`)

**Pattern:**
```typescript
import { createTestLogger } from '../../helpers/testLogger';

const logger = createTestLogger('TestSuiteName');

describe('My Test Suite', () => {
  let testCase: any = null;
  let objectName: string | null = null;

  beforeEach(async () => {
    // Preparation: validate config, fetch test case, cleanup
    if (!hasConfig) {
      logger.skip('Test name', 'Authentication failed');
      testCase = null;
      return;
    }

    const tc = getEnabledTestCase('operation', 'test_id');
    if (!tc) {
      logger.skip('Test name', 'Test case not enabled in test-config.yaml');
      testCase = null;
      return;
    }

    testCase = tc;
    objectName = tc.params.object_name;

    try {
      await deleteObjectIfExists(objectName!);
    } catch (error: any) {
      logger.skip('Test name', `Failed to prepare: ${error.message}`);
      testCase = null;
    }
  });

  it('should do something', async () => {
    if (!testCase) {
      return; // Already logged in beforeEach
    }
    // Test logic
  });
});
```

**Benefits:**
- ✅ Skip reason shown only once (in beforeEach)
- ✅ No duplicate logging
- ✅ Clean separation: preparation vs test execution
- ✅ `LOG_LEVEL=warn` shows skip reasons without debug spam

**Fixed files:**
- ✅ `functionGroup/FunctionGroupBuilder.test.ts` - DONE

**Files to fix:**
- ⏳ All lock.test.ts files (8 files)
- ⏳ All create.test.ts files (~11 files)
- ⏳ Other integration tests

---

## 🎯 Execution Plan

### Phase 1: Lock Tests (HIGH PRIORITY) - 11 files
**Goal:** Add lockHandle persistence + fix auth pattern

**Files to fix:**
1. ✅ `functionModule/lock.test.ts` - DONE
2. ✅ `class/lock.test.ts` - DONE
3. ✅ `functionGroup/lock.test.ts` - DONE (no lock persistence - container object)
4. ✅ `view/lock.test.ts` - DONE
5. ⏳ `table/lock.test.ts` - SKIPPED (not in LockState types)
6. ✅ `interface/lock.test.ts` - DONE
7. ✅ `domain/lock.test.ts` - DONE
8. ✅ `program/lock.test.ts` - DONE
9. ⏳ `package/lock.test.ts` - SKIPPED (not in LockState types)
10. ✅ `dataElement/lock.test.ts` - DONE
11. ⏳ `structure/lock.test.ts` - SKIPPED (not in LockState types)

**Changes per file:**
- [ ] Add imports: `registerTestLock`, `unregisterTestLock` from `../../helpers/lockHelper`
- [ ] Add imports: `setupTestEnvironment`, `markAuthFailed`, `hasAuthFailed` from `../../helpers/sessionConfig`
- [ ] In `beforeEach`: call `setupTestEnvironment()` or at least `await (connection as any).connect()`
- [ ] In `beforeEach catch`: call `markAuthFailed(TEST_SUITE_NAME)`
- [ ] After `lock...()`: call `registerTestLock(...)` if `lockTracking?.enabled`
- [ ] After `unlock...()`: call `unregisterTestLock(...)`

---

### Phase 2: Create Tests Cleanup (MEDIUM PRIORITY) - 11/11 files ✅ COMPLETE
**Goal:** Simplify CREATE tests to only test atomic create operation + apply logging pattern

**Status:** ✅ COMPLETED 2025-11-17

**Files fixed:**
1. ✅ `domain/create.test.ts` - 303→149 lines (-51%), testLogger pattern
2. ✅ `program/create.test.ts` - Updated to testLogger pattern
3. ✅ `class/create.test.ts` - 340→157 lines (-54%), removed lock/unlock/update/activate
4. ✅ `interface/create.test.ts` - Generated with simplified pattern
5. ✅ `view/create.test.ts` - Generated with simplified pattern
6. ✅ `table/create.test.ts` - Generated with simplified pattern
7. ✅ `dataElement/create.test.ts` - Generated with simplified pattern
8. ✅ `structure/create.test.ts` - Generated with simplified pattern
9. ✅ `functionGroup/create.test.ts` - Created with testLogger pattern
10. ✅ `functionModule/create.test.ts` - Created with FG dependency + testLogger
11. ✅ `package/create.test.ts` - Created with correct delete logic (package_name, not super_package)

**Changes per file:**
- [x] ✅ Add import: `createTestLogger` from `../../helpers/testLogger`
- [x] ✅ Remove retry mechanisms with exponential backoff
- [x] ✅ Remove lock/unlock/update/activate sequences (tests ONLY atomic create)
- [x] ✅ Apply deleteIfExists/deleteIgnoringErrors pattern
- [x] ✅ Move validations to `beforeEach` with proper cleanup
- [x] ✅ Use `getTimeout('create')` from YAML config (10 seconds for fast create operations)
- [x] ✅ Fix parameter names to match TypeScript interfaces:
  - class: `super_class` → `superclass`, `is_final` → `final`, `is_abstract` → `abstract`
  - dataElement: `dataElement_name` → `data_element_name`, add `domain_name` parameter
  - structure: add `fields: []` parameter
  - table: `description` → `ddl_code`
  - view: add `ddl_source` parameter
- [x] ✅ Fix function imports:
  - dataElement: `getDataElementMetadata` → `getDataElement`
  - functionGroup: `getFunctionGroupMetadata` → `getFunctionGroup`
  - package: `getPackageMetadata` → `getPackage`, remove `deletePackage` (use `deleteObject`)
- [x] ✅ Special cases:
  - functionModule: Add `ensureFunctionGroupExists()`, fix `getFunctionMetadata(connection, name, groupName)` calls
  - package: Delete `package_name` (created object), not `super_package` (container)

**Results:**
- ✅ All 11 CREATE tests simplified and consistent
- ✅ Domain: 303→149 lines (-51% reduction)
- ✅ Class: 340→157 lines (-54% reduction)
- ✅ Total: 1618 lines across all CREATE tests (~147 lines average)
- ✅ All compilation errors fixed
- ✅ All tests use testLogger pattern
- ✅ All tests use getTimeout('create') from YAML config

---

### Phase 3: Activate/Update Tests (LOW PRIORITY) - as needed
**Goal:** Ensure tests that obtain lockHandle also save it

**Files to check:**
- `*/activate.test.ts` - some may call lock
- `*/update.test.ts` - some may call lock
- Builder tests (`ClassBuilder.test.ts`, `FunctionGroupBuilder.test.ts`)

**Changes:** Similar to Phase 1, if test calls lock

---

### Phase 5: Test Logging Pattern (NEW - IN PROGRESS)
**Goal:** Apply consistent logging with skip reporting across all tests

**Files to fix:**
1. ✅ `functionGroup/FunctionGroupBuilder.test.ts` - DONE
2. ⏳ `class/lock.test.ts` - auth pattern done, needs logging
3. ⏳ `program/lock.test.ts` - auth pattern done, needs logging
4. ⏳ `interface/lock.test.ts` - auth pattern done, needs logging
5. ⏳ `domain/lock.test.ts` - auth pattern done, needs logging
6. ⏳ `dataElement/lock.test.ts` - auth pattern done, needs logging
7. ⏳ `view/lock.test.ts` - auth pattern done, needs logging
8. ⏳ `functionModule/lock.test.ts` - auth pattern done, needs logging
9. ⏳ `functionGroup/lock.test.ts` - auth pattern done, needs logging
10. ⏳ All `*/create.test.ts` files (~11 files)
11. ⏳ All `*/activate.test.ts` files
12. ⏳ Builder tests

**Changes per file:**
- [ ] Import `createTestLogger` from `../../helpers/testLogger`
- [ ] Create logger: `const logger = createTestLogger('SuiteName')`
- [ ] Move validations to `beforeEach`
- [ ] Call `logger.skip(testName, reason)` when preparation fails
- [ ] Tests only check `if (!testCase) return` without re-logging
- [ ] Use suite-level variables for test case & object names

---

### Phase 4: Helper Functions (OPTIONAL)
**Goal:** Centralize unlock logic in helpers

**Files:**
- `src/__tests__/helpers/sessionConfig.ts` - add `unlockAndDelete()` helper
- `src/__tests__/helpers/lockHelper.ts` - add `tryUnlockFromRegistry()` helper

**Changes:**
```typescript
// New helper in lockHelper.ts
export async function tryUnlockFromRegistry(
  connection: AbapConnection,
  objectType: LockState['objectType'],
  objectName: string,
  unlockFn: (conn, ...args, lockHandle, sessionId) => Promise<void>,
  functionGroupName?: string
): Promise<boolean> {
  const savedLock = getTestLock(objectType, objectName, functionGroupName);
  if (!savedLock) return false;
  
  try {
    await unlockFn(connection, ..., savedLock.lockHandle, savedLock.sessionId);
    unregisterTestLock(objectType, objectName, functionGroupName);
    return true;
  } catch (err) {
    logger.warn(`Cannot unlock ${objectName}: ${err.message}`);
    return false;
  }
}
```

---

## 📊 Progress Tracking

### ✅ Timeout Configuration (COMPLETED)
- [x] Created `getTimeout()` function in test-helper.js
- [x] Added timeout configuration to test-config.yaml.template
- [x] Migrated 80 test files to use getTimeout()
- [x] Documented operation-specific defaults

**Progress:** 80/80 (100%) ✅ COMPLETED

### ✅ Phase 1: Lock Tests (COMPLETED)
- [x] functionModule/lock.test.ts (1/8)
- [x] class/lock.test.ts (2/8)
- [x] functionGroup/lock.test.ts (3/8) - auth only, no lock persistence
- [x] view/lock.test.ts (4/8)
- [x] interface/lock.test.ts (5/8)
- [x] domain/lock.test.ts (6/8)
- [x] program/lock.test.ts (7/8)
- [x] dataElement/lock.test.ts (8/8)
- [x] table/lock.test.ts - SKIPPED (not in LockState types)
- [x] package/lock.test.ts - SKIPPED (not in LockState types)
- [x] structure/lock.test.ts - SKIPPED (not in LockState types)

**Progress:** 8/8 (100%) ✅ COMPLETED

### ✅ Phase 2: Create Tests Cleanup (COMPLETED)
- [x] domain/create.test.ts (1/11) - 303→149 lines
- [x] program/create.test.ts (2/11) - testLogger pattern
- [x] class/create.test.ts (3/11) - 340→157 lines
- [x] interface/create.test.ts (4/11) - generated
- [x] view/create.test.ts (5/11) - generated
- [x] table/create.test.ts (6/11) - generated
- [x] dataElement/create.test.ts (7/11) - generated
- [x] structure/create.test.ts (8/11) - generated
- [x] functionGroup/create.test.ts (9/11) - created
- [x] functionModule/create.test.ts (10/11) - FG dependency
- [x] package/create.test.ts (11/11) - correct delete logic

**Progress:** 11/11 (100%) ✅ COMPLETED

**Key Results:**
- Domain: 303→149 lines (-51%)
- Class: 340→157 lines (-54%)
- Total: 1618 lines (~147 avg)
- All use testLogger pattern
- All use getTimeout('create')

### Phase 3: Activate/Update Tests
- [ ] Verification not started

**Progress:** 0/? (0%)

### Phase 5: Test Logging Pattern (NEW)
- [x] functionGroup/FunctionGroupBuilder.test.ts (1/~30)
- [ ] Lock tests - 8 files (auth done, logging pending)
- [ ] Create tests - 11 files (testLogger applied via Phase 2 ✅)
- [ ] Activate tests
- [ ] Builder tests

**Progress:** 12/~30 (40% if counting Phase 2 CREATE tests)

### Phase 4: Helper Functions
- [ ] Not started

**Progress:** 0/? (0%)

---

## 🎯 Overall Migration Status

### Completed Phases:
1. ✅ **Timeout Configuration** - 80 files migrated (100%)
2. ✅ **Phase 1: Lock Tests** - 8/8 files fixed (100%)
3. ✅ **Phase 2: Create Tests** - 11/11 files simplified (100%)

### In Progress:
4. ⏳ **Phase 5: Test Logging** - 12/~30 files (40%)

### Not Started:
5. ⏳ **Phase 3: Activate/Update** - verification needed
6. ⏳ **Phase 4: Helper Functions** - optional optimization

**Total Completed:** ~101 test files successfully migrated
**Total Remaining:** ~20-30 files for logging pattern

---

## 🧪 Verification

### After each fix:
```bash
# Build
cd packages/adt-clients
npm run build

# Run lock test for verified type
npm test -- integration/class/lock.test
npm test -- integration/functionGroup/lock.test
# etc.

# Verify .locks is populated
cat .locks/active-locks.json
```

### After Phase 1 completion:
```bash
# Run all lock tests
npm test -- integration/**/lock.test

# Verify unlock utility
node bin/unlock-object.js class ZCL_TEST_CLASS --session-id <from_registry>
```

### After Phase 2 completion:
```bash
# Run all create tests
npm test -- integration/**/create.test

# Verify cleanup works (no objects left)
# Check logs - any "⚠️ Test left locked object"
```

### Final verification:
```bash
# Full integration test suite
npm test -- integration/

# Verify e2e lock recovery
npm test -- e2e/testLockRecovery.integration.test
```

---

## 📝 Code Templates

### Template for lock tests:
```typescript
// Imports
import { registerTestLock, unregisterTestLock } from '../../helpers/lockHelper';
import { setupTestEnvironment, markAuthFailed, hasAuthFailed } from '../../helpers/sessionConfig';

const TEST_SUITE_NAME = 'ObjectType - Lock';

// Setup
beforeEach(async () => {
  if (hasAuthFailed(TEST_SUITE_NAME)) return;
  
  try {
    const config = getConfig();
    connection = createAbapConnection(config, logger);
    const env = await setupTestEnvironment(connection, 'test_id', __filename);
    sessionId = env.sessionId;
    lockTracking = env.lockTracking;
    
    await (connection as any).connect(); // CRITICAL!
    hasConfig = true;
  } catch (error: any) {
    markAuthFailed(TEST_SUITE_NAME);
    hasConfig = false;
  }
});

// In test after lock
const lockHandle = await lock...(connection, objectName, sessionId);

if (lockTracking?.enabled) {
  registerTestLock(objectType, objectName, sessionId, lockHandle, functionGroupName, __filename);
  logger.debug(`✓ Lock registered`);
}

// After unlock
await unlock...(connection, objectName, lockHandle, sessionId);

if (lockTracking?.enabled) {
  unregisterTestLock(objectType, objectName, functionGroupName);
  logger.debug(`✓ Lock unregistered`);
}
```

### Template for cleanup:
```typescript
// Before delete in cleanup
const savedLock = getTestLock(objectType, objectName, functionGroupName);
if (savedLock) {
  logger.debug(`Found saved lock for ${objectName}, attempting unlock...`);
  try {
    await unlock...(connection, ..., savedLock.lockHandle, savedLock.sessionId);
    unregisterTestLock(objectType, objectName, functionGroupName);
    logger.debug(`✓ Unlocked ${objectName}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (unlockError: any) {
    logger.warn(`⚠️ Test left locked object: ${objectName}`);
    logger.warn(`   Lock handle: ${savedLock.lockHandle}`);
    logger.warn(`   Session ID: ${savedLock.sessionId}`);
    logger.warn(`   Error: ${unlockError.message}`);
    logger.warn(`   Manual unlock: node bin/unlock-object.js ${objectType} ${objectName} --session-id ${savedLock.sessionId}`);
  }
}

// Then delete
await deleteObject(...);
```

---

## 🎯 Critical Points

1. **ALWAYS** call `await connection.connect()` in setup before tests
2. **ALWAYS** check `lockTracking?.enabled` before calling `registerTestLock`
3. **ALWAYS** log failed unlocks as `⚠️` with manual unlock instruction
4. **NEVER** leave objects locked after test (cleanup must detect this)
5. **NEVER** leave created objects in system if `shouldCleanupAfter === true`

---

**Last Updated:** 2025-11-17  
**Author:** Copilot + User  
**Status:** 🚧 In Progress
