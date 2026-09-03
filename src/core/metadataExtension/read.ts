/**
 * Read Metadata Extension (DDLX)
 *
 * Endpoint: GET /sap/bc/adt/ddic/ddlx/sources/{name}
 * Source: GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
  CT_METADATA_EXTENSION,
} from '../../constants/contentTypes';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

/**
 * Read metadata extension metadata
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @returns Axios response with metadata extension metadata
 *
 * @example
 * ```typescript
 * const metadata = await readMetadataExtension(connection, 'ZDEMO_C_CDS_MDE');
 * ```
 */
export async function readMetadataExtension(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const lowerName = encodeSapObjectName(name).toLowerCase();
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}${query}`;

  const headers = {
    Accept: options?.accept ?? CT_METADATA_EXTENSION,
  };

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers,
    },
    { logger },
  );
}

/**
 * Read metadata extension source code
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param version - Version to read ('active' or 'inactive', default 'active')
 * @returns Axios response with source code as string
 *
 * @example
 * ```typescript
 * const response = await readMetadataExtensionSource(connection, 'ZDEMO_C_CDS_MDE');
 * const sourceCode = response.data;
 * ```
 */
export async function readMetadataExtensionSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const lowerName = encodeSapObjectName(name).toLowerCase();
  const versionQuery = version === 'inactive' ? '?version=inactive' : '';
  const longPollingQuery = options?.withLongPolling
    ? versionQuery
      ? '&withLongPolling=true'
      : '?withLongPolling=true'
    : '';
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}/source/main${versionQuery}${longPollingQuery}`;

  const headers = {
    Accept: options?.accept ?? ACCEPT_SOURCE,
  };

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers,
    },
    { logger },
  );
}

/**
 * Get transport request for ABAP metadata extension
 * @param connection - SAP connection
 * @param name - Metadata extension name
 * @returns Transport request information
 */
export async function getMetadataExtensionTransport(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const lowerName = encodeSapObjectName(name).toLowerCase();
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}/transport${query}`;

  const headers = {
    Accept: options?.accept ?? ACCEPT_TRANSPORT,
  };

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers,
  });
}
