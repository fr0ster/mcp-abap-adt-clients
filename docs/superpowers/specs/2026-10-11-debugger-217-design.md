# Debugger: what #217 ships — design

Issue #217, draft PR #218. Research behind it: `docs/research/debugger-modes.md`.

## Goal

Give the ABAP debugger the requests a consumer still lacks for debugging a user's program the way Eclipse does: replacing a
breakpoint set instead of only adding to it, skip counts, the two ways of letting a debuggee go without ending it,
the debugger settings, and a listener check that starts nothing. Write down, with measurements, what ADT cannot do:
attaching to a running process or request.

Debugging another user's requests needs nothing new in this library. `requestUser` already names whose requests a
breakpoint and a listener catch, and it was measured end to end (below). Its consumer flow, a session that waits for user X's
own run, belongs to mcp-abap-adt and comes after this release.

## Out of scope (left for research, a separate issue)

- Measuring a catch in terminal mode. The mode ships (below) with its parameters as the discovery and the server source
  describe them, but no catch was measured. Eclipse's own runs are not caught under Terminal ID (measured 2026-10-11), and
  another client reports 0 of 7. A run from SAP GUI for Windows is untested. A user whose system catches in this mode
  confirms it; one whose system does not files an issue with the wire log, and that data drives the research.
- "This project only", meaning how an IDE id reaches a request's passport (the kernel reads it; no ABAP code sets it).
- `/debugger/actions` (update debugging, commit/rollback, memory snapshot, step size), `getDebuggeeSessions`,
  `notifyDebuggeeToStop`, job-step debugging routed to ADT, SM50/SM04 from a session without SAP GUI.

## Evidence

**Server source** (on premise, BASIS 816, read 2026-10-11; class and line in the research note):

- **Breakpoint ownership, by mode.** At most 30 breakpoints per key.
  - In `user` mode the key is IDE user + request user.
  - In `terminal` mode it is IDE user + terminal id.
  - A terminal id equal to the IDE id selects the IDE-id-only key.

  A replacement reaches every IDE that shares the key. In `user` mode that is any IDE of the same IDE user debugging the same
  request user. In `terminal` mode it is any IDE of the same IDE user with the same terminal id.
- **Without `syncScope`**, a POST replaces everything the key holds, even when it is `validationOnly`: the server
  deletes all of the key's external breakpoints first (measured on premise 2026-10-11, BASIS 816; this corrects an
  earlier reading that it only adds).
  - `syncScope mode="full"` replaces every breakpoint of the key.
  - `syncScope mode="partial"` replaces only the line breakpoints in the main programs its object references map to.
    A line breakpoint outside that scope is refused.
- **`deactivated`** is parsed but has no effect on this release. **`skipCount`** is accepted on an external breakpoint and ignored (measured 2026-10-11: the first hit stops), so
  the builder refuses it.
  **`condition`** applies to line breakpoints only, and the other kinds have it commented out.
- **`detachDebugger`** takes an optional `debuggeeId`. The debugger leaves and the program runs on, and a session breakpoint
  brings the debugger back.
  **`terminateDebugger`** frees the debugger and the program runs on. **`terminateDebuggee`** ends the program.
- **`setDebuggerSettings`** covers `systemDebugging`, `updateDebugging`, `createExceptionObject`, `backgroundRFC`,
  `sharedObjectDebugging` and `showDataAging`.
  - It merges: `true` sets a setting, `false` clears it, and an absent field keeps it.
  - The answer is the settings now in force.
  - The first call after an attach ignores `systemDebugging=false`.
- **`GET /listeners?checkConflict=true`** starts nothing. The authorization check runs first and answers `403`.
  A conflict answers `409` with `conflictText` and `ideUser`, and no conflict answers `200` with an empty body.

**Measured** (on premise, 2026-10-11, two users on two connections):

