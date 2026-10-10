# The ADT debugger, measured

**Status:** measured on three platforms and implemented as `AbapDebugger`
(`src/runtime/debugger/`), with its contract `IAbapDebugger` in
`@mcp-abap-adt/interfaces-adt` 13.1.0.

- **S/4HANA 2023 on premise (SAP_BASIS 758)**, 2026-10-08/09, raw HTTP and RFC
  through a SAProuter — contributed with #207 by @CoVeles, whose corpus is
  below.
- **On premise, SAP_BASIS 816**, 2026-10-09/10, HTTP and RFC.
- **SAP BTP ABAP Environment**, 2026-10-09/10.

The last two through this package, by `scripts/probe-debugger-*.ts` and
`src/__tests__/integration/runtime/debugger/`. Where the releases differ, the
text says which.

External debugging over ADT, with nothing installed on the server: the
breakpoints, the listener and the attached debuggee are SAP's own resources
under `/sap/bc/adt/debugger`.

Measured on S/4HANA 2023 on premise (SAP_BASIS 758), 2026-10-08, as raw HTTP:
one stateful session for the debugger, a second session running a throwaway
`if_oo_adt_classrun` class over `POST /sap/bc/adt/oo/classrun/<class>`. The
exchanges are in `corpus/adt/`:

- `debugger-conversation--*`: everything, including the refusals.
- `debugger-run-to-line--*`: a run to a line and a continue to the end.
- `debugger-kinds-and-exception--*`: each breakpoint kind on its own, and a
  caught exception that stops.
- `debugger-message-and-objects--*`: a message breakpoint that stops, and an
  object tree four levels deep.

On 758 a script of #207 repeated a conversation through that PR's own
`AbapDebugger` over `@mcp-abap-adt/connection` set stateful: breakpoint with a
condition, listen, attach, stack, variables, step over, run to line, continue
to the end, cleanup.

The protocol itself was first worked out by vibing-steampunk, whose debugger
works over the same resources; what is new here is the measurement on this
release and the refusals listed below.

## Two sessions: the listener's, and the debuggee's

The debuggee is attached to the ABAP session that sent the `attach`. Every
later request — stack, variables, steps — has to come from that session, or
SAP answers `noSessionAttached`. So the attach goes on a connection that is
**stateful until the debuggee is released**, and that nothing else uses
meanwhile. The members do not set the session type; that is the caller's, as
everywhere in this package.

On the 758 system, a single application server, the listen and the attach went
on one session. That does not hold in general:

- **On the cloud** the debuggee runs on whichever application server took the
  request. An attach on the listener's session was refused `500
  invalidDebuggee` whenever that server differed from the listener's. On a
  **new** stateful session, sent with the header `saplb: <INSTANCE_NAME from
  the listener's answer>`, the attach succeeded 10 runs of 10, 5 of them
  across servers. Eclipse does the same.
- **On 816**, a session that has attached once cannot attach again: `500
  Debuggee already attached`.

So: the listener on one stateful session, and each debuggee caught attached on
a new one, routed by `saplb`.

A blocking listen occupies the session: SAP serialises a stateful session, so a
request sent on it while the listen waits queues behind it. Aborting the listen
client-side does not end it on the server.

## The requests

| Member | Request | Accept |
|---|---|---|
| `setBreakpoints` | `POST /debugger/breakpoints`, body `dbg:breakpoints` | `*/*` |
| `getBreakpoints` | `GET /debugger/breakpoints?debuggingMode=user&requestUser&terminalId&ideId&scope=external` | `*/*` |
| `listen` | `POST /debugger/listeners?debuggingMode=user&requestUser&terminalId&ideId&timeout=N` | `application/vnd.sap.as+xml` |
| `stopListener` | `DELETE /debugger/listeners?debuggingMode=user&requestUser` | `*/*` |
| `attach` | `POST /debugger?method=attach&debuggeeId&dynproDebugging=true&debuggingMode=user&requestUser` | `*/*` |
| `getStack` | `GET /debugger/stack?method=getStack&emode=_&semanticURIs=true` | `*/*` |
| `goToFrame` | `PUT <stackUri from the stack>` | `*/*` |
| `getVariables` | `POST /debugger?method=getVariables`, body `asx:abap` | `application/vnd.sap.as+xml` |
| `getChildVariables` | `POST /debugger?method=getChildVariables`, body `asx:abap` | `application/vnd.sap.as+xml` |
| `stepInto` / `stepOver` / `stepReturn` / `stepContinue` | `POST /debugger?method=<step>` | `*/*` |
| `stepRunToLine` | `POST /debugger?method=stepRunToLine&uri=<source uri>#start=N` | `*/*` |

