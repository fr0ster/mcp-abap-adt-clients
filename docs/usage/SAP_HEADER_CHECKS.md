# When SAP checks `Accept` and `Content-Type`

This page says what a `406` or a `415` from an ADT endpoint means, when SAP raises it, and what a request has already done by then. It matters to anyone who passes `options.headers` and corrects a refusal themselves. This library only sends the pair it is given; it never corrects, retries or remembers (see the README, "Accept Negotiation (removed in 36.0.0)").

The findings come from SAP's ABAP sources of the ADT REST framework, read through ADT on an on-premise system on 2026-10-18 with GET requests only. They were checked against an error corpus taken from the same system on the same day. Each statement is tagged:

- **Code:** the class and method it was read in;
- **Measured:** observed on that system;
- **Inference:** deduced, but neither read nor run.

Another release or a cloud system may differ.

## The short version

- **There is no central header check.** The framework checks no `Accept` and no `Content-Type` before it hands the request to the endpoint's resource. *Code.*
- **A `415` is raised when the resource reads its request body.** It happens only if the resource reads the body through the checking wrapper `CL_ADT_REST_COMP_CNT_HANDLER`, or checks the type itself. This is usually before any change. *Code.*
- **A `406` is raised when the resource writes its response body.** Again only through that wrapper, or when the resource negotiates itself. For a write, that is usually **after** the change. *Code.*
- **Some resources check `Accept` up front.** These are the deletion endpoint and the `LOCK` action of the generic object framework. *Code.*
- **Many resources never check either header.** Activation, class create and the deletes of the generic object framework are among them. *Code.*
- **A `500` says nothing about the headers.** It comes from the router before any resource runs, or from a dump at any point. *Code.*

A refusal therefore names the acceptable types only when the request got as far as reading or writing a body through the wrapper. For a `406` on a write, the write has usually happened already.

## The order a request goes through

1. **Logon: `401`.** The ICF authenticates the user before any ADT code runs. *Inference*; *Measured*: the same GET answers `401` without credentials and `406` with them.
2. **Authorization: `403`.** `CL_ADT_WB_RES_APP` (`IF_HTTP_EXTENSION~HANDLE_REQUEST`) checks the development authorization and `S_ADT_RES`. *Code.*
3. **CSRF: `403`.** `CL_REST_HTTP_HANDLER` (`handle_csrf_token`) refuses a request that is not GET, HEAD or OPTIONS and carries no valid token. *Code.*
4. **Routing: `404` or `500`.** `CL_REST_ROUTER` answers `404` when no route matches. It raises an error that becomes a `500` (`text/plain`, "Creation of handler class failed") when it cannot create the routed class. No resource code has run. The collections' accepted types go only into the discovery document; nothing checks a request against them. *Code.*
5. **Method dispatch: `405`.** `CL_ADT_REST_RESOURCE` (`IF_REST_HANDLER~HANDLE`) dispatches GET, POST, PUT and DELETE. A method the resource does not implement raises `cx_adt_res_meth_not_supported`, which gives `405` and `ExceptionMethodNotSupported`. Any other method gets `400`. No header has been read yet. *Code.*
6. **The resource's own work.** The headers are checked here, lazily:
   - **Reading the body.** `IF_ADT_REST_REQUEST~GET_BODY_DATA` calls the resource's content handler. The plain handlers compare nothing. The wrapper `CL_ADT_REST_COMP_CNT_HANDLER` (`DESERIALIZE`) answers `400` `contentTypeMissing` when there is no Content-Type, and `415` `ExceptionUnsupportedMediaType` ("Unsupported Media Type. Supported Media Types: …") when the type does not match. *Code.*
   - **Writing the response.** `IF_ADT_REST_RESPONSE~SET_BODY_DATA` calls the content handler. The wrapper's `SERIALIZE` first runs `check_cnt_type_is_supported()`. With no Accept it answers `400` `acceptHeaderMissing`. When the type does not match, it answers `406` `ExceptionResourceNotAcceptable` ("Accepted content types: …", a list that is often empty). *Code.*
   - **The resource's own choice.** A resource may also call that check itself, at any point, or negotiate on its own. *Code.*
7. **Errors from the work.** An ADT exception becomes an XML exception document with its own status. Any other exception or runtime error is a short dump, which the ICF answers with `500 text/html` ("Application Server Error"). *Code* for the catch clauses; the error page is *Inference*.

## What a refusal means

| Answer | What it says about the headers |
|---|---|
| `401`, `403`, `404`, `405` | Nothing: they come before any header is read. |
| `500` | Nothing: a router failure, or a dump anywhere. |
| `415` | The resource read its body through the wrapper and refused the Content-Type. The body was refused before it was used. |
| `406` | The resource refused the Accept. For a write, the write usually ran first. |
| `400` `acceptHeaderMissing` / `contentTypeMissing` | The resource needs that header and got none. |
| `2xx` with an unusual header | That resource does not compare that header. |

## Examples observed on that system

- **A metadata extension's DELETE with an unusual Accept deletes the object.** `CL_WB_ADT_PLUGIN_RESOURCE` (`DO_DELETE`) ignores the Accept of a DELETE on purpose: a comment in it says so, because a DELETE has no body either way. It then commits. *Code*; the deletion itself is *Measured*.
- **A class create with an unusual Accept creates the class.** `CL_OO_ADT_RES_CLASS` (`CREATE`) reads the body through a plain handler, commits, and writes no response body. Neither header is compared. *Code*; *Measured*.
- **Creates in the generic object framework save first, then check Accept.** `CL_WB_ADT_PLUGIN_RESOURCE` (`DO_CREATE_CHILD`) runs in this order: it reads the body (`415` here), records the transport entry, saves, and only then negotiates the response type (`406`). It negotiates only if it fills a response body. A `406` there runs `ROLLBACK WORK`. Whether that undoes the save is not known; the code was not read that far. *Code*; the rollback's effect is open.
- **Activation answers `2xx` whatever the headers say.** `CL_SEU_ADT_RES_ACTIVATION` reads and writes through plain handlers. *Code*; *Measured*.
- **The deletion endpoint answers `406` before it deletes anything.** `CL_ADT_DELETION_RESOURCE` (`POST`) checks the Accept before it reads the body. *Code*; *Measured*.

## What follows for a consumer

- **To learn the acceptable types, the request must reach the resource's own work.** A request on an object that does not exist usually ends with `404` before any header is checked.
- **A `415` is the safe one to correct.** The body was refused before it was used. *Code*, for the resources that read through the wrapper.
- **A `406` on a write is not a refusal of the write.** It is usually a refusal of the answer to a write that already ran. Sending the request again can repeat the write: an object that already exists, a second transport entry, or a lock that is already held. Read the object's state before resending a write that answered `406`.
- **An unusual header that returns `2xx` proves only that this resource does not compare that header.** It does not prove the header is right.
- **`extractSupportedAccept(error)` and `extractSupportedContentType(error)`** read the two lists described above, and nothing else.