- **The check.** `GET /listeners?checkConflict=true` for another user who held their own listener answered
  `409 AdiFailed` with `conflictText` "Another session (user …) exists with global debugging scope for user …" and `ideUser`.
  It did not answer `403`: the catching user had the authorization.
- **Another user, end to end.** The catching user armed a line breakpoint and a take-over listener with `requestUser` set to the
  second user. The second user's class run was caught after 1.2 s, the debuggee named the second user, and attach, stack and
  `stepContinue` all answered ok. The run then finished with its output.
- **A running request.** A request already running is never caught. A 30 s loop, with and without `WAIT UP TO 1 SECONDS`, kept
  passing a breakpoint that was armed (with its listener) 10 s after the start. Neither ever stopped, and the listener stayed
  silent for 45 s. A request is enabled for catching when it starts, and only then.
- **Processes.** SM50/SM04 attach a work process through the kernel and open the debugger in the requester's SAP GUI. No key
  that would route the stop to an ADT listener exists. This was read in the source, not measured, and it is consistent with the
  previous point.

## Contract (interfaces-adt 14.0.0 — major)

**The identity becomes a union by mode.** The parameters are those of the discovery template
`/debugger/listeners{?debuggingMode,requestUser,terminalId,ideId,…}` and the server source:

- **`user` mode** takes `requestUser`, the user whose requests are caught.
- **`terminal` mode** catches the requests that carry `terminalId`. For SAP GUI that is its terminal id, which its settings
  show. The server reads no `requestUser` there, so the type has none.
- **`ideId`** names the catching IDE in both modes. A `terminalId` equal to `ideId` means that IDE's own requests only
  (server source; "This project only" in Eclipse is an inference).

```ts
export type IDebuggerIdentity =
  | { debuggingMode: 'user'; requestUser: string; terminalId: string; ideId: string }
  | { debuggingMode: 'terminal'; terminalId: string; ideId: string; requestUser?: never };

interface IBreakpointCommon {
  /** Hits to pass before the breakpoint stops (which hit stops is measured, see Testing). */
  skipCount?: number;
}
export type IDebuggerLineBreakpoint = IBreakpointCommon & {
  kind: 'line';
  uri: string;
  /** An ABAP condition; only a line breakpoint takes one. */
  condition?: string;
};
/** `condition?: never` makes a pre-typed value carrying a condition fail too, not only a fresh literal. */
type NoCondition = { condition?: never };
export type IDebuggerBreakpoint =
  | IDebuggerLineBreakpoint
  | (IBreakpointCommon & NoCondition & { kind: 'exception'; exceptionClass: string })
  | (IBreakpointCommon & NoCondition & { kind: 'statement'; statement: string })
  | (IBreakpointCommon & NoCondition & { kind: 'message'; msgId: string; msgNo: string; msgTy: string });

/**
 * Replace breakpoints instead of adding them. Both scopes touch every IDE that shares the identity's key (see the evidence).
 * `partial` replaces the line breakpoints of the MAIN PROGRAMS its objects map to (two objects of one class pool are one
 * program); an empty `breakpoints` clears that scope. An object that maps to no program leaves the body's line
 * breakpoints unset (server source); the integration test records what the answer says then.
 */
export type IDebuggerBreakpointSync =
  | { scope: 'full'; breakpoints: readonly IDebuggerBreakpoint[] }
  | { scope: 'partial'; objects: readonly [string, ...string[]]; breakpoints: readonly IDebuggerLineBreakpoint[] };

/** What to change; a field left out keeps its current value. */
export interface IDebuggerSettings {
  systemDebugging?: boolean;
  updateDebugging?: boolean;
  createExceptionObject?: boolean;
  backgroundRFC?: boolean;
  sharedObjectDebugging?: boolean;
  showDataAging?: boolean;
}
```

New `IAbapDebugger` members. Each has the usual pair: `(…, options: WithAnalyse<E, O>)` and `(…, options?: WithoutAnalyse<O>)`.

Changed member: `attach(identity, debuggeeId, options?)` replaces `attach(requestUser, debuggeeId, options?)`.

