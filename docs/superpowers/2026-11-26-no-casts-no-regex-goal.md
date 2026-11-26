# Goal: no casts and no regular expressions in production code

## Goal

The production code of adt-strategies, adt-clients and adt-clients-legacy follows the
owner's two base rules: what static typing can verify is verified statically, and no
regular expression runs in it. A value the compiler can type is typed by its contract, not
cast or held as `unknown` and narrowed by hand; a value from outside the type system — SAP's
answers, parsed XML or JSON, files — is checked at run time, by typed code. Text and XML are
read with plain linear string code, a scanner, or the platform's or the XML parser, never a
regular expression: over SAP's input a regex costs more than it solves, in correctness and in
the review it needs. A guard test keeps both rules true from then on, so code that breaks
them cannot be merged again. Consumers see no change.

## Invariants

- **Static typing first.** No `as` cast in production `src` (`as const` excepted), no
  `any`, and no `unknown` narrowed by hand where a contract types the value. A runtime check
  remains only where the compiler cannot see the value: data from outside the type system,
  such as network answers, parsed XML or JSON, and files.
- **No regular expressions in production code.** No regex literal, no `RegExp`, and no API
  called with one, in production `src`. Linear string code, a scanner, or the platform or
  XML parser does the work instead.
- **A guard test holds both rules.** It runs in every package's unit suite, fails on any
  cast, `any`, hand-narrowed contract value or regular expression in production `src`, and
  is shown to be load-bearing: reintroducing each forbidden form turns it red.
- **Every public API and every answer stays the same.** Exports, signatures, types, the
  requests sent and the results, errors and refusals returned are unchanged; the work is
  internal, and a consumer on the current versions needs to change nothing.
- **Behaviour is proved unchanged.** Each replaced site keeps its behaviour on the inputs it
  handled before, shown by unit tests; where the replacement reads SAP's input, that input is
  what the test feeds it.
- **Patch or minor releases.** The affected packages ship as patch or minor versions, in
  the repository's publish order; no major.

## Out of scope

- Test code, unless a test file is touched for another reason.
- Tooling and scripts outside the packages' production `src`.
- Any change of behaviour, API or answer, and any new feature.
- Other repositories, and a backport to an earlier major.
