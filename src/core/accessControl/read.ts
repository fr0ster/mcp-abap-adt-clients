import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
  CT_ACCESS_CONTROL,
} from '../../constants/contentTypes';
import {
  ACCESS_CONTROL,
  sourceUri,
  transportUri,
} from '../../endpoints/objects';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
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
): Promise<IAdtWireResponse> {
  const queryParams: string[] = [];
  if (version) {
    queryParams.push(`version=${version}`);
  }
  if (options?.withLongPolling) {
    queryParams.push('withLongPolling=true');
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const url = `${ACCESS_CONTROL.uri(accessControlName)}${query}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? CT_ACCESS_CONTROL,
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
): Promise<IAdtWireResponse> {
  const queryParams: string[] = [];
  if (version) {
    queryParams.push(`version=${version}`);
  }
  if (options?.withLongPolling) {
    queryParams.push('withLongPolling=true');
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const url = `${sourceUri(ACCESS_CONTROL.uri(accessControlName))}${query}`;

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
 * Get access control transport info
 */
export async function getAccessControlTransport(
  connection: IAbapConnection,
  accessControlName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(ACCESS_CONTROL.uri(accessControlName))}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
