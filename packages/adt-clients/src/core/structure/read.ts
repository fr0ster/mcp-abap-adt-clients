/**
 * Structure read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { STRUCTURE, transportUri } from '../../endpoints/objects';
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
    'TABL/DS',
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
    'TABL/DS',
    structureName,
    undefined,
    version,
    options,
  );
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
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(STRUCTURE.uri(structureName))}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
