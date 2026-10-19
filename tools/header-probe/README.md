# Header discovery: the error corpus

`npm run header:discovery` asks a system for every answer it gives the ADT
endpoints, errors above all, and records what each error names as
acceptable: the system's header corpus. It is a developer tool for
collecting information: it is not run in CI, and it is not part of the npm
package (`tools/` is outside `src/`, so nothing here reaches `dist/`, and
`files` does not list it).

## Prepare

- `.env` in the repository root with the SAP connection (`SAP_URL`,
  `SAP_USERNAME`, `SAP_PASSWORD`, `SAP_CLIENT`), as the integration tests use.
- `src/__tests__/helpers/test-config.yaml` (`npm run test:init`): `environment.system`,
  and `default_package` and `default_transport`, where the clients run and
  phase 2 make their temporary objects and delete them again (a package
  object also takes `create_package`'s software component and transport
  layer). Without a package, every clients member runs on the probe name.

## Run

```bash
npm run header:discovery                     # the full run: the system's header corpus
npm run header:discovery -- --isolate ~/.config/mcp-abap-adt-clients/header-probe/<system>/header-corpus-<ts>.json
npm run header:discovery -- --out <dir>        # write there instead
npm run header:discovery -- --from discovery --headers corpus
npm run header:discovery -- --from discovery --headers none
npm run header:discovery -- --from discovery --headers bogus
npm run header:discovery -- --from clients --headers corpus
npm run header:discovery -- --from clients --headers none
npm run header:discovery -- --from clients --headers bogus
npm run header:discovery -- --from discovery --headers bogus --sequential
npm run header:discovery -- --summary <corpus.json> [<corpus.json> …]
npm run header:discovery -- --render <corpus.json> [<corpus.json> …]
```

`--isolate <corpus.json>[,<corpus.json>]` sends alone, from the start, every
call an earlier run's group split found poisoning envelopes (its `causes`; a
header corpus file stands for the corpora it lists); every other call is
batched and split as usual. Without it the run is unchanged.
Both `--from` and `--headers` are required. `--only <text>[,<text>]` keeps
the endpoints whose `handler.member` (clients) or href (discovery) contains one
of the texts. `--render` recomputes a saved
corpus's `needs` and writes its `.md` again, sending nothing. `--sequential` sends every
request on its own, without envelopes, to compare the time per request with a
batched run. `--summary` reads corpus files and writes
`summary-<timestamp>.md`: per endpoint, the Accept and Content-Type values the
system named in any of the runs; the header corpus — per endpoint, side by
side, what discovery (or the pair table) lists and what the 406s and 415s of
the none and bogus runs named; and, for each bogus run, what each endpoint
needs.

## The full run

`npm run header:discovery` with no flags gives the connected system's
header corpus, everything batched and poisoned envelopes split:

1. **The authorization check** (below).
2. **Phase 1:** discovery and clients, each in corpus, none and bogus
   (corpus for the comparison column). Discovery, and every clients member
   that takes no object, goes on the probe name; every clients member that
   works on an object goes on a **temporary object the run makes itself**
   (below). It settles every endpoint whose `needs` it can.
3. **Phase 2, for the clients endpoints still `unknown` only:**
   - **writes**: the write cycle (the former header probe, below), only for the
     object types whose write members are still unknown (the modern client's;
     the legacy client's writes stay as phase 1 left them). The bogus
     Content-Type goes first, then the bogus Accept; the ledger holds every
     object before its create is sent, locks are released in a `finally`, the
     state is read after every write probe.
   - **the update measurement**: per object type of the write cycle, on a
     temporary object of its own: the content read (the source, or the
     metadata), an update changing it sent with a bogus Accept under a lock
     released in a `finally`, the content read again. Applied = the two
     contents' hashes differ; the content itself is never kept or printed.
     The ledger holds the object before its create is sent, and the cleanup
     removes it. Every unlock's answer is checked, here and in the write
     cycle: a failed unlock keeps its handle in the ledger, the cleanup
     unlocks again before it deletes, and what stays locked is listed loudly
     as `MAY REMAIN (locked)`; the run then ends `failed` (exit 1). The header corpus lists, per type, the update's answer and
     whether it was applied.
   What phase 2 cannot settle stays `unknown`, with its reason.
4. **`header-corpus-<timestamp>.json` and `.md`**, one per run of the system:
   per endpoint (method, path pattern, `_action`) its `needs`, the Accept and
   Content-Type values the system named, the Content-Type discovery lists, the
   pair table's pairs, which phase settled it, and the evidence (status and
   raw text); the time of each phase and the total; the `needs` counts after
   phase 1 and after phase 2; the temporary objects made; where every member
   runs (the coverage table); what was left behind. The raw
   corpora of every run are written beside it as usual. Verdicts of several
   members on one endpoint merge: `checked` wins over `not checked`, which
   wins over `unknown`.

