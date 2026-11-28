# SAP ADT errata

What SAP ADT answers that a caller would misread, recorded once it has been
decided to belong here.

## The debuggee ending is answered as a failure

**Symptom.** Two requests of the ABAP debugger whose purpose is that the
debuggee stops existing answer as if they had failed:

- a step that lets the program run to its end — `stepContinue`, or any step
  past the last statement — answers `500 AdiFailed`, subtype `debuggeeEnded`
  (`SY/530`);
- `terminateDebuggee` answers `500 AdiFailed`, subtype `terminateDebuggee`
  (`SY/530`), on premise; on SAP BTP ABAP Environment it answers `200`.

**What actually happened.** The request worked. After either answer the
program's run returns (with its output after `debuggeeEnded`, with an error
after a termination), and the next request on the debug session answers
`noSessionAttached`. Measured on premise, SAP_BASIS 758
(`corpus/adt/debugger/debugger-run-to-line--08-stepcontinue`) and 816
(`corpus/adt/debugger/debugger-terminate--01-terminate-debuggee`), and on the cloud,
2026-10-08/10.

**Why the library has a strategy for it.** `analyseDebuggeeEnd` from
`@mcp-abap-adt/adt-strategies` (0.8.0), passed to a debugger step or to the
termination, answers those two subtypes as no failure; the result is
the document that names the subtype, so the caller still sees that the
debuggee is gone. Every other refusal stays a refusal — including
`noSessionAttached` on a request sent after the end. A caller who wants the end
of the program to stop them passes `analyseException` instead.

## The debugger freeing its session is answered as an ICF 500

**Symptom.** `POST /sap/bc/adt/debugger?method=terminateDebugger` answers a
plain ICF `500 Internal Server Error`, served as `text/plain` or with an empty
body, with no ADT exception document (no `exc:exception`, no type, no message).

