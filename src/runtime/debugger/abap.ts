/**
 * ABAP debugger (standard): one function per request, as measured.
 *
 * The sequence a debug session takes — breakpoints, listener, a run on another
 * session, attach, stack and variables, steps, then breakpoints deleted, the
 * debuggee terminated and the listener deleted — was walked end to end on
 * premise (2026-10-09) over HTTP and RFC by `scripts/probe-debugger-cycle.ts`.
 * Each function below is one request of that walk; the order is the caller's.
 *
 * **Every debugger request needs a stateful session.** The attach is bound to
 * the session that sent it, and every request after it addresses that
 * debuggee through the same session. Setting the connection stateful is the
 * caller's, as the rest of the sequence is.
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
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getTimeout } from '../../utils/timeouts';
import { createBatchBoundary } from './batchPayload';
import type {
  IDebuggerBreakpoint,
  IDebuggerIdentity,
  IDebuggerStepMethod,
} from './contracts';

const DEBUGGER = '/sap/bc/adt/debugger';
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

/** The four parameters SAP keys a user-mode listener and its breakpoints on. */
function identityQuery(identity: IDebuggerIdentity): Record<string, string> {
  return {
    debuggingMode: 'user',
    requestUser: identity.requestUser,
    terminalId: identity.terminalId,
    ideId: identity.ideId,
  };
}

// --- breakpoints ---------------------------------------------------------------

/**
 * The body of `POST /debugger/breakpoints`.
 *
 * No `syncScope`: with it, the server replaces the user's whole external set,
 * Eclipse's breakpoints included. Without it the request only adds.
 */
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

export function buildBreakpointsXml(
  identity: IDebuggerIdentity,
  breakpoints: readonly IDebuggerBreakpoint[],
  validationOnly = false,
): string {
  const only = validationOnly ? ' validationOnly="true"' : '';
  const rows = breakpoints
    .map((bp) => {
      const condition = bp.condition
        ? ` condition="${escapeXml(bp.condition)}"`
        : '';
      return `  <breakpoint kind="${bp.kind}" ${breakpointTarget(bp)}${condition}${only}/>`;
    })
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<dbg:breakpoints ${ADT_NAMESPACES} debuggingMode="user" scope="external" requestUser="${escapeXml(identity.requestUser)}" terminalId="${identity.terminalId}" ideId="${identity.ideId}">\n` +
    `${rows}\n</dbg:breakpoints>`
  );
}

/**
 * Arm breakpoints, or with `validationOnly` only ask the server whether it
 * would.
 *
 * A breakpoint the server refuses comes back in the 200 answer with an
 * `errorMessage` and no id. A line breakpoint comes back renumbered into the
 * include it falls in (`#start=16` in a class became `LINE_NR=5` of the method
 * include), so its id cannot be predicted.
 */
export async function setBreakpoints(
  connection: IAbapConnection,
  identity: IDebuggerIdentity,
  breakpoints: readonly IDebuggerBreakpoint[],
  validationOnly = false,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/breakpoints`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: buildBreakpointsXml(identity, breakpoints, validationOnly),
    headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' },
  });
}

/** Remove one breakpoint by the id {@link setBreakpoints} answered. */
export async function deleteBreakpoint(
  connection: IAbapConnection,
  identity: IDebuggerIdentity,
  breakpointId: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/breakpoints/${encodeURIComponent(breakpointId)}?${query({ scope: 'external', ...identityQuery(identity) })}`,
    method: 'DELETE',
    timeout: getTimeout('default'),
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
 * One listener per SAP user holds the user's breakpoints, and `onConflict`
 * says what to do when another one — an Eclipse, another agent — already
 * does. Measured on premise (2026-10-09) with Eclipse listening for the same
 * user:
 *
 * - `refuse` sends `checkConflict=true&isNotifiedOnConflict=true`, as Eclipse
 *   does: the answer is 409 `conflictDetected` (T100 `SY 530`, "Another
 *   session … exists with global debugging scope") and the other listener is
 *   left alone;
 * - `takeOver` sends neither: the server accepts this listener and the other
 *   one is gone — its holder only gets a notice (Eclipse shows one and stops
 *   listening).
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
    timeout: getTimeout((holdSeconds + 60) * 1000),
    headers: { Accept: 'application/vnd.sap.as+xml' },
  });
}

