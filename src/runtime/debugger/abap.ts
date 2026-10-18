/**
 * ABAP debugger (standard): one function per request, as measured.
 *
 * The sequence a debug session takes — breakpoints, listener, a run on another
 * session, attach, stack and variables, steps, then breakpoints deleted, the
 * debuggee terminated and the listener deleted — was walked end to end on
 * premise (2026-10-09) over HTTP and RFC by `scripts/probe-debugger-cycle.ts`.
 * Each function below is one request of that walk; the order is the caller's.
 *
 * **Every debugger request needs a stateful session — two of them.** The
 * listener holds one; the attach opens the debug session on another, and
 * every request after it addresses the debuggee through that one (see
 * {@link attach}). Opening them and setting them stateful is the caller's, as
 * the rest of the sequence is.
 *
 * **Nothing else may go out on that session while {@link listen} is open.** The
 * listener is a long poll on the same ABAP session, and a second request on it
 * waits behind the poll.
 *
 * What this module does not have, and why:
 * - the `/debugger/variables/{name}/{part}` family — it short-dumps and ends
 *   the debug session (abapsmith, `endpoints.ts`); variables are read through
 *   {@link getChildVariables} and {@link getVariables} instead;
 * - a listing of armed breakpoints — `GET /debugger/breakpoints` answers 200
 *   with an empty body whatever is armed, so there is nothing to read.
 */

import type {
  IAdtError,
  IAdtHeaders,
  IDebuggerBreakpoint,
  IDebuggerBreakpointSync,
  IDebuggerIdentity,
  IDebuggerSettings,
  IDebuggerStepMethod,
  IDebuggerStepToLineMethod,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser } from 'fast-xml-parser';
import { buildBatchPayload, createBatchBoundary } from '../../batch/wire';
import { DEBUGGER } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

const ADT_NAMESPACES =
  'xmlns:dbg="http://www.sap.com/adt/debugger" xmlns:adtcore="http://www.sap.com/adt/core"';
const ASX_NAMESPACE = 'xmlns:asx="http://www.sap.com/abapxml"';

/** The content type both variable readings are sent and answered in. */
export const DEBUGGER_VARIABLES_CONTENT_TYPE =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.Variables';
/** Without the `dataname` suffix the server answers 406. */
export const DEBUGGER_CHILD_VARIABLES_CONTENT_TYPE =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.ChildVariables';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function query(params: Record<string, string | number | boolean>): string {
  return new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();
}

/**
 * The parameters SAP keys a listener and its breakpoints on, by mode. `terminal` mode sends no `requestUser` — the
 * server reads none there — except on a breakpoint DELETE, which requires the parameter in every mode: left out it
 * answers 400 `ExceptionParameterNotFound`, empty it answers 200 (on premise, 2026-10-11).
 */
function identityQuery(
  identity: IDebuggerIdentity,
  purpose?: 'delete',
): Record<string, string> {
  if (identity.debuggingMode === 'user') {
    return {
      debuggingMode: 'user',
      requestUser: identity.requestUser,
      terminalId: identity.terminalId,
      ideId: identity.ideId,
    };
  }
  return {
    debuggingMode: 'terminal',
    ...(purpose === 'delete' ? { requestUser: '' } : {}),
    terminalId: identity.terminalId,
    ideId: identity.ideId,
  };
}

/** The identity's attributes on a breakpoints body, by mode. */
function identityAttributes(identity: IDebuggerIdentity): string {
  const user =
    identity.debuggingMode === 'user'
      ? ` requestUser="${escapeXml(identity.requestUser)}"`
      : '';
  return `debuggingMode="${identity.debuggingMode}" scope="external"${user} terminalId="${escapeXml(identity.terminalId)}" ideId="${escapeXml(identity.ideId)}"`;
}

// --- breakpoints ---------------------------------------------------------------

