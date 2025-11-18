# Test Isolation Check - Builder Tests

**Created:** 2025-01-XX  
**Status:** 🔍 Analysis Complete  
**Goal:** Verify that each Builder test uses only its own objects (strict isolation)

---

## 📊 Object Usage by Test

### ✅ Unique Objects Per Test

| Test | Object Name | Object Type | Status |
|------|-------------|-------------|--------|
| `ClassBuilder` | `ZADT_BLD_CLS01` | Class | ✅ Unique |
| `DomainBuilder` | `ZADT_BLD_DOM01` | Domain | ✅ Unique |
| `DataElementBuilder` | `ZADT_BLD_DTEL01` | Data Element | ✅ Unique |
| `InterfaceBuilder` | `ZADT_BLD_IF01` | Interface | ✅ Unique |
| `ProgramBuilder` | `ZADT_BLD_PROG01` | Program | ✅ Unique |
| `TableBuilder` | `ZADT_BLD_TAB01` | Table | ✅ Unique |
| `StructureBuilder` | `ZADT_BLD_STRU01` | Structure | ✅ Unique |
| `ViewBuilder` | `ZADT_BLD_VIEW01` | View | ✅ Unique |
| `FunctionGroupBuilder` | `ZADT_BLD_FGR01` | Function Group | ✅ Unique |
| `FunctionModuleBuilder` | `Z_ADT_BLD_FM01` | Function Module | ✅ Unique |
| `FunctionModuleBuilder` | `ZADT_BLD_FGR02` | Function Group | ✅ Unique (different from FunctionGroupBuilder) |
| `PackageBuilder` | `ZADT_BLD_PKG01` | Package | ✅ Unique |
| `TransportBuilder` | (dynamic) | Transport | ✅ Dynamic (no conflicts) |

**Result:** ✅ All objects have unique names - **NO CONFLICTS**

---

## 🔍 Isolation Verification

### 1. Object Name Conflicts ✅ PASS

**Check:** Each test uses a unique object name
- ✅ All object names are unique
- ✅ No two tests use the same object
- ✅ Function groups are different (`ZADT_BLD_FGR01` vs `ZADT_BLD_FGR02`)

### 2. Cleanup Functions ⚠️ NEEDS VERIFICATION

**Check:** Cleanup functions only affect their own objects

**Current Implementation:**
- Each test has its own `ensure*Ready()` function
- Functions only delete objects with their specific names
- No cross-test object access

**Potential Issues:**
- ⚠️ Cleanup doesn't unlock before delete
- ⚠️ If object is locked from previous test, cleanup fails silently
- ⚠️ No verification that cleanup only affects own objects

### 3. Lock Isolation ⚠️ NEEDS FIX

**Check:** Locks from one test don't affect another test

**Current Implementation:**
- Each test locks only its own object (from YAML config)
- `forceUnlock()` is called in `finally` block
- Locks are registered in `LockStateManager`

**Potential Issues:**
- ⚠️ **Shared session** - all tests use same SAP session
- ⚠️ If test fails before `finally`, lock remains active
- ⚠️ Cleanup doesn't check for locks before delete
- ⚠️ Lock from previous test can prevent cleanup in next test

**Example Violation:**
```
Test 1: InterfaceBuilder locks ZADT_BLD_IF01 → test fails before finally
Test 2: InterfaceBuilder tries to cleanup ZADT_BLD_IF01 → object is locked → cleanup fails
Test 2: InterfaceBuilder tries to create ZADT_BLD_IF01 → object exists → test fails
```

---

## 🔴 Isolation Violations Found

### 1. Shared Session Between Tests ⚠️ CRITICAL VIOLATION

**Violation:**
- All tests share the same SAP session (`integration_test_{timestamp}`)
- Locks from one test persist to the next test
- If test fails before `finally`, lock remains active

**Impact:**
- Test 1: `InterfaceBuilder` locks `ZADT_BLD_IF01` → test fails before `finally` → lock remains
- Test 2: `InterfaceBuilder` tries to cleanup `ZADT_BLD_IF01` → object is locked → cleanup fails silently
- Test 2: `InterfaceBuilder` tries to create `ZADT_BLD_IF01` → object exists → test fails with 409 Conflict

**This is a STRICT ISOLATION VIOLATION:**
- Test 2 cannot clean up its own object because Test 1 left it locked
- Test 2 cannot create its own object because Test 1 left it locked
- Tests are NOT isolated - one test's failure affects another test

**Solution:**
- **REQUIRED:** Unlock all objects in `beforeEach` before cleanup (using `LockStateManager`)
- **REQUIRED:** Ensure cleanup unlocks before delete
- **IMPORTANT:** Unlock requires:
  - `lockHandle` - зберігається в `LockStateManager`
  - `sessionId` (sap-adt-connection-id) - зберігається в `LockStateManager`
  - HTTP Session (cookies, CSRF token) - зберігається в connection автоматично
