/**
 * DataElement read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get ABAP data element
 */
export async function getDataElement(
  connection: IAbapConnection,
  dataElementName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(dataElementName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/dataelements/${encodedName}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {},
  });
}

/**
 * Get transport request for ABAP data element
 * @param connection - SAP connection
 * @param dataElementName - Data element name
 * @returns Transport request information
 */
export async function getDataElementTransport(
  connection: IAbapConnection,
  dataElementName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(dataElementName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/dataelements/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    },
  });
}