/** What names the place a breakpoint of each kind stops at. */
function breakpointTarget(bp: IDebuggerBreakpoint): string {
  switch (bp.kind) {
    case 'line':
      return `adtcore:uri="${escapeXml(bp.uri)}"`;
    case 'exception':
      return `exceptionClass="${escapeXml(bp.exceptionClass)}"`;
    case 'statement':
      return `statement="${escapeXml(bp.statement)}"`;
    case 'message':
      return `msgId="${escapeXml(bp.msgId)}" msgNo="${escapeXml(bp.msgNo)}" msgTy="${escapeXml(bp.msgTy)}"`;
  }
}

/** One `<breakpoint>` row; `only` is the validation attribute, or empty. */
function breakpointRow(bp: IDebuggerBreakpoint, only: string): string {
  const condition = (bp as { condition?: string }).condition;
  if (condition !== undefined && bp.kind !== 'line') {
    // The type forbids it; a cast can still get here. The server ignores a
    // condition on other kinds, so sending it would arm a breakpoint that stops
    // unconditionally - refuse instead.
    throw new Error(
      `condition is accepted on a line breakpoint only, not on kind "${bp.kind}"`,
    );
  }
  const cond = condition ? ` condition="${escapeXml(condition)}"` : '';
  // The caller's tag, on any kind. The server echoes it on every row of the
  // answer, placed and refused, and does not keep the request's order (refused
  // rows first) - measured on premise (2026-10-11), BASIS 816 - so it is what
  // pairs an answer row with the request row that made it.
  const tag =
    bp.clientId !== undefined ? ` clientId="${escapeXml(bp.clientId)}"` : '';
  return `  <breakpoint kind="${bp.kind}" ${breakpointTarget(bp)}${cond}${tag}${only}/>`;
}

/**
 * The body of `POST /debugger/breakpoints`, without a `syncScope`. Without one
 * the request still replaces what the key holds - see {@link setBreakpoints}.
 */
export function buildBreakpointsXml(
  identity: IDebuggerIdentity,
  breakpoints: readonly IDebuggerBreakpoint[],
  validationOnly = false,
): string {
  const only = validationOnly ? ' validationOnly="true"' : '';
  const rows = breakpoints.map((bp) => breakpointRow(bp, only)).join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<dbg:breakpoints ${ADT_NAMESPACES} ${identityAttributes(identity)}>\n` +
    `${rows}\n</dbg:breakpoints>`
  );
}

/** The body of a replacing `POST /debugger/breakpoints`: a `syncScope` and the set. */
export function buildSyncBreakpointsXml(
  identity: IDebuggerIdentity,
  sync: IDebuggerBreakpointSync,
): string {
  const scope =
    sync.scope === 'full'
      ? '<syncScope mode="full"/>'
      : `<syncScope mode="partial">${sync.objects.map((uri) => `<adtcore:objectReference adtcore:uri="${escapeXml(uri)}"/>`).join('')}</syncScope>`;
  const rows = sync.breakpoints.map((bp) => breakpointRow(bp, '')).join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<dbg:breakpoints ${ADT_NAMESPACES} ${identityAttributes(identity)}>\n  ${scope}\n${rows ? `${rows}\n` : ''}</dbg:breakpoints>`
  );
}

/**
 * Arm breakpoints, or with `validationOnly` only ask the server whether it
 * would.
 *
 * **It replaces, it does not add.** The request first deletes every external
 * breakpoint under the identity's key, then arms the ones it carries - and a
 * `validationOnly` request, which arms nothing, deletes them all the same.
 * Measured on premise (2026-10-11), BASIS 816: with B's line breakpoint armed,
 * a second request carrying only A's, or a validation of an exception
 * breakpoint, left a run of B uncaught. Server source, BASIS 816, read
 * 2026-10-11: without a sync scope the request reaches
 * `set_multiple_extd_breakpoints` with no scopes, which deletes all of the
 * key's breakpoints first. To arm several, send them in one request; to keep
 * some, send them again, or replace by object with {@link syncBreakpoints}.
 *
 * A breakpoint the server refuses comes back in the 200 answer with an
 * `errorMessage` and no id. A line breakpoint comes back renumbered into the
 * include it falls in (`#start=16` in a class became `LINE_NR=5` of the method
 * include), so its id cannot be predicted.
 *
 * **`clientId`** on a breakpoint of any kind is the caller's tag, sent as the
 * row's `clientId`. The server echoes it on every row of the answer - placed
 * and refused - and does not keep the request's order: on premise (2026-10-11),
 * BASIS 816, the refused rows came first. A line breakpoint is also renumbered,
 * so neither the position nor the id pairs an answer row with its request row;
 * the tag does.
 */
