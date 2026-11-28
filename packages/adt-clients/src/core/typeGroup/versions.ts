/** Type group versions: the feed of the source's versions, and one version. */
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { sourceUri, TYPE_GROUP, versionsUri } from '../../endpoints/objects';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

export async function getTypeGroupVersions(
  connection: IAbapConnection,
  typeGroupName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: versionsUri(sourceUri(TYPE_GROUP.uri(typeGroupName))),
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

export async function getTypeGroupVersionSource(
  connection: IAbapConnection,
  contentUri: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: contentUri,
    method: 'GET',
    timeout: 0,
    headers: { Accept: 'text/plain' },
  });
}
