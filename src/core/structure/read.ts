/**
 * Structure read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP structure metadata (without source code)
 */
export async function getStructureMetadata(
  connection: IAbapConnection,
  structureName: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'structure', structureName);
}

/**
 * Get ABAP structure source code
 */
export async function getStructureSource(
  connection: IAbapConnection,
  structureName: string
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'structure', structureName);
}

/**
 * Get ABAP structure (source code by default for backward compatibility)
 * @deprecated Use getStructureSource() or getStructureMetadata() instead
 */
export async function getStructure(
  connection: IAbapConnection,
  structureName: string
): Promise<AxiosResponse> {
  return getStructureSource(connection, structureName);
}

/**
 * Get transport request for ABAP structure
 * @param connection - SAP connection
 * @param structureName - Structure name
 * @returns Transport request information
 */
export async function getStructureTransport(
  connection: IAbapConnection,
  structureName: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(structureName);
  const url = `/sap/bc/adt/ddic/structures/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

