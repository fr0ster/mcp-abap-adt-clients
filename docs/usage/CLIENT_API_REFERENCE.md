# Client API Reference

This project exposes the following client classes:

- `AdtClient` - high-level CRUD operations for ADT objects.
- `AdtClientBatch` - batch mode: multiple read operations in a single HTTP round-trip.
- `AdtRuntimeClient` - stable runtime operations (ABAP debugger, traces, dumps, logs, feeds, etc.).
- `AdtRuntimeClientBatch` - batch mode for runtime operations.
- `AdtRuntimeClientExperimental` - runtime APIs in progress (currently AMDP debugger/data preview).

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

Operation results are stored in the returned state:

```typescript
const createState = await client.getFunctionModule().create({
  functionGroupName: 'ZFGROUP',
  functionModuleName: 'ZFM_TEST',
  description: 'Test FM',
});

console.log(createState.createResult?.status);
```

### Accept Negotiation

The client can optionally auto-correct `Accept` headers after a 406 response:

```typescript
const client = new AdtClient(connection, console, {
  enableAcceptCorrection: true,
});
```

You can also override the `Accept` header per read call:

```typescript
await client.getClass().read(
  { className: 'ZCL_TEST' },
  'active',
  { accept: 'text/plain' }
);

await client.getClass().readMetadata(
  { className: 'ZCL_TEST' },
  { accept: 'application/vnd.sap.adt.oo.classes.v4+xml', version: 'active' }
);

// Read source without version (initial post-create state)
await client.getClass().read({ className: 'ZCL_TEST' }, undefined);
```

### AdtUtils (Object Metadata/Source)

`AdtUtils.readObjectMetadata` and `AdtUtils.readObjectSource` enforce strict object types to prevent invalid inputs like `view:ZOBJ`.

```typescript
import type { AdtObjectType, AdtSourceObjectType } from '@mcp-abap-adt/adt-clients';

const utils = client.getUtils();
const metadataType: AdtObjectType = 'DDLS/DF';
const sourceType: AdtSourceObjectType = 'view';

await utils.readObjectMetadata(metadataType, 'ZOK_I_CDS_TEST');
await utils.readObjectSource(sourceType, 'ZOK_I_CDS_TEST', undefined, 'active');
```

### AdtUtils (Where-used)

Where-used is a two-step flow:

1) `getWhereUsedScope` fetches scope XML (available object types + default selections).
2) `getWhereUsed` executes the search with that scope (defaults to server selection if scope is omitted).

`modifyWhereUsedScope` is a local helper that edits the scope XML (no ADT call).

See `docs/architecture/ARCHITECTURE.md` for the architectural overview.

```typescript
const utils = client.getUtils();

const scopeResponse = await utils.getWhereUsedScope({
  object_name: 'ZMY_CLASS',
  object_type: 'class',
});

const scopeXml = utils.modifyWhereUsedScope(scopeResponse.data, {
  enableOnly: ['CLAS/OC', 'INTF/OI'],
});

const result = await utils.getWhereUsed({
  object_name: 'ZMY_CLASS',
  object_type: 'class',
  scopeXml,
});
```

## AdtClientBatch

`AdtClientBatch` wraps `AdtClient` with a recording connection that collects requests
and sends them in a single `multipart/mixed` HTTP request via `POST /sap/bc/adt/debugger/batch`.

```typescript
import { AdtClientBatch } from '@mcp-abap-adt/adt-clients';

const batch = new AdtClientBatch(connection, logger);

// Record operations — same factory API as AdtClient
const classPromise = batch.getClass().readMetadata({ className: 'CL_ABAP_TYPEDESCR' });
const domainPromise = batch.getDomain().readMetadata({ domainName: 'MANDT' });

// Execute all recorded operations in one HTTP round-trip
await batch.batchExecute();

// Resolve individual results
const classState = await classPromise;   // IClassState
const domainState = await domainPromise; // IDomainState
```

### Batch-Safe Operations

Only single-step operations are batch-compatible:
- `read()`, `readMetadata()`, `readTransport()` — single GET
- `check()`, `validate()`, `activate()` — single POST

Multi-step chains (`create()`, `update()`, `delete()`) are **not** batch-safe because they
perform multiple awaited requests internally.

### Sequential Batches

After `batchExecute()` the recorder is automatically reset, so the same instance
can be reused for another batch:

