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

### Not published

No `npm publish` accompanied this tag.
