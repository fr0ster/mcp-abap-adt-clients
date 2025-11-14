# Lock Recovery Integration Test

## Overview

This test demonstrates and validates the lock recovery system that allows resuming operations after a crash or process interruption.

## Test Scenario

The test simulates the following real-world scenario:

1. **Phase 1: Lock Object with Client1**
   - Create connection instance (Client1)
   - Set up session persistence
   - Create and lock an SAP object
   - Save session state (cookies, CSRF token) to disk
   - Register lock handle in lock registry
   - Verify files are persisted

2. **Crash Simulation**
   - Client1 destroyed (simulating process crash)
   - Session and lock files remain on disk

3. **Phase 2: Restore and Continue with Client2**
   - Create new connection instance (Client2) with same sessionId
   - Restore session state from file
   - Retrieve lock handle from lock registry
   - Unlock object using restored session
   - Complete operations successfully

## Configuration

Test configuration is in `tests/test-config.yaml`:

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
      abap_language_version: "5"
  
  # Phase 2: Restore session and unlock object
  phase2_unlock:
    session_config:
      persist_session: true
      sessions_dir: ".sessions"
      session_id_format: "lock_recovery_session"  # Same session ID as phase 1
      cleanup_session_after_test: true  # Cleanup after successful unlock
    lock_config:
      locks_dir: ".locks"
      persist_locks: true
      cleanup_locks_after_test: true  # Cleanup locks after successful unlock
    object:
      type: "CLAS/OC"
      name: "ZCL_LOCK_RECOVERY_TEST"  # Same object as phase 1
```

## What This Test Validates

✅ **Session Persistence**: Sessions can be saved to disk with cookies and CSRF tokens

✅ **Lock Tracking**: Lock handles can be tracked in a persistent registry

✅ **Crash Recovery**: After a crash, a new connection instance can:
  - Restore session state from file
  - Retrieve lock handles from registry
  - Resume operations with restored state
  - Successfully unlock objects that were locked before crash

## File Structure

### Session Files
Location: `.sessions/<sessionId>.json`

Contains:
- Cookies (as string)
- CSRF token
- Cookie store (as object)
- Timestamp
- Process ID (PID)

Example:
```json
{
  "sessionId": "lock_recovery_session",
  "timestamp": 1704123456789,
  "pid": 12345,
  "state": {
    "cookies": "sap-usercontext=sap-client%3d100; SAP_SESSIONID_xxx=mock_session_12345",
    "csrfToken": "mock_csrf_token_abcdef",
    "cookieStore": {
      "sap-usercontext": "sap-client=100",
      "SAP_SESSIONID_xxx": "mock_session_12345"
    }
  }
}
```

### Lock Registry
Location: `.locks/active-locks.json`

Contains array of lock states:
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

## Running the Test

```bash
# Run all integration tests including lock recovery
npm test -- testLockRecovery.integration.test.ts

# Run with verbose output
DEBUG_TESTS=true npm test -- testLockRecovery.integration.test.ts
```

## Use Cases

This lock recovery system is useful for:

1. **Crash Recovery**: Resume after unexpected crashes
2. **CI/CD Pipelines**: Handle interruptions in automated testing
3. **Development**: Recover from IDE crashes during development
4. **Long-running Operations**: Save state during lengthy migrations
5. **Distributed Systems**: Share session state across processes

## CLI Tools

Manage sessions and locks using CLI tools:

```bash
# List all sessions
adt-manage-sessions list

# View session details
adt-manage-sessions info lock_recovery_session

# List all active locks
adt-manage-locks list

# Unlock specific object
adt-manage-locks unlock class ZCL_TEST_RECOVERY

# Clean up stale locks/sessions
adt-manage-locks cleanup
adt-manage-sessions cleanup
```

## See Also

- [SESSION_STATE_MANAGEMENT.md](../../../SESSION_STATE_MANAGEMENT.md) - Session persistence documentation
- [LOCK_STATE_MANAGEMENT.md](../../../LOCK_STATE_MANAGEMENT.md) - Lock registry documentation
