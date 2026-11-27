import type {
  AdtObjectIdentity,
  EnhancementType,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getEnhancementUri, type IEnhancementConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/**
 * The version history of the enhancement's source — the Atom feed, as it
 * arrived.
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * system without the resource answers 404 or 406, which comes back as the
 * transport's failure; until 23.0.0 it was thrown as a library error.
 */
// candidate URI — probe-verify on the ABAP Cloud system
export async function getEnhancementVersions(
  connection: IAbapConnection,
  config: AdtObjectIdentity<IEnhancementConfig, 'enhancementName'>,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${getEnhancementUri(
      config.enhancementType,
      config.enhancementName,
    )}/source/main/versions`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getEnhancementVersionSource(
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
