# End-to-End (E2E) Tests

Advanced test for validating session/lock persistence and crash recovery on a real SAP ABAP system.

## Overview

This folder contains a specialized test that validates the persistence layer - the ability to save and restore session and lock state across process crashes. This goes beyond individual operation testing (which is done in `../integration/`).

**Note:** Workflow tests (class.workflow, functionModule.workflow) have been **removed as duplicates**. All CRUD operations are already comprehensively tested in `../integration/` tests. E2E now contains only the lock recovery test, which validates a unique scenario not covered by integration tests.

**Folder history:** This folder was previously called `integration/` but has been renamed to `e2e/` to better reflect its purpose.

## Lock Recovery Test

### Purpose

Validates that the system can recover from client crashes by persisting session and lock state to files.

### Test Scenario

The test simulates a real-world crash recovery:

**Phase 1: Lock Object with Client1**
1. Create connection instance (Client1)
2. Set up session persistence
3. Create and lock an SAP object
4. Save session state (cookies, CSRF token) to disk
5. Register lock handle in lock registry
6. Verify files are persisted

**Crash Simulation**
- Client1 destroyed (simulating process crash)
- Session and lock files remain on disk

**Phase 2: Restore and Continue with Client2**
1. Create new connection instance (Client2) with same sessionId
2. Restore session state from file
3. Retrieve lock handle from lock registry
4. Unlock object using restored session
5. Complete operations successfully

### What This Validates

✅ **Session Persistence**: Sessions can be saved to disk with cookies and CSRF tokens

✅ **Lock Tracking**: Lock handles can be tracked in a persistent registry

✅ **Crash Recovery**: After a crash, a new connection instance can:
  - Restore session state from file
  - Retrieve lock handles from registry
  - Resume operations with restored state
  - Successfully unlock objects that were locked before crash

### File Structure

**Session Files** (`.sessions/<sessionId>.json`):
```json
{
  "sessionId": "lock_recovery_session",
  "timestamp": 1704123456789,
  "pid": 12345,
  "state": {
    "cookies": "sap-usercontext=sap-client%3d100; SAP_SESSIONID_xxx=...",
    "csrfToken": "mock_csrf_token_abcdef",
    "cookieStore": {
      "sap-usercontext": "sap-client=100",
      "SAP_SESSIONID_xxx": "mock_session_12345"
    }
  }
}
```

**Lock Registry** (`.locks/active-locks.json`):
```json
{
  "locks": [
    {
      "sessionId": "lock_recovery_session",
      "lockHandle": "LOCK_HANDLE_XYZ123",
      "objectType": "class",
      "objectName": "ZCL_TEST_RECOVERY",
      "timestamp": 1704123456789,
      "pid": 12345,
      "testFile": "/path/to/test/file.ts"
    }
  ]
}
```

### Use Cases

This lock recovery system is useful for:

1. **Crash Recovery**: Resume after unexpected crashes
2. **CI/CD Pipelines**: Handle interruptions in automated testing
3. **Development**: Recover from IDE crashes during development
4. **Long-running Operations**: Save state during lengthy migrations
5. **Distributed Systems**: Share session state across processes

## Why Workflow Tests Were Removed

Previous workflow tests (`class.workflow.test.ts`, `functionModule.workflow.test.ts`) were removed because they were **duplicates**:

- They tested: create → read → update → check → lock → unlock → activate → validate → run → delete
- **Problem:** All these operations are already tested individually in `../integration/` tests
- **No added value:** If individual operations work, sequential calls also work
- **Maintenance burden:** Same test logic in two places
- **Longer test time:** Redundant execution

If integration tests pass, workflows automatically work. E2E should only test scenarios that integration tests cannot cover - like this crash recovery test.

## Running Tests

```bash
# Run lock recovery test
npm test -- e2e

# Run with debug logs
DEBUG_TESTS=true npm test -- e2e
```

## Configuration

Test configuration in `test-config.yaml`:

```yaml
lock_recovery_test:
  enabled: true
  description: "Test lock recovery after client crash using session restoration"
  
  # Phase 1: Lock object and save session/lock handle
  phase1_lock:
    session_config:
      persist_session: true
      sessions_dir: ".sessions"
      session_id_format: "lock_recovery_session"  # Fixed session ID
      cleanup_session_after_test: false  # Keep session for phase 2
    lock_config:
      locks_dir: ".locks"
      persist_locks: true
      cleanup_locks_after_test: false  # Keep locks for phase 2
    object:
      type: "CLAS/OC"
      name: "ZCL_LOCK_RECOVERY_TEST"
      package: "ZOK_TEST_PKG_01"
      description: "Test class for lock recovery scenario"
  
  # Phase 2: Restore session and unlock object
  phase2_unlock:
    session_config:
      persist_session: true
      sessions_dir: ".sessions"
      session_id_format: "lock_recovery_session"  # Same session ID
      cleanup_session_after_test: true  # Cleanup after successful unlock
    lock_config:
      locks_dir: ".locks"
      persist_locks: true
      cleanup_locks_after_test: true  # Cleanup locks after successful unlock
    object:
      type: "CLAS/OC"
      name: "ZCL_LOCK_RECOVERY_TEST"  # Same object as phase 1
```

## See Also

- [SESSION_STATE_MANAGEMENT.md](../../../SESSION_STATE_MANAGEMENT.md) - Session persistence documentation
- [LOCK_STATE_MANAGEMENT.md](../../../LOCK_STATE_MANAGEMENT.md) - Lock registry documentation
- [../integration/README.md](../integration/README.md) - Individual operation tests
