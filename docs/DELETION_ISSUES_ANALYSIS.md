# Deletion Issues Analysis

## Problem: "Error when creating object directory entry" (409 Conflict)

### Error Details
- **Error Code:** HTTP 409 Conflict
- **Error Message:** `Error when creating object directory entry R3TR DTEL ZADT_BLD_DTEL01`
- **Occurrence:** During `create()` operation in DataElementBuilder test
- **Root Cause:** Object already exists in SAP system, cleanup failed

### What This Error Means

**"Error when creating object directory entry"** is a SAP-specific error that occurs when:
1. An object with the same name already exists in the system
2. The system tries to create a new entry in the object directory (TADIR table)
3. The entry already exists, causing a conflict

This is equivalent to "ResourceAlreadyExists" but with a more specific SAP message.

### Why Cleanup Failed

Possible reasons why `ensureDataElementReady()` didn't delete the object:

1. **Object was locked:**
   - Object was locked from previous test run
   - Unlock didn't work (stale lock handle, session mismatch)
   - Delete failed because object is locked

2. **Delete operation failed silently:**
   - Delete returned error (404, 403, etc.)
   - Error was ignored in cleanup function
   - Object remained in system

3. **Object has dependencies:**
   - Data element is used by other objects (tables, structures, etc.)
   - Delete failed due to dependencies
   - Error was ignored

4. **Transport request issue:**
   - Object is in a transport request
   - Delete requires transport request
   - Transport request not provided or invalid

5. **Session/Connection issue:**
   - HTTP session expired between cleanup and test
   - Connection lost
   - CSRF token invalid

### Current Cleanup Implementation

```typescript
async function ensureDataElementReady(dataElementName: string) {
  // Step 1: Unlock if locked
  const lock = getTestLock('dataElement', dataElementName);
  if (lock) {
    try {
      await unlockDataElement(...);
    } catch (unlockError) {
      // Ignore - lock might be stale
    }
  }

  // Step 2: Try to delete
  try {
    await deleteDataElement(...);
  } catch (error) {
    // Ignore all errors (404, locked, etc.)
  }

  return { success: true }; // Always returns success!
}
```

**Problem:** Cleanup always returns `{ success: true }` even if deletion failed!

### Solutions

#### 1. Verify Deletion After Cleanup ✅ RECOMMENDED
Add verification that object was actually deleted:

```typescript
async function ensureDataElementReady(dataElementName: string) {
  // ... unlock and delete ...
  
  // Step 3: Verify deletion
  try {
    await getDataElement(connection, dataElementName);
    // If we get here, object still exists!
    return { 
      success: false, 
      reason: `Data element ${dataElementName} still exists after cleanup` 
    };
  } catch (error: any) {
    // 404 = object doesn't exist, that's good
    if (error.response?.status === 404) {
      return { success: true };
    }
    // Other error = object might exist, log warning
    if (debugEnabled) {
      builderLogger.warn?.(`[CLEANUP] Could not verify deletion: ${error.message}`);
    }
    return { success: true }; // Assume success
  }
}
```

#### 2. Better Error Handling in Delete
Don't ignore all errors - log and handle specific cases:

```typescript
try {
  await deleteDataElement(...);
} catch (error: any) {
  const status = error.response?.status;
  if (status === 404) {
    // Object doesn't exist - that's fine
    return { success: true };
  } else if (status === 403 || status === 409) {
    // Object is locked or has dependencies
    return { 
      success: false, 
      reason: `Cannot delete: ${error.message}` 
    };
  }
  // Other errors - log but continue
  if (debugEnabled) {
    builderLogger.warn?.(`[CLEANUP] Delete failed: ${error.message}`);
  }
}
```

#### 3. Retry Logic
Add retry logic for cleanup operations:

```typescript
async function ensureDataElementReady(dataElementName: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    // Try unlock and delete
    // Verify deletion
    // If successful, return success
    // If failed, wait and retry
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return { success: false, reason: 'Cleanup failed after retries' };
}
```

#### 4. Check Before Create
Add check in `create()` to detect existing objects:

```typescript
async create(): Promise<this> {
  try {
    // Check if object exists
    try {
      await getDataElement(this.connection, this.config.dataElementName);
      // Object exists - throw error
      throw new Error(`Data element ${this.config.dataElementName} already exists`);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        throw error; // Re-throw if not "not found"
      }
      // 404 = object doesn't exist, continue with create
    }
    
    // Create object
    const result = await createDataElement(...);
    // ...
  }
}
```

### Recommended Fix

**Immediate:** Add verification after cleanup to ensure object was deleted.

**Short-term:** Improve error handling in cleanup functions to return actual success/failure.

**Long-term:** Add retry logic and better dependency checking.

### Test Fix

The test already handles "already exists" error gracefully by skipping. But we should:
1. ✅ Add verification after cleanup (verify object doesn't exist)
2. ✅ Return actual success/failure from cleanup
3. ✅ Skip test if cleanup fails (already implemented)

### Implemented Fix (2025-11-19)

The following changes are now live:

- **Cleanup error reporting**
  - Every delete failure now logs a warning with the exact HTTP status and SAP error text (e.g. `HTTP 423 Locked`).
  - Cleanup helpers return `{ success: false, reason }` only when SAP reports a 423 (object locked/being edited).
  - All other delete failures keep returning success=false, so tests fail instead of being silently skipped.

- **Skip policy tightened**
  - Before running a test we only skip when cleanup reports `HTTP 423 Locked`. Any other failure (409 already exists, transport issues, etc.) now fails fast so we can fix the underlying issue instead of hiding it.
  - After each test we still attempt deletion, but any failure prints a warning with the HTTP status, making CI logs actionable.

- **Documentation + logging**
  - Cleanup warnings are printed even when `DEBUG_TESTS` is disabled, so SAP backend problems are visible in default logs.
  - The builder tests reference these warnings directly (`[CLEANUP][ObjectType] ...`) to make triage easier.

This ensures we only skip when SAP explicitly tells us another user/session holds the lock, aligning with the test policy discussed on 2025‑11‑19.

