# When SAP checks `Accept` and `Content-Type`

This page explains what a `406` or a `415` from an ADT endpoint means, where SAP raises it, and what a request may already have done by then. Read it if you pass `options.headers` and correct a refusal yourself. This library sends the pair it is given. It never corrects, retries or remembers one (see the README, "Accept Negotiation (removed in 36.0.0)").

## Where these findings come from

They come from two sources, both from 2026-10-18 and the same on-premise system:

- **SAP's ABAP sources** of the ADT REST framework, read through ADT with GET requests only;
- **an error corpus** measured on that system.

Each statement carries one of three tags:

- **Code:** the class and method it was read in;
- **Measured:** seen on that system;
- **Inference:** worked out from the code or the measurements, not read or run.

"No comparison" claims cover only the implementations that were read. Another release or a cloud system may behave differently.

## The short version

- **The framework itself checks neither `Accept` nor `Content-Type`.** It does not compare a request against the types a collection lists in discovery. Those types appear only in the discovery document. *Code.*
- **A resource checks the headers, or doesn't, and it decides when.** It can do so through the checking content handler `CL_ADT_REST_COMP_CNT_HANDLER`, or by calling a check or a negotiation of its own at any point. *Code.*
  - **Through the handler:**
    - `415` is raised when the resource reads its request body;
    - `406` is raised when it writes its response body. *Code.*
  - **Up front, before any change:** the deletion endpoint and the `LOCK` action of the generic object framework check `Accept`. *Code.*
  - **Neither header compared:** activation, class create and the deletes of the generic object framework. *Code.*
- **A `500` says nothing about the headers.** It can come from:
  - the router, before any resource runs;
  - an ADT exception that carries status `500`;
  - the REST layer's exception handling;
  - a dump, at any point. *Code.*

## The order a request goes through

1. **Logon: `401`.** The ICF authenticates the user before any ADT code runs.
   - *Inference.*
   - *Measured:* the same GET answers `401` without credentials and `406` with them.
2. **Authorization: `403`.** `CL_ADT_WB_RES_APP` (`IF_HTTP_EXTENSION~HANDLE_REQUEST`) checks the development authorization and `S_ADT_RES`. *Code.*
3. **CSRF: `403`.** `CL_REST_HTTP_HANDLER` (`handle_csrf_token`) refuses a request that is not GET, HEAD or OPTIONS and carries no valid token. *Code.*
4. **Routing: `404` or `500`.** `CL_REST_ROUTER` answers `404` when no route matches. If it cannot create the routed class, the error becomes a `500` (`text/plain`, "Creation of handler class failed"), and no resource code has run. *Code.*
5. **Method dispatch: `405`.** `CL_ADT_REST_RESOURCE` (`IF_REST_HANDLER~HANDLE`) dispatches GET, POST, PUT and DELETE.
   - When the resource does not implement the method, the default raises `cx_adt_res_meth_not_supported`, which gives `405` with `ExceptionMethodNotSupported`.
   - Any other method gets `400`.
   - No header has been read at this point. *Code.*
6. **The resource's own work**, where the headers may be checked:
   - **Reading the body.** `IF_ADT_REST_REQUEST~GET_BODY_DATA` calls the resource's content handler. The plain handlers compare nothing. *Code.*
     - The checking handler's `DESERIALIZE` answers `400` `contentTypeMissing` when there is no Content-Type, and `415` `ExceptionUnsupportedMediaType` when the type does not match. *Code.*
     - That this `415` carries the text "Unsupported Media Type. Supported Media Types: …" is *Inference* from the measured text.
     - Resources may also check the Content-Type themselves. For example, the generic object framework's `read_request_body` answers a `415` without that text. *Code*; *Measured*.
   - **Writing the response.** `IF_ADT_REST_RESPONSE~SET_BODY_DATA` calls the content handler. The checking handler's `SERIALIZE` first runs `check_cnt_type_is_supported()`:
     - with no Accept, it answers `400` `acceptHeaderMissing`;
     - when the type does not match, it answers `406` `ExceptionResourceNotAcceptable` ("Accepted content types: …"). *Code.*
     - The list is often empty. *Measured.*
   - **The resource's own checks.** A resource may call that check itself, at any point, or negotiate on its own, for example `CL_BLUE_WB_UTILITY=>NEGOTIATE_CONTENT_TYPE`. Such a check may come before or after the work. *Code.*
