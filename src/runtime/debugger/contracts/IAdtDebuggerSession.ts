/**
 * Debugger session parameters — the contract a consumer calls.
 *
 * Declared here rather than in adt-clients because a consumer must import these
 * to use the debugger session client at all, and the point of this package is
 * that there is one place to import from and one place to override.
 *
 * These parameters back a thin high-level facade for debugger session lifecycle
 * over a WebSocket transport (AdtClientsWS, which stays in adt-clients).
 * Operation names are transport-agnostic contracts for the WS backend:
 * - debugger.listen
 * - debugger.attach
 * - debugger.detach
 * - debugger.step
 * - debugger.getStack
 * - debugger.getVariables
 */

export type DebuggerStepAction =
  | 'step_over'
  | 'step_into'
  | 'step_return'
  | 'continue';

export interface IDebuggerListenParams {
  timeoutSeconds?: number;
  user?: string;
}

export interface IDebuggerAttachParams {
  sessionId: string;
}

export interface IDebuggerStepParams {
  action: DebuggerStepAction;
  value?: string;
}

export interface IDebuggerGetVariablesParams {
  frameId?: string;
  filter?: string;
}
