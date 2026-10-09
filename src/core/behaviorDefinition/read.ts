/**
 * Behavior Definition read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
  CT_BEHAVIOR_DEFINITION,
} from '../../constants/contentTypes';
import {
  BEHAVIOR_DEFINITION,
  sourceUri,
  transportUri,
} from '../../endpoints/objects';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

/**
 * Read behavior definition metadata
 *
 * Endpoint: GET /sap/bc/adt/bo/behaviordefinitions/{name}?version=inactive
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to read (default: inactive)
 * @returns Axios response with behavior definition metadata (XML)
 *
 * @example
 * ```typescript
 * const response = await read(connection, 'Z_MY_BDEF', sessionId);
 * // Response contains metadata in blue:blueSource XML format
 * ```
 */
export async function read(
  connection: IAbapConnection,
  name: string,
  _sessionId: string,
  version: string = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? `&withLongPolling=true` : '';
  const url = `${BEHAVIOR_DEFINITION.uri(name)}?version=${version}${query}`;

  const headers = {
    Accept: options?.accept ?? CT_BEHAVIOR_DEFINITION,
  };

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers,
    },
    { logger },
  );
}

/**
 * Read behavior definition source code
 *
 * Endpoint: GET /sap/bc/adt/bo/behaviordefinitions/{name}/source/main
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to read (default: inactive)
 * @returns Axios response with source code (plain text)
 *
 * @example
 * ```typescript
 * const response = await readSource(connection, 'Z_MY_BDEF', sessionId);
 * const sourceCode = response.data; // BDEF source code
 * ```
 */
export async function readSource(
  connection: IAbapConnection,
  name: string,
  version: string = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? `&withLongPolling=true` : '';
  const url = `${sourceUri(BEHAVIOR_DEFINITION.uri(name))}?version=${version}${query}`;

  const headers = {
    Accept: options?.accept ?? ACCEPT_SOURCE,
  };

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers,
    },
    { logger },
  );
}

/**
 * Get transport request for ABAP behavior definition
 * @param connection - SAP connection
 * @param name - Behavior definition name
 * @returns Transport request information
 */
export async function getBehaviorDefinitionTransport(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(BEHAVIOR_DEFINITION.uri(name))}${query}`;

  const headers = {
    Accept: options?.accept ?? ACCEPT_TRANSPORT,
  };

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers,
  });
}
