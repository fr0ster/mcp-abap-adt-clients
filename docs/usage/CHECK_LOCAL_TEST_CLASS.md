# Check Local Test Class

This guide shows how to validate local test classes using `AdtClient`.

## Using AdtClient

```typescript
import {
  AdtOnPremConnector,
  BasicAuthProvider,
  OnPremHttpTransport,
} from '@mcp-abap-adt/connection';
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const config = {
  url: process.env.SAP_URL!,
  authType: 'basic' as const,
  username: process.env.SAP_USERNAME!,
  password: process.env.SAP_PASSWORD!,
  client: process.env.SAP_CLIENT,
};

// System, credential and wire — all stated, never inferred.
const connection = new AdtOnPremConnector(
  config,
  new BasicAuthProvider(config.username, config.password),
  new OnPremHttpTransport(() => ({}), null, {
    client: config.client,
    baseUrl: config.url,
  }),
);
await connection.connect();

const client = new AdtClient(connection);

const result = await client.getLocalTestClass().check({
  className: 'ZCL_MY_CLASS',
});

console.log(result.checkResult?.status);
```

## Notes

- Local test class checks use the same ADT endpoints as class checks.
- If you need to read metadata, use `readMetadata` on the same object.
