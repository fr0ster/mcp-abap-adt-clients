# Migrating to 47.0.0

47.0.0 pairs with `@mcp-abap-adt/adt-strategies` 0.28.0 and
`@mcp-abap-adt/adt-clients-legacy` 0.11.2. Every change below is breaking for a
consumer that uses what it names; the readings' other fixes are in
[the changelog](../../CHANGELOG.md).

- [`INamedItem.description` is optional](#inameditemdescription-is-optional)
- [System messages: no read by id](#system-messages-no-read-by-id)
- [System messages: no severity or validity](#system-messages-no-severity-or-validity)
- [Gateway errors: the entry's fields](#gateway-errors-the-entrys-fields)

## `INamedItem.description` is optional

### What changed

`description` was `string`. It is `description?: string`, as adt-strategies'
`INamedItem` is: `utilNamedItems` leaves out a description the type catalogue
does not carry, where it answered `''`.

### What fails

A read that expects a string no longer compiles (`TS2322`, `TS18048`):

```typescript
const label: string = item.description; // error: string | undefined
```

So does forwarding the item where a required `description` is declared:

```typescript
interface ICatalogueRow { name: string; description: string }
const rows: ICatalogueRow[] = items; // error: description is optional in INamedItem
```

### Remedy

A reader takes the 46.x value as its fallback:

```typescript
const label: string = item.description ?? '';
```

A caller that forwards the whole object restores the required property where it
forwards it, and keeps every other field:

```typescript
const rows: ICatalogueRow[] = items.map((item) => ({
  ...item,
  description: item.description ?? '',
}));
```

## System messages: no read by id

### What changed

`SystemMessages.getById`, the low-level `getSystemMessage`, and the `message`
slot of `ISystemMessagesResults` / `systemMessagesDocuments` are gone. They
asked for `/sap/bc/adt/runtime/systemmessages/{id}`, which SAP does not route:
`CL_STSK_ADT_RES_APP->register_resources` registers the collection alone (the
same on premise and on the cloud).

### Remedy

Read the list and pick the message:

```typescript
const listed = await runtime
  .getSystemMessages({ ...systemMessagesDocuments, list: feedSystemMessages })
  .list();
const message = listed.ok
  ? listed.getResult().value.find((m) => m.messageId === id)
  : undefined;
```

A result set written for 46.x with a `message` slot drops it.

## System messages: no severity or validity

### What changed

adt-strategies' `ISystemMessageEntry` loses `severity`, `validFrom` and
`validTo`, which SAP never writes (they read `''`, `validFrom` the creation
time). An entry carries `id` (`uuid:<n>`), `messageId`, `title`, `text` (every
line), `createdOn` (system time, as SAP renders it), `updated` (UTC),
`createdBy` and `author` — each optional.

### Remedy

Read `createdOn` / `updated` where `validFrom` was read. SAP's feed carries no
severity and no expiry; the expiry only decides which messages are listed.

## Gateway errors: the entry's fields

### What changed

adt-strategies' `IGatewayErrorEntry` fields are optional. `transactionId` is the
summary's `Transaction ID` (it was the `atom:id`, now `id`); `shortText` loses
its `Frontend Error: ` prefix (now `kind`); `username` is the name alone (the
id in parentheses is `userId`). New: `opid` and `detailUri`. The error's
document is asked for as `text/html`, and `feedGatewayErrorDetail` refuses an
answer that names no error.

### Remedy

Read the detail at the entry's own address, not one built from the transaction
id:

```typescript
const detail = entry.detailUri
  ? await feeds.gatewayErrorDetail(entry.detailUri)
  : undefined;
```

Or, through `GatewayErrorLog.getById(type, opid)`, pass the entry's `opid` and
the kind its `detailUri` names.