export async function setBreakpoints(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  identity: IDebuggerIdentity,
  breakpoints: readonly IDebuggerBreakpoint[],
  validationOnly = false,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/breakpoints`,
    method: 'POST',
    timeout: 0,
    data: buildBreakpointsXml(identity, breakpoints, validationOnly),
    headers: requestHeaders(headers),
  });
}

/**
 * Replace the breakpoints the server holds under the identity's key.
 *
 * {@link setBreakpoints} replaces as well; what this adds is an explicit name
 * for it, `full` with `[]` to clear the key, and `partial` to replace one
 * object's line breakpoints and keep the rest.
 *
 * **`clientId`** on a breakpoint of any kind is the caller's tag, sent as the
 * row's `clientId`. The server echoes it on every row of the answer - placed
 * and refused - and does not keep the request's order: on premise (2026-10-11),
 * BASIS 816, the refused rows came first. A line breakpoint is also renumbered,
 * so neither the position nor the id pairs an answer row with its request row;
 * the tag does.
 *
 * Measured on premise (2026-10-11), BASIS 816, with two classes (two main
 * programs) and a caught exception:
 * - `full` with one line breakpoint answers that one with its id, and a run of
 *   a program whose breakpoint was left out is not caught; `full` with `[]`
 *   answers an empty `<dbg:breakpoints/>` and nothing is caught;
 * - `partial` with class A replaces A's line breakpoints and keeps B's line
 *   breakpoint and the exception breakpoint: a run of B stops at the exception,
 *   then at B's line; `partial` A with `[]` clears A's only;
 * - a line breakpoint in B sent within A's scope comes back as a row with no
 *   id, `errorKind="error"` and the server's one text for "outside the scope",
 *   which names the wrong kinds: "Message, statement, and exception breakpoints
 *   cannot be restricted to a program/include." (logon language EN);
 * - `partial` naming only an object that maps to no program answered the body's
 *   line breakpoint as that same refused row; named beside class A, it was
 *   passed over and A's breakpoint was armed.
 *
 * Server source, BASIS 816, read 2026-10-11:
 * - the key is the IDE user plus, in user mode, `requestUser`, or in terminal
 *   mode, `terminalId`; a `terminalId` equal to `ideId` keys on the IDE id
 *   alone; at most 30 breakpoints per key;
 * - `full` replaces everything under the key, and an empty set clears it;
 * - `partial` works by main program, refuses line breakpoints outside its
 *   scope, and an object it cannot map leaves the body's line breakpoints
 *   unset;
 * - the set belongs to the key, so it reaches every IDE that shares the key.
 */
export async function syncBreakpoints(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  identity: IDebuggerIdentity,
  sync: IDebuggerBreakpointSync,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/breakpoints`,
    method: 'POST',
    timeout: 0,
    data: buildSyncBreakpointsXml(identity, sync),
    headers: requestHeaders(headers),
  });
}

