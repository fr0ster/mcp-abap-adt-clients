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
| `e19-http-authfield-after-fix.log` | http | `integration/core/authorizationField` after the fix | 1 passed | 22 s |
| `e19-rfc-authfield-after-fix.log` | rfc | `integration/core/authorizationField` after the fix | 1 passed | 24 s |
| `e19-shared-setup.log` | http | `shared:setup` — updates `ZAC_SHR_RUN01`, creates `ZAC_SHR_RUNPROG` | 1 passed | 35 s |
| `e19-http-executors-shared.log` | http | `integration/executors` + `runtime/traces` on shared fixtures | 10 passed | 6.1 s |
| `e19-rfc-executors-shared.log` | rfc | the same three suites | 10 passed | 7.7 s |
| `e19-http-full-verify.log` | http | full suite, this branch | **1286 passed, 0 failed**, 2 skipped | 724 s |
| `e19-rfc-full-verify.log` | rfc | full suite, this branch | 1285 passed, 1 failed, 2 skipped | 758 s |
| `e19-rfc-messageclass-trace.log` | rfc | `messageClass` with `DEBUG_ADT_LIBS` | 1 failed | 38 s |

RFC was run with the SDK on the path:

```bash
SAPNWRFC_HOME='C:\nwrfcsdk\nwrfcsdk' PATH='C:\nwrfcsdk\nwrfcsdk\lib;'"$PATH" npm test
```

## Failures

**`AuthorizationField` — full workflow — both transports. Fixed in this PR.**
`create` returned HTTP 500, `System expected the element
'{http://www.sap.com/iam/auth}auth'`. Identical under http and rfc, which put it
in the request body rather than the transport.

The endpoint's root element is `auth:auth`; the builder sent
`auth:authorizationField`. The namespace was right both times, only the local
name was wrong. Two things pin this down:

*The server's own representation.* `GET /sap/bc/adt/aps/iam/auth/ACTVT` answers
with `<auth:auth ... xmlns:auth="http://www.sap.com/iam/auth">` — the same root
it refuses to accept under any other name.

*The same POST twice, changing only the root.* Against
`POST /sap/bc/adt/aps/iam/auth` on E19, identical payload otherwise:

| Root element | Result |
| --- | --- |
| `<auth:authorizationField>` | HTTP 500, `System expected the element '{http://www.sap.com/iam/auth}auth'` |
| `<auth:auth>` | HTTP 201 Created |

The probe object was deleted afterwards (`GET` → 404). The two after-fix logs
above are the suite passing over both transports.

**`MessageClass` — full workflow — rfc only.** `lockMessage` returns HTTP 403,
`User OKYSLYTSIA is currently editing ZADT_MSGX01 001`. The same suite passed
in the http run that ran first, and a standalone re-run
(`e19-rfc-messageclass-retry.log`) fails the same way — so this is a stale
enqueue lock left on the server for message `ZADT_MSGX01 001`, not a defect in
the RFC path. Clear it in SM12 before reading the next run of this suite.

## What the pair shows

RFC reaches parity with http on this system: 1279 of the same 1283 tests, and
wall-clock within 1.4% of the http run. Running both was what placed the
`AuthorizationField` failure — a defect that reproduces identically on two
transports is in the payload, not the pipe. The one RFC-only failure went the
other way: it did not reproduce on http and it survives a standalone re-run, so
it is server state.

## The executor suites no longer build what they run

Separate from the fix above, and the reason `E_ABAP_GENPH` locks kept coming
back on E19.

`ClassExecutor` and `ProgramExecutor` each created, activated, ran and deleted a
freshly named object per test — four create/activate cycles per full run. The
object was deleted, but the enqueue on its generated parts belongs to the
session, not to the object, so the locks outlived it; two suites doing this
against one system also race each other for them. Creation is already covered by
`integration/core/class` and `integration/core/program`, so the executor suites
were paying for coverage they duplicate.

Both now run a shared read-only fixture, the way the profiler suite already did:
`ZAC_SHR_RUN01` for the class, and `ZAC_SHR_RUNPROG` — added here — for the
program. The assertions were not weakened to fit: `ZAC_SHR_RUN01` gained the
`run_probe` method so the existing `run_probe( )` assertion still means
something, and `ZAC_SHR_RUNPROG` carries the `PROGRAM_EXECUTOR_RUN_PROBE( ) = 1`
line the program suite already looked for. `e19-shared-setup.log` is the run that
brought both to that state on E19.

The three suites create nothing now — the logs contain no `create program` or
`create class` step — and they run in 6.1 s where the two executor suites alone
took 26.2 s in `e19-http.log`.

## A note on the sessions those runs left behind

The 30-minute rows in the system's session list are the documented
`inactivityTimeout: 1800`, not a leak — `globalTeardown` releases the one session
a run opens, and every log here ends with `shared session released`. The extra
sessions in that window came from manual `curl` probes, each opened with its own
cookie jar and never logged off. Probe with one jar and log off.
