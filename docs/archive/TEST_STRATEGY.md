# 🎯 Test Strategy & Roadmap

**⚠️ ARCHIVED: This file is superseded by [TEST_IMPROVEMENT_ROADMAP.md](./TEST_IMPROVEMENT_ROADMAP.md)**  
**Current roadmap:** [TEST_IMPROVEMENT_ROADMAP.md](./TEST_IMPROVEMENT_ROADMAP.md)

---

**Created:** 2025-11-17  
**Status:** ✅ Mostly Complete (~65%), Superseded by TEST_IMPROVEMENT_ROADMAP.md  
**Goal:** Unified test strategy for the entire project

---

## 📊 Overall Status

### Progress Across All Phases

| Phase | Progress | Priority | Status |
|-------|----------|----------|--------|
| 1. YAML Config Migration | 37/37 (100%) | ✅ DONE | Completed 2025-01-11 |
| 2. Auth + Lock Persistence | 8/8 (100%) | 🔥 HIGH | Completed 2025-11-17 |
| 3. Test Logging Pattern | 23/~112 (20.5%) | 🔥 HIGH | In Progress |
| 4. Cleanup (unlock-before-delete) | 0.5/11 (5%) | 🟡 MEDIUM | Not Started |
| 5. setupTestEnvironment Migration | 23/112 (20.5%) | 🟢 LOW | In Progress |

**Overall Progress:** ~65% complete

---

## 🎯 STRATEGY: Focus on One Phase at a Time

### ⚠️ PROBLEM: Scattered Focus
Currently working on multiple phases simultaneously:
- Auth pattern (Phase 1) ✅ DONE
- Logging pattern (Phase 5) 🔄 STARTED
- Cleanup (Phase 2) ⏸️ PAUSED
- setupTestEnvironment (other roadmap) ⏸️ PAUSED

**Result:** Slow progress, incomplete changes

### ✅ SOLUTION: Sequential Execution

**New Strategy:**
1. Complete **Phase 5 (Logging)** for all lock tests → 8 files
2. Then **Phase 2 (Cleanup)** for create tests → 11 files  
3. Then **Phase 5 (Logging)** for create tests
4. Then setupTestEnvironment for remaining files

**Rule:** DO NOT start a new phase until the current one is complete!

---

## 📋 COMPLETED: Phase 5 - Test Logging Pattern (LOCK Tests)

**Goal:** Add configurable logging with skip reasons to all LOCK tests ✅

**Completed Work:**
- ✅ Created `testLogger.ts` helper
- ✅ Added documentation with examples
- ✅ Applied to `FunctionGroupBuilder.test.ts`
- ✅ Applied to ALL 11 LOCK tests (100% complete)

### ✅ Completed Files (11/11 lock tests - 100%):

1. ✅ `class/lock.test.ts` - auth ✅, logging ✅, tested ✅
2. ✅ `program/lock.test.ts` - auth ✅, logging ✅, tested ✅
3. ✅ `interface/lock.test.ts` - auth ✅, logging ✅, tested ✅
4. ✅ `domain/lock.test.ts` - auth ✅, logging ✅, tested ✅
5. ✅ `dataElement/lock.test.ts` - auth ✅, logging ✅, tested ✅
6. ✅ `view/lock.test.ts` - auth ✅, logging ✅, tested ✅
7. ✅ `functionModule/lock.test.ts` - auth ✅, logging ✅, tested ✅
8. ✅ `functionGroup/lock.test.ts` - auth ✅, logging ✅, tested ✅
9. ✅ `package/lock.test.ts` - auth ✅, logging ✅, tested ✅
10. ✅ `structure/lock.test.ts` - auth ✅, logging ✅, tested ✅
11. ✅ `table/lock.test.ts` - auth ✅, logging ✅, tested ✅

**Testing Results:**
All tests run with `LOG_LEVEL=warn npm test` and display skip reasons correctly:
```
[ObjectType - Lock/Unlock] ⏭️  SKIPPED: Lock/Unlock test
   Reason: Test case not enabled in test-config.yaml
```

**Notes:**
- Package, structure, and table locks not tracked in lock registry (not supported by lockHelper)
- These object types have lock tracking commented out intentionally

---

## 📋 COMPLETED: Phase 5 - Test Logging Pattern (UNLOCK Tests)

**Goal:** Add configurable logging with skip reasons to all UNLOCK tests ✅

**Completed Work:**
- ✅ Applied testLogger pattern to all 10 UNLOCK tests (100% complete)
- ✅ All tests use beforeAll/afterAll + beforeEach/afterEach lifecycle
- ✅ Suite-level variables (testCase, objectName) for better control
- ✅ Helper functions return Promise<void> for consistency

