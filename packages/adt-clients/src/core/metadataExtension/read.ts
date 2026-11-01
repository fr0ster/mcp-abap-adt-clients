import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
/**
 * Read Metadata Extension (DDLX)
 *
 * Endpoint: GET /sap/bc/adt/ddic/ddlx/sources/{name}
 * Source: GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
  CT_METADATA_EXTENSION,
} from '../../constants/contentTypes';
import {
  METADATA_EXTENSION,
  sourceUri,
  transportUri,
} from '../../endpoints/objects';
import { readQuery } from '../shared/readQuery';
import type { IReadOptions } from '../shared/types';

/**
 * Read metadata extension metadata
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @returns Axios response with metadata extension metadata
 *
 * @example
 * ```typescript
 * const metadata = await readMetadataExtension(connection, 'ZDEMO_C_CDS_MDE');
 * ```
 */
export async function readMetadataExtension(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${METADATA_EXTENSION.uri(name)}${readQuery(options?.version, options?.withLongPolling)}`;

  const headers = {
    Accept: options?.accept ?? CT_METADATA_EXTENSION,
  };

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers,
  });
}

/**
 * Read metadata extension source code
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param version - Version to read ('active' or 'inactive', default 'active')
 * @returns Axios response with source code as string
 *
 * @example
 * ```typescript
 * const response = await readMetadataExtensionSource(connection, 'ZDEMO_C_CDS_MDE');
 * const sourceCode = response.data;
 * ```
 */
export async function readMetadataExtensionSource(
  connection: IAbapConnection,
  name: string,
  version: AdtReadVersion = 'active',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  // `active` is the plain resource here and sends no version, as before.
  const url = `${sourceUri(METADATA_EXTENSION.uri(name))}${readQuery(version === 'active' ? undefined : version, options?.withLongPolling)}`;

  const headers = {
    Accept: options?.accept ?? ACCEPT_SOURCE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers,
  });
}

/**
 * Get transport request for ABAP metadata extension
 * @param connection - SAP connection
 * @param name - Metadata extension name
 * @returns Transport request information
 */
export async function getMetadataExtensionTransport(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(METADATA_EXTENSION.uri(name))}${query}`;

  const headers = {
    Accept: options?.accept ?? ACCEPT_TRANSPORT,
  };

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers,
  });
}
