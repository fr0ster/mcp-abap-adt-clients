/**
 * The recording side of the header tools: which call issued which request,
 * what went on the wire, and how a list of calls runs — in one batch envelope
 * or one request at a time. Shared by the header probe and the error corpus.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { IAnalyse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtBatchConnection } from '../../src/batch/AdtBatchConnection';
import { innerRequest } from '../../src/batch/wire';
import { eachInTurn, type Interrupt } from './ledger';

/** Accept and Content-Type of one request as it went on the wire; `null` is "not sent". */
export interface IWireHeaders {
  accept: string | null;
  contentType: string | null;
}

/** One request a call issued, as the member built it. */
export interface ICapturedRequest {
  method: string;
  url: string;
  params: unknown;
  /** The headers handed to the connection, after any shaping. */
  headers?: Record<string, unknown>;
  /** Whether the request had a body. */
  hasBody?: boolean;
}

/** What one call captured: its answer and the requests it issued. */
export interface ICapture {
  wire?: IAdtWireResponse;
  /** What the member returned. */
  result?: unknown;
  failure?: string;
  requests: ICapturedRequest[];
  /**
   * Accept and Content-Type as they went on the wire, one entry per request:
   * from the envelope part the batch writes, or from the transport.
   */
  onWire?: IWireHeaders[];
}

export const current = new AsyncLocalStorage<ICapture>();

export const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Turns the headers a request carries into the ones that go to the connection. */
export type HeaderShape = (
  headers: Record<string, unknown>,
  request: IAbapRequestOptions,
) => Record<string, unknown>;

function headerOf(
  headers: Record<string, unknown> | undefined,
  name: string,
): unknown {
  if (!headers) return undefined;
  for (const [key, value] of Object.entries(headers))
    if (key.toLowerCase() === name) return value;
  return undefined;
}

/** Accept and Content-Type of a header block, `null` where it has none. */
export function wireHeadersOf(
  headers: Record<string, unknown> | undefined,
): IWireHeaders {
  const read = (name: string): string | null => {
    const value = headerOf(headers, name);
    return value === undefined || value === null ? null : String(value);
  };
  return { accept: read('accept'), contentType: read('content-type') };
}

/**
 * Accept and Content-Type of the envelope part `AdtBatchConnection` writes for
 * this request: rendered by the batch's own `innerRequest`, then read back
 * from its header lines.
 */
export function partHeadersOf(request: IAbapRequestOptions): IWireHeaders {
  const text = innerRequest(request);
  const end = text.indexOf('\r\n\r\n');
  const lines = text.slice(0, end === -1 ? text.length : end).split('\r\n');
  const found: IWireHeaders = { accept: null, contentType: null };
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (name === 'accept') found.accept = value;
    if (name === 'content-type') found.contentType = value;
  }
  return found;
}

/**
 * The connection a client is built on, recording each request into the call
 * that issued it.
 *
 * A plain object of its own, not a `Proxy`: the client installs its request
 * trace by assigning `makeAdtRequest` on the connection it is given, and a
 * proxy without a `set` trap would pass that assignment to the connection
 * below and call itself.
 *
 * `shape` changes the headers before they reach the connection (the error
 * corpus's `none` and `bogus` modes). `parts`: the connection below is an
 * {@link AdtBatchConnection}, so the request's wire headers are those of the
 * envelope part it writes.
 */
export function traced(
  connection: IAbapConnection,
  options: {
    shape?: HeaderShape;
    parts?: boolean;
    /** Replaces the body of a request that has one (the error corpus's fake bodies). */
    body?: (request: IAbapRequestOptions) => unknown;
  } = {},
): IAbapConnection {
  const wrapper: Record<string | symbol, unknown> = {};
  const seen = new Set<string | symbol>();
  for (
    let level: object | null = connection;
    level && level !== Object.prototype;
    level = Object.getPrototypeOf(level)
  ) {
    for (const key of Reflect.ownKeys(level)) {
      if (seen.has(key) || key === 'constructor') continue;
      seen.add(key);
      const value = Reflect.get(connection, key);
      if (typeof value === 'function') wrapper[key] = value.bind(connection);
    }
  }
  wrapper.makeAdtRequest = (request: IAbapRequestOptions) => {
    const given = { ...(request.headers ?? {}) } as Record<string, unknown>;
    const headers = options.shape ? options.shape(given, request) : given;
    const hasBody = request.data !== undefined && request.data !== null;
    const sent = {
      ...request,
      headers,
      ...(hasBody && options.body ? { data: options.body(request) } : {}),
    } as IAbapRequestOptions;
    const capture = current.getStore();
    if (capture) {
      capture.requests.push({
        method: request.method,
        url: request.url,
        params: request.params,
        headers,
        hasBody,
      });
      if (options.parts) {
        capture.onWire ??= [];
        capture.onWire.push(partHeadersOf(sent));
      }
    }
    return connection.makeAdtRequest(sent);
  };
  return wrapper as unknown as IAbapConnection;
}

