# Plan: a long one-line SQL query keeps its literals whole

Goal: `docs/superpowers/2026-11-13-sql-line-length-goal.md`. Spec:
`docs/superpowers/2026-11-13-sql-line-length-spec.md` (sections cited as "spec §n"). The
goal's decisions and invariants and the spec's rules bind every step; a step that cannot be
done as written stops and goes back to the owner.

## Rules for every step

- **npm scripts only.** No `npx`, `npm exec`, `node_modules/.bin`, `ts-node`, `timeout`.
  At the root: `npm run build`, `npm run test:check`, `npm run lint:check`, `npm test`,
  `npm run check`. A single unit file: `npm run test:unit -- <path>` in
  `packages/adt-clients`.
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
  `.worktrees/sql-line-length` (branch `fix/sql-line-length`, PR #312).

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
4. Deliberate breaks, one at a time, each turning named tests red, then reverted:
   - a break allowed inside `'…'` (the 100/300 literal cases, the issue's statement);
   - a break allowed inside `` `…` ``; `''` read as the end of a literal; doubled
     backtick read as the end;
   - a `"` comment's text counted towards 72 (the code-plus-long-comment case);
   - a break allowed before `*` (the `SELECT *` / `COUNT( * )` cases);
   - a break allowed before a comment (the long-line-ending-with-a-comment case);
   - the first usable break taken in place of the last (the greedy cases);
   - the fits check removed, always rebuilding (the identity cases: same string);
   - CRLF read as two breaks (the CRLF case);
   - a caller's line break inside a literal treated as the end of the literal (the
     caller's-break-inside-a-literal case).
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

Files: `packages/adt-clients/src/__tests__/helpers/test-config.yaml.template`
(three new `sql_query` cases), `packages/adt-clients/src/__tests__/integration/shared/sqlQuery.test.ts`
(three new gated cases).

1. Add the cases, `available_in: ["onprem"]`, each asserting the rows of the answer
   (not only that it is a document):
   - `execute_sql_query_long_line` — the issue's shape over `TDEVC`, `'$TMP'` among
     30-character items, one line of more than 255 characters: a success holding the
     `$TMP` row;
   - `execute_sql_query_tail_past_255` — `IN ('$TMP',…)` closed at 255, then
     ` AND devclass = 'NOPE'`: a success holding no row;
   - `execute_sql_query_concat_long_literal` — one line of fewer than 255 characters and
     more than 72, `SELECT devclass, concat('<a literal of 100 characters>','B') AS x FROM
     tdevc WHERE devclass = '$TMP'`: a success whose row holds the literal followed by
     `B`. Unwrapped, SAP reads this line whole, so its answer before and after the wrap
     must be the same; it is the check that breaking at blanks and commas is enough for
     a literal written against other code.
2. Before the run: say the step is ready for its live run and wait for the go. Then check
   the connection without logon (`401` with the realm naming the on-premise system), and
   run only this file from the worktree:
   `MCP_ENV_PATH=~/.config/mcp-abap-adt/sessions/e19-tunnel.env npm test -- integration/shared/sqlQuery`
   in `packages/adt-clients`, with the worktree's own gitignored `test-config.yaml`
   (copied from the main checkout's and extended with the three cases). Any credential
   refusal stops everything.
3. Run the three statements once against today's code too (the main checkout at
   `adt-clients-v45.5.0`, read only, the same file and config) to record the before:
   the first fails `400`, the second answers one row, the third answers its row. If the
   third is refused already before the change, its form is SAP's syntax question, not the
   wrap's: that is reported, and the case is not counted as evidence either way.
4. **A case that fails live after the change is the "not enough" signal**: it is reported
   to the owner with SAP's answer and the sent text, and not fixed in this task (no new
   break points, no change of the rule). Only a case that passes is committed as a test.
5. Results (status, rows, the sent text's line lengths) go into the PR description, not a
   file. Commit `test(sql): live cases for the long line, the tail past 255 and a literal
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
   `adt-strategies` and `adt-clients-legacy` take no change and no version.
2. The PR description gets what the working documents still owe: the server follow-up
   (below), the live results of step 3, and the owner's one open question, if any case
   failed. Then the last commit deletes the goal, spec and plan
   (`docs/superpowers/2026-11-13-sql-line-length-*.md`).
3. `npm run check` at the root; CI's step list; push; CI green; the PR leaves draft for
   review. After the review's approval and green CI: merge, tag
   `adt-clients-v45.5.1` at the merge commit, ready the publish checkout (the main
   checkout at the tag, built, `npm run check`). The publish is the owner's
   (`npm run release:publish`). The CHANGELOG date is checked against the release day
   before the tag.

## After the release — the server follow-up (mcp-abap-adt, its own PR)

Named here, done in the server's repository after `@mcp-abap-adt/adt-clients` 45.5.1 is on
the registry: bump the dependency to `^45.5.1` (the registry version, no link), no code
change in `handleGetSqlQuery.ts` or `handleGetTableContents.ts`, its CHANGELOG naming
#350 for 24.0.0, and its live `GetSqlQuery` run with the issue's statement; then close
mcp-abap-adt#350 with a link to the release.
