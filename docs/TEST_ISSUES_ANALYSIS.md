# Test Issues Analysis - Mass Test Execution

**Created:** 2025-01-XX  
**Status:** 🔍 Analysis Complete  
**Context:** Running all integration tests simultaneously (`npm test -- integration`)

---

## 📊 Summary

**Test Results:**
- ✅ **12 passed** test suites
- ❌ **8 failed** test suites
- ⏭️ **2 skipped** tests (cleanup failures)
- **Total:** 20 test suites, 46 tests (36 passed, 10 failed)

---

## 🔴 Critical Issues - Conflicts When Running Tests Separately

### Test Execution: Sequential ✅ CONFIRMED

**Configuration:**
- `package.json`: `"test": "jest --runInBand"` - forces sequential execution
- `jest.config.js`: `maxWorkers: 1` - uses only one worker (sequential)

**Result:** ✅ Tests execute **sequentially** (one after another), NOT in parallel.

### Root Cause: Shared Session Between Tests

**Key Finding:** All tests in one `npm test -- integration` run share the **same SAP session**!

**Evidence:**
```typescript
// sessionConfig.ts:108-113
if (!currentTestRunSessionId) {
  const timestamp = Date.now();
  currentTestRunSessionId = `integration_test_${timestamp}`;
}
return currentTestRunSessionId; // Same session ID for ALL tests in one run
```

**Impact:**
- ✅ **When running tests separately** (`npm test -- integration/class/ClassBuilder`): Each test run gets its own session → no conflicts
- ❌ **When running all tests together** (`npm test -- integration`): All tests share one session → conflicts occur
- ⚠️ **Even though tests run sequentially**, they share the same SAP session, so locks from one test persist to the next

---

## 🔴 Critical Issues

### 1. Shared Session Causes Lock Conflicts

**Problem:**
- All tests in one run share the same SAP session (`integration_test_{timestamp}`)
- Locks from one test remain active for other tests
- Objects locked by previous test cannot be unlocked/deleted by next test

**Example:**
```
Test 1: InterfaceBuilder locks ZADT_BLD_IF01 → lockHandle stored
Test 2: InterfaceBuilder tries to update ZADT_BLD_IF01 → "User CB9980002377 is currently editing"
```

**Solution:**
- Option 1: Use unique session per test suite (not per test run)
- Option 2: Ensure `forceUnlock()` is called in `finally` block (already implemented)
- Option 3: Unlock all objects before each test in `beforeEach`

---

### 2. Cleanup Failures (Objects Remain Locked/Exist) ⚠️ NEEDS FIX

**Affected Tests:**
- `TableBuilder` - `ZADT_BLD_TAB01` already exists (409 Conflict)
- `DataElementBuilder` - `ZADT_BLD_DTEL01` already exists (409 Conflict)
- `InterfaceBuilder` - `ZADT_BLD_IF01` locked by user (EU510)
- `ViewBuilder` - `ZADT_BLD_VIEW01` still exists after cleanup
- `StructureBuilder` - `ZADT_BLD_STRU01` still exists after cleanup

**Root Cause:**
- Cleanup functions (`ensureInterfaceReady`, `ensureTableReady`, etc.) try to delete objects without unlocking first
- If object is locked from previous test, delete fails silently
- Cleanup doesn't use `LockStateManager` to check for and unlock existing locks
- `forceUnlock()` in `finally` only works for current test's builder, not for cleanup of previous test's objects

**Solution:**
- ✅ `forceUnlock()` is called in `finally` block (already implemented for current test)
- ⚠️ **NEEDED:** Unlock objects before delete in cleanup functions using `LockStateManager`
- Add retry logic for cleanup operations
- Check for locks before cleanup and unlock if needed

---

### 3. Standard Objects Don't Exist (404 Errors)

**Affected Tests:**
- `ViewBuilder.read()` - `V_T000` doesn't exist
- `ProgramBuilder.read()` - `SAPLSETT` doesn't exist
- `InterfaceBuilder.read()` - `IF_ABAP_CHAR_UTILITIES` doesn't exist

