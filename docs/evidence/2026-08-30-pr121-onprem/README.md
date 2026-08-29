# PR #121 verified on E19 — the four runs, whole

Branch `feat/typed-timings-and-abap-entry` at `99e1b2b`, after the rebase that
put #120 underneath it. `npm ci`, E19 (`RFCSAPRL 816`, kernel `916`, client
100), one SAP-touching run at a time, each log kept entire.

| log | command | result |
|---|---|---|
| `entry.log` | `npx ts-node scripts/print-trace-entry.ts` | every declared field present |
| `include-run.log` | `npm test -- integration/core/include` | 1 suite, 2 tests, green |
| `traces-run.log` | `npm test -- integration/runtime/traces` | 1 suite, 6 tests, green |
| `executors-run.log` | `npm test -- integration/executors` | 2 suites, 4 tests, green |

## What `entry.log` settles

The release makes fourteen fields typed and four of them required, and nothing
checks that at runtime — the parser maps, it does not judge. So the round trip
had to be read off a live feed:

```
  client             "100"
  system             "E19"
  host               "epbyminsd0654"
  size               8
  runtime            554
  isAggregated       false
```

`client` prints **with quotes**, as do `system` and `host`. Only the counted
things are numbers. Nothing came back `undefined`, so the contract claims no
more than the wire gives.

## What `include-run.log` shows

```
read initial (post-create)  → 52 characters
read inactive (post-update) → 91
read active (post-activate) → 91
```

Before #120 both reads were 52 — the update rewrote the object with the create
source. This run is also the one that proves #120's delete fix end to end: after
its cleanup the name `ZAC_INCL01` is free, where every earlier run left an
editing registration behind.

Not included here: an earlier, pre-rebase run of the same suite that failed on
those two #120 defects, and one after the rebase that failed on a stale
`TRDIR ZAC_INCL01` lock left by a run from before #120 was merged. Both are
described in the PR comment; neither says anything about this branch's changes.

## Noted, and outside this PR

`executors-run.log` is green, and the suite still leaves `E_ABAP_GENPH` locks on
the generated class-pool parts (`~AC_CLS…HPZ` / `…HCZ`) after deleting its
objects. This package never takes those locks — `grep -rn "GENPH" src/` is
empty; they are the kernel's, taken during activation and generation.
