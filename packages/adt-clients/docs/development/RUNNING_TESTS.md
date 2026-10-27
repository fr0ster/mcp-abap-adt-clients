# Running the tests

Every test here talks to a real SAP system. A full run is about **27 minutes** and
1388 tests across 176 files; there are no mocks to make it faster.

Every command on this page runs in `packages/adt-clients`. At the repository
root, `npm test` runs only the unit suites of every package and needs no system.

## From an agent CLI — use the detached run

```bash
npm run test:detached                             # the whole suite
npm run test:detached -- integration/core/class   # one directory
tail -f test-run.log                              # the output goes only here
```

**Why this is not a preference.** An agent CLI supervises the processes its tool
calls start, and stops long-running ones when it judges the machine short of
memory — judging from the whole machine, not from the run. Measured in one
session: three full runs killed that way while jest was holding **338 MB** and
**11 GB were free**, and `journalctl -k` had no OOM entry at all. The kernel had
not killed anything; the supervisor had.

`test:detached` runs under `nohup` and reparents the run to init, so it finishes
on its own and the supervisor has nothing to stop. The output goes to a file
because there is no terminal left to write to.

The same applies to anything else that takes minutes — `shared:setup` included.

## From your own shell

```bash
npm test 2>&1 | tee test-run.log
```

Fine, because you are watching it. **Save the whole log and read the file** —
piping through `grep`, `tail` or `head` hides the thing you did not know to look
for. Every hard bug in this suite was found by reading a full log or a full wire
trace, never by filtering one.

## Order matters

```bash
npm run shared:setup 2>&1 | tee shared-setup.log   # first — creates shared dependencies
npm test 2>&1 | tee test-run.log                   # then everything else
```

Tests take their supporting objects from `shared_dependencies` rather than
building a chain each. Run the suite without the setup and they fail looking for
objects that are not there yet.

## One run at a time

A run holds a session on the target system, and a trial ABAP Cloud account grants **two**.
Two runs at once will take the third and be refused — and worse, they will fight
over the same shared objects. Do not edit `src/` while a run is in flight either:
jest reads each test file when it reaches it, so an edit half-way through means
the run is testing two different versions of the code.

## Proving an UNLOCK released the lock

```yaml
# test-config.overlay.yaml — required, stated per system
"environment.verify_lock_released": true    # false on cloud
```

An UNLOCK that answers 200 has not necessarily released anything: sent
stateless, it runs in a fresh ABAP context and leaves the enqueue entry where it
was, and the suite only saw it when a later activation was refused with EU/510
"currently editing". So after every UNLOCK a test does before it needs the object
unlocked — `BaseTester`'s update step, which covers every lockable type in the
flow tests, and the hand-written lock windows in the append structure, scalar
function, scalar function implementation, behavior implementation, unit test,
group activation and transport suites — `expectLockReleased`
(`src/__tests__/helpers/lockReleased.ts`) opens a **second ABAP session** of its
own and LOCKs the same object from there. A lock still held is refused and the
test fails with SAP's sentence; a released one is granted and released again.
A class include is checked against the class lock, which is the one it was
written under.

It costs one session logon per check. A trial ABAP Cloud account grants two sessions — the run's
and this one — and the check always closes its own before it returns, so the
two are never exceeded. Whether the check is made is the system's configuration,
`environment.verify_lock_released` (required, no default, no environment
variable). On, any refusal — a 404 included — fails the test. Off, no LOCK is
sent and the run logs a line naming the key. The cloud form states `false`: a
second session can land on another application server where a new object is
not visible yet, and its LOCK answers 404 (measured).

## Reading the traffic

```bash
WIRE_LOG=wire.log WIRE_LOG_BODY=full npm test
```

Every request and response, headers and bodies, in the shape an Eclipse trace
prints. Credentials are redacted. Over a whole suite it comes to about 22 MB and
971 requests — which is how the four dead cleanup loops, the validation that
answered `ok` for a taken name, and the class that cannot be read before its
first write were all found. None of them failed a test.

Without `WIRE_LOG_BODY=full` the bodies are cut at 1200 characters, which is
right for comparing headers and wrong for reading what SAP answered.

## On-prem

A run on ABAP Cloud skips 19 tests that only apply on-prem, so an on-prem run covers
more, not less. Set in your overlay, `src/__tests__/helpers/test-config.overlay.yaml` (flat keys, `environment.` and `shared_dependencies.` prefixes; see [Test Config Schema](TEST_CONFIG_SCHEMA.md)):

| field | value |
|---|---|
| `system` | `"onprem"` — this picks the connector, and it is stated, never inferred from `SAP_URL` |
| `default_master_system` | the system ID, e.g. `SID` |
| `transport_layer` | e.g. `ZSID` — on-prem package tests need it |
| `default_package`, `default_transport` | yours; the package must exist already |

Then name the system's session file with `MCP_ENV_PATH=~/.config/mcp-abap-adt/sessions/<system>.env` (on Windows `~/Documents/mcp-abap-adt/sessions/<system>.env`) and run as above. A legacy system (SAP_BASIS 7.40, measured on 7.40 SP04) needs
the RFC transport instead — see [RFC_TESTING.md](RFC_TESTING.md), and the legacy
package's live checks in
[LIVE_TESTING.md](../../../adt-clients-legacy/docs/LIVE_TESTING.md); note that
`SAPNWRFC_HOME` and `LD_LIBRARY_PATH` must be passed at launch because `dotenv`
does not expand `PATH`.

## The one case the full run deliberately leaves out

**Publishing a service binding.** `create_service_binding.params.
desired_publication_state` ships as `unchanged`, and the full run needs it to
stay that way — not because publishing is untested by choice of convenience, but
because of what it costs on the server:

- publishing takes ~135s;
- ADT refuses to delete a binding whose endpoints are published, so a flow that
  publishes cannot clean up after itself;
- one unpublish was measured still not settled after eleven minutes, and another
  completed only after the client had given up.

So the flow covers create, write, activate and delete, and does not touch
publication. To exercise publication, run it as **two deliberate runs**:

```bash
# 1. set desired_publication_state: "published"
npm test -- integration/core/serviceBinding 2>&1 | tee publish.log

# 2. set desired_publication_state: "unpublished"
npm test -- integration/core/serviceBinding 2>&1 | tee unpublish.log
```

Between them, check the binding's state on the system and unpublish by hand if
the first run did not settle — the second run asks for a transition, and ADT
refuses one that does not apply.
