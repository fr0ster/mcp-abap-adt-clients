import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { STRUCTURE, sourceUri, versionsUri } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import type { IAppendStructureConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/**
 * The version history of the append structure's source — the Atom feed, as it arrived.
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * system without the resource answers 404 or 406, which comes back as the
 * transport's failure; until 23.0.0 it was thrown as a library error.
 *
 * Candidate URI — probe-verify on trial.
 */
export async function getAppendStructureVersions(
  connection: IAbapConnection,
  config: Partial<IAppendStructureConfig>,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: versionsUri(
      sourceUri(STRUCTURE.uri(config.appendStructureName as string)),
    ),
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getAppendStructureVersionSource(
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
