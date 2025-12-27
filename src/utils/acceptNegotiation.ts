import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';

const acceptCache = new Map<string, string>();
const baseRequestMap = new WeakMap<
  IAbapConnection,
  IAbapConnection['makeAdtRequest']
>();
let acceptCorrectionOverride: boolean | undefined;

export interface IAcceptNegotiationOptions {
  enableAcceptCorrection?: boolean;
  logger?: ILogger;
}

export function clearAcceptCache(): void {
  acceptCache.clear();
}

export function setAcceptCorrectionEnabled(enabled?: boolean): void {
  acceptCorrectionOverride = enabled;
}

export function getAcceptCorrectionEnabled(): boolean {
  if (acceptCorrectionOverride !== undefined) {
    return acceptCorrectionOverride;
  }
  return process.env.ADT_ACCEPT_CORRECTION === 'true';
}

export function extractSupportedAccept(error: any): string[] {
  const types = new Set<string>();
  const headers = error?.response?.headers || {};
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

  const data = error?.response?.data;
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
    T = any,
    D = any,
  >(request: IAbapRequestOptions): Promise<IAdtResponse<T, D>> {
    return makeAdtRequestWithAcceptNegotiation(
      connection,
      request,
      logger ? { logger } : undefined,
    );
  };
}

export async function makeAdtRequestWithAcceptNegotiation<T = any, D = any>(
  connection: IAbapConnection,
  request: IAbapRequestOptions,
  options?: IAcceptNegotiationOptions,
): Promise<IAdtResponse<T, D>> {
  const enableCorrection =
    options?.enableAcceptCorrection ?? getAcceptCorrectionEnabled();
  const logger = options?.logger;
  const cacheKey = buildCacheKey(request);

  const headers = { ...(request.headers || {}) };
  const cachedAccept = enableCorrection ? acceptCache.get(cacheKey) : undefined;
  if (cachedAccept) {
    headers.Accept = cachedAccept;
  }

  const baseRequest = getBaseRequest(connection);
  try {
    return await baseRequest({
      ...request,
      headers,
    });
  } catch (error: any) {
    if (error?.response?.status === 406) {
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
    throw error;
  }
}
