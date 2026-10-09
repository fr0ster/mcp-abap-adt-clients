import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  METADATA_EXTENSION,
  sourceUri,
  versionsUri,
} from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import type { IMetadataExtensionConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/**
 * The version history of the metadata extension's source — the Atom feed, as
 * it arrived.
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * system without the resource answers 404 or 406, which comes back as the
 * transport's failure; until 23.0.0 it was thrown as a library error.
 */
export async function getMetadataExtensionVersions(
  connection: IAbapConnection,
  config: Partial<IMetadataExtensionConfig>,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: versionsUri(sourceUri(METADATA_EXTENSION.uri(config.name as string))),
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getMetadataExtensionVersionSource(
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
