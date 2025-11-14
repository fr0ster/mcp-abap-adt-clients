# Session State Management

## Overview

Session state management provides **persistent storage** of HTTP cookies and CSRF tokens to the filesystem. This enables:

1. **Session persistence** - maintain SAP session across multiple script executions
2. **Recovery after crashes** - restore connection state without re-authentication
3. **Reduced server load** - reuse existing sessions instead of creating new ones
4. **Debug support** - inspect session state for troubleshooting

## Architecture

### Package Structure

**@mcp-abap-adt/connection** - Core session management
- `ISessionStorage` interface
- `FileSessionStorage` implementation
- Session state integrated into `BaseAbapConnection`

**@mcp-abap-adt/adt-clients** - Lock state management
- `LockStateManager` - tracks lock handles with session IDs
- References session IDs stored by connection layer

### File Structure

```
.sessions/
  <sessionId>.json     # Session state (cookies, CSRF token)
.locks/
  active-locks.json    # Lock registry with session references
```

### Session State Format

```typescript
interface SessionState {
  cookies: string | null;           // Raw cookie header
  csrfToken: string | null;         // X-CSRF-Token value
  cookieStore: Record<string, string>; // Parsed cookies
}

// Stored in file:
{
  sessionId: string;
  timestamp: number;
  pid: number;
  state: SessionState
}
```

## Usage

### Basic Session Usage

```typescript
import { createAbapConnection, FileSessionStorage } from '@mcp-abap-adt/connection';

// Create session storage
const sessionStorage = new FileSessionStorage({
  sessionDir: '.sessions',
  prettyPrint: true  // For debugging
});

// Create connection
const connection = createAbapConnection(config, logger);

// Enable stateful session
await connection.enableStatefulSession('my-session-id', sessionStorage);

// Make requests - cookies and CSRF token are automatically managed
const response = await connection.makeAdtRequest({
  url: '/sap/bc/adt/repository/nodestructure',
  method: 'GET',
  timeout: 30000
});

// Session state is automatically saved after each request
// Load session state on next run
await connection.loadSessionState();
```

### With Lock State Integration

```typescript
import { createAbapConnection, FileSessionStorage } from '@mcp-abap-adt/connection';
import { getLockStateManager } from '@mcp-abap-adt/adt-clients';
import { updateClassSource } from '@mcp-abap-adt/adt-clients';

const sessionId = 'test-session-123';
const sessionStorage = new FileSessionStorage();
const lockManager = getLockStateManager();

// Setup connection with session
const connection = createAbapConnection(config, logger);
await connection.enableStatefulSession(sessionId, sessionStorage);

// Update class - lock will be registered with sessionId
await updateClassSource(connection, {
  class_name: 'ZCL_TEST',
  source_code: newCode,
  activate: true
});

// Session state and lock handle are both persisted
// Can be recovered later using:
const lock = lockManager.getLock('class', 'ZCL_TEST');
// lock.sessionId === sessionId
// lock.lockHandle can be used to unlock
```

### Recovery Scenario

```typescript
// After crash, restore session and unlock objects
const sessionId = 'test-session-123';
const sessionStorage = new FileSessionStorage();
const lockManager = getLockStateManager();

// Restore connection session
const connection = createAbapConnection(config, logger);
await connection.enableStatefulSession(sessionId, sessionStorage);
await connection.loadSessionState();

// Find stuck locks for this session
const locks = lockManager.getAllLocks()
  .filter(lock => lock.sessionId === sessionId);

// Unlock all objects in same session
for (const lock of locks) {
  await unlockObject(connection, lock);
  lockManager.removeLock(lock.objectType, lock.objectName, lock.functionGroupName);
}
```

## CLI Tools

### Session Management

```bash
# List all sessions
adt-manage-sessions list

# Show session details
adt-manage-sessions info my-session-id

# Clean up stale sessions (>30 min or dead process)
adt-manage-sessions cleanup

# Clear all sessions
adt-manage-sessions clear
```

Or with npx:
```bash
npx @mcp-abap-adt/adt-clients adt-manage-sessions list
```

### Lock Management (with session info)

```bash
# List locks (shows session IDs)
adt-manage-locks list

# Output:
📋 Active Locks (1):

1. CLASS: ZCL_TEST
   Session: test-session-123    # ← Can restore this session
   Lock Handle: XYZ789
   Age: 5 minutes
   Process: 12345 🔴 Dead

# Unlock using restored session
adt-manage-locks unlock class ZCL_TEST
```

## FileSessionStorage Options