## What it does

1. **Authorization first.** The first request of a run is the connection's
   own logon, `connect()`: on-premise `GET /sap/bc/adt/core/discovery`
   (measured; on a 403 the connection itself repeats it, four requests in
   all), on cloud also the session request `/sap/bc/adt/core/http/sessions`
   (from the connection's code, not measured here). A 401 or 403 there —
   the connection's `AuthRefusedError` carrying the 401, or the 403 itself —
   prints `Oops: no authorization (<status>)` and exits with 2; nothing else
   is sent, and the report says `stopped: authorization (<status>, logon)`. Then `GET /sap/bc/adt/discovery`, watched
   like every other request: an authorization problem there (below) is the
   authorization stop, its report written and marked; any other non-2xx — a
   403 that is not an authorization refusal included — prints the status and
   stops with exit 1. Every later run's discovery read is watched the same
   way.

   **An authorization problem later in the run stops it:** a person fixes it,
   not the script. Every answer is watched — every request and envelope
   part, in every phase, the write cycle's included. On the first one no new
   probe goes out, the calls in flight finish, the cleanup and the unlocks
   run as on Ctrl-C, the files are still written (marked `stopped:
   authorization (…)`), and the run ends with `Oops: authorization problem
   (<status>, <SAP exception type or "CSRF">) at <endpoint> — fix it and run
   again`, exit code 2. Counted as an authorization problem:
   - any 401;
   - a 403 that is a CSRF refusal: `x-csrf-token: Required`, or a body that
     names the CSRF token;
   - a 403 whose SAP exception type is an authorization refusal — the types
     of `cx_adt_res_no_authority` / `cx_adt_res_no_authorization` (from
     reading SAP's code), recognised by a name holding `NoAuthority`,
     `NoAuthorization`, `NotAuthorized` or `Unauthorized`. The type decides
     first: such a 403 is a stop whatever its text says ("You are not
     authorized to modify this package" included);
   - for any other type, a 403 whose text holds `not authorized`, `not
     authorised`, `no authorization`, `no authorisation`, `authorization
     missing`, `missing authorization`, `keine Berechtigung` or `nicht
     berechtigt` — unless the text is about the object, not the user (`does
     not exist`, `not found`, `package`, `Paket`).
   So a 403 such as `ExceptionNoToggleAuthorization` "Package failure occurs
   for toggle …" or `ExceptionResourceNoAccess` "Tunnel is disabled in ATC
   settings." (both measured on the probe name) is an answer, not a stop. A
   stop in any phase ends that phase and the run, and the report is always
   written: exit 2 for an authorization stop, 130 for Ctrl-C. As on Ctrl-C,
   the member call in flight finishes whole — its own chain and its unlocks
   included — so that no lock is left held. The cleanup's own requests may still be refused:
   each such removal is `removed: unknown <status>`, listed under may remain.
   The connection's own CSRF token refresh is left as it is.
2. **The endpoints** (`--from`):
   - `discovery`: every `app:collection` of the document just read — its
     href, its `app:accept` types and its template links with their `type`
     are kept in the corpus. Each collection gets a `GET`, and a `POST` when
     it lists `app:accept`. Not sent, each listed as `skipped: <reason>`: the
     debugger collections (they attach to or wait for another session), a
     `POST` that switches a trace on or schedules one, and the reentrance
     ticket (its answer is a logon ticket, a secret).
   - `clients`: every member of every handler the clients hand out —
     `AdtClient`, `AdtClientLegacy` (labelled `legacy get…()`),
     `AdtRuntimeClient`, `AdtExecutor`, `AdtExecutorLegacy` and
     `AdtAbapGitClient`, read from the clients themselves, not from a list.
     Each member is first called against a connection that sends nothing and
     answers every request with an empty 200; the requests it builds are its
     endpoints (path with the probe name as `{name}`, method, `_action`).
     Every argument names the fixed probe object `Z_HPEC_PROBE` (package
     `Z_HPEC_NO_PACKAGE`), which no system has. A member that cannot be
     recorded or sent that way is a `skipped: <reason>` row: it needs a URI
     an earlier answer handed out, the server assigns its key, it sends a
     `LOCK`, it polls, the debuggers need a live session, …; in corpus mode also
     every long-poll endpoint (`LONG_POLL_ENDPOINTS` in `corpus.ts`, below). A method that
     answers no promise is a helper and is listed under `notMembers`.
3. **The headers** (`--headers`). A request without a body gets no
   Content-Type in any mode; in corpus mode the pair's value is recorded as
   `not sent: no body`.
   - `corpus`: the prepared pair. Discovery: `app:accept` is the type of the
     request body, so it is a Content-Type only, sent on a request with a
     body (one row per type); discovery names no Accept, so none is sent and
     the row says `accept: not in discovery` (measured 2026-10-18: a `POST`
     sent with the listed type as Accept as well was refused 406, naming a
     different, result type). Members: `pairs.ts` (the legacy client's rows
     from MIGRATION-36 as well).
   - `none`: no Accept and no Content-Type. In an envelope part the headers
     are left out and the part carries neither. On a request of its own the
     connection adds its default Accept unless the header is given as
     `undefined` (measured: missing key → default, `''` → an empty
     `Accept:`, `undefined` → none), and it always adds a Content-Type to a
     request with a body (`text/plain; charset=utf-8`); such a row is marked
     `defaults-not-removable`, the others `none on the wire`.
   - `bogus`: one header per request, so a 406 or a 415 is attributable to
     one header. First request: Accept `application/x-header-probe`,
     Content-Type as in corpus; second request, only with a body:
     Content-Type `application/x-header-probe`, Accept as in corpus (none,
     for discovery).
4. **Writes never create on purpose.** Every `POST`, `PUT` and `DELETE` goes
   to the probe name with a fake body: a minimal document of the corpus type,
   or a fixed text. Before every write is sent, the probe name it may create
   goes into the ledger (once per object), whatever follows — an interrupt
   before the read, a read that fails or says nothing; the `finally` sends
   each entry's deletion unless a read says 404, and lists loudly what still
   reads as an object afterwards. Where the address never reads as an
   object (a collection that answers 400/405/500 to `GET <href>/<name>`), the
   removal says `unconfirmed: …` instead. After every write the probe name is read too, and a write
   that created it is listed loudly. A `LOCK` that a member still answered
   2xx is released the same way. No locks are taken.
5. **Batch.** Everything goes in envelopes of 25 probes through
   `AdtBatchConnection` — the members themselves in clients mode,
   `makeAdtRequest` in discovery mode — each write followed by its read in the
   same envelope. A member whose call is a chain of requests runs on its own
   (`sequential: a chain of …`). An envelope that got no answer (a transport
   failure) is neither split nor resent — whether the server ran any of it
   is unknown —, and its parts say `envelope failed: <reason>`. Each envelope's part count, bytes and wall time from send to
   answer are recorded with `performance.now()`, and each row carries its
   envelope's id and ms per part; a request sent on its own carries its wall
   time. There is no timer and no timeout of the script's own. Ctrl-C stops
   new requests (asked before each envelope and request),
   the one in flight finishes, and the `finally` cleanup runs.

### knownWorking

Where SAP's 406 names nothing (no T100 044 and no list — the generic 037,
"The message content is not acceptable", above all), the header corpus says which
Accept works from what the client sends today: `knownWorking` lists, per
endpoint, every corpus-mode answer — `<member>: Accept <what went on the
wire> → <status>`, marked `(works)` on a 2xx — from phase 1 (the probe name)
on the probe name and on the temporary objects. `workingAccept` keeps the Accept values that got a 2xx. The
pair table (`pairs.ts`) has no row for a member that takes no `headers` —
most reads —, so its column is empty there by design.

### Endpoint existence

Beside `needs`, every endpoint gets `exists: yes | no | unknown`, merged over
every answer of every run:

| exists | from |
|---|---|
| `no` | the router found no route (a 404 with no SAP exception, "No suitable resource found"), the ICF service is not there (a 404 "Service cannot be reached"), or the method is not implemented (a 405, for that method) |
| `yes` | any answer from the resource itself: a 2xx, 400, 406, 415, 409, a 404 the resource raised (`ExceptionResourceNotFound`: the object is missing, the endpoint is there), … — one such answer is enough |
| `unknown` | only what comes before the resource or says nothing of it: 401, an authorization 403, a 500, no answer, a skipped row |

Nothing is dropped: every answer stays in the corpus; `exists` only reads
them. `exists`, and `needs` where it applies, take the answers of every phase:
phase 1 (the probe name and the temporary objects), the write cycle and the update
measurement (whose bogus Accept is evidence for the update's Accept).

## Members on temporary objects

A member that works on an object runs on a real one: the run makes it, in
the configured package (`default_package`, `default_transport`), runs the
member on it in the mode's headers, and deletes it. This is the clients
run's normal path, in every mode, each mode with its own objects
(`objectRun.ts`).

- **Where a member runs** (`coverageOf`): every member of an object's
  handler (`OBJECT_OF_HANDLER`; the utilities that read a table or an
  include by name, `OBJECT_OF_MEMBER`) on a temporary object of its type —
  but `create`, which makes its own object from the probe name and removes
  it, and `validate`, which asks whether a new name is free. What cannot be
  made and removed cleanly is `not coverable` (`NOT_COVERABLE`, with the
  reason: transport requests, ATC results, traces, abapGit repositories,
  application logs, runtime dumps, the debuggers, feature toggles, BAdI
  implementations, publishing a service binding); those, and every member
  that takes no object, keep the probe name. The header corpus lists every
  member with where it runs (`## Coverage`), and the objects made.
- **The objects** (`OBJECT_SPECS`, `TEMPORARY_SPECS` in `objects.ts`): made
  with the known pairs — create, the source written under a lock, activated
  (an inactive one where activation needs more than the probe makes) —
  their parent first (a function module's group, a CDS entity for a service
  definition, an access control, a metadata extension, a behavior
  definition's root entity, a scalar function for its implementation, an
  extensible structure for an append). What an object's members read is made
  too: message `001` of a message class, a local test class include. A type
  that cannot be made (its create refused) leaves its members skipped with
  the answer that refused it.
- **The order, per object:** the reads, in envelopes; a LOCK with the known
  pair, the writes one by one with its real handle — each read back after,
  never resent —, the UNLOCK; the lock members (a granted lock released; an
  unlock given a real handle); the deletes last, each on the object, made
  again first if an earlier delete took it. A classic LOCK checks the Accept
  after it took the lock (from SAP's code), so a refused lock may hold it:
  after every LOCK member, whatever it answered, a LOCK with the known pair
  and an UNLOCK free the object.
- **Cleanup:** every object is in the ledger before its create is sent; the
  cleanup in a `finally` deletes what is left, newest first (an object before
  its parent), and proves each removal by a read that answers 404. A
  temporary object that may remain, or an unlock that failed, ends the run
  `failed` (exit 1), listed loudly.

### workingContentType

Beside `workingAccept`, the header corpus records per endpoint the
Content-Type values that got through to the body: sent on the wire (not the
bogus type) and answered a 2xx, or a 400 about the body's content
(`ExceptionInvalidData`) — the resource read the body, so it took the type.

## The write cycle (the former header probe)

The former header probe has no command of its own any more; its code
(`probe.ts`, `objects.ts`, `pairs.ts`, `record.ts`, `ledger.ts`) stays because
the full run's phase 2 drives it (`writeCycle.ts`) for the write members still
unknown — only those members, with the bogus Content-Type first — and for the
update measurement. What the cycle does:

On temporary objects it creates in the package (`ZHP`, or `Z_HP` for a
function module, plus a random suffix), it runs each object type's cycle —
create; read, lock, write, unlock; check and activate; deletion check and
delete — and sends every member that takes `options.headers` three times,
through the member itself:

- **known pair:** the pair from `pairs.ts`, taken verbatim from
  `docs/usage/MIGRATION-36.md` ("The pairs 35.0.0 sent", modern client, with
  "The completed pairs, measured" where 35.0.0 sent one header or none);
- **bad Accept:** `Accept: application/x-header-probe`, the known
  `Content-Type` — a `406` is expected;
- **bad Content-Type:** the known `Accept`,
  `Content-Type: application/x-header-probe` — a `415` is expected.

A create probe works on a name of its own, so a refused create that still
created something is found and removed. A delete sends the two bad probes
first and the known pair last. After every write probe the object is read
again and its existence and version are recorded.

The probes of one step go to SAP in one batch envelope (`AdtBatchConnection`).
Lock and unlock, and the steps that set up a dependency, run on their own; a
row whose member is a chain (a message class message) is marked
`sequential: <reason>`. 

Everything the probe may have created goes into a ledger before the create is
sent; a `finally` deletes it all, on failure and on Ctrl-C too, reports each
deletion, and lists loudly what could not be deleted. Ctrl-C sends nothing
new: the member call in flight finishes first — whole, so a member whose call
is a chain of requests (a message class message's create or update: read,
locks, the write, unlocks) sends the rest of its chain and releases its own
locks —, then the ledger is cleaned as it stands (a second Ctrl-C during the cleanup is ignored). A create runs whatever members are asked for, since every later step needs its
object; it is reported only when asked for. Operations the cycle
cannot run on its own (a debugger session, an abapGit repository, objects
whose key the server assigns) are reported as `skipped: <reason>`.

## One gate, one exit

Every request the error corpus sends — the write cycle's included — goes through one
gate, `gate()` in `capture.ts`: the logon (`gateConnect`), the system
context, every discovery read, every probe and envelope, the state reads,
the cleanup and the unlocks. Before sending, the gate asks the interrupt
(Ctrl-C, or an authorization stop); it watches every answer for an
authorization problem; and it records the request into the call that
issued it. Only the cleanup and the unlocks bypass the interrupt check,
through the gate's cleanup sibling (`cleanupOf`). `traced`, `clientsOn`,
`runCalls` and the probe's clients refuse a connection that does not send
through a gate, and a unit test scans `tools/header-probe/` for a request
sent any other way.

The exit code is decided in one place (`exitCodeOf`), at the end, from what
the run met: Ctrl-C 130; an authorization stop (the logon's refusal
included) 2; any other failure — a failed discovery read in any phase
included — 1; else 0. Phases and runs only record what they met. The report
is always written, marked (`endedBy`) with what ended the run: `complete`,
`interrupted (SIGINT)`, `stopped: authorization (…)` or `failed: …`.

## Known limits

Deliberate, and left as they are:

1. **The connection's logon is one call in flight.** The gate asks the
   interrupt once before `connect()`; on cloud the logon is the preflight
   plus `establishSession`, and once started it finishes whole. A 403 the
   transport swallows on the preflight is the connection's own behaviour,
   not something the gate sees.
2. **Ctrl-C during the cleanup after an authorization stop exits with 2, not
   130.** The run had already been stopped by the authorization problem; the
   first reason a run was stopped for is the one kept.
3. **The gate guard catches accidental direct requests, not deliberate
   evasion.** It is a text scan: a `.bind` alias of `makeAdtRequest` or a
   computed member name gets past it, and it does not scan `capture.ts`, the
   gate's own module. The runtime refusals (`traced`, `clientsOn`,
   `runCalls`, the probe's clients) cover what reaches them.
4. **A quoted media-type parameter is not read.** In a list such as
   `Accepted content types: text/plain; note="a,b"` the item is cut at the
   quote, so it does not count as a media type and the verdict can stay
   `unknown`. No SAP answer in the measured corpora carried a quoted
   parameter.
5. **The named-type columns read media types out of any text after the
   marker.** A sentence such as `Accepted content types: System expected
   application/xml here` names `application/xml` in the column, although the
   verdict does not count it as a list. In the measured corpora the only
   sentence after a marker came with a 404 and named no type.

## The corpus

**Where the output goes.** Everything a run writes — the corpora, the header
corpus files, the summaries — goes to a persistent folder per user and per
system, as the auth chain keeps its sessions (`~/.config/mcp-abap-adt` on
Unix, `Documents/mcp-abap-adt` on Windows):

- Linux and macOS: `~/.config/mcp-abap-adt-clients/header-probe/<system>/`;
- Windows: `<home>\Documents\mcp-abap-adt-clients\header-probe\<system>\`.

`<system>` is the connection target (`SAP_URL`'s host and port, and
`SAP_CLIENT`), lowercased, every character outside `[a-z0-9._-]` replaced by
`-` (e.g. `127.0.0.1-8000-100`). The folder is created when missing, is local
only, and is never committed; removing a worktree keeps it. `--out <dir>`
replaces the whole path. The run prints the absolute folder at the end.
`.header-probe/` in the repository is no longer written (its `.gitignore`
line stays for old checkouts). The files hold the system's answers.

Two files per run:

- `corpus-<source>-<headers>-<timestamp>.json` — every row: the endpoint and
  its source, the headers asked for, the Accept and Content-Type that went on
  the wire (read from the envelope part the batch writes, or from the
  transport), the status, the SAP exception's type and message, the answer's
  own `content-type`, the full body, what the error names — the raw text from
  `Accepted content types:` and from `Supported Media Types:`, every media
  type in the SAP message, `extractSupportedAccept` and
  `extractSupportedContentType` as returned — batched or sequential, and the
  probe name's state after a write.
- `corpus-<source>-<headers>-<timestamp>.md` — a table per endpoint group,
  then the summary: the time (envelopes, parts per envelope, ms per envelope
  and per part, ms per request sent on its own: count, total, median, p95),
  counts per status, every endpoint per status, every 406
  and 415 with the types named, every corpus pair refused, the Accept and
  Content-Type values named per endpoint, the writes that created the probe
  name, and the cleanup.

A bogus run also classifies each endpoint by what it **needs**. The rules
follow the order in which SAP's ADT REST framework handles a request, as read
from its code (class and method names from that reading): logon (401),
authorization (403, `S_ADT_RES`), the CSRF check (403, in
`CL_REST_HTTP_HANDLER`), routing (`CL_REST_ROUTER`: 404, or 500 when the
handler class cannot be created) and method dispatch (405,
`cx_adt_res_meth_not_supported`, in `CL_ADT_REST_RESOURCE`) all run before any
header is read. There is no central header check: Content-Type is checked
(415) only when the resource reads its body through
`CL_ADT_REST_COMP_CNT_HANDLER` (`DESERIALIZE`), Accept (406) only when it
writes its body through it (`SERIALIZE` → `check_cnt_type_is_supported`) or
calls that check itself; with no Accept at all that check answers 400
`acceptHeaderMissing`. A 500 is a router failure or a dump, at any point.

Per header, from its bogus request:

| verdict | when |
|---|---|
| `checked` | 406 for Accept only when it names the Accept (T100 `SADT_RESOURCE` 044, its list empty or not, or a list naming at least one accepted type, below), 415 for Content-Type; for Accept also a 400 `acceptHeaderMissing` to a request without Accept (a `none` run of the same source, given with `--render` or `--summary`, or a bogus Content-Type row) |
| `not checked` | a 2xx: the resource never compares the header |
| `unknown` | anything else — 401, 403, 404, 405 (`method not implemented`), 500 (`dump or router`, with the dump's short text), any other status with its SAP exception |

A 406 points at the Accept only when it names it: T100 `SADT_RESOURCE`
**044** ("Accepted content types: …"; it is the Accept check even with an
empty list, as on the DDIC creates — measured) or a list naming at least one
type. A list item counts only when it is a media type — `type/subtype`, each
a token, with optional `; name=value` parameters, read with plain string code:
`none`, or a sentence SAP put after the marker (a 404 on a function group
read answers `Accepted content types: System expected the element '{…}abapFunctionGroup'`),
is dropped, and a marker with nothing left is a marker with no list (a bare
`Accepted content types:` too). The `Accept named` and `Content-Type named`
columns show media types only. Any other
406 does not say the Accept was refused. **037** ("The message content is not
acceptable", no list) is the default text of `CX_ADT_RES_NOT_ACCEPTABLE`
raised without a text id (from reading SAP's code: the search raises it for an
invalid `objectType`, whatever the Accept — measured); a 406 with another
T100 or none says no more. So a bogus Accept answered by such a 406 is
`unknown` — `406 generic (T100 037): not necessarily the Accept`, or `406
without a list (T100 <id> <no> | no T100): not necessarily the Accept` —
unless the same endpoint answered a 2xx or a 404 to another Accept (none, or
the client's own): then it is `checked (037, inferred from the contrast)` (or
`(406 without a list (…), inferred from the contrast)`). The contrast holds in
every phase: in phase 1 per member; in the write cycle the known probe's
answer beside its bogus-Accept probe; and in the header corpus, for every
piece of evidence, any answer on the same endpoint, from any source and in any
phase, that did not carry the bogus Accept (the phase-1 count takes phase 1's
answers only). `settledBy` names the phase whose answers decided: a phase-1
406 settled by an answer that only phase 2 gave is `settled by phase 2`.

The Content-Type has a contrast of its own. A resource can refuse an
unsupported Content-Type with a bare 406 instead of 415: no body, no response
Content-Type, no SAP exception. Measured on one system: `POST
/sap/bc/adt/packages/settings`, without Accept, answered 406 with no
Content-Type and with a bogus one, and 400 `ExceptionInvalidData` with
`application/vnd.sap.adt.packages.settings.v2+xml`. So on one endpoint two
answers with the same Accept on the wire (both absent, or the same value) are
compared. If the one to a bogus or absent Content-Type got 406 or 415 and the
one to a working Content-Type got anything else (a 2xx, a 400 about the body,
a 404, …), an `unknown` Content-Type verdict becomes `checked (inferred from
the contrast: <refused> without a working Content-Type, <status> with one)`.
Two 406s, or a different Accept between the two, infer nothing, and the
Accept verdict is never changed by this pair. It applies in every phase, like
the Accept contrast; `settledBy` and `decidedIn` follow the phase of the
pair's later answer.

### Long-poll endpoints

A long-poll endpoint holds the request while it waits — but only when it
accepts the headers; with no Accept or a bogus one it answers at once. The
none and bogus calls give the header verdict and the accepted list, so a call
with working headers adds only the wait. `LONG_POLL_ENDPOINTS` (`corpus.ts`)
lists them, each with what it is: today the ABAP Unit run status (`GET
/sap/bc/adt/abapunit/runs/{name}`, measured 307 s with the corpus Accept on a
run id that does not exist). In corpus mode, phase 2's reads included, such a
call is not sent and its row records `skipped: long-poll, holds the request
when the headers are accepted`; its none and bogus calls go out as before.
The list was checked against the saved runs: no call there took more than
30 s on its own. The debugger's listen and the AMDP debugger's events are not
in it: the probe sends no debugger call in any mode.

### Self-check

The header corpus ends its counts with a self-check, in the `.md` and as
`selfCheck` in the `.json`, computed from the final corpus alone. It lists
what a record claims that its own evidence does not show:

- **settledBy without evidence:** records whose `settledBy` names a phase
  with no evidence line carrying the record's decided Accept or Content-Type
  verdict;
- **a marker followed by no media type:** evidence lines where `Accepted
  content types:` or `Supported Media Types:` is followed by something that is
  not a media type, with the endpoint and the HTTP status.

Each check gives a count and the list; an empty check prints 0. A non-zero
count is no error of the run: it shows where to look — a classification bug,
or SAP text the parser should not read as a list.

The probe's own arguments must build a real request: a stand-in value that a
real call never sends (`undefined`, an object type that is not an ADT type
`XXXX` or `XXXX/YYYY`) can make the answer say nothing about the headers.
Each member's recorded request is checked for such parameters; the members
still carrying one are marked `standIn` in the corpus.

| needs | when |
|---|---|
| `accept`, `content-type`, `both` | what is `checked` |
| `neither` | both `not checked`, or Accept `not checked` and no body |
| `unknown` | anything else |

The summary lists the endpoints per `needs` value with the values the system
named, and notes where the pair table lists a header the resource does not
check (or a Content-Type for a request without a body): the pair table is not
the truth. `--render` recomputes `needs` from saved corpora.

**A poisoned envelope is split until the dumping call is found.** Measured
2026-10-18: one part's dump answers for every part of its envelope with the
same error page, while each part sent alone gets its own answer (in the
discovery bogus run, 304 of 1517 probes differed between the batched and the
sequential run, all of them a batched 500). An envelope counts as poisoned
only when every part — the reads after the writes included — answered 500
with the same text. Its reads are divided, in order, into ten groups of about
a tenth each (never an empty group, so fewer than ten make one each); each
group goes as an envelope of its own; a group that comes back clean is
settled, one poisoned again is split the same way, and a poisoned single
call is sent alone — its 500 is its own answer, the dump, and it is listed
as the cause. Its writes are never resent: whether each took effect is read
once, on its own, and recorded as `poisoned, not resent: write; after:
exists` (or `absent`, or `unreadable <status>`); the summary lists every
poisoned write whose object exists after it, and the ledger entry registered
before the write removes it in the `finally`. Each probe records where it was settled (`settled`: depth
and path, e.g. `env 12 → group 3 → group 7`), and `inEnvelope` what the
envelope said; the summary lists every poisoned envelope, the envelopes and
the calls alone its splitting needed, its time, and the cause.

Nothing but progress and the paths goes to stdout; no secret, cookie or token
is written anywhere — of the request and answer headers only Accept and
Content-Type are kept.
