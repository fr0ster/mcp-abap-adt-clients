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
import { analyseActivation, asItCame } from '@mcp-abap-adt/adt-strategies';

const answer = await client
  .getClass()
  .activate({ className: 'ZCL_X' }, { analyse: analyseActivation });

if (!answer.ok) {
  for (const message of answer.getError().messages) {
    console.error(`[${message.type}] ${message.text}`);
  }
}
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

**The error axis**, which is almost all of it. One strategy per document form —
`analyseActivation`, `analyseCheck`, `analyseDeletion`, `analyseValidation`,
`analyseUnitTest`, `analyseException` — and `analyseAny`, which dispatches on
the root element when the form is not known in advance.

Each answers an `IAdtMessageFailure`: the contract's `IAdtError` plus every
message in the document, normalised. SAP spells severity three ways and carries
a T100 key in exactly one of the forms; the reading flattens that so a caller
matching on `type === 'E'` does not have to know which carrier they got.

The readings underneath are exported too — `readActivationRefusal` and its
siblings, pure functions over a document — for a caller assembling their own
strategy rather than taking one.

**The result axis has exactly one member**, `asItCame`: the answer unchanged,
XML or ABAP text alike. Shaping a result is the consumer's decision — which
fields, to what end — and there is no defensible default for it. The absence of
shaping is the only one.

## How the defaults are justified

Every strategy is tested against the recorded answer it was derived from **and**
against the recorded success it must be told apart from. That pairing is the
point: on most of these endpoints the refusal and the success share a status, so
a reading that fires on both would look correct and recognise nothing.

Forty tests, no SAP system. The corpus is the fixture.

One row of the table was wrong when it was first written — a table was listed
under validation, and the corpus rejected it on the first run: a table answers
`400` with an exception document, not `<SEVERITY>ERROR</SEVERITY>`. That is the
argument for this package in one line.

## Licence

LGPL-3.0-only.
