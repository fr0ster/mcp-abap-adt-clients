import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { IServiceDefinitionConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

// candidate URI — probe-verify on trial
export async function getServiceDefinitionVersions(
  connection: IAbapConnection,
  config: Partial<IServiceDefinitionConfig>,
): Promise<IObjectVersion[]> {
  if (!config.serviceDefinitionName)
    throw new Error('serviceDefinitionName is required');
  const encodedName = encodeSapObjectName(
    config.serviceDefinitionName.toLowerCase(),
  );
  const url = `/sap/bc/adt/ddic/srvd/sources/${encodedName}/source/main/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `service definition ${config.serviceDefinitionName}`);
  }
}

export async function getServiceDefinitionVersionSource(
  connection: IAbapConnection,
  contentUri: string,
): Promise<string> {
  try {
    const res = await connection.makeAdtRequest({
      url: contentUri,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: 'text/plain' },
    });
    return String(res.data);
  } catch (e) {
    throwVersionsError(e, 'version content');
  }
}
