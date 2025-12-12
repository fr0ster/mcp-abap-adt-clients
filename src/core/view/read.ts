/**
 * View read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP view metadata (without source code)
 */
export async function getViewMetadata(
  connection: IAbapConnection,
  viewName: string,
  options?: { withLongPolling?: boolean }
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'view', viewName, undefined, options);
}

/**
 * Get ABAP view source code
 */
export async function getViewSource(
  connection: IAbapConnection,
  viewName: string,
  version: 'active' | 'inactive' = 'active',
  options?: { withLongPolling?: boolean }
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'view', viewName, undefined, version, options);
}

/**
 * Get ABAP view (source code by default for backward compatibility)
 * @deprecated Use getViewSource() or getViewMetadata() instead
 */
export async function getView(
  connection: IAbapConnection,
  viewName: string
): Promise<AxiosResponse> {
  return getViewSource(connection, viewName);
}

/**
 * Get transport request for ABAP view
 * @param connection - SAP connection
 * @param viewName - View name
 * @returns Transport request information
 */
export async function getViewTransport(
  connection: IAbapConnection,
  viewName: string,
  options?: { withLongPolling?: boolean }
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(viewName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

