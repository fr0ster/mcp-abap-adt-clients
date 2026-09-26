# @mcp-abap-adt/adt-strategies

This package's own changelog, and the only one that describes it.

**Every package here keeps its own, because the versions move independently.**
`adt-clients` is at 19.0.0 while this starts at 0.1.0, so a shared file would
list entries against versions this package never had. A monorepo that bumps all
its packages together can have a single changelog; this one cannot.
`adt-clients`' is at the [repository root](../../CHANGELOG.md) for now, because
that package still lives there.

Tags follow the same rule: these releases are tagged
`adt-strategies@<version>`, never `v<version>` — that scheme is `adt-clients`'
and fires its release workflow.

## [0.5.0] - 2026-09-26

Released together with `adt-clients` 23.0.0, which stopped applying any reading
or verdict of its own. Everything it used to apply is here now, by name — a
consumer on `adt-clients` 22.x who relied on a parsed default or a built-in
verdict passes the strategy below instead.
[MIGRATION-23.md](../../docs/usage/MIGRATION-23.md) has the replacing code for
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
  was missed. Measured on E19: a service-binding check answering a `W` and an
  `E` came back as "0 strong and 0 weak external references". Now every
  message with text is kept, in order, each with its own severity, and the T100
  key and `msgv1..4` are read from the long-text link — the one part of a
  deletion message that does not change with the logon language. An object is
  refused when its verdict attribute is not `"true"` or any message SAP typed
  `E`; the counts stand in only when SAP said nothing. An untyped message does
  not overturn an explicit `"true"`: a DDLS delete answers `isDeleted="true"`
  with one `del:type=""` message, text `S::000`, and the object is gone —
  measured on E19 and on the trial. Read as an `E`, it turned every CDS source
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

  Measured again before changing it, on a trial system (2026-09-16), three
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
