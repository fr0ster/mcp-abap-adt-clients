/**
 * View read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP view metadata (without source code)
 */
export async function getViewMetadata(
  connection: AbapConnection,
  viewName: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'view', viewName);
}

/**
 * Get ABAP view source code
 */
export async function getViewSource(
  connection: AbapConnection,
  viewName: string
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'view', viewName);
}

/**
 * Get ABAP view (source code by default for backward compatibility)
 * @deprecated Use getViewSource() or getViewMetadata() instead
 */
export async function getView(
  connection: AbapConnection,
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
  connection: AbapConnection,
  viewName: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(viewName);
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

