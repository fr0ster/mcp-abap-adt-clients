/**
 * Domain read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP domain
 */
export async function getDomain(connection: IAbapConnection, domainName: string): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(domainName);
  const url = `/sap/bc/adt/ddic/domains/${encodedName}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

/**
 * Get transport request for ABAP domain
 * @param connection - SAP connection
 * @param domainName - Domain name
 * @returns Transport request information
 */
export async function getDomainTransport(
  connection: IAbapConnection,
  domainName: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(domainName);
  const url = `/sap/bc/adt/ddic/domains/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

