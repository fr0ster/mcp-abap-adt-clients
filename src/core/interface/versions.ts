import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { IInterfaceConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

// candidate URI — probe-verify on trial
export async function getInterfaceVersions(
  connection: IAbapConnection,
  config: Partial<IInterfaceConfig>,
): Promise<IObjectVersion[]> {
  if (!config.interfaceName) throw new Error('interfaceName is required');
  const encodedName = encodeSapObjectName(config.interfaceName);
  const url = `/sap/bc/adt/oo/interfaces/${encodedName}/source/main/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `interface ${config.interfaceName}`);
  }
}

export async function getInterfaceVersionSource(
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