/** Remove one breakpoint by the id {@link setBreakpoints} answered. */
export async function deleteBreakpoint(
  connection: IAbapConnection,
  identity: IDebuggerIdentity,
  breakpointId: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/breakpoints/${encodeURIComponent(breakpointId)}?${query({ scope: 'external', ...identityQuery(identity, 'delete') })}`,
    method: 'DELETE',
    timeout: 0,
  });
}

// --- listener ------------------------------------------------------------------

/**
 * What a listener does when another one already holds the user's debugging:
 * `refuse` is answered 409 and leaves the other alone; `takeOver` displaces
 * it, and its holder only gets a notice. A setting of this implementation,
 * not of the contract: another implementation may decide it differently.
 */
export type IDebuggerListenerConflict = 'refuse' | 'takeOver';

/**
 * Wait for a debuggee: the long poll.
 *
 * The server holds it for `holdSeconds` and answers 200 with an empty body
 * when nothing stopped, or 200 with a `DebuggeesList` naming the debuggee
 * (`DEBUGGEE_ID`, `DBGEE_KIND`, where it stands). The client waits a minute
 * longer than the server holds.
 *
 * One IDE per SAP user holds the user's debugging, and `onConflict` says
 * what to do when another one — an Eclipse, another agent — already listens.
 * The server tells IDEs apart by `ideId`: two listeners with the same IDE id
 * and different terminal ids do not conflict. Measured on premise
 * (2026-10-09), against Eclipse and against a second listener of our own with
 * an IDE id of its own:
 *
 * - `refuse` sends `checkConflict=true&isNotifiedOnConflict=true`, as Eclipse
 *   does: the answer is 409 `conflictDetected` (T100 `SY 530`, "Another
 *   session … exists with global debugging scope") and the other listener is
 *   left alone — whatever parameters that one registered with;
 * - `takeOver` sends neither: the server accepts this listener, and the
 *   other one's long poll returns at once with 409 `conflictNotification` —
 *   the notice Eclipse shows before it stops listening.
 *
 * The identity's mode decides the parameters: `terminal` mode sends no `requestUser`.
 *
 * **One debug session per identity.** The listener context belongs to the ABAP
 * session of the connection, so a listener, a check and an attach for another
 * identity - another request user, another mode, another IDE id - are made on
 * a connection of their own (an `AbapDebugger` constructed on it), not on this
 * one. The library adds no guard.
 *
 * **One ABAP session listens for one user.** In user mode the server binds
 * the listener context - request user and IDE id - to the ABAP session on the
 * first request that needs it (listen, check, stop or attach), and every
 * later listen, check or attach on that session, and the wake-up of a stop,
 * use it whatever identity they name (server source, BASIS 816, read
 * 2026-10-11: `CL_TPDAPI_SERVICE` caches the instance once per session).
 * Measured on premise (2026-10-11), BASIS 816: on a session that had listened
 * for one user, a take-over listener for another user answered 200 empty after
 * its hold and that user's run went through uncaught; on a new session it was
 * caught. A listener for another identity needs a session of its own.
 *
 * There is no default. Which of the two is right depends on whose debugger is
 * displaced, and only the caller knows that.
 */
export async function listen(
  connection: IAbapConnection,
  identity: IDebuggerIdentity,
  onConflict: IDebuggerListenerConflict,
  holdSeconds = 60,
): Promise<IAdtWireResponse> {
  const conflict: Record<string, boolean> =
    onConflict === 'refuse'
      ? { checkConflict: true, isNotifiedOnConflict: true }
      : {};
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/listeners?${query({ ...identityQuery(identity), timeout: holdSeconds, ...conflict })}`,
    method: 'POST',
    timeout: (holdSeconds + 60) * 1000,
    headers: { Accept: 'application/vnd.sap.as+xml' },
  });
}

/**
 * Ask whether a listener for the identity would conflict. Starts nothing: 200
 * with an empty body is "free"; a conflict is 409 `conflictDetected`; a missing
 * authorization (`user` mode) is 403, checked first. It reads in the ABAP
 * session of the connection: one debug session per identity (see {@link listen}).
 *
 * Measured on premise (2026-10-11), BASIS 816: free answered 200 with an empty
 * body, in user and in terminal mode; with a listener of the same user under
 * another IDE id running, 409 `conflictDetected`, whose `conflictText` and
 * `ideUser` {@link readListenerConflict} reads.
 */
export async function checkListener(
  connection: IAbapConnection,
  identity: IDebuggerIdentity,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/listeners?${query({ ...identityQuery(identity), checkConflict: true })}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

const conflictParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
});

/**
 * Who holds the user's debugging, read from a 409 answer of a listener request
 * (measured on premise, 2026-10-11); `undefined` for anything else.
 */
