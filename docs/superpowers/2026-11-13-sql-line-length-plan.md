# Plan: a long one-line SQL query keeps its literals whole

Goal: `docs/superpowers/2026-11-13-sql-line-length-goal.md`. Spec:
`docs/superpowers/2026-11-13-sql-line-length-spec.md` (sections cited as "spec §n"). The
goal's decisions and invariants and the spec's rules bind every step; a step that cannot be
done as written stops and goes back to the owner.

## Rules for every step

- **npm scripts only.** No `npx`, `npm exec`, `node_modules/.bin`, `ts-node`, `timeout`.
  At the root: `npm run build`, `npm run test:check`, `npm run lint:check`, `npm test`,
  `npm run check`. A single test file, in `packages/adt-clients`:
  `MCP_ENV_PATH=/tmp/nonexistent-env npm test -- <path of the file>` (`npm test` is
  `jest --runInBand`, so the one path given is the only one selected; its `pretest` runs
  the integration typecheck and `check:config`, which needs no overlay for unit tests).
- **Registry dependencies only.** No dependency is added or changed by this work. If an
  install happens, the lockfile is checked: `"link": true` only for the repository's own
  three packages; nothing else linked or resolved from a path. Lockfiles are regenerated
  by npm, never edited by hand.
- **Production code:** no regular expression, no `split` over the statement, no cast,
  `any`, non-null `!`, `@ts-ignore` / `@ts-expect-error`; no timeout, retry or resend; no
  refusal of the library's.
- **Tests first.** Each code step writes its tests, runs them red against today's code,
  then changes the code until green. After green, each rule the step names is broken
  deliberately on its own in the production code, the named tests go red, and the break
  is reverted.
- **Commits by path** (`git add <paths>`, never `-A`), each message ending with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013FwzVzuPQdYVh3bHZmipzj
  ```

  No `--no-verify`, no force-push.
- **CI after each push**: the PR's checks are watched to the end; a red check is fixed
  before the next step. Before a push, CI's own step list runs locally at the root:
  `npm ci --ignore-scripts`, `npm audit --audit-level=moderate`, `npm run build`,
  `npm run test:check`, `npm run lint:check`, `MCP_ENV_PATH=/tmp/nonexistent-env npm test`,
  `npm run check:packed`, `npm run check:publish`, `npm run check:publish:root`
  (`.github/workflows/ci.yml`).
- **The main checkout is not switched.** Work happens in
  `.worktrees/sql-line-length` (branch `fix/sql-line-length`, PR #312). The main
  checkout stays on `main`; it is only fast-forwarded after the merge (step 5) and read
  for its local overlay (step 3).

## Step 1 — the scanner and the wrap, tests first

Files: `packages/adt-clients/src/__tests__/unit/shared/sqlLines.test.ts` (new),
`packages/adt-clients/src/core/shared/sqlLines.ts` (new).

1. Write `sqlLines.test.ts` with every case of spec §4 for `wrapSqlLines`, each with its
   exact expected output string, and a test helper that checks the properties of spec §3
   (identity when it fits, only whitespace moves, literals byte-identical and on one line,
   no new comment line, greedy, width) by walking input and output with the scanner's
   states in plain code.
2. Add a stub `sqlLines.ts` exporting `wrapSqlLines` that returns its argument, so the
   file compiles; run the file: every case that expects a wrap is red, the identity cases
   green.
3. Implement spec §2 and §3: one pass, the states `code` / `quote` / `backtick` /
   `comment` / `star-line`, LF / CR / CRLF, the fits check by `length`, the two kinds of
   break point and the three rules that make one unusable, the greedy rule, LF written,
   everything else copied. `SQL_LINE_WIDTH = 72` the one constant. Green.
   The literal fixtures are built so that a scanner blind to literals would break inside
   them: the 100- and 300-character literals (both delimiters) hold blanks and commas
   every ten characters, and begin before column 72, so their first inner blank or comma
   is a break point a literal-blind wrap would take; the same for the `''` and doubled
   backtick fixtures, whose doubled delimiter is followed by an inner blank.
4. Deliberate breaks, one at a time, each turning named tests red, then reverted:
   - the scanner never enters `quote` (the 100/300 `'…'` cases with inner blanks and
     commas);
   - the scanner consumes `''` as one pair and then leaves `quote` (a literal
     `'A'' B, C…'` whose `''` is followed by inner blanks and commas before column 72,
     and its closing `'` after it: the inner break point is taken and the test is red);
   - the same two for `backtick` (the `` `…` `` cases; a doubled backtick consumed as a
     pair that then leaves `backtick`, in the same kind of fixture);
   - a `"` comment's text counted towards 72 (the code-of-60-plus-comment-of-300 case
     is wrapped instead of returned as it is);
   - the "not before `*`" rule removed — fixtures in which the blank before `*` is the
     last break point at or before column 72 and the next break point lies after 72
     (`SELECT *` and `COUNT( *)` placed so the blank before `*` stands at column 70,
     with code running from the `*` past column 72 with no blank or comma in it), each
     with its exact expected output: red;
   - the "not before a comment" rule removed — a fixture of a token longer than 72, then
     blanks, then a `"` comment, so the blank run before the comment is the first break
     point after 72 and the wrap would take it; its exact expected output keeps the
     comment on the token's line: red;
   - the first usable break at or before 72 taken in place of the last (the greedy cases
     with two candidates);
   - the width 71 in place of 72, and separately 73 (the 72- and 73-character cases and
     the break-point-at-72 case);
   - CR alone not read as a line break (a statement of short lines separated by CR alone
     whose whole length is above 72: wrapped instead of returned as it is);
   - a caller's line break inside a literal read as the end of the literal (a literal
     with an inner LF followed, on the next physical line, by `*` and a blank: a
     `star-line` read wrongly, so the following text is not wrapped as code).