### ✅ Completed Files (10/10 unlock tests - 100%):

1. ✅ `dataElement/unlock.test.ts` - has domain dependency, auth ✅, logging ✅
2. ✅ `domain/unlock.test.ts` - simple structure, auth ✅, logging ✅
3. ✅ `functionGroup/unlock.test.ts` - uses lock.ts unlock function, auth ✅, logging ✅
4. ✅ `functionModule/unlock.test.ts` - has function group dependency, auth ✅, logging ✅
5. ✅ `interface/unlock.test.ts` - lockInterface returns {lockHandle}, auth ✅, logging ✅
6. ✅ `package/unlock.test.ts` - lock → unlock workflow, auth ✅, logging ✅
7. ✅ `program/unlock.test.ts` - lock → unlock workflow, auth ✅, logging ✅
8. ✅ `structure/unlock.test.ts` - lock → unlock workflow, auth ✅, logging ✅
9. ✅ `table/unlock.test.ts` - uses acquireTableLockHandle, auth ✅, logging ✅
10. ✅ `view/unlock.test.ts` - uses lockDDLS/unlockDDLS, auth ✅, logging ✅

**Testing Results:**
All files compile without errors. Standard pattern applied:
```typescript
const logger = createTestLogger('OBJ-UNLOCK');
// beforeAll: Connect once
// afterAll: Disconnect once
// beforeEach: Setup + validate test case
// afterEach: Cleanup
```

**Notes:**
- All UNLOCK tests follow lock → unlock workflow
- Interface uses {lockHandle} object (not string)
- Table uses acquireTableLockHandle (not lockTable)
- View uses lockDDLS/unlockDDLS (not lockView/unlockView)

---

## 🎯 NEXT PHASE OPTIONS


**Total Integration Tests:** 80 files
- ✅ LOCK: 11/11 (100%) ← **COMPLETED!**
- ✅ UNLOCK: 10/10 (100%) ← **COMPLETED!** 🎉
- ✅ UPDATE: 11/11 (100%) ← **COMPLETED!** 🎉🎉
- ❌ CREATE: 11 files (needs simplification strategy)
- ❌ DELETE: 5 files
- ❌ READ: 11 files (+ 2 shared)
- ❌ CHECK: 11 files
- ❌ ACTIVATE: 10 files
- ❌ VALIDATION: 1 file

**Progress:** 32/81 = 39.5% ✅

**UPDATE Migration COMPLETED (11/11 files):**
- ✅ domain/update.test.ts - beforeAll/afterAll with ensureDomainExists()
- ✅ functionGroup/update.test.ts - full testLogger pattern
- ✅ program/update.test.ts - beforeAll/afterAll with ensureProgramExists()
- ✅ interface/update.test.ts - beforeAll/afterAll with ensureInterfaceExists()
- ✅ view/update.test.ts - beforeAll/afterAll with ensureViewExists()
- ✅ table/update.test.ts - beforeAll/afterAll with ensureTableExists()
- ✅ functionModule/update.test.ts - beforeAll/afterAll with 2 helpers
- ✅ package/update.test.ts - beforeAll/afterAll with lock/unlock in test
- ✅ structure/update.test.ts - beforeAll/afterAll with lock/unlock in test
- ✅ class/update.test.ts - beforeAll/afterAll (migrated from beforeEach)
- ✅ dataElement/update.test.ts - beforeAll/afterAll (migrated from beforeEach)

All 11 UPDATE tests compile without errors! ✅

**UNLOCK Migration COMPLETED (10/10 files):**
- ✅ dataElement/unlock.test.ts - has domain dependency
- ✅ domain/unlock.test.ts - simple structure
- ✅ functionGroup/unlock.test.ts - uses lock.ts unlock function
- ✅ functionModule/unlock.test.ts - has function group dependency
- ✅ interface/unlock.test.ts - lockInterface returns {lockHandle}
- ✅ package/unlock.test.ts - lock → unlock workflow
- ✅ program/unlock.test.ts - lock → unlock workflow
- ✅ structure/unlock.test.ts - lock → unlock workflow
- ✅ table/unlock.test.ts - uses acquireTableLockHandle
- ✅ view/unlock.test.ts - uses lockDDLS/unlockDDLS

**UPDATE Coverage Analysis:**
- ✅ **GAP IDENTIFIED:** functionGroup had `core/update.ts` but NO test
- ✅ **FIX COMPLETED:** Created `functionGroup/update.test.ts` with full implementation
- ✅ **VERIFIED:** All 11 modules now have UPDATE tests
  - Modules: class, dataElement, domain, **functionGroup** ⬅️ NEW, functionModule, interface, package, program, structure, table, view
