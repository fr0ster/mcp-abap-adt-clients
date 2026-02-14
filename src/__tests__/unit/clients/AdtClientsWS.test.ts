import type {
  IWebSocketCloseInfo,
  IWebSocketConnectOptions,
  IWebSocketMessageEnvelope,
  IWebSocketMessageHandler,
  IWebSocketTransport,
} from '@mcp-abap-adt/interfaces';
import { AdtClientsWS } from '../../../clients/AdtClientsWS';
import { DebuggerSessionClient } from '../../../clients/DebuggerSessionClient';

class MockWebSocketTransport implements IWebSocketTransport {
  private connected = false;
  private messageHandler?: IWebSocketMessageHandler<unknown>;
  private openHandler?: () => void | Promise<void>;
  private closeHandler?: (info: IWebSocketCloseInfo) => void | Promise<void>;

  readonly connect = jest.fn(
    async (_url: string, _options?: IWebSocketConnectOptions) => {
      this.connected = true;
      if (this.openHandler) {
        await this.openHandler();
      }
    },
  );

  readonly disconnect = jest.fn(async (code?: number, reason?: string) => {
    this.connected = false;
    if (this.closeHandler) {
      await this.closeHandler({ code: code ?? 1000, reason, wasClean: true });
    }
  });

  readonly send = jest.fn(
    async <T = unknown>(_message: IWebSocketMessageEnvelope<T>) => {},
  );

  onMessage<T = unknown>(handler: IWebSocketMessageHandler<T>): void {
    this.messageHandler = handler as IWebSocketMessageHandler<unknown>;
  }

  onOpen(handler: () => void | Promise<void>): void {
    this.openHandler = handler;
  }

  onError(_handler: (error: Error) => void | Promise<void>): void {}

  onClose(handler: (info: IWebSocketCloseInfo) => void | Promise<void>): void {
    this.closeHandler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async emitMessage(
    message: IWebSocketMessageEnvelope<unknown>,
  ): Promise<void> {
    if (this.messageHandler) {
      await this.messageHandler(message);
    }
  }
}

describe('AdtClientsWS', () => {
  it('delegates connect/disconnect and connection state', async () => {
    const transport = new MockWebSocketTransport();
    const client = new AdtClientsWS(transport);

    expect(client.isConnected()).toBe(false);
    await client.connect('wss://example.test/realtime');
    expect(transport.connect).toHaveBeenCalledWith(
      'wss://example.test/realtime',
      undefined,
    );
    expect(client.isConnected()).toBe(true);

    await client.disconnect(1000, 'done');
    expect(transport.disconnect).toHaveBeenCalledWith(1000, 'done');
    expect(client.isConnected()).toBe(false);
  });

  it('sends request envelope and resolves matching response', async () => {
    const transport = new MockWebSocketTransport();
    const client = new AdtClientsWS(transport);

    const pending = client.request<{ x: number }, { ok: boolean }>(
      'debugger.listen',
      { x: 1 },
      { correlationId: 'req-1' },
    );

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'request',
        operation: 'debugger.listen',
        correlationId: 'req-1',
        payload: { x: 1 },
      }),
    );

    await transport.emitMessage({
      kind: 'response',
      correlationId: 'req-1',
      payload: { ok: true },
    });

    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('rejects request when correlated error envelope arrives', async () => {
    const transport = new MockWebSocketTransport();
    const client = new AdtClientsWS(transport);

    const pending = client.request(
      'debugger.attach',
      { sessionId: 's1' },
      {
        correlationId: 'req-err',
      },
    );

    await transport.emitMessage({
      kind: 'error',
      correlationId: 'req-err',
      payload: 'attach failed',
    });

    await expect(pending).rejects.toThrow(
      'AdtClientsWS request failed for correlationId "req-err": attach failed',
    );
  });

  it('rejects request on timeout', async () => {
    jest.useFakeTimers();
    try {
      const transport = new MockWebSocketTransport();
      const client = new AdtClientsWS(transport, undefined, {
        requestTimeoutMs: 20,
      });

      const pending = client.request('debugger.getStack');
      const assertion = expect(pending).rejects.toThrow(
        'AdtClientsWS request timeout for operation "debugger.getStack" after 20ms',
      );
      await jest.advanceTimersByTimeAsync(25);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it('forwards non-correlated messages to event handlers', async () => {
    const transport = new MockWebSocketTransport();
    const client = new AdtClientsWS(transport);
    const handler = jest.fn();
    client.onEvent(handler);

    const eventMessage: IWebSocketMessageEnvelope = {
      kind: 'event',
      operation: 'debugger.paused',
      payload: { reason: 'breakpoint' },
    };
    await transport.emitMessage(eventMessage);

    expect(handler).toHaveBeenCalledWith(eventMessage);
  });

  it('creates debugger session facade', () => {
    const transport = new MockWebSocketTransport();
    const client = new AdtClientsWS(transport);

    const debuggerClient = client.getDebuggerSessionClient();
    expect(debuggerClient).toBeInstanceOf(DebuggerSessionClient);
  });
});
