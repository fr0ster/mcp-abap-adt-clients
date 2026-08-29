# `probe-e19-*` — the eight runs, verbatim

All eight `scripts/probe-e19-*.ts` run against E19 (`RFCSAPRL 816`, kernel `916`,
client 100) on 2026-08-28, sequentially, one session each and each released.
These are the logs those runs printed — not edited, not summarised. Each script
writes no files of its own, so its stdout is the capture.

| log | what it asked | what it answered |
|---|---|---|
| `adopt.log` | does a second connector adopt the first one's ABAP session | **YES** — same conversation id and the same `SAP_SESSIONID` before and after a request |
| `nodes.log` | is the system one application server or several | one: `sap-adt-saplb: epbyminsd0654_E19_00` on all 12 requests, **1 distinct server** |
| `traces.log` | the two ABAP trace collections side by side | `/abaptraces/requests` → 200, **345 bytes, 0 entries**; `/abaptraces` → 200, **231 397 bytes, 58 entries** |
| `order.log` | what order the traces feed is in, and what `latestTraceId()` picks | document order runs **newest first** (`2026-08-27T06:09:50Z` … `2026-08-19T12:55:26Z`), 58 entries; `latestTraceId()` → `574B3FA8A2CD11F1B5CA0CC47A1E68C1` |
| `dumps.log` | the dumps feed | 200, 528 888 bytes, **33 entries**; eleven `Division by 0 (type I or INT8)` on 2026-08-27 |
| `uri.log` | does `getRequestsByUri()` find the request behind a finished trace | **no** — all three URI spellings answer `200, 345 bytes, ids: (none)`, while `list()` does show the new trace `A06D8A58A2D211F1B5CA0CC47A1E68C1` |
| `newtrace.log` | does a profiled run produce exactly one new trace | yes — `59` traces before, `attempt 1: 60 traces, 1 new → A59511DDA2D211F1B5CA0CC47A1E68C1`, with `profilerId=…/parameters/0CC47A1E68C11FE1A8DA54B2A23B95CA` |
| `shared-failures.log` | what activation reports for a shared function module | `<chkl:properties checkExecuted="false" activationExecuted="false" generationExecuted="true"/>`, and **inactive AFTER = `[]`** |

## What these runs left on the system

`uri` and `newtrace` each create a program, run it under the profiler and delete
it again; both logs end with `Program deleted`. `shared-failures` works on a
shared function module that already existed and leaves it activated.

**Two trace files remain**, one per profiled run — `A06D8A58A2D211F1B5CA0CC47A1E68C1`
(`uri`) and `A59511DDA2D211F1B5CA0CC47A1E68C1` (`newtrace`). They are the
measurement, not litter: `newtrace` exists to show that one run yields exactly
one new trace, and deleting them would erase what it proved. The feed held 58
before and 60 after.
