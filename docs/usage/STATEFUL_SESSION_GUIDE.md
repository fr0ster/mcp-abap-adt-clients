# Stateful Session Guide

This guide explains how `@mcp-abap-adt/adt-clients` manages ADT sessions for CRUD workflows.

## Key Points

- `AdtClient` and `Adt*` objects operate through `IAbapConnection`.
- The connection maintains the ADT session (`sap-adt-connection-id`).
- Lock/unlock operations return a `lockHandle` used by update/delete flows.
- Tests and helpers track locks in `.locks/active-locks.json`.

## Workflow Example

```typescript
const client = new AdtClient(connection);

await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPKG',
  description: 'Test',
}, { activateOnCreate: true });

await client.getClass().update({
  className: 'ZCL_TEST',
}, { sourceCode: updatedCode, activateOnUpdate: true });
```

## Cleanup Guidance

- Always unlock or delete objects after failures.
- Use the lock registry helpers to recover stale locks.
