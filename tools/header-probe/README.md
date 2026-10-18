# Header probe

`npm run probe:headers` asks a system how it answers each member's request
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
npm run probe:headers
npm run probe:headers -- --only class,domain   # these object types only
npm run probe:headers -- --operation update    # this member only
npm run probe:headers -- --sequential          # every request on its own, no batch
npm run probe:headers -- --compare <batched.json> <sequential.json>
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
deletion, and lists loudly what could not be deleted. Operations the cycle
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