/** Release the listener. */
export async function stopListener(
  connection: IAbapConnection,
  identity: IDebuggerIdentity,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/listeners?${query(identityQuery(identity))}`,
    method: 'DELETE',
    timeout: getTimeout('default'),
  });
}

// --- the debuggee ----------------------------------------------------------------

/**
 * Attach to the debuggee {@link listen} caught.
 *
 * The answer carries `debugSessionId`, `debuggeeSessionId`, the breakpoints
 * reached and `isSteppingPossible`. From here on the debuggee belongs to the
 * session that attached.
 */
export async function attach(
  connection: IAbapConnection,
  requestUser: string,
  debuggeeId: string,
  dynproDebugging = true,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?${query({ method: 'attach', debuggeeId, debuggingMode: 'user', requestUser, dynproDebugging })}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: 'application/xml' },
  });
}

/** The call stack at the current stop, top frame first in the answer's numbering. */
export async function getStack(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/stack?${query({ emode: '_', semanticURIs: true })}`,
    method: 'GET',
    timeout: getTimeout('default'),
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
  parentIds: readonly string[],
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?method=getChildVariables`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: buildChildVariablesXml(parentIds),
    headers: {
      'Content-Type': DEBUGGER_CHILD_VARIABLES_CONTENT_TYPE,
      Accept: DEBUGGER_CHILD_VARIABLES_CONTENT_TYPE,
    },
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
  variableIds: readonly string[],
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?method=getVariables`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: buildVariablesXml(variableIds),
    headers: {
      'Content-Type': DEBUGGER_VARIABLES_CONTENT_TYPE,
      Accept: DEBUGGER_VARIABLES_CONTENT_TYPE,
    },
  });
}

/**
 * Move the debuggee: into, over, out of a call, on to the next stop, or to a
 * line (`uri` is the line's source URI with `#start=<line>`).
 *
 * When the program runs to its end the answer is 500 `AdiFailed` with the
 * subtype `debuggeeEnded` — the measured end of a debug session, not a fault.
 */
export async function step(
  connection: IAbapConnection,
  method: IDebuggerStepMethod,
  uri?: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?${query(uri ? { method, uri } : { method })}`,
    method: 'POST',
    timeout: getTimeout('default'),
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
    timeout: getTimeout('default'),
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
    timeout: getTimeout('default'),
    data: value,
    headers: { Accept: 'application/xml' },
  });
}

/** End the debuggee where it stands. */
export async function terminateDebuggee(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}?method=terminateDebuggee`,
    method: 'POST',
    timeout: getTimeout('default'),
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
    timeout: getTimeout('default'),
    headers: { Accept: 'application/xml' },
  });
}

export async function listWatchpoints(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/watchpoints`,
    method: 'GET',
    timeout: getTimeout('default'),
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
    timeout: getTimeout('default'),
  });
}

// --- batch -----------------------------------------------------------------------

export interface IDebuggerBatchPayload {
  boundary: string;
  body: string;
}

/**
 * `POST /debugger/batch` with a multipart body. Measured on premise
 * (2026-10-09) as a general router: inner requests outside the debugger are
 * answered too.
 */
export async function executeBatchRequest(
  connection: IAbapConnection,
  requests: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${DEBUGGER}/batch`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: requests,
    headers: {
      'Content-Type': 'application/xml',
      Accept: 'application/xml',
    },
  });
}

export function buildDebuggerBatchPayload(
  requests: string[],
  boundary = createBatchBoundary(),
): IDebuggerBatchPayload {
  const parts = requests
    .map((request) => {
      if (!request.trim()) {
        throw new Error('Batch request part must not be empty');
      }
      // Do NOT trim — inner requests must preserve trailing \r\n\r\n
      return [
        `--${boundary}`,
        'Content-Type: application/http',
        'content-transfer-encoding: binary',
        '',
        request,
        '',
      ].join('\r\n');
    })
    .join('');

  return {
    boundary,
    body: `${parts}--${boundary}--\r\n`,
  };
}
