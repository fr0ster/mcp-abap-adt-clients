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
perform multiple awaited requests internally. However, their individual steps can be
orchestrated across sequential batches — see [Multi-Batch Orchestration](#multi-batch-orchestration).

> **Note:** The batch endpoint `/sap/bc/adt/debugger/batch` is an undocumented generic ADT
> router. While it accepts any ADT request (GET, POST, PUT), its behavior may change in
> future SAP releases. Integration tests cover batch operations to detect regressions early.

### Multi-Batch Orchestration

Instead of processing N objects sequentially (each requiring multiple HTTP round-trips),
a consumer can split the workflow into sequential batches of independent operations:

```typescript
const batch = new AdtClientBatch(connection, logger);

// Batch 1: validate all names
const validations = objects.map(obj =>
  batch.getClass().validate({ className: obj.name, packageName: obj.pkg })
);
await batch.batchExecute();

// Filter: collect valid names, report errors
const valid = [];
for (let i = 0; i < objects.length; i++) {
  try {
    await validations[i];
    valid.push(objects[i]);
  } catch {
    errors.push(objects[i]);
  }
}

// Batch 2: create all valid objects (single POST per object)
const creates = valid.map(obj =>
  batch.getClass().create({ className: obj.name, packageName: obj.pkg, ... })
);
await batch.batchExecute();

// Batch 3: lock all created objects
const locks = valid.map(obj =>
  batch.getClass().lock({ className: obj.name })
);
await batch.batchExecute();

// Collect lock handles from results
const lockHandles = await Promise.all(locks);

// Batch 4: update all (low-level mode — single PUT per object)
const updates = valid.map((obj, i) =>
  batch.getClass().update(
    { className: obj.name, sourceCode: obj.source },
    { lockHandle: lockHandles[i] },
  )
);
await batch.batchExecute();

// Batch 5: unlock all
const unlocks = valid.map((obj, i) =>
  batch.getClass().unlock({ className: obj.name }, lockHandles[i])
);
await batch.batchExecute();

// Batch 6: activate all
const activations = valid.map(obj =>
  batch.getClass().activate({ className: obj.name })
);
await batch.batchExecute();
```

This replaces N sequential workflows with 6 batch requests total,
regardless of how many objects are processed.

**Key:** `update()` with `options.lockHandle` runs in low-level mode (single PUT request),
making it batch-safe. Without `lockHandle`, `update()` runs the full chain
(lock → check → update → unlock → activate) which is not batch-compatible.

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

`AdtRuntimeClient` exposes all runtime operations through domain object factories. Each factory returns a stateless domain object that wraps a set of related ADT endpoints.

```typescript
import { AdtRuntimeClient } from '@mcp-abap-adt/adt-clients';

const runtime = new AdtRuntimeClient(connection, logger);
```

### Profiler Traces

```typescript
const profiler = runtime.getProfiler();

// List / configure
const files = await profiler.list();
const params = await profiler.getParameters();
const created = await profiler.createParameters({
  description: 'CI trace run',
  sqlTrace: true,
  maxTimeForTracing: 1800,
});
const traceId = profiler.extractIdFromResponse(created);

// Catalog
const requests = await profiler.listRequests();
const byUri = await profiler.getRequestsByUri('/sap/bc/adt/oo/classes/zcl_test');
const objectTypes = await profiler.listObjectTypes();
const processTypes = await profiler.listProcessTypes();

// Analysis
const hitList = await profiler.getHitList(traceId, { withSystemEvents: false });
const statements = await profiler.getStatements(traceId);
const dbAccesses = await profiler.getDbAccesses(traceId);
```

Contract notes:
- `extractIdFromResponse()` parses the ADT response to extract the trace ID.
- Trace-aware methods accept a plain trace ID or a full ADT trace URI.

### Cross-Trace Analysis

```typescript
const crossTrace = runtime.getCrossTrace();

const list = await crossTrace.list();
const trace = await crossTrace.getById(traceId);
const records = await crossTrace.getRecords(traceId);
const content = await crossTrace.getRecordContent(traceId, recordNumber);
const activations = await crossTrace.getActivations();
```

### ST05 Performance Traces

```typescript
const st05 = runtime.getSt05Trace();

const state = await st05.getState();
const directory = await st05.getDirectory();
```

### Debugger (Composite)

`getDebugger()` returns a composite object exposing three sub-domains: ABAP debugger, AMDP debugger, and memory snapshots.

```typescript
const debugger = runtime.getDebugger();

// ABAP debugger
const abap = debugger.getAbap();
await abap.launch({ debuggingMode: 'external' });
await abap.stop();
const state = await abap.get();
const callStack = await abap.getCallStack();
await abap.executeAction('stepOver');

// Step operations (batch endpoint — stepInto + getStack in one request)
const stepIntoResult = await abap.stepIntoBatch();
const stepOutResult = await abap.stepOutBatch();
const continueResult = await abap.stepContinueBatch();

// AMDP debugger
await debugger.getAmdp().start();

// Memory snapshots
const snapshots = await debugger.getMemorySnapshots().list();
```

Contract notes:
- Step batch operations use `POST /sap/bc/adt/debugger/batch` with `multipart/mixed` payload.
- `executeAction()` must be used for non-step actions; step actions are reserved for batch-only execution.

### Application Log

```typescript
const appLog = runtime.getApplicationLog();

const logObject = await appLog.getObject('Z_MY_LOG');
const logSource = await appLog.getSource('Z_MY_LOG');
```

### ATC Log

```typescript
const atcLog = runtime.getAtcLog();

const checkFailures = await atcLog.getCheckFailureLogs();
const execLog = await atcLog.getExecutionLog(id);
```

### DDIC Activation Graph

```typescript
const graph = await runtime.getDdicActivation().getGraph();
```

### Runtime Dumps

```typescript
const dumps = runtime.getDumps();

// List with optional time-range filter (YYYYMMDDHHMMSS)
const allDumps = await dumps.list({ top: 50 });
const recentDumps = await dumps.list({
  from: '20260401000000',
  to: '20260402235959',
  top: 50,
});

// Filter by user
const userDumps = await dumps.listByUser('CB9980000423', {
  inlinecount: 'allpages',
  top: 50,
  from: '20260401000000',
  to: '20260402235959',
});

// Read dump by ID
const dumpPayload = await dumps.getById('ABCDEF1234567890');
```

Contract notes:
- `getById()` requires a plain dump ID (not full URI) and throws for empty/invalid IDs.
- Methods return raw ADT payload (`IAdtResponse`) so consumers can parse XML according to their needs.

### Runtime Memory Snapshots

Memory snapshots are accessed via the composite debugger: `runtime.getDebugger().getMemorySnapshots().list()`.

### Feed Repository

```typescript
const feeds = runtime.getFeeds();

const catalog = await feeds.list();         // feed catalog
const variants = await feeds.variants();    // feed variants
const dumps = await feeds.dumps();          // dumps via Atom feed
const sysMessages = await feeds.systemMessages(); // system messages via feed
const gwErrors = await feeds.gatewayErrors();     // gateway errors via feed
```

### System Messages

```typescript
const sysMsgs = runtime.getSystemMessages();

const list = await sysMsgs.list();
const msg = await sysMsgs.getById(id);
```

### Gateway Error Log

```typescript
const gwLog = runtime.getGatewayErrorLog();

const list = await gwLog.list();
const entry = await gwLog.getById(type, id);
```

## AdtRuntimeClientExperimental

```typescript
import { AdtRuntimeClientExperimental } from '@mcp-abap-adt/adt-clients';

const runtimeExperimental = new AdtRuntimeClientExperimental(connection);
await runtimeExperimental.startAmdpDataPreview();
```

`AdtRuntimeClientExperimental` contains APIs marked in progress and may change between releases. AMDP debugger functionality has been promoted to `AdtRuntimeClient.getDebugger().getAmdp()`.