5. `npm run test:check`, `npm run lint:check`. Commit
   `fix(sql): wrapSqlLines — wrap a statement's long lines at 72, outside literals and comments`.

## Step 2 — `getSqlQuery` sends the wrapped statement, tests first

Files: `packages/adt-clients/src/__tests__/unit/shared/sqlQueryWrapsLines.test.ts` (new),
`packages/adt-clients/src/core/shared/sqlQuery.ts`.

1. Write `sqlQueryWrapsLines.test.ts` over a recording connection (built as
   `sqlToolsSetNoTimeout.test.ts` builds one), through `AdtUtils.getSqlQuery`, with every
   case of spec §4: the exact `data` sent for the issue's statement and the tail-past-255
   statement; the 100- and 300-character literals in both delimiter forms byte-identical
   and alone on a line of the sent text; the `"`-inside-a-literal statement sent whole,
   the stub's SAP 400 answered as `answering` reads it, exactly one request; a short
   statement sent as the same string; URL, method, headers and `timeout: 0` unchanged;
   `getTableContents` sending a long statement as given.
2. Run it: the wrapped-statement cases are red against today's `sqlQuery.ts`.
3. Change `sqlQuery.ts`: `data: wrapSqlLines(params.sql_query)`. Green;
   `sqlToolsSetNoTimeout.test.ts` still green.
4. Deliberate breaks, each reverted: `data: params.sql_query` again (the wrapped cases
   red); `getTableContents` given the wrap too (its as-given case red).
5. `npm run test:check`, `npm run lint:check`, the root `npm test`. Commit
   `fix(sql): getSqlQuery sends the statement wrapped at 72 (mcp-abap-adt#350)`; run
   CI's step list locally; push; watch CI.

## Step 3 — the live check on the on-premise system

This step's first run happens **between step 1 and step 2** (the cases written, the
member still sending the statement as given), its second after step 2. So the before and
after are run by the same test file in the same worktree, and no other checkout is
needed.

Files: `packages/adt-clients/src/__tests__/helpers/test-config.yaml.template`
(three new `sql_query` cases), `packages/adt-clients/src/__tests__/integration/shared/sqlQuery.test.ts`
(three new gated cases).

1. Add the cases, `available_in: ["onprem"]`, each asserting the rows of the answer
   (not only that it is a document):
   - `execute_sql_query_long_line` — the issue's shape over `TDEVC`: an `IN` list of
     30-character items on one line, with `'$TMP'` the item that spans column 255 (it
     begins at 252 and ends at 257) and the closing `)` after it; the case asserts these
     positions of its fixture string (`indexOf` on the string) before it sends it, so the live case is
     the cut literal and nothing else: a success holding the `$TMP` row;
   - `execute_sql_query_tail_past_255` — `IN ('$TMP',…)` closed at 255, then
     ` AND devclass = 'NOPE'`: a success holding no row;
   - `execute_sql_query_concat_long_literal` — one line of fewer than 255 characters and
     more than 72, `SELECT devclass, concat('<a literal of 100 characters>','B') AS x FROM
     tdevc WHERE devclass = '$TMP'`: a success whose row holds the literal followed by
     `B`. Unwrapped, SAP reads this line whole, so its answer before and after the wrap
     must be the same; it is the check that breaking at blanks and commas is enough for
     a literal written against other code.
   Each case runs the member over the test's connection wrapped by a recording
   connection in the test (test code only, as the unit tests record a request): the
   `data` actually sent, with each line's length, goes to the test logger, labelled
   "sent"; the case also logs `wrapSqlLines` of its fixture labelled "expected after the
   fix" (in the before run the two differ, in the after run they are equal, and the case
   asserts that equality after step 2); on a failure it logs SAP's status, `adtType` and
   message as the member's answer carries them, so a failure leaves its evidence in the run's log
   without another live run. The fixtures hold only `TDEVC` package names.
