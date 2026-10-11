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

- Terminal mode end to end. The protocol is known from the server source, but no catch was measured. Eclipse's own runs
  are not caught under Terminal ID (measured 2026-10-11). Another client reports 0 of 7. A run from SAP GUI for Windows is untested.
  The identity therefore stays user-mode here. The union identity (`user` | `terminal`) comes with the research that proves it.
- "This project only", meaning how an IDE id reaches a request's passport (the kernel reads it; no ABAP code sets it).
- `/debugger/actions` (update debugging, commit/rollback, memory snapshot, step size), `getDebuggeeSessions`,
  `notifyDebuggeeToStop`, job-step debugging routed to ADT, SM50/SM04 from a session without SAP GUI.

## Evidence

**Server source** (on premise, BASIS 816, read 2026-10-11; class and line in the research note):

- **Breakpoint ownership.** Breakpoints belong to the pair IDE user + request user, at most 30 per pair.
- **Without `syncScope`**, a POST only adds.
  - `syncScope mode="full"` replaces every breakpoint of the pair.
  - `syncScope mode="partial"` replaces only the line breakpoints in the main programs its object references map to.
    A line breakpoint outside that scope is refused.
- **`deactivated`** is parsed but has no effect on this release. **`skipCount`** applies to every kind.
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

```ts
interface IBreakpointCommon {
  /** Hits to pass before the breakpoint stops. */
  skipCount?: number;
}
export type IDebuggerLineBreakpoint = IBreakpointCommon & {
  kind: 'line';
  uri: string;
  /** An ABAP condition; only a line breakpoint takes one. */
  condition?: string;
};
export type IDebuggerBreakpoint =
  | IDebuggerLineBreakpoint
  | (IBreakpointCommon & { kind: 'exception'; exceptionClass: string })
  | (IBreakpointCommon & { kind: 'statement'; statement: string })
  | (IBreakpointCommon & { kind: 'message'; msgId: string; msgNo: string; msgTy: string });

/** Replace breakpoints instead of adding them. Both scopes touch every IDE of the same user. */
export type IDebuggerBreakpointSync =
  | { scope: 'full'; breakpoints: readonly IDebuggerBreakpoint[] }
  | { scope: 'partial'; objects: readonly string[]; breakpoints: readonly IDebuggerLineBreakpoint[] };

export interface IDebuggerSettings {
  systemDebugging?: boolean;
  updateDebugging?: boolean;
  createExceptionObject?: boolean;
  backgroundRFC?: boolean;
  sharedObjectDebugging?: boolean;
  showDataAging?: boolean;
}
```

New `IAbapDebugger` members, each with the usual `WithAnalyse` / `WithoutAnalyse` overload pair:

| Member | Request | Answer |
|---|---|---|
| `syncBreakpoints(identity, sync)` | `POST /debugger/breakpoints` with `<syncScope mode>` and, for `partial`, its object references | `TBreakpoints` |
| `checkListener(identity)` | `GET /debugger/listeners?…&checkConflict=true` | `TDone`. A conflict is the `409` failure |
| `detachDebugger(debuggeeId?)` | `POST /debugger?method=detachDebugger` | `TDone` |
| `terminateDebugger()` | `POST /debugger?method=terminateDebugger` | `TDone` |
| `setDebuggerSettings(settings)` | `POST /debugger?method=setDebuggerSettings` with the settings body | new `TSettings` |

Why this is a major:

- `condition` leaves the non-line kinds, so a caller that sets it on one no longer compiles. That is the point.
- `IAbapDebugger` gains a type parameter, `TSettings`.
- `deactivated` is not added at all.

Replacing a set is a member of its own, not an option on `setBreakpoints`. The name says it is destructive, and
`setBreakpoints` keeps its add-only promise. `partial` takes only line breakpoints because that is all the server replaces.
What it does with the other kinds is unclear, so they do not compile.

## adt-clients 28.0.0 (major, after interfaces-adt is published)

- **The four requests in `abap.ts`.** Add the requests with their JSDoc, the evidence above in short. `buildBreakpointsXml` gains
  `skipCount`, and `condition` is emitted only for a line breakpoint, as the types now force.
  - **`syncScope` without a scope.** The body builder for `full` emits `<syncScope mode="full"/>`.
  - **`syncScope` with objects.** For `partial` it emits `<syncScope mode="partial">` with one
    `<adtcore:objectReference adtcore:uri>` per object.
  - **The stale comment.** Fix the comment that says any `syncScope` replaces the whole set.
- **The members on `AbapDebugger`.** Add each member, each with its result strategy.
- **Reading a listener conflict.** Add `readListenerConflict(error)`. It reads `conflictText` and `ideUser` from a `409` answer's
  properties (the `checkListener` answer and the refusing `listen`), and answers `undefined` for anything else. It is a reading,
  not a field on `IAdtError`.
- **The `terminateDebuggee` comment.** Its comment gains the comparison with `detachDebugger` and `terminateDebugger`.

## Testing

- **Unit.** Body builders (`full`, `partial`, `skipCount`, `condition` on a line breakpoint only), query strings,
  `readListenerConflict` on a recorded `409` (sanitised), and type tests.
  - **Type tests.** `condition` on an exception breakpoint does not compile. `partial` with a statement breakpoint does not compile.
- **Integration on premise (own user, automated, everything cleaned up).** Each check is measured during implementation, and its
  date and platform go into the JSDoc.
  - **`syncBreakpoints full`.** It replaces the pair's set.
  - **`partial`.** It replaces only the scoped object's line breakpoints and keeps another object's.
  - **`skipCount`.** `skipCount: 2` — the measurement settles which hit stops (the source does not say).
  - **`detachDebugger`.** The run finishes, and a breakpoint still armed stops it again.
  - **`terminateDebugger`.** The run finishes.
  - **`setDebuggerSettings`.** The answer echoes the merge.
  - **`checkListener`.** It answers `200` empty when free, and `409` with both fields when another listener holds the user.
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
  - **What ADT cannot do.** It cannot attach to a running process or request (SM50 in SAP GUI is the human route).
- **The migration note** for 28.0.0: `condition` on non-line kinds, `TSettings`.
- **`CHANGELOG.md`.**

## Order

1. interfaces-adt 14.0.0: its own PR in the interfaces repo, plus the facade package, published by the user.
2. This PR: adt-clients 28.0.0 against the published contract.
3. mcp-abap-adt: a session that waits for another user's run, and the new members where its tools need them, with its own
   brainstorming and spec.
