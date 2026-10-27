# Migrating to 37.0.0

37.0.0 moves to `@mcp-abap-adt/interfaces-adt` `^20.1.0`, which carries
`IAdtObjectProperties`, and has two breaking changes:

- [`getSystemInformation` answers an `IAdtResponse`](#getsysteminformation-answers-an-iadtresponse)
  that tells present, absent and failed apart;
- [`IUtilResults` has a required `objectProperties` slot](#iutilresults-has-a-required-objectproperties-slot),
  the result strategy of the new `getUtils().getObjectProperties`.

Code that does neither — does not call `getSystemInformation` and builds its
`getUtils()` result set by spreading `utilDocuments` — compiles and behaves as
on 36.x.

`@mcp-abap-adt/adt-strategies` 0.14.0, released beside it, changes one verdict:
[`analyseMessageClassMessage`](#analysemessageclassmessage-refuses-an-answer-that-is-no-class-document)
refuses an answer that is no message class document.

## `getSystemInformation` answers an `IAdtResponse`

### What changed

`getSystemInformation(connection)` answered the record, or `null` for a `404`,
a `405`, a `501` and for a `2xx` whose body it could not read; it threw every
other failure. A caller could not tell a system without the endpoint from a
logon page a proxy answered with `200`.

`getSystemInformation(connection, options?)` now answers
`IAdtResponse<{ present: true, info } | { present: false }, E>`:

| what came back | 36.x | 37.0.0 |
|---|---|---|
| a `2xx` with a JSON object | the record | `ok`, `{ present: true, info }` — each field read only when it is a string |
| a `404` | `null` | `ok`, `{ present: false }` |
| a `405` or a `501` | `null` | `ok: false`, with the response |
| a `2xx` whose body is no JSON object (HTML, empty, not JSON) | `null` | `ok: false` (`origin: 'connection'`), with the response |
| any other status (`401`, `500`, …), also one a connection hands back instead of throwing | thrown | `ok: false`, with the response and the request |
| no answer (a network failure) | thrown | `ok: false`, with the request |
| a credential refusal SAP was never asked about | thrown | thrown, as it came — as by every member |

Only a `404` is the endpoint absent: it is the status seen for this endpoint on
premise. `405` and `501` came from the probe helper shared with
`isModernAdtSystem`, which still reads them as absent; `getSystemInformation`
no longer does. Decision 16 in
[`DECISIONS.md`](https://github.com/fr0ster/mcp-abap-adt-clients/blob/main/packages/adt-clients/docs/architecture/DECISIONS.md#16-systeminformation-answers-three-ways-and-only-a-404-is-absent)
has the reasons.

### What a caller does

Before (36.x):

```typescript
import { getSystemInformation } from '@mcp-abap-adt/adt-clients';

const info = await getSystemInformation(connection); // throws on a 401, a 500, …
if (info === null) {
  // on premise without the endpoint — or a page a proxy answered with
} else {
  console.log(info.userName);
}
```

After (37.0.0):

```typescript
import { getSystemInformation } from '@mcp-abap-adt/adt-clients';

const answer = await getSystemInformation(connection);
if (!answer.ok) {
  // Another status, no answer, or a 2xx that is not the record.
  throw new Error(answer.getError().message);
}
const found = answer.getResult().value;
if (found.present) {
  console.log(found.info.userName);
} else {
  // a 404: the system has no such endpoint
}
```

A caller that wrapped the call in `try`/`catch` for a `401` or a `500` reads
`answer.ok` instead; the failure carries the response (`getError().response`).

### Reading a status otherwise: `options.analyse`

The verdict goes through `options.analyse`, as every member's does. It receives
the library's verdict — `ADT_NO_FAILURE` for a `404` and for a readable `2xx` —
and the response, and answers the verdict that stands:

- a failure it names is the answer (`ok: false`);
- a cleared other status is `{ present: false }`;
- a cleared malformed `2xx` is `{ present: true, info }` with every field
  `undefined`;
- a failure that carried no response cannot be cleared.

To keep 36.x's reading of a `405` and a `501` as the endpoint absent:

```typescript
import { getSystemInformation } from '@mcp-abap-adt/adt-clients';
import { ADT_NO_FAILURE, type IAnalyse } from '@mcp-abap-adt/interfaces-adt';

const absentAsBefore: IAnalyse = (verdict, response) =>
  response && [405, 501].includes(response.status) ? ADT_NO_FAILURE : verdict;

const answer = await getSystemInformation(connection, { analyse: absentAsBefore });
```

A system that must have the endpoint (ABAP Cloud) names a `404` a failure:

```typescript
import { getSystemInformation } from '@mcp-abap-adt/adt-clients';
import type { IAnalyse } from '@mcp-abap-adt/interfaces-adt';

const required: IAnalyse = (verdict, response) =>
  response?.status === 404
    ? { origin: 'refusal', message: 'systeminformation is missing', response }
    : verdict;

const answer = await getSystemInformation(connection, { analyse: required });
```

## `IUtilResults` has a required `objectProperties` slot

### What changed

`getUtils().getObjectProperties(objectUri, options?)` is new: one `GET` to
`/sap/bc/adt/repository/informationsystem/objectproperties/values?uri={objectUri}`,
answered through the new slot `objectProperties` of `IUtilResults`. The slot is
required, as every slot of a result set is, and `utilDocuments` has it (the
document as it came, `rawDocument`). `getUtils()`' contract carries the member
as `IAdtObjectProperties` (`@mcp-abap-adt/interfaces-adt` 20.1.0).
[`CLIENT_API_REFERENCE.md`](CLIENT_API_REFERENCE.md#adtutils-object-properties)
describes the member.

### What a caller does

A result set that spreads `utilDocuments` needs nothing:

```typescript
import { utilDocuments } from '@mcp-abap-adt/adt-clients';

const utils = client.getUtils({ ...utilDocuments /* , your own slots */ });
```

A result set written slot by slot no longer compiles until it names the new
slot — with the shipped reading or one of its own.

Before (36.x):

```typescript
import { rawDocument } from '@mcp-abap-adt/adt-clients';
import { readSearchHits } from '@mcp-abap-adt/adt-strategies';

const results = {
  search: readSearchHits,
  whereUsed: rawDocument,
  // … every other slot of IUtilResults
};
```

After (37.0.0):

```typescript
import { rawDocument } from '@mcp-abap-adt/adt-clients';
import { readSearchHits } from '@mcp-abap-adt/adt-strategies';

const results = {
  search: readSearchHits,
  whereUsed: rawDocument,
  // … every other slot of IUtilResults
  objectProperties: rawDocument,
};
```

On a legacy system (`AdtClientLegacy` of `@mcp-abap-adt/adt-clients-legacy`) the member answers a refusal
(`UNSUPPORTED_OPERATION`) without a request; the slot is required there too.

## `analyseMessageClassMessage` refuses an answer that is no class document

`@mcp-abap-adt/adt-strategies` 0.14.0. `analyseMessageClassMessage(msgno)` —
and `readMessageClassMessageAbsence(document, msgno)` under it — let through an
answer that was not a message class document (an empty body, a body that is not
XML, another document), so a read with it came back a success with no message
in it. Such an answer is now refused as `ADT_OBJECT_NOT_FOUND`, "Message
`<msgno>`: the answer is not a message class document": only a class document
holding the message shows the message exists.

A caller who reads such an answer otherwise passes an `analyse` of its own
instead of `analyseMessageClassMessage`.

## 37.4.0: the legacy classes are a separate package

`AdtClientLegacy`, `AdtExecutorLegacy` and `AdtRequestLegacy` are no longer
exported from `@mcp-abap-adt/adt-clients`, and `createAdtClient()` /
`createAdtExecutor()` no longer choose a legacy class: they detect nothing, send
no request, and return `AdtClient` / `AdtExecutor`.

A consumer of a SAP_BASIS 7.40 system:

```typescript
// before (37.3.x): the factory asked core/discovery and returned the legacy class
const client = await createAdtClient(connection, logger);

// now: install @mcp-abap-adt/adt-clients-legacy and declare the system
import { AdtClientLegacy, AdtExecutorLegacy } from '@mcp-abap-adt/adt-clients-legacy';
const client = new AdtClientLegacy(connection, logger);      // connection: RFC
const executor = new AdtExecutorLegacy(connection, logger);
```

A consumer of a modern system changes nothing; `createAdtClient()` sends one
request fewer, and a credential refusal now shows at the first real request
rather than at the factory. A read member that takes `accept` sends the caller's
when given (class and local-include `readMetadata`, the authorization field read,
the function include metadata read).
