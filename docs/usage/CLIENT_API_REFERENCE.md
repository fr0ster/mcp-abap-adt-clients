# Client API Reference

This project exposes two client classes:

- `AdtClient` - high-level CRUD operations for ADT objects.
- `AdtRuntimeClient` - runtime operations (debugger, logs, feeds, etc.).

`ReadOnlyClient` and `CrudClient` have been removed in the builderless API.

## AdtClient

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection);

// CRUD operations via IAdtObject
await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test class',
});

const readState = await client.getClass().read({ className: 'ZCL_TEST' });
```

## AdtRuntimeClient

```typescript
import { AdtRuntimeClient } from '@mcp-abap-adt/adt-clients';

const runtime = new AdtRuntimeClient(connection);
const feeds = await runtime.getFeeds();
```
