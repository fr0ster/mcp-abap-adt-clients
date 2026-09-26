import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IBehaviorImplementationConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/**
 * The version history of the behavior implementation's include — the Atom feed, as it arrived.
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * system without the resource answers 404 or 406, which comes back as the
 * transport's failure; until 23.0.0 it was thrown as a library error.
 *
 * Candidate URI — probe-verify on trial.
 */
export async function getBehaviorImplementationVersions(
  connection: IAbapConnection,
  config: Partial<IBehaviorImplementationConfig>,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(config.className as string);
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations/versions`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getBehaviorImplementationVersionSource(
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
