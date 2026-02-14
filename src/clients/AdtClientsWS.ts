import { randomUUID } from 'node:crypto';
import type {
  ILogger,
  IWebSocketConnectOptions,
  IWebSocketMessageEnvelope,
  IWebSocketMessageHandler,
  IWebSocketTransport,
} from '@mcp-abap-adt/interfaces';
import { DebuggerSessionClient } from './DebuggerSessionClient';

export interface IAdtClientsWSRequestOptions {
  correlationId?: string;
  timeoutMs?: number;
}

export interface IAdtClientsWSOptions {
  requestTimeoutMs?: number;
}

type PendingRequest = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export class AdtClientsWS {
  private readonly logger: ILogger;
  private readonly requestTimeoutMs: number;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly eventHandlers: Array<IWebSocketMessageHandler<unknown>> = [];

  constructor(
    private readonly transport: IWebSocketTransport,
    logger?: ILogger,
    options?: IAdtClientsWSOptions,
  ) {
    this.logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    this.requestTimeoutMs = options?.requestTimeoutMs ?? 30_000;
    this.transport.onMessage((message) => this.handleMessage(message));
  }

  async connect(
    url: string,
    options?: IWebSocketConnectOptions,
  ): Promise<void> {
    await this.transport.connect(url, options);
    this.logger.debug('AdtClientsWS connected', { url });
  }

  async disconnect(code?: number, reason?: string): Promise<void> {
    await this.transport.disconnect(code, reason);
    this.logger.debug('AdtClientsWS disconnected', { code, reason });
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  onEvent(handler: IWebSocketMessageHandler<unknown>): void {
    this.eventHandlers.push(handler);
  }

  getDebuggerSessionClient(): DebuggerSessionClient {
    return new DebuggerSessionClient(this);
  }

  async request<TPayload = unknown, TResponse = unknown>(
    operation: string,
    payload?: TPayload,
    options?: IAdtClientsWSRequestOptions,
  ): Promise<TResponse> {
    const correlationId = options?.correlationId ?? randomUUID();
    const timeoutMs = options?.timeoutMs ?? this.requestTimeoutMs;

    return new Promise<TResponse>((resolve, reject) => {
      const resolveTyped = (value: unknown) => resolve(value as TResponse);
      const timeout = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(
          new Error(
            `AdtClientsWS request timeout for operation "${operation}" after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      this.pending.set(correlationId, {
        resolve: resolveTyped,
        reject,
        timeout,
      });

      const message: IWebSocketMessageEnvelope<TPayload> = {
        kind: 'request',
        operation,
        correlationId,
        payload,
        timestamp: Date.now(),
      };

      this.transport.send(message).catch((error) => {
        clearTimeout(timeout);
        this.pending.delete(correlationId);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  async sendEvent<TPayload = unknown>(
    operation: string,
    payload?: TPayload,
  ): Promise<void> {
    const message: IWebSocketMessageEnvelope<TPayload> = {
      kind: 'event',
      operation,
      payload,
      timestamp: Date.now(),
    };
    await this.transport.send(message);
  }

  private async handleMessage(
    message: IWebSocketMessageEnvelope<unknown>,
  ): Promise<void> {
    const correlationId = message.correlationId;
    if (correlationId && this.pending.has(correlationId)) {
      const request = this.pending.get(correlationId);
      if (!request) {
        return;
      }
      clearTimeout(request.timeout);
      this.pending.delete(correlationId);

      if (message.kind === 'error') {
        const payloadMessage =
          typeof message.payload === 'string'
            ? message.payload
            : JSON.stringify(message.payload || {});
        request.reject(
          new Error(
            `AdtClientsWS request failed for correlationId "${correlationId}": ${payloadMessage}`,
          ),
        );
        return;
      }

      request.resolve(message.payload);
      return;
    }

    for (const handler of this.eventHandlers) {
      await handler(message);
    }
  }
}
