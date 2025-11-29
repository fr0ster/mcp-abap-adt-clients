# Session and Lock Persistence in Tests

## Overview

Tests can automatically persist HTTP sessions and lock handles based on configuration in `src/__tests__/helpers/test-config.yaml`.

## Configuration

Edit `src/__tests__/helpers/test-config.yaml`:

```yaml
# Session persistence configuration
session_config:
  # Enable session persistence (saves cookies and CSRF tokens)
  persist_session: true
  # Directory for session files (relative to project root)
  sessions_dir: ".sessions"
  # Session ID format: {test_name}_{timestamp} or custom
  session_id_format: "auto"
  # Clean up session after test
  cleanup_session_after_test: false

# Lock persistence configuration
lock_config:
  # Directory for lock files (relative to project root)
  locks_dir: ".locks"
  # Track locks in persistent storage
  persist_locks: true
  # Auto-cleanup locks after test
  cleanup_locks_after_test: true
```

## Usage in Tests

```typescript
import { setupTestEnvironment, cleanupTestEnvironment } from '../helpers/sessionConfig';

describe('My Test', () => {
  let connection;
  let sessionId;
  let testConfig;

  beforeAll(async () => {
    connection = createAbapConnection(config, logger);
    
    // Setup based on test-config.yaml
    const env = await setupTestEnvironment(
      connection,
      'my_test_name',  // Used in session ID
      __filename
    );
    
    sessionId = env.sessionId;
    testConfig = env.testConfig;
  });

  afterAll(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  it('should work', async () => {
    // Session and locks are automatically managed
    await createClass(connection, {...});
  });
});
```

## Benefits

1. **Session Persistence**
   - Cookies and CSRF tokens saved to `.sessions/{testName}_{timestamp}.json`
   - Faster test execution (reuse existing session)
   - Recovery after test crashes

2. **Lock Tracking**
   - Lock handles saved to `.locks/active-locks.json`
   - Can unlock objects after test failures
   - Cross-process lock tracking

3. **CLI Management**
   ```bash
   # View sessions
   adt-manage-sessions list
   
   # View locks
   adt-manage-locks list
   
   # Cleanup stale sessions/locks
   adt-manage-sessions cleanup
   adt-manage-locks cleanup
   ```

## Files Generated

### Session Files
```
.sessions/
  testClass_1699999999.json
  testFunctionModule_1700000000.json
```

Example session file:
```json
{
  "sessionId": "testClass_1699999999",
  "timestamp": 1699999999,
  "pid": 12345,
  "state": {
    "cookies": "SAP_SESSIONID_...",
    "csrfToken": "abc123...",
    "cookieStore": {
      "SAP_SESSIONID": "...",
      "sap-usercontext": "..."
    }
  }
}
```

### Lock Registry
```
.locks/
  active-locks.json
```

Example lock registry:
```json
{
  "locks": [
    {
      "sessionId": "testClass_1699999999",
      "lockHandle": "XYZ789",
      "objectType": "class",
      "objectName": "ZCL_TEST",
      "timestamp": 1699999999,
      "pid": 12345,
      "testFile": "testClass.integration.test.ts"
    }
  ]
}
```

## Platform Compatibility

Works on:
- ✅ Windows
- ✅ Linux
- ✅ macOS

Uses Node.js `path` module for cross-platform path handling.

## See Also

- [Lock State Management](../../LOCK_STATE_MANAGEMENT.md)
- [Session State Management](../../SESSION_STATE_MANAGEMENT.md)
- Example: [sessionPersistence.example.ts](../examples/sessionPersistence.example.ts)
