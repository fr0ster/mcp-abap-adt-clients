# Moving entries between tasks

**Status:** implemented as `AdtRequest.moveObjects(sourceTask, targetNumber,
objects, options?)`.

## What Eclipse sends

Captured from Eclipse ADT 3.60.3 on premise (BASIS 816), 2026-10-12, with the
task numbers and the object replaced:

```
POST /sap/bc/adt/cts/transportrequests/<source>/moveobjects HTTP/1.1
Accept: application/vnd.sap.adt.transportorganizer.v1+xml
Content-Type: text/plain

<?xml version="1.0" encoding="ASCII"?>
<tm:root xmlns:atom="http://www.w3.org/2005/Atom" xmlns:tm="http://www.sap.com/cts/adt/tm"
         tm:number="<target>" tm:useraction="moveobjects">
  <tm:request>
    <tm:abap_object tm:pgmid="LIMU" tm:type="METH" tm:name="<class padded to 30><method>"
      tm:wbtype="CLAS/OM" tm:position="000005" tm:lock_status="X"
      tm:uri="…" tm:dummy_uri="…" tm:obj_info="Method (ABAP Objects)" tm:img_activity="">
      <atom:link … rel="http://www.sap.com/cts/relations/removeobject"/>
      <atom:link … rel="http://www.sap.com/cts/relations/moveobjects"/>
    </tm:abap_object>
  </tm:request>
</tm:root>
```

The address is the **source** task; the root's `tm:number` is the **target** —
unlike `removeobject` and `addobject`, whose root repeats the address. The
answer, `200` with the organizer's media type, echoed the entry under the
source's number.

## What was measured

On premise (BASIS 816), 2026-10-12, with `scripts/probe-move-objects.ts`,
sending only `tm:pgmid`, `tm:type`, `tm:name` and `tm:position` per entry:

- one `LIMU METH` entry, source → target and back: `200` each time, the entry
  echoed with its source position; re-reading both tasks showed it moved;
- two `LIMU` entries of one class in one call, out and back: `200`, both echoed,
  both moved; on the way back they were appended at the end of the source's list
  under new positions.

The attributes Eclipse adds (`wbtype`, `uri`, `lock_status`, …) were not needed.

## What is still to measure

- An entry sent without `tm:position` (for `removeobject` that answered `200`
  and removed nothing).
- A target that is a request rather than a task, a released or foreign task, a
  target of another request type.
- The same on the cloud.
