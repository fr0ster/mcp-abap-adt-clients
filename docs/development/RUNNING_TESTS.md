# Running the tests

Every test here talks to a real SAP system. A full run is about **27 minutes** and
1388 tests across 176 files; there are no mocks to make it faster.

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

A run holds a session on the target system, and the cloud trial grants **two**.
Two runs at once will take the third and be refused — and worse, they will fight
over the same shared objects. Do not edit `src/` while a run is in flight either:
jest reads each test file when it reaches it, so an edit half-way through means
the run is testing two different versions of the code.

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

The cloud trial skips 19 tests that only apply on-prem, so an on-prem run covers
more, not less. Set in `src/__tests__/helpers/test-config.yaml`:

| field | value |
|---|---|
| `system` | `"onprem"` — this picks the connector, and it is stated, never inferred from `SAP_URL` |
| `default_master_system` | the system ID, e.g. `E19` |
| `transport_layer` | e.g. `ZE19` — on-prem package tests need it |
| `default_package`, `default_transport` | yours; the package must exist already |

Then `cp e19.env .env` and run as above. A legacy system (BASIS < 7.50) needs
the RFC transport instead — see [RFC_TESTING.md](RFC_TESTING.md), and note that
`SAPNWRFC_HOME` and `LD_LIBRARY_PATH` must be passed at launch because `dotenv`
does not expand `PATH`.
