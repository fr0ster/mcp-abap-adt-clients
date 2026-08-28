# Which parameters each validation endpoint requires — E19, 2026-08-28

Captured by `scripts/probe-validation-params.ts` against E19 (`RFCSAPRL 816`, package
`TEST_MCP`), in **one session**, 66 requests. Raw captures stay out of git
(`validation-probe/` is ignored) — these are the answers.

Eleven modules append `packagename` only `if (packageName)`. On `/programs/validation` that
was measured wrong and fixed. This settles the other ten, and turns up two further defects
nobody was looking for.

**Method.** Each case takes its URL, `Accept` and parameter names **from the module that
builds them**, never from a convention — `class`, `interface` and `behaviorImplementation`
post to `/oo/validation/objectname`, not `/oo/validation`, and a first attempt that guessed
the shorter URL produced 404s that proved nothing. The full set goes first as a control; if
it does not succeed the case is reported as proving nothing. Then the set is sent again once
per parameter with that one **omitted**, and once more with `description` **empty**, because
three modules send `description || ''` rather than omitting it — that, not the omission, is
the request their callers actually produce.

## The matrix

| module | endpoint | required | `description=''` |
|---|---|---|---|
| `program` *(control, fixed)* | `/programs/validation` | `objname`, `objtype`, `packagename` | 200 |
| `class` | `/oo/validation/objectname` | `objname`, `packagename` | 200 |
| `behaviorImplementation` | `/oo/validation/objectname` | `objname`, `packagename` | 200 |
| `interface` | `/oo/validation/objectname` | `objname`, `packagename` | 200 |
| `ddl` | `/ddic/ddl/validation` | `objname`, `packagename`, `description` | 200 |
| `accessControl` | `/acm/dcl/validation` | `objname`, `packagename`, `description` | 200 |
| `functionGroup` | `/functions/validation` | `objtype`, `objname`, `description` | 200 |
| `dataElement` | `/ddic/dataelements/validation` | `objname`, `description` | **400** |
| `domain` | `/ddic/domains/validation` | `objname`, `description` | **400** |
| `authorizationField` | `/aps/iam/auth/validation` | `objname`, `description` | **400** |
| `transformation` | `/xslt/validation` | — control answered **404** | 404 |

`objtype` is required only by `/programs/validation` and `/functions/validation`. The three
`oo/validation/objectname` cases and the DDIC ones answer `200` without it, so the type is
carried by the endpoint there, not the parameter.

## What the server says

Missing parameters are named:

```xml
<message lang="EN">Parameter packagename could not be found.</message>
<message lang="EN">Parameter objname could not be found.</message>
<message lang="EN">Parameter description could not be found.</message>
```

An empty `description` where one is required is a different message, and that difference is
the whole point of the second pass:

```xml
<message lang="EN">The description is missing for VALIDATION</message>
```

`/functions/validation` without `objtype` gives a third:

```xml
<message lang="EN">Object type  is not supported</message>
```

Success is `200` with, on most endpoints,

```xml
<asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><CHECK_RESULT>X</CHECK_RESULT></DATA></asx:values></asx:abap>
```

`ddl`, `functionGroup` and `accessControl` answer `200` with a body carrying no
`CHECK_RESULT`; recorded as-is rather than classified.

## The defects this proves

Six modules send a parameter conditionally that the server requires:

- **`packagename` conditional, required:** `class`, `behaviorImplementation`, `interface`,
  `ddl`, `accessControl`. A caller with no package gets a `400`.
- **`description` conditional, required:** `functionGroup`, `accessControl`. Same.

And three send it always, but empty, where empty is refused:

- **`description || ''` rejected:** `dataElement`, `domain`, `authorizationField`. Their
  comments say "description is required for … validation", which is right — but `''` does not
  satisfy it, so a caller who gives no description still gets a `400`, just with a different
  message.

`accessControl` is in two of those lists: both its conditionals are wrong.

## `transformation` is a separate matter

`/sap/bc/adt/xslt/validation` answered **404 for every attempt, including the full set**. The
control failing means this case says nothing about parameters — but the 404 itself is a
finding: either the URL in `src/core/transformation/validation.ts` is wrong, or the resource
does not exist on this system. E19's discovery document has no `xslt/validation` collection
either. Needs its own look; nothing here should be changed on the strength of a failed
control.

## Cost

One session, released at the end, and nothing created — validation is a question, not a write.
This replaces a first attempt made of roughly fifty one-off `curl` calls, which guessed URLs
and left a server session behind per request, emptying E19's pool.