**Current Standard Objects:**
- ✅ `ClassBuilder` - `CL_ABAP_CHAR_UTILITIES` (works)
- ✅ `TableBuilder` - `T000` (works)
- ✅ `StructureBuilder` - `SYST` (works)
- ✅ `DomainBuilder` - `SYST_SUBRC` (works)
- ✅ `DataElementBuilder` - `MANDT` (works)
- ✅ `FunctionGroupBuilder` - `SYST` (works)
- ✅ `FunctionModuleBuilder` - `SYSTEM_INFO` from `SYST` (works)
- ❌ `ViewBuilder` - `V_T000` (doesn't exist)
- ❌ `ProgramBuilder` - `SAPLSETT` (doesn't exist)
- ❌ `InterfaceBuilder` - `IF_ABAP_CHAR_UTILITIES` (doesn't exist)

**Solution:**
- Replace with standard objects that exist in most SAP systems:
  - `ViewBuilder`: Use `V_T000` → `T000` (table) or find actual standard view
  - `ProgramBuilder`: Use `SAPLSETT` → `SAPMZTEST` or other standard program
  - `InterfaceBuilder`: Use `IF_ABAP_CHAR_UTILITIES` → `IF_ABAP_STRING_UTILITIES` or other standard interface

---

### 4. Function Group Shared Between Tests ✅ FIXED

**Problem:**
- `FunctionGroupBuilder` and `FunctionModuleBuilder` both used `ZADT_BLD_FGR01`
- If `FunctionGroupBuilder` test runs first and doesn't clean up, `FunctionModuleBuilder` test fails
- If `FunctionModuleBuilder` test runs first, it creates the group, but `FunctionGroupBuilder` test might delete it

**Solution:** ✅ FIXED
- `FunctionGroupBuilder` now uses `ZADT_BLD_FGR01`
- `FunctionModuleBuilder` now uses `ZADT_BLD_FGR02`
- Updated in both `test-config.yaml` and `test-config.yaml.template`

**Affected Test:**
- `FunctionModuleBuilder` - "Function group ZADT_BLD_FGR01 unknown" ✅ FIXED

**Root Cause:**
- `ensureFunctionGroupExists()` is called in `beforeEach`, but validation happens before creation
- Function group creation might fail silently
- Validation in `createFunctionModule` checks for function group existence

**Solution:**
- Ensure function group is created and activated before function module test
- Add better error handling in `ensureFunctionGroupExists`
- Wait for function group to be fully created before proceeding

---

### 5. Domain Check Error Handling

**Affected Test:**
- `DomainBuilder` - "Object ZADT_BLD_DOM01 has been checked"

**Root Cause:**
- Check operation returns "Object has been checked" which is parsed as an error
- This is actually a success message, not an error

**Solution:**
- Make `checkDomainSyntax` more tolerant of "has been checked" message
- Similar to how `checkDataElement` handles "importing from database" warnings

---

### 6. JWT Token Expiration (Shared Session)

**Affected Test:**
- `ProgramBuilder` - "JWT token has expired and refresh failed"

**Root Cause:**
- Tests run sequentially but JWT token expires between tests
- Connection is established in `beforeAll`, but token might expire during long test runs
- Auto-refresh might fail if refresh credentials are missing

**Solution:**
- Ensure JWT refresh credentials are provided in test configuration
- Connection should auto-refresh on 401/403 errors
- Consider reconnecting if refresh fails

---

### 7. Transport Builder - Invalid User

**Affected Test:**
- `TransportBuilder` - "User DEVELOPER does not exist in the system (or locked)"

**Root Cause:**
- Transport creation uses hardcoded `DEVELOPER` user or `process.env.SAP_USER`
- User doesn't exist in the SAP system

**Solution:**
- Use actual logged-in user from connection
- Get username from connection session
- Don't hardcode user names

---

## 🟡 Medium Priority Issues

### 8. Test Isolation (Shared Objects)

**Issue:**
- Tests share the same connection and session
- Objects created in one test might interfere with another
- Locks from one test might affect another

**Solution:**
- Each test should have its own session (already using `beforeAll` for connection)
- Better cleanup between tests
- Consider using different object names per test run

---

### 9. Cleanup Verification

**Issue:**
- Cleanup functions verify object deletion, but objects might still exist
- Verification might fail if object is locked

**Solution:**
- Add retry logic for cleanup verification
- Skip verification if object is locked (already partially implemented)
- Better error messages for cleanup failures

---

## ✅ Working Tests

These tests pass successfully:
- ✅ `ClassBuilder` - Full workflow + Read standard object
- ✅ `FunctionGroupBuilder` - Full workflow + Read standard object
- ✅ `StructureBuilder` - Read standard object (Full workflow skipped due to cleanup)
- ✅ `PackageBuilder` - Read standard object (Full workflow disabled)
- ✅ All `shared/*` tests (6 tests)
- ✅ `class/run.test.ts`

---

## 📋 Recommended Fixes (Priority Order)

### High Priority
1. ✅ **Separate function group names** - Use different names for FunctionGroupBuilder and FunctionModuleBuilder tests ✅ DONE
2. **Fix cleanup to unlock before delete** - Use `LockStateManager` to unlock objects before deleting in cleanup functions
3. **Fix shared session conflicts** - Unlock all objects in `beforeEach` before cleanup OR use unique session per test suite
4. **Fix standard objects for read tests** - Replace non-existent objects
5. **Fix domain check** - Handle "has been checked" message
6. **Fix transport builder** - Use actual user instead of hardcoded

### Medium Priority
7. **Fix function group creation** - Ensure it's created before function module test
8. **Improve JWT refresh** - Ensure auto-refresh works correctly
9. **Better test isolation** - Use unique object names per test suite OR ensure proper cleanup

### Low Priority
10. **Documentation** - Document standard objects that work across SAP systems
11. **Test naming** - Use unique names per test run to avoid conflicts

---

## 🔧 Quick Fixes

### 1. Replace Standard Objects

```typescript
// ViewBuilder.test.ts
const standardViewName = 'T000'; // Use table instead of view, or find actual standard view

// ProgramBuilder.test.ts
const standardProgramName = 'SAPMZTEST'; // Or other standard program

// InterfaceBuilder.test.ts
const standardInterfaceName = 'IF_ABAP_STRING_UTILITIES'; // Or other standard interface
```

### 2. Fix Domain Check

```typescript
// domain/check.ts
if (!checkResult.success && checkResult.has_errors) {
  const errorMessage = checkResult.message || '';
  // "has been checked" is actually a success message
  if (errorMessage.toLowerCase().includes('has been checked')) {
    return response; // Return success
  }
  throw new Error(`Domain check failed: ${checkResult.message}`);
}
```

### 3. Fix Transport Builder

```typescript
// transport/create.ts
// Get username from connection instead of hardcoding
const username = connection.getUsername() || process.env.SAP_USERNAME || 'DEVELOPER';
```

---

## 📝 Notes

### Why Tests Work Separately But Fail Together

1. **Shared Session:**
   - Separate runs = separate sessions → no lock conflicts
   - Combined run = shared session → locks persist between tests

2. **Object Names:**
   - All tests use same object names (ZADT_BLD_CLS01, ZADT_BLD_TAB01, etc.)
   - If one test doesn't clean up, next test fails

3. **Function Group:**
   - Both FunctionGroupBuilder and FunctionModuleBuilder use ZADT_BLD_FGR01
   - Order of execution matters

4. **Cleanup Timing:**
   - Cleanup in `beforeEach`/`afterEach` might not complete before next test starts
   - Objects locked from previous test cannot be deleted

### Solutions

**Quick Fix (Recommended):**
- Unlock all objects in `beforeEach` before cleanup
- Use `forceUnlock()` for all objects from previous test

**Better Fix:**
- Use unique session per test suite (not per test run)
- Or use unique object names per test suite

**Best Fix:**
- Use unique object names per test run (with timestamp)
- Ensure proper cleanup order
- Separate function group names for different tests

---

**Last Updated:** 2025-01-XX

