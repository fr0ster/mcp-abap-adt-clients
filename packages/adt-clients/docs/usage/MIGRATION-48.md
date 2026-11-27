# Migrating to 48.0.0

48.0.0 is fr0ster/mcp-abap-adt-clients#304: this package's source holds no
cast, no `any`, no value narrowed by hand, no regular expression and no type
predicate, so its types say what each member needs and answers. It pairs with
`@mcp-abap-adt/interfaces-adt` ^32.0.0, `@mcp-abap-adt/adt-strategies` 0.29.0
and `@mcp-abap-adt/adt-clients-legacy`. Every change below is breaking for a
consumer that uses what it names; the rest is in [the changelog](../../CHANGELOG.md).

- [A member requires what addresses the object](#a-member-requires-what-addresses-the-object)
- [A create names every field its request reads](#a-create-names-every-field-its-request-reads)
- [A write requires its lock handle, and its source](#a-write-requires-its-lock-handle-and-its-source)
- [A message class message is four members](#a-message-class-message-is-four-members)
- [`analyse` and the error type](#analyse-and-the-error-type)
- [The batch connection takes no type parameters](#the-batch-connection-takes-no-type-parameters)
- [`AdtClientsWS.request` is typed by a reader](#adtclientswsrequest-is-typed-by-a-reader)
- [abapGit: the old form is gone, the facts readers are complete](#abapgit-the-old-form-is-gone-the-facts-readers-are-complete)
- [Values from outside the type system](#values-from-outside-the-type-system)
- [Trace readings throw on a missing field](#trace-readings-throw-on-a-missing-field)

## A member requires what addresses the object

### What changed

Every member that addresses one object takes the identity of interfaces-adt
32: the object's own name is required, its parent's where it has one (a
function module and a function include name their group). Before, the config
was `Partial<I…Config>`, and a call without the name sent `undefined` in the
URL. A member that sends a config field names it too: `validate` of a function
module requires its description, of a program and an include their package;
the enhancement's `readMetadata` requires `enhancementType`, which names its
`Accept`.

### What fails

```typescript
await client.getClass().lock({}); // error: className is missing
await client.getFunctionModule().lock({ functionModuleName: 'Z_FM' }); // error: functionGroupName is missing
await client.getEnhancement().readMetadata({ enhancementName: 'ZE' }); // error: enhancementType is missing
```

### Remedy

Pass the name, the parent and the field the member names. A value held as
`string | undefined` is decided where the call is made; the library no longer
sends `undefined` for it.

## A create names every field its request reads

### What changed

The creates of a behaviour definition, a function group, a function module, an
interface, a metadata extension, a structure and a service binding require
`description`; the service binding's also `serviceName`,
`serviceDefinitionName`, `serviceVersion` and `bindingVariant`; the
enhancement's `enhancementType`. Each was read by the request builder, and an
absent one was a `TypeError` at run time.

### Remedy

Give the field, or decide its default at the call:

```typescript
await client.getInterface().create(
  { interfaceName: 'ZIF_DEMO', packageName: '$TMP', description: text ?? 'ZIF_DEMO' },
  { headers },
);
```

The config types of `@mcp-abap-adt/interfaces-adt` require the same fields from
its 33.0.0.

## A write requires its lock handle, and its source

### What changed

A member never locks for itself (one endpoint, one method). Every `update` and
`updateMetadata` takes `IAdtLockedWrite`: `lockHandle` is required, and
`source` where the member sends one. The writes that take no lock —
`getServiceBinding().update` (the publication) and
`getRequest().updateMetadata` (the transport's document) — refuse a
`lockHandle` by type. A function group's and a feature toggle's write send the
handle given in every case; before, an absent one was dropped from the URL.

### Remedy

```typescript
const cls = client.getClass();
const lock = await cls.lock({ className: 'ZCL_DEMO' });
if (!lock.ok) return lock;
const lockHandle = lock.getResult().value;
try {
  await cls.update({ className: 'ZCL_DEMO' }, { headers, lockHandle, source });
} finally {
  await cls.unlock({ className: 'ZCL_DEMO' }, lockHandle);
}
```

A call to the binding's publication or the transport's document drops its
`lockHandle`.

## A message class message is four members

### What changed

`getMessageClassMessage()` has `lockMessage`, `lockClassForMessage`, `update`
and `unlockMessages`, one request each, beside `read` and `readMetadata`. Its
`create` and `delete` are gone: `update` upserts a message (`msgtext`
required) or, with `removeMessage: true`, removes it. It PUTs the class
document the caller read, under the class's handle and the message's.

### Remedy

The chain the old members ran is the caller's. Lock and unlock on the
stateful session; the PUT is stateless:

```typescript
const messageClass = client.getMessageClass();
const message = client.getMessageClassMessage();
const address = { className: 'ZMC', msgno: '001' };

const read = await messageClass.readMetadata({ name: 'ZMC' }, { version: 'workingArea' });
if (!read.ok) return read;
const messageLock = await message.lockMessage(address);
// 403: the message cannot be locked on its own; the class's handle stands in.
if (!messageLock.ok && messageLock.getError().response?.status !== 403) return messageLock;
let classLock = await message.lockClassForMessage(address);
// 403: the class lock for one message is refused; the plain class lock instead.
if (!classLock.ok && classLock.getError().response?.status === 403)
  classLock = await messageClass.lock({ name: 'ZMC' });
if (!classLock.ok) {
  await message.unlockMessages(address);
  return classLock;
}
const classLockHandle = classLock.getResult().value;
const written = await message.update(
  { ...address, msgtext: 'Text', transportRequest },
  {
    headers,
    classDocument: String(read.getResult().value),
    classLockHandle,
    messageLockHandle: messageLock.ok ? messageLock.getResult().value : classLockHandle,
  },
);
await messageClass.unlock({ name: 'ZMC' }, classLockHandle);
await message.unlockMessages(address);
```

This sends the requests the old chain sent, in its order, the 403 fallbacks
included. A removal is the same with `{ ...address, removeMessage: true }`.

## `analyse` and the error type

### What changed

Every member generic in its failure is the overload pair interfaces-adt 32
declares:

- a generic overload whose options require `analyse`, answering
  `IAdtResponse<T, E | IAdtError>` (abapGit's new forms:
  `E | IAbapGitStructuredError`);
- a plain overload answering `IAdtResponse<T>`.

The library's own verdict stands where no answer came back and `analyse`
cleared it, so the generic answer is the union. A call that names `E` without
`analyse` no longer compiles.

### What fails

```typescript
await cls.read<IMyFailure>({ className: 'ZCL_DEMO' }); // error: analyse is required
const answer = await cls.read({ className: 'ZCL_DEMO' }, undefined, { analyse: mine });
if (!answer.ok) answer.getError().mine; // error: IAdtError has no `mine`
```

### Remedy

Narrow before reading your own field, and pass `analyse` when you name `E`:

```typescript
if (!answer.ok) {
  const failure = answer.getError(); // IMyFailure | IAdtError
  if ('mine' in failure) handle(failure.mine);
}
```

A union of two handlers' members has no call signature (two overload sets):
call each handler on its own branch. A rejection with `null` or `undefined`
from a connection is rethrown as it came, not as a `TypeError` of the
library's own.

## The batch connection takes no type parameters

`AdtBatchConnection.makeAdtRequest` is the contract's
`makeAdtRequest(options): Promise<IAdtWireResponse>`. Drop `<T, D>`, and read
`data` as `unknown`, as from any connection. A part's `params` is a string, a
`URLSearchParams` or a plain object of string, number or boolean values;
anything else throws `BATCH_REFUSES_PARAMS` before anything is queued.

## `AdtClientsWS.request` is typed by a reader

`request(operation, payload?, options?)` answers `unknown`.
`request(operation, payload, { read })` answers what `read(payload)` makes of
the answer's payload; a reader that throws rejects that request alone. Replace
`request<P, R>(…)` with a reader:

```typescript
const status = await ws.request('status', undefined, { read: readStatus });
```

## abapGit: the old form is gone, the facts readers are complete

The `link(IAbapGitLinkArgs, …)` and `checkExternalRepo(IAbapGitExternalRepoCredentials, …)`
forms are removed (interfaces-adt 32): use `IAbapGitLinkNewArgs` and
`IAbapGitExternalRepoArgs` with `credentials: IAbapGitCredentials | null`.

`AdtAbapGitClient`'s options type every facts slot: `results` holds a reader
for each of the 14 new-form slots (`FactsReaders<T>`). `AdtAbapGitClient.create`
fills them from `abapGitFactsDefaults`; a direct `new` passes all 14 and names
`T`:

```typescript
import { AdtAbapGitClient, abapGitDocuments, abapGitFactsDefaults } from '@mcp-abap-adt/adt-clients/abapgit';
import type { ResultValuesOf } from '@mcp-abap-adt/adt-clients';

const results = { ...abapGitFactsDefaults, ...abapGitDocuments };
const git = new AdtAbapGitClient<ResultValuesOf<typeof abapGitDocuments>>(connection, { results });
```

## Values from outside the type system

Where a thrown value fills a typed field, it is shape-checked: its `message`
is kept only when it is a string, its `response` only when it is an object
whose `status` is an integer, and its `request` as only its string `method`
and `url`. A value of another shape no longer reaches the failure as it was.

## Trace readings throw on a missing field

With adt-strategies 0.29.0 the profiler and scheduling readings throw
`traces: <field> is missing` for an answer without a field their type
requires, where the field read as `undefined` before. See adt-strategies'
README, "Migrating to 0.29.0".
