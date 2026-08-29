# `profiler-probe/` — the directory the probe wrote, verbatim

Produced by `npx ts-node scripts/probe-profiler-contract.ts --write` against E19
(`RFCSAPRL 816`, kernel `916`, client 100) on 2026-08-28, exactly as
fr0ster/mcp-abap-adt-clients#115 asked for it. Committed rather than attached,
because a GitHub attachment cannot be quoted, diffed or checked out.

Nothing here is edited, summarised or reordered. Two files are zero bytes because
the server answered `200` with an empty body — that is the measurement, not a
capture failure.

| file | request | status | bytes |
|---|---|---|---|
| `02-parameters-get.xml` | `GET /runtime/traces/abaptraces/parameters` | 405 | 516 |
| `02-requests.xml` | `GET /runtime/traces/abaptraces/requests` (`Accept: application/xml`) | 400 | 707 |
| `02-objecttypes.xml` | `GET …/abaptraces/objecttypes` | 200 | 1657 |
| `02-processtypes.xml` | `GET …/abaptraces/processtypes` | 200 | 1845 |
| `02-parameters-post.xml` | `POST …/abaptraces/parameters` | 200 | **0** |
| `02-parameters-stored.xml` | `GET` of the `Location` that POST returned | 200 | **0** |
| `01-crosstrace-list.xml` | `GET /crosstrace/traces` | 200 | 104 |
| `01-crosstrace-activations.xml` | `GET /crosstrace/activations` | 200 | 109 |

`summary.json` carries the same rows machine-readable, including the `Location`
header the POST returned.

The reading of these bodies — and the two follow-up measurements that the probe
does not take — is in
[`../2026-08-28-profiler-contract-e19.md`](../2026-08-28-profiler-contract-e19.md).
This directory is the evidence; that file is the argument.
