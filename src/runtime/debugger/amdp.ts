/**
 * AMDP debugger: one function per request, as measured.
 *
 * Read from Eclipse ADT's Communication Log and repeated on premise (S/4HANA,
 * 2026-10-09) by `scripts/probe-amdp-debugger.ts`. The AMDP debugger shares
 * nothing with the ABAP one — no listener, no attach, nothing on
 * `/sap/bc/adt/debugger`:
 *
 * - **two sessions.** {@link startAmdpDebugger} opens the debug session on a
 *   stateful connection, and {@link getAmdpEvents} must be read on that same
 *   connection. The commands — {@link syncAmdpBreakpoints},
 *   {@link stepAmdpDebuggee}, {@link deleteAmdpDebuggee},
 *   {@link stopAmdpDebugger} — go from another one: the events read holds
 *   its session until there is something to say;
 * - **commands are answered at once, with `Location: {requestId}` only.**
 *   What they did arrives later as an event carrying that request id;
 * - **events:** `SYNC_BREAKPOINTS` (state `PENDING`), `ON_TOGGLE_BREAKPOINTS`
 *   (`VALID`, once the database reaches the method), `ON_BREAK` (the ABAP
 *   source position and the database one, every scalar variable with scope,
 *   type and value, the call stack), `ON_WARNING`, `ON_EXECUTION_END` (an
 *   AMDP method finished), `STOP`. Each entry into an AMDP method is a
 *   debuggee of its own.
 *
 * **A stop does not release a debuggee standing on a breakpoint.** With
 * `hardStop=true` the stop is refused 500 and the debuggee stays suspended;
 * with `false` it stays suspended too. Let it finish — a FULL sync with no
 * breakpoints, then `continue` — or cancel it with
 * {@link deleteAmdpDebuggee}, and stop after.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getTimeout } from '../../utils/timeouts';
import type {
  IAmdpBreakpoint,
  IAmdpStepMethod,
  IStartAmdpDebuggerOptions,
} from './contracts';

const MAIN = '/sap/bc/adt/amdp/debugger/main';
const NAMESPACE = 'xmlns:amdpdbg="http://www.sap.com/adt/amdp/debugger"';

/** The server holds an events read this long when nothing happens. */
export const AMDP_EVENTS_HOLD_MS = 200_000;

/** Every version of the events document Eclipse accepts, newest first. */
export const AMDP_EVENTS_ACCEPT = [4, 3, 2, 1]
  .map((v) => `application/vnd.sap.adt.amdp.dbg.main.v${v}+xml`)
  .join(', ');

export const AMDP_BREAKPOINTS_CONTENT_TYPE =
  'application/vnd.sap.adt.amdp.dbg.bpsync.v1+xml';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Start a debug session for a user's AMDP calls.
 *
 * Answered 200 with `Location: …/main/{mainId}` and `startParameters` naming
 * the database session (`HANA_SESSION_ID`). The connection must be stateful,
 * and the events are read on it.
 */
export async function startAmdpDebugger(
  connection: IAbapConnection,
  requestUser: string,
  options: IStartAmdpDebuggerOptions = {},
): Promise<IAdtWireResponse> {
  const query = new URLSearchParams({
    stopExisting: String(options.stopExisting ?? false),
    requestUser,
    cascadeMode: options.cascadeMode ?? 'NONE',
  });
  return connection.makeAdtRequest({
    url: `${MAIN}?${query}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: 'application/vnd.sap.adt.amdp.dbg.startmain.v1+xml' },
  });
}

/** The body of a breakpoint sync. A FULL sync with none clears them. */
export function buildAmdpBreakpointsXml(
  breakpoints: readonly IAmdpBreakpoint[],
  syncMode: 'FULL' = 'FULL',
): string {
  const rows = breakpoints
    .map(
      (bp) =>
        `    <amdpdbg:breakpoint xmlns:adtcore="http://www.sap.com/adt/core" amdpdbg:clientId="${escapeXml(bp.clientId)}" adtcore:uri="${escapeXml(bp.uri)}"/>`,
    )
    .join('\n');
  return (
    `<?xml version="1.0" encoding="UTF-8"?><amdpdbg:breakpointsSyncRequest ${NAMESPACE} amdpdbg:syncMode="${syncMode}" amdpdbg:clearCache="false">\n` +
    (rows
      ? `  <amdpdbg:breakpoints>\n${rows}\n  </amdpdbg:breakpoints>\n`
      : '  <amdpdbg:breakpoints/>\n') +
    '</amdpdbg:breakpointsSyncRequest>'
  );
}

/**
 * Replace the session's breakpoints with these. A breakpoint is the AMDP
 * class's source URI with `#start=<line>` of a SQLScript statement, and an id
 * of the caller's choosing. The answer is the request id; the outcome comes
 * as a `SYNC_BREAKPOINTS` event, then `ON_TOGGLE_BREAKPOINTS` per breakpoint.
 */
export async function syncAmdpBreakpoints(
  connection: IAbapConnection,
  mainId: string,
  breakpoints: readonly IAmdpBreakpoint[],
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${MAIN}/${encodeURIComponent(mainId)}/breakpoints`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: buildAmdpBreakpointsXml(breakpoints),
    headers: { 'Content-Type': AMDP_BREAKPOINTS_CONTENT_TYPE },
  });
}

/**
 * The next events of the session: held until there is one, or answered with
 * none after {@link AMDP_EVENTS_HOLD_MS}. Read on the connection that started
 * the session. The client waits a minute longer than the server holds.
 */
export async function getAmdpEvents(
  connection: IAbapConnection,
  mainId: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${MAIN}/${encodeURIComponent(mainId)}`,
    method: 'GET',
    timeout: getTimeout(AMDP_EVENTS_HOLD_MS + 60_000),
    headers: { Accept: AMDP_EVENTS_ACCEPT },
  });
}

/** Move a debuggee: over a statement, or on to the next breakpoint or its end. */
export async function stepAmdpDebuggee(
  connection: IAbapConnection,
  mainId: string,
  debuggeeId: string,
  step: IAmdpStepMethod,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${MAIN}/${encodeURIComponent(mainId)}/debuggees/${encodeURIComponent(debuggeeId)}?step=${step}`,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}

/**
 * Cancel a debuggee where it stands — the `deleteDebuggee` link of its
 * `ON_BREAK`. The execution is cancelled (`ON_WARNING` "execution has been
 * canceled", then `ON_EXECUTION_END`), and the ABAP program that called the
 * method fails.
 */
export async function deleteAmdpDebuggee(
  connection: IAbapConnection,
  mainId: string,
  debuggeeId: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${MAIN}/${encodeURIComponent(mainId)}/debuggees/${encodeURIComponent(debuggeeId)}`,
    method: 'DELETE',
    timeout: getTimeout('default'),
  });
}

/**
 * End the debug session. `hardStop` defaults to `false`, as Eclipse sends it;
 * neither value releases a debuggee standing on a breakpoint (see the module
 * comment).
 */
export async function stopAmdpDebugger(
  connection: IAbapConnection,
  mainId: string,
  hardStop = false,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${MAIN}/${encodeURIComponent(mainId)}?hardStop=${hardStop}`,
    method: 'DELETE',
    timeout: getTimeout('default'),
  });
}
