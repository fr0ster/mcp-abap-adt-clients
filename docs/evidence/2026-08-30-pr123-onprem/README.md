# PR #123 verified on E19 — both transports, logs whole

Branch `feat/a-trace-can-be-deleted` at `ee07af0`, `@mcp-abap-adt/interfaces@25.0.0`
installed. E19 (`RFCSAPRL 816`, kernel `916`, client 100), one SAP-touching run
at a time, one session each, released at teardown.

| log | transport | result |
|---|---|---|
| `traces-http.log` | HTTP | `integration/runtime/traces` — 1 suite, **7 tests**, green |
| `traces-rfc.log` | RFC | the same suite — 1 suite, **7 tests**, green |

Six of those seven existed before; the seventh is this PR's `delete trace`.

## What the logs do not show, and how it was checked instead

Both runs end with `Force exiting Jest`, and the last test's trailing output
goes missing with it: `→ delete trace <id>` is there, but in `traces-http.log`
the `after delete, attempt N: trace gone from the feed` line the test writes is
not.

**It is a reordering, not a plain truncation** — `traces-rfc.log` shows the
mechanism, because there the line *does* survive and lands **after** jest's own
`Ran all test suites` summary:

```
Ran all test suites matching integration/runtime/traces.
  → after delete, attempt 1: trace gone from the feed
[7] ✓ PASS Profiler Traces - delete trace (0.3s)
```

The suite writes progress straight to stdout from a jest worker, and that output
reaches the parent through an asynchronous relay that `forceExit: true` does not
wait for. So it is a race the last test loses, not our process buffering: a
direct probe on this platform showed `process.stdout.write` followed by
`process.exit()` losing nothing at all, to a pipe or to a file.

Either way that is precisely the assertion the test exists for, so it was
confirmed a second way — reading the feed through the library after the HTTP
run:

```
traces in feed: 69
F132F118A45D11F1B5CA0CC47A1E68C1 present: false
```

`F132F118A45D11F1B5CA0CC47A1E68C1` is the trace the profiled run in
`traces-http.log` produced. After `delete()` it is gone from the feed.

## One thing the RFC log does not record

The RFC run needs the SAP NW RFC SDK visible **when dependencies are installed**,
not only when the tests run. Measured on this machine, same lockfile, twice:

| install | packages | `sap-rfc-lite` |
|---|---|---|
| `npm ci` | 1675 | absent |
| `SAPNWRFC_HOME=… PATH=…lib;… npm ci` | 1678 | present, at `node_modules/@mcp-abap-adt/connection/node_modules/@mcp-abap-adt/sap-rfc-lite` |

`@mcp-abap-adt/connection` declares it under `optionalDependencies`, and the
lockfile marks it `optional: true` with `hasInstallScript: true` — a native
binding built by `node-gyp-build`. npm drops an optional dependency whose build
fails, and says nothing. Without the SDK on the machine at install time the build
cannot succeed, so the package is skipped; `connection_type: "rfc"` then fails in
`globalSetup` with

```
@mcp-abap-adt/sap-rfc-lite is not available … Cannot find module
```

which reads like a missing package rather than an SDK that was missing an hour
earlier. For this run it was installed with `npm install --no-save`; neither
`package.json` nor `package-lock.json` changed.

Unrelated to this PR. But `CLAUDE.md` shows the SDK variables only on the
`npm test` line, and on a clean checkout that is not enough to get RFC at all.
