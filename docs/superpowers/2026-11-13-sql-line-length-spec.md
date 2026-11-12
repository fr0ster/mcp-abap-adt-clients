# Spec: a long one-line SQL query keeps its literals whole

The goal is `docs/superpowers/2026-11-13-sql-line-length-goal.md`; its decisions and
invariants bind this spec. Labels: **Measured** (observed by running against the
on-premise system over HTTP), **Code** (read in the source named), **Inference**
(concluded, not observed).

## 1. Where the wrap lives

- **One new module**, `packages/adt-clients/src/core/shared/sqlLines.ts`, exporting one
  function:

  ```ts
  export function wrapSqlLines(statement: string): string;
  ```

  It is internal to adt-clients: not re-exported from `src/index.ts`, not part of a
  contract, no option, no constant a caller can change. `72` is a module constant
  (`SQL_LINE_WIDTH`), the one place the width lives.
- **`getSqlQuery`** (`packages/adt-clients/src/core/shared/sqlQuery.ts`) sends
  `data: wrapSqlLines(params.sql_query)` in place of `data: params.sql_query`. Nothing
  else in the request changes: the URL and `rowNumber`, `method: 'POST'`, `timeout: 0`,
  `requestHeaders(headers)`. `AdtUtils.getSqlQuery` (`AdtUtils.ts`, lines 828–837) is
  unchanged: the same `answering`, `results.query`, `options.analyse`.
