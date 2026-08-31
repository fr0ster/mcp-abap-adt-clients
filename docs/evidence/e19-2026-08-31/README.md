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

## The remaining red line: `MessageClass` over rfc

http on this branch is green end to end — 1286 passed, nothing failed. Over rfc
one suite stays red, at the first `LOCK_MSG` on `ZADT_MSGX01 001`:
`403 ExceptionResourceNoAccess`, "User OKYSLYTSIA is currently editing". It is a
library-level dependency on transport semantics, not an rfc defect — see below.

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
| message class | **403** on the class lock *and* on `LOCK_MSG` |

Domain and class do not care. Only MSAG does. So this is a property of the ADT
message-class create, not of the session model, and the other 26 core types are
unaffected.

### What actually decides it, header by header

A full Eclipse capture with headers (create `ZOK_MESSAGE_0002`, then add message
000) shows Eclipse sends **no `x-sap-adt-sessiontype` at all** — not on create,
not on the locks, not on the PUT. Every request carries the same
`sap-adt-connection-id`. The "stateful, enqueue" session in the trace is the
server's own doing, not something the client asked for.

That made `sap-adt-connection-id` look like the lever. It is not. The same
delete → create → `LOCK_MSG` over http, one cookie jar, varying only headers:

| Headers | create | `LOCK_MSG` |
| --- | --- | --- |
| no sessiontype, with `sap-adt-connection-id` (Eclipse's own combination) | 201 | **200** |
| `x-sap-adt-sessiontype: stateful` + `sap-adt-connection-id` | 201 | **403** |
| `x-sap-adt-sessiontype: stateful`, no connection-id | 201 | **403** |

The deciding factor is the *absence* of the stateful header — that is, whether
create and the lock land in the same ABAP session. The connection id changes
nothing.

So both readings hold at once, and neither alone is the whole story: it is
MSAG-specific (domain and class share a session happily) **and** it is about
sharing the session (MSAG is fine when they do not). rfc can only ever be the
failing combination.

Two more things the headers settle. The create response carries `Location` and a
profiling header, nothing else — no handle, confirming there is nothing to
release with. And Eclipse's 403 on the message-scoped class lock is a *different*
error from the one this suite hits: `SADT_RESOURCE 029, "Resource Message Class
… could not be locked"`, where this suite gets `"User … is currently editing"`.
The fallback added here covers both, because it keys on the status.

### What was done about it

The suite is gated off for rfc, with the reason stated at the skip. Not a
workaround for a bug in this package — there is nothing here to fix. Creating a
message class and locking one of its messages cannot happen in the same ABAP
session, and an rfc conversation has exactly one for its whole life. That is what
rfc is, and why it is here: lock handles have to survive on BASIS < 7.50, where
stateful http does not work. Eclipse never meets this because its create runs on
a stateless http session (209 in the capture) while its locks live on a separate
stateful one (155) — a separation http gives away and rfc cannot express.

Building a second rfc conversation to imitate it was considered and dropped: one
MSAG flow does not pay for doubling the ABAP sessions every run opens, and this
run already showed what stray sessions cost.

What *was* taken from the Eclipse capture, and applies to both transports, is in
`AdtMessageClassMessage`: the class lock is released before the message locks,
the save runs outside the lock session, and a 403 on the message-scoped class
lock falls back to the plain one instead of being fatal.
