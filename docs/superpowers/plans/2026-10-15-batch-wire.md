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
`AdiFailed`, subType `debuggeeEnded` (`SY/530`). Not yet measured: the same on
a live stop, each step method, and whether `getVariables` can join the envelope.

## Still to measure

- communication/batch: a write (lock / PUT / unlock) inside a batch — the lock
  needs a stateful session; does the batch carry it; per-part authorization
  (`S_ADT_RES` on inner requests); limits (part count, size); RFC transport.
- debugger/batch: live step + stack for stepInto / stepOver / stepReturn /
  stepContinue; + getVariables; + getChildVariables.
