/**
 * DataElement read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_DATA_ELEMENT,
  ACCEPT_TRANSPORT,
} from '../../constants/contentTypes';
import { DATA_ELEMENT, transportUri } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

/**
 * Get ABAP data element
 */
export async function getDataElement(
  connection: IAbapConnection,
  dataElementName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${DATA_ELEMENT.uri(dataElementName)}${query}`;

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
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(DATA_ELEMENT.uri(dataElementName))}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
