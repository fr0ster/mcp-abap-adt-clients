/**
 * Integration test for WS debugger session flow.
 *
 * This test is opt-in and runs only when both env vars are set:
 * - ADT_WS_DEBUG_ENABLED=true
 * - ADT_WS_TEST_URL=wss://...
 *
 * Flow:
 * 1) debugger.listen
 * 2) debugger.attach
 * 3) debugger.step (continue)
 * 4) debugger.getStack
 * 5) debugger.detach
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IWebSocketCloseInfo,
  IWebSocketConnectOptions,
  IWebSocketMessageEnvelope,
  IWebSocketMessageHandler,
  IWebSocketTransport,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClientsWS } from '../../../../clients/AdtClientsWS';
import { createTestsLogger } from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const { getTimeout } = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

type WsMessageEvent = { data: unknown };
type WsCloseEvent = { code?: number; reason?: string; wasClean?: boolean };

class NativeWsTransport implements IWebSocketTransport {
  private ws: any | null = null;
  private messageHandler?: IWebSocketMessageHandler<unknown>;
  private openHandler?: () => void | Promise<void>;
  private errorHandler?: (error: Error) => void | Promise<void>;
  private closeHandler?: (info: IWebSocketCloseInfo) => void | Promise<void>;

  async connect(
    url: string,
    options?: IWebSocketConnectOptions,
  ): Promise<void> {
    const WsCtor = this.resolveWsCtor();
    const connectTimeoutMs = options?.connectTimeoutMs ?? 15_000;
    const protocols = options?.protocols;
    this.ws = protocols ? new WsCtor(url, protocols) : new WsCtor(url);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`WS connect timeout after ${connectTimeoutMs}ms`));
      }, connectTimeoutMs);

      this.ws.onopen = async () => {
        clearTimeout(timeout);
        if (this.openHandler) {
          await this.openHandler();
        }
        resolve();
      };

      this.ws.onerror = async (event: unknown) => {
        clearTimeout(timeout);
        const err =
          event instanceof Error
            ? event
            : new Error('WebSocket connection failed');
        if (this.errorHandler) {
          await this.errorHandler(err);
        }
        reject(err);
      };

      this.ws.onclose = async (event: WsCloseEvent) => {
        clearTimeout(timeout);
        if (this.closeHandler) {
          await this.closeHandler({
            code: event?.code ?? 1006,
            reason: event?.reason,
            wasClean: event?.wasClean,
          });
        }
      };

      this.ws.onmessage = async (event: WsMessageEvent) => {
        if (!this.messageHandler) {
          return;
        }
        const raw = event?.data;
        const text =
          typeof raw === 'string'
            ? raw
            : raw instanceof Buffer
              ? raw.toString('utf8')
              : String(raw ?? '');
        const parsed = JSON.parse(text) as IWebSocketMessageEnvelope<unknown>;
        await this.messageHandler(parsed);
      };
    });
  }

  async disconnect(code?: number, reason?: string): Promise<void> {
    if (!this.ws) {
      return;
    }
    this.ws.close(code ?? 1000, reason);
    this.ws = null;
  }

  async send<T = unknown>(
    message: IWebSocketMessageEnvelope<T>,
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  onMessage<T = unknown>(handler: IWebSocketMessageHandler<T>): void {
    this.messageHandler = handler as IWebSocketMessageHandler<unknown>;
  }

  onOpen(handler: () => void | Promise<void>): void {
    this.openHandler = handler;
  }

  onError(handler: (error: Error) => void | Promise<void>): void {
    this.errorHandler = handler;
  }

  onClose(handler: (info: IWebSocketCloseInfo) => void | Promise<void>): void {
    this.closeHandler = handler;
  }

  isConnected(): boolean {
    return !!this.ws && this.ws.readyState === 1;
  }

  private resolveWsCtor(): any {
    const globalCtor = (globalThis as any).WebSocket;
    if (globalCtor) {
      return globalCtor;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('ws');
    } catch {
      throw new Error(
        'WebSocket constructor not found. Install "ws" or use a Node runtime with global WebSocket.',
      );
    }
  }
}

function sanitizeConfigForLogging(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value == null) {
      result[key] = value;
      continue;
    }
    const keyLower = key.toLowerCase();
    if (
      keyLower.includes('token') ||
      keyLower.includes('password') ||
      keyLower.includes('secret') ||
      keyLower.includes('cookie')
    ) {
      result[key] = '[REDACTED]';
      continue;
    }
    result[key] = value;
  }
  return result;
}

function extractSessionId(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const obj = response as Record<string, unknown>;
  const candidates: Array<unknown> = [
    obj.sessionId,
    obj.session_id,
    obj.id,
    obj.debugSessionId,
    obj.debug_session_id,
    (obj.payload as any)?.sessionId,
    (obj.payload as any)?.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return undefined;
}

describe('WS debugger session integration', () => {
  const testsLogger = createTestsLogger();
  const wsUrl = process.env.ADT_WS_TEST_URL;
  const enabled =
    process.env.ADT_WS_DEBUG_ENABLED === 'true' && typeof wsUrl === 'string';
  const maybeIt = enabled ? it : it.skip;

  maybeIt(
    'should perform minimal debugger session flow (listen -> attach -> step -> stack -> detach)',
    async () => {
      if (!enabled || !wsUrl) {
        logTestSkip(
          testsLogger,
          'WS debugger session integration',
          'Set ADT_WS_DEBUG_ENABLED=true and ADT_WS_TEST_URL.',
        );
        return;
      }

      const requestTimeoutMs = Number.parseInt(
        process.env.ADT_WS_REQUEST_TIMEOUT_MS || '60000',
        10,
      );
      const listenTimeoutSeconds = Number.parseInt(
        process.env.ADT_WS_DEBUG_LISTEN_TIMEOUT_SECONDS || '60',
        10,
      );
      const debugUser = process.env.ADT_WS_DEBUG_USER;

      const context = sanitizeConfigForLogging({
        wsUrl,
        requestTimeoutMs,
        listenTimeoutSeconds,
        debugUser: debugUser || '(not set)',
      });
      logTestStart(testsLogger, 'WS debugger session integration', {
        name: 'ws_debugger_session_minimal',
        params: context,
      });

      const transport = new NativeWsTransport();
      const wsClient = new AdtClientsWS(transport, testsLogger, {
        requestTimeoutMs,
      });
      const debuggerSession = wsClient.getDebuggerSessionClient();

      let sessionId: string | undefined;
      try {
        logTestStep('connect ws', testsLogger);
        await wsClient.connect(wsUrl, { connectTimeoutMs: 15_000 });

        logTestStep('debugger.listen', testsLogger);
        const listenResponse = await debuggerSession.listen({
          timeoutSeconds: listenTimeoutSeconds,
          user: debugUser,
        });
        sessionId = extractSessionId(listenResponse);
        expect(sessionId).toBeDefined();

        logTestStep('debugger.attach', testsLogger);
        const attachResponse = await debuggerSession.attach({
          sessionId: sessionId as string,
        });
        expect(attachResponse).toBeDefined();

        logTestStep('debugger.step continue', testsLogger);
        const stepResponse = await debuggerSession.step({
          action: 'continue',
        });
        expect(stepResponse).toBeDefined();

        logTestStep('debugger.getStack', testsLogger);
        const stackResponse = await debuggerSession.getStack();
        expect(stackResponse).toBeDefined();

        logTestStep('debugger.detach', testsLogger);
        const detachResponse = await debuggerSession.detach();
        expect(detachResponse).toBeDefined();

        logTestSuccess(testsLogger, 'WS debugger session integration');
      } catch (error) {
        logTestError(testsLogger, 'WS debugger session integration', error);
        throw error;
      } finally {
        await wsClient.disconnect(1000, 'test finished');
        logTestEnd(testsLogger, 'WS debugger session integration');
      }
    },
    getTimeout('test'),
  );
});
