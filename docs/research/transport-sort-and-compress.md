# Sorting and compressing a task's object list

**Status:** implemented as `AdtRequest.sortAndCompress(taskNumber, options?)`.

## Why it is needed

A task can hold the same object entry more than once — the same `R3TR TABL`
twice, say, after a create and a change that each recorded it. Removing one of
the copies (`removeObject`) is then refused with `400`, `ADT_TM_COMMON_EXCEPTION`,
T100 `SCTS_ADT_MSG` 009, long text TR292:

> Object entry exists more than once; sort and compress first

SAP will not guess whether one copy or all are meant, and a key entry assigned
to the object makes the choice matter. The remedy it names is the transport
organizer's *Request/task → Object list → Sort and compress*. Measured on
premise (BASIS 816), 2026-10-12, on tasks of a generated request.

ADT discovery lists no such action under `/sap/bc/adt/cts/transportrequests`,
and this package has no member for it.

## What Eclipse sends

Captured from Eclipse ADT 3.60.3 on premise (BASIS 816), 2026-10-12, with the
task number replaced:

```
POST /sap/bc/adt/cts/transportrequests/<task>/sortandcompress HTTP/1.1
Accept: application/vnd.sap.adt.transportorganizer.v1+xml
X-sap-adt-profiling: server-time
sap-adt-connection-id: <id>
sap-adt-request-id: <id>
```

No body. The answer carried no content headers, only the profiling one
(`X-sap-adt-profiling: server-time=…`); its status was not recorded in the
capture.

## What was measured

On premise (BASIS 816), 2026-10-12, on tasks holding duplicated `R3TR TABL`
entries: the `POST` answered `200` with an empty body; reading the object list
again showed each entry once. A `removeObject` after it is not measured yet.

## What is still to measure

- The answer on a task that is not modifiable, released, or owned by another
  user.
- Whether it takes a request number as well as a task number, and what it does
  to a request's tasks then.
- The same on the cloud.

## The member

One endpoint, one member: `AdtRequest.sortAndCompress(taskNumber, options?)`
issues the one `POST` on the task's address (`TRANSPORT_REQUEST` in
`src/endpoints`), its verdict the
caller's `options.analyse`. Nothing reads the list back for the caller.
