/**
 * The recording side of the header tools: which call issued which request,
 * what went on the wire, and how a list of calls runs — in one batch envelope
 * or one request at a time. Shared by the header probe and the error corpus.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  IAdtTransport,
  IAdtTransportRequest,
} from '@mcp-abap-adt/connection';
import type { IAnalyse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtBatchConnection } from '../../src/batch/AdtBatchConnection';
import { innerRequest } from '../../src/batch/wire';
import { eachInTurn, type Interrupt } from './ledger';
import type { IRefusalHolder } from './phase2Refusal';

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
  /** The envelope(s) the call's parts went out in (ids of {@link IMeter}). */
  envelopes?: number[];
  /** A call sent on its own: wall time from the first send to the answer, in ms. */
  ms?: number;
}

/** One envelope as it went out: its parts, its bytes, the wall time from send to answer. */
export interface IEnvelopeTiming {
  id: number;
  parts: number;
  bytes: number;
  ms: number;
  msPerPart: number;
}

/** Where a run's envelope timings go. */
export interface IMeter {
  envelopes: IEnvelopeTiming[];
}

const PART_MARKER = 'Content-Type: application/http';

/** Counts the parts of an envelope body: one `application/http` header line each. */
export function partsIn(body: string): number {
  let count = 0;
  for (
    let at = body.indexOf(PART_MARKER);
    at !== -1;
    at = body.indexOf(PART_MARKER, at + 1)
  )
    count++;
  return count;
}

/**
 * The connection an envelope goes out on, timing each send with
 * `performance.now()` — no timer of its own — and noting its id in `ids`.
 */
function metered(
  connection: IAbapConnection,
  meter: IMeter,
  ids: number[],
): IAbapConnection {
  const wrapper = traced(connection);
  const send = wrapper.makeAdtRequest.bind(wrapper);
  (wrapper as { makeAdtRequest: unknown }).makeAdtRequest = async (
    request: IAbapRequestOptions,
  ) => {
    const body = request.data == null ? '' : String(request.data);
    const id = meter.envelopes.length + 1;
    ids.push(id);
    const started = performance.now();
    try {
      return await send(request);
    } finally {
      const ms = performance.now() - started;
      const parts = partsIn(body);
      meter.envelopes.push({
        id,
        parts,
        bytes: Buffer.byteLength(body),
        ms,
        msPerPart: parts ? ms / parts : ms,
      });
    }
  };
  return wrapper;
}

export const current = new AsyncLocalStorage<ICapture>();

/** Told of every answer a traced connection gets: a part's, a request's, an envelope's. */
export type AnswerWatcher = (
  wire: IAdtWireResponse,
  request: IAbapRequestOptions,
) => void;

const watchers = new Set<AnswerWatcher>();

