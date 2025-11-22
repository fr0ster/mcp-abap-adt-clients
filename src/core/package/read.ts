/**
 * Package read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP package
 */
export async function getPackage(
  connection: AbapConnection,
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
  connection: AbapConnection,
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