export function readListenerConflict(
  error: IAdtError,
): { conflictText: string; ideUser?: string } | undefined {
  const response = error.response;
  if (
    !response ||
    response.status !== 409 ||
    typeof response.data !== 'string' ||
    !response.data
  ) {
    return undefined;
  }
  let entries: unknown;
  try {
    entries = conflictParser.parse(response.data)?.exception?.properties?.entry;
  } catch {
    return undefined;
  }
  const list = (
    Array.isArray(entries) ? entries : entries ? [entries] : []
  ) as Array<{ key?: string; '#text'?: string }>;
  const value = (key: string) => list.find((e) => e.key === key)?.['#text'];
  const conflictText = value('conflictText');
  if (!conflictText) return undefined;
  const ideUser = value('ideUser');
  return ideUser ? { conflictText, ideUser } : { conflictText };
}

/**
 * Release the listener.
 *
 * **It also deletes the key's breakpoints.** In user mode the server deletes
 * every external breakpoint of the IDE user for the request user this call
 * names, and the debugging activation with them - whether or not a listener
 * was running. Only the wake-up of a running listener goes through the
 * session's cached listener context (see {@link listen}); the deletion uses
 * the identity named here. Measured on premise (2026-10-11), BASIS 816: with a
 * line breakpoint armed and no listener running, a stop answered 200 and the
 * next run went uncaught. Server source, BASIS 816, read 2026-10-11:
 * `stop_listener_for_user` deletes from `abdbg_extdbps` for the IDE user and
 * the named request user. Stop the listener last, or arm again before the next
 * listen.
 */
export async function stopListener(
  connection: IAbapConnection,
  identity: IDebuggerIdentity,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/listeners?${query(identityQuery(identity))}`,
    method: 'DELETE',
    timeout: 0,
  });
}

// --- the debuggee ----------------------------------------------------------------

/**
 * Attach to the debuggee {@link listen} caught.
 *
 * The answer carries `debugSessionId`, `debuggeeSessionId`, the breakpoints
 * reached and `isSteppingPossible`. From here on the debuggee belongs to the
 * session that attached.
 *
 * **Attach on a new connection, never on the listener's.** The listener and
 * the debug session are two sessions: the attach, and everything after it,
 * goes on a connection opened for this debuggee. Measured (2026-10-09):
 *
 * - on the cloud, with several application servers, the listener's answer
 *   says whether the debuggee runs on the listener's server
 *   (`IS_SAME_SERVER`). An attach on the listener's connection was refused
 *   500 `invalidDebuggee` whenever it did not (3 of 3); on a new connection
 *   it succeeded across servers (4 of 4);
 * - on premise, a connection that has attached once cannot attach again:
 *   500 `AdiFailed` "Debuggee already attached", even after the first
 *   debuggee ran to its end.
 *
 * The breakpoints are the user's and stay armed across sessions.
 *
 * **`server` routes the attach to the debuggee's application server.** The
 * listener's answer names it in `INSTANCE_NAME`; sent as the `saplb` header,
 * it makes the load balancer hand this request — and the session it opens —
 * to that server. This is what Eclipse ADT does (its Communication Log,
 * 2026-10-09, cloud: the attach carried `saplb`, and the answer set
 * `sap-contextid=…:<server>:…`). Without it, the new session lands on
 * whichever server the balancer picks.
 */
export async function attach(
  connection: IAbapConnection,
  identity: IDebuggerIdentity,
  debuggeeId: string,
  dynproDebugging = true,
  server?: string,
): Promise<IAdtWireResponse> {
  // The server attaches by debuggeeId; it reads debuggingMode, and requestUser only in user mode.
  const who: Record<string, string> =
    identity.debuggingMode === 'user'
      ? { debuggingMode: 'user', requestUser: identity.requestUser }
      : { debuggingMode: 'terminal' };
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?${query({ method: 'attach', debuggeeId, ...who, dynproDebugging })}`,
    method: 'POST',
    timeout: 0,
    headers: {
      Accept: 'application/xml',
      // The load balancer's routing header: the attach — and the debug
      // session it opens — goes to the application server named here.
      ...(server ? { saplb: server } : {}),
    },
  });
}

