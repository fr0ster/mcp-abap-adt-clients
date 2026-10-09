import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { DDL_SOURCE, versionsUri } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import type { IDdlConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/**
 * The version history of the DDL source — the Atom feed, as it arrived.
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * 404 or 406 comes back as the transport's failure; until 23.0.0 it was thrown
 * as a library error.
 */
export async function getDdlVersions(
  connection: IAbapConnection,
  config: Partial<IDdlConfig>,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    // ADT's own rel=versions link; /source/main/versions answered 404 "No
    // suitable resource found" on an on-premise and a cloud system (2026-10-01).
    url: versionsUri(DDL_SOURCE.uri(config.ddlName as string)),
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getDdlVersionSource(
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
