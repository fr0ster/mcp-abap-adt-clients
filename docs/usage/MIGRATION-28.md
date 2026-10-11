# Migrating to 28.0.0

28.0.0 moves the ABAP debugger to `@mcp-abap-adt/interfaces-adt` 14 (#217): the
identity states its mode, `attach` takes the identity, and the contract gains
five members and a result strategy. Nothing outside the ABAP debugger changed.

Declare `@mcp-abap-adt/interfaces-adt` `^14.0.0` if your package imports it, so
npm installs one copy: `npm ls @mcp-abap-adt/interfaces-adt` must show one
version. `@mcp-abap-adt/adt-strategies` 0.9.0 declares the same range.

## 1. An identity gains `debuggingMode`

`IDebuggerIdentity` is a union on `debuggingMode`, required and with no default,
so every caller states the mode. `requestUser` exists only in `user` mode.

```typescript
// before
const identity = { requestUser, terminalId, ideId };
// after — the same behaviour as before is user mode
const identity = { debuggingMode: 'user', requestUser, terminalId, ideId } as const;
// new — terminal mode takes no requestUser, and the type refuses one
const terminal = { debuggingMode: 'terminal', terminalId, ideId } as const;
```

A catch in terminal mode is unmeasured; see
[Identity by mode](CLIENT_API_REFERENCE.md#identity-by-mode).

## 2. `attach` takes the identity

```typescript
// before
await session.attach(requestUser, debuggeeId, { server });
// after
await session.attach(identity, debuggeeId, { server });
```

## 3. `condition` leaves the non-line breakpoints

Only a line breakpoint takes a `condition`; exception, statement and message
breakpoints no longer type it, and the library refuses it at run time if a cast
got past the type.

```typescript
// before
{ kind: 'exception', exceptionClass, condition: 'sy-subrc = 4' }
// after — drop it, or use a line breakpoint
{ kind: 'exception', exceptionClass }
{ kind: 'line', uri, condition: 'sy-subrc = 4' }
```

## 4. A custom `IAbapDebuggerResults` gains `settings`

A complete results object passed to `AbapDebugger` needs the new strategy. The
default reads the raw document, like the other strategies.

```typescript
// before
new AbapDebugger(connection, logger, { ...mine });
// after
import { abapDebuggerDocuments } from '@mcp-abap-adt/adt-clients';
new AbapDebugger(connection, logger, { ...mine, settings: abapDebuggerDocuments.settings });
```

## 5. An implementation or mock of `IAbapDebugger`

`IAbapDebugger` gains a last type parameter, `TSettings`, and five required
members. A class implementing it, or a mock typed by it, must add them:
`syncBreakpoints`, `checkListener`, `detachDebugger`, `terminateDebugger` and
`setDebuggerSettings`.

```typescript
// before
class Fake implements IAbapDebugger<B, L, A, S, V, T, D, W, M> { /* … */ }
// after
class Fake implements IAbapDebugger<B, L, A, S, V, T, D, W, M, SettingsAnswer> {
  /* … plus the five members above */
}
```

## 6. Behaviour you may be relying on

These are not type changes, so the compiler will not tell you. All measured on
premise (2026-10-11), BASIS 816; the server source (BASIS 816, read 2026-10-11)
says the same.

- **`setBreakpoints` replaces the identity's whole set**, and so does a
  `validationOnly` request: every external breakpoint under the key is deleted
  first. If you add breakpoints one request at a time, or validate one after
  arming the others, the earlier ones are gone. Arm the whole set in one call,
  validate before arming, or use `syncBreakpoints` with `scope: 'partial'` to
  replace one object's line breakpoints and keep the rest.

  ```typescript
  // before — the second call removes the first breakpoint
  await dbg.setBreakpoints(identity, [first]);
  await dbg.setBreakpoints(identity, [second]);
  // after
  await dbg.setBreakpoints(identity, [first, second]);
  ```

- **`stopListener` deletes the key's breakpoints** for the request user it
  names, whether or not a listener ran. Stop the listener last, and do not stop
  it between catches if you still want the breakpoints.
- **`skipCount` above 0 is refused**, answered `ok: false` without a request.
  The server accepts it on an external breakpoint and ignores it: the first hit
  stops. `0` is accepted and sends nothing. The field stays typed in
  `interfaces-adt` 14 and leaves the contract in its next major; if you pass it,
  drop it and count hits yourself.
- **One ABAP session listens for one user.** The server binds a session to the
  first identity a listen, check, stop or attach used on it. A listener for
  another request user needs a session of its own.
