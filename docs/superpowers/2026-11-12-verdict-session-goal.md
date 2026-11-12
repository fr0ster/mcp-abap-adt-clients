# Goal: the verdict carries what the connection says about the SAP session

## Goal

A consumer of `@mcp-abap-adt/adt-clients` reads what the connection said about the SAP
session from the typed answer of a member, by fields, never from a message:

1. **The connection's session error code.** When the value the connection threw carries a
   code of `ADT_SESSION_ERROR` (`@mcp-abap-adt/interfaces-adt-connection`:
   `ADT_NOT_CONNECTED`, `ADT_SESSION_REPLACED`, `ADT_RELEASE_PENDING`), the failure
   (`IAdtError`) carries it as a typed field (`AdtSessionErrorCode`).
2. **The `sessionLost` mark** (`AdtSessionLoss`, interfaces-adt-connection 4.2.0) of the
   one request a member answered:
   - on a failure, when the thrown value carries it (SAP's refusal of a stateless request
     whose answer showed the session replaced), the failure carries it as a typed field;
   - on a success, when the wire response the member's answer was read from carries it,
     the consumer of the `IAdtResponse` reads it from a typed field as well.

The use that drives it: the mcp-abap-adt server drops a debugger stop whose connection is
spent, reading `ADT_NOT_CONNECTED` / `ADT_SESSION_REPLACED` from the verdict; and a
connection that marks a stateless answer `sessionLost` after a session replacement has
that mark reach the server through the member's answer, success or failure.

The field types go to `@mcp-abap-adt/interfaces-adt` (a minor); adt-clients fills them
(a minor).

## Invariants

- **Fields, never words.** Every fact above is read from a typed field of the answer; no
  consumer and no code of this change reads or matches a message.
- **Static types first.** The new fields are typed by the contract
  (`AdtSessionErrorCode`, `AdtSessionLoss` from interfaces-adt-connection), not as
  `string` or `unknown`. No cast, `any`, non-null `!`, `@ts-ignore` or regular expression
  in production code of this change.
- **The thrown value is read as data.** It comes from outside the type system, so it is
  read as `rfcOf` and `connectionCauseOf` read it: own data properties only (a getter never
  runs, an inherited field is no field), each value compared with the closed list it must
  belong to, and an inspection that throws is no field. The classifier never throws on
  what was thrown at it.
- **Present only when said.** A field is present when the connection said it, and absent
  otherwise; nothing is inferred from a status, a message or another field. A value off
  its closed list is absent, never kept as text.
- **Existing fields keep their meaning.** `IAdtError.code` stays the strategy's failure
  code (`readonly code?: string`, whose documented constants are `AdtObjectErrorCodes`);
  `connectionCause`, `rfc`, `origin`, `message`, `response` and
  `request` answer what they answer today. What a strategy builds or enriches today is
  not changed in meaning.
- **No behaviour change beyond carrying.** Every member sends the requests it sends today;
  nothing is retried, resent, delayed or timed out; no session is restored or torn down
  by the library; `answering`'s table (which verdicts `analyse` may clear) holds as it is.
  An unanswered credential refusal still rejects as the same object.
- **Additive.** Optional fields, `?: T | undefined` (for `exactOptionalPropertyTypes`, as
  `connectionCause` and `rfc`): an implementation, strategy or consumer that conforms
  today conforms after — interfaces-adt and adt-clients take a minor each.
- **Dependencies come from the registry, in order.** interfaces-adt-connection 4.2.0
  published; then the interfaces-adt minor (its own PR in the interfaces repository),
  published; then adt-clients built and tested against the published packages; then the
  server. No link to another repository at any stage.
- **Legacy answers the same.** `@mcp-abap-adt/adt-clients-legacy` answers through
  adt-clients' `answering`, so its verdicts carry the same fields with no override of
  its own.

## What there is today

Labels: **Measured** (observed by running), **Code** (read in the source named).

### adt-clients 45.3.0 (`packages/adt-clients/src/utils/adtResponse.ts`)

- **Code.** `recogniseFailure` (lines 226–275) has three branches: an `AdtSAPError`
  (a refusal read from a 2xx document; lines 227–236), a credential refusal SAP answered
  with `401` (lines 241–249), and everything else as `origin: 'connection'`
  (lines 253–274) carrying `message`, `response`, `request`, and — read from the thrown
  value — `connectionCause` (lines 160–168) and `rfc` (lines 186–208). The thrown value's
  `code` is read only by `connectionCauseOf`, which keeps it only when it is one of
  `ADT_CONNECTION_CAUSES`; a session code (`ADT_NOT_CONNECTED`, …) is dropped. Nothing
  reads `sessionLost`.