- **What attach sends.** The server reads `debuggingMode`, and reads `requestUser` only in `user` mode. It attaches by
  `debuggeeId` and does not read the ids. So the query is `method`, `debuggeeId`, `debuggingMode`, `requestUser` (`user`
  mode only) and `dynproDebugging`.
- **Other members.** Every other member that takes an identity keeps its signature and sends the mode the identity names.
- **Deleting a breakpoint in `terminal` mode.** The DELETE query requires a `requestUser` parameter in every mode. Measured
  on premise, 2026-10-11, on a terminal-mode breakpoint:
  - left out, it answers `400 ExceptionParameterNotFound`;
  - empty, it answers `200`;
  - the logon user also answers `200`.

  So a terminal identity sends `requestUser=` empty there.

The generic list becomes
`IAbapDebugger<TBreakpoints, TListener, TAttach, TStack, TVariables, TStep, TDone, TWatchpoints, TMemory, TSettings>`, with
`TSettings` appended last. `AbapDebugger`'s results gain `settings` in the same position.

| Member | Request | Answer |
|---|---|---|
| `syncBreakpoints(identity, sync, options?)` | `POST /debugger/breakpoints` with `<syncScope mode>` and, for `partial`, its object references | `TBreakpoints` |
| `checkListener(identity, options?)` | `GET /debugger/listeners?debuggingMode&requestUser&terminalId&ideId&checkConflict=true` | `TDone`. A conflict is the `409` failure |
| `detachDebugger(options?: { debuggeeId?: string } & …)` | `POST /debugger?method=detachDebugger[&debuggeeId=]` | `TDone` |
| `terminateDebugger(options?)` | `POST /debugger?method=terminateDebugger` | `TDone` |
| `setDebuggerSettings(settings, options?)` | `POST /debugger?method=setDebuggerSettings`, body `<dbg:settings>` (below) | `TSettings` |

`debuggeeId` sits in the options rather than in a position, so a caller passes `analyse` without one.

`detachDebugger` has two paths in the server source:

- **Without `debuggeeId`.** It addresses the debuggee attached on this session: the debugger leaves and the program runs on.
- **With `debuggeeId`.** It names a debuggee that was caught but not attached. The server tries to attach it. If that
  fails, it deletes the debuggee's activation and still answers success. This may be how to release an unattached catch
  at once instead of after the ~30 s hold. The tests measure it.

**The settings body.** It follows the server's transformation:

- `<dbg:settings xmlns:dbg="http://www.sap.com/adt/debugger" …/>`.
- **Mandatory attributes.** `systemDebugging`, `createExceptionObject`, `backgroundRFC` and `sharedObjectDebugging` are not
  conditional in the transformation, so the builder always emits them: `"true"` or `"false"` when the caller set them, and
  an empty value when the caller left them out.
- **What an empty value means.** The server maps a value that is neither true nor false to "keep" (`move_corresponding_no_initial`
  with a `-` remainder). The tests confirm this.
- **Conditional attributes.** `updateDebugging` and `showDataAging` are emitted only when set.
- **`showDataAging` does not merge.** The server keeps it apart from the session settings and takes it from each request.
  Leaving it out turns it off, and the answer reports it off. It only steers how the variables node presents data aging.
  `IDebuggerSettings` documents this exception.
- **Headers.** `Content-Type: application/xml` and `Accept: application/xml`. The integration test confirms the server takes them.
- **The first call after an attach** ignores `systemDebugging=false`. That is documented and tested.

Why this is a major. List all of these in the migration note:

- **`IDebuggerIdentity` needs `debuggingMode`.** It is required, with no default, so every caller states the mode, and
  `requestUser` exists only in `user` mode.
