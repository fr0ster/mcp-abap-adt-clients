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