- **Code.** `ownValue` (lines 100–104) is the own-data-property reader both `rfcOf` and
  `connectionCauseOf` use; each wraps the inspection in `try` and answers `undefined` on a
  throw.
- **Code.** `answeringExchange` (lines 371–430): on a success the wire is handed to the
  result strategy (`read(wire)`, line 429) and the answer is `succeeded(value)`
  (lines 56–63), whose `IAdtResult` holds `value` alone. A `sessionLost` on the wire
  reaches the consumer only if its result strategy keeps the wire: `wireItself` does,
  `rawDocument` and `nothing` (`src/utils/resultStrategy.ts`, lines 37–70) do not.
  `analyse` receives the wire as its second argument (lines 402–405).
- **Code.** On a failure with a response attached, the wire is taken from the thrown
  value's `response` (line 391) and `IAdtError.response` carries it (line 267), so a mark
  set on that response object would be reachable as `response.sessionLost`, untyped by
  the failure's own fields; a mark set on the thrown error itself (where the connection
  puts it, below) is not carried.
- **Code.** Other callers of `recogniseFailure`: `src/core/shared/chain.ts` (line 163,
  a chain's abandoned step), `src/utils/systemInfo.ts` (line 145),
  `src/utils/activationUtils.ts` (line 270, the inactive-objects read after a silent
  activation checklist, whose failure is spread into a new verdict).
- **Code.** `withRequestTrace` (`src/utils/requestTrace.ts`, lines 111–159) wraps every
  connection the clients are given: on a success it answers `{ ...response, request }`
  (line 158), a spread that keeps every own enumerable property of the connection's
  response; on a failure it writes `request` onto the thrown value and rethrows it
  (lines 151–152), except an unanswered credential refusal and a batch envelope's
  failure, which it rethrows as they came, unannotated (lines 149–150).
- **Code.** `AdtClient.assertConnected` (`src/clients/AdtClient.ts`, lines 293–304) throws
  an `Error` with `code = ADT_SESSION_ERROR.NOT_CONNECTED` from a factory call when the
  connection says it is not connected — a throw, not a verdict.
- **Code.** adt-strategies (`packages/adt-strategies/src/refusals/analyse.ts`): `enrich`
  (lines 108–124) spreads the library's verdict, so its fields survive; `asFailure`
  (lines 51–65) and the unit-test run check (around line 364) build a new `refusal` from a
  2xx answer with `response: answer`, carrying no field of the library's verdict.
- **Code.** adt-clients-legacy imports `answering` from `@mcp-abap-adt/adt-clients`
  (e.g. `src/core/interface/AdtInterfaceLegacy.ts`, lines 13–19) and has no
  `recogniseFailure` of its own.
- **Code.** Dependency ranges: `@mcp-abap-adt/interfaces-adt` `^27.2.0` and
  `@mcp-abap-adt/interfaces-adt-connection` `^4.1.0` in `packages/adt-clients/package.json`
  (lines 119–120), `packages/adt-strategies/package.json` (lines 43–44) and
  `packages/adt-clients-legacy/package.json` (lines 62–63); adt-clients' dev dependency
  `@mcp-abap-adt/connection` `^20.0.0` (`packages/adt-clients/package.json`, line 131).

### interfaces-adt 27.2.0 (`packages/interfaces-adt/src/adt/IAdtResponse.ts`)

- **Code.** `IAdtError` (lines 132–237): `origin`, `message`, `adtType?`, `namespace?`,
  `response?`, `request?`, `code?` (`string`: the strategy's failure code, its documented
  constants `AdtObjectErrorCodes`; lines 173–195), `connectionCause?` (lines 197–217) and `rfc?` (lines 218–236). No
  session code, no `sessionLost`.
- **Code.** `IAdtResult<T>` (lines 328–331) holds `value` alone; its comment names it as
  where anything a result needs to say about itself goes when a case appears.
- **Code.** `IAdtSuccess` / `IAdtFailure` / `IAdtResponse` (lines 269–289, 388–390).
- **Code.** interfaces-adt's `package.json` (line 39) declares `@mcp-abap-adt/interfaces-adt-connection`
  `^4.1.0`; `AdtSessionLoss` needs `^4.2.0`.

### interfaces-adt-connection 4.2.0

- **Code.** `ADT_SESSION_ERROR` and `AdtSessionErrorCode`
  (`src/IConnectionCapabilities.ts`, lines 15–30); `AdtSessionLoss =
  typeof ADT_SESSION_ERROR.SESSION_REPLACED` (lines 32–38).
- **Code.** `IAbapConnectionError` (`src/IAbapConnectionError.ts`, lines 84–104): `code?`
  (a session code or a Node network code), `rfc?`, `sessionLost?`.
- **Code.** `IAdtWireResponse.sessionLost?` (`src/IAbapConnection.ts`, line 35): present on
  the answer of a stateless request whose answer showed the session replaced.
- **Measured.** 4.2.0 is tagged in the interfaces repository and not on the npm registry
  yet (`npm view @mcp-abap-adt/interfaces-adt-connection versions` ends at 4.1.0).

### The connection (`@mcp-abap-adt/connection`)

- **Code.** Session errors are `Error`s with an own `code` set by `sessionError(code)`
  (`src/session/SessionLifecycle.ts`, lines 54–63 on the master branch); thrown as
  `ADT_NOT_CONNECTED` and `ADT_SESSION_REPLACED` from `AbstractAbapConnection.ts`.
- **Code.** The open change for 23.0.0 (mcp-abap-connection PR 103) is documents only so
  far; its specification (`docs/superpowers/2026-11-12-session-replaced-read-spec.md` on
  branch `fix/session-replaced-read`, section 3.1, lines 71–91) requires `sessionLost` as an
  own property on the resolved `IAdtWireResponse` of a stateless request (success) and on the
  rejected error (refusal: SAP's refusal as the wire threw it, its `response`, `code` and
  message unchanged). 23.0.0 is not released; the registry's latest is 22.0.1
  (**Measured**).

## Open for the spec

- **The field names and where they live in `IAdtError`.** A new field for the session code
  (`code` is the strategy's) and `sessionLost`; the closed lists each is compared with
  (`ADT_SESSION_ERROR`'s values, `AdtSessionLoss`).
- **How a success's mark reaches the consumer of an `IAdtResponse`.** On `IAdtResult`
  beside `value` (typed by the contract, independent of the result strategy), or through
  the result strategy (and then which shipped strategies keep it), or another carrier —
  and what this means for a consumer's own `IAdtResponse` implementation.
- **A refusal read from a 2xx answer.** When a document on a successful wire is a refusal
  (`AdtSAPError`, a strategy's `asFailure`, a shipped `analyse`), whether that failure
  carries the wire's `sessionLost`, and who fills it — the library before `analyse`, or
  each strategy.
- **When `analyse` replaces a verdict.** A consumer's `analyse` may answer a verdict of its
  own instead of the library's (`adtResponse.ts`, lines 406–407); shipped `enrich` keeps the
  fields by spreading, a replacement need not. Who makes the fields reach the answer then,
  and which wins when the strategy's verdict names a different value.
- **When `analyse` clears a verdict.** A failure carrying the session code or the mark
  that `analyse` clears to a success read from the same wire: whether the mark survives
  on the success.
- **Members of more than one request.** A chain (`chain.ts`), activation's second read
  (`activationUtils.ts`), the message-class write, a batch envelope's failure shared by
  every part: which request's mark or code the member's answer carries.
- **The other `recogniseFailure` callers** (`systemInfo.ts`, `activationUtils.ts`,
  `chain.ts`) and the credential-refusal branch: how each keeps the new fields on the
  verdict it builds (`systemInfo.ts` and `activationUtils.ts` spread `recogniseFailure`'s
  answer into a verdict of their own).
- **`AdtClient.assertConnected`'s throw** of `ADT_NOT_CONNECTED`: whether it stays a throw
  (outside `IAdtResponse`) or is in scope.
- **The test evidence**: unit tests over connection stubs that throw or resolve the
  measured shapes, and which live run proves it (the mcp-abap-adt server's, after
  connection 23.0.0 is published), labelled unit-only where no live run is possible.
- **Documentation**: README ("What a call answers with", beside `connectionCause` and
  `rfc`), `docs/usage/CLIENT_API_REFERENCE.md`, CHANGELOG.