**What actually happened.** The request worked. The server frees the
debugger's own ABAP session, the program runs on and returns its output, and
the next request on that session answers `400` "Session no longer exists". The
`500` is the session being freed under the request that asked for it, not a
refusal. Measured on premise (2026-10-11), BASIS 816; the server code that
handles the method (BASIS 816, read 2026-10-11) releases the debugger's session
inside the request, and nothing in it writes an ADT answer after that.
`@mcp-abap-adt/connection` 22.0.1 and later reads that `400` as the session
gone: the stack read then fails with `sessionError: 'ADT_SESSION_REPLACED'`
and no response, and that connection instance is spent (on premise,
2026-11-28, connection 25.2.0: the read came back with no status and the
connection's "The SAP session no longer exists" words).

**Why the library has a strategy for it.** `analyseDebuggerFreed` from
`@mcp-abap-adt/adt-strategies` (0.9.0), passed to `terminateDebugger`, answers
a `500` served as `text/plain` or with an empty body, with no ADT exception
document, as no failure. A `500` with an exception document or served as
another type, any other status, a connection failure and a body that is not a
string are read as `analyseException` reads them. A caller who wants that `500` to stop them
passes `analyseException` instead.

## A service binding is locked to publish it

**Symptom.** `_action=LOCK` on a service binding, before a publish or an
unpublish, answers `403 ExceptionResourceNoAccess`, *"User … is currently
editing"*.

**What Eclipse does.** It meets the same `403` on its own LOCK and publishes
anyway:

- Eclipse ADT 3.60.3 against the ABAP Cloud system, 2026-09-05: `LOCK` → `200` on its
  *"stateful, enqueue"* session; `POST …/odatav4/publishjobs` → `200`,
  stateless; `UNLOCK` → `200` only on *"Closing editor"*; a second `LOCK` before
  the unpublish → `403` while the first was still held.
- Eclipse against a cloud system, 2026-09-27: after a publish its editor kept
  the lock (a `LOCK` from another session → `403`); the unpublish that followed
  sent its own `LOCK` → `403` and then `POST …/unpublishjobs` → `200`.

**Why the library has a strategy for it.** `analysePublicationLock` from
`@mcp-abap-adt/adt-strategies`, passed to `getServiceBinding().lock()`, answers
that `403` as a lock without a handle (`''`): the publication goes ahead, and
there is nothing to unlock. Every other refusal stays a refusal. It treats any
`403` on that LOCK this way; what was observed is the one above, where an
editing session already held the binding. A caller who wants the `403` to stop
them passes `analyseException` instead.

## An activation answered with `200` that activated nothing

**Symptom.** `POST /sap/bc/adt/activation?method=activate&preauditRequested=…`
answers `200` without activating, in two documents that carry no message:

- **`ioc:inactiveObjects`**: the objects still inactive, no `chkl:messages`
  and no `msg`. Answered to `preauditRequested=true`: on SAP_BASIS 751 for a
  class in `$TMP` (fr0ster/mcp-abap-adt#351, 2026-11-09), on S/4HANA 2025 for a
  function group's reference alone in a transportable package (2026-11-09).
  The objects stayed inactive in two reads of the inactive list ten seconds
  apart (S/4HANA 2025), so it is no activation still running.
- **`chkl:messages` with `activationExecuted="false"` and no message**: on
  S/4HANA 2025 the same function group's reference, sent again with
  `preauditRequested=false`, answered it and left the group inactive
  (2026-11-09). The identical document answers the re-activation of an object
  that is already active — on S/4HANA 2025 and on ABAP cloud (2026-09-16) —
  where nothing was inactive. The document alone cannot tell the two apart.
- **`chkl:messages` with no `activationExecuted` and warnings alone**: on
  SAP_BASIS 7.52 (fr0ster/mcp-abap-adt#360, from the report; not recorded
  here) a program's activation answered one `W` message with no verdict
  attribute, and the program was activated — its active source held the
  change and the inactive list did not name it. SAP's handler
  (`CL_SEU_ADT_RES_ACTIVATION`, read on onprem SAP_BASIS 816 and cloud) sets
  the verdict attributes only once its activation run starts, so their absence
  says nothing either way. Onprem 816 and cloud answer the same activation
  `activationExecuted="true"` with the `W` (measured 2026-11-16).

**What activates.** On SAP_BASIS 751 the same reference with
`preauditRequested=false` (`200`, empty body). On S/4HANA 2025 every reference
the `ioc:inactiveObjects` answer listed, as it listed them, with
`preauditRequested=false` (`200`, `activationExecuted="true"`). Sending that
next request is the caller's: the list may name objects the caller did not.

**An empty `200` is an activation.** Every empty answer recorded activated:
SAP_BASIS 7.40 SP04 to `preauditRequested=true` and `false` (the inactive list
and the active source both said so), SAP_BASIS 751 to `false`.

**Why the library has a strategy for it.** `analyseActivation` from
`@mcp-abap-adt/adt-strategies` (0.22.0) answers each of them:

| Answer (`2xx`) | Verdict |
|---|---|
| `chkl:messages`, `activationExecuted="true"`, no `E` | activated |
| `chkl:messages`, a `msg type="E"` | refused, with the messages |
| `chkl:messages`, `activationExecuted="false"`, no message | judged by the inactive list read after it: a named object still listed → not activated, with `stillInactive`; none → nothing to activate; no list → not decided, a failure |
| `chkl:messages`, no `activationExecuted`, only `W`/`I`/`S` messages (0.23.1) | judged by the inactive list read after it: a named object still listed → not activated, with `stillInactive` and SAP's messages; none → activated, the messages in the document; no list → not decided, a failure |
| `chkl:messages`, no `activationExecuted`, no message or any other message | refused |
| `ioc:inactiveObjects` | not activated, every listed object in `stillInactive` |
| empty | activated |
| any other document | not activated: the answer does not state the activation |

For the two checklists the inactive list decides (`readUnstatedActivation`
answers `silent` or `unstated`), the caller reads
`GET /sap/bc/adt/activation/inactiveobjects` after the answer and hands the
list to `analyseActivation` (`IAdtAnalyseContext`) with the uris the activation
named. Until adt-clients 48.0.0 every member that sends `POST /activation` read
it itself; since 49.0.0 it sends the activation alone (one member, one
endpoint, one request), and the client judges neither, the verdict is the
strategy's. After the checklist with no verdict, a read that fails leaves the
answer as it was and the refusal's response, if any, is the list; an entry
counts when its `uri` or `parentUri` is one the request named
(`stillInactiveAmong`). A caller who wants another verdict passes its own
`analyse`.

**`/activation/runs` is not on every system.** SAP_BASIS 751 and 7.40 SP04 do
not list it in their discovery, and a `POST` there answers `404` on 751.
S/4HANA 2025 and ABAP cloud list it. `utilDiscoveryCollections` reads the
discovery's collections, and the caller picks `activateObjectsGroup`
(`/activation/runs`) or `activateObjects` (`/activation`) by
`has(ACTIVATION_RUNS_COLLECTION)`.

## A task's number answers the task's own document

**Symptom.** `GET /sap/bc/adt/cts/transportrequests/{number}` for a task's
number answers a `tm:root` that holds a `tm:request` element — and that
element is the task's parent request, not the task. Read as a request
document, the answer names the parent's number, description, type and
status, and the task looks like its own request.

**What actually happened.** SAP answered the task. The root is marked
`tm:object_type="T"`; `tm:task` holds the task's header and its
`tm:abap_object` entries; `tm:request` holds only the parent's header, no
task and no `tm:all_objects`. A request's number answers
`tm:object_type="R"`, the request in `tm:request` with its tasks under it
and the aggregate `tm:all_objects`. SAP code:
`CL_CTS_ADT_TM_RES_REQUEST_CONT->fetch_request_data` →
`prepare_tm_root_for_task`, the same on premise and on the cloud. Recorded
on premise and on the cloud (a task each), 2026-11-22,
by the server team (fr0ster/mcp-abap-adt, GetTransport's fixtures).

**Why the library has a strategy for it.** `transportItem(number)` from
`@mcp-abap-adt/adt-strategies` (0.28.0) reads the document as the request or
the task it describes. Since 0.28.1 the number asked decides: the root's
`tm:task` or `tm:request` whose own number it is, the marker confirming
it; a document where none or both name it is refused, and so is an
unmarked task document asked for by its parent's number (SAP marks every
task document, so that case is defensive; until 0.28.1 it read as the
parent). `transportObjectEntries`
reads either document's entries per task, each once, and leaves out an
entry without `tm:name` or `tm:type`. The complete readings (0.28.2) keep
it: `transportObjectEntryList` answers `{ entries, incompleteEntries? }`,
and `transportItem`'s task item has `incompleteEntries`, the field the
entry lacks absent; a request's per-task `objectCount` counts it.

## A node SAP cannot load is answered as a tree line

**Symptom.** `POST /sap/bc/adt/repository/nodestructure` for a node answers
`200` and a `SEU_ADT_REPOSITORY_OBJ_NODE` with an empty `OBJECT_TYPE`,
`OBJECT_NAME` "Error loading node:" and an explanation in `TECH_NAME` — read
as an object, it is a nameless-typed row whose name is a message.

**What actually happened.** SAP could not load the node and put its message
`SEU_ADT 101` where the node's lines would be
(`CL_SEU_ADT_RES_REPO_STRUCTURE->create_tree_content`). Measured on premise,
2026-11-22, for a package's Views node (`VIEW/DV`), which comes from SAP's
stored package tree (`DWTREE`), by the server team (fr0ster/mcp-abap-adt,
the package walks).

**Why the library has a strategy for it.** `utilNodeContents` from
`@mcp-abap-adt/adt-strategies` (0.28.1) answers an entry with no
`OBJECT_TYPE` as `notLoaded`, with none of SAP's text, and keeps every
other node SAP lists — one without its name, technical name or URI in
`incompleteObjects`, the field it lacks absent.

## A trace document that lacks a field its reading requires

**Symptom.** None measured. The on-premise trace feed the reading was
transcribed from carries every field its result type requires, in each of its
sixty entries; the hit list, the statements, the database accesses, the two
catalogues, the stored requests and every cloud answer are not in the corpus,
so that SAP always sends these fields is not measured either.

**What the readings did.** Before `@mcp-abap-adt/adt-strategies` 0.29.0, a
field the answer did not carry read as `undefined` under a type that said
`string` or `number` (a trace entry's `id`, a row's `index`, a timing's
`time`, …), so a caller trusting the type met `undefined` where none was
declared.

**What they do now.** `profilerTraceEntries`, `profilerHitList`,
`profilerStatements`, `profilerDbAccesses`, `traceSchedulingTypes` and
`traceSchedulingRequests` throw `traces: <field> is missing` naming the field
(`traces: state.value is missing`, `traces: hitlist.index is missing`). The
throw surfaces from the member call as itself, as every reading's does.
A program reference's `name` and `uri` are optional (measured on premise for #333): SAP sends a reference with no ABAP source behind it — the "Runtime analysis" root, an object's creation, a call from the kernel — as an element with no `adtcore:name`, `adtcore:uri` or `adtcore:type`, and the reading answers both absent. The fields kept required are on every row of the recorded hit list (11), statements (15) and DB accesses (2): a row's `index`, a statement's `id`, a timing's `time` and `percentage`.

## abapGit: what an answer says

Read from SAP's handler code (onprem `ZCL_ABAPGIT_RES_*`, cloud
`CL_ABAPGIT_RES_*`, 2026-11-21), not measured, unless a line says so. The
library judges none of them: each is an answer the caller reads.

- **A cloud `202` from `pullRepo` (R4) or `push` (R10) is accepted, not
  finished.** The handler schedules a background job and answers `202`
  (`RES_REPO_PULL->post` L253, `RES_REPO_PUSH->post` L100); a `409` means an
  action already runs. The run's state is in the repository list (`runStatus`,
  `appLogKey` of `listReposQuiet`).
