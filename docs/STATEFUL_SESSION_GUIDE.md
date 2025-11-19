# Stateful Session Guide (ADT Clients Perspective)

This guide explains how the `@mcp-abap-adt/adt-clients` package manages **stateful ADT sessions** when Builders or high-level clients execute workflows such as `lock → update → unlock`.  
Use it together with:

- [`../../doc/architecture/STATEFUL_SESSION_GUIDE.md`](../../doc/architecture/STATEFUL_SESSION_GUIDE.md) – server/handler orchestration guide
- [`../../connection/docs/STATEFUL_SESSION_GUIDE.md`](../../connection/docs/STATEFUL_SESSION_GUIDE.md) – connection-layer session storage

---

## Responsibilities

| Layer | Responsibility |
|-------|----------------|
| `@mcp-abap-adt/connection` | Maintains HTTP cookies + CSRF token, persists session state if requested |
| `@mcp-abap-adt/adt-clients` | Generates `sap-adt-connection-id`, reuses it across lock/update/unlock, registers locks |
| `mcp-abap-adt` handlers | Configure Builders/clients, decide when to reuse/export session IDs |

---

## Session Lifecycle Inside Builders

1. **Initialization**
   - Each Builder receives an optional `sessionId`. If not provided, the Builder calls `generateSessionId()` (UUID without dashes).
   - Builders cache the session ID in `this.sessionId` and reuse it for every ADT request.

2. **Lock**
   - Builders call the relevant `lock*` function (e.g., `lockTable`) with `{ connection, objectName, sessionId }`.
   - Lock responses return a `lockHandle` (and sometimes `corrNr`). Builders persist both in their internal `state`.
   - If the Builder config includes `onLock`, the callback receives `(lockHandle, sessionId)` so test helpers or CLI tools can store the lock in `.locks/active-locks.json`.

3. **Update**
   - Update helpers (e.g., `updateTable`, `updateFunctionModuleSourceInternal`) accept the existing `lockHandle`/`sessionId`.
   - This avoids double-locking and prevents EU510 “User X is currently editing ...” errors.

4. **Unlock**
   - Unlock helpers receive the same session ID and lock handle.
   - Builders call `forceUnlock()` in `finally` blocks to guarantee cleanup even if update/activate fails.

5. **Activation / Check**
   - `activate()` and `check()` reuse the same session ID to keep the workflow within the same ADT session when needed.

---

## Passing Session IDs Explicitly

```ts
const builder = new TableBuilder(connection, logger, {
  tableName: 'ZADT_BLD_TAB01',
  packageName: testCase.params.package_name,
  transportRequest: testCase.params.transport_request,
  sessionId: payload?.session_id,        // Optional external session
  onLock: createOnLockCallback('table', 'ZADT_BLD_TAB01', undefined, __filename)
});
```

- `sessionId` is optional; supply it to force multiple Builders to share a session.
- The `createOnLockCallback` helper (tests) records `(objectType, objectName, sessionId, lockHandle)` in the lock registry for recovery.

---

## High-Level Clients

### LockClient

```ts
const lockClient = new LockClient(connection, logger);
const { lockHandle, sessionId } = await lockClient.lock({
  objectType: 'class',
  objectName: 'ZCL_MY_CLASS'
});

await lockClient.unlock({
  objectType: 'class',
  objectName: 'ZCL_MY_CLASS',
  lockHandle,
  sessionId
});
```

- Generates a session ID if omitted.
- Handles all supported object types (`class`, `fm`, `table`, `view`, ...).
- Emits `[LOCK] ...` logs when `LOG_LOCKS` isn’t disabled.

### ManagementClient / ValidationClient

- Accept optional `sessionId` to keep activation/check runs inside the same ADT session.
- Builders expose `getCheckResult()` / `getValidationResult()` so handlers can parse ADT XML responses without reissuing requests.

---

## Error Handling Patterns

- **Always unlock:** Builders call `forceUnlock()` in `finally`. When writing custom workflows, mirror this pattern.
- **Skip on 423:** Integration tests treat HTTP 423 (object locked by someone else) as a skip, not a failure.
- **Record locks:** Tests pass `onLock` callbacks so `bin/unlock-test-objects.js` can recover using the lock registry.
- **Per-test session:** Use the Builder’s `sessionId` to correlate lock files and cleanup routines.

---

## See Also

- [`../../doc/architecture/STATEFUL_SESSION_GUIDE.md`](../../doc/architecture/STATEFUL_SESSION_GUIDE.md) – Handler/server view.
- [`../../connection/docs/STATEFUL_SESSION_GUIDE.md`](../../connection/docs/STATEFUL_SESSION_GUIDE.md) – Connection/session storage view.
- `packages/adt-clients/src/utils/lockStateManager.ts` – Persistent lock registry implementation.

