import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_APPEND_STRUCTURE,
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

export async function getAppendStructure(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(name.toLowerCase())}${buildQuery(version, options)}`;
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: options?.accept ?? ACCEPT_APPEND_STRUCTURE },
    },
    { logger },
  );
}

export async function getAppendStructureSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(name.toLowerCase())}/source/main${buildQuery(version, options)}`;
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

export async function getAppendStructureTransport(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(name.toLowerCase())}/transport${query}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: options?.accept ?? ACCEPT_TRANSPORT },
  });
}
