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

Additional factory methods follow the same `IAdtObject<Config, State>` pattern:

```typescript
// Authorization Field (SUSO / AUTH) — DDIC-style, XML-only.
// Available on modern on-prem (E19+) and cloud MDD; absent on legacy systems.
// Endpoint: /sap/bc/adt/aps/iam/auth/{name}
await client.getAuthorizationField().create({
  authorizationFieldName: 'ZAUTHF01',
  packageName: 'ZPACKAGE',
  description: 'Test authorization field',
  rollName: 'ZDTEL_AUTH',
  domname: 'ZDOM_AUTH',
});

// Function Include (FUGR/I) — source-bearing, scoped to a function group.
// Available on all systems (legacy, modern on-prem, cloud).
// Endpoint: /sap/bc/adt/functions/groups/{groupName}/includes/{includeName}
const fincl = client.getFunctionInclude();
await fincl.create({
  functionGroupName: 'ZFGROUP',
  includeName: 'LZFGROUPF01',
  description: 'Forms include',
  sourceCode: '* report source',
});

// Dedicated source reader
const source = await fincl.readSource({
  functionGroupName: 'ZFGROUP',
  includeName: 'LZFGROUPF01',
});

// Feature Toggle (FTG2/FT) — SAP feature-gate artifact with JSON source payload.
// Available on modern on-prem and cloud MDD; absent on legacy kernels (E77).
// Endpoint: /sap/bc/adt/sfw/featuretoggles/{name}
// Factory returns IFeatureToggleObject — extends IAdtObject<IFeatureToggleConfig,
// IFeatureToggleState> and adds five domain methods (switchOn, switchOff,
// getRuntimeState, checkState, readSource). The full surface is statically
// visible on the factory return — no casts required at call sites.
const toggle = client.getFeatureToggle();

// --- 1. Create a custom feature toggle ---
// CREATE typically requires SAP_DEVELOPER-equivalent authorization. On cloud
// trial systems FTG2/FT creation is usually SAP-reserved — expect HTTP 403.
// On modern on-prem (BASIS ≥ 7.50) with developer auth, this works.
await toggle.create({
  featureToggleName: 'ZMY_FEATURE',
  packageName: 'ZMY_PKG',
  description: 'My feature toggle',
  transportRequest: 'DEVK900123',
  source: {
    // Optional structured source body. If omitted, the toggle is created
    // empty and the JSON source can be updated later via update() with
    // config.source set, or by calling the low-level uploadFeatureToggleSource.
    rollout: {
      lifecycleStatus: 'inValidation',
      strategy: 'immediate',
      configurable: false,
      defaultEnabledFor: 'none',
      reversible: true,
    },
    toggledPackages: ['ZMY_PKG'],
  },
});

// --- 2. Switch the toggle ON (client-level) ---
// transportRequest is REQUIRED for client-level toggling (captures the change
// into a CTS request). For user-specific toggling, set userSpecific: true;
// depending on system configuration, transportRequest may still be needed.
await toggle.switchOn(
  { featureToggleName: 'ZMY_FEATURE' },
  { transportRequest: 'DEVK900123' },
);

// --- 3. Switch the toggle OFF ---
// rollout.reversible must be true for the toggle definition to accept OFF
// after it has been switched ON. Otherwise the server returns an error.
await toggle.switchOff(
  { featureToggleName: 'ZMY_FEATURE' },
  { transportRequest: 'DEVK900123' },
);

// --- 4. Pre-flight check before toggling ---
// checkState() returns current state plus transport binding info. Call this
// before switchOn/switchOff when you need to know whether a customising
// transport is allowed and which package / object URI the change would bind to.
const preflight = await toggle.checkState({ featureToggleName: 'ZMY_FEATURE' });
console.log(preflight.checkStateResult);
// { currentState: 'off', transportPackage: 'ZMY_PKG',
//   transportUri: '/sap/bc/adt/vit/wb/object_type/sf01/object_name/zmy_feature',
//   customizingTransportAllowed: true }

// --- 5. Read runtime state (all levels) ---
// Returns the client-level aggregate for the current session plus the full
// per-client and per-user breakdowns.
const runtime = await toggle.getRuntimeState({ featureToggleName: 'ZMY_FEATURE' });
console.log(runtime.runtimeState);
// {
//   name: 'ZMY_FEATURE',
//   clientState: 'on',
//   userState: 'undefined',
//   clientStates: [{ client: '100', description: '...', state: 'on' }, ...],
//   userStates:   [],
// }

// --- 6. Read the JSON source body (rollout / toggledPackages / attributes) ---
// Unlike ABAP source, feature-toggle source is structured JSON. readSource()
// parses it and returns IFeatureToggleSource via state.sourceResult.
const sourceState = await toggle.readSource(
  { featureToggleName: 'ZMY_FEATURE' },
  'active', // or 'inactive'
);
console.log(sourceState.sourceResult?.rollout?.defaultEnabledFor);
// 'none' | 'someCustomers' | 'allCustomers' | ...

// --- 7. Update the toggle (metadata + optional source) ---
// The update chain is the canonical IAdtObject flow: lock → check → update →
// (if source provided) uploadSource → unlock → check → activate. Pass
// config.source to change rollout, toggledPackages, or attributes.
await toggle.update(
  { featureToggleName: 'ZMY_FEATURE' },
  {
    sourceCode: undefined,          // not used (source is JSON)
    xmlContent: undefined,
    activateOnUpdate: true,
  },
);

// --- 8. Unsupported on feature toggles ---
// readTransport() returns a state with a single error entry rather than
// throwing — there is no /transport sub-resource for FTG2/FT. Feature-toggle
// changes bind to transports via the /toggle and /check endpoints instead.
```

