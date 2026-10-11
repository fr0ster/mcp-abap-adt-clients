# Migrating to 29.0.0

29.0.0 moves the breakpoints to `@mcp-abap-adt/interfaces-adt` 15: `skipCount`
leaves the type and every kind gains `clientId`. Nothing else changed.

Declare `@mcp-abap-adt/interfaces-adt` `^15.0.0` if your package imports it, so
npm installs one copy: `npm ls @mcp-abap-adt/interfaces-adt` must show one
version. `@mcp-abap-adt/adt-strategies` 0.10.0 declares the same range.

## 1. `skipCount` is removed from the type - drop it

On 28.x a value above 0 was refused at run time, answered `ok: false` without a
request; the server accepts `skipCount` on an external breakpoint and ignores
it, so the first hit stops (measured on premise (2026-10-11), BASIS 816). The
compiler now refuses the field. Delete it, and count hits yourself if you need
the n-th one.

```typescript
// before
{ kind: 'line', uri, skipCount: 2 }
// after
{ kind: 'line', uri }
```

## 2. `clientId` is available on every kind

`clientId` is the caller's tag. The server echoes it on every row of the answer,
placed and refused alike, and does not keep the request's order (the refused
rows came first; measured on premise (2026-10-11), BASIS 816). A line
breakpoint is renumbered as well, so pair answer rows with request rows by
`clientId`, not by position. Optional; a breakpoint without one sends nothing.

```typescript
await dbg.setBreakpoints(identity, [
  { kind: 'line', uri, clientId: 'first' },
  { kind: 'exception', exceptionClass, clientId: 'second' },
]);
```

## 3. A package that implements or mocks the contract

Breakpoint objects typed by `IDebuggerBreakpoint` take the new optional field
and lose `skipCount`; a mock or fixture that sets `skipCount` stops compiling.
