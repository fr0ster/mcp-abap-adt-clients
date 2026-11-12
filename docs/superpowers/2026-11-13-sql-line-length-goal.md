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

1. **A statement whose every line fits is sent exactly as given**, byte for byte. A line
   fits when its code — everything before a comment that ends the line — is at most 255
   characters, counted so that the count is never below SAP's (one per character as
   given; a tab as the spec measures it, see Open for the spec); the comment itself may run past 255 (SAP drops only
   comment text there: measured harmless).
2. **A statement with a line that does not fit is sent with line breaks placed so that
   every line fits**, each break placed at whitespace or right after a comma — never
   inside a string literal, never inside a comment, never where it would turn code into a
   comment. Only the placement of whitespace changes; what SAP executes is the statement
   the caller wrote. The commas of a compact `IN ('…','…')` list are break points, so the
   issue's statement is laid out and answered.
3. **A statement that cannot be laid out so** — a token (a string literal with its
   delimiters, above all) longer than 255 characters, or a line whose code before the
   first possible break is longer — **is refused before any request**,
   as a failure of the member's answer carrying fixed words of the library's, not SAP's
   message and not the statement's text.
4. **A statement with a `"` inside a string literal is refused before any request**, in
   fixed words, whatever its length: SAP does not read such a literal as written (every
   measured case refused; the inferred reason is that SAP takes the `"` as a comment
   start), and where the `"` lies in text SAP would drop past 255, sending it could answer
   silently for a statement the caller did not write. A refusal never gives a wrong
   answer.

The mcp-abap-adt server's `GetSqlQuery` (and `GetTableContents`, which reads the same
endpoint through the same member) gets the fix by taking the adt-clients release that
carries it; the server's code does not change for it.

## Invariants

- **The fix lives in adt-clients.** Every ADT request is built there; the member that
  posts the statement is the one that lays it out. No caller lays out SQL for it.
- **The statement's meaning never changes.** The library inserts line breaks (or turns a
  whitespace character into one) between tokens and does nothing else: no character of a
  string literal or a comment is touched, added or removed; no token is added, removed,
  reordered, re-cased or rewritten; no comment is moved off its line. A break is never
  placed so that a line begins (after its leading whitespace) with `*`.
- **Untouched when it fits.** A statement whose every line fits (goal item 1) and that
  is not refused (goal items 3 and 4) goes on the wire as the caller's string, unchanged.
- **No regular expression.** The statement is read by one linear scanner, character by
  character, that knows the string literals (`'…'` with `''` inside, `` `…` `` with
  ` `` ` inside) and the comments (`"` outside a literal to the end of the line, a line
  whose first non-blank character is `*`). A `"` it meets inside a literal makes the
  statement one that is refused (goal item 4).
- **Static types first.** The statement is typed by the contract (`IGetSqlQueryParams`
  from `@mcp-abap-adt/interfaces-adt`, `sql_query: string`); the layout is a typed
  function from string to its result. No cast, `any`, non-null `!`, `@ts-ignore` or
  runtime check of what the compiler proves.
- **Refused before any request, in fixed words.** A statement that cannot be laid out, or
  that has a `"` inside a literal, is
  answered as a failure (`IAdtResponse`, as `adt-clients-legacy` answers an unsupported
  operation without a request) whose message is fixed words of the library's. It does not
  carry the statement, a literal, or anything of it; no request is sent for it.
- **No retry, no timeout, one request.** A statement that is laid out is sent once, as
  today; nothing is resent in another layout when SAP refuses it; the request keeps
  `timeout: 0` (no deadline of the library's).
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
  delimiters cannot be sent on any line. One with runs of blanks might fit once SAP
  collapses them, but then SAP has already changed the literal's content (the field-list
  rows); the library refuses every literal longer than 255 characters as given — a
  conservative choice of its own, not a measured impossibility.
- **Measured.** A `"` inside a `'…'` or `` `…` `` literal makes SAP refuse the statement
  (the three `"`-inside rows). **Inference:** SAP reads that `"` as a comment start (the
  message of the two-line row shows line 1 cut at the `"`).
- **Measured.** A line whose first non-blank character is `*` is a comment, and a break
  before a `*` (`SELECT *`, `COUNT(*)`) breaks the statement (the 500 rows).

### The rule the fix follows

Count the code of each line of the statement (lines separated by LF, CRLF or CR; the code
is what comes before a comment that ends the line) in characters, as given — the library
deliberately does not rely on SAP's collapsing of whitespace, so that its count is not
below SAP's (for spaces and line breaks the rows show SAP's count is no higher; for tabs
that is still to be measured, see Open for the spec), and it may break a line SAP would
have read whole, which changes nothing. When a
line's code is longer than 255 characters, break it at whitespace or right after a comma,
outside string literals and outside comments, never before a `*`, so that every line's
code holds at most 255 characters; a comment stays on the line it began on. A token that
alone is longer than 255 characters (a string literal with its delimiters, above all)
cannot be laid out, and the statement is refused before any request. A statement with a
`"` inside a literal is refused before any request.

## Open for the spec

- **Further break points.** Beyond whitespace and after a comma (required by the goal):
  whether `(` / `)` and other token boundaries without whitespace are break points
  (`a=b`, `@var`, `~`, `->`), each measured before it is used.
- **Where on a line to break.** The last break point at or before 255 (fewest lines), or
  every break point once a line is too long; what a broken line's continuation starts with
  (an LF and nothing, or the original whitespace kept); which separator the library writes
  (LF, or the separator the statement already uses).
- **How characters are counted.** UTF-16 code units (JavaScript's `length`) or code
  points; whether SAP counts a character outside the Basic Multilingual Plane as one or
  two — measured.
- **Tabs.** Whether SAP counts a tab as one character or wider (the tab row fails where
  the raw line is already longer than 255, which settles neither) — measured, and the
  library's count of a tab set so it is not below SAP's.
- **The refusal's shape.** `origin`, `code` (an `AdtObjectErrorCodes` member or a new
  one), the fixed words, and whether `request` is present (no request was sent); how the
  server's `GetSqlQuery` answers it.
- **`getTableContents` (`/datapreview/ddic`).** It posts a caller's statement the same
  way; whether the same limit applies there (to be measured) and whether the same layout
  goes in, in this change.
- **The evidence.** Unit tests of the scanner and the layout (every measured row above,
  each break point and each refusal), the request's body pinned at the connection stub,
  and a live run of the issue's statement and of the silently truncated one through the
  member against the on-premise system; the ABAP Cloud system answers the endpoint only
  where its policy allows, so its run is stated or skipped with its reason.
- **Documentation**: `packages/adt-clients/README.md` and `packages/adt-clients/docs/usage/CLIENT_API_REFERENCE.md` (what `getSqlQuery`
  sends and refuses), CHANGELOG.
