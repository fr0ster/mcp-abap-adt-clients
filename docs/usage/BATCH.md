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
const created = configs.map(config => domains.create(config));
const locked = configs.map(config => domains.lock(config));
await batch.execute();
const handles = await Promise.all(created.map(async (pending, i) => {
  const creation = await pending;
  if (!creation.ok) throw new Error(creation.getError().message);
  const lock = await locked[i];
  if (!lock.ok) throw new Error(lock.getError().message);
  return lock.getResult().value;
}));
const writes = configs.map((config, i) =>
  domains.updateMetadata(config, {
    source: documents[i], // Full domain XML, including datatype CHAR and length 000001.
    lockHandle: handles[i],
  }),
);
const unlocked = configs.map((config, i) => domains.unlock(config, handles[i]));
await batch.execute();
for (const answer of await Promise.all([...writes, ...unlocked])) {
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

A lock handle comes from the lock envelope; placeholders cannot refer to another
part's answer. A wrong UNLOCK handle can answer 200 while leaving the lock held.
Use the real handles and inspect activation messages, including `type="E"`.
The transport provides no transaction or rollback; callers own recovery and
cleanup after partial failures.

Accept negotiation never corrects or resends an envelope or its parts: on a
connection an `AdtClient` wrapped with correction on, a `406` or `415` answered
to the envelope reaches `execute()` and every part of that envelope as it came.
A part's own `401`, `406` or `415` is that part's answer like any other status;
nothing reads it, corrects it or sends it again. A batch is yours, and so is
what SAP answered to each of its parts. The envelope request itself still goes
through the connection's own handling — credential renewal, CSRF recovery and
session — as every request does: that is about the connection to the endpoint,
not about what the parts answered.

At an attached debugger stop, use the attached connection and its stateful session:

```typescript
import { AbapDebugger, AdtBatchConnection } from '@mcp-abap-adt/adt-clients';

const batch = new AdtBatchConnection(debugConnection, { endpoint: 'debugger' });
const debuggerApi = new AbapDebugger(batch);
const pending = [
  // Debugger recordings default to the attached stateful session.
  debuggerApi.step('stepOver'),
  debuggerApi.getStack(),
  debuggerApi.getVariables(variableIds), // IDs obtained at the stop.
];
await batch.execute();
const answers = await Promise.all(pending);
for (const answer of answers) {
  if (!answer.ok) throw new Error(answer.getError().message);
}
```

`execute()` returns the last outer wire response. Empty execution returns a synthetic
`{ status: 204, statusText: 'Empty batch', headers: {}, data: '' }` without sending.
Recorded request promises receive inner responses, in order: 2xx resolves; other
statuses reject with an Error carrying `response: { status, statusText, headers,
data }`, matching direct HTTP failure handling. Members keep their usual
`IAdtResponse` and strategy behavior. Envelope/parse failures stop execution immediately and reject `execute()` and
parts in the failed envelope. Unsent runs and queued follow-ups reject with a
library error saying the request was not sent because an earlier envelope failed;
that error carries the cause, without a SAP response. Missing parts reject with a part-count error. A count
mismatch also rejects `execute()`. Attach rejection handlers before execution when
using raw connection promises. Each execute sends follow-up envelopes for requests recorded during settlement,
including the automatic 406/415 corrected retry. It yields one event-loop turn
after settling each envelope to let member continuations record requests. It
returns the last outer response once that queue is empty. A limit of 100 envelopes
rejects execution and all remaining requests rather than looping forever.
Envelope failures also reject queued follow-ups. Concurrent executes are rejected;
calls made after execution resolves belong to the next execute.

On communication/batch, `execute()` partitions the queue into consecutive runs
of LOCKs, UNLOCKs, or stateless requests and sends them in order, without
reordering requests. Stateful actions are parsed from the URL query or request
`params`. Other stateful requests use a separate `stateful` group; no ordinary
member currently records one besides LOCK/UNLOCK. Debugger requests retain their
single stateful group.
For ordinary client members, LOCK and UNLOCK run stateful; creates, writes, reads,
and deletes run stateless. Group creates before locks, and writes before unlocks,
to avoid one envelope per alternating request. One execute can send several
envelopes and provides no transaction across them. Inner HTTP failures remain
per-part failures and do not stop later runs, allowing negotiation retries.

Stateful parts carry `X-sap-adt-sessiontype: stateful`. The wrapped session mode
is restored afterward. Connections exposing `getSessionMode()` or
`getSessionType()` supply the previous mode; minimum-contract connections without
a getter are assumed stateless. An explicit local `setSessionType` applies only
to the next recorded request. Recording then returns to the endpoint default:
communication is always stateless, independent of the wrapped connection's mode;
debugger is always stateful because it uses an attached debugging session.

Measurements on 2026-10-15 on an on-premise system and ABAP Cloud accepted mixed GET + POST on
`/sap/bc/adt/communication/batch`, including a 404 part beside successful parts.
The mixed-method 500 behind the 2026-09 removal was on `/debugger/batch`.
Debugger step + stack + variables worked at a live stop on both systems; keep
its member-specific variable Accept headers. RFC, payload limits and per-part
authorization remain unmeasured.

Several steps fit one debugger envelope: five `stepOver` + `getVariables` pairs
after an initial read (11 parts) answered every part 200, and the variable
history matched the one read step by step. Measured on 2026-10-16:

| Way | Requests | On premise | ABAP Cloud |
|---|---|---|---|
| One envelope, one `execute()` | 1 | ~130–180 ms | ~570–610 ms |
| One `execute()` per step | 6 | ~520 ms | ~2.7–3.6 s |
| Plain `AbapDebugger`, no batch | 11 | ~1.1 s | ~6.4–6.8 s |

Domains on the on-premise system: 100 created, locked, written and unlocked
through the batch connection, then group-activated, in 19.3 s against 111.9 s
for the same 500 requests one at a time.

Integration configuration uses `batch.test_cases`: `domains` (params `count`,
default 100; `name_prefix`, default `ZAC_BD_`; optional `package_name` and
`transport_request`, otherwise environment defaults) and `debugger_client`.
Both are disabled by default and support onprem/cloud. The debugger case uses
the existing `runtime_debugger.adt_abap_debugger` params and debugger_batch fixture.
The domain test writes timings to a temporary JSON file and logs its path via ILogger.
