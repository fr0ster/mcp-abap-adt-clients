import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TABLE_TYPE, versionsUri } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import type { ITableTypeConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/**
 * The version history — the Atom feed, as it arrived (candidate URI,
 * probe-verify on trial).
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * system without the resource answers 404 or 406, which comes back as the
 * transport's failure; until 23.0.0 it was thrown as a library error.
 */
export async function getTableTypeVersions(
  connection: IAbapConnection,
  config: Partial<ITableTypeConfig>,
): Promise<IAdtWireResponse> {
  // A table type has no /source/main: discovery documents none for it on an
  // on-premise or a cloud system, and its rel=versions link is on the object.
  // <object>/source/main/versions answered 404 "No suitable resource found".
  const url = versionsUri(TABLE_TYPE.uri(config.tableTypeName as string));
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getTableTypeVersionSource(
  connection: IAbapConnection,
  contentUri: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: contentUri,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: 'text/plain' },
  });
}
