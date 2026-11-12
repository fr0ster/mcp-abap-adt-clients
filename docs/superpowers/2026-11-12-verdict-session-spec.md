# Spec: the verdict carries the connection's session code and sessionLost

The goal is `docs/superpowers/2026-11-12-verdict-session-goal.md`; its invariants bind this
spec. Labels: **Measured** (observed by running), **Code** (read in the source named),
**Inference** (concluded, not observed).

## 1. What the connection hands over

The shapes adt-clients reads, as `@mcp-abap-adt/connection` 23.0.0 makes them (tag `v23.0.0`
of mcp-abap-connection):

- **A session error** — an `Error` with an own, writable, enumerable `code`, one of
  `ADT_SESSION_ERROR`'s values (`sessionError`, `src/session/SessionLifecycle.ts`). No
  `response`. Thrown, among others, for a request on an instance whose session is gone
  (`ADT_NOT_CONNECTED`, `AbstractAbapConnection.ts` around line 1590) and for a stateful
  request whose session was replaced (`ADT_SESSION_REPLACED`). **Code.**
- **A marked success** — the resolved `IAdtWireResponse` is a new object
  `{ ...answer, sessionLost: 'ADT_SESSION_REPLACED' }` (`AbstractAbapConnection.ts`,
  lines 1603–1607): an own, enumerable data property. **Code.**
- **A marked refusal** — SAP's refusal as the wire threw it (its `response`, `code`,
  message unchanged), with `sessionLost` defined as an own, enumerable, read-only data
  property (`markedLost`, lines 1618–1636). A refusal that cannot take the property (frozen,
  sealed, or holding its own fixed `sessionLost`) is answered by `Object.create(error,
  { sessionLost })`: the mark is the new object's own property, and every other field —
  `response`, `code`, `rfc`, `message`, `request` — is **inherited**, not own. **Code.**