- **A `202` from `pullRepoInDialog` (R5, `…/pull/v2`) is finished.** The
  handler runs the pull in the request and answers `202` after it
  (`RES_REPO_PULL_V1->post` L270–274).
- **A cloud pull imports inactive.** On SAP Cloud Platform the deserializer
  writes the inactive worklist instead of activating ("Object activation
  rejected in SAP Cloud Platform, ABAP Environment -> import inactive
  version(!)", `CL_ABAPGIT_OBJECTS` L1127–1133; Code). Measured 2026-11-22,
  `pullRepoInDialog` and a selective `pullRepo`: the run ends `S` "Pulled
  successfully", its log lists each object imported `S`, the inactive
  version holds the pulled source, the active one the previous, and
  `getFile` `local` answers the active one. Activating is the caller's. An
  onprem pull activates (measured: the active source changed).
- **A selection decides for every entry that still matches when the job runs,
  with two exceptions:** a remote-only add or update outside the package
  warnings is imported unselected, and a `delete_add` package warning is
  skipped even when selected. `getModifiedObjects` (R6) answers `deserialize_checks`' overwrite
  list without the repository's own package
  (`CL_ABAPGIT_RES_PULL_MOD_OBJS->get_all_modified_objects` L127–130), plus
  its package warnings: the objects whose TADIR package differs from their
  path's (L162–173; `CL_ABAPGIT_OBJECTS_CHECK=>warning_package_find`
  L257–295). The overwrite list holds every changed object; among them a
  remote-only update is action `2` (update), and the handler's overwrite case
  (a local change) is `3`
  (`CL_ABAPGIT_OBJECTS_CHECK=>warning_overwrite_find` L140–210); that the
  repository's `deserialize_checks` reaches it is Inference, and fits the live
  answer of `2` measured on 2026-11-23. The job recomputes both lists when it
  runs (`CL_ABAPGIT_BG_ACTION_PULL->execute` L113). It marks an entry `Y`
  when the selection holds its name and its action still matches: a selected
  deletion whose action changed gets `N`, and a `delete_add` package warning is
  always `N`; every other entry gets `N` (L123–152). Deletions run only for
  `Y` entries (`delete_unnecessary_objects` L39–72). An `N` package warning is
  left out whatever its state (`CL_ABAPGIT_OBJECTS->warning_package_adjust`
  L1858–1897); an `N` overwrite entry is left out only when it has a local
  state (`warning_overwrite_adjust` L1791; `warning_overwrite_find`
  L1833–1855, L1841–1844). So an unselected local change, remote deletion or
  other-package object, a selected entry whose action changed (unless it is now
  a remote-only add or update outside the package warnings), and a selected
  `delete_add` package warning keep their system state, and only a remote-only add or
  update that is not a package warning is imported whatever the selection (Code; that last case measured
  2026-11-22: an unselected interface changed only in the remote was
  imported). A skipped entry is logged `S`, "not imported; no import
  requested" (L308–313): the raw log names it, but its `S` status, and
  `getRunLog`'s facts, which carry no message text, do not tell it from one
  imported. `pullRepoInDialog` (R5) takes the same selective document and runs
  the job in the request (`CL_ABAPGIT_RES_REPO_PULL_V1->post` L244–247,
  L266–274).
