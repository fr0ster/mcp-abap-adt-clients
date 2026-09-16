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

  `messages` is still never empty on a refusal, and now without a composed
  sentence: the branch that used to invent "SAP reported
  activationExecuted=false and gave no reason" to satisfy that promise is the
  branch that now answers `null`, so every message on a refusal is one read
  out of the document.

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
