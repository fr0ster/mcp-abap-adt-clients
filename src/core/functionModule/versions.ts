import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IFunctionModuleConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/**
 * The version history of the module's source — the Atom feed, as it arrived.
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * system without the resource answers 404 or 406, which comes back as the
 * transport's failure; until 23.0.0 it was thrown as a library error.
 */
// candidate URI — probe-verify on trial
export async function getFunctionModuleVersions(
  connection: IAbapConnection,
  config: Partial<IFunctionModuleConfig>,
): Promise<IAdtWireResponse> {
  const encodedGroup = encodeSapObjectName(config.functionGroupName as string);
  const encodedName = encodeSapObjectName(config.functionModuleName as string);
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/source/main/versions`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getFunctionModuleVersionSource(
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
