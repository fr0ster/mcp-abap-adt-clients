import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { HttpError } from '@mcp-abap-adt/interfaces-network';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';

/**
 * What this connection has learned about Accept and Content-Type, and whether
 * it corrects them at all.
 *
 * **Per connection, not per process.** Until 23.0.0 the two caches and the
 * on/off switch were module globals: a corrected `Accept` learned on one system
 * was sent to every other, keyed by method and URL alone, and one client's
 * `enableAcceptCorrection` switched it for every client in the process. Two
 * systems on different ADT releases answer the same URL with different media
 * types; what one taught must not reach the other.
 *
 * Kept on the connection object under a symbol rather than in a WeakMap keyed
 * by it, because members hand the wire functions a `withCallTimeout` proxy of
 * the connection — a different object — and a proxy forwards symbol property
 * reads and definitions to the connection it wraps.
 */
interface INegotiationState {
  accept: Map<string, string>;
  contentType: Map<string, string>;
  enabled?: boolean;
}

const STATE = Symbol.for('@mcp-abap-adt/adt-clients/acceptNegotiation');

function stateOf(connection: IAbapConnection): INegotiationState {
  const holder = connection as unknown as Record<symbol, INegotiationState>;
  let state = holder[STATE];
  if (!state) {
    state = { accept: new Map(), contentType: new Map() };
    Object.defineProperty(connection, STATE, {
      value: state,
      enumerable: false,
      configurable: true,
    });
  }
  return state;
}

/**
 * The mark of a connection accept negotiation never touches: a recording batch
 * connection. What SAP answers to a recorded request — a `406`/`415` included —
 * is the batch caller's to read, so nothing is corrected, cached or sent again,
 * whatever switch an `AdtClient` built over it was given.
 */
const NO_NEGOTIATION = Symbol.for(
  '@mcp-abap-adt/adt-clients/acceptNegotiation/none',
);

/**
 * Mark a connection so accept negotiation never corrects or resends through it.
 *
 * Public for a consumer that hands members its own connection over an
 * `AdtBatchConnection` — a per-call wrapper, say: an `AdtBatchConnection` marks
 * itself, but a different object is not it, and is negotiated like any other
 * connection unless it is marked too. The mark is permanent; there is no unmark.
 */
export function exemptFromAcceptNegotiation(connection: IAbapConnection): void {
  Object.defineProperty(connection, NO_NEGOTIATION, {
    value: true,
    enumerable: false,
    configurable: false,
  });
}

function isExempt(connection: IAbapConnection): boolean {
  return (
    (connection as unknown as Record<symbol, unknown>)[NO_NEGOTIATION] === true
  );
}

const baseRequestMap = new WeakMap<
  IAbapConnection,
  IAbapConnection['makeAdtRequest']
>();

export interface IAcceptNegotiationOptions {
  enableAcceptCorrection?: boolean;
  logger?: ILogger;
}

/** Forget what this connection learned. */
export function clearAcceptCache(connection: IAbapConnection): void {
  const state = stateOf(connection);
  state.accept.clear();
  state.contentType.clear();
}

/** Switch correction on or off for this connection alone. */
export function setAcceptCorrectionEnabled(
  connection: IAbapConnection,
  enabled?: boolean,
): void {
  stateOf(connection).enabled = enabled;
}

/** This connection's switch, or the `ADT_ACCEPT_CORRECTION` default. */
export function getAcceptCorrectionEnabled(
  connection: IAbapConnection,
): boolean {
  const enabled = stateOf(connection).enabled;
  if (enabled !== undefined) return enabled;
  return process.env.ADT_ACCEPT_CORRECTION !== 'false';
}

export function extractSupportedAccept(error: unknown): string[] {
  const types = new Set<string>();
  const e = error as HttpError;
  const headers = (e?.response?.headers || {}) as Record<string, unknown>;
  const headerCandidates = [
    headers.accept,
    headers['x-sap-adt-supported-accept'],
    headers['x-sap-adt-accept'],
    headers['supported-accept'],
    headers['accept-supported'],
  ];

  for (const value of headerCandidates) {
    if (typeof value === 'string') {
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => {
          types.add(entry);
        });
    }
  }

  const data = e?.response?.data;
  const text =
    typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
  if (text) {
    const matches =
      text.match(/[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+(?:;[^,\s]+)?/g) || [];
    for (const match of matches) {
      types.add(match);
    }
  }

  return Array.from(types).filter(Boolean);
}

export function extractSupportedContentType(error: unknown): string[] {
  const e = error as HttpError;
  if (e?.response?.status !== 415) {
    return [];
  }

  const types = new Set<string>();
  const headers = (e?.response?.headers || {}) as Record<string, unknown>;
  const headerCandidates = [
    headers['content-type'],
    headers['x-sap-adt-supported-content-type'],
    headers['supported-content-type'],
  ];

  for (const value of headerCandidates) {
    if (typeof value === 'string') {
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => {
          types.add(entry);
        });
    }
  }

  const data = e?.response?.data;
  const text =
    typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
  if (text) {
    const matches =
      text.match(/[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+(?:;[^,\s]+)?/g) || [];
    for (const match of matches) {
      types.add(match);
    }
  }

  return Array.from(types).filter(Boolean);
}

