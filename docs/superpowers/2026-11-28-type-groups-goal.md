# Goal: type groups (`TYPE/DG`) in adt-clients

## Goal

A consumer of `@mcp-abap-adt/adt-clients` works with type groups the way it works with every
other source-based object type: `getTypeGroup()` on the client answers `AdtTypeGroup`, whose
members each send one ADT request to `/sap/bc/adt/ddic/typegroups` and answer through the
result strategy and the caller's `analyse`. The members are the ones the system serves for a
type group: name validation, create, the metadata read, the source read and write, lock and
unlock, activation, the version list and delete — and any further operation (check run,
deletion check, metadata write, transport) only once it is measured served.

The type group is a row of the release tables in `@mcp-abap-adt/interfaces-adt`
(`ADT_TYPES_ONPREM`, `ADT_TYPES_CLOUD`), so `createAdtClient({ variant })` offers on each
variant exactly the operations that variant serves. On premise that is the set above. On ABAP
Cloud the set is decided by the cloud release's discovery document first and its typestructure
second, and every operation the cloud row lists is checked live on the trial before the
release.

The work ships as a minor release of adt-clients, so that mcp-abap-adt can add its type group
tools on top of it in 24.3.0. The server only calls these members; it builds no request and
no document of its own.

## Measured

What the systems serve today, measured with read-only requests on S/4HANA 2025 (on premise) and
ABAP Cloud (trial); the write cycle on premise is the measured table of the tracking issue.

| Request | On premise | ABAP Cloud |
|---|---|---|
| Discovery: `/sap/bc/adt/ddic/typegroups` | listed, accepts v2 and v3 | listed, `app:accept` empty |
| Discovery: `…/typegroups/validation` | listed | listed |
| Typestructure `TYPE/DG` (corpus) | CREATE, INDEX_UPD; user may create; name ≤ 5 | CREATE, INDEX_UPD; no user authorization listed; name ≤ 5 |
| `GET …/typegroups/{name}`, Accept v3 / v2 | 200 | 200 |
| `GET …/typegroups/{name}`, no caller Accept | 200 (no Accept at all: 400) | 200 |
| `GET …/{name}/source/main`, `text/plain` | 200 | 200 |
| `GET …/{name}/source/main/versions` | 200 | 200 |
| `GET …/{name}/objectstructure` | 404 | 404 |
| `GET …/typegroups` (the collection) | 400, no type group name | 400, no type group name |
| `GET …/typegroups/validation` | 405 | 405 |
| quickSearch, `objectType=TYPE/DG` | found | found (SAP's type groups; none in the customer namespace) |

Unverified on ABAP Cloud: validation, create, lock, source write, activation and delete. The
empty `app:accept` says create is not offered there; typestructure lists CREATE. The trial
check decides each.

## Holds throughout

- **One endpoint, one member.** Each member sends exactly one request; nothing composes lock,
  write, unlock and activate for the caller. Activation keeps the one exception every other
  type has (the follow-up read of the inactive objects).
- **The library interprets nothing.** What SAP answers comes back as the answer: the empty
  `200` of a valid name, the `400` of a refused one, a create's empty `200`. No member reads,
  judges or rewrites an answer; any reading a consumer needs lives in `@mcp-abap-adt/adt-strategies`,
  and no `analyse ??` fallback is added.
- **The library does not second-guess SAP.** The name is sent as given: its length and its
  validity are SAP's to refuse (validation and create answer them). The table's
  `nameMaxLength` is data for the consumer, not a check in the member.
- **Headers are the caller's, with the library's pair as the default.** The default for the
  metadata read is a type group media type: a request carrying no Accept at all is refused on
  premise (`400`, measured), and the connector's request without a caller Accept is answered
  only because the connector supplies a header of its own. A caller's `options.headers`
  replaces the default.
- **The validation request is the one SAP takes.** Its `objtype` is the type group's code as
  SAP spells it; the codes other validations use are not reused for it.
- **Addresses live in one place.** The type group's collection, validation and object
  addresses are a record in `src/endpoints/objects.ts`; no module writes the path.
- **Only LOCK and UNLOCK are stateful.** The type group follows the session rule of every other
  type, with no exception of its own.
- **Availability comes from the system, never from inference.** An operation is in a release's
  row when that release's discovery lists it (typestructure second) and a measurement does not
  contradict it; an authorization refusal is the user's authorization, not the operation's
  absence. Where discovery and typestructure disagree, the measurement on that release decides.
- **Every claim about SAP behaviour is measured or read in SAP's handler**, and the document or
  test that states it says which; an unmeasured claim is marked unverified.
- **The corpus holds the answers.** The scrubbed recordings of both releases go into the corpus
  in its existing format and drive the unit tests; committed files name the release, never a
  system.
- **Live tests prove it on both variants.** An integration suite runs the type group's cycle on
  premise and on the cloud trial, each enabled by what that system serves, not by a flag of
  convenience.
- **Additive only.** No existing member, type, default or answer changes: a minor release of
  adt-clients (and of interfaces-adt for the table rows).
- **Dependencies come from the registry, in order.** interfaces-adt is published first,
  adt-clients (and adt-strategies, if a reading is added) next, and only then does mcp-abap-adt
  take them; no package builds against an unpublished one.

## Out of scope

- **SAP_BASIS 7.40 (`adt-clients-legacy`).** Its discovery lists no type groups; the legacy
  client offers none.
- **The types inside a type group (`TYPE/DGT`)** as objects of their own.
- **A type group's enhancement options and implementations**, which its metadata links to.
- **The object structure**, which the system does not serve for a type group.
- **The mcp-abap-adt tools.** They are the server's change, made after this release and calling
  these members; this task names them as its consumer and stops at the published library.
