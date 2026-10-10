# Debugger: activation modes, what another client sends, what the system advertises

Research notes, not a contract. Each claim gives its source, and "measured" means a capture on a system with its platform and date. The issue for the open questions is #217.

## Eclipse ADT: breakpoint activation

Project → Properties → ABAP Development → Debug → **Breakpoint activation**:

- **Logon user** (default). External breakpoints catch requests running under the project's logon user.
- **User**. Another user, for example to catch an RFC or HTTP request that runs under a different user.
- **Terminal ID**. Request-based debugging. A breakpoint catches only requests started from one terminal. SAP GUI generates the id once per Windows logon and stores it under `HKEY_CURRENT_USER\Software\SAP\ABAP Debugging`. Further GUI windows join it with `/HTID`, and a browser joins through the SAP HTTP plugin. With no terminal id, SAP answers `TPDA 661`.
- **This project only**. Limits breakpoints to the project that set them. Community posts describe that the project which created the breakpoint owns the debug session, wherever the request came from.

Sources: [SAP tutorial](https://developers.sap.com/tutorials/abap-environment-custom-entity-debug/), [SAP Help, external breakpoints](https://help.sap.com/saphelp_em92/helpdata/en/78/2fad99556043b2bf219b5d227ba0e6/content.htm), [ADT debugger troubleshooting](https://blogs.sap.com/2020/04/21/adt-abap-debugger-what-to-do-if-your-program-does-not-stop-at-breakpoints/), [software-heroes](https://software-heroes.com/en/blog/abap-tools-wirk-with-eclipse-breakpoint), [Abapinho](https://abapinho.com/en/2014/05/request-based-debugging/).

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

The same probe tried to show whether an "empty" breakpoint set from S2 removes S1's breakpoints. It is not evidence: the request carried no `syncScope`, so it added nothing and removed nothing. Separately, S1's breakpoint caught nothing on a second run, even with S1 listening alone. That is still unexplained.
