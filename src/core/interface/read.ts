/**
 * Interface read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP interface metadata (without source code)
 */
export async function getInterfaceMetadata(
  connection: AbapConnection,
  interfaceName: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'interface', interfaceName);
}

/**
 * Get ABAP interface source code
 */
export async function getInterfaceSource(
  connection: AbapConnection,
  interfaceName: string
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'interface', interfaceName);
}

/**
 * Get ABAP interface (source code by default for backward compatibility)
 * @deprecated Use getInterfaceSource() or getInterfaceMetadata() instead
 */
export async function getInterface(
  connection: AbapConnection,
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
  connection: AbapConnection,
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

