# The two suite runs PR #120 asks for, whole — E19, 2026-08-29

Kept entire, as the instruction asks, because a trimmed log is what produced a
wrong reading once already. The third command's output is deliberately **not**
here: `probe.log` is a summary and truncates, and its directory
([`../2026-08-29-profiler-probe/`](../2026-08-29-profiler-probe)) carries the
whole bodies instead.

Branch `fix/tester-writes-the-update-source` at `8b77f9f`, `npm ci`, one
SAP-touching run at a time.

| log | command | result |
|---|---|---|
| `include-run.log` | `npm test -- integration/core/include` | 1 suite, 2 tests, green |
| `profiler-run.log` | `npm test -- integration/runtime/traces` | 1 suite, 6 tests, green |

`include-run.log` is also where the harness fix shows its work:

```
read initial (post-create)  → 52 characters   ← source_code
read inactive (post-update) → 91              ← update_source_code, actually written
read active (post-activate) → 91
```

Before the fix both reads were 52 — the update rewrote the object with the
create source, and the comparison, reading the same value, could not see it.
