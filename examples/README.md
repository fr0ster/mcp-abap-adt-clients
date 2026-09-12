# Examples

**These are documentation.** Each file illustrates one sequence, so that what
the migration note describes in prose has exactly one reading. Nothing here is
a program to run: the sequences are exercised against a real system by the
integration tests, and those are the ones that prove the calls work.

They take an `AdtClient` you built, because constructing a connection is your
system's business and not what is being illustrated.

## What each one shows, and what runs it

| file | the point | exercised by |
|---|---|---|
| `update-a-class.ts` | what `updateClassWithCheck` used to do inside itself: check, judge, lock, write, unlock, activate — and that the write carries the **whole** source | `integration/core/class/Class.test.ts`, except the check — see below |
| `update-a-domain.ts` | the same for `updateDomain`, where the content is the object's document and the patch was the package's | `integration/core/domain/Domain.test.ts` |
| `activate-a-group.ts` | what `activateAndWait` used to do: start a run, watch it, read what it produced — and the waiting is yours | `integration/shared/groupActivation.test.ts` |
| `where-used.ts` | what `getWhereUsedList` used to do: scope, edit the scope, search | `integration/shared/whereUsed.test.ts` |
| `judge-a-refusal.ts` | ADT refuses inside a `200`; your `analyse` is what makes it a failure | `integration/shared/responseContract.test.ts` |

The pattern is the same in all five: **the steps did not change, only who takes
them.** Each removed member is reproduced here in full, so "the consumer does it
now" names something specific rather than leaving a reader to guess which calls,
in which order, with what in between.

## Why they are compiled

`npm run test:check` type-checks this directory. The four JavaScript examples
that used to live here called `CrudClient`, a class renamed several majors
before anyone noticed, so the first thing a consumer opened contained nothing
that could work. Compiling them is what makes that impossible rather than
unlikely.

Type-checked is not the same as true, which is what the right-hand column above
is for.

**One row in that column is short, and saying so is the point of having it.**
`check` is not called by any integration test, on any type. Eighteen `check.ts`
modules changed in 19.0.0 — they return their report instead of raising — and
nothing exercises that against a live system. The step is illustrated in
`update-a-class.ts` because a caller who wants it needs to see where it goes;
it is not evidence that the call behaves as drawn.

## Imports

The files import from `../src` because they sit inside this repository. In your
code every one of those is `@mcp-abap-adt/adt-clients`.
