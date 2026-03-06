/**
 * DataElement read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DATA_ELEMENT,
  ACCEPT_TRANSPORT,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

/**
 * Get ABAP data element
 */
export async function getDataElement(
  connection: IAbapConnection,
  dataElementName: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(dataElementName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/dataelements/${encodedName}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_DATA_ELEMENT,
    },
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
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(dataElementName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/dataelements/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
