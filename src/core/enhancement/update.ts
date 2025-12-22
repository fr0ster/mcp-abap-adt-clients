/**
 * Enhancement update operations - Low-level functions
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import {
  type EnhancementType,
  getEnhancementUri,
  type IUpdateEnhancementParams,
  supportsSourceCode,
} from './types';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  error: debugEnabled ? console.error : () => {},
};

/**
 * Low-level: Update enhancement source code (PUT)
 * Only available for enhoxhh (Source Code Plugin) type
 *
 * NOTE: Object must be locked before calling this function
 *
 * @param connection - SAP connection
 * @param args - Update parameters
 * @returns Axios response
 */
export async function update(
  connection: IAbapConnection,
  args: IUpdateEnhancementParams,
): Promise<AxiosResponse> {
  if (!args.enhancement_name) {
    throw new Error('enhancement_name is required');
  }
  if (!args.enhancement_type) {
    throw new Error('enhancement_type is required');
  }
  if (!args.source_code) {
    throw new Error('source_code is required');
  }
  if (!args.lock_handle) {
    throw new Error('lock_handle is required');
  }

  if (!supportsSourceCode(args.enhancement_type)) {
    throw new Error(
      `Enhancement type '${args.enhancement_type}' does not support source code update. Only 'enhoxhh' supports source code.`,
    );
  }

  const encodedName = encodeSapObjectName(args.enhancement_name).toLowerCase();
  const baseUri = getEnhancementUri(args.enhancement_type, encodedName);

  // Build URL with parameters
  const params = new URLSearchParams();
  params.append('lockHandle', args.lock_handle);
  if (args.transport_request) {
    params.append('corrNr', args.transport_request);
  }

  const url = `${baseUri}/source/main?${params.toString()}`;

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    Accept: 'text/plain',
  };

  logger.debug(`[DEBUG] Updating enhancement - URL: ${url}`);
  logger.debug(`[DEBUG] Updating enhancement - Method: PUT`);
  logger.debug(
    `[DEBUG] Updating enhancement - Headers: ${JSON.stringify(headers, null, 2)}`,
  );
  logger.debug(
    `[DEBUG] Updating enhancement - Source code length: ${args.source_code.length}`,
  );

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'PUT',
      timeout: getTimeout('default'),
      data: args.source_code,
      headers,
    });
    return response;
  } catch (error: any) {
    if (error.response) {
      logger.error(
        `[ERROR] Update enhancement failed - Status: ${error.response.status}`,
      );
      logger.error(
        `[ERROR] Update enhancement failed - StatusText: ${error.response.statusText}`,
      );
      logger.error(
        `[ERROR] Update enhancement failed - Response headers: ${JSON.stringify(error.response.headers, null, 2)}`,
      );
      logger.error(
        `[ERROR] Update enhancement failed - Response data (first 1000 chars):`,
        typeof error.response.data === 'string'
          ? error.response.data.substring(0, 1000)
          : JSON.stringify(error.response.data).substring(0, 1000),
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
  enhancementType: EnhancementType,
  enhancementName: string,
  sourceCode: string,
  lockHandle: string,
  transportRequest?: string,
): Promise<AxiosResponse> {
  return update(connection, {
    enhancement_name: enhancementName,
    enhancement_type: enhancementType,
    source_code: sourceCode,
    lock_handle: lockHandle,
    transport_request: transportRequest,
  });
}
