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
npx ts-node scripts/capture-adt-corpus.ts
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
placeholder: `SAPUSER01` and `SYS`.

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
