import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
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
import { readQuery } from '../shared/readQuery';
import type { IReadOptions } from '../shared/types';

/**
 * Get access control metadata
 */
export async function getAccessControl(
  connection: IAbapConnection,
  accessControlName: string,
  version?: AdtReadVersion,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${ACCESS_CONTROL.uri(accessControlName)}${readQuery(version, options?.withLongPolling)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? CT_ACCESS_CONTROL,
    },
  });
}

/**
 * Get access control source code
 */
export async function getAccessControlSource(
  connection: IAbapConnection,
  accessControlName: string,
  version?: AdtReadVersion,
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

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_SOURCE,
    },
  });
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
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
