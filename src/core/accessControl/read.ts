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
 * Get access control metadata
 */
export async function getAccessControl(
  connection: IAbapConnection,
  accessControlName: string,
  version: 'active' | 'inactive' | 'workingArea' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(accessControlName.toLowerCase());
  const queryParams: string[] = [];
  if (version) {
    queryParams.push(`version=${version}`);
  }
  if (options?.withLongPolling) {
    queryParams.push('withLongPolling=true');
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const url = `/sap/bc/adt/acm/dcl/sources/${encodedName}${query}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? 'application/vnd.sap.adt.dclSource+xml',
      },
    },
    { logger },
  );
}

/**
 * Get access control source code
 */
export async function getAccessControlSource(
  connection: IAbapConnection,
  accessControlName: string,
  version: 'active' | 'inactive' | 'workingArea' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(accessControlName.toLowerCase());
  const queryParams: string[] = [];
  if (version) {
    queryParams.push(`version=${version}`);
  }
  if (options?.withLongPolling) {
    queryParams.push('withLongPolling=true');
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const url = `/sap/bc/adt/acm/dcl/sources/${encodedName}/source/main${query}`;

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
 * Get access control transport info
 */
export async function getAccessControlTransport(
  connection: IAbapConnection,
  accessControlName: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(accessControlName.toLowerCase());
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/acm/dcl/sources/${encodedName}/transport${query}`;

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
