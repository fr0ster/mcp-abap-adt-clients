import { randomUUID } from 'node:crypto';
import type {
  IWebSocketConnectOptions,
  IWebSocketMessageEnvelope,
  IWebSocketMessageHandler,
  IWebSocketTransport,
} from '@mcp-abap-adt/interfaces-network';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';

export interface IAdtClientsWSRequestOptions {
  correlationId?: string;
  timeoutMs?: number;
}

export interface IAdtClientsWSOptions {
  /**
   * A deadline for every request, in milliseconds — the caller's choice.
   * Absent, a request waits for its correlated answer: the library sets no
   * deadline of its own. `IAdtClientsWSRequestOptions.timeoutMs` overrides it
   * per request.
   */
  requestTimeoutMs?: number;
}

type PendingRequest = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout> | undefined;
};

export class AdtClientsWS {
  private readonly logger: ILogger;
  private readonly requestTimeoutMs: number | undefined;
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
    this.requestTimeoutMs = options?.requestTimeoutMs;
    this.transport.onMessage((message) => this.handleMessage(message));
    this.transport.onClose(() => this.rejectPending());
  }

  async connect(
    url: string,
    options?: IWebSocketConnectOptions,
  ): Promise<void> {
    await this.transport.connect(url, options);
    this.logger.debug('AdtClientsWS connected', { url });
  }

  async disconnect(code?: number, reason?: string): Promise<void> {
    try {
      await this.transport.disconnect(code, reason);
    } finally {
      this.rejectPending();
    }
    this.logger.debug('AdtClientsWS disconnected', { code, reason });
  }

  /**
   * A closed connection carries no answer: every request still waiting is
   * rejected at once, since nothing else would ever settle it — there is no
   * deadline unless the caller set one.
   */
  private rejectPending(): void {
    const waiting = [...this.pending.values()];
    this.pending.clear();
    for (const request of waiting) {
      clearTimeout(request.timeout);
      request.reject(
        new Error('AdtClientsWS connection closed before the answer'),
      );
    }
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  onEvent(handler: IWebSocketMessageHandler<unknown>): void {
    this.eventHandlers.push(handler);
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
      // No deadline unless the caller asked for one.
      const timeout =
        timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
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
