# Batch on the wire — measured 2026-10-15

Two endpoints, not one:

- `/sap/bc/adt/communication/batch` — discovery's "ADT Batch Resource"
  (`app:accept multipart/mixed`), the general batch. SAP's back-end guide
  "Configuring the ABAP Back-end for ABAP Development Tools" lists it as "Batch
  Requests", authorization `S_ADT_RES`, "A batch request consists of inner
  requests which are checked additionally" (quoted second-hand from the owner's
  research; the PDF itself not yet fetched here).
- `/sap/bc/adt/debugger/batch` — the debugger's; Eclipse sends a step and the
  stack in one envelope.

## communication/batch (E19 on premise, ABAP Cloud trial)

Request: `POST /sap/bc/adt/communication/batch`,
`Content-Type: multipart/mixed; boundary=<b>`, `Accept: multipart/mixed`; each
part `Content-Type: application/http`, `content-transfer-encoding: binary`, an
empty line, then the inner request (request line, headers, empty line, body).

| envelope | E19 | trial |
|---|---|---|
| GET class metadata + GET class source | 202, multipart, parts `HTTP/1.1 200` ×2 | same |
| GET metadata + **POST** validation + GET a missing class | 202; parts 200, 200, **404** (`ExceptionResourceNotFound`, `SADT_RESOURCE/002`) | same |
| inner request without its closing empty line | **400** `ExceptionBatchParsingErroneousData` "Syntax or last line of the header is invalid (Line: 7)", `SADT_REST/104`, subType `invalidHeaderLine` | same |

- The answer's boundary is the server's own (`batch_<32 hex>`), in its
  Content-Type, with `; charset=utf-8`.
- Each part: `HTTP/1.1 <status>  <text>` (two spaces), `~server_protocol`,
  the inner response headers, empty line, body.
- A failing part does not fail the envelope: the envelope is 202 and the part
  carries its status.
- Mixed GET + POST is accepted here (the 500 recorded in 2026-08 was the old
  batch client on `debugger/batch`).

### A write inside communication/batch (E19)

Program `ZAC_BATCH_T1` created in `ZAC_TEST_PKG` (normally), then, on one
connection set **stateful** for each envelope:

1. envelope `[POST {uri}?_action=LOCK&accessMode=MODIFY` (lock Accept,
   `X-sap-adt-sessiontype: stateful`)`]` → 202; part `HTTP/1.1 200` with the
   usual `asx:abap` lock result: `LOCK_HANDLE`, `CORRNR E19K907111`, `CORRUSER`.
2. envelope `[PUT {uri}/source/main?lockHandle=…&corrNr=… (text/plain body),
   POST {uri}?_action=UNLOCK&lockHandle=… (stateful)]` → 202; parts 200, 200.
3. the inactive source read afterwards is the text written in the batch; the
   delete afterwards succeeded (the lock was released). Program gone (404).

So the lock window can run through the batch when the envelope goes stateful.
Not measured: the same with the envelope stateless; a write without the lock
handle known up front (LOCK and PUT in one envelope cannot work — the PUT needs
the handle the LOCK answers).

### Dependent requests — a domain created, locked, written, unlocked, activated (E19)

Inner requests exactly as the library's members send them (recorded on a stub
connection), envelope stateful, `ZAC_BATCH_DOMA1` in `ZAC_TEST_PKG` on
`E19K907111`, deleted afterwards (404).

**A — all five in one envelope** (the PUT and UNLOCK carry a placeholder: the
handle exists only in the LOCK's answer) → 202:

| part | answer |
|---|---|
| POST create | **201 Created** — the domain is created inside the batch |
| LOCK | 200, `LOCK_HANDLE` 2E1E… |
| PUT document | **423** `ExceptionResourceInvalidLockHandle` "Resource Domain ZAC_BATCH_DOMA1 is not locked (invalid lock handle: HANDLE_PLACEHOLDER)", `SADT_RESOURCE/026` |
| UNLOCK (placeholder) | **200 — and released nothing**: the real lock stayed until a later UNLOCK with the real handle (200) |
| activate | 200, `activationExecuted="true"`, but `type="E"` "Data type ' ' does not exist" (`DO/251`), "DOMA ZAC_BATCH_DOMA1 was not activated" (`D0/408`) — the PUT never wrote the type |

Rakes: a part cannot use an earlier part's answer (no reference mechanism was
found); an UNLOCK with a wrong handle answers 200 and leaves the lock; the
envelope is 202 whatever its parts did — the verdict is per part, and for an
activation inside the part's `chkl:messages`, not its status.

**B — two envelopes**: `[create, LOCK]` → 202 (201, 200; the handle), then
`[PUT with the real handle, UNLOCK, activate]` → 202 (200, 200, 200;
`activationExecuted="true"`, no message). Read back: `version="active"`, the
description the PUT wrote. Two round trips instead of five.

### 100 domains, timed (E19)

