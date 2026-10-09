import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ACCEPT_SCALAR_FUNCTION_IMPL,
  ACCEPT_SCALAR_FUNCTION_IMPL_SOURCE,
  ACCEPT_TRANSPORT,
} from '../../constants/contentTypes';
import {
  SCALAR_FUNCTION_IMPLEMENTATION,
  sourceUri,
  transportUri,
} from '../../endpoints/objects';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

function buildQuery(version?: string, options?: IReadOptions): string {
  const q: string[] = [];
  if (version) q.push(`version=${version}`);
  if (options?.withLongPolling) q.push('withLongPolling=true');
  return q.length ? `?${q.join('&')}` : '';
}

export async function getScalarFunctionImplementation(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${SCALAR_FUNCTION_IMPLEMENTATION.uri(name)}${buildQuery(version, options)}`;
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: options?.accept ?? ACCEPT_SCALAR_FUNCTION_IMPL },
    },
    { logger },
  );
}

export async function getScalarFunctionImplementationSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(SCALAR_FUNCTION_IMPLEMENTATION.uri(name))}${buildQuery(version, options)}`;
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? ACCEPT_SCALAR_FUNCTION_IMPL_SOURCE,
      },
    },
    { logger },
  );
}

export async function getScalarFunctionImplementationTransport(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(SCALAR_FUNCTION_IMPLEMENTATION.uri(name))}${query}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: options?.accept ?? ACCEPT_TRANSPORT },
  });
}
