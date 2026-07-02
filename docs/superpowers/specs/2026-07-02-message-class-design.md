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
  transportRequest?: string; // message mutations are class PUTs → need corrNr for transportable packages
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
  /** Every attribute parsed off the `<mc:messages>` element (e.g. mc:documented,
   *  adtcore:name, and any other mc:*/adtcore:* SAP emits). Preserved so that an
   *  untouched message round-trips verbatim when the full class XML is rebuilt to
   *  change a DIFFERENT message or the class description. */
  rawAttrs?: Record<string, string>;
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
| `validate(config)` | `GET /sap/bc/adt/messageclass/validation?objname={name}&description={description}` — name/description validation (endpoint present in ADT discovery; probe-verify the exact response/Accept during implementation) |
| `activate` / `check` / `getVersions` / `getVersionSource` | **throw** `AdtOperationError(UNSUPPORTED_OPERATION)` |

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

## Shared XML helper (round-trip preserving)

`src/core/messageClass/xml.ts` (pure, used by both classes). Because `update` and
every message operation rebuild and PUT the **full** class XML, the helper MUST
preserve all class-level attributes across a read → modify → write cycle — never
reconstruct from a minimal set (otherwise a non-EN class or other metadata is
silently reset).

```ts
interface IParsedMessageClass {
  name: string;
  description?: string;
  language?: string;        // adtcore:language
  masterLanguage?: string;  // adtcore:masterLanguage
  masterSystem?: string;    // adtcore:masterSystem
  responsible?: string;     // adtcore:responsible
  packageName?: string;
  messages: IParsedMessage[];
  /** Every attribute parsed off the root `<mc:messageClass>` element (incl. any
   *  adtcore:*/mc:* SAP emits beyond the named fields above). Preserved so the
   *  full-class PUT round-trips class-level metadata verbatim. */
  rawAttrs?: Record<string, string>;
}

// parse every class-level attr + the message set
parseMessageClass(xml: string): IParsedMessageClass

// rebuild from a full parsed class, carrying every attr through verbatim;
// per-message `mc:lockhandle` is emitted when supplied (message write flow)
buildMessageClassXml(
  cls: IParsedMessageClass,
  opts?: { messageLockHandles?: Record<string /*msgno*/, string> },
): string
```

**Read-modify-write rule:** `update`/message flows call `parseMessageClass` on the
current class, apply ONLY the explicitly-changed fields (a description, one
message), and pass the whole preserved `IParsedMessageClass` to
`buildMessageClassXml`. The root `<mc:messageClass>` is emitted from its
`rawAttrs` verbatim, overridden only by explicitly-changed named fields — so any
class-level attribute (named or not: language, masterLanguage, masterSystem,
responsible, future SAP attrs) round-trips unchanged.

**Message-level preservation:** `buildMessageClassXml` emits each `<mc:messages>`
entry as follows:
- **Untouched** message → re-emit its `rawAttrs` verbatim (no `mc:lockhandle`).
- **Updated existing** message → start from its `rawAttrs`, override only the
  explicitly-changed fields (`mc:msgtext`, `mc:selfexplainatory`, description),
  and add/replace `mc:lockhandle` from `opts.messageLockHandles`. Its other
  attributes (`mc:documented`, `adtcore:name`, future SAP attrs) are carried
  through, not dropped.
- **New** message (create) → build attributes from scratch (`mc:msgno`,
  `mc:msgtext`, `mc:selfexplainatory`, description) + `mc:lockhandle`.
- **Deleted** message → omit the entry.

This guarantees a message operation on one entry never mutates any other entry's
attributes, and updating one field of a message never drops its other attributes. During implementation, probe-verify the exact meaningful message
attribute set and that an untouched message may be re-sent without a lock handle
(the class `PUT` only locks the class + the one message being changed).

## Transport handling (corrNr)

Every mutating flow (class create/update/delete; message create/update/delete —
which are class PUTs) must pass the transport as `corrNr={transportRequest}` when
the target package is transportable; for local packages (`IS_LOCAL=X`, as in the
probe) no transport is sent. `IMessageClassMessageConfig` therefore also carries
`transportRequest?`. The probe verified the **local** flow (no corrNr); the exact
`corrNr` placement (create `POST …?corrNr=`, the class `LOCK`, and/or the `PUT`)
for a **transportable** package is not yet in the ADT discovery templates and
MUST be probe-verified against a transportable package during implementation.

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
  real class XML captured in the probe (class with two messages carrying extra
  `mc:*`/`adtcore:*` attributes). **Round-trip preservation test:** parse a
  two-message class, change ONE message's `mc:msgtext`, rebuild → assert:
  (1) the OTHER (untouched) message's attributes are byte-preserved;
  (2) the **target** (updated) message keeps its non-changed attributes
  (`mc:documented`, `adtcore:name`, other `rawAttrs`) while only `mc:msgtext`
  changed and `mc:lockhandle` was added;
  (3) all class-level attributes (language, masterLanguage, masterSystem,
  responsible) are byte-preserved.
  Each object's non-applicable ops throw
  `UNSUPPORTED_OPERATION` (fake connection); error-translation on a 4xx.
- **Integration (trial, browser profile required):** full lifecycle mirroring
  the probe — create class, read, add a message, read the message (via class),
  update it, delete it, delete the class — self-skips without `.env`.

## Out of scope

- where-used `buildObjectUri` / `getObjectSourceUri` entries for `MSAG/N`.
- Message long texts / documentation (`…/vit/docu/…` links seen in the feed).
- The empty `GET /messages/{no}` sub-resource (not a content source).
