# Recording batch transport

`AdtBatchConnection` implements `IAbapConnection`. Each member still issues one
request; the wrapper records it and settles its promise after `execute()`.
Do not await recorded calls before executing: their answers do not exist yet.
The constructor requires `endpoint: 'communication' | 'debugger'` and accepts
`logger?: ILogger`. It delegates connection initialization, base URL and session
identity to the wrapped connection. Session switches while recording are local.

```typescript
import { AdtBatchConnection, AdtClient, utilDocuments } from '@mcp-abap-adt/adt-clients';
import { analyseActivation, utilActivationRunId } from '@mcp-abap-adt/adt-strategies';

const batch = new AdtBatchConnection(connection, { endpoint: 'communication' });
const domains = new AdtClient(batch).getDomain();
// configs: { domainName, packageName, transportRequest, description }[]
const first = configs.map(config => ({
  created: domains.create(config),
  locked: domains.lock(config),
}));
await batch.execute();
const handles = await Promise.all(first.map(async ({ created, locked }) => {
  const creation = await created;
  if (!creation.ok) throw new Error(creation.getError().message);
  const lock = await locked;
  if (!lock.ok) throw new Error(lock.getError().message);
  return lock.getResult().value;
}));
const second = configs.flatMap((config, i) => [
  domains.updateMetadata(config, {
    source: documents[i], // Full domain XML, including datatype CHAR and length 000001.
    lockHandle: handles[i],
  }),
  domains.unlock(config, handles[i]),
]);
await batch.execute();
for (const answer of await Promise.all(second)) {
  if (!answer.ok) throw new Error(answer.getError().message);
}
const utils = new AdtClient(connection).getUtils({
  ...utilDocuments,
  activation: utilActivationRunId, // Reads the run id from Location.
});
const started = await utils.activateObjectsGroup(
  configs.map(config => ({ type: 'DOMA', name: config.domainName })),
  false,
  { analyse: analyseActivation },
);
if (!started.ok) throw new Error(started.getError().message);
const runId = started.getResult().value;
if (!runId) throw new Error('Activation did not return a run id');
const deadline = Date.now() + 300_000;
// Polling and waiting belong to the consumer.
for (;;) {
  const run = await utils.getActivationRun(runId);
  if (!run.ok) throw new Error(run.getError().message);
  const body = String(run.getResult().value);
  const status = /\b(?:\w+:)?status\s*=\s*["']([^"']*)["']/.exec(body)?.[1];
  if (Date.now() >= deadline) throw new Error(`Activation ${runId} timed out`);
  if (status === 'finished') break;
  if (status === 'error' || status === 'failed') throw new Error(body);
  await new Promise(resolve => setTimeout(resolve, 1000));
}
const activation = await utils.getActivationResults(runId, { analyse: analyseActivation });
if (!activation.ok) throw new Error(activation.getError().message);
const results = String(activation.getResult().value);
if (!/activationExecuted\s*=\s*["']true["']/.test(results) || /type\s*=\s*["']E["']/.test(results)) {
  throw new Error(`Activation refused: ${results}`);
}
```

A lock handle comes from the first envelope; placeholders cannot refer to another
part's answer. A wrong UNLOCK handle can answer 200 while leaving the lock held.
Use the real handles and inspect activation messages, including `type="E"`.
The transport provides no transaction or rollback; callers own recovery and
cleanup after partial failures.

At an attached debugger stop, use the attached connection and its stateful session:

```typescript
import { AbapDebugger, AdtBatchConnection } from '@mcp-abap-adt/adt-clients';

const batch = new AdtBatchConnection(debugConnection, { endpoint: 'debugger' });
const debuggerApi = new AbapDebugger(batch);
const pending = [
  // Explicit mode switches scope the next recording only.
  (batch.setSessionType('stateful'), debuggerApi.step('stepOver')),
  (batch.setSessionType('stateful'), debuggerApi.getStack()),
  (batch.setSessionType('stateful'), debuggerApi.getVariables(variableIds)), // IDs obtained at the stop.
];
await batch.execute();
const answers = await Promise.all(pending);
for (const answer of answers) {
  if (!answer.ok) throw new Error(answer.getError().message);
}
```

`execute()` returns the outer wire response. Empty execution returns a synthetic
`{ status: 204, statusText: 'Empty batch', headers: {}, data: '' }` without sending.
Recorded request promises receive inner responses, in order: 2xx resolves; other
statuses reject with an Error carrying `response: { status, statusText, headers,
data }`, matching direct HTTP failure handling. Members keep their usual
`IAdtResponse` and strategy behavior. Envelope/parse failures reject all outstanding
parts and `execute()`; missing parts reject with a part-count error. A count
mismatch also rejects `execute()`. Attach rejection handlers before execution when
using raw connection promises. Each execute sends follow-up envelopes for requests recorded during settlement,
including the automatic 406/415 corrected retry. It yields one event-loop turn
after settling each envelope to let member continuations record requests. It
returns the last outer response once that queue is empty. A limit of 100 envelopes
rejects execution and all remaining requests rather than looping forever.
Envelope failures also reject queued follow-ups. Concurrent executes are rejected;
calls made after execution resolves belong to the next execute.

Any stateful part makes its envelope stateful, and carries the measured inner
`X-sap-adt-sessiontype: stateful` header. The wrapped session mode is restored
afterward. Connections exposing `getSessionMode()` or `getSessionType()` supply
the previous mode; minimum-contract connections without a getter are assumed
stateless. An explicit local `setSessionType` applies only to the next recorded
request, then recording returns to the wrapped connection's initial mode. Thus LOCK and
UNLOCK carry stateful headers without leaking their mode to adjacent reads or
creates while waiting for their answers. A stateless switch takes effect
immediately for subsequent recording. For an already stateful debugger connection,
the wrapped mode remains the default for every recording.

Measurements on 2026-10-15 on an on-premise system and ABAP Cloud accepted mixed GET + POST on
`/sap/bc/adt/communication/batch`, including a 404 part beside successful parts.
The mixed-method 500 behind the 2026-09 removal was on `/debugger/batch`.
Debugger step + stack + variables worked at a live stop on both systems; keep
its member-specific variable Accept headers. RFC, payload limits and per-part
authorization remain unmeasured.

Integration configuration uses `batch.test_cases`: `domains` (params `count`,
default 100; `name_prefix`, default `ZAC_BD_`; optional `package_name` and
`transport_request`, otherwise environment defaults) and `debugger_client`.
Both are disabled by default and support onprem/cloud. The debugger case uses
the existing `runtime_debugger.adt_abap_debugger` params and debugger_batch fixture.
The domain test writes timings to a temporary JSON file and logs its path via ILogger.
