import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  BEHAVIOR_DEFINITION,
  sourceUri,
  versionsUri,
} from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import type { IBehaviorDefinitionConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/**
 * The version history of the behavior definition's source — the Atom feed, as it arrived.
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * system without the resource answers 404 or 406, which comes back as the
 * transport's failure; until 23.0.0 it was thrown as a library error.
 *
 * Candidate URI — probe-verify on trial.
 */
export async function getBehaviorDefinitionVersions(
  connection: IAbapConnection,
  config: Partial<IBehaviorDefinitionConfig>,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${versionsUri(sourceUri(BEHAVIOR_DEFINITION.uri(config.name as string)))}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getBehaviorDefinitionVersionSource(
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