### Feature Toggle — environment-specific behavior

| Environment | Create / delete | Update metadata + source | switchOn / switchOff | getRuntimeState / checkState / readSource |
|-------------|-----------------|--------------------------|---------------------|-------------------------------------------|
| Modern on-prem (BASIS ≥ 7.50) | ✅ with S_DEVELOP | ✅ with lock + transport | ✅ with transport | ✅ |
| Cloud MDD | ⚠️ usually SAP-reserved; HTTP 403 for customer creation | ⚠️ typically limited to SAP-provided toggles | ⚠️ depends on toggle's `configurable` flag | ✅ against SAP-provided toggles |
| Legacy (BASIS < 7.50, e.g. E77) | ❌ endpoint absent | ❌ | ❌ | ❌ |

### AbapGit (ADT-integrated)

`AdtAbapGitClient` is a **standalone top-level class**, not a factory on `AdtClient`. `AdtClient` is reserved for `IAdtObject<Config, State>` implementations — separate clients stand on their own and are instantiated directly, same pattern as `AdtClient`, `AdtRuntimeClient`, `AdtExecutor`, and `AdtClientsWS`.

```typescript
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtAbapGitClient } from '@mcp-abap-adt/adt-clients';
import type { IAdtAbapGitClient } from '@mcp-abap-adt/adt-clients';

const connection = createAbapConnection({ /* ... */ });
const abapGit: IAdtAbapGitClient = new AdtAbapGitClient(connection);

// Probe a remote repo before linking
const info = await abapGit.checkExternalRepo({
  url: 'https://github.com/SAP-samples/cloud-abap-rap.git',
});
console.log(info.accessMode);                        // 'PUBLIC' | 'PRIVATE' | ...
console.log(info.branches.map((b) => b.name));       // ['HEAD', 'refs/heads/main', ...]

// Link a package to a remote repo
await abapGit.link({
  package: 'ZMY_PKG',
  url: 'https://github.com/SAP-samples/cloud-abap-rap.git',
  branchName: 'refs/heads/main',
});

// Pull — awaits the async server-side job. AbortSignal stops only the
// client-side wait loop; the server may still be running.
try {
  const result = await abapGit.pull({
    package: 'ZMY_PKG',
    pollIntervalMs: 2000,
    maxPollDurationMs: 600_000,
    onProgress: (s) => console.log(`status: ${s.status} — ${s.statusText}`),
  });
  if (result.finalStatus.status === 'E' || result.finalStatus.status === 'A') {
    console.error('pull failed:', result.errorLog);
  }
} catch (err: any) {
  // AbortError / TimeoutError carry lastKnownStatus when a read succeeded
  // before the client gave up waiting. The server-side job may still be
  // running — poll getRepo(package) until status !== 'R' before retrying.
  if (err.name === 'AbortError' || err.name === 'TimeoutError') {
    console.warn('pull wait stopped:', err.lastKnownStatus);
  } else {
    throw err;
  }
}

// Read status without triggering a pull
const repo = await abapGit.getRepo('ZMY_PKG');

// List all linked repos on this system
const all = await abapGit.listRepos();

// Fetch the error log as a first-class operation (not only on failed pulls)
const log = await abapGit.getErrorLog('ZMY_PKG');

// Remove the binding. DELETE /sap/bc/adt/abapgit/repos/{repositoryId}
// under the hood — repositoryId is resolved automatically from the
// package name.
await abapGit.unlink({ package: 'ZMY_PKG' });
```

**Availability.** ADT-integrated abapGit ships with SAP BTP ABAP Environment (Steampunk) and modern on-prem from ABAP Platform 2022+. Legacy kernels (E77 and older) do not expose `/sap/bc/adt/abapgit/*`. This is **not** the community abapGit that installs via SE38 — that one is a separate ABAP program with its own UI and does not go through ADT.

**Async pull contract.** The server-side pull continues independently of the client-side wait. If you abort or hit `maxPollDurationMs`, the thrown `AbortError` / `TimeoutError` carries `lastKnownStatus` (when the last `listRepos` succeeded before the client gave up). The client **must** poll `getRepo(package)` until `status !== 'R'` before re-issuing `pull` or `unlink`. Retrying `pull` while the previous server-side job is still `R` is unsupported and fails fast.

**Content-type version.** Defaults to `v3` for sapcli compatibility. Cloud MDD advertises `v4`; consumers can opt in via `new AdtAbapGitClient(conn, logger, { contentTypeVersion: 'v4' })`.

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