- **`getTableContents` (`/datapreview/ddic`) is not changed.** **Measured** (the same
  system, `POST /sap/bc/adt/datapreview/ddic?rowNumber=5&ddicEntityName=TDEVC`):

  | Case (`TDEVC~DEVCLASS` syntax) | Status | Answer |
  |---|---|---|
  | One line, `IN (…)` closed at 255, then ` AND TDEVC~DEVCLASS = 'NOPE'` | 200 | no row — the condition past 255 was read |
  | The same with LF before `AND` | 200 | no row |
  | One line, the last literal of the `IN` list ending at 256 (crossing 255) | 200 | the `$TMP` row |
  | The same with LF before that literal | 200 | the `$TMP` row |

  The ddic preview reads a line past 255 whole, so it has neither the cut literal nor
  the silently dropped condition; wrapping its statement would change what is sent for
  no gain. (Its `totalRows` is `0` on every row, the known ddic answer the server's
  `GetTableContents` comment describes; not this change's.)
- **`adt-clients-legacy`** refuses `getSqlQuery` without a request
  (`AdtUtilsLegacy.ts`, lines 264–269) and is unchanged.
- **The server** (mcp-abap-adt) changes no code: its `GetSqlQuery` and `GetTableContents`
  both call `getUtils().getSqlQuery`, and get the wrap by taking the adt-clients release
  that carries it (the server's own dependency bump, outside this repository).

## 2. The scanner

`wrapSqlLines` reads the statement once, left to right, character by character, with an
index into the string and a small state; no regular expression, no `split` over the
statement, no recursion. Its states:

| State | Entered by | Left by |
|---|---|---|
| `code` | the start; the end of a literal; a line break outside a literal | — |
| `quote` (`'…'`) | `'` in `code` | `'` not followed by `'`; `''` is two characters of the literal and stays in `quote` |
| `backtick` (`` `…` ``) | `` ` `` in `code` | `` ` `` not followed by `` ` ``; ` `` ` stays in `backtick` |
| `comment` (`"` …) | `"` in `code` | the next line break |
| `star-line` | a line whose first non-blank character, in `code` at the start of the line, is `*` | the next line break |

- **Line breaks** are LF, CR and CRLF (CRLF is one break). In `code`, `comment` and
  `star-line` a break ends the physical line. In `quote` or `backtick` a break the caller
  wrote stays inside the literal: the literal goes on, the next physical line begins
  inside it, and that line is never a `star-line` (goal: "line breaks the caller wrote
  inside a literal stay as they are").
- **A `"` inside a literal** is a character of the literal (goal decision 2: sent as it
  is, wrapped like everything else).
- **Blank** characters are space (U+0020) and tab (U+0009). Nothing else is whitespace to
  the scanner.

## 3. The wrap

**The fits check.** A physical line's *code length* is the number of UTF-16 code units
(`String.prototype.length` counting) from the line's start up to the first character of a
`comment` or of a `star-line` on it, or up to its end. When no physical line has a code
length above 72, `wrapSqlLines` returns its argument itself (the same string, goal
decision 1: byte for byte).

**Break points.** In `code` only:

- a **run of blanks** between two characters of code — the break replaces the whole run
  with one LF (the goal invariant: "replaces the whitespace between two tokens with
  one"; SAP collapses runs, **Measured**);
- the **position right after a comma** that is not followed by a blank — the break
  inserts one LF there (a comma followed by blanks breaks at that run).

A break point is **not usable** when:

- the next non-blank character after it is `*` (the line would become a comment line —
  `SELECT *`, `COUNT( *`; **Measured**: 500);
- the next non-blank character after it begins a `comment` on the same line (the comment
  would move off its line);
- it is at the start of the line's code (before the first non-blank character): leading
  blanks are left as the caller wrote them.

**The greedy rule.** For each physical line whose code length is above 72, from its
start: let *col* be the code length of the output line built so far. Take the last
usable break point at which the output line's code length is at most 72, and break there;
if there is none, take the first usable break point after it (the token before it goes
alone on its line, as it is, goal decision 1). Repeat on the rest of the line until the
rest fits or has no usable break point. A comment that ends the physical line stays on
the last output line of it; its length is not counted (goal: "a line long only because
of its comment is left as it is").

**A token** is the text between two usable break points (or a line's start or end and
a break point). The wrap never cuts a token; a token longer than 72 goes whole on an
output line of its own — that is what "a token longer than 72 goes on its own line as
is" means here. A literal is always inside one token and so is never cut. A literal is
alone on its line when blanks or commas surround it (an `IN ('…','…')` list, a
comparison `= '…'`); when the caller wrote it against other code with no break point
between — `concat('…','B')` (the `concat(` before it), `'…' * 2` (no break before `*`)
— the literal travels whole inside its token, with that code on the same line. Adding
break points next to a literal (after `(`, before `)`) is not done: the owner's break
points are blanks and commas, and a break where the caller wrote no blank is made only
after a comma.

**What is written.** Each inserted break is one LF (`\n`), whatever separator the
statement uses elsewhere; SAP reads LF, CRLF and CR alike (**Measured**). Every character
that is not part of a replaced blank run is copied as it is, in order: literals, comments,
the caller's own line breaks, leading blanks, trailing blanks of a line that is not
broken.

**Properties the tests check** (each a test, section 4):

1. *Identity when it fits*: `wrapSqlLines(s) === s` for every `s` whose code lines are all
   at most 72.
2. *Only whitespace moves*: removing every LF the wrap inserted, with the blank runs it
   replaced, gives back `s` modulo the replaced runs — checked by a test helper that walks
   both strings with the same scanner states, not by a regular expression.
3. *Literals byte-identical*: the sequence of literals (with their delimiters) read from
   the output equals the sequence read from the input, each on one line of the output when
   it was on one line of the input.
4. *No line starts a comment it did not start*: every output line whose first non-blank
   character is `*` was such a line in the input; no `"` comment begins on a different
   line than it did.
5. *Greedy*: on an overlong line the break taken is the last usable one at which the
   output line's code is at most 72 — never an earlier one — and the first usable one
   after 72 only when there is none at or before it.
6. *Width*: every output line whose code holds a usable break point at or before 72 has a
   code length of at most 72; a longer output line holds a single token (a literal or a
   run with no usable break point) plus, at most, the comment that ends it.
7. *Linear*: one pass; the output is built by appending slices of the input and LFs.

## 4. Tests

Unit tests (Jest, as every adt-clients unit test today), no SAP.

- **`src/__tests__/unit/shared/sqlLines.test.ts`** — `wrapSqlLines` alone:
  - the issue's statement (334 characters, `IN ('AAA…',…,'GGG…','Z_FLIGHT_ADDITIONAL')`):
    the exact expected output string (each break right after the comma that is the last
    one at or before 72); properties 2 and 3;
  - the greedy choice, each with its exact expected output: a blank run and a comma both
    before 72 (the later one taken); a break point ending exactly at 72 (taken) and one at
    73 (not taken, the earlier one is); no break point at or before 72 (the first one after
    it taken); a comma followed by blanks (the blank run replaced, the comma kept on the
    first line);
  - `concat('<100 characters>','B')` and `'<100 characters>' * 2` in a long line: the
    literal whole, with the code of its token on the same line (the exact output);
  - the silently-truncated statement (`IN ('$TMP',…)` closed at 255, then
    ` AND devclass = 'NOPE'`): the `AND devclass = 'NOPE'` condition on a line at most 72
    characters into the output, whole;
  - a statement of 72 characters and one of 73: the first returned as the same string, the
    second broken;
  - a literal of 100 characters and one of 300 characters, `'…'` and `` `…` ``, in a long
    line: each byte-identical and alone on its own line in the output (the owner's pin);
  - a literal longer than 255, and a literal holding `"`, `''`, `` ` ``, ` `` `: sent whole,
    no break inside, the wrap going on after it;
  - a caller's LF, CRLF and CR inside a literal: kept as they are, no break inside;
  - `SELECT *` and `COUNT( * )` on a long line: no output line starts with `*`;
  - a long line ending with a `"` comment: the comment on the last output line of it; a
    line of code at most 72 plus a comment of 300: returned unchanged; a `*` comment line
    of 300: unchanged;
  - a long run of code with no break point (more than 72 characters): alone on its line;
  - blank runs and tabs at break points: replaced by one LF; leading blanks of a line
    kept; the caller's CRLF / CR between lines kept;
  - Ä and characters outside the BMP counted by `length`;
  - the property checks of section 3 over every case above.
- **`src/__tests__/unit/shared/sqlQueryWrapsLines.test.ts`** — `getSqlQuery` through
  `AdtUtils` over a recording connection (as `sqlToolsSetNoTimeout.test.ts` builds one):
  the `data` the connection received is asserted directly, as a string, for:
  - the issue's statement — the exact expected wrapped text;
  - the silently-truncated statement — the exact expected wrapped text;
  - literals of 100 and of 300 characters, `'…'` and `` `…` ``, in a long `IN` list —
    each literal found in the sent text byte-identical and alone on one line (the owner's
    pin, at the request boundary);
  - a long statement with a literal holding `"` — sent whole, wrapped like the rest; the
    connection stub then answers SAP's 400 (`ExceptionDataPreviewGeneral`, the measured
    "Literals across more than one line are not allowed."), and the member's failure is
    that answer as `answering` reads it today, after exactly one request;
  - a short statement — the same string as given;
  - every case: the URL, method, headers and `timeout: 0` as before, one request.

  `getTableContents` sends its statement as given (a long one too).
- **`sqlToolsSetNoTimeout.test.ts`** stays as it is.

Integration (live, the on-premise system; `src/__tests__/integration/shared/sqlQuery.test.ts`,
gated like its two existing cases, with two new cases in
`src/__tests__/helpers/test-config.yaml.template` under `sql_query`, `available_in:
["onprem"]`):

- `execute_sql_query_long_line` — the issue's shape over `TDEVC` with `'$TMP'` as the item
  that crosses 255 once unwrapped: a success, and the document holds the `$TMP` row.
- `execute_sql_query_tail_past_255` — `IN ('$TMP',…)` closed at 255, then
  ` AND devclass = 'NOPE'`: a success, and the document holds no row (today: one row).

The ABAP Cloud system refuses the endpoint by its policy; the cases are `onprem` only and
skip elsewhere with their reason, as the existing two do.

## 5. Documentation and release

- `packages/adt-clients/docs/usage/CLIENT_API_REFERENCE.md`, beside the legacy note
  (line 1558): `getSqlQuery` wraps a statement whose lines exceed 72 characters — at
  blanks and after commas, never inside a literal or a comment — because the freestyle
  preview keeps 255 characters of a line and drops the rest; a statement that fits is
  sent as given; the library refuses nothing, SAP's answer is passed on.
- `packages/adt-clients/README.md`: one line where `getSqlQuery` is described (the same
  facts, pointing to the reference).
- `packages/adt-clients/CHANGELOG.md`: a patch entry (45.5.1) — a fix of what is sent; no
  contract, type or answer changes. The date is set on every edit and checked before the
  tag.
- `adt-strategies` and `adt-clients-legacy` take no change and no release.
- Before the release: `npm run build`, `lint:check`, `test:check`, the unit tests of every
  package, and the live integration run of `sql_query` against the on-premise system; the
  dependency ranges resolve on the registry. After the publish, the server bumps
  `@mcp-abap-adt/adt-clients` in its own PR for 24.0.0.
- This goal and spec (and the plan) are deleted before the release that ships the work.
