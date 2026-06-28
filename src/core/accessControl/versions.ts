import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { IAccessControlConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

// candidate URI — probe-verify on trial
export async function getAccessControlVersions(
  connection: IAbapConnection,
  config: Partial<IAccessControlConfig>,
): Promise<IObjectVersion[]> {
  if (!config.accessControlName)
    throw new Error('accessControlName is required');
  const encodedName = encodeSapObjectName(
    config.accessControlName.toLowerCase(),
  );
  const url = `/sap/bc/adt/acm/dcl/sources/${encodedName}/source/main/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `access control ${config.accessControlName}`);
  }
}

export async function getAccessControlVersionSource(
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
