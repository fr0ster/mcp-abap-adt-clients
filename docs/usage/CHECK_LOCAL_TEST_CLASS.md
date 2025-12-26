# Check Local Test Class

This guide shows how to validate local test classes using `AdtClient`.

## Using AdtClient

```typescript
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const connection = createAbapConnection({
  url: process.env.SAP_URL!,
  authType: 'basic',
  username: process.env.SAP_USERNAME!,
  password: process.env.SAP_PASSWORD!,
  client: process.env.SAP_CLIENT,
});

const client = new AdtClient(connection);

const result = await client.getLocalTestClass().check({
  className: 'ZCL_MY_CLASS',
});

console.log(result.checkResult?.status);
```

## Notes

- Local test class checks use the same ADT endpoints as class checks.
- If you need to read metadata, use `readMetadata` on the same object.
