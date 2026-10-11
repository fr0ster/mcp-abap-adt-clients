# Debugger: open questions left out of #217

These are research notes, not a contract. #217 / PR #218 ships what was settled. This branch holds what was not: what is
known so far, and what would settle each question. Server-source findings are from on premise, BASIS 816, read 2026-10-11.
Measurements give their date.

## Terminal mode end to end

What is known:
- **The server's three keys.** For catching, the server keys a request three ways. It reads the request's terminal id and
  IDE id from its passport through the kernel, not through ABAP:
  - **neither id:** user mode, under the IDE user;
  - **terminal id = IDE id:** IDE id only;
  - **both ids, different:** terminal id + IDE id + IDE user.
- **No setter in ABAP.** No ABAP code sets these ids on a request, and the kernel calls the activation.
- **Eclipse's own runs.** Under the Terminal ID setting, Eclipse's own run (F9) is not caught (measured 2026-10-11, Windows).
  Under Logon user, it is.
- **Another client.** It reports 0 of 7 catches in terminal mode. vscode_abap_remote_fs takes the terminal id from SAP GUI's
  registry entry (or `~/.SAP/ABAPDebugging/terminalId`), so terminal mode targets requests from SAP GUI on the same machine.

To settle:
- **The SAP GUI case.** With a listener in terminal mode that carries SAP GUI for Windows' terminal id, does a report started
  from that GUI (SE38) get caught?
- **What a request carries.** A report that prints its own request's ids is the probe: it calls the kernel read of the
  terminal and IDE id and lists the active listeners.
- **What ships if it works.** A union identity (`user` | `terminal`, with `requestUser` only in `user`), a major change of the
  contract.

## "This project only"

What is known:
- **What the source suggests.** It matches the branch where terminal id = IDE id, which keys on the IDE id alone. That is an
  inference.

To settle:
- **The ids in an Eclipse run.** Run the probe report from Eclipse under that setting and read the ids its request carried.
- **How the ids travel.** Compare with the headers of the run in Eclipse's Communication Log. Look for `SAP-PASSPORT` in
  particular, to see whether a client of ours could carry the same ids.

## `/debugger/actions{?action,value}`

What is known:
- **The actions in the source.** `updateDebugging`, `commitWork`, `rollbackWork`, `garbageCollector`, `kernelDebugger`,
  `memorySnapshot`, and `stepSize` with `stepSizeLine` or `stepSizeExpression`.
- **Other clients.** None of those surveyed uses it.

To settle: what each action answers at a stop, and how it differs from `setDebuggerSettings`.

## Debuggee sessions

What is known:
- **`method=getDebuggeeSessions`** lists only debuggees already caught for the listener's key.
- **`method=notifyDebuggeeToStop&debuggeeSessionId=`** stops a debuggee that is already under the debugger's control. It goes
  through the RFC module `DEBUGGEE_STOP`.

To settle: whether either helps a consumer, for example to stop a debuggee that runs on after `detachDebugger`.

## Background jobs

What is known:
- **Registering the job step.** A job step can be registered for debugging before the job starts
  (`CL_BTC_JOB_DEBUGGING=>REGISTER_JOB_STEP`).
- **Handing it to ADT.** When the job runs, the kernel can hand it to an ADT listener (`TPDA_BTCACT` with `ACTIVATE_ADT`).
- **The pre-check.** It requires all of these:
  - a SAP GUI request inside ADT;
  - `S_DEVELOP` DEBUG ACTVT 90 on the job's user;
  - a user-mode listener on the job's server;
  - an external breakpoint.

To settle:
- **Plain HTTP.** Can any part of this be done from plain ADT HTTP?
- **An unregistered job.** Does a plain user breakpoint catch a job step that was not registered? It would, if the job's
  request is enabled for catching at its start like any other request.

## SM50 and SM04 from a session without SAP GUI

What is known:
- **The kernel opcodes.** `TH_DEBUG_WP` (`ThWpInfo` opcode_wp_debug) and SM04's `ThUsrInfo` opcode_debug_session target the
  requester's SAP GUI logon.
- **What they need.** `S_ADMI_FCD=PADM` and `S_DEVELOP` DEBUG (ACTVT 90 for another user).
- **Where they work.** On the local instance only. A remote instance is reached through RFC with the caller's logon key.

To settle: what they do when called from an HTTP session that has no SAP GUI. Do they fail, get lost, or open somewhere?
This is the only route left to a process that is already running.

Measured 2026-10-11: a request already running is never caught by a breakpoint armed after it started. This held for 30 s
loops, with and without `WAIT`.