- ℹ️ **SPECIAL CASES:** 
  - `shared` - No UPDATE (only read operations: readMetadata, readSource)
  - `transport` - No tests at all (separate investigation needed)

**Strategy Options:**
1. ~~Complete one more function (e.g., UNLOCK - 10 files)~~ ✅ DONE!
2. ~~Apply pattern to all UPDATE tests (11 files)~~ ✅ DONE!
3. Apply pattern to all CREATE tests (11 files) ← **Next: Simplify with new strategy**
4. Apply pattern to all READ tests (11 files)
5. Apply pattern to all CHECK tests (11 files)

**Recommendation:** 
- **Option 1:** Complete READ or CHECK tests (simpler, ~11 files each)
- **Option 2:** Tackle CREATE tests with new simplified pattern (11 files, complex)

**CREATE Simplification Strategy:**
```typescript
beforeEach: 
  - deleteIfExists(objectName) // Ignore 404 errors
  - Get test case from config
afterEach:
  - deleteIgnoringErrors(objectName) // Always try cleanup
```


---

## 📝 STANDARD TEST PATTERN (Applied to all LOCK tests)

### Applied Pattern:

```typescript
// 1. Import logger
import { createTestLogger } from '../../helpers/testLogger';

// 2. Create logger instance
const logger = createTestLogger('ObjectType - Lock');

// 3. Test lifecycle structure (STANDARD PATTERN)
describe('ObjectType - Lock', () => {
  // Suite-level variables
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let objectName: string | null = null;

  // beforeAll: Connect to SAP system (ONCE per suite)
  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      await (connection as any).connect();
      hasConfig = true;
    } catch (error: any) {
      logger.error('Connection failed:', error.message);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
    }
  });

  // afterAll: Disconnect from SAP system (ONCE per suite)
  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  // beforeEach: Setup test environment + validate test case
  beforeEach(async () => {
    testCase = null;
    objectName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock test', 'Authentication failed in previous test');
      return;
    }

    try {
      // Setup session and lock tracking based on test-config.yaml
      const env = await setupTestEnvironment(connection, 'object_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      // Prepare test case
      const tc = getEnabledTestCase('lock_object', 'lock_test');
      if (!tc) {
        logger.skip('Lock test', 'Test case not enabled in test-config.yaml');
        return;
      }

      testCase = tc;
      objectName = tc.params.object_name;
    } catch (error: any) {
      logger.error('Setup failed:', error.message);
      markAuthFailed(TEST_SUITE_NAME);
    }
  });

  // afterEach: Cleanup test environment
  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    sessionId = null;
    testConfig = null;
    lockTracking = null;
  });

  // Test checks suite variables
  it('should lock object', async () => {
    if (!testCase || !objectName) {
      return; // Already logged in beforeEach
    }
    
    // Test logic...
  });
});
```

**IMPORTANT PATTERN:**
- `beforeAll` / `afterAll` → Connection lifecycle (connect/disconnect)
- `beforeEach` / `afterEach` → Test environment lifecycle (setup/cleanup)
- Suite variables → Test preparation state
- Test body → Validate suite variables, then execute

**Time Estimate:** 2-3 hours (8 files × 20 min)

---

## 📝 NEXT PHASE: Phase 2 - Cleanup Pattern

**Starts AFTER completing Phase 5 for lock tests**

**Goal:** Add unlock-before-delete in cleanup helpers

### Files (11 create tests):

1. ⏳ `class/create.test.ts`
2. ⏳ `program/create.test.ts`
3. ⏳ `interface/create.test.ts`
4. ⏳ `domain/create.test.ts`
5. ⏳ `dataElement/create.test.ts`
6. ⏳ `view/create.test.ts`
7. ✅ `functionModule/create.test.ts` - partial (unlock exists, no logging)
8. ⏳ `functionGroup/create.test.ts`
9. ⏳ `table/create.test.ts`
10. ⏳ `structure/create.test.ts`
11. ⏳ `package/create.test.ts`

### Changes:

