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

function getBaseRequest(
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
  if (baseRequestMap.has(connection)) {
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
