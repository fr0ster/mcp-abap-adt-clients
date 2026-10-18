# Header probe

`npm run header:discovery` asks a system how it answers each member's request
headers. It is a developer tool for collecting information: it is not run in
CI, and it is not part of the npm package (`tools/` is outside `src/`, so
nothing here reaches `dist/`, and `files` does not list it).

## Prepare

- `.env` in the repository root with the SAP connection (`SAP_URL`,
  `SAP_USERNAME`, `SAP_PASSWORD`, `SAP_CLIENT`), as the integration tests use.
- `src/__tests__/helpers/test-config.yaml` (`npm run test:init`): the probe
  reads `environment.system`, `default_package` and `default_transport` from
  it. The package must exist; every object is created in it, on that
  transport, and deleted again.

## Run

```bash
npm run header:discovery
npm run header:discovery -- --only class,domain   # these object types only
npm run header:discovery -- --operation update    # this member only
npm run header:discovery -- --sequential          # every request on its own, no batch
npm run header:discovery -- --compare <batched.json> <sequential.json>
```

`--only` takes object types: `class`, `interface`, `program`, `include`,
`domain`, `dataElement`, `structure`, `table`, `tableType`, `ddl`,
`functionGroup`, `functionModule`, `messageClass`, `transformation`,
`serviceDefinition`, `accessControl`, `metadataExtension`, `utils` (`class`
includes its local includes, `messageClass` its messages). `--operation`
keeps the whole cycle but probes only that member; the other steps run with
the known pair and are not reported. `--compare` reads a batched and a
sequential report and writes which probes differ between them.

## What it does

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
`sequential: <reason>`. `--sequential` sends everything one request at a time.

Everything the probe may have created goes into a ledger before the create is
sent; a `finally` deletes it all, on failure and on Ctrl-C too, reports each
deletion, and lists loudly what could not be deleted. Ctrl-C sends nothing
new: the member call in flight finishes first — whole, so a member whose call
is a chain of requests (a message class message's create or update: read,
locks, the write, unlocks) sends the rest of its chain and releases its own
locks —, then the ledger is cleaned as it stands (a second Ctrl-C during the cleanup is ignored). A create runs
whatever `--only`/`--operation` say, since every later step needs its object;
it is reported only when asked for. Operations the cycle
cannot run on its own (a debugger session, an abapGit repository, objects
whose key the server assigns) are reported as `skipped: <reason>`.

## Report

Two files in `.header-probe/` (gitignored: they hold the system's answers):

- `report-<timestamp>.json` — everything recorded: per probe the pair sent,
  the requests (method, path with the object name as `{name}`, `_action`),
  the status, SAP's exception type and message, the answer's own
  `content-type`, `extractSupportedAccept(error)` and
  `extractSupportedContentType(error)` as returned, the raw
  `Accepted content types: …` text, the body of a non-2xx answer, and the
  object's state after a write;
- `report-<timestamp>.md` — a table per object type: operation, endpoint,
  batched or sequential, then status, accepted types and SAP message for each
  of the three probes, and the state after a write. The summary lists every
  known pair SAP refused with `406`/`415` and what it named; every endpoint
  (method, path, `_action`) that two members or two object types share, with
  each one's pair and answers, flagged where the answers differ (one
  endpoint, one member); the skipped operations; and every temporary object
  with whether it was removed.

Nothing but progress and the two paths goes to stdout.

# Error corpus

`npm run header:discovery:next` asks a system for every answer it gives the
ADT endpoints, errors above all, and records what each error names as
acceptable. It is the successor of the header probe and runs beside it until
the owner swaps the two. Like the probe, it is a developer tool: not in CI,
not in the npm package.

## Prepare

As for the header probe: `.env` with the SAP connection and
`src/__tests__/helpers/test-config.yaml`, of which only `environment.system`
is read. No package and no transport are needed: nothing is created on
purpose.

## Run

```bash
npm run header:discovery:next -- --from discovery --headers corpus
npm run header:discovery:next -- --from discovery --headers none
npm run header:discovery:next -- --from discovery --headers bogus
npm run header:discovery:next -- --from clients --headers corpus
npm run header:discovery:next -- --from clients --headers none
npm run header:discovery:next -- --from clients --headers bogus
npm run header:discovery:next -- --from discovery --headers bogus --sequential
npm run header:discovery:next -- --summary <corpus.json> [<corpus.json> …]
npm run header:discovery:next -- --render <corpus.json> [<corpus.json> …]
```

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

## What it does

1. **Authorization first.** `GET /sap/bc/adt/discovery`. A 401 or 403 prints
   `Oops: no authorization (<status>)` and exits with 2; nothing else is sent
   and no file is written. Any other non-2xx prints the status and stops.
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
     `LOCK`, it polls, the debuggers need a live session, …; in corpus mode also the
     ABAP Unit run-status read (`getStatus`), which with a valid Accept waits
     for the run it names to finish (measured 2026-10-18: 307 s for one
     request on a run id that does not exist). A method that
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
   or a fixed text. After every write the probe name is read; if it now
   exists, the row says so, the object goes into the ledger, the `finally`
   deletes it, and it is listed loudly at the end. A `LOCK` that a member
   still answered 2xx is released the same way. No locks are taken.
5. **Batch.** Everything goes in envelopes of 25 probes through
   `AdtBatchConnection` — the members themselves in clients mode,
   `makeAdtRequest` in discovery mode — each write followed by its read in the
   same envelope. A member whose call is a chain of requests runs on its own
   (`sequential: a chain of …`); so do the probes of an envelope SAP refused
   whole. Each envelope's part count, bytes and wall time from send to
   answer are recorded with `performance.now()`, and each row carries its
   envelope's id and ms per part; a request sent on its own carries its wall
   time. There is no timer and no timeout of the script's own. Ctrl-C stops
   new requests (asked before each envelope and request),
   the one in flight finishes, and the `finally` cleanup runs.

## The corpus

Two files in `.header-probe/` (gitignored: they hold the system's answers):

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
| `checked` | 406 for Accept, 415 for Content-Type; for Accept also a 400 `acceptHeaderMissing` to a request without Accept (a `none` run of the same source, given with `--render` or `--summary`, or a bogus Content-Type row) |
| `not checked` | a 2xx: the resource never compares the header |
| `unknown` | anything else — 401, 403, 404, 405 (`method not implemented`), 500 (`dump or router`, with the dump's short text), any other status with its SAP exception |

| needs | when |
|---|---|
| `accept`, `content-type`, `both` | what is `checked` |
| `neither` | both `not checked`, or Accept `not checked` and no body |
| `unknown` | anything else |

The summary lists the endpoints per `needs` value with the values the system
named, and notes where the pair table lists a header the resource does not
check (or a Content-Type for a request without a body): the pair table is not
the truth. `--render` recomputes `needs` from saved corpora.

**An envelope whose parts all answer the same 500 is sent again, one probe at
a time.** Measured 2026-10-18: one part's dump answered for every part of its
envelope with the same error page, while each part sent alone got its own
answer (in the discovery bogus run, 304 of 1517 probes differed between the
batched and the sequential run, all of them a batched 500). Such a row is
marked `sequential: every part of envelope N answered the same 500: …`, and
`inEnvelope` keeps what the envelope said.

Nothing but progress and the paths goes to stdout; no secret, cookie or token
is written anywhere — of the request and answer headers only Accept and
Content-Type are kept.
