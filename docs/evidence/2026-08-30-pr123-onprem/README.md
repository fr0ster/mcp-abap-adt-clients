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

Both runs end with `Force exiting Jest`, and the last test's trailing output is
lost to it: `→ delete trace <id>` is there, but the `after delete, attempt N:
trace gone from the feed` lines the test writes are not. That is precisely the
assertion the test exists for, so it was confirmed a second way — reading the
feed through the library after the HTTP run:

```
traces in feed: 69
F132F118A45D11F1B5CA0CC47A1E68C1 present: false
```

`F132F118A45D11F1B5CA0CC47A1E68C1` is the trace the profiled run in
`traces-http.log` produced. After `delete()` it is gone from the feed.

## One thing the RFC log does not record

The RFC run does not work on a clean `npm ci`: `@mcp-abap-adt/sap-rfc-lite` is
in `package-lock.json` as an optional dependency nested under `connection`, and
`npm ci` does not place it — `npm install` then reports `up to date` without
fixing it. It was installed with `npm install --no-save` for this run, so
neither `package.json` nor `package-lock.json` changed. Unrelated to this PR,
but `CLAUDE.md` promises "nothing to install in this package", and on a clean
checkout that is currently untrue.