/**
 * Records, into the call that issued it, the Accept and Content-Type of every
 * request the connection's transport sends — after the connection added its
 * defaults. A CSRF token fetch is left out. Only those two headers are read.
 *
 * The transport is the connector's own `transport` field, reached as the test
 * harness's wire log reaches it.
 */
export function onTheWire<T extends object>(connection: T): T {
  const seam = connection as unknown as {
    transport?: { send?: (request: unknown) => Promise<unknown> };
  };
  const transport = seam.transport;
  const send = transport?.send;
  if (!transport || typeof send !== 'function') return connection;
  transport.send = (request: unknown) => {
    const capture = current.getStore();
    const headers = (request as { headers?: Record<string, unknown> })?.headers;
    const fetch = String(headerOf(headers, 'x-csrf-token') ?? '');
    if (capture && fetch.toLowerCase() !== 'fetch') {
      capture.onWire ??= [];
      capture.onWire.push(wireHeadersOf(headers));
    }
    return send.call(transport, request);
  };
  return connection;
}

/** A call: one member (or one request) on the target it is given. */
export type ICallOn<T> = (target: T, analyse: IAnalyse) => Promise<unknown>;

/**
 * Runs the calls in one envelope (`batched`), or one by one.
 *
 * With an `interrupt` the run is gated: nothing goes out once it was
 * stopped, asked before the envelope and before every request — the call in
 * flight finishes. Without one (cleanup work) everything runs.
 */
export async function runCalls<T>(input: {
  calls: readonly ICallOn<T>[];
  batched: boolean;
  /** The connection the envelope goes out on. */
  connection: IAbapConnection;
  /** The target the calls run on, one request at a time. */
  direct: T;
  /** The target the calls run on, recorded into the envelope. */
  onBatch: (batch: IAbapConnection) => T;
  interrupt?: Interrupt;
}): Promise<ICapture[]> {
  const { calls, interrupt } = input;
  interrupt?.check();
  const captures = calls.map((): ICapture => ({ requests: [] }));
  const invoke = (target: T, call: ICallOn<T>, capture: ICapture) =>
    current.run(capture, () =>
      call(target, (verdict, wire) => {
        capture.wire = wire;
        if (
          !wire &&
          verdict &&
          typeof verdict === 'object' &&
          'message' in verdict
        )
          capture.failure = String(verdict.message);
        return verdict;
      }).then(
        (result: unknown) => {
          capture.result = result;
        },
        (error: unknown) => {
          capture.failure = message(error);
        },
      ),
    );
  if (!input.batched) {
    // Asked before every request, not only before the list.
    await eachInTurn(calls, interrupt, (call, i) =>
      invoke(input.direct, call, captures[i]),
    );
    return captures;
  }
  const batch = new AdtBatchConnection(input.connection, {
    endpoint: 'communication',
  });
  const target = input.onBatch(batch);
  const pending = calls.map((call, i) => invoke(target, call, captures[i]));
  // A member may record its request a few turns after it was called.
  for (let turn = 0; turn < 3; turn++)
    await new Promise<void>((resolve) => setImmediate(resolve));
  // Ctrl-C while the parts were being recorded: the envelope never leaves.
  interrupt?.check();
  try {
    await batch.execute();
  } catch (error) {
    for (const capture of captures)
      if (!capture.wire)
        capture.failure ??= `the envelope failed: ${message(error)}`;
  }
  await Promise.all(pending);
  return captures;
}
