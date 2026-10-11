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
| Global (Window → Preferences → ABAP Development → Debug) | Enable debugging of system programs | Steps into programs with status SYSTEM and stops at breakpoints there; when off, system code is stepped over and its breakpoints do not fire | likely: `systemDebugging` on `<dbg:breakpoints>` and in `setDebuggerSettings` |
| Global | Always create exception object | Creates the exception object even where `CATCH` has no `INTO` (older ADT) | likely: `createExceptionObject` in `setDebuggerSettings` |
| Project (Configure Project Specific Settings) | Breakpoint validity: This project only | Only requests started from this project; external HTTP/RFC requests are not caught | unknown; perhaps the `ideId` scoping seen in the measurement |
| Project | Breakpoint validity: Logon user (default) | Requests running under the logon user | known: `debuggingMode=user`, `requestUser` = the logon user |
| Project | Breakpoint validity: User | Requests running under another user (HTTP/RFC) | likely: `debuggingMode=user`, `requestUser` = that user |
| Project | Breakpoint validity: Terminal ID | Requests carrying that terminal id | likely: `debuggingMode=terminal`, `terminalId` |
| Project → Advanced | Allow debugging of tool requests | Lets ADT's own requests be debugged (for developing ADT tools) | unknown; of interest to any client of the ADT API, this one included |
| Breakpoints view | Line, conditional, exception, statement breakpoints; watchpoints; enable/disable | Kinds and states of a breakpoint; in ADT the validity scope decides what is caught, there is no separate "external" kind | known: `kind`, `condition`, `/watchpoints`; likely: `deactivated` (breakpoint set) and `skipCount` |
| Active session (debugger actions) | System debugging, Update debugging, Normal debugging | Switched during a session; update debugging is turned on at a stop before `COMMIT WORK` | known: `/debugger/actions{?action,value}` (discovery) and the `actions` in attach/step answers; likely: `setDebuggerSettings` (`updateDebugging`, `backgroundRFC`, `sharedObjectDebugging`) |
| Background jobs | Debug a job | From ABAP Platform 2020 (SAP_BASIS 7.55) a job can be debugged through SM37, given the authorisation | unknown in ADT |
| AMDP (Project → AMDP) | Debug mode: only procedures containing breakpoints / all called procedures | Which SQLScript procedures are compiled in debug mode: faster start or fewer optimisation side effects | likely: `cascadeMode` on `/sap/bc/adt/amdp/debugger/main{?stopExisting,requestUser,cascadeMode}` (discovery) |

For the SAP BTP ABAP environment, the settings that matter most are Logon user/User (which user an OData request runs under), This project only (whether an external HTTP request is caught), system debugging (given the authorisation) and tool-request debugging. A setting being offered in Eclipse does not mean that the backend allows that mode: that depends on the platform, the release and the authorisations.

What still needs research is how each "unknown" and "likely" row is carried on the wire. That means a capture of Eclipse with the setting changed, read against the discovery templates above.

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
- Each `<breakpoint>` carries `clientId` and `skipCount`, and optionally `condition`. The answer echoes `clientId` on each breakpoint, and on each error as well, with `errorMessage`.
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
- **A process.** A running work process, such as the ones SM50/SM66 show and can switch into debugging. Whether ADT can reach a running process at all, and through which resource, is not researched yet; nothing in this document answers it.

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