**Accept.** On 758, ADT matched a resource on its URI and on the media type
it can produce, and a concrete Accept it could not produce was answered `404 No
suitable resource found`, not `406`. On 816 and on the cloud the members'
`application/xml` and `application/vnd.sap.as+xml` were answered; the memory
endpoints there answer `406` and name the type they serve.

The members `AbapDebugger` ships are `setBreakpoints`, `deleteBreakpoint`,
`listen`, `stopListener`, `attach`, `getStack`, `setStackPosition` (rather than
the `PUT <stackUri>` above, which is the same move), `getVariables`,
`getChildVariables`, `setVariableValue`, `step`, `stepToLine`,
`terminateDebuggee`, the watchpoints and the memory members. There is no
`getBreakpoints`: the answer is always empty (below).

## What SAP answers

**Breakpoints.**
- The set is keyed by `requestUser`, `terminalId` and `ideId`. A `POST`
  **replaces** the whole set; an empty set clears it and answers
  `<dbg:breakpoints/>`.
- `GET` answers `200` with an **empty body**. The set that was sent is the
  caller's to keep.
- A placed breakpoint comes back with an `id` naming the include and the line
  in it (`…INCLUDE=ZCL_X============CM002.LINE_NR=9`), and with the `uri` and
  the source line as sent (`…/source/main#start=32`).
- A refused one comes back with `errorMessage="Cannot create a breakpoint at
  this position"` and **neither `id` nor `uri`** — only its kind.
- The answer is **not in the order the set was sent**: the refused breakpoint,
  sent second, came back first (`debugger-conversation--01`). A placed one
  echoes what identifies it: the `uri` with `#start=N` for a line,
  `statement`, `exceptionClass`, or `msgId`, `msgNo` and `msgTy`. So the
  refused ones are those sent that do not come back placed.
