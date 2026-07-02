# Message Class (MSAG) CRUD — Design Spec

> Status: **design approved in brainstorm; pending spec review → plan.**
> Spans `@mcp-abap-adt/interfaces` (param types) + `@mcp-abap-adt/adt-clients`
> (two new `IAdtObject` implementations). Empirically verified on the cloud
> trial (probe, 2026-07-02).

## Goal

Add CRUD for ABAP **message classes** (`MSAG/N`, endpoint `/sap/bc/adt/messageclass`)
and their individual **messages** to the adt-clients object surface.

## Object model — two `IAdtObject` implementations

The message class and an individual message are **separate entities**, each its
own `IAdtObject`, both reached via `AdtClient` factory methods.

### `AdtMessageClass` (the class)

```ts
interface IMessageClassConfig {
  name: string;
  description?: string;
  packageName?: string;
  masterLanguage?: string;    // default 'EN'
  transportRequest?: string;  // for transportable packages
}
interface IMessageClassState {
  createResult?: unknown;
  readResult?: unknown;
  updateResult?: unknown;
  deleteResult?: unknown;
  /** Parsed class incl. its messages (read-only view). */
  messageClass?: {
    name: string;
    description?: string;
    packageName?: string;
    messages: IParsedMessage[];
  };
  errors: string[];
}
```

### `AdtMessageClassMessage` (an individual message)

```ts
interface IMessageClassMessageConfig {
  className: string;      // the parent message class
  msgno: string;          // e.g. '001'
  msgtext?: string;
  selfExplanatory?: boolean;
  description?: string;
}
interface IMessageClassMessageState {
  createResult?: unknown;
  readResult?: unknown;
  updateResult?: unknown;
  deleteResult?: unknown;
  message?: IParsedMessage;
  errors: string[];
}

interface IParsedMessage {
  msgno: string;
  msgtext: string;
  selfExplanatory?: boolean;
  description?: string;
}
```

Factory: `AdtClient.getMessageClass(): IAdtObject<IMessageClassConfig, IMessageClassState>`
and `AdtClient.getMessageClassMessage(): IAdtObject<IMessageClassMessageConfig, IMessageClassMessageState>`.

## Endpoint contract (probe-verified on trial)

All object identity is passed per call (stateless-factory pattern). Names are
lowercased in URLs. Message-content lives in the **class** XML; the message
sub-resource `GET /messages/{no}` returns an empty template and is NOT used.

### `AdtMessageClass`

| Method | Flow |
|---|---|
| `create(config)` | `POST /sap/bc/adt/messageclass` (`Content-Type: application/xml`) with the class-shell XML (`mc:messageClass` name/description/language/type=`MSAG/N`/masterLanguage + `adtcore:packageRef`) → **201** |
| `read(config)` | `GET /sap/bc/adt/messageclass/{name}` (`Accept: application/vnd.sap.adt.mc.messageclass+xml`) → parse into `state.messageClass` |
| `update(config)` | **read current class first** (to preserve its messages), then `POST …/{name}?_action=LOCK&accessMode=MODIFY` → `PUT …/{name}?lockHandle={classLock}` (`Content-Type: application/vnd.sap.adt.mc.messageclass+xml`) with updated attrs + the **existing** messages carried over → `POST …/{name}?_action=UNLOCK&lockHandle={classLock}` |
| `delete(config)` | `POST …/{name}?_action=LOCK&accessMode=MODIFY` → `DELETE …/{name}?lockHandle={classLock}` |
| `lock(config)` | `POST …/{name}?_action=LOCK&accessMode=MODIFY` → returns `LOCK_HANDLE` |
| `unlock(config, handle)` | `POST …/{name}?_action=UNLOCK&lockHandle={handle}` |
| `activate` / `check` / `validate` / `getVersions` / `getVersionSource` | **throw** `AdtOperationError(UNSUPPORTED_OPERATION)` |

`AdtMessageClass.update` **must not drop existing messages** — it owns only the
class-level attributes; messages are `AdtMessageClassMessage`'s domain, so update
reads the class and re-sends its current message set unchanged.

### `AdtMessageClassMessage` (read-modify-write on the parent class)

