/**
 * Enhancement read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import {
  type EnhancementType,
  getEnhancementUri,
  supportsSourceCode,
} from './types';

/**
 * Get enhancement metadata (without source code)
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @param options - Optional parameters including withLongPolling
 * @returns Axios response with enhancement metadata XML
 */
export async function getEnhancementMetadata(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(enhancementName).toLowerCase();
  let url = getEnhancementUri(enhancementType, encodedName);

  if (options?.withLongPolling) {
    url += '?withLongPolling=true';
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.enhancements.v1+xml, application/xml',
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
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  if (!supportsSourceCode(enhancementType)) {
    throw new Error(
      `Enhancement type '${enhancementType}' does not support source code operations. Only 'enhoxhh' supports source code.`,
    );
  }

  const encodedName = encodeSapObjectName(enhancementName).toLowerCase();
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  let url = `${getEnhancementUri(enhancementType, encodedName)}/source/main?version=${versionParam}`;

  if (options?.withLongPolling) {
    url += '&withLongPolling=true';
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'text/plain; charset=utf-8',
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
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(enhancementName).toLowerCase();
  let url = `${getEnhancementUri(enhancementType, encodedName)}/transport`;

  if (options?.withLongPolling) {
    url += '?withLongPolling=true';
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    },
  });
}
