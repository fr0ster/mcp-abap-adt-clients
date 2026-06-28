import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { IBehaviorImplementationConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

// candidate URI — probe-verify on trial
export async function getBehaviorImplementationVersions(
  connection: IAbapConnection,
  config: Partial<IBehaviorImplementationConfig>,
): Promise<IObjectVersion[]> {
  if (!config.className) throw new Error('className is required');
  const encodedName = encodeSapObjectName(config.className);
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `behavior implementation ${config.className}`);
  }
}

export async function getBehaviorImplementationVersionSource(
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
