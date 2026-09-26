import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { encodeSapObjectName } from '../../utils/internalUtils';
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
    url: `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(config.ddlName as string)}/source/main/versions`,
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
