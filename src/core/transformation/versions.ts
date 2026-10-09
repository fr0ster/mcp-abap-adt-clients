import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  sourceUri,
  TRANSFORMATION,
  versionsUri,
} from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import type { ITransformationConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/**
 * The version history — the Atom feed, as it arrived (candidate URI,
 * probe-verify on trial).
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * system without the resource answers 404 or 406, which comes back as the
 * transport's failure; until 23.0.0 it was thrown as a library error.
 */
export async function getTransformationVersions(
  connection: IAbapConnection,
  config: Partial<ITransformationConfig>,
): Promise<IAdtWireResponse> {
  const url = versionsUri(
    sourceUri(TRANSFORMATION.uri(config.transformationName as string)),
  );
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getTransformationVersionSource(
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