- **A push's run log names no object** (measured on cloud 2026-11-22: one
  entry, type and name empty, status `S`, message type `I`); a pull's names
  each object it imported.
- **An onprem `200` from `pullRepo` says nothing about objects.** The handler
  runs the pull synchronously and never fills the result table it answers
  (`ZCL_ABAPGIT_RES_REPO_PULL->post` L60–171).
- **Onprem `pullRepo` ignores `branchName`.** The handler parses it and reads
  only the user, the password and the request; the pull runs on the branch
  already linked.
- **`switchBranch` with `create: false` on a branch that does not exist changes
  nothing and answers success** (R15, `ZCL_ABAPGIT_RES_REPO_SWITCH->post` L58).
  With `create: true` and no such branch it creates the branch in the remote.
- **A cloud `getStaging` answers `409` in plain text** while a pull or a push
  runs or waits (R9, `RES_REPO_STAGE->get` L164, L178).
- **`unlink`'s `transportRequest` sends a `corrNr` neither handler reads**
  (R3); it is kept as it was.
- **Onprem ignores `link`'s `folderLogic` silently.** Its transformation
  `ZABAPGIT_ST_REPO_POST` has no such field and skips unknown elements
  (`extensible="deep"`, L8); cloud's `ABAPGIT_ST_REPO_POST_V3` reads it
  (L20–24). The library sends it when given, on either system.
