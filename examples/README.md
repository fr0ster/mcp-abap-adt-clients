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
| `update-a-class.ts` | what `updateClassWithCheck` used to do inside itself: check, judge, lock, write, unlock, activate — and that the write carries the **whole** source | `integration/core/class/Class.test.ts`, and `integration/shared/checkRun.test.ts` for the check |
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

That column was short in one place until `integration/shared/checkRun.test.ts`
was written for it: `check` was called by no integration test on any type, while
eighteen `check.ts` modules changed behaviour in this release. It now covers the
three answers the endpoint gives — including the one where a check of an object
that does not exist is indistinguishable from a clean check unless you read
`chkrun:status`.

## Imports

The files import from `../src` because they sit inside this repository. In your
code every one of those is `@mcp-abap-adt/adt-clients`.
