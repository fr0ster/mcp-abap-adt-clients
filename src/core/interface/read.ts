/**
 * Interface read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP interface metadata (without source code)
 */
export async function getInterfaceMetadata(
  connection: IAbapConnection,
  interfaceName: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'interface', interfaceName);
}

/**
 * Get ABAP interface source code
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getInterfaceSource(
  connection: IAbapConnection,
  interfaceName: string,
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'interface', interfaceName, undefined, version);
}

/**
 * Get ABAP interface (source code by default for backward compatibility)
 * @deprecated Use getInterfaceSource() or getInterfaceMetadata() instead
 */
export async function getInterface(
  connection: IAbapConnection,
  interfaceName: string
): Promise<AxiosResponse> {
  return getInterfaceSource(connection, interfaceName);
}

/**
 * Get transport request for ABAP interface
 * @param connection - SAP connection
 * @param interfaceName - Interface name
 * @returns Transport request information
 */
export async function getInterfaceTransport(
  connection: IAbapConnection,
  interfaceName: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(interfaceName);
  const url = `/sap/bc/adt/oo/interfaces/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