7. **Errors from the work.** An ADT exception becomes an XML exception document with that exception's own status, which may be `400`, `404`, `423` or `500`. Any other exception or runtime error ends as a short dump, which the ICF answers with `500 text/html` ("Application Server Error"). *Code* for the catch clauses; the error page is *Inference*.

## What a status says about the headers

| Answer | What it says about the headers |
|---|---|
| `401` | Nothing. The ICF logon comes before any ADT code. *Inference*; *Measured*: the same GET answers `401` without credentials and `406` with them. |
| `403` (authorization, CSRF) | Nothing. It comes before any header is read. *Code.* |
| `404` from the router (no route) | Nothing. It comes before any header is read. *Code.* |
| `404` from the resource (no such object) | Nothing about the headers. It may come before or after a check. *Inference.* |
| `405` | Nothing. The method is not implemented; it comes from dispatch, before any header is read. *Code.* |
| `500` | Nothing. A router failure, an ADT exception with status `500`, or a dump. *Code.* |
| `415` | The resource refused the Content-Type, through the checking handler or through its own check. *Code.* |
| `406` | Usually the resource refused the Accept, through the checking handler or through its own check or negotiation. It may come before or after the work. *Code.* A resource can also refuse an unsupported Content-Type with a bare `406` instead of a `415`: no body, no response Content-Type, no SAP exception. `POST /sap/bc/adt/packages/settings`, without Accept, answered a bare `406` with no Content-Type and with a bogus one, and `400` `ExceptionInvalidData` with `application/vnd.sap.adt.packages.settings.v2+xml`. *Measured* (one system). |
| `400` `acceptHeaderMissing` / `contentTypeMissing` | The resource needs that header and got none. *Code.* |
| `2xx` with an unusual header | Only that this request succeeded. The resource may compare nothing, or may accept the value through a permissive match. *Inference.* |

## Examples seen on that system

- **A DELETE of a metadata extension with an unusual Accept deletes the object.**
  - `CL_WB_ADT_PLUGIN_RESOURCE` (`DO_DELETE`) ignores the Accept of a DELETE on purpose: a comment in it says so, because a DELETE has no body either way. It then commits. *Code.*
  - That metadata extensions are served by this resource is *Inference*.
  - The deletion itself is *Measured*.
- **A class create with an unusual Accept creates the class.** `CL_OO_ADT_RES_CLASS` (`CREATE`) reads the body through a plain handler, commits, and writes no response body. *Code*; *Measured*.
- **The generic object framework saves first and checks Accept afterwards.** `CL_WB_ADT_PLUGIN_RESOURCE` (`DO_CREATE_CHILD`) works in this order:
  1. it reads the body (a `415` here);
  2. it records the transport entry;
  3. it saves;
  4. it negotiates the response type (a `406`), and only when it fills a response body.

  A `406` there runs `ROLLBACK WORK`. *Code.*
  - *Measured:* a domain create with an unusual Accept answered `406`, and a read afterwards answered `404`. The domain did not exist.
  - *Inference:* the rollback undid the save. This is not established for every object type, nor for the transport entry.
- **Activation answers `2xx` whatever the headers say.** `CL_SEU_ADT_RES_ACTIVATION` reads and writes through plain handlers. *Code*; *Measured*.
- **The deletion endpoint answers `406` before it deletes anything.** `CL_ADT_DELETION_RESOURCE` (`POST`) checks the Accept before it reads the body. *Code*; *Measured*.

## What follows for a consumer

These are deductions from the findings above. *Inference*, unless tagged otherwise.

- **To learn the acceptable types, a request has to reach the resource's check.** A request on an object that does not exist often ends with `404` first. Many `GET`s, though, answer `406` even on a name that does not exist. *Measured.*
- **A `415` from the checking handler means the body was refused before it was deserialized.** That does not prove nothing happened earlier in the resource.
- **A `406` on a write does not say whether the write left a lasting change.** The work may have run before the check, and it may then have been rolled back, as the domain create above suggests, or not. Read the object's state before sending a write again after a `406`.
- **An unusual header that gets a `2xx` proves neither that the header is right nor that the resource ignores it.**
- **`extractSupportedAccept(error)` and `extractSupportedContentType(error)`** read the two lists described above, and nothing else.