Same inner requests as the library sends; envelope stateful; 100 names
`ZAC_BD_0001…0100` in `ZAC_TEST_PKG` on `E19K907111`, deleted afterwards.

| step | parts | size | answer | time |
|---|---|---|---|---|
| E1 create + LOCK | 200 | 110 KiB | 202; 100×201, 100×200; 100/100 handles | 11.9 s |
| E2 PUT + UNLOCK + activate | 300 | 209 KiB | 202; 300×200; 0 activation parts with `type="E"` | 33.2 s |
| E3 read metadata | 100 | 23 KiB | 202; 100×200; 100/100 `version="active"` | 1.3 s |
| E4 delete | 100 | 58 KiB | 202; 100×200 | 14.0 s |
| E5 read after delete | 100 | 23 KiB | 202; 100×404 | 0.9 s |

create … activate: **45.1 s in 2 requests** (batch) against **111.9 s in 500
requests** (the same steps one at a time through the members, on 100 other names;
100/100 activated cleanly; deleted by batch, 100/100 404 afterwards). Most of E2
is the hundred activations, run one after another server-side — one group
activation should replace them.

The 2026-09 removal of the old batch clients ("mixed GET and POST from unrelated
resources in one envelope is a server-side 500") was measured on
`debugger/batch`; `communication/batch` takes mixed envelopes (above).

### The recording client (AdtBatchConnection), 100 domains (E19, 2026-10-16)

`AdtClient` on `AdtBatchConnection('communication')`: the members are recorded,
`execute()` sends them in one envelope. `DomainsBatch.test.ts`, green:

| step | through | time |
|---|---|---|
| record create + lock ×100, execute | batch client, 1 envelope | 7.8 s |
| record updateMetadata + unlock ×100, execute | batch client, 1 envelope | 5.6 s |
| group activation, until the run finished | plain connection, `activateObjectsGroup` + `getActivationRun` | 6.1 s |
| read ×100 (all `active`, `CHAR`) | batch client | 1.6 s |
| delete ×100, read (all 404) | batch client | 14.7 s + 0.8 s |

On the ABAP Cloud trial, same test, green: create+lock 15.4 s, update+unlock
11.0 s, activation run 18.0 s (create … activate 44.4 s), read 4.0 s, delete
32.9 s, all 404 afterwards; the debugger cases and the recording debugger
client green there too.

create … activate on premise: **19.5 s**, against 45.1 s (scripted envelopes, a hundred
activations inside one) and 111.9 s (500 single requests).

Found on the way:
- `data: null` (lock, unlock) was serialised as a body `null`; fixed in
  `src/batch/wire.ts`, unit-tested.
- `activateObjectsGroup` is an asynchronous run: `POST /activation/runs` → 201,
  empty body, run id in `Location` (`utilActivationRunId` reads it). Deleting
  while the run holds the objects is refused per part: `isDeleted="false"`,
  `type="E"` "You are already editing ZAC_BD_0001".
- Deleting a name already deleted answers `isDeleted="false"` with
  `type="W"` "Release transport E19K907111 to remove the object directory entry".
- A proxy made with `Object.create(connection)` keeps `setSessionType` on
  itself: every envelope went stateless and every PUT got 423 — a test
  artefact, recorded so nobody repeats it.

## debugger/batch — Eclipse's request (captured by the owner, 2026-10-09)

```
--batch_<uuid>
Content-Type: application/http
content-transfer-encoding: binary

POST /sap/bc/adt/debugger?method=stepContinue HTTP/1.1
sap-adt-request-id:<32 hex>
Accept:application/xml

--batch_<uuid>
Content-Type: application/http
content-transfer-encoding: binary

POST /sap/bc/adt/debugger?emode=_&semanticURIs=true&method=getStack HTTP/1.1
sap-adt-request-id:<32 hex>
Accept:application/xml

--batch_<uuid>--
```

With the debuggee already ended both parts answered `HTTP/1.1 500`
`AdiFailed`, subType `debuggeeEnded` (`SY/530`).

### Live, through the library's primitives (DebuggerBatch.test.ts), E19 and trial

At a breakpoint stop, on the attached (stateful) debug connection, one
envelope each — every part `HTTP/1.1 200` on **both** systems:

| envelope | parts |
|---|---|
| stepInto + getStack (Eclipse's exact parts) | 200, 200 |
| stepOver + getStack | 200, 200 |
| stepReturn + getStack | 200, 200 |
| stepContinue + getStack | 200, 200 |
| step + getStack + **getVariables** (a body-carrying POST) | 200, 200, 200 |
| getStack + **getChildVariables** (no step) | 200, 200 |

A body-carrying part must ask for its own type back: with `Accept:application/xml`
the variables parts answered **406** "Accepted content types:
application/vnd.sap.as+xml"; with the member's own type
(`application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.Variables`
/ `…ChildVariables`) → 200.

## Still to measure

- communication/batch: per-part authorization
  (`S_ADT_RES` on inner requests); limits (part count, size); RFC transport.
