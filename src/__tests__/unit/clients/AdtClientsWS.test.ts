import type {
  IWebSocketCloseInfo,
  IWebSocketConnectOptions,
  IWebSocketMessageEnvelope,
  IWebSocketMessageHandler,
  IWebSocketTransport,
} from '@mcp-abap-adt/interfaces-network';
import { AdtClientsWS } from '../../../clients/AdtClientsWS';

class MockWebSocketTransport implements IWebSocketTransport {
  private connected = false;
  private messageHandler?: IWebSocketMessageHandler<unknown>;
  private openHandler?: () => void | Promise<void>;
  private closeHandler?: (info: IWebSocketCloseInfo) => void | Promise<void>;
  /** A transport whose disconnect() raises no close event of its own. */
  silentDisconnect = false;

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
    if (this.closeHandler && !this.silentDisconnect) {
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

  async emitClose(): Promise<void> {
    this.connected = false;
    if (this.closeHandler) {
      await this.closeHandler({ code: 1006, wasClean: false });
    }
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

  it('sets no deadline of its own: a request waits for its answer', async () => {
    jest.useFakeTimers();
    try {
      const transport = new MockWebSocketTransport();
      const client = new AdtClientsWS(transport);

      let settled = false;
      const pending = client
        .request<undefined, { ok: boolean }>('debugger.getStack', undefined, {
          correlationId: 'req-slow',
        })
        .finally(() => {
          settled = true;
        });
      // An hour of silence ends nothing: only the answer, or a deadline the
      // caller chose, does.
      await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
      expect(settled).toBe(false);
      expect(jest.getTimerCount()).toBe(0);

      await transport.emitMessage({
        kind: 'response',
        correlationId: 'req-slow',
        payload: { ok: true },
      });
      await expect(pending).resolves.toEqual({ ok: true });
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects a waiting request at once when the transport closes', async () => {
    const transport = new MockWebSocketTransport();
    const client = new AdtClientsWS(transport);

    const pending = client.request('debugger.getStack', undefined, {
      correlationId: 'req-closed',
    });
    const rejected = expect(pending).rejects.toThrow(
      'AdtClientsWS connection closed before the answer',
    );
    await transport.emitClose();
    await rejected;

    // The map is empty: a late answer for it reaches the event handlers.
    const handler = jest.fn();
    client.onEvent(handler);
    await transport.emitMessage({
      kind: 'response',
      correlationId: 'req-closed',
      payload: {},
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects a waiting request on disconnect()', async () => {
    const transport = new MockWebSocketTransport();
    transport.silentDisconnect = true;
    const client = new AdtClientsWS(transport);

    const pending = client.request('debugger.getStack', undefined, {
      correlationId: 'req-disconnect',
    });
    const rejected = expect(pending).rejects.toThrow(
      'AdtClientsWS connection closed before the answer',
    );
    await client.disconnect(1000, 'done');
    await rejected;
  });

  it('refuses a request whose correlationId is in flight, without sending it', async () => {
    const transport = new MockWebSocketTransport();
    const client = new AdtClientsWS(transport);

    const first = client.request('debugger.getStack', undefined, {
      correlationId: 'req-dup',
    });
    const firstOutcome = first.then(
      (value) => ({ settled: 'resolved', value }),
      (error: Error) => ({ settled: 'rejected', value: error.message }),
    );
    await expect(
      client.request('debugger.getStack', undefined, {
        correlationId: 'req-dup',
      }),
    ).rejects.toThrow(
      'AdtClientsWS request refused: its correlationId is already in flight',
    );
    expect(transport.send).toHaveBeenCalledTimes(1);

    // The first stays as it was: its answer still reaches it.
    await transport.emitMessage({
      kind: 'response',
      correlationId: 'req-dup',
      payload: { ok: true },
    });
    await expect(firstOutcome).resolves.toEqual({
      settled: 'resolved',
      value: { ok: true },
    });
  });

  for (const [how, end] of [
    ['the transport closes', (t: MockWebSocketTransport) => t.emitClose()],
    [
      'disconnect()',
      (t: MockWebSocketTransport, c: AdtClientsWS) => {
        t.silentDisconnect = true;
        return c.disconnect();
      },
    ],
  ] as const) {
    it(`after a refused duplicate id, every accepted request settles when ${how}`, async () => {
      const transport = new MockWebSocketTransport();
      const client = new AdtClientsWS(transport);

      const settle = (p: Promise<unknown>) =>
        p.then(
          () => 'resolved',
          (error: Error) => error.message,
        );
      const accepted = [
        settle(client.request('a', undefined, { correlationId: 'req-x' })),
        settle(client.request('b', undefined, { correlationId: 'req-y' })),
      ];
      const duplicate = settle(
        client.request('c', undefined, { correlationId: 'req-x' }),
      );

      await end(transport, client);

      await expect(Promise.all(accepted)).resolves.toEqual([
        'AdtClientsWS connection closed before the answer',
        'AdtClientsWS connection closed before the answer',
      ]);
      await expect(duplicate).resolves.toBe(
        'AdtClientsWS request refused: its correlationId is already in flight',
      );
    });
  }

  it("rejects a request on the caller's per-request timeout", async () => {
    jest.useFakeTimers();
    try {
      const transport = new MockWebSocketTransport();
      const client = new AdtClientsWS(transport);

      const pending = client.request('debugger.getStack', undefined, {
        timeoutMs: 20,
      });
      const assertion = expect(pending).rejects.toThrow(
        'AdtClientsWS request timeout for operation "debugger.getStack" after 20ms',
      );
      await jest.advanceTimersByTimeAsync(25);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it("rejects request on the caller's client-wide timeout", async () => {
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
});
