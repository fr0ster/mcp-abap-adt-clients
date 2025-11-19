/**
 * DataElement read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP data element
 */
export async function getDataElement(connection: AbapConnection, dataElementName: string): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(dataElementName);
  const url = `${baseUrl}/sap/bc/adt/ddic/dataelements/${encodedName}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

/**
 * Get transport request for ABAP data element
 * @param connection - SAP connection
 * @param dataElementName - Data element name
 * @returns Transport request information
 */
export async function getDataElementTransport(
  connection: AbapConnection,
  dataElementName: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(dataElementName);
  const url = `${baseUrl}/sap/bc/adt/ddic/dataelements/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

