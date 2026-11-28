# @mcp-abap-adt/adt-strategies

This package's own changelog, and the only one that describes it.

**Every package here keeps its own, because the versions move independently.**
`adt-clients` is at 19.0.0 while this starts at 0.1.0, so a shared file would
list entries against versions this package never had. A monorepo that bumps all
its packages together can have a single changelog; this one cannot.
`adt-clients`' is [in its package](../adt-clients/CHANGELOG.md).

Tags follow the same rule: these releases are tagged
`adt-strategies-v<version>` (`<package directory>-v<version>`), adt-clients'
`adt-clients-v<version>`, and each fires its own job of the release workflow.
The tags made before the packages moved under `packages/` are
`adt-strategies@<version>`.

## [Unreleased]

For adt-clients 49.0.0 (C7: one member, one endpoint, one request), whose
activation members no longer read the inactive list (to be released as
0.30.0).

### Added

- **`readUnstatedActivation(answer)`** and its type `AdtUnstatedActivation`:
  whether a 2xx `chkl:messages` leaves the activation's outcome to the inactive
  list — `silent` (`activationExecuted="false"`, no message) or `unstated` (no
  `activationExecuted`, `W`/`I`/`S` messages alone) — `undefined` otherwise. It
  is the one predicate `readActivationRefusal` decides by (no second copy), so
  it answers a kind exactly when that reading, without a list, answers "could
  not be decided". It answers what adt-clients 48.0.0's private reading
  answered on every recorded activation answer.

### Fixed

- **The settings reading takes a count only as a safe integer**:
  `tableSettings` / `cloudTableSettings` throw for an `areaKeyFields` past
  `Number.MAX_SAFE_INTEGER` (`not a count`), which would read as another
  number and be written back. adt-clients' own reading for `patchMetadata`
  refused it; since that reading is gone, the strategy is the read.

### Docs

- `analyseActivation`, `readActivationRefusal` and the README say the caller
  hands the inactive list, not the member.

## [0.29.0] - 2026-11-27

The source rules of fr0ster/mcp-abap-adt-clients#304: this package's `src`
holds no cast but `as const`, no `any`, no value narrowed by hand after it
was widened to `unknown`, no regular expression and no type predicate over a
typed value — a guard test (`sourceRules.test.ts`, over
`tools/sourceRules.js`) refuses each. Breaking for one reason: the trace
readings.

### Changed (breaking)

- **A trace reading throws on a missing required field.**
  `profilerTraceEntries`, `profilerHitList`, `profilerStatements`,
  `profilerDbAccesses`, `traceSchedulingTypes` and `traceSchedulingRequests`
  throw `traces: <field> is missing` for an answer that lacks a field their
  result type requires; before, the field read as `undefined` under a type
  that said `string` or `number`. The on-premise trace feed the reading was
  transcribed from carries every such field; the other documents and the
  cloud's answers are not recorded, so that SAP always sends them is not
  measured. See the README's "Migrating to 0.29.0".
