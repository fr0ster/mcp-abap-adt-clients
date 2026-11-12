# Goal: a long one-line SQL query keeps its literals whole

## Goal

`AdtUtils.getSqlQuery` (`@mcp-abap-adt/adt-clients`) posts the caller's statement to
`POST /sap/bc/adt/datapreview/freestyle?rowNumber=…` as it was given. SAP keeps at most 255 characters of each line —
counted after it has collapsed the line's whitespace — and drops the rest of the line
without a word (the measurements below; the model is an inference from them). A
statement with a line whose code runs past that mark therefore either fails — a string literal
cut in two (`ExceptionDataPreviewGeneral`, "The text literal … is longer than 255
characters", mcp-abap-adt#350), a keyword cut in two, a closing parenthesis lost — or,
worse, runs **with part of its text gone** and answers rows the caller did not ask for.

After this change:

1. **A statement whose every line is at most 72 characters is sent exactly as given**,
   byte for byte.
2. **A line longer than 72 characters is wrapped:** it is broken at the nearest
   whitespace, or right after a comma, at or before the 72nd character — outside string
   literals and outside comments, never so that a line begins (after its leading
   whitespace) with `*`, and never moving a comment off the line it began on. A token
   with no break point within 72 characters (a long string literal, above all) goes on a
   line of its own, as it is, and the wrap goes on after it. Only the placement of
   whitespace changes; what SAP executes is the statement the caller wrote. The commas of
   a compact `IN ('…','…')` list are break points, so the issue's statement is wrapped
   and answered.
3. **The library refuses nothing for its layout.** A string literal longer than 255
   characters, or a `"` inside a literal, is sent as it is (wrapped like everything
   else), and SAP's answer reaches the caller as SAP's answer.

72 characters is the width ABAP source has long been written to — far below the 255 at
which SAP cuts a line — so a wrapped line stays well inside what SAP reads, whatever SAP's
own count of its whitespace.

The mcp-abap-adt server's `GetSqlQuery` (and `GetTableContents`, which reads the same
endpoint through the same member) gets the fix by taking the adt-clients release that
carries it; the server's code does not change for it.

## Invariants

- **The fix lives in adt-clients.** Every ADT request is built there; the member that
  posts the statement is the one that wraps it. No caller wraps SQL for it.
- **The statement's meaning never changes.** The library inserts line breaks (or turns a
  whitespace character into one) between tokens and does nothing else: no character of a
  string literal or a comment is touched, added or removed; no token is added, removed,
  reordered, re-cased or rewritten; no comment is moved off its line; no line is made to
  begin with `*`.
- **Untouched when it fits.** A statement with no line longer than 72 characters goes on
  the wire as the caller's string, unchanged.
- **No regular expression.** The statement is read by one linear scanner, character by
  character, that knows the string literals (`'…'` with `''` inside, `` `…` `` with
  ` `` ` inside) and the comments (`"` outside a literal to the end of the line, a line
  whose first non-blank character is `*`).
- **Static types first.** The statement is typed by the contract (`IGetSqlQueryParams`
  from `@mcp-abap-adt/interfaces-adt`, `sql_query: string`); the wrap is a typed function
  from string to string. No cast, `any`, non-null `!`, `@ts-ignore` or runtime check of
  what the compiler proves.
- **No refusal of the library's.** Every statement the member is given is sent — wrapped
  or as given — and answered by SAP; the library adds no failure of its own for SQL text.
