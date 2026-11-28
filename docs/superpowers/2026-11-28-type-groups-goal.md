# Goal: type groups (`TYPE/DG`) in adt-clients

## Goal

A consumer of `@mcp-abap-adt/adt-clients` works with type groups as it does with every other
source-based object type. `getTypeGroup()` on the client answers `AdtTypeGroup`. Its members
answer through the result strategy and the caller's `analyse`, and each is one ADT request,
activation included.

The members are exactly these ten operations:

| Operation | Request |
|---|---|
| validate | `POST /sap/bc/adt/ddic/typegroups/validation?objtype=TYPE%2FDG&objname=…[&description=…]` |
| create | `POST /sap/bc/adt/ddic/typegroups` |
| readMetadata | `GET /sap/bc/adt/ddic/typegroups/{name}` |
| read source | `GET …/{name}/source/main` |
| update source | `PUT …/{name}/source/main?lockHandle=…` |
| lock | `POST …/{name}?_action=LOCK&accessMode=MODIFY` |
| unlock | `POST …/{name}?_action=UNLOCK&lockHandle=…` |
| activate | `POST /sap/bc/adt/activation` |
| versions | `GET …/{name}/source/main/versions`; the version source an entry names, `GET <its content uri>` (the version atom's pair) |
| delete | `DELETE …/{name}?lockHandle=…` |

No other operation is part of this goal. The check run, deletion check, metadata write and
transport assignment are not in it, whether or not a system serves them.

The type group becomes a row in the release tables of `@mcp-abap-adt/interfaces-adt`
(`ADT_TYPES_ONPREM`, `ADT_TYPES_CLOUD`). So `createAdtClient({ variant })` offers on each
variant the operations of that row, and the row holds what that release serves, decided by the
rule under "Holds throughout".

The work ships as a minor release of adt-clients. mcp-abap-adt is its consumer and adds its
type group tools on top of it. The server only calls these members; it builds no request and no
document of its own.

## Measured

Read-only requests on S/4HANA 2025 (on premise) and on ABAP Cloud (trial), each sent through
the connector (`scripts/adt-nc.ts`). The on-premise write cycle and the validation answers are
the tracking issue's table: raw requests on S/4HANA 2025, recordings kept for the corpus.

| Request | On premise | ABAP Cloud |
|---|---|---|
| Discovery: `/sap/bc/adt/ddic/typegroups` | listed, accepts v2 and v3 | listed, `app:accept` empty |
| Discovery: `…/typegroups/validation` | listed | listed |
| Typestructure `TYPE/DG` (corpus) | CREATE, INDEX_UPD; user authorization CREATE; name ≤ 5 | CREATE, INDEX_UPD; no user authorization listed; name ≤ 5 |
| `GET …/typegroups/{name}`, Accept v3 / v2 | 200, the same `atypgr:abapTypeGroup` | 200, the same |
| `GET …/typegroups/{name}`, no caller Accept | 200 | 200 |
| `GET …/typegroups/{name}`, no Accept header at all (raw) | 400 "Accept header missing" | not measured |
| Metadata links | enhancement options and implementations | enhancement options and implementations |
| `GET …/{name}/source/main`, `text/plain` | 200 | 200 |
| `GET …/{name}/source/main/versions` | 200, atom feed | 200, atom feed |
| `GET <an entry's content uri>` (version source) | not measured | not measured |
| `GET …/{name}/objectstructure` | 404 | 404 |
| `GET …/typegroups` (the collection) | 400, no type group name | 400, no type group name |
| `GET …/typegroups/validation` | 405 | 405 |
| quickSearch, `objectType=TYPE/DG` | found | found (SAP's type groups; none in the customer namespace) |
| validate, `objtype=TYPE/DG` (raw) | valid name: 200, empty body; taken or too long: 400 `InvalidTypeGroupName`; `objtype` `typedg`, `type` or `TYPEDG`: 400 | not measured |
| create (raw) | 200, empty body; the object is inactive, source `TYPE-POOL <name>.` | not measured |
| lock, source write, unlock (raw) | 200 each | not measured |
| activate (raw) | `chkl:messages`, `activationExecuted="true"` | not measured |
| delete: lock, `DELETE ?lockHandle`, unlock (raw) | 200, then the read answers 404 | not measured |
| Discovery (SAP_BASIS 7.40, corpus) | no type group collection | — |
| Typestructure (SAP_BASIS 7.40, corpus) | `TYPE/DG` with CREATE; name ≤ 5 | — |

No SAP handler was read for these claims. Each one is a measurement, and anything the table
does not list is unverified. The connector's request without a caller Accept is answered with
200, while a raw request with no Accept is refused. The connector most likely supplies its own
header; that is not verified.

## Holds throughout

- **One endpoint, one member.** Each member sends exactly one request, and nothing composes
  lock, write, unlock and activate for the caller. Activation is one request too: the type
  group's `activate` sends `POST /sap/bc/adt/activation` and nothing after it. The library's
  follow-up read of the inactive objects does not apply to it; a consumer that wants the
  inactive list reads it through the existing separate member
  (`getUtils().getInactiveObjects`).
- **The library interprets nothing.** What SAP answers comes back as the answer: the empty 200
  of a valid name, the 400 of a refused one, a create's empty 200. No member reads, judges or
  rewrites an answer. Any reading a consumer needs lives in `@mcp-abap-adt/adt-strategies`, and
  no `analyse ??` fallback is added.
- **The library does not second-guess SAP.** The name is sent as given. Its length and its
  validity are SAP's to refuse, and validation and create answer them. The table's
  `nameMaxLength` (5) is data for the consumer, not a check in the member.
- **Headers are the caller's; the library's value is a default only where the atom has one.**
  - The metadata read sends `Accept: application/vnd.sap.adt.ddic.typegroups.v3+xml` by default,
    and a caller's `options.accept` replaces it. v3 is the newest media type on-premise
    discovery lists; v2 answers the same body, so the default is a choice, not a requirement.
  - A read that sends no Accept at all is refused on premise (raw, 400), so the library always
    sends one.
  - The writes (create, source write, activate, delete) send the caller's `headers` pair, which
    their atoms require. The pair measured for create is v3 for both Accept and Content-Type.
  - Validation and lock send the fixed Accept every type's validation and lock send.
- **Validation sends `objtype=TYPE%2FDG`.** It sends that exact value, URL-encoded, never `typedg`, `type` or `TYPEDG`, which are measured refused (400).
- **Addresses live in one place.** The collection, validation and object addresses are a record
  in `src/endpoints/objects.ts`. No module writes the path.
- **Only LOCK and UNLOCK are stateful.** This is the library's session rule for every type, and
  type groups add no exception. The on-premise cycle measured lock, write and unlock under that
  rule. The rule itself (a stateless UNLOCK releases nothing) is measured on other types, not on
  type groups.
- **Availability is decided per operation and per release, in this order:**
  1. A live measurement on that release settles the operation, by what the refusal is about:
     - **Served:** the operation's own handler answers — success, or a refusal of this object or
       these arguments (a taken or too long name, `400 InvalidTypeGroupName`; an unknown object,
       `404` on the read; a lock held elsewhere, unmeasured for type groups). It is in the row: such a refusal is the call's
       answer, not the operation's absence.
     - **Not offered:** the system has no handler for the request — the resource framework's
       `404 "No suitable resource found"` or `405 ExceptionMethodNotSupported` (measured on the
       object structure and on a GET of validation). It is out of the row.
     - **Decides nothing:** an authorization refusal (the user's authorization), and any answer
       not clearly one of the two above. The operation then stays unmeasured, and the next steps
       apply.
  2. Unmeasured, the release's discovery decides: a listed collection with its media types.
  3. Where discovery does not describe the operation, the typestructure capabilities decide.
  4. Every operation the cloud row lists is measured on the trial before the release. One that
     cannot be measured there stays out of the cloud row.
  - The cloud's create is unverified today: its collection is listed with an empty
    `app:accept`, and its typestructure lists CREATE. A live measurement outranks discovery: if
    the trial measures create served, it is in the cloud row.
- **Every claim about SAP behaviour is measured or read in SAP's handler.** The document or test
  that states it says which, and an unmeasured claim is marked unverified.
- **The corpus holds the answers.** The scrubbed recordings of both releases go into the corpus
  in its existing format and drive the unit tests. Committed files name the release, never a
  system.
- **Live tests cover every operation each variant's row lists, unlock included wherever lock
  is.**
  - On premise the suite runs the whole cycle: validate, create, lock, write, unlock, activate,
    versions, lock, delete, unlock.
  - On ABAP Cloud it runs every operation the cloud row lists, each in a case of its own, so one
    that cannot run is never skipped because another is missing:
    - validation always runs on its own, with names of its own, since it needs no object;
    - the reads (metadata, source, versions) run against an SAP type group;
    - lock, write, unlock, activate and delete run on a type group of the test's own when create
      is served. Any of them listed without create gets a case on an object the system lets the
      test user change, named in the test config; if none exists, the operation stays out of the
      cloud row (step 4 above).
  - Each suite is enabled by what its system serves, not by a flag of convenience.
- **Additive only.** No existing member, type, default or answer changes: a minor release of
  adt-clients, and of interfaces-adt for the table rows.
- **Dependencies come from the registry, in order.** interfaces-adt is published first, then
  adt-clients, and adt-strategies if a reading is added. Only then does mcp-abap-adt take them;
  no package builds against an unpublished one.

## Out of scope

- **SAP_BASIS 7.40 (`adt-clients-legacy`).** It belongs to the legacy-coverage task. 7.40's
  discovery lists no type group collection, while its typestructure lists `TYPE/DG` with CREATE;
  nothing was measured there.
- **The types inside a type group (`TYPE/DGT`)** as objects of their own.
- **A type group's enhancement options and implementations.** The metadata of both releases
  links to them.
- **The object structure.** It answered 404 on both measured releases.
- **The check run, deletion check, metadata write and transport assignment.** They go to a later task.
- **The mcp-abap-adt tools.** They are the server's change, made on the published library.