- **`attach` takes the identity** instead of `requestUser`.
- **`condition` leaves the non-line kinds.** A caller that sets it on one no longer compiles. That is the point.
- **`IAbapDebugger` gains a type parameter, `TSettings`.**
- **`IAbapDebugger` gains five required members.** Third-party implementations and mocks of the interface must add them.
- **`IAbapDebuggerResults` gains a required `settings` strategy.** A caller passing a complete custom results object must
  add one. The default is the raw document, like the other strategies.
- **`deactivated` is not added at all.** That alone breaks nobody.

Replacing a set is a member of its own, not an option on `setBreakpoints`. The name says it is destructive, and
`setBreakpoints` replaces as well (measured 2026-10-11), which its JSDoc now states. `partial` takes only line breakpoints because that is all the server replaces.
What it does with the other kinds is unclear, so they do not compile.

## adt-clients 28.0.0 (major, after interfaces-adt is published)

- **The identity.** `identityQuery` and the breakpoints body emit `debuggingMode` from the identity, and `requestUser` only
  in `user` mode. `attach` takes the identity. The JSDoc says terminal mode follows the discovery and the server source,
  that its catch is unmeasured, and what to send in an issue if it does not catch: the identity's mode, whether the
  terminal id is SAP GUI's, how the program was started, and the wire log (`DEBUG_HTTP_WIRE`).
- **The four requests in `abap.ts`.** Add the requests with their JSDoc, the evidence above in short.
  - **`buildBreakpointsXml`** gains `skipCount`. It emits `condition` only for a line breakpoint, and also refuses it on
    another kind at run time (a cast can get past the type).
  - **`full`.** The sync body builder emits `<syncScope mode="full"/>`.
  - **`partial`.** It emits `<syncScope mode="partial">` with one `<adtcore:objectReference adtcore:uri>` per object.
  - **Settings.** The settings builder follows the rule above.
  - **The stale comment.** Fix the comment that says any `syncScope` replaces the whole set.
- **The members on `AbapDebugger`.** Add the members, the `settings` result strategy and the default results object.
- **The conflict reader.**
  - **Signature.** `readListenerConflict(error: IAdtError): { conflictText: string; ideUser?: string } | undefined`.
  - **What it reads.** It parses the `<properties><entry key>` of `error.response?.data`.
  - **What it answers.** It answers `undefined` when there is no response, no body, a malformed body, a status other than `409`,
    or no `conflictText`.
  - **Export.** It is exported from the runtime entry point beside `AbapDebugger`. It is a reading, not a field on `IAdtError`.
- **The `terminateDebuggee` comment.** Its comment gains the comparison with `detachDebugger` and `terminateDebugger`.

## Testing

- **Unit:**
  - **Builders.** The sync body (`full`, `partial` with several objects, an empty set), the breakpoint body (`skipCount`, and
    `condition` on a line breakpoint only, plus the run-time refusal), and the settings body (`true`, `false` and left out,
    for mandatory and conditional attributes alike).
  - **Query strings.** `checkListener`, and `detachDebugger` with and without `debuggeeId`. The identity in both modes, for
    listen, stop, check, attach and both breakpoint bodies: `terminal` sends no `requestUser`.
  - **The conflict reader.** On a recorded, sanitised `409`, and its negatives: no response, an empty body, a malformed
    body, `403`, and a `409` without `conflictText`.
  - **Type tests.** A `terminal` identity with `requestUser` fails to compile, whether it is a literal or a pre-typed value.
    So does a `user` identity without it. A `partial` sync with an empty `objects` list fails to compile.
    A literal and a pre-typed variable of an exception breakpoint carrying `condition` both fail to compile.
    `partial` with a statement breakpoint fails to compile.
