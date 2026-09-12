/**
 * Structure read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { objectMetadataWire, objectSourceWire } from '../shared/objectWire';
import type { IReadOptions } from '../shared/types';

/**
 * Get ABAP structure metadata (without source code)
 */
export async function getStructureMetadata(
  connection: IAbapConnection,
  structureName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return objectMetadataWire(
    connection,
    'structure',
    structureName,
    undefined,
    options,
  );
}

/**
 * Get ABAP structure source code
 */
export async function getStructureSource(
  connection: IAbapConnection,
  structureName: string,
  version?: 'active' | 'inactive',
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return objectSourceWire(
    connection,
    'structure',
    structureName,
    undefined,
    version,
    options,
  );
}

/**
 * Get ABAP structure (source code by default for backward compatibility)
 * @deprecated Use getStructureSource() or getStructureMetadata() instead
 */
export async function getStructure(
  connection: IAbapConnection,
  structureName: string,
): Promise<IAdtWireResponse> {
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
  structureName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(structureName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/structures/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