- **Measured** (node, a frozen `Error` carrying own `request`, `code`, `response`, layered as
  `markedLost` layers it): an own-data-property read finds `sessionLost` and does not find
  `code`; a plain read of `response` reaches the prototype's; the layered object is
  `instanceof Error`; a plain assignment `layered.request = …` throws `TypeError` under
  strict mode (the prototype's `request` is read-only); `Reflect.defineProperty(layered,
  'request', …)` succeeds and makes an own property.
- **After a marked answer the instance is spent.** The session is lost before the answer
  settles and admission shuts (`raiseSessionLost`, `beginTeardown({ sessionLost: true })`,
  line 1116), so every later request of the same instance rejects `ADT_NOT_CONNECTED`
  (CHANGELOG 23.0.0: "the instance spent"). **Code.** So within one member at most one
  request carries the mark, and every request after it fails with the session code.
  **Inference** from that code.
- **`EPIPE`.** A write to a socket the server reset answered raw `write EPIPE` in the
  mcp-abap-adt CI on macOS (85 of 500 runs on Node 22, 34 of 500 on Node 24). **Measured**
  (in that CI). Node reports it as an error with `code: 'EPIPE'` (`syscall: 'write'`), which
  axios copies onto the error it rejects with. **Inference** (Node and axios behaviour, not
  run here).

## 2. interfaces-adt minor (27.3.0, its own PR in the interfaces repository)

Types and constants only:

- `IAdtError.sessionError?: AdtSessionErrorCode | undefined` — the connection's session
  error code the failure was thrown with. The name follows `ADT_SESSION_ERROR`; `code`
  stays the strategy's failure code (goal invariant "Existing fields keep their meaning").
- `IAdtError.sessionLost?: AdtSessionLoss | undefined` — the request this failure answers
  was answered with the session replaced; the connection's instance is spent.
- `IAdtResult<T>.sessionLost?: AdtSessionLoss | undefined` — the same mark on a success,
  beside `value`. `IAdtResult` is where "anything a result needs to say about itself goes"
  (its own comment, `IAdtResponse.ts` lines 312–315); the mark is the connection's word
  about the request, not a reading of the document, so it is not the result strategy's.
- `ADT_CONNECTION_CAUSES` gains `'EPIPE'` (appended, so existing indices keep their
  member). The typechecks in `src/__typechecks__/connectionCause.ts` follow: the exact-list
  and exact-union assertions name `EPIPE`, and the "code off the list" check uses another
  code (`ECONNABORTED`).
- `@mcp-abap-adt/interfaces-adt-connection` `^4.2.0` (needed for `AdtSessionLoss`).
- `| undefined` on each, for `exactOptionalPropertyTypes`, as `connectionCause` and `rfc`.
  Every type that conforms to 27.2.0 conforms to 27.3.0, apart from code that asserts
  `ADT_CONNECTION_CAUSES` is exactly seven entries.
- README and CHANGELOG of interfaces-adt; a typecheck file per new field (present compiles,
  another `ADT_SESSION_ERROR` value in `sessionLost` does not, a free string does not).

## 3. adt-clients: reading the thrown value

In `packages/adt-clients/src/utils/adtResponse.ts`, beside `connectionCauseOf` and `rfcOf`,
two readers of the thrown value, each with `ownValue` inside `try`, answering `undefined` on
a throw or on a value off its list:

- `sessionErrorOf(error)`: own `code`, found by comparison in
  `Object.values(ADT_SESSION_ERROR)` — typed `AdtSessionErrorCode` with no cast, as
  `RFC_RCS.find` types `codeString`.
- `sessionLostOf(error)`: own `sessionLost`, equal to `ADT_SESSION_ERROR.SESSION_REPLACED`.

Own data properties only (goal invariant). On a layered refusal `sessionLost` is own and
is read; `code` and `rfc` are inherited and are not read — a marked refusal is SAP's HTTP
refusal, whose `code` is not a session code and which carries no `rfc` (only an RFC call
carries one), so nothing the goal promises is lost by it. `response`, `message` and
`request` keep today's plain reads (`carried?.response`, …), which reach a layered
refusal's prototype as they reach any error's own field (**Measured**, section 1).

`connectionCauseOf` is unchanged in code; `EPIPE` reaches it through the extended list.

## 4. adt-clients: which verdicts carry the fields

**Rule.** A failure or success a member answers carries the session facts of the request(s)
that member sent: `sessionLost` when one of them was answered with the mark, `sessionError`
when the failure was built from a thrown value carrying a session code. The library writes
them only into objects it builds itself; a verdict a consumer's strategy answered is
answered as it came (section 5).

- **`recogniseFailure`, generic branch** (`origin: 'connection'`): `sessionError` and
  `sessionLost` from the thrown value, spread in only when defined, as `connectionCause` and
  `rfc` are (lines 272–273). This is where `ADT_NOT_CONNECTED` / `ADT_SESSION_REPLACED`
  reach the server's DebugStop.
- **`recogniseFailure`, `AdtSAPError` branch** (a refusal read from a 2xx document):
  `sessionLost` from `error.response?.sessionLost` — the wire is the connection's
  `IAdtWireResponse`, typed by its contract, so it is read as typed (no runtime guard for
  what the compiler proves). No `sessionError`: a 2xx answer carries no session code.
- **`recogniseFailure`, credential-refusal branch**: unchanged. It is taken only for the
  connection's `AuthRefusedError` (own `refusal` and `at`), and 23.0.0 starts no credential
  renewal from a marked answer (CHANGELOG 23.0.0), so a marked `401` is thrown as itself and
  takes the generic branch. **Code.**
- **`answeringExchange`, success**: `succeeded(value, sessionLost)` with the mark of the
  member's request — the resolved wire's `sessionLost`, or, when `analyse` cleared a verdict
  built from a thrown refusal, that thrown value's (`sessionLostOf(error)`; the mark is on
  the error, not on its `response`, section 1), or the exchange's (below). `succeeded` takes
  it as an optional second parameter and puts the field on the `IAdtResult` only when
  defined. Independent of the result strategy: `rawDocument` and `nothing` drop the wire,
  the mark still reaches the consumer.
- **`answeringExchange`, failure from the library's own verdict** (no `analyse`, or the
  "cleared but nothing came back" row): that verdict already carries the fields from
  `recogniseFailure`; a verdict from `exchange.failure` (activation's second read) gets the
  member's `sessionLost` added when it lacks it, as a fresh plain object — it is the
  library's own.
- **`IAdtExchange.sessionLost?`**: a member that sends a request after its answer (only
  `activationExchange` today) hands that request's mark here: `fetchInactiveObjects`
  (`src/core/shared/getInactiveObjects.ts`, line 35) answers the wire itself, so
  `activationExchange` reads its `sessionLost` as typed. On the failure path the second read's verdict comes from
  `recogniseFailure` and carries its own fields.
- **`chain`** (`src/core/shared/chain.ts`): `step` records a step's `sessionLost` from its
  success; the chain's success carries it (`succeeded(value, lost)`). Its failure is the
  failing step's failure as answered (`ChainAbandoned`) or `recogniseFailure`'s — carrying
  its own fields. `AdtMessageClassMessage`, built on `chain`, gets this with no change of
  its own.
- **`getSystemInformation`** (`src/utils/systemInfo.ts`): its verdict spreads
  `recogniseFailure`'s (line 146), so the fields survive; the verdict built from a non-2xx
  wire (lines 152–158) gets the wire's `sessionLost`; its success carries the wire's.
- **`activationExchange`'s failure** spreads `recogniseFailure`'s (line 271): the fields
  survive.
- **The batch connection** (`src/batch/AdtBatchConnection.ts`): each part's answer is built
  from the envelope's. A marked envelope marks every part it carried: each resolved part
  wire gets `sessionLost`, and each part's refusal (`Object.assign(new Error(…),
  { response })`, line 164) gets it too. An envelope that rejects rejects every part with
  that one object, which carries the connection's fields as they came. **Attribution**: the
  part's request travelled in the envelope, so the envelope's answer is its answer.
- **`withRequestTrace`** (`src/utils/requestTrace.ts`, line 151): `request` is written with
  `Reflect.defineProperty` (writable, enumerable, configurable), as the batch connection
  already writes it (line 201), instead of a plain assignment. A plain assignment onto a
  layered refusal throws `TypeError` (**Measured**, section 1) and would replace SAP's
  refusal and its mark with that `TypeError`; `Reflect.defineProperty` answers `false` on a
  non-extensible value, which is then rethrown as it came, unannotated. The success path
  (`{ ...response, request }`, line 158) already keeps the own `sessionLost` (a spread
  copies own enumerable properties). This is the one behaviour change: a thrown value that
  cannot take `request` is rethrown as itself instead of a `TypeError`.

## 5. A strategy that replaces the verdict

`analyse` receives the library's verdict — carrying the fields — and the wire, whose
`sessionLost` is typed. The library does not rewrite what `analyse` answers:

- a consumer's verdict may be a class instance (`E extends IAdtError`); a copy
  `{ ...verdict, sessionLost }` would type-check as `E` and drop its prototype — a lie the
  compiler cannot catch, against "static types first";
- what an error strategy fills in is the strategy's (interfaces-adt, `IAdtError`: "what a
  strategy chooses is how much of it to fill in"; decision 15: the library interprets
  nothing).

So a replacing strategy carries the fields itself — from the verdict it was given, or from
`answer.sessionLost`. The shipped strategies (`packages/adt-strategies`) do:

- `enrich` spreads the verdict (lines 108–124): unchanged, the fields survive.
- `asFailure` (lines 51–65) and the unit-test run check (around line 364), which build a
  refusal from a 2xx answer, add `sessionLost: answer.sessionLost` when defined.
- The status-renaming strategies (around lines 387–396) spread the verdict: unchanged.

README and `docs/usage/CLIENT_API_REFERENCE.md` state the rule for a consumer's own
`analyse` with a one-line example. When the verdict and the wire disagree there is nothing
to choose: the mark has one value, and the library's verdict and the wire describe the same
request.

## 6. `AdtClient.assertConnected`

Out of scope; unchanged. It throws from a factory call before any member or request exists
— outside `IAdtResponse` — and its error already carries an own `code` of
`ADT_NOT_CONNECTED`, which a consumer reads by narrowing the caught value to
`IAbapConnectionError` (`src/clients/AdtClient.ts`, lines 293–304). **Code.** The spent
connection the server's DebugStop meets is reported by the connection's rejection of the
member's request, which section 4 carries.

## 7. Tests (unit; no SAP system)

A new `src/__tests__/unit/shared/sessionVerdict.test.ts`, shaped like `rfcInfo.test.ts`, over
connection stubs that throw or resolve the shapes of section 1:

- every `ADT_SESSION_ERROR` value thrown as own `code` → `sessionError`, origin
  `connection`, no `connectionCause`; a code off the list, a lower-cased one, inherited,
  behind a getter, behind a throwing Proxy trap → absent;
- a marked refusal, marked in place and layered over a frozen error → `sessionLost`, with
  `response`, `message` and `request` as before; `sessionLost` with another value, inherited
  only, behind a getter → absent;
- a marked success → `getResult().sessionLost` with `rawDocument`, `nothing` and
  `wireItself`; an unmarked one → absent;
- `analyse` clearing a marked refusal → the success carries the mark; a consumer's
  replacing `analyse` → its verdict as it came; the shipped `asFailure` on a marked 2xx
  refusal and `enrich` on a marked verdict → carry it (adt-strategies tests);
- `AdtSAPError` on a marked 2xx wire → `sessionLost`;
- `chain`: a marked last step → the chain's success carries it; a step failing
  `ADT_NOT_CONNECTED` → the chain's failure carries `sessionError`;
- activation: a marked activation answer whose second read rejects `ADT_NOT_CONNECTED` → the
  failure carries both; a marked second read → the answer carries `sessionLost`;
- batch: a marked envelope → every part's success and refusal carry it;
- `withRequestTrace` on a layered refusal over a frozen error → the refusal and its mark
  come through, with `request` set; on a non-extensible value → rethrown as it came;
- `EPIPE` thrown as own `code` → `connectionCause: 'EPIPE'`; `connectionCause.test.ts`
  moves `EPIPE` from the off-list cases to the listed ones (it iterates
  `ADT_CONNECTION_CAUSES`);
- `AbapDebugger.terminateDebugger` over a stub rejecting `ADT_NOT_CONNECTED` →
  `getError().sessionError === 'ADT_NOT_CONNECTED'` — the server's DebugStop case.

**Load-bearing**: each check mutated alone (each own-property read, each list comparison,
each `try`, the `Reflect.defineProperty`, each place the mark is passed on) turns its tests
red, then is reverted. **Unit-only**: no live run here — a session replacement cannot be
provoked on demand from this harness; the stub shapes are the 23.0.0 code's (section 1).
The mcp-abap-adt server's live run, on connection 23.0.0 and this release, proves it.

## 8. Documentation

- adt-clients README, "What a call answers with": `sessionError` and `sessionLost` beside
  `connectionCause` and `rfc`, with the DebugStop example
  (`getError().sessionError === ADT_SESSION_ERROR.NOT_CONNECTED`) and the success's
  `getResult().sessionLost`; `EPIPE` in the cause list; the rule for a consumer's own
  `analyse` (section 5).
- `docs/usage/CLIENT_API_REFERENCE.md` (the failure fields, around line 1512).
- CHANGELOG: adt-clients 45.4.0, adt-strategies 0.23.0; adt-clients-legacy unchanged in
  code (its ranges move, as in 45.3.0).

## 9. Versions and release order

1. interfaces-adt 27.3.0 (`^4.2.0` of interfaces-adt-connection, which is on the registry)
   — merged, tagged, published from the interfaces repository.
2. In this PR, once 27.3.0 is on the registry: `@mcp-abap-adt/interfaces-adt` `^27.3.0` and
   `@mcp-abap-adt/interfaces-adt-connection` `^4.2.0` in adt-clients, adt-strategies and
   adt-clients-legacy (`sharedDependencyRanges.test.ts` refuses a drift); adt-strategies
   0.23.0 and adt-clients' devDependency on it `^0.23.0`; adt-clients 45.4.0. The lockfile
   regenerated by `npm install --package-lock-only`; `"link": true` only for the three
   workspace siblings. adt-clients' devDependency `@mcp-abap-adt/connection` stays
   `^20.0.0`: the tests above use stubs, and no test here needs 23.0.0.
3. Published in `publishOrder`: adt-strategies, then adt-clients.
4. The mcp-abap-adt server moves to adt-clients 45.4.0 and connection 23.0.0.
