/**
 * Package read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP package
 */
export async function getPackage(
  connection: IAbapConnection,
  packageName: string,
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(packageName);
  const url = `/sap/bc/adt/packages/${encodedName}?version=${version}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

/**
 * Get transport request for ABAP package
 * @param connection - SAP connection
 * @param packageName - Package name
 * @returns Transport request information
 */
export async function getPackageTransport(
  connection: IAbapConnection,
  packageName: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(packageName);
  const url = `/sap/bc/adt/packages/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