- **A selective pull with its lists in the wrong namespace selects nothing.**
  `ABAPGIT_ST_REPO_SELECTIVE_PULL` (cloud) reads `overwriteObjects`,
  `packageWarningObjects`, their `abapgitobjects` and `action` in R6's
  namespace `agitpullmodifiedobjects` (L5, L42, L55;
  `ABAPGIT_ST_PULL_MODIFIED_OBJS` L46, L52) and silently skips selection lists
  in any other namespace:
  `pullRepo`'s handler answers `202` on accepting the job, and the job then sets every
  entry to `'N'`, so nothing listed is pulled but remote-only adds and
  updates outside the package warnings (Code; see the selection entry above). The library writes
  them there; the two pull handlers pick the document by the exact
  `Content-Type` (a `; charset=…` suffix answers 400, `RES_REPO_PULL` L167–182).
- **A push needs all three stage lists.** `ABAPGIT_ST_REPO_STAGE` reads
  `unstaged_objects`, `staged_objects` and `ignored_objects` as literal
  elements, in that order (cloud L14, L25, L36; onprem the same); the library
  writes the first and the last empty.
- **A present, empty attribute under `tt:cond check="not-initial(…)"` fails
  a push** — measured on premise
  2026-11-22: a push whose new file carried `remoteState=""` answered 400,
  T100 `00`/`001` "Check of condition failed" (`CX_ST_COND_CHECK_FAIL`); the
  cloud push of the first live run was refused with a T100 message for the
  same document (key not recorded). **A selective pull's empty attribute under
  such a `tt:cond` is refused by the same rule from Code alone** (`SADT_OBJECT_REFERENCE` under
  `ABAPGIT_ST_PULL_MODIFIED_OBJS`), not measured. The transformations read every file attribute
  (`…ST_REPO_STAGE_OBJECT` onprem L41–54, cloud L76–90), the comment and the
  people (`…ST_REPO_STAGE` onprem L44–72, cloud L52–83) and the object
  reference's `uri`, `type` and `packageName` (`SADT_OBJECT_REFERENCE`
  L38–56) under `tt:cond check="not-initial(…)"`, and deserialization checks
  the value it read (Code). Staging answers such values — `remoteState` is
  empty for a file the remote does not hold, `packageName` may be empty
  (measured, both systems) — so the library writes an attribute under such a
  `tt:cond` only when it has a value. With that (measured 2026-11-22): `push` answered `200` on
  premise and `202` on cloud, whose job ended `S` "Pushed successfully"; the
  selective `pullRepo` (cloud only) answered `202`, its job ended `S` and
  imported the one selected interface of two changed on both sides; `pullRepoInDialog`
  (cloud) and `pullRepo` with `repo.v3` (on premise) answered `202` / `200`.
  The object reference's `name` is under `s-check`, which deserialization does
  not run, so the library always sends it, empty included
  (`src/clients/abapGit/xmlBuilder.ts`).