```typescript
interface FileSessionStorageOptions {
  /**
   * Directory to store session files
   * @default '.sessions'
   */
  sessionDir?: string;

  /**
   * Whether to create session directory if it doesn't exist
   * @default true
   */
  createDir?: boolean;

  /**
   * Pretty-print JSON files (for debugging)
   * @default false
   */
  prettyPrint?: boolean;
}
```

## API Reference

### ISessionStorage Interface

```typescript
interface ISessionStorage {
  save(sessionId: string, state: SessionState): Promise<void>;
  load(sessionId: string): Promise<SessionState | null>;
  delete(sessionId: string): Promise<void>;
}
```

### FileSessionStorage Methods

```typescript
class FileSessionStorage implements ISessionStorage {
  // Standard ISessionStorage methods
  save(sessionId: string, state: SessionState): Promise<void>;
  load(sessionId: string): Promise<SessionState | null>;
  delete(sessionId: string): Promise<void>;

  // Additional utility methods
  listSessions(): Promise<string[]>;
  getSessionMetadata(sessionId: string): Promise<{ sessionId, timestamp, pid, age } | null>;
  cleanupStaleSessions(maxAgeMs?: number): Promise<string[]>;
  cleanupDeadProcessSessions(): Promise<string[]>;
  clearAll(): Promise<void>;
}
```

### Connection Methods

```typescript
class BaseAbapConnection {
  // Enable stateful session mode
  enableStatefulSession(sessionId: string, storage: ISessionStorage): Promise<void>;
  
  // Disable stateful session mode
  disableStatefulSession(saveBeforeDisable?: boolean): Promise<void>;
  
  // Get current session mode
  getSessionMode(): 'stateless' | 'stateful';
  
  // Load/save/clear session state
  loadSessionState(): Promise<void>;
  saveSessionState(): Promise<void>;
  clearSessionState(): Promise<void>;
  
  // Deprecated (use enableStatefulSession instead)
  setSessionId(sessionId: string): void;
  getSessionId(): string | null;
  setSessionStorage(storage: ISessionStorage | null): void;
  getSessionStorage(): ISessionStorage | null;
}
```

## Best Practices

1. **Use unique session IDs** - Include timestamp or UUID to avoid conflicts
2. **Clean up old sessions** - Run `adt-manage-sessions cleanup` periodically
3. **Session per test** - Each integration test should have its own session
4. **Don't commit .sessions/** - Already in `.gitignore`
5. **Combine with lock tracking** - Use same sessionId for locks and connection

## Example: Integration Test with Session Persistence

```typescript
describe('Class Operations', () => {
  let connection: AbapConnection;
  let sessionStorage: FileSessionStorage;
  let sessionId: string;

  beforeAll(async () => {
    sessionId = `test-${Date.now()}`;
    sessionStorage = new FileSessionStorage({ prettyPrint: true });
    
    connection = createAbapConnection(config, logger);
    await connection.enableStatefulSession(sessionId, sessionStorage);
  });

  afterAll(async () => {
    // Cleanup session
    await connection.clearSessionState();
  });

  it('should maintain session across requests', async () => {
    // First request - new session
    await createClass(connection, { class_name: 'ZCL_TEST', ... });
    
    // Session state is automatically saved
    const state = await sessionStorage.load(sessionId);
    expect(state?.csrfToken).toBeTruthy();
    expect(state?.cookies).toBeTruthy();
    
    // Second request - reuses session
    await updateClassSource(connection, { class_name: 'ZCL_TEST', ... });
    
    // Same CSRF token and cookies
    const state2 = await sessionStorage.load(sessionId);
    expect(state2?.csrfToken).toBe(state?.csrfToken);
  });
});
```

## Security Considerations

1. **.sessions/ contains sensitive data** - SAP cookies and CSRF tokens
2. **Never commit session files** - Added to `.gitignore`
3. **Clean up after tests** - Always call `clearSessionState()` in afterAll
4. **File permissions** - Session files are created with default permissions
5. **Token expiration** - SAP sessions expire after inactivity (typically 15-30 min)

## Troubleshooting

### Session not loading

```bash
# Check if session file exists
ls -la .sessions/

# Inspect session content
adt-manage-sessions info <sessionId>

# Check file permissions
stat .sessions/<sessionId>.json
```

### CSRF token expired

```typescript
// Connection automatically fetches new token on 403
// Old token is replaced in session storage
await connection.makeAdtRequest(...); // Gets 403
// New token fetched automatically
await connection.makeAdtRequest(...); // Succeeds with new token
```

### Session from different process

```bash
# List sessions with process info
adt-manage-sessions list

# Clean up sessions from dead processes
adt-manage-sessions cleanup
```
