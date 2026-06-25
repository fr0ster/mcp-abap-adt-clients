import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SCALAR_FUNCTION,
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
} from '../../constants/contentTypes';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

function buildQuery(version?: string, options?: IReadOptions): string {
  const q: string[] = [];
  if (version) q.push(`version=${version}`);
  if (options?.withLongPolling) q.push('withLongPolling=true');
  return q.length ? `?${q.join('&')}` : '';
}

export async function getScalarFunction(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encodeSapObjectName(name.toLowerCase())}${buildQuery(version, options)}`;
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: options?.accept ?? ACCEPT_SCALAR_FUNCTION },
    },
    { logger },
  );
}

export async function getScalarFunctionSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encodeSapObjectName(name.toLowerCase())}/source/main${buildQuery(version, options)}`;
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: options?.accept ?? ACCEPT_SOURCE },
    },
    { logger },
  );
}

export async function getScalarFunctionTransport(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encodeSapObjectName(name.toLowerCase())}/transport${query}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: options?.accept ?? ACCEPT_TRANSPORT },
  });
}
