import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import { getEnhancementUri, type IEnhancementConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

// candidate URI — probe-verify on trial
export async function getEnhancementVersions(
  connection: IAbapConnection,
  config: Partial<IEnhancementConfig>,
): Promise<IObjectVersion[]> {
  if (!config.enhancementName) throw new Error('enhancementName is required');
  if (!config.enhancementType) throw new Error('enhancementType is required');
  const url = `${getEnhancementUri(config.enhancementType, config.enhancementName)}/source/main/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `enhancement ${config.enhancementName}`);
  }
}

export async function getEnhancementVersionSource(
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