/** The call stack at the current stop, top frame first in the answer's numbering. */
export async function getStack(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/stack?${query({ emode: '_', semanticURIs: true })}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

/** The body of `getChildVariables`: one row per parent to expand. */
export function buildChildVariablesXml(parentIds: readonly string[]): string {
  const rows = parentIds
    .map(
      (id) =>
        `    <STPDA_ADT_VARIABLE_HIERARCHY><PARENT_ID>${escapeXml(id)}</PARENT_ID></STPDA_ADT_VARIABLE_HIERARCHY>`,
    )
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<asx:abap ${ASX_NAMESPACE} version="1.0"><asx:values><DATA><HIERARCHIES>\n` +
    `${rows}\n</HIERARCHIES></DATA></asx:values></asx:abap>`
  );
}

/**
 * Expand variable parents. `@ROOT` answers the scope ids only (`ME`,
 * `@PARAMETERS`, `@LOCALS`, `@SYSTEM`…); expanding those answers the
 * variables in them.
 */
export async function getChildVariables(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  parentIds: readonly string[],
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?method=getChildVariables`,
    method: 'POST',
    timeout: 0,
    data: buildChildVariablesXml(parentIds),
    headers: requestHeaders(headers),
  });
}

/** The body of `getVariables`: one row per variable id. */
export function buildVariablesXml(variableIds: readonly string[]): string {
  const rows = variableIds
    .map(
      (id) =>
        `  <STPDA_ADT_VARIABLE><ID>${escapeXml(id)}</ID></STPDA_ADT_VARIABLE>`,
    )
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<asx:abap ${ASX_NAMESPACE} version="1.0"><asx:values><DATA>\n` +
    `${rows}\n</DATA></asx:values></asx:abap>`
  );
}

/** Read variables by id — a path such as `LT_ITEMS[3]-MATNR` included. */
export async function getVariables(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  variableIds: readonly string[],
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?method=getVariables`,
    method: 'POST',
    timeout: 0,
    data: buildVariablesXml(variableIds),
    headers: requestHeaders(headers),
  });
}

/**
 * Move the debuggee: into, over, out of a call, or on to the next stop.
 *
 * When the program runs to its end the answer is 500 `AdiFailed` with the
 * subtype `debuggeeEnded` — the measured end of a debug session, not a fault.
 */