- **Integration on premise.** These run as our own user, automated, and clean up after themselves. Each one is measured
  during implementation, and its date and platform go into the JSDoc.
  - **`full`.** It removes a breakpoint left out of the set and inserts a new one. An empty set clears everything for the key.
  - **`partial`.** The fixtures are two classes, so two distinct main programs. A sync of class A replaces A's line
    breakpoints and keeps B's line breakpoints and an exception breakpoint. A line breakpoint in B sent within A's scope is
    refused. An empty set clears A's line breakpoints only. An object that maps to no program, alone and mixed with one that maps, is recorded as answered. An empty `objects` list does
    not compile.
  - **`skipCount`.** With `skipCount: 2` on a loop, the stop's loop counter is recorded, and the JSDoc states which hit stops.
  - **`detachDebugger` without id.** The run finishes. Separately: does a session breakpoint (`scope="debugger"`), set
    before the detach, bring the debugger back? Does an external breakpoint catch the same run again through the listener?
    Both are recorded.
  - **`detachDebugger` with the id of a caught, unattached debuggee.** The answer, and whether the run goes on at once rather
    than after the ~30 s hold.
  - **`detachDebugger` with an id whose attach must fail.** The id is that of a debuggee another session has already
    attached. Expected from the source: success all the same, and that debuggee's activation removed. Both are recorded.
  - **`terminateDebugger`.** The run finishes.
  - **`setDebuggerSettings`.** It is called with a field set, then with that field left out, and the answer keeps the value.
    `false` clears. The first call after an attach with `systemDebugging=false` is recorded. `showDataAging`:
    `true`, then left out, then the answer reports it off. A variables read after each call shows the change.
  - **Terminal mode, what can be measured without SAP GUI.** A terminal-mode listener starts, `checkListener` answers, and
    the listener stops. Breakpoints are set and deleted under a terminal identity; the deletion sends `requestUser=` empty. No catch is asserted.
  - **`checkListener`.** It answers `200` empty when free, and `409` with both fields when another of our listeners holds
    the user.
- **Another user.** One integration test with a second user's connection, skipped unless the test config names one.

## Documentation

- **`docs/research/debugger-modes.md`.**
  - **New findings.** Add the server-source findings and the 2026-10-11 measurements, paraphrased with no SAP source pasted:
    another user, a running request, the check's `409`.
  - **Settled rows.** Update the rows the source now settles: User, Terminal ID, This project only, `deactivated`, `skipCount`.
- **`docs/usage/CLIENT_API_REFERENCE.md`.**
  - **The new members.** Describe them.
  - **Another user.** Debugging another user's requests is `requestUser` plus the `S_DEVELOP` DEBUG authorization with
    ACTVT 90 on that user, and SAP's `403` otherwise.
  - **Terminal mode.** Its parameters, and where SAP GUI shows its terminal id. Say that a catch in this mode is not
    measured, and what an issue should carry when it does not catch.
  - **What ADT cannot do.** It cannot attach to a running process or request (SM50 in SAP GUI is the human route).
- **`README.md`.** Its debugger construction guidance and the version pairing text (contract 14 with clients 28).
- **A sweep of `docs/`** for the debugger contract, examples included.
- **The migration note** for 28.0.0. It covers every item under "Why this is a major" above, with examples: an identity
  gaining `debuggingMode: 'user'`, `attach` taking the identity, a custom results object, an implementation or mock of
  `IAbapDebugger`, and `condition` on a non-line breakpoint.
- **`CHANGELOG.md`.**

## Order

1. interfaces-adt 14.0.0: its own PR in the interfaces repo, plus the facade package, published by the user.
2. This PR: adt-clients 28.0.0 against the published contract.
3. mcp-abap-adt: a session that waits for another user's run, and the new members where its tools need them, with its own
   brainstorming and spec. It also carries terminal mode through:
   - **The terminal id is configurable.** Today both ids are random per instance. The host passes a terminal id to the debug
     owner's constructor (from its configuration, for example SAP GUI's terminal id), and a debug session can be started in
     terminal mode with it. When the host passes none, the id stays random per instance, as now.
   - **Why it ships now.** A user whose system is set up for terminal debugging can run it as shipped, and either confirm a
     catch or file an issue with the wire log.

   In this library nothing more is needed: the identity is an argument of every call, so the caller chooses its
   `terminalId` per call.
