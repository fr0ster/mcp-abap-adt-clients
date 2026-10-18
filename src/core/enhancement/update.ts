/**
 * Enhancement update operations - Low-level functions
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { HttpError } from '@mcp-abap-adt/interfaces-network';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { ENHANCEMENT } from '../../endpoints/objects';
import { safeStringify } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import {
  type EnhancementType,
  getEnhancementUri,
  type IUpdateEnhancementParams,
  supportsSourceCode,
} from './types';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';

/**
 * Low-level: Update enhancement source code (PUT)
 * Only available for enhoxhh (Source Code Plugin) type
 *
 * NOTE: Object must be locked before calling this function
 *
 * @param connection - SAP connection
 * @param args - Update parameters
 * @returns Axios response
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function update(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  // See the note in behaviorDefinition/update.ts: the handle is passed as given.
  args: Omit<IUpdateEnhancementParams, 'lock_handle'> & {
    lock_handle?: string;
  },
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  if (!supportsSourceCode(args.enhancement_type)) {
    throw new Error(
      `Enhancement type '${args.enhancement_type}' does not support source code update. Only 'enhoxhh' supports source code.`,
    );
  }

  const baseUri = getEnhancementUri(
    args.enhancement_type,
    args.enhancement_name as string,
  );

  // Build URL with parameters
  const params = new URLSearchParams();
  if (args.lock_handle) {
    params.append('lockHandle', args.lock_handle);
  }
  if (args.transport_request) {
    params.append('corrNr', args.transport_request);
  }

  const url = `${baseUri}/source/main?${params.toString()}`;

  if (debugEnabled) {
    logger?.debug?.(`[DEBUG] Updating enhancement - URL: ${url}`);
    logger?.debug?.(`[DEBUG] Updating enhancement - Method: PUT`);
    logger?.debug?.(
      `[DEBUG] Updating enhancement - Headers: ${JSON.stringify(headers, null, 2)}`,
    );
    logger?.debug?.(
      `[DEBUG] Updating enhancement - Source code length: ${args.source_code.length}`,
    );
  }

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'PUT',
      timeout: 0,
      data: args.source_code,
      headers: requestHeaders(headers),
    });
    return response;
  } catch (error: unknown) {
    const e = error as HttpError;
    if (e.response && debugEnabled) {
      logger?.error?.(
        `[ERROR] Update enhancement failed - Status: ${e.response.status}`,
      );
      logger?.error?.(
        `[ERROR] Update enhancement failed - StatusText: ${e.response.statusText}`,
      );
      logger?.error?.(
        `[ERROR] Update enhancement failed - Response headers: ${JSON.stringify(e.response.headers, null, 2)}`,
      );
      logger?.error?.(
        `[ERROR] Update enhancement failed - Response data (first 1000 chars):`,
        typeof e.response.data === 'string'
          ? e.response.data.substring(0, 1000)
          : safeStringify(e.response.data).substring(0, 1000),
      );
    }
    throw error;
  }
}

/**
 * Convenience function: Update enhancement with simpler signature
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param sourceCode - New source code
 * @param lockHandle - Lock handle
 * @param transportRequest - Optional transport request
 * @returns Axios response
 */
export async function updateEnhancement(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  enhancementType: EnhancementType,
  enhancementName: string,
  sourceCode: string,
  lockHandle: string | undefined,
  transportRequest?: string,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  return update(
    connection,
    headers,
    {
      enhancement_name: enhancementName,
      enhancement_type: enhancementType,
      source_code: sourceCode,
      lock_handle: lockHandle,
      transport_request: transportRequest,
    },
    logger,
  );
}

/** Replace the object's whole document. enhoxhh PUT is allowed by its template but unmeasured. */
export async function updateEnhancementMetadata(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  type: EnhancementType,
  name: string,
  source: string,
  lockHandle: string | undefined,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const params = new URLSearchParams();
  if (lockHandle !== undefined) params.append('lockHandle', lockHandle);
  if (transportRequest) params.append('corrNr', transportRequest);
  const query = params.toString();
  return connection.makeAdtRequest({
    url: `${ENHANCEMENT.uri(type, name)}${query ? `?${query}` : ''}`,
    method: 'PUT',
    timeout: 0,
    data: source,
    headers: requestHeaders(headers),
  });
}