export async function step(
  connection: IAbapConnection,
  method: IDebuggerStepMethod,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?${query({ method })}`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

/**
 * Run to, or jump to, the line `uri` names (`<source uri>#start=<line>`).
 *
 * The line is an argument: without it SAP answers 400 "Parameter uri could not
 * be found" — and on SAP_BASIS 758 let the program run to its end in the same
 * moment, losing the stop (816 and the cloud kept the debuggee, 2026-10-10).
 * A jump moves the debuggee without running what lies between: measured on
 * 816 and on the cloud, a fill loop skipped.
 */
export async function stepToLine(
  connection: IAbapConnection,
  method: IDebuggerStepToLineMethod,
  uri: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?${query({ method, uri })}`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

/** Move the read cursor to a stack frame; what runs next does not change. */
export async function setStackPosition(
  connection: IAbapConnection,
  position: number,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?${query({ method: 'setStackPosition', position })}`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

/**
 * Write one variable at the current stop. The body is the raw value; the
 * server converts what does not fit the type rather than refusing it.
 */
export async function setVariableValue(
  connection: IAbapConnection,
  variableName: string,
  value: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?${query({ method: 'setVariableValue', variableName })}`,
    method: 'POST',
    timeout: 0,
    data: value,
    headers: { Accept: 'application/xml' },
  });
}

/**
 * End the debuggee where it stands.
 *
 * Success is answered 500 `AdiFailed` with the subtype `terminateDebuggee`
 * (measured on premise, 2026-10-09: the debuggee was gone, a stack read after
 * it failed, and the program's run returned). A caller reading that as a
 * failure passes an `analyse` that lets the subtype through.
 *
 * Three ways to let go, which differ in what happens to the program:
 * - `terminateDebuggee` ends the debuggee: the program does not finish;
 * - `detachDebugger` leaves the debuggee: the debugger goes, the program runs on;
 * - `terminateDebugger` frees the debugger: the program runs on.
 */
export async function terminateDebuggee(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?method=terminateDebuggee`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

/**
 * Leave the debuggee; the program runs on.
 *
 * Without an id it addresses the debuggee attached on this session: the
 * debugger leaves and the program runs on. With an id the server tries to
 * attach that caught debuggee, and if that fails it deletes its activation and
 * still answers success, so success does not prove attach and release. In
 * particular a success with the id of a debuggee attached on another session
 * does not release that attachment (measured: that session could still step).
 * Server source, BASIS 816, read 2026-10-11.
 *
 * Measured on premise (2026-10-11), BASIS 816:
 * - without an id, on the attached session: 200 with an empty body, and the
 *   program ran on - into the next pass over the same external line
 *   breakpoint, where a listener standing at the time caught the same run again;
 * - with the id of a caught debuggee nobody attached, from another session:
 *   200 with an empty body, and the run returned about 1 s later - at once, not
 *   after the hold a caught, unattached debuggee otherwise waits out;
 * - with the id of a debuggee another session had attached: 200 with an empty
 *   body all the same, and the attaching session still stepped it.
 *
 * Whether a session breakpoint (`scope="debugger"`) brings the debugger back
 * was not measured: this module sends external breakpoints only.
 */
export async function detachDebugger(
  connection: IAbapConnection,
  debuggeeId?: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?${query({
      method: 'detachDebugger',
      ...(debuggeeId ? { debuggeeId } : {}),
    })}`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

/**
 * Free the debugger; the program runs on.
 *
 * **The debugger's session ends with it.** The server stops the debugger and
 * frees the ABAP session the request runs in (`SYSTEM-CALL FREE MODE 0`; server
 * source, BASIS 816, read 2026-10-11). Measured on premise (2026-10-11), BASIS
 * 816: the answer is a plain
 * ICF `500 Internal Server Error` (`text/plain`, no ADT exception document,
 * so no subtype), the program ran on and returned its output, and the next
 * request on that session was answered `400` "Session Timed Out or Not Found".
 * A `500` here is therefore the expected end, not proof of failure; open a new
 * session for the next attach.
 *
 * Pass `analyseDebuggerFreed` from `@mcp-abap-adt/adt-strategies` (0.9.0) to
 * take that `500` as no failure; `analyseException` lets it stop you. See
 * `docs/usage/ERRATA.md`, "The debugger freeing its session is answered as an
 * ICF 500".
 */
export async function terminateDebugger(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?${query({ method: 'terminateDebugger' })}`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

// --- memory ----------------------------------------------------------------------

export const DEBUGGER_MEMORY_SIZES_ACCEPT =
  'application/vnd.sap.adt.debugger.memory.sizes.v1+xml';

/**
 * The debuggee's memory at the current stop — what Eclipse's "ABAP Memory
 * (Debugger)" view shows. Answered 406 to `application/xml`. Measured on
 * premise and on the cloud (2026-10-09): filling 100 000 strings between two
 * stops moved the dynamic memory objects from 233 KB to 23 MB.
 */
export async function getMemorySizes(
  connection: IAbapConnection,
  includeAbap = true,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/memorysizes?${query({ includeAbap })}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: DEBUGGER_MEMORY_SIZES_ACCEPT },
  });
}

/**
 * Write a memory snapshot of the debuggee at the current stop. The answer is
 * a `dbg:action` whose `data` is `<server>,<file>` and whose `isError` says
 * whether it was written — a 200 either way. It names the file, not an id:
 * the list below gives each snapshot its `fileName`, and the snapshot reaches
 * `/runtime/memory/snapshots` — where an id is learnt — only later, and on
 * the cloud after a few minutes (measured 2026-10-09). Writing needs no
 * more than debugging; listing needs `S_MEM_SNAP`, and without it the list
 * answers 200 and empty — on premise the file was written and nothing was
 * listed, from this call or from Eclipse, until a role granted it
 * (2026-10-10).
 */
export async function createMemorySnapshot(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/actions?action=memorySnapshot`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

// --- watchpoints -----------------------------------------------------------------

/** Watch a variable at the current stop; the answer echoes only the new row. */
export async function createWatchpoint(
  connection: IAbapConnection,
  variableName: string,
  condition?: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/watchpoints?${query(condition ? { variableName, condition } : { variableName })}`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

export async function listWatchpoints(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/watchpoints`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: 'application/xml' },
  });
}

export async function deleteWatchpoint(
  connection: IAbapConnection,
  watchpointId: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/watchpoints/${encodeURIComponent(watchpointId)}`,
    method: 'DELETE',
    timeout: 0,
  });
}