| Method | Flow |
|---|---|
| `read(config)` | read the parent class (`GET /messageclass/{className}`), extract the `mc:messages` entry with `msgno` → `state.message` (throws `OBJECT_NOT_FOUND` if absent) |
| `create(config)` / `update(config)` | read the parent class → set/merge this message into the message set → `POST …/messages/{no}?_action=LOCK_MSG&accessMode=MODIFY` (→ `msgLock`) → `POST …/{className}?_action=LOCK&accessMode=MODIFY&msgNo={no}&onSave=X` (→ `classLock`) → `PUT …/{className}?lockHandle={classLock}` with the FULL class XML incl. `<mc:messages mc:lockhandle="{msgLock}" mc:msgno="{no}" mc:msgtext="…"/>` → `POST …?_action=UNLOCK&lockHandle={classLock}` → `POST …/messages/{no}?_action=UNLOCK_ALL` (body `[{no}]`) |
| `delete(config)` | read the parent class → remove the message from the set → `POST …/{className}?_action=LOCK&accessMode=MODIFY` → `PUT …/{className}?lockHandle={classLock}` with the class XML **without** that message → `POST …?_action=UNLOCK&lockHandle={classLock}`. (A message-level `DELETE /messages/{no}` returns **423** — not used.) |
| `activate` / `check` / `validate` / `lock` / `unlock` / `getVersions` / `getVersionSource` | **throw** `AdtOperationError(UNSUPPORTED_OPERATION)` |

Lock responses carry `<LOCK_HANDLE>…</LOCK_HANDLE>` (asx:abap envelope);
`IS_LOCAL=X` for local-package objects.

## Shared XML helper

`src/core/messageClass/xml.ts` (pure, used by both classes):

- `parseMessageClass(xml: string): { name; description?; packageName?; messages: IParsedMessage[] }`
- `buildMessageClassXml(input: { name; description?; packageName?; masterLanguage?; messages: Array<IParsedMessage & { lockHandle?: string }> }): string`
  — emits `mc:messageClass` with nested `mc:messages`, including `mc:lockhandle`
  per message when a lock handle is supplied (for the message write flow).

## Error handling

- Non-applicable operations throw `AdtOperationError` with
  `code = AdtObjectErrorCodes.UNSUPPORTED_OPERATION` (per brainstorm decision).
- On any failure inside a lock-bearing chain, the implementation unlocks
  (`UNLOCK` / `UNLOCK_ALL`) and resets the session to `stateless`, following the
  existing per-object chain convention.
- HTTP failures surface as interface-level errors; no raw `IAdtResponse`/axios
  leaks outward.

## Module structure

`src/core/messageClass/`:
`AdtMessageClass.ts`, `AdtMessageClassMessage.ts`, `create.ts`, `read.ts`,
`update.ts`, `delete.ts`, `lock.ts` (class LOCK + message LOCK_MSG), `unlock.ts`
(class UNLOCK + UNLOCK_ALL), `xml.ts`, `types.ts`, `index.ts`. No `activation.ts`.

Wiring: `AdtClient.getMessageClass()` / `getMessageClassMessage()`; export the
config/state types via `src/index.core.ts` (and thus the root barrel). Param
types (`ICreate/Read/Update/DeleteMessageClassParams`, message equivalents) go
in `@mcp-abap-adt/interfaces` at `src/adt/IAdtMessageClass.ts`.

## Cross-package sequencing

1. **interfaces (minor):** add the param types in `IAdtMessageClass.ts` + export.
   Merge → publish → the consumer/adt-clients bump to the published version.
2. **adt-clients (minor):** implement both objects + shared XML + wiring + tests
   against the published interfaces.

(Config/State public types follow the existing convention — defined in
adt-clients `core/messageClass/types.ts`, like every other object type.)

## Testing

- **Unit (SAP-free):** `parseMessageClass` / `buildMessageClassXml` against the
  real class XML captured in the probe (class with two messages, incl.
  `mc:lockhandle`); round-trip (parse → build → parse); each object's
  non-applicable ops throw `UNSUPPORTED_OPERATION` (fake connection);
  error-translation on a 4xx.
- **Integration (trial, browser profile required):** full lifecycle mirroring
  the probe — create class, read, add a message, read the message (via class),
  update it, delete it, delete the class — self-skips without `.env`.

## Out of scope

- where-used `buildObjectUri` / `getObjectSourceUri` entries for `MSAG/N`.
- Message long texts / documentation (`…/vit/docu/…` links seen in the feed).
- The empty `GET /messages/{no}` sub-resource (not a content source).
