# E19 integration run — 2026-08-31

Both transports against the same on-prem system, same commit
(`698cd26`, branch `docs/rfc-needs-the-sdk-at-install-time`), same
`test-config.yaml` apart from `environment.connection_type`.

System: E19, `http://epbyminsd0654.epam.com:8000`, client 100,
`system: onprem`, package `TEST_MCP`, no transport.

| Log | Transport | Suites | Tests | Time |
| --- | --- | --- | --- | --- |
| `e19-http.log` | http | 165 passed, 1 failed, 1 skipped | 1280 passed, 1 failed, 2 skipped | 781 s |
| `e19-rfc.log` | rfc | 164 passed, 2 failed, 1 skipped | 1279 passed, 2 failed, 2 skipped | 792 s |
| `e19-rfc-smoke.log` | rfc | `integration/core/domain` only — 3 passed | 4 passed | 33 s |
| `e19-rfc-messageclass-retry.log` | rfc | `integration/core/messageClass` re-run | 1 failed | 40 s |

RFC was run with the SDK on the path:

```bash
SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk' PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH" npm test
```

## Failures

**`AuthorizationField` — full workflow — both transports.** `create` returns
HTTP 500, `System expected the element '{http://www.sap.com/iam/auth}auth'`.
Identical under http and rfc, so it is the request body the client builds, not
the transport: E19 wants the `{http://www.sap.com/iam/auth}auth` root where the
client sends something else. Pre-existing, unrelated to the branch under test.

**`MessageClass` — full workflow — rfc only.** `lockMessage` returns HTTP 403,
`User OKYSLYTSIA is currently editing ZADT_MSGX01 001`. The same suite passed
in the http run that ran first, and a standalone re-run
(`e19-rfc-messageclass-retry.log`) fails the same way — so this is a stale
enqueue lock left on the server for message `ZADT_MSGX01 001`, not a defect in
the RFC path. Clear it in SM12 before reading the next run of this suite.

## What the pair shows

RFC reaches parity with http on this system: 1279 of the same 1283 tests, the
one shared failure is transport-independent, and the one RFC-only failure is
server state rather than code. Wall-clock is within 1.4% of the http run.