```typescript
// 1. Import helpers
import { getTestLock, unregisterTestLock } from '../../helpers/lockHelper';
import { unlockClass } from '../../../core/class/unlock'; // or other unlock
import { createTestLogger } from '../../helpers/testLogger';

const logger = createTestLogger('ObjectType - Create');

// 2. In beforeEach - prepare test case
beforeEach(async () => {
  // Similar to lock tests - move validations here
  // Call logger.skip() when preparation fails
});

// 3. In cleanup helper (before delete)
async function ensureObjectDoesNotExist(objectName: string) {
  const savedLock = getTestLock('class', objectName);
  if (savedLock) {
    logger.debug(`Found saved lock for ${objectName}, attempting unlock...`);
    try {
      await unlockClass(connection, objectName, savedLock.lockHandle, savedLock.sessionId);
      unregisterTestLock('class', objectName);
      logger.debug(`✓ Unlocked ${objectName}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (unlockError: any) {
      logger.warn(`⚠️ Test left locked object: ${objectName}`);
      logger.warn(`   Lock handle: ${savedLock.lockHandle}`);
      logger.warn(`   Session ID: ${savedLock.sessionId}`);
      logger.warn(`   Error: ${unlockError.message}`);
    }
  }

  // Then delete
  try {
    await deleteClass(connection, { class_name: objectName });
  } catch (err: any) {
    if (err.response?.status !== 404) {
      throw err;
    }
  }
}
```

**Time Estimate:** 3-4 hours (11 files × 20-25 min)

---

## 🔮 FUTURE PHASES (DO NOT TOUCH NOW!)

### Phase 3: setupTestEnvironment Migration (LOW PRIORITY)

**When to Start:** After Phase 2 + Phase 5 for create tests

**Files:** ~89 tests without setupTestEnvironment

**Changes:**
- Remove custom `getConfig()`
- Add `import { setupTestEnvironment, cleanupTestEnvironment, getConfig }`
- Replace `beforeAll` → `beforeEach` with `setupTestEnvironment`
- Replace `afterAll` → `afterEach` with `cleanupTestEnvironment`

**Time Estimate:** 4-5 hours

---

## 🧪 Common Patterns

### Pattern 1: Test Logger

```typescript
import { createTestLogger } from '../../helpers/testLogger';

const logger = createTestLogger('ModuleName - Operation');

// Usage
logger.debug('Debug info'); // Only with LOG_LEVEL=debug
logger.info('Info message'); // LOG_LEVEL=info and above
logger.warn('Warning'); // LOG_LEVEL=warn and above
logger.error('Error'); // Always shown (LOG_LEVEL=error)
logger.skip('Test name', 'Reason'); // Only with LOG_LEVEL=warn and above
```

**Environment variables:**
- `LOG_LEVEL=error` - errors only
- `LOG_LEVEL=warn` - errors + warnings + skip reasons
- `LOG_LEVEL=info` - default
- `LOG_LEVEL=debug` - everything (equivalent to `DEBUG_TESTS=true`)

### Pattern 2: Test Preparation in beforeEach

```typescript
describe('MyTest', () => {
  let testCase: any = null;
  let objectName: string | null = null;

  beforeEach(async () => {
    // 1. Check auth
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test name', 'Authentication failed');
      return;
    }

    // 2. Setup connection
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, 'test_id', __filename);
      sessionId = env.sessionId;
      await (connection as any).connect();
      hasConfig = true;
    } catch (error: any) {
      logger.error('Connection failed:', error.message);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
      return;
    }

    // 3. Fetch test case
    const tc = getEnabledTestCase('operation', 'test_id');
    if (!tc) {
      logger.skip('Test name', 'Test case not enabled in test-config.yaml');
      testCase = null;
      objectName = null;
      return;
    }

    testCase = tc;
    objectName = tc.params.object_name;

    // 4. Cleanup before test
    try {
      await deleteObjectIfExists(objectName!);
    } catch (error: any) {
      logger.skip('Test name', `Cleanup failed: ${error.message}`);
      testCase = null;
      objectName = null;
    }
  });

  it('should do something', async () => {
    if (!testCase || !objectName) {
      return; // Skip without logging - already done in beforeEach
    }

    // Test logic
  });
});
```

### Pattern 3: Lock Persistence

```typescript
// After lock
const lockHandle = await lockClass(connection, className, sessionId);

if (lockTracking?.enabled) {
  registerTestLock('class', className, sessionId, lockHandle, undefined, __filename);
  logger.debug(`✓ Lock registered for ${className}`);
}

// After unlock
await unlockClass(connection, className, lockHandle, sessionId);

