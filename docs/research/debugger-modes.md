# Debugger: activation modes, what another client sends, what the system advertises

Research notes, not a contract. Each claim gives its source, and "measured" means a capture on a system with its platform and date. The issue for the open questions is #217.

## Eclipse ADT: breakpoint activation

Project → Properties → ABAP Development → Debug → **Breakpoint activation**:

- **Logon user** (default). External breakpoints catch requests running under the project's logon user.
- **User**. Another user, for example to catch an RFC or HTTP request that runs under a different user.
- **Terminal ID**. Request-based debugging. A breakpoint catches only requests started from one terminal. SAP GUI generates the id once per Windows logon and stores it under `HKEY_CURRENT_USER\Software\SAP\ABAP Debugging`. Further GUI windows join it with `/HTID`, and a browser joins through the SAP HTTP plugin. With no terminal id, SAP answers `TPDA 661`.
- **This project only**. Limits breakpoints to the project that set them. Community posts describe that the project which created the breakpoint owns the debug session, wherever the request came from.

Sources: [SAP tutorial](https://developers.sap.com/tutorials/abap-environment-custom-entity-debug/), [SAP Help, external breakpoints](https://help.sap.com/saphelp_em92/helpdata/en/78/2fad99556043b2bf219b5d227ba0e6/content.htm), [ADT debugger troubleshooting](https://blogs.sap.com/2020/04/21/adt-abap-debugger-what-to-do-if-your-program-does-not-stop-at-breakpoints/), [software-heroes](https://software-heroes.com/en/blog/abap-tools-wirk-with-eclipse-breakpoint), [Abapinho](https://abapinho.com/en/2014/05/request-based-debugging/).

## Eclipse ADT debugger settings, and what each may map to

The list below summarises SAP Help pages, as a reviewer collected them (2026-10-10). The pages are "Setting ABAP Debugging Preferences", "Setting ABAP Project-Specific Debug Settings", "AMDP Debugger Settings", "Debugging ABAP Code" and "Comparing ABAP Debugging in SAP GUI and ADT". The summary was not checked against the pages here. The protocol column is our reading: **known** means captured or advertised by the discovery; **likely** means it comes from abap-adt-api's requests; **unknown** means nothing yet.

| Level | Setting | What it does | Protocol |
|---|---|---|---|
| Global (Window → Preferences → ABAP Development → Debug) | Enable debugging of system programs | Steps into programs with status SYSTEM and stops at breakpoints there; when off, system code is stepped over and its breakpoints do not fire | known: `systemDebugging` in `setDebuggerSettings`; the first call after an attach ignores `false` (server source, BASIS 816, read 2026-10-11) |
| Global | Always create exception object | Creates the exception object even where `CATCH` has no `INTO` (older ADT) | known: `createExceptionObject` in `setDebuggerSettings` |
| Project (Configure Project Specific Settings) | Breakpoint validity: This project only | Only requests started from this project; external HTTP/RFC requests are not caught | settled in part: a `terminalId` equal to `ideId` selects the breakpoint key of that IDE alone (server source, BASIS 816, read 2026-10-11), so the request must carry that id; it travels in the request's `SAP-PASSPORT` (measured 2026-10-12, see "Measured: terminal mode and the passport") |
| Project | Breakpoint validity: Logon user (default) | Requests running under the logon user | known: `debuggingMode=user`, `requestUser` = the logon user |
| Project | Breakpoint validity: User | Requests running under another user (HTTP/RFC) | known: `debuggingMode=user`, `requestUser` = that user; measured end to end on premise (2026-10-11), see below |
| Project | Breakpoint validity: Terminal ID | Requests carrying that terminal id | known: `debuggingMode=terminal`, `terminalId`, no `requestUser` (discovery and server source, BASIS 816, read 2026-10-11); listener, check, breakpoints and delete answer `200` on premise (2026-10-11); a run carrying the ids in its `SAP-PASSPORT` is caught (measured 2026-10-12, see "Measured: terminal mode and the passport") |
| Project → Advanced | Allow debugging of tool requests | Lets ADT's own requests be debugged (for developing ADT tools) | unknown; of interest to any client of the ADT API, this one included |
| Breakpoints view | Line, conditional, exception, statement breakpoints; watchpoints; enable/disable | Kinds and states of a breakpoint; in ADT the validity scope decides what is caught, there is no separate "external" kind | known: `kind`, `condition` (line breakpoints only), `/watchpoints`; `deactivated` is parsed and has no effect (server source, BASIS 816, read 2026-10-11); `skipCount` is accepted on an external breakpoint and ignored, the first hit stops (measured on premise, 2026-10-11, BASIS 816) |
| Active session (debugger actions) | System debugging, Update debugging, Normal debugging | Switched during a session; update debugging is turned on at a stop before `COMMIT WORK` | known: `/debugger/actions{?action,value}` (discovery) and the `actions` in attach/step answers; known: `setDebuggerSettings` (`systemDebugging`, `updateDebugging`, `createExceptionObject`, `backgroundRFC`, `sharedObjectDebugging`, `showDataAging`), measured on premise (2026-10-11), see below |
| Background jobs | Debug a job | From ABAP Platform 2020 (SAP_BASIS 7.55) a job can be debugged through SM37, given the authorisation | unknown in ADT |
| AMDP (Project → AMDP) | Debug mode: only procedures containing breakpoints / all called procedures | Which SQLScript procedures are compiled in debug mode: faster start or fewer optimisation side effects | likely: `cascadeMode` on `/sap/bc/adt/amdp/debugger/main{?stopExisting,requestUser,cascadeMode}` (discovery) |

For the SAP BTP ABAP environment, the settings that matter most are Logon user/User (which user an OData request runs under), This project only (whether an external HTTP request is caught), system debugging (given the authorisation) and tool-request debugging. A setting being offered in Eclipse does not mean that the backend allows that mode: that depends on the platform, the release and the authorisations.

What still needs research is how each remaining "unknown" and "likely" row is carried on the wire. The open items (a catch in terminal mode, "This project only", job-step debugging) are tracked on the branch `research/debugger-terminal-mode`, in `docs/research/debugger-open-questions.md`. That means a capture of Eclipse with the setting changed, read against the discovery templates above.

## What abap-adt-api sends

[abap-adt-api](https://github.com/marcellourbani/abap-adt-api) 8.4.3 (`build/api/debugger.*`) is the client behind vscode_abap_remote_fs. Its requests are the same resources as ours, with these differences.

**Modes and ids**
- `type DebuggingMode = "user" | "terminal"`. Terminal mode is the same listener, breakpoint and attach requests with `debuggingMode=terminal`; `requestUser` is optional there and "mandatory in user mode".
- `terminalId`: "a GUID generated the first time any debugger is ran on the current machine", stored in the Windows registry as above, elsewhere in `~/.SAP/ABAPDebugging/terminalId`.
- `ideId`: "UI5 hash of the IDE's workspace root".

**Listeners**
- `debuggerListeners` is a `GET /sap/bc/adt/debugger/listeners` with `debuggingMode, requestUser, terminalId, ideId, checkConflict`. It checks for a listener without polling, and answers an error when another client listens.
- `debuggerListen` defaults to `checkConflict=true&isNotifiedOnConflict=true`, as Eclipse.
- A listener error carries `conflictText` and `ideUser` beside the T100 key.

**Breakpoints**
- `POST /debugger/breakpoints` carries `systemDebugging`, `deactivated` and a `syncScope`:
  - `<syncScope mode="full"/>` replaces the set of that identity;
  - `<syncScope mode="partial"><adtcore:objectReference adtcore:uri="…"/></syncScope>` replaces only the breakpoints of one object.
- Each `<breakpoint>` carries `clientId` and `skipCount`, and optionally `condition`. The answer echoes `clientId` on each breakpoint, and on each error as well, with `errorMessage`. Since `interfaces-adt` 15 / `adt-clients` 29 the library sends `clientId` (any kind) and no longer has `skipCount`.
- `scope` is `external` or `debugger`.

**The debuggee a listener catches** carries:
- `TERMINAL_ID`, `IDE_ID`, `DEBUGGEE_USER`;
- the place: `PRG_CURR`, `INCL_CURR`, `LINE_CURR`, and as an object `URI`, `TYPE`, `NAME`, `PARENT_URI`, `PACKAGE_NAME`;
- the server: `APPLSERVER`/`APPSERVER`, `INSTANCE_NAME`, `HOST`, `IS_SAME_SERVER`, `CAN_ADT_CROSS_SERVER`;
- `IS_ATTACH_IMPOSSIBLE`, `DBGEE_KIND`;
- a dump: `DUMP_ID`, `DUMP_DATE`, `DUMP_TIME`, `DUMP_HOST`, `DUMP_UNAME`, `DUMP_URI`;
- `LISTENER_CTX_ID`, `DBGKEY`, `RFCDEST`.

**Attach and step answers** carry:
- `isSteppingPossible`, `isTerminationPossible`, `isPostMortem`, `isNonExclusive`;
- `actions` (name, title, link, value, disabled);
- `reachedBreakpoints` with `unresolvableCondition`;
- after a step, `isDebuggeeChanged` and the debugger `settings`.

**Steps**
- `stepInto | stepOver | stepReturn | stepContinue | stepRunToLine | stepJumpToLine | terminateDebuggee | detachDebugger`. `detachDebugger` lets the debuggee go on without terminating it.

**Settings and stack**
- `POST /debugger?method=setDebuggerSettings` with `<dbg:settings systemDebugging createExceptionObject backgroundRFC sharedObjectDebugging showDataAging updateDebugging/>`.
- The stack position is set either by `PUT` on a frame's stack URI (newer) or by `method=setStackPosition&position=N` (older).

## What the system advertises

`GET /sap/bc/adt/discovery`, on premise (2026-10-10):

```
/sap/bc/adt/debugger                      (no template)
/sap/bc/adt/debugger/listeners{?debuggingMode,requestUser,terminalId,ideId,timeout,checkConflict,isNotifiedOnConflict}
/sap/bc/adt/debugger/listeners{?debuggingMode,requestUser,terminalId,ideId,checkConflict,notifyConflict}
/sap/bc/adt/debugger/listeners{?debuggingMode,requestUser,terminalId,ideId,checkConflict}
/sap/bc/adt/debugger/breakpoints{?checkConflict}
/sap/bc/adt/debugger/breakpoints/{statements,messagetypes,conditions,validations,vit}
/sap/bc/adt/debugger/stack, /actions{?action,value}, /batch
/sap/bc/adt/debugger/variables/{variableName}/{part}{…}
/sap/bc/adt/debugger/watchpoints{?variableName,condition}
/sap/bc/adt/debugger/memorysizes{?includeAbap}
/sap/bc/adt/debugger/systemareas/{systemarea}{?offset,length,element,isSelection,selectedLine,selectedColumn,programContext,filter}
/sap/bc/adt/amdp/debugger/main…, /sap/bc/adt/datapreview/amdpdebugger…
```

The templates do not enumerate the values of `debuggingMode`. No collection lists waiting debuggees, so a debuggee is learned only from a listener's catch.

Two different things must not be confused:
- **A debug session.** A debuggee caught at a breakpoint and attached, which is what all of the above is about.
- **A process.** A running work process, such as the ones SM50/SM66 show and can switch into debugging. ADT cannot reach a running process or request: see "Measured: another user, a running request, processes" below.

## Measured: the ids under both conflict modes

On premise (2026-10-10), one SAP user, `debuggingMode=user`. S1 arms a line breakpoint and listens in refuse mode. S2, with no breakpoints of its own, listens in the mode shown. A third session runs the program.

| `terminalId` | `ideId` | S2 mode | S2's listener | S1's poll | Caught by |
|---|---|---|---|---|---|
| same | same | refuse | accepted | to its timeout, empty | S2 |
| other | same | refuse | accepted | to its timeout, empty | S2 |
| same | other | refuse | `409 conflictDetected` | kept | S1 |
| other | other | refuse | `409 conflictDetected` | kept | S1 |
| same | same | take-over | accepted | to its timeout, empty | S2 |
| other | same | take-over | accepted | to its timeout, empty | S2 |
| same | other | take-over | accepted | `409 conflictNotification` | S2 |
| other | other | take-over | accepted | `409 conflictNotification` | S2 |

- **The conflict is decided by `ideId`.** The same `ideId` never conflicts, and the newer listener catches.
- **`terminalId` changed nothing** under user mode. It takes part in the breakpoint set's key but filters no catch, which fits it being the key of terminal mode.
- **Breakpoints belong to the user.** Under take-over, a listener of another IDE caught a breakpoint only the first one had set.
- **A run without `checkConflict` showed no conflict at all.** A probe of this must send the mode explicitly.

The same probe tried to show whether an "empty" breakpoint set from S2 removes S1's breakpoints. It is not evidence: the request carried no `syncScope`, so it added nothing and removed nothing.

In the same probe, S1's breakpoint caught nothing on a second run. A later, cleaner measurement does not repeat it (below): there, one listener that kept polling caught the same breakpoint again on the next run, without re-arming. The first probe terminated each debuggee and restarted its listeners between runs. That is the likely difference, but it was not isolated.

## Measured later: a second catch, a catch around a stop, the AMDP stack

On premise and on the cloud (2026-10-11), through the MCP server's debugger built on this library: `debuggingMode=user`, random ids, refuse mode.

- **A breakpoint catches again.** One listener caught a line breakpoint, continued the debuggee to its end, and kept polling. The next run of the program was caught at the same breakpoint, with no re-arm. Measured on both platforms.
- **Attach after the listener stopped.** A poll caught a debuggee, and then the listener was stopped (`DELETE /debugger/listeners`). Attaching that debuggee still answered `200`. `stepContinue` then answered `500` `debuggeeEnded`, the same as when the listener was stopped after the release, and the program finished at once with its output.
- **A catch nobody attaches.** The listener was stopped and the debuggee was not attached. The system held it about 30 s (30.2 s in two runs) and then let it run to its end, with complete output. After that, a fresh listener under the same ids caught nothing in 20 s. Attaching the old debuggee id answered `500` `AdiFailed`, subType `invalidDebuggee` (SY/530). Whether a listener started within the 30 s catches it again was not measured.
- **The AMDP call stack** (`<amdpdbg:callstack>` in an `ON_BREAK`), with three nested procedures and a breakpoint in the innermost:
  - the first `callstackEntry` is the innermost frame, where it stopped;
  - `index` counts from 1 at the outermost, so the top has the highest index;
  - a caller that is not debug-compiled has `isDebugCompiled="false"` and native line `0`, and its `#start=` points at the caller's METHOD line, not at its CALL;
  - `cascadeMode NONE` was enough to stop in the nested procedure.

## Measured: terminal mode and the passport

On premise (2026-10-12), BASIS 816, one SAP user, several connections through this library.

**How a request carries the ids.** The ADT client puts them in the request's `SAP-PASSPORT` header: a DSR passport, version 3, system type 10, a random root context id and transaction id, and two system variable items, (2, 1) the terminal id and (2, 2) the IDE id, 16 bytes each. A run URL has no parameter for them (discovery: `classrun` and `programrun` take only `profilerId`). This library builds the same passport (`src/runtime/debugger/passport.ts`); its output was compared byte for byte with SAP's passport library on the same fields.

| Run | Listener in terminal mode | Caught |
|---|---|---|
| class run, no passport | ids T, I | no |
| class run, passport with T, I (T ≠ I) | ids T, I | yes, attach, stack and continue answered |
| class run, passport with T, T | ids T, T | yes |
| class run, passport with zero root context id and transaction id | ids T, I | yes |

**Two IDEs of one user in terminal mode.** A (ids Ta, Ia) arms line 12 and listens; B (ids Tb, Ib) checks, arms line 10 and listens.

- **The check and the listen disagree.** B's `checkListener` answered `409`, but B's listen was accepted and both listened. Without B's own arming first, B's listen answered `409`.
- **Each run is caught by its own listener only.** A run with B's passport was caught by B, at B's line.
- **The breakpoints are still the user's.** After B armed, a run with A's passport was caught by nobody; after A armed again, a run with A's passport was caught by A and a run with B's by nobody. The last arming replaced the other's set, whatever the ids.
- **A stopListener under B's ids left A listening** in terminal mode; in user mode the same call ended A's listener.

## Server source and measurements, 2026-10-11

Server source: on premise, BASIS 816, read 2026-10-11, paraphrased and never quoted. Measurements: on premise (2026-10-11), BASIS 816, two users on two connections, through this library.

**Server source**
- **Breakpoint ownership.** At most 30 breakpoints per key. In user mode the key is the IDE user plus the request user; in terminal mode it is the IDE user plus the terminal id; a terminal id equal to the IDE id selects the IDE-id-only key. A replacement reaches every IDE that shares the key. Measured 2026-10-12, the terminal-mode part does not hold as read: a replacement under other terminal and IDE ids of the same user replaced the set too (see "Measured: terminal mode and the passport").
- **Replacing.** A breakpoints request without `syncScope` first deletes every external breakpoint of the key, even when it is `validationOnly`. `syncScope mode="full"` replaces the key's set. `mode="partial"` replaces only the line breakpoints of the main programs its object references map to; a line breakpoint outside that scope is refused, with a message that names the wrong kinds.
- **Fields.** `deactivated` is parsed and has no effect. `skipCount` has no place in the stored form of an external breakpoint. `condition` applies to line breakpoints only.
- **Detach and terminate.** `detachDebugger` without an id lets the debugger leave and the program run on. With the id of a caught but unattached debuggee it tries to attach it, and when that fails removes the activation and still answers success. `terminateDebugger` frees the ABAP session the request runs in, so the answer is a plain `500`; `terminateDebuggee` ends the program.
- **Settings.** Four attributes are mandatory and merge (`true` sets, `false` clears, an empty value keeps); `showDataAging` is taken from each request and does not merge.
- **The listener context** is created once per ABAP session, for the first identity a listen, check, stop or attach used, and reused for every later one.
- **The check.** `GET /listeners?checkConflict=true` starts nothing; the authorisation check runs first (`403`), a conflict answers `409` with `conflictText` and `ideUser`, and none answers `200` with an empty body.
- **Processes.** SM50 and SM04 attach a work process through the kernel and open the debugger in the requester's SAP GUI. No key that routes the stop to an ADT listener exists.

### Measured: another user, a running request, processes

- **Another user, end to end.** One user armed a line breakpoint and a take-over listener with `requestUser` set to a second user. The second user's class run was caught after 1.2 s, the debuggee named the second user, and attach, stack and `stepContinue` answered ok; the run finished with its output. Debugging another user's requests needs `S_DEVELOP` with `DEBUG` and `ACTVT` 90 on that user, and SAP answers `403` otherwise.
- **A running request is not caught.** A 30 s loop, with and without a one-second wait in it, kept passing a breakpoint armed (with its listener) 10 s after the start. Neither stopped, and the listener stayed silent for 45 s. A request is enabled for catching when it starts, and only then.
- **SM50 and SM04.** Read in the source, not measured; consistent with the previous point.
- **The check's 409.** The check for a user who held their own listener answered `409 AdiFailed` with `conflictText` and `ideUser`. It did not answer `403`: the catching user had the authorisation.
- **Terminal DELETE.** Deleting a terminal-mode breakpoint requires the `requestUser` parameter: left out it answers `400 ExceptionParameterNotFound`, empty or the logon user it answers `200`. A terminal identity sends it empty.
- **Terminal mode.** Check, listen, stop, set and delete answer `200`. A catch is unmeasured: Eclipse's own runs under Terminal ID were not caught, another client reports 0 of 7, a run from SAP GUI for Windows is untested.
- **`setBreakpoints` replaces.** A run of a second program was caught with nothing in between, and not caught after `setBreakpoints` with another line, after a `validationOnly` request, or after `stopListener` (which deletes the key's breakpoints). `partial` keeps the other program's line breakpoints and an exception breakpoint.
- **`clientId`.** The server echoes `clientId` on every row of the answer, placed and refused alike, and does not keep the request's order: with five rows sent (two line rows the server refuses with "Cannot create a breakpoint at this position", one line row placed, two exception rows placed) the two refused rows came first. A line breakpoint is also renumbered, so neither position nor id pairs an answer row with its request row; `clientId` does. The library sends it on any kind (`adt-clients` 29); a recorded answer is `src/__tests__/fixtures/debugger/breakpoints-answer-client-id.xml`, sanitised.
- **`skipCount`.** A value of 2 on a loop stopped at the first pass, in three runs.
- **Detach.** Without an id the run finishes, and a listener standing at the time caught the same run again at the next pass of the armed line. With the id of an unattached debuggee it answers `200` and the run returned about a second later, not after the ~30 s hold. With the id of a debuggee attached elsewhere it answers `200` and the attached session still steps it.
- **`terminateDebugger`.** A plain `500`; the program returned its output at the same moment; the next request on that session answered `400` (session gone).
- **Settings.** The answer is the six attributes in force. `true`, then `{}`, keeps `true`; `false` clears; `showDataAging` `true`, then `{}`, answers `false`. The first call after an attach with `systemDebugging=false` answered `false`, which cannot tell "ignored" from "applied".
- **The listener context.** A listener for a second request user started on a session that had served another identity waited for the first identity and caught nothing; on a session of its own it caught.

## Contract follow-ups

Done in `interfaces-adt` 15 / `adt-clients` 29:

- `skipCount` left the contract.
- `syncBreakpoints` was reworded.
- `setBreakpoints` is described as replacing the key's set, not adding to it.
- `clientId` was added.

Nothing is open.
