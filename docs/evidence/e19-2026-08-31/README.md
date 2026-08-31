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
| `e19-rfc-messageclass-trace.log` | rfc | `messageClass` with `DEBUG_ADT_LIBS`, before the fix | 1 failed | 38 s |
| `e19-rfc-full-fixed.log` | rfc | full suite with the message-lock fallback | 1285 passed, 1 failed, 2 skipped | 727 s |

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
`User OKYSLYTSIA is currently editing ZADT_MSGX01 001`. This first read as a
stale enqueue to clear in SM12. It is not — see "The remaining red line" below,
which is what the probes actually established.

## What the pair shows

RFC reaches parity with http on this system: 1279 of the same 1283 tests, and
wall-clock within 1.4% of the http run. Running both was what placed the
`AuthorizationField` failure — a defect that reproduces identically on two
transports is in the payload, not the pipe. The one RFC-only failure went the
other way: it does not reproduce on http at all, and chasing that asymmetry is
what exposed a latent dependency on http's statelessness that had been there all
along.

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

## `MessageClass` over rfc: what it was, and the fix

Over rfc this suite failed at the first `LOCK_MSG` on `ZADT_MSGX01 001`:
`403 ExceptionResourceNoAccess`, "User OKYSLYTSIA is currently editing". It now
passes on both transports. The road to that is below, wrong turns included,
because most of them looked right at the time.

Probed on E19, each step in its own process so no session can carry state:

| Probe (rfc) | Result |
| --- | --- |
| bare `LOCK_MSG`, nothing before it | **200**, and `lockClassForMessage` after it also 200; both released |
| `delete` alone | 200 |
| `create` alone, then `LOCK_MSG` | **403** |
| `create`, then `LOCK_MSG` on 001 / 002 / 003 | **403 on all three** |
| `create`, then a plain class `LOCK` | **403** |
| `create`, then `UNLOCK_ALL`, then `LOCK_MSG` | `UNLOCK_ALL` 200, `LOCK_MSG` still **403** |

So it is `create` — not `delete`, not the suite's earlier steps — and it is not
tied to a message number: after a create, nothing in that session can be locked.
Three consecutive rfc runs with no http in between fail identically, and the
moment a run ends the object is free again (`LOCK_MSG` from a fresh session
answers 200), so the blocker lives and dies with the run's session.

The constraint underneath, measured in one stateful http session: the class lock
and the message lock are mutually exclusive **for the same user in the same
session** — class `LOCK` → 200 then `LOCK_MSG` → 403, and `LOCK_MSG` → 200 then
class `LOCK` → 403. ADT registers one lock per session per object and refuses the
second, reporting it as "user is currently editing".

### It is not an rfc defect

The same sequence over **http**, inside one session carrying
`x-sap-adt-sessiontype: stateful` throughout:

| Step (http, one stateful session) | Result |
| --- | --- |
| `POST /deletion/delete` on the class | 200 |
| `POST /messageclass` (create) | 201 |
| `POST …?_action=LOCK&accessMode=MODIFY` (class lock) | **refused — no handle** |
| `POST …/messages/001?_action=LOCK_MSG` | **403, "User OKYSLYTSIA is currently editing ZADT_MSGX01 001"** |

Identical to rfc, step for step. The rule is transport-independent: **once
`create` has run, that ABAP session can no longer lock the object at all** — not
the message, not even the class. The create answers `201` with
`content-length: 0` and only a `location` header, so no handle comes back to
release with, and a fresh `LOCK` that would yield one is refused. Nothing inside
that session can undo it. The only escape is a different ABAP session.

Which is where the two transports part company, and it is not a defect in either:

- Over http our create is sent stateless. The ABAP session that ran it is rolled
  out when the request returns, and the lock dies with the roll area. The next
  request gets a fresh session and locks happily.
- Over rfc there is no stateless. One conversation is one ABAP session whose roll
  area persists across calls — that is what rfc *is*, and it is the reason rfc is
  here: lock handles have to survive on BASIS < 7.50 where stateful http does not
  work. `setSessionType('stateless')` correctly does nothing there.

