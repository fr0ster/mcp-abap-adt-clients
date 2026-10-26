/**
 * Enhancement read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
  ENHANCEMENT_CONTENT_TYPES,
} from '../../constants/contentTypes';
import type { IReadOptions } from '../shared/types';
import {
  type EnhancementType,
  getEnhancementUri,
  supportsSourceCode,
} from './types';

/**
 * Get enhancement metadata (without source code)
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxhb, enhoxhh, enhsxsb)
 * @param enhancementName - Enhancement name
 * @param options - Optional parameters including withLongPolling
 * @returns Axios response with enhancement metadata XML
 */
export async function getEnhancementMetadata(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  let url = getEnhancementUri(enhancementType, enhancementName);

  if (options?.withLongPolling) {
    url += '?withLongPolling=true';
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ENHANCEMENT_CONTENT_TYPES[enhancementType],
    },
  });
}

/**
 * Get enhancement source code
 * Only available for enhoxhh (Source Code Plugin) type
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (should be enhoxhh for source code)
 * @param enhancementName - Enhancement name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 * @param options - Optional parameters including withLongPolling
 * @returns Axios response with source code as text/plain
 */
export async function getEnhancementSource(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
  version: 'active' | 'inactive' = 'active',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  if (!supportsSourceCode(enhancementType)) {
    throw new Error(
      `Enhancement type '${enhancementType}' does not support source code operations. Only 'enhoxhh' supports source code.`,
    );
  }

  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  let url = `${getEnhancementUri(enhancementType, enhancementName)}/source/main?version=${versionParam}`;

  if (options?.withLongPolling) {
    url += '&withLongPolling=true';
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_SOURCE,
    },
  });
}

/**
 * Get transport request for enhancement
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param options - Optional parameters including withLongPolling
 * @returns Transport request information
 */
export async function getEnhancementTransport(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  let url = `${getEnhancementUri(enhancementType, enhancementName)}/transport`;

  if (options?.withLongPolling) {
    url += '?withLongPolling=true';
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
