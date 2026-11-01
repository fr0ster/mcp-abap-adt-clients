import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ACCEPT_APPEND_STRUCTURE,
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
} from '../../constants/contentTypes';
import { STRUCTURE, sourceUri, transportUri } from '../../endpoints/objects';
import { readQuery } from '../shared/readQuery';
import type { IReadOptions } from '../shared/types';

export async function getAppendStructure(
  connection: IAbapConnection,
  name: string,
  version?: AdtReadVersion,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${STRUCTURE.uri(name)}${readQuery(version, options?.withLongPolling)}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_APPEND_STRUCTURE },
  });
}

export async function getAppendStructureSource(
  connection: IAbapConnection,
  name: string,
  version?: AdtReadVersion,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(STRUCTURE.uri(name))}${readQuery(version, options?.withLongPolling)}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_SOURCE },
  });
}

export async function getAppendStructureTransport(
  connection: IAbapConnection,
  name: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(STRUCTURE.uri(name))}${query}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_TRANSPORT },
  });
}
