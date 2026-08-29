# Test helpers

## Getting a connection

No test builds its own. `createTestConnection()` reads **where** to connect and
**how** to authenticate from `.env` and `test-config.yaml`, picks the connector
for the system stated in `environment.system`, opens the session, and hands back
a connection that is ready to use. A test that constructs a connector names a
system, and the one it names is the one it was written against — which is how a
suite comes to run entirely on-prem on a cloud tenant.

```typescript
import {
  createTestConnection,
  releaseTestConnection,
} from '../helpers/sessionConfig';

connection = await createTestConnection(logger);   // already connected
// ...
await releaseTestConnection(connection);           // never disconnect() here
```

## The session belongs to the run, not to your file

`globalSetup` opens **one** ABAP session and publishes it; every file adopts
that one, and `globalTeardown` gives it back. Sessions are limited per user —
two at a time on the BTP trial, measured — and multiplying them makes a loaded
system throttle you long before it refuses.

So a test file must **not** call `connection.disconnect()`. On on-prem that is
the platform logoff: it ends the session for everyone, and the first file to
reach `afterAll` takes it away from every file after it. Measured on E19,
`discovery` and `search` each pass alone and the second one fails
`ADT_NOT_CONNECTED` when run together; across the suite it cost 38 red suites —
and some false green ones, because a dead session made `isModernAdtSystem()`
report a modern system as legacy, so files skipped their tests and reported
PASS having run nothing.

`releaseTestConnection()` makes that one decision in one place: it ends only a
session the file opened itself, which is the single-file run where nobody
published any.

One exception, and it replaces the session rather than adding one:

`recycleTestSession(connection)` ends the session, connects again, and publishes
the replacement so later files adopt the new one. One caller needs it —
`cleanup_session_after_test`, which drops stuck locks by ending the session
holding them.

The package delete used to be a second caller, on the rule that a package cannot
be deleted from the session that created it. Measured on the BTP trial, it can:
the delete succeeds either way. The exception is not carried on an unverified
claim, and comes back only if an on-prem run shows the delete failing.

**Never open a second connection beside the first.** One user on one system is
one connection: a second held alongside is what makes a loaded system throttle,
and cloud is not the exception people assume — it tears the session on
`disconnect()` too. Opening and closing connections in a cycle is worse still;
a server can read that churn as an attack.

## Usage in Tests

```typescript
import {
  createTestConnection,
  releaseTestConnection,
} from '../helpers/sessionConfig';

describe('My Test', () => {
  let connection;

  beforeAll(async () => {
    connection = await createTestConnection(logger);
  });

  afterAll(async () => {
    await releaseTestConnection(connection);
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
