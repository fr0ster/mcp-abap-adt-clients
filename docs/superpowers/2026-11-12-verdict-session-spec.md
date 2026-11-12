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

**Rule — one request.** An answer carries the session facts of the one request it answers
(goal, "Goal" item 2): a success, the mark of the wire its result was read from; a failure,
the facts of the request its verdict was built from — `sessionError` and `sessionLost` of
the thrown value, or `sessionLost` of the 2xx wire a refusal was read from. Nothing is
gathered from other requests of the same member. A request after a marked one rejects
`ADT_NOT_CONNECTED` (section 1), so a member that goes on after a marked answer answers that
code, and the consumer learns the instance is spent from `sessionError`. The library writes
the fields only into objects it builds itself; a verdict a consumer's strategy answered is
answered as it came (section 5).

For each request a member sends and judges, the mark is
`lost = sessionLostOf(thrown) ?? wire?.sessionLost`: the thrown value's own mark when the
request rejected (a marked refusal carries it on the error, not on its `response`,
section 1), else the resolved wire's, read as typed.

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
- **`answeringExchange`, success**: `succeeded(value, lost)` with `lost` of the member's own
  request (`run`'s answer, or the thrown refusal whose verdict `analyse` cleared).
  `succeeded` takes it as an optional second parameter and puts the field on the
  `IAdtResult` only when defined. Independent of the result strategy: `rawDocument` and
  `nothing` drop the wire, the mark still reaches the consumer.
- **`answeringExchange`, failure**: the library's verdict from `recogniseFailure` carries
  its fields. A verdict from `exchange.failure` (activation's second read) is built from
  that second request's thrown value (`activationUtils.ts`, lines 270–275, spreading
  `recogniseFailure`'s answer), so it carries the second request's facts; the result, had
  `analyse` cleared it, would be read from the first request's wire and carry that wire's
  mark (`adtResponse.ts`, lines 381–384, 429). Each answer names the request it is built
  from; no field is moved between the two.
- **Activation's second read** (`fetchInactiveObjects`, `src/core/shared/getInactiveObjects.ts`,
  line 35): a mark on its successful answer is not carried — it is not the request the
  member answers. The instance is spent, so the consumer's next request answers
  `ADT_NOT_CONNECTED`. Its failure carries its own facts (above).
- **`chain`** (`src/core/shared/chain.ts`): `step` records the mark of each step's success
  (`getResult().sessionLost`); the chain's success (line 133) carries it. Attributable to
  one request: after a marked step every later request rejects `ADT_NOT_CONNECTED`, so a
  chain that succeeds after a marked step can only have it as its last request it judged.
  The chain's failure is the failing step's failure as answered (`ChainAbandoned`,
  lines 95–98, 162–163) or `recogniseFailure`'s — the facts of that failing request: a step
  rejected `ADT_NOT_CONNECTED` after a marked one carries `sessionError`, not the earlier
  step's `sessionLost`. Cleanups and rollbacks (`unwind`, lines 107–123) answer nothing to the
  consumer — their failures are logged — so they carry nothing. `AdtMessageClassMessage`,
  built on `chain`, gets this with no change of its own.
- **`getSystemInformation`** (`src/utils/systemInfo.ts`, one request, its own composition):
  `lost` of its request is carried by every verdict it builds and every success —
  the thrown verdict (lines 143–146, spreading `recogniseFailure`'s), the non-2xx verdict
  (lines 152–158), the 2xx-with-unreadable-body verdict (lines 162–167), the success read
  from a thrown `404` (line 193, `present: false`, the mark on the thrown value), the success
  after `analyse` cleared a thrown refusal, and the successes at lines 193–194.
- **The batch connection** (`src/batch/AdtBatchConnection.ts`): each part's answer is built
  from the envelope's. A marked envelope marks every part it carried: each resolved part
  wire gets `sessionLost` (a fresh object, `{ ...answer, sessionLost }`), and each part's
  refusal (`Object.assign(new Error(…), { response })`, lines 163–169) gets it too. An
  envelope that rejects rejects every part with that one object, which carries the
  connection's fields as they came. **Attribution**: the part's request travelled in the
  envelope, so the envelope's answer is its answer.
- **`withRequestTrace`** (`src/utils/requestTrace.ts`, lines 140–152): `request` is written
  only onto a thrown object (`typeof error === 'object' && error !== null`), inside `try`, in
  two steps: first `Reflect.set(error, 'request', asked)` — today's assignment, answering
  `false` instead of throwing, so an existing writable `request` (configurable or not) is
  updated with its attributes unchanged; when that answers `false` (an inherited read-only
  `request`, as on a layered refusal), `Reflect.defineProperty` with a writable, enumerable,
  configurable descriptor, as the batch connection already writes it (lines 199–206), which
  makes an own property. A second `false` (a non-extensible value, an own read-only
  `request`) or a throw (a Proxy's trap) leaves the value unannotated, and the value is
  rethrown as it came. A primitive is rethrown as it came. A plain assignment onto a layered
  refusal throws `TypeError` (**Measured**, section 1) and would replace SAP's refusal and
  its mark with that `TypeError`. The success path (`{ ...response, request }`, line 158)
  already keeps the own `sessionLost` (a spread copies own enumerable properties). This is
  the one behaviour change: a thrown value that cannot take `request` — a frozen or layered
  object, a Proxy that refuses, a primitive — is rethrown as itself instead of a
  `TypeError`; the comment at lines 140–142 ("the TypeError says so") goes with it, and
  `recogniseFailure` already answers a thrown string (`message`, line 266).

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
`analyse` with a one-line example. The verdict and the wire `analyse` receives may come from
different requests (activation's second read, section 4); a strategy that carries a mark
says which request's it carries, as the shipped ones do: `enrich` keeps the verdict's
(the request the verdict was built from), `asFailure` takes the wire's (the request it read
the refusal from).

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
- `chain`: a marked last step → the chain's success carries it; a marked step followed by a
  step rejecting `ADT_NOT_CONNECTED` → the chain's failure carries `sessionError` and not the
  earlier step's `sessionLost`; a cleanup rejecting `ADT_NOT_CONNECTED` after a successful
  chain → the success as it was (logged only);
- activation: a marked activation answer whose second read rejects `ADT_NOT_CONNECTED` → the
  failure carries `sessionError` (the second request's) and no `sessionLost`; `analyse`
  clearing it → the success carries the activation answer's `sessionLost`; a marked second
  read → the answer carries no `sessionLost`;
- `getSystemInformation`: a marked thrown `404` → `present: false` with `sessionLost`; a
  marked 2xx with an unreadable body → the verdict carries it; `analyse` clearing a marked
  thrown refusal → the success carries it;
- batch: a marked envelope → every part's success and refusal carry it;
- `withRequestTrace` on a layered refusal over a frozen error → the refusal and its mark
  come through, with `request` set; on a frozen error, a Proxy whose `defineProperty` trap
  throws, and a thrown string → each rethrown as the same value, unannotated; an own
  non-configurable writable `request` → replaced with the asked request, its attributes
  unchanged;
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
- CHANGELOG: adt-clients 45.4.0, adt-strategies 0.22.3, adt-clients-legacy 0.9.3 (no code
  change; its ranges move so that its verdicts are promised the fields).

## 9. Versions and release order

1. interfaces-adt 27.3.0 (`^4.2.0` of interfaces-adt-connection, which is on the registry)
   — merged, tagged, published from the interfaces repository.
2. In this PR, once 27.3.0 is on the registry: `@mcp-abap-adt/interfaces-adt` `^27.3.0` and
   `@mcp-abap-adt/interfaces-adt-connection` `^4.2.0` in adt-clients, adt-strategies and
   adt-clients-legacy (`sharedDependencyRanges.test.ts` refuses a drift).
   - adt-strategies **0.22.3**: the change is additive (section 5), and a patch keeps every
     `^0.22.0` range that names it valid; adt-clients' devDependency on it `^0.22.3`.
   - adt-clients **45.4.0**.
   - adt-clients-legacy **0.9.3**: no code change; its `peerDependencies` and
     `devDependencies` on adt-clients move from `^45.1.0` to `^45.4.0`
     (`packages/adt-clients-legacy/package.json`, lines 66–70), so a legacy consumer is
     promised the adt-clients whose `answering` carries the fields, and its devDependency on
     adt-strategies to `^0.22.3`. Published, unlike in 45.3.0, because its ranges change in
     what they promise.
   - The lockfile regenerated by `npm install --package-lock-only`; `"link": true` only for
     the three workspace siblings. adt-clients' devDependency `@mcp-abap-adt/connection`
     stays `^20.0.0`: the tests above use stubs, and no test here needs 23.0.0.
3. Published in `publishOrder` (root `package.json`, lines 9–13): adt-strategies, then
   adt-clients, then adt-clients-legacy; each tagged `<directory>-v<version>`.
4. The mcp-abap-adt server moves to adt-clients 45.4.0 and connection 23.0.0.
