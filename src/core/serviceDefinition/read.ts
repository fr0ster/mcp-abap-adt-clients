/**
 * ServiceDefinition read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
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
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(serviceDefinitionName.toLowerCase());
  const queryParams: string[] = [];
  if (version) {
    queryParams.push(`version=${version}`);
  }
  if (options?.withLongPolling) {
    queryParams.push('withLongPolling=true');
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const url = `/sap/bc/adt/ddic/srvd/sources/${encodedName}${query}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? 'application/vnd.sap.adt.ddic.srvd.v1+xml',
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
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(serviceDefinitionName.toLowerCase());
  const queryParams: string[] = [];
  if (version) {
    queryParams.push(`version=${version}`);
  }
  if (options?.withLongPolling) {
    queryParams.push('withLongPolling=true');
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const url = `/sap/bc/adt/ddic/srvd/sources/${encodedName}/source/main${query}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? 'text/plain',
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
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(serviceDefinitionName.toLowerCase());
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/srvd/sources/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept:
        options?.accept ?? 'application/vnd.sap.adt.transportorganizer.v1+xml',
    },
  });
}