- **`getFile` of a file the repository does not hold answers `200` with an
  empty text** (R12): the handler reads the file table without checking that
  the file was found (onprem `ZCL_ABAPGIT_RES_REPO_FILES->get` L69, cloud
  L80; Code; measured on premise 2026-11-22).
- **`getFile` of the remote without a credential, on a private remote, is
  refused with a T100 key:** SAP reads the remote anonymously, the git host
  refuses, and the abapGit exception is answered `500` (onprem L84–87, cloud
  L97–100; Code). Measured 2026-11-22 on both systems: `500`, `00`/`001`.
- **Onprem `pullRepo` with a request that does not exist is refused before
  anything is pulled**, for a package that records changes
  (`ZCL_ABAPGIT_RES_REPO_PULL->validate_request_data` L210–219; Code; measured
  on premise 2026-11-22: `500`, `00`/`001`).
- **On the on-premise test system `checkRepo` (R11) cannot succeed.** Every
  call ends in the runtime error `SYNTAX_ERROR` in
  `ZCL_ABAPGIT_RES_REPO_CHECKS`, answered `500` as an HTML page with no T100
  key (measured 2026-11-22); the class's syntax check reports "No value was
  passed to the mandatory parameter IV_SERVICE" at L53, col. 22 — its
  `zcl_abapgit_http=>create_by_url( … )` call (Code). The installed abapGit
  and its ADT handler disagree; the request the library sends is not the
  cause. The member reduces that HTML answer to a structured failure whose facts are
  exactly `status` `500` — no T100 key, no git host status — with the fixed
  `refused` words. Those facts carry nothing more; the dump's name and line
  are not in them, so the live suite cannot tell this 500 from another 500
  with no T100 key and no git host status. It therefore asserts that exact shape only on the system
  where the fault was measured (`abapgit.check_repo_fault_system`, matched
  against `environment.default_master_system`), reported as observed —
  refused, 500, no T100, consistent with the SYNTAX_ERROR measured at L53 —
  and expects success everywhere else. The dump itself was observed only in
  the system's runtime-error list during diagnosis, never by the suite.
- **On premise a local `$` package works with abapGit end to end** (measured
  2026-11-22, `$ZAGL_…` in software component LOCAL, no request): `link`
  answered `200`, `push` `200` with the file in the remote, `pullRepo` `200`
  with the active source changed, `getFile` without a credential `500`
  `00`/`001`; after `unlink` the interface and the package were deleted
  (`isDeleted="true"`) and the package reads `404`. A Z package cannot take
  its place: LOCAL accepts only `TEST…` and `$…` packages (TR462), a Z
  package in HOME must record changes ("Change recording must be activated"),
  and an object deleted from a package that records changes keeps its
  directory entry until its request is released — the package then refuses
  its own delete, "Package contains 1 object", also after the entry is
  removed from the task (all measured 2026-11-22). The live suite's onprem
  run package is therefore `$ZAGL_<run>`.
- **Known leftover: package `ZAGL_756211AB`** on the on-premise test system,
  of the first live run (2026-11-22), transportable. Its interface was
  deleted, its repository unlinked and its branches removed; the deleted
  interface's directory entry keeps the package undeletable until request
  `E19K907111` is released. The owner decides about it; the suite's ledger
  no longer names it.