// --- batch -----------------------------------------------------------------------

export interface IDebuggerBatchPayload {
  boundary: string;
  body: string;
}

/**
 * `POST /debugger/batch` with a multipart body, built by
 * {@link buildDebuggerBatchPayload}. The content type names the payload's
 * boundary, or the server cannot find the parts. Measured on premise and on
 * the cloud (2026-10-09) as a general router: inner requests outside the
 * debugger are answered too, each part in the multipart answer.
 */
export async function executeBatchRequest(
  connection: IAbapConnection,
  payload: IDebuggerBatchPayload,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/batch`,
    method: 'POST',
    timeout: 0,
    data: payload.body,
    headers: {
      'Content-Type': `multipart/mixed; boundary=${payload.boundary}`,
      Accept: 'multipart/mixed',
    },
  });
}

/**
 * The multipart body of a batch: each request as an `application/http` part,
 * kept as given — an inner request ends with its own empty line
 * (`…\r\n\r\n`), and trimming it breaks the part.
 */
export function buildDebuggerBatchPayload(
  requests: readonly string[],
  boundary = createBatchBoundary(),
): IDebuggerBatchPayload {
  return buildBatchPayload(requests, boundary);
}

const boolOrKeep = (value: boolean | undefined) =>
  value === undefined ? '' : String(value);

/**
 * The settings body (server source, BASIS 816, read 2026-10-11). Four
 * attributes are not conditional in the server's transformation, so they are
 * always sent; empty means "keep" (the server maps a value that is neither
 * true nor false to no change). `updateDebugging` and `showDataAging` are sent
 * only when set; `showDataAging` does not merge - left out, it is off.
 */
export function buildDebuggerSettingsXml(settings: IDebuggerSettings): string {
  const conditional = [
    settings.updateDebugging === undefined
      ? ''
      : ` updateDebugging="${settings.updateDebugging}"`,
    settings.showDataAging === undefined
      ? ''
      : ` showDataAging="${settings.showDataAging}"`,
  ].join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<dbg:settings xmlns:dbg="http://www.sap.com/adt/debugger" systemDebugging="${boolOrKeep(settings.systemDebugging)}" createExceptionObject="${boolOrKeep(settings.createExceptionObject)}" backgroundRFC="${boolOrKeep(settings.backgroundRFC)}" sharedObjectDebugging="${boolOrKeep(settings.sharedObjectDebugging)}"${conditional}/>`
  );
}

/**
 * Set the debugger settings of the session. A setting left out is sent empty
 * and the server keeps it (server source, BASIS 816, read 2026-10-11); the
 * first call after an attach ignores `systemDebugging=false` (server source, BASIS 816, read 2026-10-11).
 *
 * Measured on premise (2026-10-11), BASIS 816, at a stop: the answer is the
 * whole `<dbg:settings>` with all six attributes; `systemDebugging: true`
 * answered `"true"`, `{}` then kept `"true"`, `false` answered `"false"`;
 * `showDataAging: true` answered `"true"` and `{}` then answered `"false"`. A
 * variables read after each call answered as before. The first call after the
 * attach, with `systemDebugging: false`, answered `"false"` - which cannot tell
 * "ignored" from "applied", since the debugger starts with it off.
 */
export async function setDebuggerSettings(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  settings: IDebuggerSettings,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?${query({ method: 'setDebuggerSettings' })}`,
    method: 'POST',
    timeout: 0,
    data: buildDebuggerSettingsXml(settings),
    headers: requestHeaders(headers),
  });
}
