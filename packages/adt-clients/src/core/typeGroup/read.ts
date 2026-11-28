/**
 * Type group reads: the metadata document and the source, one `GET` each.
 */
import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_SOURCE, ACCEPT_TYPE_GROUP } from '../../constants/contentTypes';
import { sourceUri, TYPE_GROUP } from '../../endpoints/objects';
import { readQuery } from '../shared/readQuery';
import type { IReadOptions } from '../shared/types';

/** The `atypgr:abapTypeGroup` document. */
export async function getTypeGroup(
  connection: IAbapConnection,
  typeGroupName: string,
  version?: AdtReadVersion,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TYPE_GROUP.uri(typeGroupName)}${readQuery(version, options?.withLongPolling)}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_TYPE_GROUP },
  });
}

/** The source, `source/main`. */
export async function getTypeGroupSource(
  connection: IAbapConnection,
  typeGroupName: string,
  version?: AdtReadVersion,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${sourceUri(TYPE_GROUP.uri(typeGroupName))}${readQuery(version, options?.withLongPolling)}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_SOURCE },
  });
}