So http was never handling this correctly; it was being cleaned up after. The
dependency is ours: the create path leaves an ABAP lock it cannot release and
relies on the roll area being torn down for it.

The Eclipse trace shows the same separation — locks on one stateful session
marked `enqueue` (155), every GET and the PUT on their own stateless sessions
(156–160). Nothing that is not a lock shares the enqueue session.

### It is MSAG, not a rule about sessions

The tempting conclusion — "an ABAP session that created an object cannot then
lock it" — is wrong. Three creates followed immediately by a lock, all in **one**
rfc session on one run:

| Type | `create` → `lock` |
| --- | --- |
| domain | **OK** |
| class | **OK** |
| message class | 403 |

Only MSAG. It is the one type here that is not a dictionary object: two lock
levels, a bespoke `?_action=LOCK&msgNo=…&onSave=X` variant, and an error text
("user is currently editing", down to the message number) that no other type
produces.

### And it is fixable: one of the three locks is granted

The chain asks for `LOCK_MSG` first and used to die there. It never tried the
others. After an rfc create, all three, in order:

| Lock | After an rfc create |
| --- | --- |
| `LOCK_MSG` | 403 |
| `LOCK&msgNo=001&onSave=X` | **200** |
| plain `LOCK` | 403 |

The message-scoped class lock is granted in exactly the situation where the
message lock is refused. And a save carrying that handle as `mc:lockhandle`
answers **200** — measured before changing any code.

So a refused `LOCK_MSG` costs the chain nothing but the separate handle.
`lockMessageIfGranted` swallows 403 there and only 403, the class-for-message
handle stands in for the message, and the full lifecycle now passes over rfc in
**2.4 s** where it previously spent 33.7 s failing. http is unchanged at 2.6 s.

The shape came from the Eclipse capture, where a refused
`?_action=LOCK&…&msgNo=000&onSave=X` is followed by a plain `LOCK` that answers
200 and whose handle goes on to the PUT. Whether Eclipse asks conditionally or
simply sends both is not visible in the log; what is visible is that a refused
lock is survivable and the flow continues. Both fallbacks here key on the status
alone.

### What was tried and did not work

Recorded because each looked promising and cost a run:

- **Dropping `x-sap-adt-sessiontype: stateful` on on-prem**, which Eclipse never
  sends there. Our flow breaks without it — `423 invalid lock handle` on domain
  and on messageClass alike. An earlier probe seemed to show locks surviving
  without it; that probe did `LOCK` → `UNLOCK`, which only checks the handle as a
  token, not work done under the lock.
- **`sap-adt-connection-id` as the lever.** Holding it constant and varying only
  the stateful header flips the outcome, so it is not the connection id.
- **Eclipse's exact header shape over rfc** — never marking a request stateful.
  Still 403.

## Left open: `Package` over rfc, and a suite that passes without testing

The one red line remaining in `e19-rfc-full-fixed.log` is
`Package - Full workflow: HTTP 400, Package TEST_INNER_PKG02 is already locked`.

It first looked intermittent — run alone over rfc it goes FAIL, PASS, FAIL, PASS.
Reading the steps rather than the verdict says otherwise:

```
run 1:  → delete (pre-existing object cleanup)                    ← nothing else ran
run 2:  → validate → create → read → update ✗ 400 "already locked"
```

What alternates is not the outcome but whether the suite does anything. When the
previous run left the package behind, `ensureObjectReady` deletes it and the
tester returns early — reporting **PASS having run neither create nor update**.
When there is no leftover, the workflow runs and fails.

So `update` immediately after `create` over rfc fails **every time it is
actually attempted**. It is the shape that broke `MessageClass`: an operation on
an object in the same ABAP session that created it, which http never meets
because its create goes out on a session of its own.

Two separate things to fix, and neither is done here:

1. **The package chain over rfc.** Unlike MSAG there is no second lock variant to
   fall back on — `/sap/bc/adt/packages/…?_action=LOCK&accessMode=MODIFY` is the
   only one. What the server will accept after a create in the same session is
   not yet measured.
2. **A suite that reports green without testing.** A leftover object silently
   turns the package lifecycle into a no-op that passes. That is what hid this
   failure on every second run, and it is not specific to packages.