- Without `systemDebugging="true"`, breakpoints in SAP standard code are
  accepted and never stop (vibing-steampunk's finding, not re-measured here).

**Breakpoint kinds** (each sent alone, `debugger-kinds-and-exception--01…10`):

| Kind | Attributes | Answer |
|---|---|---|
| `line` | `adtcore:uri="<source uri>#start=N"` | placed, `KIND=0…` |
| `statement` | `statement="MESSAGE"` | placed, `KIND=1.STATEMENT=MESSAGE` |
| `exception` | `exceptionClass="CX_SY_ZERODIVIDE"` | placed, `KIND=5…` — a superclass too, and **a class that does not exist**, unchecked |
| `message` | `msgId`, `msgNo`, `msgTy` | placed, `KIND=12.MSGID=….MSGNO=….MSGTY=…` |
| `badi`, `method` | — | `200`, that breakpoint refused: `Invalid breakpoint kind  badi` |

- All four placed kinds took a `condition`.
- A message breakpoint without `msgTy` makes SAP refuse the **whole set**:
  `400 Attribute 'msgTy' expected`, with `XML_PATH` naming the breakpoint.
- A message breakpoint stopped on `MESSAGE ID 'ZCV' TYPE 'S' NUMBER '777' INTO
  …` (`debugger-message-and-objects--06`).
- An exception breakpoint stopped on an exception that the code **catches**.
  The stack showed the `CATCH` line, one after the division
  (`debugger-kinds-and-exception--15`).
- An exception breakpoint set while a debuggee was already attached did
  **not** stop in that run: the continue ran to the end
  (`debugger-message-and-objects--12…13`).

**Listen.**
- Nobody stopped within `timeout`: `200` with an empty body (`timeout=5`
  answered after 5.2 s).
- A stop: an `asx:abap` list of `STPDA_DEBUGGEE`, with `DEBUGGEE_ID`,
  `DEBUGGEE_USER`, `PRG_CURR`, `INCL_CURR` and `LINE_CURR`.
- `LINE_CURR` is the line **in the include** (`9` in `…CM002`), not in the
  class source. The stack has the source line.
- Another listener for the same user (an Eclipse debugging that user) is
  refused with subtype `conflictDetected` (vibing-steampunk's finding, measured
  since — see the end of this page).

**Attach.**
- `dbg:attach` answers with the session's capabilities and
  `dbg:reachedBreakpoints`.
- The debuggee is attachable only while it waits; attach straight after the
  listen. Later it answers `invalidDebuggee`.

**Stack.**
- `dbg:stack`, innermost first.
- Each `stackEntry` has `line` (the source line) and `adtcore:uri`
  (`…/source/main#start=32,0`). For SAP code, the uri has a fragment like
  `#type=CLAS%2FOM;name=POST;start=29`.
- Positions are not unique: an ABAP frame and a DYNP frame can both be `2`.
- On this release there is **no `isActive` attribute**.

**Go to frame.** `PUT <stackUri>` answers `200` with an empty body.

**Variables.**
- `getChildVariables(['@ROOT'])` gives the scopes. Here these were `ME`,
  `@PARAMETERS` and `@LOCALS`; other releases offer `@GLOBALS` and no
  `@LOCALS`.
- A structure expands by id (`LS_ROW` gives `LS_ROW-ID` and `LS_ROW-NAME`).
- An internal table answers `getChildVariables` with **`200` and an empty
  body**. Its rows are asked for by subscript, `LT_ROWS[1]`, `LT_ROWS[2]`, …,
  and come back as `LT_ROWS[1]-ID` and so on. `getVariables` on the table gives
  `TABLE_LINES`.
- An unknown name in `getVariables` answers `200` with an empty body, not a
  refusal.
- `getVariables` takes ABAP paths: `ME->MV_NAME`, `ME->MO_CHILD->MV_NAME`,
  `ME->MR_NUMBER->*`, `ZCL_X=>GV_INSTANCES`, `ME->MS_CFG-TAGS`
  (`debugger-message-and-objects--11`).

**Objects** (`debugger-message-and-objects--07…10`):
- Expanding an object reference gives its attributes, with ids such as
  `{O:126*\CLASS=ZCL_X}-MV_NAME`.
- Each attribute carries `ACCESS_KIND` (`public`, `protected`, `private`),
  `INSTANTIATION_KIND` (`instance`, `static`) and `KIND` (`variable`,
  `constant`).
- An inherited attribute also carries `INHERITANCE_LEVEL` and
  `INHERITANCE_CLASS`. For example, a `CL_ABAP_ELEMDESCR` shows
  `CL_ABAP_TYPEDESCR` at level 2, and its private inherited attributes use
  `{O:128!\CLASS=CL_ABAP_TYPEDESCR}-…`.
- A nested reference expands by its own id. A data reference gives `…->*`.
  Structures and tables inside an object expand the same way as elsewhere.
  Four levels went without a limit.
- Expanding an object of a standard class also returns all of its constants:
  67 KB for one type descriptor.

**Steps.**
- `stepInto`, `stepOver` and `stepReturn` answer `dbg:step`. The stack read
  afterwards has moved: into `DOUBLE`, line 38, back to 33, then on to 34.
- `stepRunToLine` with `uri` answers `200` and stops on that line.
- `stepContinue` that lets the program finish answers `500 AdiFailed`, subtype
  `debuggeeEnded`, T100 `TPDA_ADT/030` "Debugging session has been
  terminated". That is the continue having worked.

**After the end.**
- `getStack`: `404 AdtFailed`, subtype `noSessionAttached` (`SY/530`).
- `getVariables`: `500 AdiFailed`.
- `stepContinue`: `400 ExceptionInvalidData`, subtype `noSessionAttached`.

**There is no detach.** `POST /debugger?method=detach` answers `400
ExceptionInvalidData "Unknown method ''"`. A debuggee is released by
`stepContinue`.

**Stop the listener.**
- `DELETE /debugger/listeners?debuggingMode=user&requestUser=…` answers `200`
  with an empty body. On 758 it also removed the user's external breakpoints.
- vibing-steampunk found that a DELETE naming the client's `terminalId` and
  `ideId` matched nothing. On 816 and on the cloud (2026-10-10) it did: a
  listen waiting on one session ended 3–4 s after that DELETE from another,
  exactly as after the DELETE naming the user only.

**The CSRF fetch** (`HEAD /sap/bc/adt/core/discovery` with
`X-CSRF-Token: fetch`) answered `400` and still carried the token. That is the
connection's business, not this package's, and it handles it.

## The refusal that does damage — on one release

`stepRunToLine` without `uri` answers `400 ExceptionParameterNotFound`,
"Parameter uri could not be found" (`SADT_RESOURCE/017`), everywhere.

- **On 758** the debuggee ran on to the end in the same moment. The triggering
  request returned its output while that `400` was in flight, and the next
  request answered `debuggeeEnded`
  (`corpus/adt/debugger-conversation--24-stepruntoline-no-uri` and the steps
  after it).
- **On 816 and on the cloud** (2026-10-10) the debuggee stayed where it was:
  10 s later the stack still stood on the line, and the run returned only after
  a `stepContinue`.

Because one release loses the stop, the line is a required argument of
`stepToLine` and not an option. `stepJumpToLine` was measured on 816 and on
the cloud: it moves the debuggee to the line without running what lies
between (a fill loop skipped, the program then reporting 0 rows).

## Over RFC

Measured on 2026-10-09 against an S/4HANA system that is reachable for ADT only over RFC (its
`/sap/bc/adt` answers 403 over HTTP), through a SAProuter. The connection was this package's
`AdtOnPremConnector` over `RfcTransport`, set stateful. The trigger was a second RFC session of
the same user calling `RFC_READ_TABLE` with a made-up table name, which a condition on the line
breakpoint matched.

| Run | Result |
|---|---|
| Basic, trigger after 4 s | caught; attach; stack top `SAPLSDTX:49`; `QUERY_TABLE` read; `stepOver` → line 77; `stepContinue` → `500 debuggeeEnded`; trigger raised `TABLE_NOT_AVAILABLE`; cleanup |
| Trigger after 45 s, `timeout=120` | the same, caught after a 46-second listen |
| `timeout=240`, nobody stops | `200` with an empty body after the full 240 s, no error |

Afterwards neither `ABDBG_EXTDBPS` nor `ABDBG_LISTENER` held a row for the user.

So the resources, the requests and the answers are the same as over HTTP. Two things follow from
how `RfcTransport` works:

- **Only stateful requests share the persistent conversation**; every other request runs in a
  conversation of its own, reset or thrown away. So `setSessionType('stateful')` is needed over
  RFC exactly as over HTTP. (`docs/usage/RFC_CONNECTION.md` called it a no-op; corrected in the
  same change.)
- **There is no client-side deadline and no cancel**, and a call holds the client's lock until the
  server answers. The listen above held its connection for 240 s; the trigger and a listener stop
  belong on a second connection.

## Measured since, on 816 and on the cloud

- **Listener conflict.** Two listeners of one user conflict by `ideId`; the same
  `ideId` never does. With `checkConflict=true&isNotifiedOnConflict=true` the
  newcomer is refused `409` `conflictDetected` (`SY/530`); without them it
  displaces the other, whose poll answers `409` `conflictNotification`.
- **`terminateDebuggee`** ends the debuggee: `500 AdiFailed`, subtype
  `terminateDebuggee`, on 816; `200` on the cloud.
- **`setVariableValue`** changed a local, and the next read showed it.
- **Watchpoints** — create, list, delete under `/debugger/watchpoints`.
- **An exception breakpoint** stopped only where a handler existed up the
  stack, at the `CATCH` line — as on 758.
- **Memory**: `GET /debugger/memorysizes?includeAbap=true` (Accept
  `application/vnd.sap.adt.debugger.memory.sizes.v1+xml`) and the
  `memorySnapshot` action; the snapshots are read through
  `/runtime/memory/snapshots` (see `ERRATA.md`).

## Not measured yet

- The 7.50 stack fallback (`POST /debugger?method=getStack…` where `GET
  /debugger/stack` is `404`), the `@GLOBALS` tree and `isActive`.
- A statement breakpoint actually stopping. It was placed, but not fired: on a
  shared user it would stop other people's requests too.
- Whether a false condition on a statement, exception or message breakpoint
  keeps it from stopping.
- The debugger batch as Eclipse uses it — a step answered with the stack in
  one round trip.
