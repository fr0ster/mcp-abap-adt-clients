# `profiler-probe/` — the directory the probe wrote, verbatim

`npx ts-node scripts/probe-profiler-contract.ts --write` against E19
(`RFCSAPRL 816`, kernel `916`, client 100) on 2026-08-29, from branch
`fix/tester-writes-the-update-source`. Whole files, unedited — not the log,
which truncates. Two of them are zero bytes because the server answered `200`
with an empty body; that is the measurement, not a capture failure.

| file | request | status | bytes |
|---|---|---|---|
| `02-parameters-get.xml` | `GET …/abaptraces/parameters` | 405 | 516 |
| `02-requests.xml` | `GET …/abaptraces/requests` (`Accept: application/xml`) | 400 | 707 |
| `02-objecttypes.xml` | `GET …/objecttypes` | 200 | 1657 |
| `02-processtypes.xml` | `GET …/processtypes` | 200 | 1845 |
| `02-parameters-post.xml` | `POST …/parameters` | 200 | **0** |
| `02-parameters-stored.xml` | `GET` of the returned `Location` | 200 | **0** |
| `03-traces-feed.xml` | `GET …/abaptraces` | 200 | 239 347 |
| `03-hitlist.xml` | `GET …/{id}/hitlist` | 200 | 8 855 |
| `03-statements.xml` | `GET …/{id}/statements` | 200 | 31 457 |
| `03-dbAccesses.xml` | `GET …/{id}/dbAccesses` | 200 | 750 |
| `01-crosstrace-list.xml` | `GET /crosstrace/traces` | 200 | 104 |
| `01-crosstrace-activations.xml` | `GET /crosstrace/activations` | 200 | 109 |

## What the three trace views settle

**`ITraceTiming` — the timing elements carry two attributes, `time` and
`percentage`.** From `03-hitlist.xml`, verbatim:

```xml
<trc:grossTime time="2" percentage="0.361"/>
<trc:grossTime time="243" percentage="43.8628"/>
<trc:traceEventNetTime time="13" percentage="2.3466"/>
<trc:traceEventNetTime time="14" percentage="2.5271"/>
```

`time` is an integer, `percentage` a decimal. Both elements are empty — the
values are attributes, not text.

**`trc:extendedData` is present in the feed, with these children.** From
`03-traces-feed.xml`:

```
trc:amdpFileSize  trc:client  trc:expiration  trc:host  trc:isAggregated
trc:objectName    trc:runtime trc:runtimeABAP trc:runtimeDatabase
trc:runtimeSystem trc:size    trc:state       trc:system  trc:user
```

So the optional fields on `ITraceEntry` have somewhere to come from. Note the
feed's `extendedData` carries a different set from a trace **request** entry's,
which is where `trc:processType` and `trc:object` live.

`03-dbAccesses.xml` is small here because the profiled run touched no tables:
`<trc:dbAccesses totalDbTime="0">` with `<DB Access from Kernel>` and
`<DB Time of System Events>` rows at zero. The shape is still there —
`trc:dbAccess` with `index`, `tableName`, `statement`, `type`, `totalCount`,
`bufferedCount`, and a nested `trc:accessTime` carrying `total`,
`applicationServer`, `database`, `ratioOfTraceTotal`.

## The parameters resource, unchanged from 2026-08-28

`POST …/parameters` answers 200 with an empty body and a `Location`; a `GET` of
that `Location` answers 200 empty as well, under every Accept tried. It cannot
be shown to carry a catalogue choice because it carries nothing — the choice
travels on a trace **request**, as
[`../2026-08-28-profiler-contract-e19.md`](../2026-08-28-profiler-contract-e19.md)
records.
