/**
 * ServiceDefinition read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
  CT_SERVICE_DEFINITION,
} from '../../constants/contentTypes';
import {
  SERVICE_DEFINITION,
  sourceUri,
  transportUri,
} from '../../endpoints/objects';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

/**
 * Get ABAP service definition
 */
export async function getServiceDefinition(
  connection: IAbapConnection,
  serviceDefinitionName: string,
  version: 'active' | 'inactive' | 'workingArea' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const queryParams: string[] = [];
  if (version) {
    queryParams.push(`version=${version}`);
  }
  if (options?.withLongPolling) {
    queryParams.push('withLongPolling=true');
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const url = `${SERVICE_DEFINITION.uri(serviceDefinitionName)}${query}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? CT_SERVICE_DEFINITION,
      },
    },
    { logger },
  );
}

/**
 * Get service definition source code
 */
export async function getServiceDefinitionSource(
  connection: IAbapConnection,
  serviceDefinitionName: string,
  version: 'active' | 'inactive' | 'workingArea' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const queryParams: string[] = [];
  if (version) {
    queryParams.push(`version=${version}`);
  }
  if (options?.withLongPolling) {
    queryParams.push('withLongPolling=true');
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const url = `${sourceUri(SERVICE_DEFINITION.uri(serviceDefinitionName))}${query}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? ACCEPT_SOURCE,
      },
    },
    { logger },
  );
}

/**
 * Get transport request for ABAP service definition
 * @param connection - SAP connection
 * @param serviceDefinitionName - Service definition name
 * @returns Transport request information
 */
export async function getServiceDefinitionTransport(
  connection: IAbapConnection,
  serviceDefinitionName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(SERVICE_DEFINITION.uri(serviceDefinitionName))}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