- **`getStatus` (R7) answers a fixed text**, `DEMO STATUS`
  (`RES_REPO_PULL->get` L139).
- **The success status of `checkRepo` (R11) and `switchBranch` (R15)** is the
  framework's default, set inside the handler's `CATCH` (Inference); it is not
  asserted until a live run measures it.
- **A key-addressed failure raised as an abapGit exception carries a T100
  key.** `CL_ADT_EXCEPTION_UTILITY`
  writes `T100KEY-ID` / `T100KEY-NO` for every exception that is a T100
  message (L94–97), and the abapGit exceptions are (Code, both systems); the new
  forms keep the response's HTTP status and, when present and well formed (a
  three-digit T100 number; an R11 `http_status` that parses as an integer),
  those and `gitHttpStatus`, as facts. Measured
  2026-11-22: `getFile` (both systems), `push` and `pullRepo` (on premise). A
  runtime error answered as an HTML `500` carries none, like the on-premise
  `checkRepo` `SYNTAX_ERROR` above: its only fact is `status`.


## A keyword documentation query with no hit answers 200

**Symptom.** `GET /sap/bc/adt/docu/abap/langu?query=<term>` for a term with
no hit answers `200`, `application/vnd.sap.adt.docu.v1+html`, a page titled
"Not found | ABAP Keyword Documentation" — not `404`. Measured on ABAP cloud
and on premise (S/4HANA 2025), 2026-11-28
(`corpus/adt/answers/read-keyword-documentation-no-hit-<release>--01-query`).

**What actually happened.** The search ran and found nothing; the page says
so in its title and text.

**What the library does.** `getKeywordDocumentation().query` answers the page
as a success, as SAP sent it. `docuPage` from `@mcp-abap-adt/adt-strategies`
reads its title; no reading or strategy here turns it into a failure — a
caller that wants "no hit" to be one decides it from the title.

## The topic form of the keyword documentation is in no discovery template

**Symptom.** The discovery lists `/sap/bc/adt/docu/abap/langu` with the
templates `{?format,language,uri,version}` and `{?format,language,query,version}`
(on 7.40 SP04 the first alone, without `version`). Every topic link the
documentation's own pages carry uses another form:
`adtcom:/sap/bc/adt/docu/abap/langu?sap-language=EN&version=<v>&style=&object=<topic>`.

**What actually happened.** The topic form answers `200` with the topic's
page on ABAP cloud and on premise (2026-11-28,
`read-keyword-documentation-topic-<release>`, `…-topic-link-<release>`), with
`language` or `sap-language` alike. The page without `version` differs from
the page with the link's `version` (measured for three topics on each kind),
so a link is followed only by sending its `version` as it carries it. On ABAP
cloud the links carry `version=5`, on premise `version=X`.

**What the library does.** `getKeywordDocumentation().topic` sends `object`,
and `language`, `version`, `format` when given, as given. It checks nothing
against the discovery.

## An unknown version of the keyword documentation answers an ICF 500

**Symptom.** `version=1` and `version=6` answer `500` with an ICF error page
("Application Server Error", "Invalid enumeration value"), no ADT exception
document; `2`, `3`, `4`, `5` and `X` answer `200`. Measured on ABAP cloud and
on premise, 2026-11-28 (`refusal-keyword-documentation-version-1-<release>`).
What any value selects is unverified.

**What the library does.** The `500` comes back through the call's `analyse`:
`analyseException` keeps the library's verdict ("Request failed with status
code 500") and the answer whole, the page included.

## An application log object name of 21 characters answers an ICF 500

**Symptom.** On ABAP cloud and on premise (2026-11-28), an absent application
log object name of 21 characters answered `500` with an ICF error page (on
cloud "Data was lost while copying a value"), for the object document and the
source alike; an absent name of 7 characters answered `404`
(`refusal-application-log-name-21-abap-cloud`,
`refusal-application-log-absent-abap-cloud`). The recorded typestructure gives
`APLO/TYP` an `OBJNAME_MAXLENGTH` of 20; that the length causes the `500` is
inferred, not verified.

**What the library does.** The name goes to SAP as given, through `seg()`, and
the `500` comes back through `analyse` as SAP sent it; nothing checks the name's
length.