/** Watches every answer until the returned function is called. */
export function watchAnswers(watcher: AnswerWatcher): () => void {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

function notify(wire: unknown, request: IAbapRequestOptions): void {
  if (!wire || typeof (wire as IAdtWireResponse).status !== 'number') return;
  for (const watcher of watchers)
    try {
      watcher(wire as IAdtWireResponse, request);
    } catch {
      // A watcher's own failure is not the request's.
    }
}

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
  assertGated(connection, 'traced');
  const wrapper = forwarding(connection);
  wrapper[GATE] = true;
  wrapper.makeAdtRequest = (request: IAbapRequestOptions) => {
    const given = { ...(request.headers ?? {}) } as Record<string, unknown>;
    const headers = options.shape ? options.shape(given, request) : given;
    const hasBody = request.data !== undefined && request.data !== null;
    const sent = {
      ...request,
      headers,
      ...(hasBody && options.body ? { data: options.body(request) } : {}),
      // Recorded here; the gate below does not record it again.
      [RECORDED]: true,
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
    const answer = connection.makeAdtRequest(sent);
    // An envelope part's answer never passes the gate on its own: it is
    // watched here. Every other answer the gate below watches.
    return options.parts ? watched(answer, request) : answer;
  };
  return wrapper as unknown as IAbapConnection;
}

// --- the gate: every request the script sends --------------------------------

/** Marks a gate, and whatever sends only through one (a traced wrapper, an envelope over a gate). */
const GATE = Symbol('error-corpus gate');
/** Marks a connection that sends nothing (the clients recording). */
const SILENT = Symbol('error-corpus silent');
/** Marks a request `traced` already recorded. */
const RECORDED = Symbol('error-corpus recorded');

/** A connection's own methods, bound, on a plain object of its own. */
function forwarding(
  connection: IAbapConnection,
): Record<string | symbol, unknown> {
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
  return wrapper;
}

/** Whether a connection sends only through a gate (or sends nothing). */
export function throughGate(connection: unknown): boolean {
  const marked = connection as Record<symbol, unknown> | null;
  return Boolean(marked && (marked[GATE] === true || marked[SILENT] === true));
}

function assertGated(connection: unknown, who: string): void {
  if (!throughGate(connection))
    throw new Error(`${who}: the connection does not send through the gate`);
}

/** Marks a connection that sends nothing, so it may be traced. */
export function silent<T extends object>(connection: T): T {
  (connection as Record<symbol, unknown>)[SILENT] = true;
  return connection;
}

function watched<T>(
  answer: Promise<T>,
  request: IAbapRequestOptions,
): Promise<T> {
  return answer.then(
    (wire) => {
      notify(wire, request);
      return wire;
    },
    (error: unknown) => {
      notify((error as { response?: unknown } | null)?.response, request);
      throw error;
    },
  );
}

/** What a gate answers a request it refuses: nothing was sent; its reason is the failure text. */
export class RequestRefused extends Error {
  constructor(readonly reason: string) {
    super(`skipped: ${reason}`);
    this.name = 'RequestRefused';
  }
}

/** The refusal predicate a gate holds (not its cleanup sibling), read by what builds an envelope over it. */
const REFUSAL = Symbol('error-corpus refusal');

/** The refusal a gate holds, if it holds one. */
function refusalOf(
  connection: unknown,
): ((request: IAbapRequestOptions) => string | undefined) | undefined {
  const held = (connection as Record<symbol, unknown> | null)?.[REFUSAL];
  if (typeof held !== 'function') return undefined;
  return (request) => {
    const reason: unknown = held(request);
    return typeof reason === 'string' ? reason : undefined;
  };
}

/** A gate, and its sibling for cleanup and unlocks. */
export interface IGated extends IAbapConnection {
  /** The same gate, without the interrupt check: for cleanup and unlocks only. */
  cleanup(): IAbapConnection;
}

/**
 * The gate every request of the run goes through. Before sending, it asks
 * the interrupt (Ctrl-C, or an authorization stop) — except on its cleanup
 * sibling, which removes and unlocks after a stop. A request the `refusal`
 * names is not sent: the gate answers {@link RequestRefused} (phase 2's
 * `--except`, `--only` and unauthorized endpoints; the cleanup sibling is
 * exempt, as it is from the interrupt). It watches every answer
 * for authorization (the run's guard), and records the request into the
 * call that issued it, unless `traced` already did.
 */
export function gate(
  connection: IAbapConnection,
  options: { interrupt?: Interrupt; refusal?: IRefusalHolder },
  forCleanup = false,
): IGated {
  const wrapper = forwarding(connection);
  wrapper[GATE] = true;
  const refuse = (request: IAbapRequestOptions): string | undefined =>
    forCleanup ? undefined : options.refusal?.current?.(request);
  wrapper[REFUSAL] = refuse;
  wrapper.makeAdtRequest = (request: IAbapRequestOptions) => {
    if (!forCleanup) options.interrupt?.check();
    const reason = refuse(request);
    if (reason !== undefined) return Promise.reject(new RequestRefused(reason));
    const capture = current.getStore();
    if (capture && !(request as unknown as Record<symbol, unknown>)[RECORDED])
      capture.requests.push({
        method: request.method,
        url: request.url,
        params: request.params,
        headers: { ...(request.headers ?? {}) },
        hasBody: request.data !== undefined && request.data !== null,
      });
    return watched(connection.makeAdtRequest(request), request);
  };
  wrapper.cleanup = () => gate(connection, options, true);
  return wrapper as unknown as IGated;
}

/** A gate's cleanup sibling (also through what forwards to a gate). */
export function cleanupOf(connection: IAbapConnection): IAbapConnection {
  const cleanup = (connection as Partial<IGated>).cleanup;
  if (typeof cleanup !== 'function')
    throw new Error('cleanupOf: the connection is not a gate');
  return cleanup.call(connection);
}

/** One request, through a gate (or what sends only through one). */
export function send<T = unknown, D = unknown>(
  connection: IAbapConnection,
  request: IAbapRequestOptions,
): Promise<IAdtWireResponse<T, D>> {
  assertGated(connection, 'send');
  return connection.makeAdtRequest<T, D>(request);
}

/** The status a failed request carries, if any. */
export const statusOfError = (error: unknown): number | undefined => {
  const candidate = error as {
    response?: { status?: unknown };
    status?: unknown;
    cause?: unknown;
  } | null;
  const status = candidate?.response?.status ?? candidate?.status;
  if (typeof status === 'number') return status;
  // The connection's logon wraps the 401 in its own refusal (measured:
  // `AuthRefusedError`, the axios error with the status as its cause).
  return candidate?.cause ? statusOfError(candidate.cause) : undefined;
};

/** The logon refused the credential: 401 or 403 at `connect()`. */
export class LogonRefused extends Error {
  constructor(readonly status: number) {
    super(`the logon answered ${status}`);
    this.name = 'LogonRefused';
  }
}

/**
 * The logon, through the gate: the interrupt is asked first, and a 401 or
 * 403 from `connect()` becomes {@link LogonRefused}. The connection's own
 * requests during the logon are its own.
 */
export async function gateConnect(
  open: () => Promise<IAbapConnection>,
  interrupt: Interrupt,
): Promise<IAbapConnection> {
  interrupt.check();
  try {
    return await open();
  } catch (error) {
    const status = statusOfError(error);
    if (status === 401 || status === 403) throw new LogonRefused(status);
    throw error;
  }
}

/**
 * The connector's transport seam: `AbstractAbapConnection.transport` of
 * `@mcp-abap-adt/connection`, public and typed `IAdtTransport` there, and not
 * a member of `IAbapConnection` — so a connection typed by the contract (as
 * `createTestConnection` answers it, through its wrappers) does not show it to
 * the compiler, and it is looked for at run time. Only `send` is used.
 */
type IWithTransport = { readonly transport: Pick<IAdtTransport, 'send'> };

function hasTransport<T extends object>(
  connection: T,
): connection is T & IWithTransport {
  if (!('transport' in connection)) return false;
  const { transport } = connection;
  return (
    typeof transport === 'object' &&
    transport !== null &&
    'send' in transport &&
    typeof transport.send === 'function'
  );
}

/**
 * Records, into the call that issued it, the Accept and Content-Type of every
 * request the connection's transport sends — after the connection added its
 * defaults. A CSRF token fetch is left out. Only those two headers are read.
 *
 * The transport is the connector's own `transport` field, reached as the test
 * harness's wire log reaches it. A connection without it throws: the probe
 * would otherwise run and record nothing on the wire, in silence.
 */
export function onTheWire<T extends object>(connection: T): T {
  if (!hasTransport(connection)) {
    throw new Error(
      'onTheWire: the connection has no transport seam (`transport.send` of ' +
        "@mcp-abap-adt/connection's AbstractAbapConnection), so nothing " +
        'that goes on the wire could be recorded',
    );
  }
  const { transport } = connection;
  const send = transport.send;
  transport.send = (request: IAdtTransportRequest) => {
    const capture = current.getStore();
    const headers = request.headers;
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
  /** Where the envelopes' timings go. */
  meter?: IMeter;
  /** Filled in place, so a caller still has them when an interrupt throws. */
  captures?: ICapture[];
}): Promise<ICapture[]> {
  const { calls, interrupt } = input;
  interrupt?.check();
  const captures = input.captures ?? [];
  for (const _call of calls) captures.push({ requests: [] });
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
          // A member that threw on SAP's answer still carries it.
          const wire = (error as { response?: IAdtWireResponse } | null)
            ?.response;
          if (!capture.wire && wire && typeof wire.status === 'number')
            capture.wire = wire;
        },
      ),
    );
  if (!input.batched) {
    // Asked before every request, not only before the list.
    await eachInTurn(calls, interrupt, async (call, i) => {
      const started = performance.now();
      await invoke(input.direct, call, captures[i]);
      captures[i].ms = performance.now() - started;
    });
    return captures;
  }
  assertGated(input.connection, 'runCalls');
  const ids: number[] = [];
  const batch = new AdtBatchConnection(
    input.meter
      ? metered(input.connection, input.meter, ids)
      : input.connection,
    { endpoint: 'communication' },
  );
  // The envelope goes out through the gate below it.
  (batch as unknown as Record<symbol, unknown>)[GATE] = true;
  // A part the gate would refuse is not queued: the envelope carries the rest.
  const refuse = refusalOf(input.connection);
  if (refuse) {
    const queue = batch.makeAdtRequest.bind(batch);
    (batch as { makeAdtRequest: unknown }).makeAdtRequest = (
      request: IAbapRequestOptions,
    ) => {
      const reason = refuse(request);
      return reason !== undefined
        ? Promise.reject(new RequestRefused(reason))
        : queue(request);
    };
  }
  const target = input.onBatch(batch);
  const pending = calls.map((call, i) => invoke(target, call, captures[i]));
  // A member may record its request a few turns after it was called.
  for (let turn = 0; turn < 3; turn++)
    await new Promise<void>((resolve) => setImmediate(resolve));
  // Ctrl-C while the parts were being recorded: the envelope never leaves.
  interrupt?.check();
  let refused: unknown;
  try {
    await batch.execute();
  } catch (error) {
    refused = error;
  }
  await Promise.all(pending);
  // The envelope got no answer: every part without one says so, whatever its
  // member made of the rejection.
  if (refused !== undefined)
    for (const capture of captures)
      if (!capture.wire && !capture.failure?.startsWith('skipped: '))
        capture.failure = `envelope failed: ${message(refused)}`;
  if (input.meter) for (const capture of captures) capture.envelopes = [...ids];
  return captures;
}
