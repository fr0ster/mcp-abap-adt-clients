/**
 * TableType read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  HttpError,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
  CT_TABLE_TYPE,
} from '../../constants/contentTypes';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

/**
 * Get ABAP table type metadata (without source code)
 */
export async function getTableTypeMetadata(
  connection: IAbapConnection,
  tableTypeName: string,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableTypeName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}${query}`;
  const acceptHeader = options?.accept ?? CT_TABLE_TYPE;

  try {
    return await makeAdtRequestWithAcceptNegotiation(
      connection,
      {
        url,
        method: 'GET',
        timeout: getTimeout('default'),
        headers: {
          Accept: acceptHeader,
        },
      },
      { logger },
    );
  } catch (error: unknown) {
    const e = error as HttpError;
    // Output full error response as-is for debugging
    const status = e.response?.status || 'unknown';
    const statusText = e.response?.statusText || '';
    const responseHeaders = JSON.stringify(e.response?.headers || {}, null, 2);
    const responseData = e.response?.data
      ? typeof e.response.data === 'string'
        ? e.response.data
        : JSON.stringify(e.response.data, null, 2)
      : e.message || 'No response data';

    const fullError = `getTableTypeMetadata failed for ${tableTypeName}
HTTP Status: ${status} ${statusText}
Response Headers: ${responseHeaders}
Response Data: ${responseData}
Request URL: ${url}
Request Headers: ${JSON.stringify({ Accept: acceptHeader }, null, 2)}`;

    logger?.error?.(fullError);

    throw error;
  }
}

/**
 * Get ABAP table type source code (DDL)
 */
export async function getTableTypeSource(
  connection: IAbapConnection,
  tableTypeName: string,
  version?: 'active' | 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableTypeName);
  const versionParam = version ? `version=${version}` : '';
  const longPollingParam = options?.withLongPolling
    ? 'withLongPolling=true'
    : '';

  const queryParams = [versionParam, longPollingParam]
    .filter(Boolean)
    .join('&');
  const query = queryParams ? `?${queryParams}` : '';

  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}/source/main${query}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? ACCEPT_SOURCE,
      },
    },
    { logger },
  );
}

/**
 * Get ABAP table type (source code by default for backward compatibility)
 * @deprecated Use getTableTypeSource() or getTableTypeMetadata() instead
 */
export async function getTableType(
  connection: IAbapConnection,
  tableTypeName: string,
): Promise<AxiosResponse> {
  return getTableTypeSource(connection, tableTypeName);
}

/**
 * Get transport request for ABAP table type
 * @param connection - SAP connection
 * @param tableTypeName - Table type name
 * @returns Transport request information
 */
export async function getTableTypeTransport(
  connection: IAbapConnection,
  tableTypeName: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableTypeName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