```typescript
const batch = new AdtClientBatch(connection);

// First batch
batch.getClass().readMetadata({ className: 'CL_ABAP_TYPEDESCR' });
await batch.batchExecute();

// Second batch (recorder was auto-reset)
batch.getDomain().readMetadata({ domainName: 'MANDT' });
await batch.batchExecute();
```

### Reset Without Executing

```typescript
batch.getClass().readMetadata({ className: 'CL_ABAP_TYPEDESCR' });
batch.reset(); // clears recorded requests, promises are never resolved
```

### AdtRuntimeClientBatch

Same pattern for runtime operations:

```typescript
import { AdtRuntimeClientBatch } from '@mcp-abap-adt/adt-clients';

const runtimeBatch = new AdtRuntimeClientBatch(connection, logger);
// record runtime read operations...
await runtimeBatch.batchExecute();
```

## AdtRuntimeClient

```typescript
import { AdtRuntimeClient } from '@mcp-abap-adt/adt-clients';

const runtime = new AdtRuntimeClient(connection);
const feeds = await runtime.getFeeds();
```

### Runtime Dumps

```typescript
const allDumps = await runtime.listRuntimeDumps({ top: 50 });
const userDumps = await runtime.listRuntimeDumpsByUser('CB9980000423', {
  inlinecount: 'allpages',
  top: 50,
});
const dumpPayload = await runtime.getRuntimeDumpById('ABCDEF1234567890');
```

Contract notes:
- `listRuntimeDumps(options?)` and `listRuntimeDumpsByUser(user?, options?)` are read-only feed operations.
- `getRuntimeDumpById(dumpId)` requires plain dump ID (not full URI) and throws for empty/invalid IDs.
- Methods return raw ADT payload (`IAdtResponse`) so consumers can parse XML according to their needs.

### Runtime Memory Snapshots

Memory snapshots are currently not exposed via the public `AdtRuntimeClient` API.
They remain internal until endpoint/content-type behavior is validated across target systems.

### Runtime Profiling (ABAP Traces)

```typescript
const params = await runtime.getProfilerTraceParameters();
const created = await runtime.createProfilerTraceParameters({
  description: 'CI trace run',
  sqlTrace: true,
  maxTimeForTracing: 1800,
});
const profilerId = runtime.extractProfilerIdFromResponse(created);

const hitlist = await runtime.getProfilerTraceHitList(
  '/sap/bc/adt/runtime/traces/abaptraces/ABCDEF1234567890',
  { withSystemEvents: false },
);
```

Contract notes:
- Profiling API is split into:
  - trace configuration (`get/createProfilerTraceParameters`)
  - catalog/list endpoints (`listProfilerTraceFiles`, `listProfilerTraceRequests`, `listProfilerObjectTypes`, `listProfilerProcessTypes`)
  - trace analysis endpoints (`getProfilerTraceHitList`, `getProfilerTraceStatements`, `getProfilerTraceDbAccesses`)
- Trace-aware methods accept trace ID or full ADT trace URI.
- `extractProfilerIdFromResponse()` and `extractTraceIdFromTraceRequestsResponse()` are helper parsers for ADT header/body responses.

### ABAP Debugger Step Operations (Batch Only)

Step operations are executed through debugger batch endpoint:
- Endpoint: `POST /sap/bc/adt/debugger/batch`
- Request content type: `multipart/mixed; boundary=...`
- Response accept: `multipart/mixed`
- Default batch pattern: `step*` + `getStack` in one request

```typescript
const stepIntoResult = await runtime.stepIntoDebuggerBatch();
const stepOutResult = await runtime.stepOutDebuggerBatch();
const continueResult = await runtime.stepContinueDebuggerBatch();
```

You can also build payloads manually:

```typescript
const payload = runtime.buildDebuggerStepWithStackBatchPayload('stepInto');
const batchResult = await runtime.executeDebuggerStepBatch('stepInto');
```

`executeDebuggerAction(action)` must be used for non-step actions only.

## AdtRuntimeClientExperimental

```typescript
import { AdtRuntimeClientExperimental } from '@mcp-abap-adt/adt-clients';

const runtimeExperimental = new AdtRuntimeClientExperimental(connection);
const session = await runtimeExperimental.startAmdpDebugger();
```

`AdtRuntimeClientExperimental` contains APIs marked in progress and may change between releases.