- **No retry, no timeout, one request.** A statement is sent once, as today; nothing is
  resent in another layout when SAP refuses it; the request keeps `timeout: 0` (no
  deadline of the library's).
- **Everything else answers as today.** The endpoint, `rowNumber`, headers, the reading of
  the answer (`results.query`), `analyse`, and what a success or a SAP refusal looks like
  stay as they are. The server's tool answer (`sql_query` echoes what the caller passed)
  stays as it is.

## What there is today

Labels: **Measured** (observed by running against an on-premise system over HTTP,
`POST /sap/bc/adt/datapreview/freestyle?rowNumber=5`, `Content-Type: text/plain;
charset=utf-8`, read-only statements on `TDEVC`), **Code** (read in the source named),
**Inference** (concluded from the measurements, not observed directly).

### Where the request is built

- **Code.** adt-clients 45.5.0, `packages/adt-clients/src/core/shared/sqlQuery.ts`,
  `getSqlQuery` (lines 30–47): `data: params.sql_query` — the statement posted as given,
  `rowNumber` from `params.row_number || 100`, `timeout: 0`, the caller's
  `Accept`/`Content-Type` through `requestHeaders`. `AdtUtils.getSqlQuery`
  (`packages/adt-clients/src/core/shared/AdtUtils.ts`, lines 828–837) calls it inside
  `answering` with `results.query` and `options.analyse`.
- **Code.** `getTableContents` (`packages/adt-clients/src/core/shared/tableContents.ts`,
  lines 59–76) posts the caller's statement to `/sap/bc/adt/datapreview/ddic` the same
  way. `adt-clients-legacy` refuses both members without a request
  (`AdtUtilsLegacy.ts`, lines 257–269, through `refuse`, lines 533–544).
- **Code.** The server (mcp-abap-adt): `src/handlers/system/readonly/handleGetSqlQuery.ts`
  passes `args.sql_query` to `getUtils(…).getSqlQuery({ sql_query, row_number }, …)`
  unchanged; `src/handlers/table/readonly/handleGetTableContents.ts` builds
  `SELECT * FROM <table>` and calls the same `getSqlQuery`. Neither lays out the
  statement.

### What SAP does with the statement

| Case | Status | SAP's answer |
|---|---|---|
| The issue's statement, one line of 334 characters (literal `'GGG…'` at 245–276) | 400 | `The text literal "'GGGGGGGGGG   INTO     TABL..." is longer than 255 characters.` |
| The same, LF before `'GGG…'` (after the comma) | 200 | the expected row |
| The same, CRLF / CR alone before `'GGG…'` | 200 / 200 | the expected row |
| One line of 255 characters, its `)` at 255 | 200 | the expected row |
| One line of 256 characters, its last literal ending at 255, `)` at 256 | 400 | `"INTO" is invalid here (due to grammar).` |
| One line, a literal crossing 255 (ending at 256, 257, 260) | 400 | `The text literal "'ZZZ   INTO     TABLE @DATA..." is longer than 255 characters.` |
| One line of 303 characters, no literal (`… AND devclass IS NOT NULL …`) | 400 | `"A" is invalid here (due to grammar).` |
| One line: `IN (…)` closed at 255, then ` AND devclass = 'NOPE'` (no row matches) | **200** | **1 row** — the condition past 255 was dropped |
| The same with `)` at 254 (the tail starting at 255) | **200** | **1 row** |
| The same with LF before `AND` | 200 | 0 rows (the right answer) |
| A non-last line of 327 characters: `)`-less `IN (…` list to 255, then 72 characters of invalid text, `)` on line 2 | **200** | 1 row — the invalid text past 255 was dropped |
| A non-last line of 256 characters, a literal ending at 256 | 400 | `The text literal "'ZZZ )   INTO     TABLE @DA..." …` |
| Line 2 of 256 characters (literal ending at 255, `)` at 256) | 400 | `"INTO" is invalid here (due to grammar).` |
| 50 spaces after `SELECT`; raw end of the crossing literal 256, without the run 207 | 200 | the expected row |
| 50 spaces after `SELECT`; the literal crossing 255 once the run is one space | 400 | the text-literal message |
| 49 leading spaces; raw 256, without them 207 / with them 305, without 256 | 200 / 400 | the expected row / the text-literal message |
| 50 tabs after `SELECT`, raw end 256 | 400 | the text-literal message (`'ZZZZZZZZZZZZZZZZZZZZ   INT…`) |
| A literal of `Ä` first; the crossing literal ends at character 250, UTF-8 byte 280 | 200 | no error |
| A literal of `Ä` crossing character 255 | 400 | the text-literal message |
| A field-list literal on its own line: 252 / 253 characters (254 / 255 with quotes); a backtick literal of 253 | 200 / 200 / 200 | the literal's value |
| The same, 254 characters (256 with quotes); a backtick literal of 254 | 400 / 400 | `Only one SELECT statement is allowed.` |
| A `'…'` literal of 31 characters or more compared with `devclass` (CHAR 30), short line | 400 | `An exception with the type CX_ADT_DATAPREVIEW_COMMON was raised, but was not handled locally …` |
| Field-list literal `'A    B'`, `'A<LF>B'`, `'A<CRLF>B'`, `'A<TAB>B'`, `` `A    B` `` | 200 | each answered `A B` |
| LF inside a compared literal `'$T<LF>MP'` | 200 | 0 rows, no error |
| `"` comment to the end of line 1, the `WHERE` on line 2 | 200 | the expected row |
| A `"` comment of 300 characters ending line 1; a `*` comment line of 302 characters | 200 / 200 | the expected row |
| `* comment` as the first line, as a middle line, and after two leading spaces | 200 | the expected row |
| One line ending with a `"` comment; one line whose `"` comment swallows the `WHERE` | 400 / 400 | `Invalid query string. Only SELECT statement is allowed.` |
| `"` inside a `'…'` literal, and inside a `` `…` `` literal, one line | 400 / 400 | `Literals across more than one line are not allowed.` |
| `"` inside a literal, a second line after it | 400 | `There must be a space or equivalent character … after "'A OR DEVCLASS = '".` |
| `SELECT` then a line starting with `* FROM …` (also after two spaces); `COUNT(` then a line starting with `*)` | 500 / 500 / 500 | — |
| `` ` `` inside `'…'`, `'` inside `` `…` ``, ` `` ` inside `` `…` ``, `''` inside `'…'` | 200 | no error |
| A backtick literal compared, one line crossing nothing; one line of 256 characters with spaces before it | 200 / 200 | the expected row |
| 20 leading spaces; two leading LFs; a trailing `.`; tabs as separators | 200 | the expected row |

- **Inference.** SAP collapses whitespace before it reads a line — a run of spaces
  counts as one, leading spaces count as none, and a tab, LF or CRLF inside a literal
  becomes one space (the field-list literals); tabs are not collapsed the way spaces are
  (the tab row). It then keeps the first 255 characters of each line — characters, not
  UTF-8 bytes — and drops the rest of the line silently, joins the lines with a space (the
  message for the non-last line shows `'ZZZ )`, the `)` from line 2), and appends
  `INTO TABLE @DATA(…)` after the last line (the text in every cut-literal message, and the
  trailing `"` comment that hides it).
- **Inference.** A line break between tokens, outside a comment and not before a `*`,
  does not change what SAP executes: the lines are joined with a space (a break before a
  `*` makes a comment line, and a line break ends a `"` comment — the rows below). A line break inserted where there was no whitespace — after the
  comma of an `IN` list — works (the LF/CRLF/CR rows).
- **Measured.** A line of 255 characters is read whole and one of 256 is not, when the
  256th character is code (the 255/256 rows); a field-list literal of 253 characters
  between its quotes (255 with them) alone on its line is answered, one of 254 (256) is
  refused, `'…'` and `` `…` `` alike.
- **Inference.** A string literal without blanks longer than 255 characters with its
  delimiters cannot be read whole by SAP on any line; SAP refuses it, and that answer is
  SAP's to give.
- **Measured.** A `"` inside a `'…'` or `` `…` `` literal makes SAP refuse the statement
  (the three `"`-inside rows). **Inference:** SAP reads that `"` as a comment start (the
  message of the two-line row shows line 1 cut at the `"`), which leaves the literal
  unterminated on its line; a wrap after it does not make that literal terminated, so SAP
  refuses such a statement wrapped or not.
- **Measured.** A line whose first non-blank character is `*` is a comment, and a break
  before a `*` (`SELECT *`, `COUNT(*)`) breaks the statement (the 500 rows).

### Why 72 is enough

- **Inference.** A line of at most 72 characters as given is far inside SAP's 255:
  collapsing whitespace only shortens it (the space and leading-space rows), a character
  is one whether it takes one UTF-8 byte or more (the `Ä` rows), and a UTF-16 count is
  never below a code-point count. No row suggests a tab counts wider than one character
  (the tab row cuts later, not earlier, than the raw count); even at three columns a tab
  would leave a 72-character line inside 255.
- **Inference.** A token on a line of its own fits SAP's line whenever it is at most 255
  characters (the field-list literal rows); one that is longer is SAP's to refuse.
- **Measured.** A comment that runs past 255 does no harm (the long-comment rows), so a
  comment line, or a comment that ends a line, is left as it is whatever its length.

## Open for the spec

- **Where exactly a line breaks.** The last break point at or before 72 (fewest lines);
  whether the whitespace at a break is replaced by the line break or kept before it;
  trailing whitespace; which separator the library writes (LF, or the separator the
  statement already uses — LF, CRLF and CR are all read by SAP).
- **How a line is counted.** Whether a comment that ends a line counts towards its 72
  (it is never broken, and runs past 255 harmlessly), and what is measured in characters
  (UTF-16 code units, JavaScript's `length`, is the conservative count).
- **`getTableContents` (`/datapreview/ddic`).** It posts a caller's statement the same
  way; whether the same limit applies there (code reading or a read-only measurement) and
  whether the same wrap goes in, in this change.
- **The evidence.** Unit tests of the scanner and the wrap — the issue's statement, the
  statement whose condition past 255 was silently dropped, literals with `''` and
  ` `` `, comments of both kinds, a `*` that must not start a line, a token longer than
  72, a literal longer than 255 and a `"` inside a literal sent as they are, a statement
  that fits sent byte for byte — the request's body pinned at the connection stub, and a
  live run of the issue's statement and of the silently truncated one through the member
  against the on-premise system; the ABAP Cloud system answers the endpoint only where
  its policy allows, so its run is stated or skipped with its reason.
- **Documentation**: `packages/adt-clients/README.md` and
  `packages/adt-clients/docs/usage/CLIENT_API_REFERENCE.md` (what `getSqlQuery` sends),
  CHANGELOG.
