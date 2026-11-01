import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ACCEPT_SCALAR_FUNCTION,
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
} from '../../constants/contentTypes';
import {
  SCALAR_FUNCTION,
  sourceUri,
  transportUri,
} from '../../endpoints/objects';
import { readQuery } from '../shared/readQuery';
import type { IReadOptions } from '../shared/types';

export async function getScalarFunction(
  connection: IAbapConnection,
  name: string,
  version: AdtReadVersion = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${SCALAR_FUNCTION.uri(name)}${readQuery(version, options?.withLongPolling)}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_SCALAR_FUNCTION },
  });
}

export async function getScalarFunctionSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(SCALAR_FUNCTION.uri(name))}${readQuery(version, options?.withLongPolling)}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_SOURCE },
  });
}

export async function getScalarFunctionTransport(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(SCALAR_FUNCTION.uri(name))}${query}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_TRANSPORT },
  });
}
