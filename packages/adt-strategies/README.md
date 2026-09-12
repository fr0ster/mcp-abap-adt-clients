# @mcp-abap-adt/adt-strategies

Default failure strategies for [`@mcp-abap-adt/adt-clients`](https://www.npmjs.com/package/@mcp-abap-adt/adt-clients),
derived from recorded ADT answers.

## Why this is a separate package

`adt-clients` ships **no** error strategy. That is deliberate: whether an answer
is a failure depends on which object types you touch and what you were doing,
and a library that decided for you would be wrong for somebody. So it returns
the contract whole and takes the question `analyse` per call.

Which leaves a real gap for anyone who has no opinion yet. This package fills
it — with an opinion, stated as one, and built from evidence rather than taste.

```typescript
import { adtRefusal } from '@mcp-abap-adt/adt-strategies';

const answer = await client
  .getClass()
  .activate({ className: 'ZCL_X' }, { analyse: adtRefusal });
```

## Why it cannot be one rule

ADT does not have a single way of saying no. From the recordings in
[`corpus/adt/`](../../corpus) at the root of this repository:

| the "no" | arrives as | shape |
|---|---|---|
| activation did not happen | 200 | `<chkl:messages>` with `<msg type="E">` |
| the object was never checked | 200 | `chkrun:status="notProcessed"` |
| the check found an error | 200 | `<chkrun:checkMessage type="E">` |
| the deletion was declined | 200 | `del:isDeleted="false"` |
| the object may not be deleted | 200 | `del:isDeletable="false"` |
| the name is taken (DDL, function group) | **200** | `<SEVERITY>ERROR</SEVERITY>` |
| the name is taken (class, domain, table) | **400** | `<exc:exception>` |
| locked, absent, unlocked write | 403 / 404 / 423 | `<exc:exception>` |

Read the last three rows together. One question, asked of one endpoint family,
answered two ways depending on the object type. A rule keyed on the status
misses the first of them silently and reports a taken name as free.

## What is in it

Six shapes, each reading one document form, none reading the status:

`activationRefusal`, `checkRunRefusal`, `deletionRefusal`,
`deletionCheckRefusal`, `validationRefusal`, `exceptionRefusal`.

`adtRefusal` composes all six, exception last. `firstOf(...)` composes your own.
`nothingIsARefusal` turns judgement off.

## How the defaults are justified

Every shape is tested against the recorded answer it was derived from **and**
against the recorded success it must be told apart from. That pairing is the
point: on most of these endpoints the refusal and the success share a status,
so a shape that fires on both would look correct and recognise nothing.

The tests need no SAP system. They read files.

One row of the test table was wrong when it was first written — a table was
listed under `validationRefusal`, and the corpus rejected it on the first run.
That is the argument for this package in one line.

## Licence

LGPL-3.0-only.
