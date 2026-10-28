# Recorded ADT answers

Real exchanges with a running system, kept as files: one `.json` per step with
the request and the response metadata, beside a `.body.xml` or `.body.txt` with
the payload byte for byte.

**What they are for.** This package ships no error strategy and only documentary
result readings, because the consumer's judgement cannot be made here. A
consumer choosing those strategies should choose from what the server actually
sends — and `docs/usage/ANSWER_SHAPES.md` is the reading of this corpus that
explains why one rule cannot cover it.

Case names say what each demonstrates: `check-success-verdict`,
`refusal-check-nonexistent-object`, `refusal-validation-name-taken-ddl`,
`read-empty-package-contents`.

## Layout

`corpus/adt/` holds one folder per kind of recording; a file keeps its
recorded name, which its `.json` names as `bodyFile`.

| Folder | What it holds | Read by |
|---|---|---|
| `answers/` | the answer shapes: reads, refusals, writes, with the collector's run manifests (`_run-*.json`) | `adt-strategies`' tests, this package's unit tests, `docs/usage/ANSWER_SHAPES.md`; written by `scripts/capture-adt-corpus.ts` |
| `debugger/` | the debugger conversations and the memory snapshot list, kept for information | `adt-strategies`' tests, `docs/research/debugger-endpoints.md`, `docs/usage/ERRATA.md` |
| `discovery/` | what each release says about its endpoints and features: `core/discovery`, `discovery`, the compatibility graph, the system components, `objecttypes`, `releasestates` — `system-description-<release>--NN-*` | the type tables' evidence |
| `typestructure/` | each release's `POST /repository/typestructure`: every type with its parent, name length, capabilities and the user's authorizations | the type tables' evidence |
| `measurements/<release>/` | the live measurements behind the type tables: per object kind, create, read and update of source and metadata, locks, activation, the operations a release refuses — `md-<release>-<kind>--NN-*` | the type tables' evidence |

The releases are `s4-2025` (S/4HANA 2025 on-premise), `abap-cloud` (the BTP
ABAP environment trial) and `basis-740` (SAP_BASIS 7.40 SP04). In
`measurements/`, the body of each CSRF fetch (`--NN-csrf-fetch`) is replaced by
a note: it was the release's discovery document, which `discovery/` holds once.

## It exists in two places, on purpose

The same corpus is kept in the consumer repository
[`fr0ster/mcp-abap-adt`](https://github.com/fr0ster/mcp-abap-adt) under
`tests/fixtures/adt/`, where it was first collected and where that repository's
own tests read it. Neither copy is a stale mirror of the other: each is evidence
for a decision made in its own repository — the strategies a consumer injects
there, the readings and the documented answer shapes here.

The collector is duplicated for the same reason, and the two have diverged.
**This copy was repaired against the 19.0.0 contract**; the one next door still
calls members this release removed — `getPackageContents`,
`getPackageHierarchy`, `list({ user })`, a `create` that writes source — so it
will not compile there once that repository upgrades. Take this file, or apply
the same repairs.

## What is built from it

`packages/adt-strategies` — the default failure strategies, one per recorded
refusal form, each tested against the file it came from and against the recorded
success it must be distinguished from. Those tests need no SAP system: the
corpus is the fixture.

## Collecting

```bash
../../node_modules/.bin/ts-node scripts/capture-adt-corpus.ts
```

It talks to this package's own public surface, with a thin interceptor on
`connection.makeAdtRequest` capturing each raw exchange. It does not go through
any strategy: the point is the document before anyone reads it.

Side effects on the target system: one scratch class in
`environment.default_package`, exercised and deleted again. Reads of the shared
polygon objects are reads only.

## What is not in the files

**No credentials, by construction.** The interceptor sits above the layer that
adds the Authorization header, the CSRF token and the session id, so it never
sees them. Cookie and CSRF headers are dropped by name as well.

**Two identities are replaced, not dropped.** A strategy still has to see that a
user id and a system id sit in those places, so each becomes a stable
placeholder: `SAPUSER01` and `SYS`. A cloud host becomes `abap-cloud.example`.

**One header is dropped as topology**: `sap-adt-saplb` names the application
server instance that answered, which says where the system runs and nothing
about what ADT says.

**This section was wrong when it was first written, and the corpus proved it.**
It claimed the system was identified nowhere while fourteen committed files
carried the real system id in `adtcore:masterSystem`, and thirty-seven carried
the answering instance in `sap-adt-saplb`. Both are now replaced in the files and
handled by the collector. The lesson is the one the corpus exists to teach:
check the artefact, not the intention.

Anything else you find, treat as a bug in `scripts/capture-adt-corpus.ts` rather
than as acceptable.
