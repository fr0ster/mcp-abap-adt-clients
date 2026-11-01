import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
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
import { readQuery } from '../shared/readQuery';
import type { IReadOptions } from '../shared/types';

export async function getScalarFunctionImplementation(
  connection: IAbapConnection,
  name: string,
  version?: AdtReadVersion,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${SCALAR_FUNCTION_IMPLEMENTATION.uri(name)}${readQuery(version, options?.withLongPolling)}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_SCALAR_FUNCTION_IMPL },
  });
}

export async function getScalarFunctionImplementationSource(
  connection: IAbapConnection,
  name: string,
  version?: AdtReadVersion,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(SCALAR_FUNCTION_IMPLEMENTATION.uri(name))}${readQuery(version, options?.withLongPolling)}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_SCALAR_FUNCTION_IMPL_SOURCE,
    },
  });
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
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_TRANSPORT },
  });
}