function buildCacheKey(request: IAbapRequestOptions): string {
  return `${request.method.toUpperCase()} ${request.url}`;
}

/**
 * The Accept this connection's negotiation would send for `request`: what it
 * learned from a `406` (or was given by `rememberAccept`) for the same method
 * and URL, or `undefined` when it has none or correction is switched off for
 * the connection. A plain read of the per-connection cache.
 */
export function cachedAccept(
  connection: IAbapConnection,
  request: IAbapRequestOptions,
): string | undefined {
  if (!getAcceptCorrectionEnabled(connection)) return undefined;
  return stateOf(connection).accept.get(buildCacheKey(request));
}

/**
 * Store a corrected Accept for `request`'s method and URL on this connection,
 * as the negotiation's own `406` branch does: a later request through the
 * connection's negotiation sends it. A plain write of the per-connection cache.
 */
export function rememberAccept(
  connection: IAbapConnection,
  request: IAbapRequestOptions,
  accept: string,
): void {
  stateOf(connection).accept.set(buildCacheKey(request), accept);
}

/**
 * The connection's request as it was before an `AdtClient` with correction on
 * wrapped it: accept negotiation corrects and resends nothing. The
 * connection's own handling (credential, CSRF, session) is untouched.
 *
 * Exported for the batch connection, and public for a consumer that forwards a
 * batch's envelope through a connection of its own over one an `AdtClient`
 * wrapped: what SAP answers to an envelope is the caller's to read. For a
 * connection never wrapped it is the connection's own `makeAdtRequest`, bound.
 */
export function getBaseRequest(
  connection: IAbapConnection,
): IAbapConnection['makeAdtRequest'] {
  return (
    baseRequestMap.get(connection) ?? connection.makeAdtRequest.bind(connection)
  );
}

export function wrapConnectionAcceptNegotiation(
  connection: IAbapConnection,
  logger?: ILogger,
): void {
  if (baseRequestMap.has(connection) || isExempt(connection)) {
    return;
  }

  const baseRequest = connection.makeAdtRequest.bind(connection);
  baseRequestMap.set(connection, baseRequest);

  connection.makeAdtRequest = async function makeAdtRequestWithNegotiation<
    T = unknown,
    D = unknown,
  >(request: IAbapRequestOptions): Promise<IAdtWireResponse<T, D>> {
    return makeAdtRequestWithAcceptNegotiation(
      connection,
      request,
      logger ? { logger } : undefined,
    );
  };
}

export async function makeAdtRequestWithAcceptNegotiation<
  T = unknown,
  D = unknown,
>(
  connection: IAbapConnection,
  request: IAbapRequestOptions,
  options?: IAcceptNegotiationOptions,
): Promise<IAdtWireResponse<T, D>> {
  if (isExempt(connection)) {
    return getBaseRequest(connection)<T, D>(request);
  }
  const enableCorrection =
    options?.enableAcceptCorrection ?? getAcceptCorrectionEnabled(connection);
  const { accept: acceptCache, contentType: contentTypeCache } =
    stateOf(connection);
  const logger = options?.logger;
  const cacheKey = buildCacheKey(request);

  const headers = { ...(request.headers || {}) };
  const cachedAccept = enableCorrection ? acceptCache.get(cacheKey) : undefined;
  if (cachedAccept) {
    headers.Accept = cachedAccept;
  }

  const cachedContentType = enableCorrection
    ? contentTypeCache.get(cacheKey)
    : undefined;
  if (cachedContentType) {
    headers['Content-Type'] = cachedContentType;
  }

  const baseRequest = getBaseRequest(connection);
  try {
    return await baseRequest({
      ...request,
      headers,
    });
  } catch (error: unknown) {
    const e = error as HttpError;
    if (e.response?.status === 406) {
      const supported = extractSupportedAccept(error);
      if (supported.length > 0) {
        logger?.warn?.(
          `Accept not supported for ${request.url}. Supported Accept: ${supported.join(
            ', ',
          )}`,
        );
      }

      if (enableCorrection && supported.length > 0) {
        const nextAccept = supported.join(', ');
        if (headers.Accept !== nextAccept) {
          acceptCache.set(cacheKey, nextAccept);
          logger?.warn?.(
            `Retrying ${request.url} with corrected Accept: ${nextAccept}`,
          );
          return await baseRequest({
            ...request,
            headers: { ...headers, Accept: nextAccept },
          });
        }
      }
    }

    if (e.response?.status === 415) {
      const supported = extractSupportedContentType(error);
      if (supported.length > 0) {
        logger?.warn?.(
          `Content-Type not supported for ${request.url}. Supported Content-Type: ${supported.join(', ')}`,
        );
      }

      if (enableCorrection && supported.length > 0) {
        const nextContentType = supported[0];
        if (headers['Content-Type'] !== nextContentType) {
          contentTypeCache.set(cacheKey, nextContentType);
          logger?.warn?.(
            `Retrying ${request.url} with corrected Content-Type: ${nextContentType}`,
          );
          return await baseRequest({
            ...request,
            headers: { ...headers, 'Content-Type': nextContentType },
          });
        }
      }
    }

    throw error;
  }
}
