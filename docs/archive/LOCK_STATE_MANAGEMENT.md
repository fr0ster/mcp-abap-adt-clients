# Lock State Management

## Overview

The lock state management system provides **persistent storage** of lock handles and session IDs to the filesystem. This enables:

1. **Recovery after crashes** - locks can be released even if tests crash
2. **Manual intervention** - developers can manually unlock objects
3. **Debug support** - maintain state for analysis
4. **Automatic cleanup** - remove stale locks from dead processes

## Architecture

### File Structure

```
.locks/
  active-locks.json     # Registry of all active locks
```

### Lock State Format

```typescript
interface LockState {
  sessionId: string;           // ADT session ID
  lockHandle: string;          // SAP lock handle
  objectType: string;          // 'class', 'fm', 'program', etc.
  objectName: string;          // Object name
  functionGroupName?: string;  // Required for FM
  timestamp: number;           // When lock was acquired
  pid: number;                 // Process ID that created lock
  testFile?: string;           // Test file that created lock
}
```

## Usage

### CLI Tool

```bash
# List all active locks
adt-manage-locks list

# Clean up stale locks (>30 min old or from dead processes)
adt-manage-locks cleanup

# Unlock specific object on SAP server
adt-manage-locks unlock class ZCL_TEST
adt-manage-locks unlock fm ZOK_TEST_FM_01 ZOK_TEST_FG_01

# Clear all locks from registry (doesn't unlock on SAP!)
adt-manage-locks clear
```

Or with npx:
```bash
npx @mcp-abap-adt/adt-clients adt-manage-locks list
```

### In Test Code

```typescript
import { registerTestLock, unregisterTestLock } from '../helpers/lockHelper';

describe('My Test', () => {
  let lockHandle: string;
  let sessionId: string;

  afterEach(async () => {
    // Cleanup locks on test failure
    if (lockHandle) {
      try {
        await unlockClass(connection, 'ZCL_TEST', lockHandle, sessionId);
        unregisterTestLock('class', 'ZCL_TEST');
      } catch (error) {
        // Lock already released
      }
    }
  });

  it('should update class', async () => {
    // Lock and register
    lockHandle = await lockClass(connection, 'ZCL_TEST', sessionId);
    registerTestLock('class', 'ZCL_TEST', sessionId, lockHandle, undefined, __filename);

    // ... do work ...

    // Unlock and unregister
    await unlockClass(connection, 'ZCL_TEST', lockHandle, sessionId);
    unregisterTestLock('class', 'ZCL_TEST');
    lockHandle = null;
  });
});
```

### Programmatic API

```typescript
import { getLockStateManager } from '../src/utils/lockStateManager';

const lockManager = getLockStateManager();

// Register a lock
lockManager.registerLock({
  sessionId: 'abc-123',
  lockHandle: 'XYZ789',
  objectType: 'class',
  objectName: 'ZCL_TEST',
});

// Get specific lock
const lock = lockManager.getLock('class', 'ZCL_TEST');

// Get all locks
const allLocks = lockManager.getAllLocks();

// Get stale locks (>30 min)
const staleLocks = lockManager.getStaleLocks();

// Get locks from dead processes
const deadLocks = lockManager.getDeadProcessLocks();

// Remove lock
lockManager.removeLock('class', 'ZCL_TEST');

// Cleanup stale locks
const cleaned = lockManager.cleanupStaleLocks();
```

## Workflow Integration

### Current Update Pattern

All `update.ts` files follow this pattern:

```typescript
export async function updateObject(...) {
  let lockHandle: string | undefined;
  
  try {
    // 1. Lock object
    lockHandle = await lockObject(connection, objectName, sessionId);
    
    // 2. Upload changes
    await uploadSource(connection, objectName, lockHandle, source);
    
    // 3. Unlock
    await unlockObject(connection, objectName, lockHandle, sessionId);
    lockHandle = undefined;
    
    // 4. Activate
    if (shouldActivate) {
      await activateObject(connection, objectName, sessionId);
    }
    
  } catch (error) {
    // CRITICAL: Always unlock on error
    if (lockHandle) {
      try {
        await unlockObject(connection, objectName, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }
    throw error;
  }
}
```

### Enhanced Pattern with Persistence

```typescript
import { registerTestLock, unregisterTestLock } from '../helpers/lockHelper';

export async function updateObject(...) {
  let lockHandle: string | undefined;
  
  try {
    // 1. Lock object
    lockHandle = await lockObject(connection, objectName, sessionId);
    
    // 2. Register lock (persistence)
    registerTestLock('class', objectName, sessionId, lockHandle);
    
    // 3. Upload changes
    await uploadSource(connection, objectName, lockHandle, source);
    
    // 4. Unlock
    await unlockObject(connection, objectName, lockHandle, sessionId);
    lockHandle = undefined;
    
    // 5. Unregister lock
    unregisterTestLock('class', objectName);
    
    // 6. Activate
    if (shouldActivate) {
      await activateObject(connection, objectName, sessionId);
    }
    
  } catch (error) {
    // CRITICAL: Always unlock on error
    if (lockHandle) {
      try {
        await unlockObject(connection, objectName, lockHandle, sessionId);
        unregisterTestLock('class', objectName);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }
    throw error;
  }
}
```

## Recovery Scenarios

### Scenario 1: Test Crashes

```bash
# List locks
adt-manage-locks list

# Output:
📋 Active Locks (2):

1. CLASS: ZCL_TEST
   Session: abc-123
   Lock Handle: XYZ789
   Age: 5 minutes
   Process: 12345 🔴 Dead
   Test File: testClass.integration.test.ts

# Unlock on SAP server
adt-manage-locks unlock class ZCL_TEST
```

### Scenario 2: Jest Timeout

```bash
# Cleanup stale locks
adt-manage-locks cleanup

# Output:
🧹 Cleaned up 3 stale lock(s):
1. CLASS: ZCL_TEST (>30 min, dead process)
2. FM: ZOK_TEST_FG_01/ZOK_TEST_FM_01 (>30 min, dead process)
```

### Scenario 3: Manual Cleanup

```bash
# Clear all from registry (doesn't unlock on SAP!)
adt-manage-locks clear

# Then wait for SAP to auto-unlock (15-30 min)
# Or unlock manually in SAP GUI (SM12)
```

## Best Practices

1. **Always register locks** - Use `registerTestLock` immediately after acquiring lock
2. **Always unregister locks** - Use `unregisterTestLock` after releasing lock
3. **Use afterEach cleanup** - Ensure locks are released even on test failure
4. **Run cleanup periodically** - Before test runs: `adt-manage-locks cleanup`
5. **Don't commit .locks/** - Already in `.gitignore`

## Future Enhancements

- [ ] Auto-cleanup on test start
- [ ] Integration with Jest global setup/teardown
- [ ] Lock timeout warnings
- [ ] Lock conflict detection
- [ ] SAP session validation
- [ ] Lock renewal for long operations
