import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ACCEPT_SOURCE,
  ACCEPT_TRANSFORMATION,
  ACCEPT_TRANSPORT,
} from '../../constants/contentTypes';
import {
  sourceUri,
  TRANSFORMATION,
  transportUri,
} from '../../endpoints/objects';
import { readQuery } from '../shared/readQuery';
import type { IReadOptions } from '../shared/types';

/**
 * Get transformation metadata
 */
export async function getTransformation(
  connection: IAbapConnection,
  transformationName: string,
  version: AdtReadVersion = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${TRANSFORMATION.uri(transformationName)}${readQuery(version, options?.withLongPolling)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSFORMATION,
    },
  });
}

/**
 * Get transformation source code
 */
export async function getTransformationSource(
  connection: IAbapConnection,
  transformationName: string,
  version: AdtReadVersion = 'inactive',
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
  const url = `${sourceUri(TRANSFORMATION.uri(transformationName))}${query}`;

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
 * Get transformation transport info
 */
export async function getTransformationTransport(
  connection: IAbapConnection,
  transformationName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(TRANSFORMATION.uri(transformationName))}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
