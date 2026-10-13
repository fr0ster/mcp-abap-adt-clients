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
      // One waiting request per id: a second one would replace the first in
      // the pending map and leave it unsettled for good, so it is refused
      // before anything is sent; the first stays as it is.
      // An empty id is sent but never matched by an answer, so the request
      // could never settle: refused before anything is sent.
      if (correlationId === '') {
        reject(
          new Error('AdtClientsWS request refused: its correlationId is empty'),
        );
        return;
      }
      if (this.pending.has(correlationId)) {
        reject(
          new Error(
            'AdtClientsWS request refused: its correlationId is already in flight',
          ),
        );
        return;
      }
      // This request's own entry: a cleanup removes it only while the map
      // still holds it, never a later request that reused the id after this
      // one was settled (by a closed connection, say).
      const entry: PendingRequest = {
        resolve: (value: unknown) => resolve(value as TResponse),
        reject,
        timeout: undefined,
      };
      // No deadline unless the caller asked for one.
      if (timeoutMs !== undefined) {
        entry.timeout = setTimeout(() => {
          this.forget(correlationId, entry);
          reject(
            new Error(
              `AdtClientsWS request timeout for operation "${operation}" after ${timeoutMs}ms`,
            ),
          );
        }, timeoutMs);
      }

      this.pending.set(correlationId, entry);

      const message: IWebSocketMessageEnvelope<TPayload> = {
        kind: 'request',
        operation,
        correlationId,
        payload,
        timestamp: Date.now(),
      };

      this.transport.send(message).catch((error) => {
        clearTimeout(entry.timeout);
        this.forget(correlationId, entry);
        reject(sendFailure(error));
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

  /** Remove `entry` under `correlationId` only if the map still holds it. */
  private forget(correlationId: string, entry: PendingRequest): void {
    if (this.pending.get(correlationId) === entry) {
      this.pending.delete(correlationId);
    }
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
      this.forget(correlationId, request);

      if (message.kind === 'error') {
        const payloadMessage = describeErrorPayload(message.payload);
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

/**
 * The error payload as text, never throwing: the request it rejects must
 * settle whatever the payload is. A payload that cannot be serialised gets
 * fixed words, nothing of its own.
 */
function describeErrorPayload(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  try {
    return String(JSON.stringify(payload || {}));
  } catch {
    return 'the error payload could not be serialised';
  }
}

/**
 * What a failed send rejects its request with, never throwing: an `Error` as
 * it is, anything else as its text — and fixed words when even that cannot be
 * read (`Object.create(null)`, a throwing `toString`), nothing of its own.
 */
function sendFailure(error: unknown): Error {
  try {
    return error instanceof Error ? error : new Error(String(error));
  } catch {
    return new Error(
      'AdtClientsWS request failed: the send failure could not be described',
    );
  }
}
