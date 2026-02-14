import type { AdtClientsWS } from './AdtClientsWS';

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

/**
 * Thin high-level facade for debugger session lifecycle over AdtClientsWS.
 *
 * Operation names are transport-agnostic contracts for the WS backend:
 * - debugger.listen
 * - debugger.attach
 * - debugger.detach
 * - debugger.step
 * - debugger.getStack
 * - debugger.getVariables
 */
export class DebuggerSessionClient {
  constructor(private readonly wsClient: AdtClientsWS) {}

  async listen<TResponse = unknown>(
    params?: IDebuggerListenParams,
  ): Promise<TResponse> {
    return this.wsClient.request<IDebuggerListenParams, TResponse>(
      'debugger.listen',
      params,
    );
  }

  async attach<TResponse = unknown>(
    params: IDebuggerAttachParams,
  ): Promise<TResponse> {
    return this.wsClient.request<IDebuggerAttachParams, TResponse>(
      'debugger.attach',
      params,
    );
  }

  async detach<TResponse = unknown>(): Promise<TResponse> {
    return this.wsClient.request<undefined, TResponse>('debugger.detach');
  }

  async step<TResponse = unknown>(
    params: IDebuggerStepParams,
  ): Promise<TResponse> {
    return this.wsClient.request<IDebuggerStepParams, TResponse>(
      'debugger.step',
      params,
    );
  }

  async getStack<TResponse = unknown>(): Promise<TResponse> {
    return this.wsClient.request<undefined, TResponse>('debugger.getStack');
  }

  async getVariables<TResponse = unknown>(
    params?: IDebuggerGetVariablesParams,
  ): Promise<TResponse> {
    return this.wsClient.request<IDebuggerGetVariablesParams, TResponse>(
      'debugger.getVariables',
      params,
    );
  }
}
