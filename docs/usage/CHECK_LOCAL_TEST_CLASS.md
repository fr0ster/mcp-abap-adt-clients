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
import { analyseCheck } from '@mcp-abap-adt/adt-strategies';

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

// One check run. Without `analyse` the report comes back as it arrived, errors
// and all — a check that finds a syntax error is a check that worked. With
// `analyseCheck`, a report carrying an error is a failure listing every message.
const answer = await client.getLocalTestClass().check(
  { className: 'ZCL_MY_CLASS' },
  'inactive',
  { analyse: analyseCheck },
);

if (answer.ok) {
  console.log(answer.getResult().value);   // the check-run report document
} else {
  for (const m of answer.getError().messages) {
    console.log(`[${m.type}] ${m.text}`);
  }
}
```

## Notes

- Local test class checks use the same ADT endpoints as class checks.
- If you need to read metadata, use `readMetadata` on the same object.
- A check of a class that does not exist answers `chkrun:status="notProcessed"`
  with no messages, which reads like clean code if you only count messages;
  `analyseCheck` reads the status first.