2. Before each run: say the step is ready for its live run and wait for the go. Then check
   the connection without logon — a plain `curl` of the discovery URL without
   credentials, which is not project tooling: `401` with the realm naming the on-premise
   system — and
   run only this file from the worktree, in `packages/adt-clients`:
   `DEBUG_ADT_TESTS=true MCP_ENV_PATH=<the on-premise system's session file under ~/.config/mcp-abap-adt/sessions/> MCP_TEST_OVERLAY=<the main checkout's per-system overlay for the on-premise system, packages/adt-clients/src/__tests__/helpers/test-config.overlay.<system>.yaml, absolute> npm test -- src/__tests__/integration/shared/sqlQuery.test.ts`.
   `DEBUG_ADT_TESTS=true` switches on the test logger (`createTestsLogger()` is silent
   without it), so the evidence of item 1 reaches the run's log. The cases come from the
   tracked template (item 1); the overlay is the existing
   per-system one, read, not copied or changed. Any credential refusal stops everything.
3. **The before** (between steps 1 and 2): the long-line case fails (`400`), the
   tail-past-255 case fails (one row where none is right), the concat case passes (SAP
   reads its line whole). If the concat case is refused already here, its form is SAP's
   syntax question, not the wrap's: that is reported to the owner, and the plan waits for
   the owner's choice of form before going on.
4. **The after** (after step 2): all three must pass. **A case that fails is the "not
   enough" signal**: the plan stops here; the failure goes to the owner with SAP's answer
   and the sent text, and nothing is fixed in this task (no new break points, no change of
   the rule). No case is dropped, and step 4 and step 5 wait for the owner's decision.
5. Results (status, rows, the "sent" text's line lengths of both runs, read from the run's log) go into
   the PR description, not a file. The run's log is kept in the scratchpad until then. Commit `test(sql): live cases for the long line, the tail past 255 and a literal
   in concat`; push; watch CI (the cases skip there with their reason).

## Step 4 — documentation

Files: `packages/adt-clients/docs/usage/CLIENT_API_REFERENCE.md`,
`packages/adt-clients/README.md`, `packages/adt-clients/CHANGELOG.md`.

- `CLIENT_API_REFERENCE.md`, beside the legacy note: what `getSqlQuery` sends (spec §5) —
  a statement whose lines exceed 72 characters is wrapped at blanks and after commas,
  never inside a literal or a comment, because the freestyle preview keeps 255 characters
  of a line and drops the rest; a statement that fits is sent as given; the library
  refuses nothing; `getTableContents` sends as given.
- `README.md`: one line where `getSqlQuery` is described, pointing to the reference.
- `CHANGELOG.md`: a `45.5.1` entry — the fix, what is sent, the live evidence, and that
  no contract, type or answer changes; the entry's date set on each edit.
- `npm run lint:check` (its `check:docs`). Commit `docs(sql): getSqlQuery wraps long
  lines`; push; watch CI.

## Step 5 — release 45.5.1

1. `packages/adt-clients/package.json` version `45.5.1`; the lockfile regenerated by npm
   (`npm install --ignore-scripts` at the root), then checked as in the rules.
   `adt-strategies` and `adt-clients-legacy` take no change and no version. Every
   dependency range in `packages/adt-clients/package.json` is checked against the
   registry (`npm view <name>@<range> version` answers a published version for each);
   none is `file:`, `link:` or `workspace:`.
2. The PR description gets what the working documents still owe: the server follow-up
   (below), the live results of step 3, and the owner's one open question, if any case
   failed. Then the last commit deletes the goal, spec and plan
   (`docs/superpowers/2026-11-13-sql-line-length-*.md`).
3. `npm run check` at the root; CI's step list; push; CI green; the PR leaves draft for
   review. After the review's approval and green CI: merge, tag
   `adt-clients-v45.5.1` at the merge commit, ready the publish checkout (the main
   checkout's `main` fast-forwarded to the merge commit, which the tag names — not
   switched — then built and `npm run check`). The publish is the owner's
   (`npm run release:publish`). The CHANGELOG date is checked against the release day
   before the tag.
4. After the owner's publish: a clean install from the registry outside the repository
   (a new directory in the scratchpad holding a minimal `package.json` whose one script,
   `smoke`, loads the package's entry): `npm install @mcp-abap-adt/adt-clients@45.5.1
   --ignore-scripts`, then `npm run smoke`, which must exit 0; the lockfile there checked
   for anything not resolved from the registry; the directory deleted afterwards. A registry that lags is
   "not visible yet", rechecked, never a reason to republish.

## After the release — the server follow-up (mcp-abap-adt, its own PR)

Named here, done in the server's repository after `@mcp-abap-adt/adt-clients` 45.5.1 is on
the registry: bump the dependency to `^45.5.1` (the registry version, no link), no code
change in `handleGetSqlQuery.ts` or `handleGetTableContents.ts`, its CHANGELOG naming
#350 for 24.0.0, and its live `GetSqlQuery` run with the issue's statement; then close
mcp-abap-adt#350 with a link to the release.
