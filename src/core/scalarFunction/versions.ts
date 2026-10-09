import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  SCALAR_FUNCTION,
  sourceUri,
  versionsUri,
} from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import type { IScalarFunctionConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/**
 * The version history — the Atom feed, as it arrived (candidate URI,
 * probe-verify on trial).
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * system without the resource answers 404 or 406, which comes back as the
 * transport's failure; until 23.0.0 it was thrown as a library error.
 */
export async function getScalarFunctionVersions(
  connection: IAbapConnection,
  config: Partial<IScalarFunctionConfig>,
): Promise<IAdtWireResponse> {
  const url = versionsUri(
    sourceUri(SCALAR_FUNCTION.uri(config.scalarFunctionName as string)),
  );
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getScalarFunctionVersionSource(
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