- **KEY INSIGHT:** Оскільки всі тести використовують одну HTTP сесію (`integration_test_{timestamp}`), cookies зберігаються в connection, тому unlock має спрацювати з правильним `sessionId` і `lockHandle`
- Alternative: Use unique session per test suite (but unlock is still needed)

### 2. Cleanup Doesn't Unlock Before Delete ⚠️ CRITICAL VIOLATION

**Violation:**
- Cleanup functions (`ensureInterfaceReady`, `ensureTableReady`, etc.) try to delete without unlocking first
- If object is locked from previous test, delete fails silently
- Test continues with locked object, causing conflicts

**Impact:**
- Previous test locks object → cleanup fails silently → object remains locked
- Current test tries to create → object exists → test fails with 409 Conflict
- **This is a STRICT ISOLATION VIOLATION:** Test cannot clean up its own object because previous test left it locked

**Solution:**
- **REQUIRED:** Use `LockStateManager` to check for locks before cleanup
- **REQUIRED:** Unlock object if locked, then delete
  - Використати `lockHandle` і `sessionId` з `LockStateManager`
  - HTTP Session (cookies) вже є в connection (всі тести використовують одну сесію)
  - Якщо HTTP сесія все ще активна, unlock спрацює
- **REQUIRED:** Retry cleanup if unlock fails
- **REQUIRED:** Fail test if cleanup cannot unlock own object (isolation violation)
- **NOTE:** Якщо HTTP сесія змінилася (cookies невалідні), треба відновити сесію з файлу перед unlock (через `FileSessionStorage.load()` та `connection.setSessionState()`)

### 3. No Verification of Object Ownership

**Violation:**
- No verification that cleanup only affects own objects
- No check that object name matches test's expected object

**Impact:**
- If object name is wrong, cleanup might affect wrong object
- No protection against accidental cross-test cleanup

**Solution:**
- Add verification that object name matches test's config
- Log warning if cleanup affects unexpected object

---

## ✅ Isolation Requirements

### Strict Requirements:
1. ✅ **Unique object names** - Each test uses its own object (VERIFIED)
2. ✅ **Objects from YAML only** - Each test uses objects from its own YAML config (VERIFIED)
3. ⚠️ **No shared locks** - Locks from one test don't affect another (NEEDS FIX)
4. ⚠️ **Cleanup isolation** - Cleanup only affects own objects (VERIFIED - cleanup uses same object name from test)
5. ⚠️ **Lock cleanup** - Cleanup unlocks before delete (NEEDS FIX)

### Current Status:
- ✅ Object names are unique (each test has its own object)
- ✅ Objects come from YAML config (each test reads from its own test case)
- ✅ Cleanup uses same object name from test (no cross-test cleanup)
- ⚠️ **ISOLATION VIOLATION:** Locks can persist between tests (shared session)
- ⚠️ **ISOLATION VIOLATION:** Cleanup doesn't unlock before delete (locked objects from previous test prevent cleanup)

---

## 📋 Required Fixes

### High Priority (CRITICAL - Isolation Violations)
1. **Unlock all objects in beforeEach** - Unlock all objects from previous tests before cleanup (using `LockStateManager`)
2. **Unlock before delete in cleanup** - Use `LockStateManager` to unlock objects before deleting in cleanup functions
3. **Fail test on isolation violation** - If cleanup cannot unlock own object, fail test with clear error message
4. **Verify object ownership** - Add checks that cleanup only affects own objects (already verified - cleanup uses test's object name)

### Medium Priority
4. **Unique session per test suite** - Use different session for each test suite (alternative to unlock in beforeEach)
5. **Better error handling** - Fail test if cleanup affects wrong object

---

## 🔧 Implementation Plan

### Step 1: Add Unlock Before Delete in Cleanup Functions

```typescript
async function ensureInterfaceReady(interfaceName: string): Promise<{ success: boolean; reason?: string }> {
  // 1. Check for locks using LockStateManager
  const lockManager = getLockStateManager();
  const lock = lockManager.getLock('interface', interfaceName);
  
  // 2. Unlock if locked
  if (lock) {
    try {
      await unlockInterface(connection, interfaceName, lock.lockHandle, lock.sessionId);
      lockManager.removeLock('interface', interfaceName);
    } catch (unlockError) {
      // Log but continue - might be stale lock
    }
  }
  
  // 3. Delete object
  try {
    await deleteInterface(connection, { interface_name: interfaceName });
    // ...
  }
}
```

### Step 2: Unlock All Objects in beforeEach

```typescript
beforeEach(async () => {
  // Unlock all objects from previous tests
  const lockManager = getLockStateManager();
  const allLocks = lockManager.getAllLocks();
  
  for (const lock of allLocks) {
    try {
      await unlockObject(connection, lock);
      lockManager.removeLock(lock.objectType, lock.objectName, lock.functionGroupName);
    } catch (error) {
      // Log but continue - might be stale lock
    }
  }
  
  // Then proceed with cleanup
  // ...
});
```

---

**Last Updated:** 2025-01-XX