- **`ITraceProgramRef.name` and `uri` are optional.** The #333 live run's
  onprem hit list carried references with neither (the "Runtime analysis"
  root, an object's creation, a call from the kernel); they read as absent.
  The recorded views are a fixture (`src/__tests__/fixtures/traces/`), and
  each field kept required is on every one of their rows.

### Changed

- **Every regular expression is a scanner** (`src/scan.ts`): the `/runs/`
  ids, the `aunit:run` uri and its fallback, the `T100KEY-V` keys, the
  message class long-text link (with the regex's own `/i` folding) and
  `&amp;`, trailing slashes, the trace id, the sub-millisecond digits and the
  leap second. Each answers what its regex answered, held to it by a
  differential test over SAP's recorded texts, edge cases, every short string
  over the pattern's characters and seeded random ones.
- **Parsed documents are read through the parsed readers** (`field`, `at`,
  `isElement`) instead of being cast to records; a parser's `any` result is
  bound to `unknown` at once. A parsed item that is no element (text where
  an element was expected) reads as nothing, as it did.
- **A type code is looked up in a typed map** (`answeredObject`), built from
  the tables' own keys; every text reads as before.
- **`@mcp-abap-adt/interfaces-adt` is `^33.0.0`** (was `^31.0.0`): 32.0.0 is
  #304's contract, 33.0.0 requires a create's fields in its configs. This
  package's declarations (`dist/index.d.ts`) are unchanged by either.

## [0.28.3] - 2026-11-25

An on-premise gateway error's own document was refused: `feedGatewayErrorDetail`
threw "the answer names no gateway error" for every error the on-premise
viewer rendered (mcp-abap-adt's live test of the gateway error detail failed
on premise only). Recorded on premise, 2026-11-25, read-only, scrubbed:
`onprem-gatewayerror-detail.body.txt`.

### Fixed

- **The `Header Information` section is read under both headings SAP
  writes**: `<h4 id="HEADER_INFO">` on the cloud, `<h4 id="HEADER">` on
  premise (measured on both). Only the cloud's was read, so an on-premise
  document carried no header field and was refused; the on-premise feed's
  summaries, also headed `HEADER`, lost their header cells to
  `feedGatewayErrors` the same way.
- **The service section's on-premise labels are read**: `Group ID` and
  `Destination` beside the cloud's `Service Group` and `RFC Destination`
  (measured), into `serviceInfo.groupId` and `serviceInfo.destination`.

## [0.28.2] - 2026-11-23

A transport entry SAP lists without a name was dropped from the readings,
found by the server team's review (mcp-abap-adt #378): the entry vanished
from a task's answer, and its count went down. Released with
`@mcp-abap-adt/adt-clients` 47.0.2, a documentation patch (its shipped
ERRATA and API reference describe these entries); none of its default sets
uses either reading, so its behaviour does not change.

**Which test documents are recorded, which written.** Recorded: the
server's cloud task document `EMPTY_TASK`. Reduced from a recording:
`TASK_WITH_OBJECTS`, the server's reconstruction of the measured on-premise
task document. Written: the server's `REQUEST`. Built in the tests from
those: each with one entry's `tm:name` (or `tm:type`) removed, `EMPTY_TASK`
with a nameless entry added, and an entry with no attribute at all.

### Fixed

- **No entry SAP lists is dropped silently any more.** A `tm:abap_object`
  without `tm:name` or `tm:type` was skipped by every transport entry
  reading; one without `tm:position` was already kept. It is now answered
  in `incompleteEntries` (`ITransportIncompleteEntry`: every field of an
  entry, each present only when the entry carries it, the task's number
  included), in document order, present only when the document holds one.
  **Both complete readings below answer the same field values for a task's
  entries** (which entries each reads is its own: `transportObjectEntryList`
  reads every entry of the document, `transportItem` the asked item's):
  every field
  and the task's number decoded and trimmed, literal and entity-encoded
  padding alike (`&#32;ZCL_ONE&#x20;` is `ZCL_ONE`), a blank one absent; a
  name or a type is missing when it is absent, empty, or blank once
  decoded and trimmed (`&#32;&#x20;`):
  - **`transportObjectEntryList`, new: the complete entry reading.** It
    answers `ITransportObjectEntryList`, `{ entries, incompleteEntries? }`
    — `entries` the entries `transportItem` answers for a task's document,
    with the same values. A plain object, so a copy or JSON of it keeps
    both lists.
  - **`transportObjectEntries` / `parseObjectEntries` are unchanged and
    leave out an entry without a name or a type**, as they always did: the
    answer is still the plain `ITransportObjectEntry[]` and keeps its 0.28.1
    output exactly: values as decoded, untrimmed, and an entry whose name or
    type is blank only after decoding still in it. A caller who must see
    every entry SAP lists, trimmed, moves to `transportObjectEntryList`.
  - **`transportItem` / `readTransportItem`: `ITransportTaskItem` (a task's
    document) gains `incompleteEntries`.**

  `ITransportObjectEntry` is unchanged: `name` and `type` stay required,
  and `transportItem`'s `objects` hold the same entries with the same
  values as in 0.28.1.

  **The count includes them.** A task holds `objects.length +
  (incompleteEntries?.length ?? 0)` entries (`entries.length + …` in the
  list reading) — the number its request's document gives as the task's
  `objectCount`, which has counted every `tm:abap_object`, complete or not,
  since 0.28.0 (now stated on the field and pinned).

  The new names, exported from the package root: `transportObjectEntryList`,
  `ITransportObjectEntryList`, `ITransportIncompleteEntry` (the pure
  function underneath, like `parseObjectEntries`, is not). Nothing existing
  changes type; the one consumer an added key reaches is an exhaustive
  mapping over the interface's keys (`Record<keyof ITransportTaskItem, …>`),
  which now needs `incompleteEntries`.

## [0.28.1] - 2026-11-23

Two readings the server team still worked around after 0.28.0 (mcp-abap-adt
`GetTransport` and its package walks), fixed on the documents they were found
with. Released with `@mcp-abap-adt/adt-clients` 47.0.1, a documentation
patch (its shipped ERRATA describes these readings); none of its default sets
uses either reading (every slot is `rawDocument`), so its behaviour does not
change.

**Which test documents are recorded, which written.** Recorded: the
adt-clients corpus case `read-object-tree-structure` (its step 02, and
variants of it with one element left out or an empty row added, each test
says which), and the server's cloud task document `EMPTY_TASK`. Reduced
from a recording: `TASK_WITH_OBJECTS`, the server's reconstruction of the
measured on-premise response (its shape, two entries in place of 1647), not
a recording itself. Built in the tests from those two: the variants without
the marker, with another number, with padded numbers, and with a duplicate
under another prefix. Written: the server's two package-walk levels
(`NODE_NOT_LOADED`, `NODE_NAME_ONLY`, `serverDocuments.ts`, shaped after
the measured on-premise answer).

### Fixed

- **`readTransportItem` / `transportItem(number)` picks the item by the
  number asked.** The root's `tm:task` or `tm:request` whose own number is
  the one asked is the item; exactly one may name it, and `tm:object_type`
  must confirm what the number found (`T` a task, `R` a request). Without the
  marker the number decides, and a root that holds a `tm:task` of its own is
  a task's document, whose `tm:request` is only the parent's header. SAP
  marks every task document
  (`CL_CTS_ADT_TM_RES_REQUEST_CONT->prepare_tm_root_for_task`, on premise and
  on the cloud), so the markerless case is defensive. Refused now, in the
  fixed words of `TRANSPORT_ITEM_REFUSAL`:
  - a task's document without the marker, asked for by its parent's number —
    until now read as the parent request, from the parent's header alone;
  - a document in which a `tm:task` and a `tm:request` both name the number;
  - a document whose marker contradicts the element found (a task element
    under `R`, a request element under `T`).
  - a document with two root `task` elements, or two root `request`
    elements, naming the number — counted by the tm namespace URI and local
    name, whatever the prefix (`<tm:task>` beside a bare `<task>` in the tm
    default namespace, or beside `<t2:task>` with `t2` bound to tm);
  - a number asked for, or written in `tm:number`, that is blank after
    trimming — `tm:number`, `tm:object_type` and the number asked are trimmed
    after decoding, so padding written `&#32;` reads as literal padding does.

  A caller who relied on reading such a document as the parent now gets the
  refusal. Every field of the item — its header, its parent's header, a
  request's tasks and their counts, a task's entries — is read by the tm
  namespace URI and local name, so an item written under another prefix
  bound to tm reads in full; a `tm:`-qualified attribute wins over a bare one
  of the same name. Every value the reading returns — the item's header, the
  parent's, the task summaries, each entry's `task` and fields — is trimmed
  after decoding, so a number padded with `&#32;` gives the same item as one
  padded literally (the parser already trimmed literal padding). Every
  document SAP answers reads as before.
- **`utilNodeContents` drops no node SAP lists.** An object node without
  `OBJECT_NAME`, `TECH_NAME` or `OBJECT_URI` was dropped; it is now answered
  in `incompleteObjects` (`IRepositoryIncompleteNode`: every field the node
  carries, the ones it lacks absent), present only when the level lists one.
  `objects` and `IRepositoryObjectNode` are unchanged: the same nodes, the
  same required fields, the same values. An empty row
  (`<SEU_ADT_REPOSITORY_OBJ_NODE/>`), which `readNodeStructure` dropped, is
  now a node with no fields (in `readNodeStructure`'s `nodes` too), answered
  in `notLoaded`, since it has no `OBJECT_TYPE`.
- **A node SAP could not load is answered as such.** SAP answers a tree line
  it cannot resolve with an entry of no `OBJECT_TYPE`, its message `SEU_ADT
  101` "Error loading node:" in `OBJECT_NAME` and an explanation in
  `TECH_NAME` (`CL_SEU_ADT_RES_REPO_STRUCTURE->create_tree_content`; measured
  on premise, 2026-11-22, for a package's `VIEW/DV` node). The level answers
  each such entry in `notLoaded` (`IRepositoryNotLoadedNode`,
  `{ notLoaded: true }`), with none of SAP's text; `notLoaded` is present only
  when the level lists one. The entry carries no type (that is how it is
  known); the node's type is the child node the level was asked for by. Until
  now the entry was dropped, and the level said nothing.

### Added

- `IRepositoryIncompleteNode` and `IRepositoryNotLoadedNode`, and
  `IRepositoryNodeContents.incompleteObjects` and `.notLoaded`, each present
  only when the level lists such a node. Nothing existing changes type; the
  one consumer an added key reaches is an exhaustive mapping over the
  interface's keys (`Record<keyof IRepositoryNodeContents, …>`), which now
  needs the two new keys.

## [0.28.0] - 2026-11-22

Released with `@mcp-abap-adt/adt-clients` 47.0.0, on
`@mcp-abap-adt/interfaces-adt` `^31.0.0` (was `^30.2.0`; no type this package
uses changed — the range follows adt-clients', so the tree holds one version).
The readings the server
team found reading something other than what the document holds, fixed on
the documents they were found with, and one new reading.

**Which test documents are recorded, which written.** Recorded: the
adt-clients corpus cases each test names (where-used, the 7.40 and S/4HANA
2025 inactive lists, the node structure, the transport lists), the 7.40
empty transport list (a probe over RFC), the server's task documents
(`EMPTY_TASK` recorded on the cloud; `TASK_WITH_OBJECTS` cut from an
on-premise recording) and the feed list cut, and the gateway-error and
system-message feeds and an error's document (`fixtures/feeds/`, the cloud
and on premise, 2026-11-22). Written: the server's `REQUEST` (shaped after a
measured request), the created-task documents — `TASK_CREATED`, the
nested-parent `TASK_UNDER_PARENT`, `TRANSPORT_CREATED` —, the numeric
character reference in a search hit (`SEARCH_ENTITY`), the named items with
an omitted description (`NAMED_ITEMS`), and every variant a test builds from
a recording (each says so); `src/__tests__/serverDocuments.ts` names each
server document's source. Every recorded document is scrubbed: users, hosts,
clients (the task documents' `tm:source_client` is `CLIENT1`), application
servers and other users' object names replaced.

### Added

- **`transportItem(number)` / `readTransportItem(document, number)`** — the
  document `GET /cts/transportrequests/{n}` answers, read as `ITransportItem`:
  `{ kind: 'request', header, tasks }` (each task's `header` and
  `objectCount`) or `{ kind: 'task', header, parent, objects }` (the parent's
  header from `tm:request`, the task's entries as `ITransportObjectEntry`).
  SAP answers a task's number with the task's own document
  (`CL_CTS_ADT_TM_RES_REQUEST_CONT->fetch_request_data` →
  `prepare_tm_root_for_task`, on premise and on the cloud). `kind` is read
  from `tm:root/@tm:object_type` (`R`, `T`), or — without it — from a
  `tm:task` naming the number. A header (`ITransportItemHeader`) is
  `number`, `parent`, `description`, `type`, `status`, `statusText`,
  `owner`, `target`, `client`, `ctsProject`, `lastChanged`, each attribute as
  written. A document whose selected element is missing, names no number or
  another one, or that is no `tm:root` document is refused in fixed words.
  The strategy is made per number, since the document does not say what was
  asked.
- `ITransportObjectEntry.task` (the entry's `tm:task/@tm:number`) and `.info`
  (`tm:obj_info`); `IWhereUsedReference.kind` (`'package' | 'object'`,
  `WhereUsedReferenceKind`) and `.description`; `IRepositoryObjectNode.description`.

### Fixed — what an existing caller now sees differently

- **`transportObjectEntries`** answers entries per task, each once, each with
  its task number. It read every `tm:abap_object` wherever it sat, so a
  request's entries came twice (its tasks' and `tm:all_objects`') and none
  named its task. A task document yields that task's entries.
- **`utilWhereUsedReferences`** keeps every reference the document holds,
  package nodes (`DEVC/K`) included, with `kind`: the recorded
  `read-where-used-list-structure` answer reads 4 references, not 1. A caller
  that wants the places of use alone filters `kind === 'object'`.
- **`utilInactiveObjects`** reads the SAP_BASIS 7.40 form
  (`adtcore:objectReferences`, which answered no objects) and every
  `ioc:object` / `ioc:ref` of an entry, and **throws** for any other answer —
  an empty body, an exception, a logon page, text that is not XML — instead
  of answering no objects: an activation is confirmed off this list.
- **`transportCreated`** (`parseCreatedTransport`) answers the root's own
  number as the created item and a `tm:request` beside it as `parent`; it
  preferred the nested `tm:request`, so a created task under a named parent
  read as the parent (`SIDK907073` under `SIDK907071` read `SIDK907071`). A
  document naming no number now throws instead of answering
  `transportNumber: ''`. Its values are no longer coerced: a numeric
  attribute (a description `007`) keeps its text.
- **`utilSearchHits`** / `readSearchHits` decode character references:
  `&#x26;` reads `&` (it read `&#x26;`), as do decimal references and the
  five predefined entities — in one pass, so `&amp;#x26;` is `&#x26;`. A
  reference XML does not define (`&nbsp;`) stays as written.
- **`utilNamedItems`** / `readNamedItems` coerce nothing (`007` stayed `7`)
  and leave an absent description absent (`description` is optional now; it
  was `''`) — adt-clients' own `INamedItem` follows in 47.0.0.
- **`transportTree`** (`parseTransportTree`) refuses in fixed words —
  `parseTransportTree: the answer is no transport list` — with nothing of the
  body (it quoted up to 200 characters and the root it found), and refuses a
  root that carries nothing (`<tm:root/>`, a bare root with only its
  namespace), which it read as an empty list. A list that names its search
  (`adtcore:name` on the root, the recorded empty list) reads as before.
  `tm:long_desc` text is no longer coerced.
- **`utilNodeContents`** keeps each object's `DESCRIPTION`.
- **One reader of the inactive list for both readings** (`utilInactiveObjects`
  and the activation verdict): names by namespace URI, not prefix, the same
  reference decoding, and **fail closed** — an entry, object or reference of
  another name, a reference without `adtcore:name` or without both
  `adtcore:uri` and `adtcore:parentUri` (what an activation is matched by),
  or text where the list
  has elements refuses the whole list (`utilInactiveObjects` throws,
  `stillInactiveAmong` answers `null`, which the verdict reads as not
  decided), never an empty one.
- **`stillInactiveAmong`** (the activation verdict's reading of the inactive
  list) reads every `ioc:ref` of every `ioc:object` of an entry, as
  `utilInactiveObjects` does; it read one, and none when either repeated —
  an object listed that way was not found still inactive.
- **The feed readings** (`feedEntries`, `feedDescriptors`, `feedVariants`,
  `feedSystemMessages`, `feedGatewayErrors`, `feedGatewayErrorDetail`) coerce
  nothing: element text that looked numeric read as the number's text
  (`0042` read `42`, in a title, content, id, client or source line) and now
  reads as written. References decode (an `href` holding `&amp;` read
  `&amp;`, it reads `&`). The fields typed as numbers — a call-stack entry's
  `number` and `line`, a source line's `number`, `errorLine` — are converted
  from their text, as before. An entry with several `link`, `author` or
  `category` elements (Atom allows them) read `''` / `undefined`; it now
  reads the entry's own link (`rel` absent or `alternate`, else the first),
  and the first author and category.
- **`feedGatewayErrors`** and **`feedGatewayErrorDetail`** read what SAP
  answers. Grounded in SAP's code, read on premise and on the cloud
  (`/IWBEP/CL_ERROR_LOG_FEED_PROV->build_feed`,
  `/IWBEP/CL_ERROR_LOG_FORMATTER->build_html` / `build_for_header`,
  `/IWBEP/CL_ERROR_LOG_VIEWER->get`), and measured on the cloud (2026-11-22,
  115 entries): an entry holds `atom:id`, `title`, `updated`, `author/name`
  and an HTML `summary`; every other field is a cell of the summary's
  `Header Information` table; the error's own document is HTML on both
  systems, not the XML `errorEntry` the detail reading parsed. Pinned on the
  scrubbed recordings (`fixtures/feeds/`) and on variants written from the
  code. What a caller sees:
  - `type`, `package`, `applicationComponent`, `client`, `requestKind` read
    `''`; they carry the cells now.
  - `transactionId` was the `atom:id`; it is the `Transaction ID` cell, without
    the `(Replay in GW Client)` link or `(Not replayable in GW Client)` note
    SAP may append. The `atom:id` is the new `id`.
  - `shortText` kept the title's `Frontend Error: ` prefix; it is the
    `Short Text` cell (the title's remainder when there is none), and the
    prefix is the new `kind`.
  - `username` was `name (id)`; it is the name, the id the new `userId`.
  - New: `opid` (the id's second segment; the id is `Kind/opid` on premise,
    `Kind/opid/timestamp` on the cloud, the kind's spaces removed) and
    `detailUri`, built from the entry's own id: the viewer looks an error up
    by its OPID, not its transaction id, and reads the Backend log for
    `BackendError` on premise and `Backend Error` on the cloud.
  - Every field of `IGatewayErrorEntry` is optional now and absent when the
    entry does not carry it, never `''` (a Backend entry measured with no
    short text). A caller that read them as `string` checks for absence.
  - `feedGatewayErrorDetail` read every field empty; it reads the header, the
    service information (its fields optional now), the error context
    (`errorInfo`, `resolution`, each exception with `text`, `raiseLocation`,
    `attributes` — `text` optional now — and, new, the whole `tree`), the
    source extract (the highlighted line numbered after the one before it,
    or before the one after it when it comes first; `errorLine` optional
    now) and the call stack, numbers converted from their text. Its
    `dateTime` is the `Date/Time` cell as written. It **refuses** an answer
    that names no error — the empty skeleton SAP renders for an unknown id
    (no 404 path), an empty body.
  - The on-premise feed answered no entry, so its entry shape is from the
    code alone.
- **`feedSystemMessages`** reads what SAP writes
  (`CL_STSK_ADT_RES_SYSTEM_MESSAGE->get_feed`, `lcl_atom_service->
  map_feed_entry`, the same on both systems): a plain Atom entry with an HTML
  summary — no `sm:` element. `ISystemMessageEntry` is now `id`, `messageId`,
  `title`, `text` (every line as SAP writes it, blank lines and leading
  spaces kept, the `</BR>` breaks as `\n` — built from SAP's code,
  `map_feed_entry` / `convert_textlines_to_html`, not measured; it read
  `content`, which SAP never writes),
  `createdOn`, `updated`, `createdBy` and `author`, each optional;
  **`severity`, `validFrom` and `validTo` are removed** — SAP writes none of
  them (the expiry only filters the rows). Not measured: both systems held no
  message; the test entry is built from the code.
- `parseSearchConfigurations`' parser no longer coerces (no field it reads
  was affected).
- **A CDATA section is kept as written** (`XML_TEXT_OPTIONS` parses it apart
  with the parser's own `cdataPropName`; references decode in text and
  attribute values only).
- **Reference decoding is one linear pass** (the XML and the HTML decoder
  alike): a text of many `&` and one late `;` was read once per `&`.
- **A parser's own error never reaches a reading's caller**: every parse is
  caught, and the reading answers its empty shape or its fixed-word refusal
  (an entity name the parser refuses in a DTD, nesting past its limit).
- **`featureToggleRuntimeState` / `featureToggleCheckState`** refuse a body
  that is no JSON in fixed words (`featureToggle: the answer is no JSON
  document`); `JSON.parse`'s message quoted the body.
- Every parser in the package now shares one set of options
  (`XML_TEXT_OPTIONS`, internal) or turns both coercions off, pinned by a
  source check: no tag or attribute value is coerced, and in the readings
  named above references decode as an XML parser decodes them.

## [0.27.0] - 2026-11-22

Released with `@mcp-abap-adt/adt-clients` 46.2.0, on
`@mcp-abap-adt/interfaces-adt` `^30.2.0` (was `^30.1.0`: the facts contracts
`IAbapGitFactsResponse`, `IAbapGitErrorFacts`, `IAbapGitPullSelection` and
`IAbapGitStagedObject` are its), and `@mcp-abap-adt/interfaces-adt-connection`
`^5.3.0` (was `^5.0.0`; no new type of it is used: the range follows
adt-clients', so the two declare the same range for what they share and the
tree holds one copy).

### Added

- **The facts are strict** (review of adt-clients#326): a document is read
  only when it is a string and well-formed XML (the parser's `XMLValidator`;
  a mismatched closing tag no longer yields usable fields); R7's fact is SAP's
  fixed `DEMO STATUS` and nothing else; R12's content is a text body
  (exactly `text/plain`, optionally with `;` parameters, or no
  `Content-Type`; `text/plain+xml` or an array value is refused); `messageNumber` is exactly three
  digits, else absent; `abapGitErrorFacts(answer, route?)` reads
  `http_status` for `checked` (R11) alone; `appLogKey` is the decoded segment
  of the `log_link` (`A%2FB` is `A/B`), an empty, `.` or `..` one none.

- **`abapGitFacts`**, the facts reducer of `AdtAbapGitClient`'s new forms: one
  reducer per new-form slot (`reposFacts`, `linkedFacts`, `repoPulled`,
  `repoPulledInDialog`, `modifiedObjects`, `status`, `runLog`, `staging`,
  `pushed`, `checked`, `file`, `externalRepoFacts`, `branchInfo`, `switched`),
  each answering `IAbapGitFactsResponse<F>`: the HTTP status and the fields its
  route keeps, built field by field, and nothing else — no body, header, status
  text, message text, exception text, message variable, property or link. No
  redactor: names, paths, branches and people pass as data. `file` takes the
  call's `filename` and `version`, which the answer does not name. A success
  that is not the route's document throws
  `ABAPGIT_ERROR_MESSAGES.unreadableAnswer`, never the parser's message (which
  quotes the document). The README's table lists each slot's kept fields.
- **`abapGitErrorFacts`**: a failed answer's status and, from an
  `exc:exception` document, `T100KEY-ID` / `T100KEY-NO` and R11's
  `http_status` as an integer (`IAbapGitErrorFacts`); `T100KEY-V1`…`V4`,
  `LONGTEXT` and the texts are not read.
- **`abapGitRepoRunStates`**: each repository's `runStatus`, `statusText` and
  `appLogKey`, `undefined` when absent (onprem R1 writes no status; a blank
  status is present and blank). `appLogKey` comes from the `log_link` path
  `/sap/bc/adt/abapgit/repos/{key}/log/{appLogKey}` only; a `status_link`
  alone, or a link of another shape, yields none.
- **`abapGitStaging`**, **`abapGitModifiedObjects`**, **`abapGitBranchInfo`**,
  **`abapGitObjectResults`**: every field SAP sends for R9, R6, R13/R14 and
  R2/R4/R8 (Code: the simple transformations that write them). A branch's hash
  is read from `sha1` or `sha` into `sha1`. Each reads its route's root element
  and throws `ABAPGIT_ERROR_MESSAGES.unreadableAnswer` for any other answer.
- **`abapGitRepos`** gains `folderLogic`, `createdEmail`, `deserializedBy`,
  `deserializedEmail`, `deserializedAt` and `links` (every link with its
  `rel`; onprem writes its pull link without a `type`, so `pullLink` misses it
  there and `links` has it). `status` and `statusText` keep their contract:
  `''` when SAP writes none. The six keys are optional, so an existing
  value of `IAbapGitRepo` still fits; the one edge case is a type built from
  its keys — a `Record<keyof IAbapGitRepo, …>` now needs the six new keys too.
  Adding optional properties is a minor (the owner's ruling, as for
  interfaces-adt-connection 5.2.0 and 5.3.0).

## [0.26.0] - 2026-11-19

Released with `@mcp-abap-adt/adt-clients` 46.1.0, on
`@mcp-abap-adt/interfaces-adt` `^30.1.0`.

### Added

- **`utilInactiveObjects` carries each entry's `uri` and `parentUri`.** SAP
  listed a class's text elements as `PROG/PX` named after the class pool
  (`ZCL_…====CP`) at `/textelements/classes/{class}` (measured on premise),
  and a function group's as `PROG/PX` `SAPL{GROUP}` at
  `/textelements/functiongroups/{group}` (measured on the cloud), each with
  its object as `parentUri`; the pool name comes from
  `CL_SEDX_ADT_SRC_UTIL=>get_type_and_name_from_uri` (Code). The entry's
  name is not the object's: a `PROG/PX` reference without a `uri` is
  addressed `/textelements/programs/{name}`. The `uri` is now there for a
  caller building its own references; the cloud capture activated the group
  through the synchronous `/activation` naming the group, not by passing the
  listed entry on. `IInactiveObject` gains the two optional fields.

- **`cloudTableSettings`**, the settings reading for a cloud system: the
  settings carry `isWritableByAMDP` as a `boolean`
  (`ITableSettingsReadOf<'cloud'>`), so a cloud client's write takes them
  back as they are, and a read without `ts:isWritableByAMDP` throws, naming
  it (the cloud answered it on every read measured; a write without it reset
  it, measured). On premise `tableSettings` reads as before.

### Checked

- `analyseActivation` refuses an executed activation that carries `E`
  messages (`activationExecuted="true"`, the object left inactive; recorded
  on both systems), and `stillInactiveAmong` matches a class's text elements
  by `uri` / `parentUri`, whatever the class-pool name: tests over the
  recorded answers, no change of behaviour.

## [0.25.0] - 2026-11-19

Released with `@mcp-abap-adt/adt-clients` 46.0.0, on
`@mcp-abap-adt/interfaces-adt` `^30.0.0`. 0.24.0 was tagged
(`adt-strategies-v0.24.0`) but never published: this release carries its
`tableSettings` reading and adds the text elements readings.

### Added

- **`textSymbols`, `selectionTexts`, `textHeadings`**: the readings of a text
  elements part — `getTextElements().read` and `update`'s answer — and
  `readTextSymbols`, `readSelectionTexts`, `readTextHeadings` for the text
  alone. Each answers the part with its list in the shape of the contract's
  `TextElementsDocument`: symbols `{ key, text, maxLength }` from
  `@MaxLength:N` and `KEY=text` blocks; selection texts
  `{ name, text, ddicReference }`, an empty line between entries and
  `@DDICReference` before a dictionary text; headings `listHeader` and
  `columnHeader1`–`4` from their six lines. Everything is read as SAP wrote
  it — a leading space kept, a selection name's padding kept — so a write
  sends back the bytes it read. A line out of the grammar throws, naming the
  part and the line: a part is written back whole, and a skipped line would
  be a deleted entry. Tested over the recorded answers, on premise and on
  the cloud.
- **`tableSettings`**, as 0.24.0 describes below: the settings read, every
  setting or a throw naming the one missing, with the ETag.

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^30.0.0`** (was `^29.0.0` in the
  unpublished 0.24.0, `^27.4.0` in 0.23.5). No existing reading or verdict
  changes.

## [0.24.0] - 2026-11-19 (tagged, not published)

Tagged as `adt-strategies-v0.24.0` and never published; its content ships in
0.25.0. Released with `@mcp-abap-adt/adt-clients` 45.6.0.

### Added

- **`tableSettings`**: the reading of `getTableSettings().readMetadata`'s
  answer — `{ name, description, version, settings, etag }`, `settings` an
  `ITableSettingsRead` with every setting the full-replacement write needs,
  the translation's four attributes included, and the cloud's
  `isWritableByAMDP` where the read has it. An element or attribute the read
  lacks throws, naming it: the write would otherwise store a value SAP never
  sent. Values are read as SAP wrote them: character references and entities
  decoded (`Caf&#xE9;` is `Café`), in attributes and text, and nothing
  trimmed, so a write sends back exactly what was read. The ETag header is
  read whatever the case of its name. `readTableSettings(xml)` reads the text
  alone.

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^29.0.0`** (was `^27.4.0`), so a
  consumer of adt-clients 45.6.0 holds one copy of the contract. No existing
  reading or verdict changes.

## [0.23.5] - 2026-11-18

The same code as 0.23.3, released together with adt-clients 45.5.5 from one
commit. 0.23.4 was tagged (`adt-strategies-v0.23.4`) but never published: a
release publishes every package from main's HEAD, and adt-clients 45.5.4's tag
was no longer there. Everything 0.23.3 lists below is in 0.23.5.

## [0.23.4] - 2026-11-18 (tagged, not published)

The same code as 0.23.3, released from the repository's current HEAD.
0.23.3 was tagged (`adt-strategies-v0.23.3`) but never published: adt-clients
45.5.4 landed on main before it was published, and a release is published only
from main's HEAD. Everything 0.23.3 lists below is in 0.23.4.

## [0.23.3] - 2026-11-18 (tagged, not published)

For `mcp-abap-adt` 24.0.1.

### Fixed

- **A check or an activation refused with a non-2xx status keeps its
  messages' positions.** Every analyser read an answer whose status the
  library had already refused with the exception reading alone
  (`readExceptionRefusal`), so a check-run report or an activation checklist
  on a `400` became one `E` carrying the library's sentence: `position`,
  `uri`, `object`, `code` and the deprecated `line`, which the `200` readings
  give, survived only in the raw body (mcp-abap-adt's `CheckClassLow`
  replaying the recorded syntax check as a `400` lost `{ line: 15, column: 24 }`).
  When the answer's own status is not 2xx, its body is not an
  `exc:exception`, and it is a well-formed document with exactly one
  top-level element as the parser reports it, that element — by namespace URI and local
  name, never by prefix — picks the reading, and it is the very reading of a
  `200`: `checkRunReports` or `checkReport` in `http://www.sap.com/adt/checkrun`
  goes through `readCheckRunRefusal`, `messages` in
  `http://www.sap.com/abapxml/checklist` through `readActivationRefusal` with
  the member's inactive-list facts. The `400` therefore carries exactly the
  messages the `200` reading gives for the same body (a warning-only report
  beside an error report contributes nothing, as on a `200`; a warning-only
  checklist without `activationExecuted` gives the undecided `E` and the
  warning), and `analyseActivation` carries that reading's `stillInactive`.
  A bare empty `checkReport` gives the `200` reading's "Check did not run
  (status: unstated)". A body the `200` reading does not refuse — an empty
  `checkRunReports`, a processed report without an error, an activated
  checklist — gives one `E` with the verdict's message, as in 0.23.2. So does a
  body that only looks like one: another namespace, no namespace, or more
  than one top-level element. A failure verdict handed beside
  a 2xx answer — the inactive-list read that failed after an activation's
  `200` checklist — reads no body and answers as in 0.23.2, the read's
  failure in the message. An `exc:exception` body answers as before,
  byte for byte. This holds for every analyser that enriches a verdict
  (`analyseCheck`, `analyseActivation`, `analyseException`, `analyseAny` and
  the rest built the same way); the verdict itself (`origin`, `code`,
  `message`, `response`) is kept.
- **Not changed.** On the client's normal path a `400` activation carries no
  inactive-list facts, so `stillInactive` is `[]`: adt-clients reads
  `GET /activation/inactiveobjects` only after a 2xx activation. The analyser
  fills `stillInactive` only when the caller passes `context.activation`.
  Text after the root element, which the parser drops, is not looked for: the
  document is read as its one element (SAP does not send such text). A
  namespace URI written with character references (`checkru&#110;`) is not
  resolved and does not match (SAP does not send it either).

## [0.23.2] - 2026-11-18

Released with `@mcp-abap-adt/adt-clients` 45.5.3 (fr0ster/mcp-abap-adt#351).

### Fixed

- **An activation message states where it stands; its ordinal is no longer
  read as a line.** `readActivationRefusal` (and with it `analyseActivation`
  and `analyseAny`) read a checklist `msg`'s `line` attribute as the message's
  line. Measured on SAP_BASIS 751 (fr0ster/mcp-abap-adt#351, its comment of
  2026-11-18), that attribute is the message's ordinal — 1, 2, 3… — and the
  position is only in `href`'s fragment, `#start=<line>,<col>[;end=<line>,<col>]`.
  The reading also dropped `href` and `objDescr`. Each `AdtMessage` now
  carries, where SAP states them, `object` (from `objDescr`), `uri` (the
  `href` without its fragment), `position: { line, column, end?: { line,
  column } }` (from the fragment; lines from 1, columns from 0, `end`
  exclusive), `code`, and `line` (deprecated: `String(position.line)`).
  An `href` with no fragment, or with one whose `start` does not read, gives the `uri`
  alone; an `end` that does not read is dropped and the start kept; an empty
  `href` gives neither. The fragment
  is read by plain string code, shared with `readObjectOutline`.
- **`readCheckRunRefusal` (`analyseCheck`) reads the same reference** from a
  `chkrun:checkMessage`'s `uri`, which it dropped: `uri` and `position`, as
  above.

### Changed

- **`AdtMessage.line` carries the real source line, and is deprecated.** It
  held a checklist `msg`'s ordinal; it is now `String(position.line)` — still
  a string, as published — and absent when the message has no position. Use
  `position.line`. Added: `AdtMessage.position`, `object`, and the exported
  types `AdtSourcePosition`, `AdtSourcePoint`.

## [0.23.1] - 2026-11-16

Released with `@mcp-abap-adt/adt-clients` 45.5.2 (fr0ster/mcp-abap-adt#360,
fr0ster/mcp-abap-adt-clients#314).

### Fixed

- **`analyseActivation` / `readActivationRefusal`: a checklist with no
  `activationExecuted` and only `W`/`I`/`S` messages is judged by the
  inactive list**, as the silent checklist is. SAP_BASIS 7.52 answered such a
  checklist (one `W`) for a program it activated, and the reading refused it
  ("Activation did not run and SAP attached no error"). SAP sets the verdict
  attributes only once its activation run starts, so their absence says
  nothing either way. Now: a named object still listed is not activated, with
  `stillInactive` and SAP's messages after the sentence; none listed is
  activated, the messages in the answer's document; no list, or one that
  cannot be read, is not decided — a failure. A checklist with no
  `activationExecuted` and no message, or with any other message (`E`, `A`,
  `X`, a letter not known), is refused as before. Every other row is
  unchanged: every recorded activation answer (the corpus and the onprem 816
  and cloud bodies recorded for the issue) is judged exactly as by 0.23.0.
- **`stillInactiveAmong` compares percent escapes without regard to case.**
  adt-clients names a namespaced object `%2Fabc%2Fzp` (encodeURIComponent);
  ADT writes `%2fabc%2fzp` (recorded in the 7.40 quick search); RFC 3986
  makes them one address. The exact match read such an object, still on the
  inactive list, as activated — after the silent checklist and in the new row
  alike. Only a `%` with two hex digits is compared this way; nothing else in
  an address changes.

## [0.23.0] - 2026-11-12

Released with `@mcp-abap-adt/adt-clients` 45.5.0.

### Changed

- **On `@mcp-abap-adt/interfaces-adt-connection` `^5.0.0`** (was `^4.2.0`;
  `IAbapConnection.makeAdtRequest` takes no type parameter) and
  `@mcp-abap-adt/interfaces-adt` `^27.4.0` (was `^27.3.0`), the ranges
  adt-clients 45.5.0 declares, so a consumer installs one copy of each. The
  strategies read `IAdtWireResponse`, whose shape does not change; no
  reading or verdict changes.

## [0.22.3] - 2026-11-12

Released with `@mcp-abap-adt/adt-clients` 45.4.0.

### Added

- **A refusal read from a marked answer carries `sessionLost`.** The
  failures this package builds from a document on a successful answer — every
  `analyser` reading (`asFailure`) and `analyseUnitTestStart`'s missing run
  id — copy the answer's `sessionLost` (the connection marked it with the SAP
  session replaced; `@mcp-abap-adt/interfaces-adt-connection` 4.2.0), and
  only when it is there. A verdict the library reached first is enriched by
  spreading, as before, so its `sessionError` and `sessionLost` come through.

### Changed

- **On `@mcp-abap-adt/interfaces-adt` `^27.3.0`** (was `^27.2.0`) and
  **`@mcp-abap-adt/interfaces-adt-connection` `^4.2.0`** (was `^4.1.0`).

## [0.22.2] - 2026-11-11

Released with `@mcp-abap-adt/adt-clients` 45.2.0.

### Changed

- **On `fast-xml-parser` `^5.12.0`** (was `^5.9.3`), past
  GHSA-474x-hrwr-fgx4 (5.11.2 and earlier), the range adt-clients 45.2.0
  declares. The parser's changes touch only `captureMetaData` and
  `stopNodes`, which this package does not use; no reading changes.

## [0.22.1] - 2026-11-11

### Changed

- **On `@mcp-abap-adt/interfaces-adt` `^27.1.0`** (was `^27.0.0`), the range
  adt-clients 45.1.0 declares, so a consumer installs one copy of it: two
  copies are two types to TypeScript. No reading changes.

## [0.22.0] - 2026-11-09

Released with `@mcp-abap-adt/adt-clients` 45.0.0 (fr0ster/mcp-abap-adt#351).

### Changed

- **`analyseActivation` is stricter**: an activation that SAP answered
  without activating is now a failure. It answers `IAdtActivationFailure`
  (`IAnalyse<IAdtActivationFailure>`), whose `stillInactive` lists what SAP
  named as still inactive. Newly failures:
  - `ioc:inactiveObjects` — not activated, every listed object in
    `stillInactive` (a transport's reference is not read). Measured on
    SAP_BASIS 751 and S/4HANA 2025: the objects stayed inactive;
  - any answer that is neither a checklist, an inactive-objects list nor
    empty, or a document that is not well-formed — "the answer does not state
    the activation";
  - `chkl:messages` with `activationExecuted="false"` and no message, when
    the inactive list read after it still names an object the activation
    named (by `uri` or `parentUri`), or when no list is handed beside it (the
    outcome could not be decided). With the list and none of the named
    objects on it, it stays "nothing to activate". The list arrives as the
    third parameter of `IAnalyse`, `context.activation`
    (`@mcp-abap-adt/interfaces-adt` 27.0.0); adt-clients 45.0.0 reads it.
  An empty `200` is activated, whatever `preauditRequested` was. A `msg` of
  type `E` stays a refusal.
- `readActivationRefusal(document, activation?)` answers the same table
  (`AdtActivationRefusal | null`). `readAdtRefusal(document, activation?)`
  dispatches an activation's checklist only — an inactive-objects list, an
  empty or another document is no form it reads, as before — and hands it the
  facts; `analyseAny` passes `context.activation` on, so it judges a silent
  checklist as `analyseActivation` does.
- **On `@mcp-abap-adt/interfaces-adt` `^27.0.0`** (was `^26.0.0`).

### Added

- `stillInactiveAmong(named, inactiveObjects)`: the entries of an
  inactive-objects answer — `ioc:inactiveObjects` or the flat
  `adtcore:objectReferences` of 7.40 — whose `uri` or `parentUri` is named;
  the transport-only entry never counts; `null` for an answer that is no
  `2xx` list. `analyseActivation` uses it, and a consumer of the
  `/activation/runs` sequence calls it after a silent results checklist with
  the run's references and the list it read.
- `utilDiscoveryCollections` (the `discovery` slot): the path of every
  `app:collection/@href` of the discovery document, as a set; an absolute
  `href` is skipped; an answer that is no `app:service` document is the empty
  set. `ACTIVATION_RUNS_COLLECTION` (`/sap/bc/adt/activation/runs`) is the
  exact path to ask `has()` about before choosing between
  `activateObjectsGroup` and `activateObjects`.
- Types `IAdtActivationFailure`, `IAdtStillInactive`,
  `AdtActivationRefusal`, `AdtActivationFacts`.

## [0.21.0] - 2026-11-09

Released with `@mcp-abap-adt/adt-clients` 44.0.0.

### Changed

- **On `@mcp-abap-adt/interfaces-adt-connection` `^4.0.0`** (was `^3.0.0`),
  the range adt-clients 44 declares: v3 is no longer accepted. The plan
  widened it to `^3.0.0 || ^4.0.0`; the owner chose the identical range so one
  copy of the contract is installed. No strategy reads `getBaseUrl()`, and no
  reading or verdict changes.

## [0.20.0] - 2026-11-05

Released with `@mcp-abap-adt/adt-clients` 43.1.0, whose element-info members
this reads.

### Added

- `readStructureElementInfo(xml)` and its strategy `structureElementInfo`:
  what adt-clients' `getStructureElementInfo` answers, read — the structure's
  code, name, URI and short text; every component in document order (its
  code, name, URI, short text, `includeName`, `partOfInclude`,
  `includeLevel`, `dataElement`, `dataType`, `length`, `decimals`, `isKey`
  and every property entry as written); `includes`, the components that name
  a structure (each `.include` and `.append`); and the package.
- `readServiceDefinitionElementInfo(xml)` and its strategy
  `serviceDefinitionElementInfo`: what `getServiceDefinitionElementInfo`
  answers, read — the definition's code, name, URI and short text, its
  exposed entities in document order (code, name, URI, `alias`, short text),
  its links (an extension's) and the package.
- An answer naming nothing (an unknown name) or an empty document reads as no
  name and no components or entities. Tested against the answers recorded on
  premise and on ABAP cloud (`answers/read-elementinfo-*`).

## [0.19.1] - 2026-11-05

### Changed

- **On `@mcp-abap-adt/interfaces-adt` `^26.0.0`** (was `^25.2.0`), the range
  adt-clients 43.0.1 declares, so a consumer installs one copy of it: two
  copies are two types to TypeScript (TS2883 with 0.19.0 beside
  interfaces-adt 26). No reading changes.

## [0.19.0] - 2026-11-04

Released with `@mcp-abap-adt/adt-clients` 43.0.0, whose `getObjectOutline`
this reads.

### Added

- `readObjectOutline(xml)` and its strategy `objectOutline`: what
  adt-clients' `getObjectOutline` answers (`<object uri>/objectstructure`),
  read into a tree — each element's code (`answeredObject`), name,
  visibility, level, `clif_name`, include, description, constant / read-only
  / final flags, its links (rel, source, fragment, and the `start` / `end`
  position a class's or interface's link names) and its children in document
  order. A document that is not an outline reads as no root. Tested against
  the outlines recorded on premise (`answers/read-outline-*`).

## [0.18.3] - 2026-11-03

### Changed

- `@mcp-abap-adt/interfaces-adt` `^25.2.0`, the range `adt-clients` 42.2.0
  declares (the two packages share their ranges). Nothing in this package
  changes.

## [0.18.2] - 2026-11-03

### Changed

- `@mcp-abap-adt/interfaces-adt` `^25.1.0`, the range `adt-clients` 42.1.0
  declares (the two packages share their ranges). Nothing in this package
  changes.

## [0.18.1] - 2026-11-02

### Changed

- `@mcp-abap-adt/interfaces-adt` `^25.0.2`, the range `adt-clients` 40.1.0
  declares (the two packages share their ranges). Nothing in this package
  changes.

## [0.18.0] - 2026-11-01

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^25.0.0`**, as `adt-clients` 40.0.0
  declares it (the shared-range rule). A 0.x minor because the range crosses
  a major of interfaces-adt. Nothing else in this package changed: no
  strategy and no exported type.

## [0.17.0] - 2026-10-30

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^24.0.1`**, as `adt-clients` 39.0.0
  declares it (the shared-range rule). Nothing else in this package changed:
  no strategy and no exported type.

## [0.16.0] - 2026-10-29

A breaking 0.x minor: every reading that takes a type code from an answer
answers it as an `IAdtAnsweredObject` of `@mcp-abap-adt/interfaces-adt`
(21.0.0 and later; this release depends on `^23.0.4`). Released with
adt-clients 38.0.0 and adt-clients-legacy 0.2.0.

### Changed (breaking)

- **A code read from an answer is looked up once against the ADT type
  tables.** A code a table names is `type: AdtTypeCode`; any other text — a
  code no table holds (`PROG/PS`, `CLAS/OM` are in the recorded answers) or
  one of a newer release — is `unknownType`, exactly as ADT sent it. The two
  are exclusive. The readings that do this:
  - `readSearchHits` / `utilSearchHits` (`adtcore:type`);
  - `readNodeStructure` and `utilNodeContents` (`OBJECT_TYPE` of a child type
    and of an object);
  - `utilInactiveObjects` (`adtcore:type`);
  - `utilWhereUsedReferences` (the object's `type`; packages are still
    skipped);
  - the trace readings' `callingProgram` / `calledProgram` (`adtcore:type`).
- The shapes they answer are type aliases over `IAdtAnsweredObject` now, not
  interfaces: `IAdtObjectHit`, `ISearchResult`, `IWhereUsedReference`,
  `IRepositoryObjectNode`, `IRepositoryNodeChild`, `ITraceProgramRef`.
  `IRepositoryObjectNode` and `IRepositoryNodeChild` carry `type` /
  `unknownType` where they carried `objectType: string`.
- `IInactiveObjectsResponse.objects` is `IInactiveObject[]`
  (`IAdtAnsweredObject & { name }`), no longer `IObjectReference[]`: an
  unknown code is no reference `activateObjectsGroup` takes.
- Depends on `@mcp-abap-adt/interfaces-adt` `^23.1.1` (was `^20.1.0`): the
  ADT type tables came with 21.0.0, 23.1.0 brought the ABAP Unit run
  registry, and 23.1.1 (the function group's source on 7.40) is the range
  adt-clients 38.0.0 and adt-clients-legacy 0.2.0 take, so the three install
  one copy.

### Added

- `answeredObject(text)`: the lookup the readings use, for a consumer reading
  a code from an answer itself.

### Fixed

- **Parsed answers are read as data, and a value now has its declared type.**
  Every reading that took a parsed document typed `any` reads it through one
  reader (`parsed.ts`), as data from outside the type system. Where the old
  reading handed back a value of another type than declared, the value now
  has its type:
  - feeds: text the XML parser turned into a number (`<id>123</id>`) reads as
    the string `'123'`; a call stack's and a source line's `number`, `line`
    and `errorLine` read as numbers (they came back as text such as `'42'`);
    an element where text is declared reads as `''`;
  - feature toggles: an optional text field that holds no text reads as
    `undefined`, and a `null` entry in a state list no longer throws.

  A consumer that relied on the old, mistyped values reads the declared type.
  The readings of refusals, versions and message classes answer as before.

### Documentation

- The examples in the comments of `abapGit`, `feeds` and `traces` construct
  with adt-clients 38.0.0's options: `AdtAbapGitClient.create(connection,
  { logger, results })`, `new FeedRepository(connection, { logger, results })`,
  `new Profiler(connection, { logger, results })`.

### Tests

- The literal scan of type codes (`typeCodeLiterals.test.ts`, the scan shared
  from adt-clients): a code literal in this package's source passes only where
  the compiler types it by the tables, and a code named in a comment or inside
  a longer string is a code of the tables or an allow-listed example of one
  that is not.

### Migration

- Switch on `type` for the codes you act on, and handle `unknownType` — it is
  what an older reading would have handed you as `type: string`.
- `objectType` of a repository node or child is `type` (or `unknownType`).
- To activate the inactive objects, keep those with a `type`, and name the
  function group of a function module or include — they are addressed under
  it, and the listing names no parent:
  `objects.flatMap((o) => (o.type === 'FUGR/FF' || o.type === 'FUGR/I' ? [{ name: o.name, type: o.type, parentName: groupOf(o) }] : o.type ? [{ name: o.name, type: o.type }] : []))`,
  where `groupOf` is the caller's (the group the module was created in).
- A type that extended `IAdtObjectHit` or `ISearchResult` with `interface …
  extends` intersects it instead: `type IMyHit = ISearchResult & { … }`.

### Security

Supply-chain hardening of this package's install (worms of the Shai-Hulud kind
spread through dependencies' install scripts and stolen tokens). Nothing
published changes: no code and no dependency range.

- **No dependency runs an install script.** `package.json` `allowScripts`
  denies the two with one, both Jest's: `@parcel/watcher` and `unrs-resolver`
  (each ships prebuilt binaries as optional dependencies). The package's own
  `.npmrc` — npm reads the project `.npmrc` of the directory it installs in,
  so the root's does not reach here — sets `strict-allow-scripts=true`. No
  release-age gate: it conflicts with the gating audit (a security fix
  younger than the gate could not be installed while the audit failed).
- **No `npx`**: `build` and `test` call `tsc` and `jest` directly. The
  repository's workflows install this package with
  `npm ci --ignore-scripts --prefix packages/adt-strategies` and gate on its
  `npm audit --audit-level=moderate`.
- Lockfile refreshed within ranges (ts-jest 29.4.15,
  strnum 2.5.1, …). `npm audit`: 0, `--omit=dev`: 0.

## [0.15.0] - 2026-10-21

### Added

- **`analyseObjectProperties`** (and its reading `readObjectPropertiesAbsence`): for `getUtils().getObjectProperties`, an answer that is no `opr:objectProperties` document holding `opr:object` — an empty body, a body that is not XML, another document such as a sign-in page — is refused `ADT_OBJECT_NOT_FOUND` ("The answer is not an object properties document"). A caller who reads such an answer otherwise passes its own `analyse`.

## [0.14.0] - 2026-10-21

### Changed

- `@mcp-abap-adt/interfaces-adt` is `^20.1.0`, the range `adt-clients` declares (it carries `IAdtObjectProperties`, which this package does not use).
- **`analyseMessageClassMessage` refuses an answer that is no message class document** — an empty body, a body that is not XML, another document — as `ADT_OBJECT_NOT_FOUND` ("Message <msgno>: the answer is not a message class document"). It let such an answer through: only a class document holding the message shows the message exists. The reading under it, `readMessageClassMessageAbsence(document, msgno)`, answers that refusal where it answered `null`. A caller who reads such an answer otherwise passes its own `analyse`.

## [0.13.0] - 2026-10-18

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^20.0.0`**, as `adt-clients` 36.0.0
  declares it (the shared-range rule). Nothing else in this package changed:
  no strategy and no exported type. The README's samples pass `headers` to the
  members that take it since `adt-clients` 36.0.0.

## [0.12.0] - 2026-10-15

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^18.0.0`**, as `adt-clients` 32.0.0
  declares it. Nothing else in this package changed.

## [0.11.0] - 2026-10-13

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^16.0.0` and
  `@mcp-abap-adt/interfaces-adt-connection` is `^3.0.0`**, as `adt-clients`
  31.0.0 declares them. They remove the per-request `signal`,
  `ADT_REQUEST_ERROR`, `IAdtClientOptions.signal` and `IAdtError.refusal`; no
  strategy here used them. Nothing else in this package changed.

## [0.10.2] - 2026-10-12

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^15.3.0`**, as `adt-clients` 30.0.0
  declares it. Nothing else in this package changed.

## [0.10.1] - 2026-10-12

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^15.1.0`**, as `adt-clients` 29.1.0
  declares it. Nothing else in this package changed.

## [0.10.0] - 2026-10-11

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^15.0.0`**, as `adt-clients` 29.0.0
  declares it. Nothing else in this package changed.

## [0.9.0] - 2026-10-11

### Added

- **`analyseDebuggerFreed`** — for `terminateDebugger`, where the debugger
  freeing its own session is the outcome asked for. SAP answers that with a
  plain ICF `500` when it worked; this answers as no failure a `500` served as
  `text/plain` or with an empty body, with no ADT exception document. Anything
  else - a `500` with an exception document or served as another type, any
  other status, a connection failure, a body that is not a string - is read as
  `analyseException` reads it. See `docs/usage/ERRATA.md` in
  `adt-clients`.

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^14.0.0`**, as `adt-clients` 28.0.0
  declares it — one copy of the contract. Nothing else in this package changed.

## [0.8.1] - 2026-10-10

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^13.2.0`**, as `adt-clients` 27.0.0
  declares it — one copy of the contract. Nothing in this package's code
  changed.

## [0.8.0] - 2026-10-10

### Added

- **`analyseDebuggeeEnd`** — for an ABAP debugger step or termination where the
  debuggee ending is the outcome asked for. SAP answers a step that lets the
  program finish with `500 AdiFailed` subtype `debuggeeEnded`, and
  `terminateDebuggee` on premise with `500` subtype `terminateDebuggee`; both
  are the request having worked. This answers them as no failure, the result
  being the document that names the subtype; every other refusal is read as
  `analyseException` reads it. Tested on recorded pairs (SAP_BASIS 758 and 816).
- **`readExceptionSubType`** — the subtype an `exc:exception` names, the reading
  underneath.

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^13.1.0` and
  `@mcp-abap-adt/interfaces-adt-connection` `^2.0.0`**, as `adt-clients`
  declares them — one copy of each contract.

## [0.7.0] - 2026-10-02

### Changed

- **`@mcp-abap-adt/interfaces-adt` is `^12.0.0`**, the same range
  `@mcp-abap-adt/adt-clients` declares. With `^11.0.0` here and `^12.0.0` there
  npm installed two copies of the contract, and TypeScript treats two copies as
  two different types. Nothing in this package's code changed. It does not use
  the ATC types that 12.0.0 extends, and it builds and passes against 12.0.0.
- **The package builds from its own install.** It inherited `typeRoots` from the
  repository root, which resolved to the root's `node_modules`. It now resolves
  to its own.

### Migration

- A consumer on `interfaces-adt` 11 moves to 12 together with this package. For
  every kind except ATC's, 12.0.0 changes nothing a consumer passes. ATC's
  `IAtcObjectRef` became a union, and a reference with one of the seven earlier
  kinds is unchanged.

## [0.6.0] - 2026-09-27

### Added

- **`analysePublicationLock`** — for the LOCK a service binding takes before
  it is published or unpublished. A `403` there means an editing session holds
  the binding: an open Eclipse editor keeps its lock after the job finishes,
  until the editor closes. The publication job does not need a lock of the
  caller's, and Eclipse itself posts the job after its own LOCK's `403`
  (measured). So a `403` is no failure: the lock comes back with no handle
  (`''`), and there is nothing to unlock. Every other refusal is read as
  `analyseException` reads it. A caller who wants the `403` to stop them passes
  `analyseException`, or a strategy of their own.

### Documentation

- **`ERRATA.md` ships in this package.** It is adt-clients' document of what SAP
  answers that it does not mean — the object tree with each branch's cases, then
  every case with its evidence — and it is the reason several strategies here
  exist. It is copied from `docs/usage/ERRATA.md` at pack time
  (`scripts/copy-errata.js`), never committed twice; its relative links point to
  the repository on GitHub. The README links it.

## [0.5.0] - 2026-09-26

Released together with `adt-clients` 23.0.0, which stopped applying any reading
or verdict of its own. Everything it used to apply is here now, by name — a
consumer on `adt-clients` 22.x who relied on a parsed default or a built-in
verdict passes the strategy below instead.
[MIGRATION-23.md](../adt-clients/docs/usage/MIGRATION-23.md) has the replacing code for
each.

### Added

- **The result axis.** Until now it had one member, `asItCame`. It gains every
  reading `adt-clients` applied as a default, each an `IResultStrategy` for one
  slot of that package's result sets:
  - transports — `transportTree`, `transportCreated`,
    `transportSearchConfigurations`, `transportObjectEntries`, with
    `ITransportTree` and its node types, `ICreatedTransport`,
    `ITransportObjectEntry`;
  - versions — `objectVersions`, `IObjectVersion` (was `ObjectVersion` in
    `adt-clients`);
  - unit tests — `unitTestRunId`, which reads the id from the header ADT puts
    it in;
  - feature toggles — `featureToggleRuntimeState`, `featureToggleCheckState`
    and their state types;
  - utilities — `utilSearchHits`, `utilNamedItems`, `utilNodeContents`,
    `utilInactiveObjects`, `utilActivationRunId`, `utilWhereUsedReferences`, the
    pure `readSearchHits`, `readNamedItems`, `readNodeStructure`, `extractRunId`,
    and the shapes (`ISearchResult`, `INamedItem`, `IWhereUsedListResult`, …).
    They read an SAP error document as an empty result instead of throwing:
    judging it is `analyse`'s;
  - abapGit — `abapGitRepos` (now with `repositoryId`, `pullLink` and `logLink`,
    which `unlink`, `pull` and `getErrorLog` take), `abapGitErrorLog`,
    `abapGitExternalRepo`. Text is read verbatim: the old parser in
    `adt-clients` turned the repository key `000001` into `1`;
  - ATC — `atcSystemCheckVariant`, `atcWorklistId`, `atcStartedRun`,
    `atcWaitingRun`, `atcRunStatus`;
  - profiler and trace scheduling — `profilerTraceEntries`, `profilerHitList`,
    `profilerStatements`, `profilerDbAccesses`, `compareRecordedAt`,
    `traceSchedulingTypes`, `traceSchedulingRequests`,
    `traceSchedulingProfilerId`;
  - feeds — `feedDescriptors`, `feedVariants`, `feedEntries`,
    `feedSystemMessages`, `feedGatewayErrors`, `feedGatewayErrorDetail`.
- **The verdicts `adt-clients` members applied on their own**, as error
  strategies: `analysePublication` (was `publicationRefusal`),
  `analyseCdsTestDoubles` (was `testDoublesVerdict`),
  `analyseMessageClassMessage(msgno)`, `analyseUnitTestStart` (was
  `startedRun`), `analyseUnsupportedStatus(statuses, what)` (was
  `validationUnsupported`/`validationUnavailable`, and the versions `404`/`406`
  throw). With the readings underneath: `readPublicationRefusal`,
  `readCdsTestDoublesRefusal`, `readMessageClassMessageAbsence`.
  `analyseDeletion` replaces `adt-clients`' `packageDeletionRefusal`, which
  `AdtPackage.delete` applied until now.
- **`@mcp-abap-adt/interfaces-adt-connection` `^1.0.0`** as a dependency, for
  `IAdtWireResponse`.

### Changed

- **BREAKING: `@mcp-abap-adt/interfaces-adt` `^11.0.0`** (was `^9.0.0`), to
  match `adt-clients` 23.0.0. The two are installed side by side and name the
  same contract types in one signature; a consumer holding 9 or 10 next to this
  gets two copies of `IAdtError`. Move both packages together.
- **`analyseDeletion` and `readDeletionRefusal` read every `del:message`**
  (#172). The reading took `object.message` as one element; with two messages
  fast-xml-parser gives an array, so the type and text read `undefined`, SAP's
  reason was replaced by the reference counts, and an `E` on a permitted object
  was missed. Measured on premise (BASIS 816): a service-binding check answering a `W` and an
  `E` came back as "0 strong and 0 weak external references". Now every
  message with text is kept, in order, each with its own severity, and the T100
  key and `msgv1..4` are read from the long-text link — the one part of a
  deletion message that does not change with the logon language. An object is
  refused when its verdict attribute is not `"true"` or any message SAP typed
  `E`; the counts stand in only when SAP said nothing. An untyped message does
  not overturn an explicit `"true"`: a DDLS delete answers `isDeleted="true"`
  with one `del:type=""` message, text `S::000`, and the object is gone —
  measured on premise (BASIS 816) and on the ABAP Cloud system. Read as an `E`, it turned every CDS source
  delete into a refusal.
- **`readCheckRunRefusal` reads every `checkReport`.** Several read as a check
  that never ran. Defensive: no several-object capture exists yet.

## 0.4.0 — 2026-09-24

### Changed

- **`@mcp-abap-adt/interfaces-adt@^9.0.0`** (was `^7.0.0`). Two majors, and this
  package was left behind when the rest of the family moved: `adt-clients` 22.0.0
  went to `^9.0.0`, this workspace did not, and 0.3.0 is on npm declaring `^7.0.0`.

  **A consumer installing 0.3.0 got a contract two majors old** — and if they also
  held `adt-clients` 22, two copies of it in one tree. Nothing this package imports
  changed name or shape across those majors (`IResultStrategy`, `IAdtResponse`,
  `IAdtError` and the reading shapes are untouched), which is why it compiled and
  why nothing complained.

  **How it hid.** The check for one copy per tree was
  `find node_modules -path "*@mcp-abap-adt/interfaces-*/package.json"`, which never
  looks inside `packages/*/node_modules` — so it printed five paths and read as
  clean while `packages/adt-strategies/node_modules` held `interfaces-adt@7.0.0`.
  The SAP run for `adt-clients` 22.0.0 went through that tree. The check is
  `find . -path "*@mcp-abap-adt/interfaces-*/package.json" -not -path "./.git/*"`
  now, and it prints five packages, one copy each, all at the root.

## [0.3.0] - 2026-09-21

### Changed

- **Needs `@mcp-abap-adt/interfaces` 45.1.0**, up from 44.0.0 — the same move
  `adt-clients` makes in 20.0.0, and it has to happen together.

  These two packages are installed side by side: a caller passes a strategy
  from here into a member there, and both name `IAdtError` and `AdtNoFailure`
  in that signature. Left on 44.0.0 while the other moved to 45.1.0, npm
  installs both — `packages/adt-strategies/node_modules/@mcp-abap-adt/interfaces`
  at 44.0.0 beneath a 45.1.0 at the root — and a consumer gets two
  declarations of every contract. TypeScript reconciles that for interfaces
  and does not for enums, which is the whole reason the other package's
  release is a major.

  Caught in review of fr0ster/mcp-abap-adt-clients#151, where the root package
  had moved and this one had not.

## [0.2.0] - 2026-09-16

### Fixed

- **`analyseActivation` no longer calls a no-op activation a failure.** SAP
  answers `POST /activation` with `activationExecuted="false"`,
  `generationExecuted="true"` and **no `msg` at all** when the object is
  already active — it had nothing to do, and said so. `readActivationRefusal`
  treated the attribute as a refusal on its own, "whether or not SAP explained
  itself", so every such call answered an error.

  **The documentation in this repository already said otherwise**, which is
  the clearest statement of the defect: `docs/usage/CLIENT_API_REFERENCE.md`
  carries a probe table headed "`activationExecuted="false"` is **not** a
  failure signal"; `docs/usage/TROUBLESHOOTING.md` has a section called
  "Activation reports `activationExecuted="false"` and nothing is wrong";
  `docs/usage/OBJECT_LIFECYCLE.md` says the flag "on its own does not separate
  'nothing to do' from 'refused'"; and this package's own 0.1.0 entry below
  describes `analyseActivation` as "a `<msg type="E">` is the verdict,
  `activationExecuted="false"` is not". The implementation was the only place
  that disagreed.

  Measured again before changing it, on the ABAP Cloud system (2026-09-16), three
  ways, all answering the identical document: activating a class a second time
  straight after an activation that answered `activationExecuted="true"`;
  activating a function group straight after creating one, because a function
  group is created active (`adtcore:version="active"` before anything is
  activated); and both of those through a consumer's tools, which is how it
  surfaced — two integration suites failing on objects that were never in
  trouble. The reading that the request was accepted and is still running is
  ruled out by the contrast: when SAP does have work it answers
  `activationExecuted="true"` in the same request.

  The verdict now reads: a `msg` of type `E` refuses, whatever the attribute
  says; `activationExecuted="false"` with any message refuses and quotes it;
  `activationExecuted="false"` with none is a no-op and answers
  `ADT_NO_FAILURE`.

  **The attribute is read as three states, not as a boolean.** Absent is not
  `false`. A checklist carrying no `activationExecuted` at all has told us
  nothing, and the measurement above is of SAP writing `false` — never of SAP
  writing nothing. Such a document still refuses: with the messages it
  carried, or, when it carried none either, with a sentence saying so. That
  last case is the one place this reading composes a sentence instead of
  quoting one, and what it composes is a statement about the document rather
  than a verdict about the object.

  `messages` is still never empty on a refusal, and the invented sentence it
  used to be filled with — "SAP reported activationExecuted=false and gave no
  reason" — is gone from the case it was wrong for. It was announcing a
  failure for an object that was simply already active; that document now
  answers `null`, and every message on a refusal built from a document that
  said something is one read out of it.

### Added

- **`activation-nothing-to-activate` in the corpus** — the third activation
  document, and the only one that can show this. The two that were there both
  agree with the old reading (one carries an `E`, the other reports
  `activationExecuted="true"`), which is how it survived. Captured with the
  same collector as the rest, from the consumer repository's run, and copied
  here per `corpus/README.md`'s "it exists in two places, on purpose".

## [0.1.0] - 2026-09-12

First release. The defaults `adt-clients` refuses to ship.

`adt-clients` 19.0.0 removed every error strategy, and that was right: whether
an answer is a failure depends on which object types you touch and what you were
doing. It left a gap for anyone who has no opinion yet, and this fills it — with
an opinion, derived from recorded answers rather than from taste.

### Added — the error axis

Seven strategies, one per document form ADT uses to say no:

| strategy | the form |
|---|---|
| `analyseActivation` | `<chkl:messages>`; a `<msg type="E">` is the verdict, `activationExecuted="false"` is not |
| `analyseCheck` | `<chkrun:checkRunReports>`; the status first, then the messages |
| `analyseDeletion` | `del:isDeleted` and `del:isDeletable`, both attributes on a `200` |
| `analyseValidation` | name admissibility; two families answer with a body, three with the status |
| `analyseUnitTest` | `aunit:runResult`; alerts on the method that failed |
| `analyseException` | `<exc:exception>`, wherever it arrives |
| `analyseAny` | dispatches on the root element when the form is not known |

Each answers an `IAdtMessageFailure`: the contract's `IAdtError` plus every
message in the document, normalised. SAP spells severity three ways and keeps a
T100 key in exactly one of the forms; the reading flattens that.

The seven readings underneath are exported too — `readActivationRefusal` and its
siblings, pure functions over a document — along with `isIndeterminateWalkAnswer`
and `rawOf`.

### Added — the result axis, which has one member

`asItCame`: the answer unchanged, XML or ABAP text alike. Shaping a result is
the consumer's decision and has no defensible default; the absence of shaping is
the only one.

### Why one rule would not do

Ten recorded refusals arrive inside a `2xx`, seven arrive as a status. The
sharpest case is one question asked of one endpoint family — is this name taken?
— answered `400` with an exception document for a class, a domain and a table,
and `200` with `<SEVERITY>ERROR</SEVERITY>` for a DDL source and a function
group. A rule keyed on the status reports a taken DDL name as free.

### How the defaults are justified

Every strategy is tested against the recorded refusal it came from **and** the
recorded success it must be told apart from, because on most of these endpoints
the two share a status. 80 tests, no SAP system: `corpus/adt/` is the fixture.

The method found three defects during review that a unit test on one side of a
seam cannot: a request trace read from `config` where `adt-clients` writes
`request`, a group deletion of two objects read as a refusal because the answer
was taken as a single element, and an activation refusal whose message list
could be empty against a type that promised otherwise.

### Published

On npm as `@mcp-abap-adt/adt-strategies@0.1.0`. Verified from the registry
rather than from the working tree: installed into an empty project, seventeen
exports present, `analyseActivation` reads a refusal out of a checklist.

```bash
npm run publish:strategies   # this package
npm run release:publish      # every package the registry is missing
```