if (lockTracking?.enabled) {
  unregisterTestLock('class', className);
  logger.debug(`✓ Lock unregistered for ${className}`);
}
```

### Pattern 4: Cleanup with Unlock

```typescript
async function ensureObjectDoesNotExist(objectName: string) {
  // 1. Try unlock from registry
  const savedLock = getTestLock('class', objectName);
  if (savedLock) {
    logger.debug(`Found saved lock, unlocking ${objectName}...`);
    try {
      await unlockClass(connection, objectName, savedLock.lockHandle, savedLock.sessionId);
      unregisterTestLock('class', objectName);
      logger.debug(`✓ Unlocked ${objectName}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for SAP
    } catch (err: any) {
      logger.warn(`⚠️ Failed to unlock ${objectName}: ${err.message}`);
      logger.warn(`   Manual unlock: node bin/unlock-object.js class ${objectName} --session-id ${savedLock.sessionId}`);
    }
  }

  // 2. Delete object
  try {
    await deleteClass(connection, { class_name: objectName });
    logger.debug(`✓ Deleted ${objectName}`);
  } catch (err: any) {
    if (err.response?.status !== 404 && !err.message?.includes('not found')) {
      throw err;
    }
  }
}
```

---

## 📊 Completed Work Status

### ✅ YAML Config Migration (100%)
**Completed:** 2025-01-11  
**Files:** 37/37

- ✅ CREATE/UPDATE/DELETE tests (18 files)
- ✅ GET/SEARCH tests (19 files)
- ✅ All tests use `test-config.yaml`
- ✅ $TMP package support

**Documentation:** `TESTING_ROADMAP.md` (archived)

### ✅ Phase 1: Lock Tests Auth + Persistence (100%)
**Completed:** 2025-11-17  
**Files:** 8/8

- ✅ `class/lock.test.ts` - auth + lock persistence
- ✅ `program/lock.test.ts` - auth + lock persistence
- ✅ `interface/lock.test.ts` - auth + lock persistence
- ✅ `domain/lock.test.ts` - auth + lock persistence
- ✅ `dataElement/lock.test.ts` - auth + lock persistence
- ✅ `view/lock.test.ts` - auth + lock persistence
- ✅ `functionModule/lock.test.ts` - auth + lock persistence
- ✅ `functionGroup/lock.test.ts` - auth only (container object)

**Changes:**
- Added `await connection.connect()` in beforeEach
- Added `markAuthFailed()` / `hasAuthFailed()`
- Added `registerTestLock()` / `unregisterTestLock()`
- Lock handles stored in `.locks/active-locks.json`

**Documentation:** `TEST_FIXES_ROADMAP.md` (archived)

---

## 🎯 Current Focus

### 🔥 ACTIVE WORK: Phase 5 - Logging for lock tests

**Status:** 1/8 (12.5%)  
**Next File:** `class/lock.test.ts`

**What We're Doing:**
1. Add `import { createTestLogger }`
2. Create `const logger = createTestLogger('Class - Lock')`
3. Add suite-level variables `testCase`, `objectName`
4. Move validations to `beforeEach`
5. Call `logger.skip()` when preparation fails
6. Tests only check `if (!testCase) return`

**After Completion:** Phase 2 (Cleanup for create tests)

---

## 📌 Working Rules

### ✅ DO:
- Focus on ONE phase at a time
- Complete phase fully before moving to next
- Test changes: `LOG_LEVEL=warn npm test -- <file>`
- Commit after each file
- Update this roadmap after every 2-3 files

### ❌ DON'T:
- DON'T start new phase until current one is complete
- DON'T mix changes from different phases in one file
- DON'T make "quick fixes" outside roadmap
- DON'T change code without testing

---

## 🔧 Testing Commands

```bash
# Run specific test with skip reasons logging
LOG_LEVEL=warn npm test -- class/lock.test.ts

# Errors only
LOG_LEVEL=error npm test -- class/lock.test.ts

# Full debug output
LOG_LEVEL=debug npm test -- class/lock.test.ts
# or
DEBUG_TESTS=true npm test -- class/lock.test.ts

# Run all lock tests
npm test -- "**/lock.test.ts"

# Check lock registry
cat packages/adt-clients/.locks/active-locks.json

# Build before tests
cd packages/adt-clients && npm run build
```

---

## 📝 Changelog

### 2025-11-17
- ✅ Created `TEST_STRATEGY.md` - consolidated roadmap
- ✅ Completed Phase 1 (Lock Tests Auth + Persistence) - 8/8
- ✅ Created `testLogger.ts` helper with documentation
- ✅ Applied logging to `FunctionGroupBuilder.test.ts`
- 🔄 Started Phase 5 (Logging) - 1/8 lock tests

### 2025-01-11
- ✅ Completed YAML Config Migration - 37/37

---

**Last Updated:** 2025-11-17  
**Next Step:** Apply logging pattern to `class/lock.test.ts`
