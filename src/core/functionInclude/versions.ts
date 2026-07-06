import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { IFunctionIncludeConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

// candidate URI — probe-verify on trial
export async function getFunctionIncludeVersions(
  connection: IAbapConnection,
  config: Partial<IFunctionIncludeConfig>,
): Promise<IObjectVersion[]> {
  if (!config.functionGroupName)
    throw new Error('functionGroupName is required');
  if (!config.includeName) throw new Error('includeName is required');
  const groupLower = encodeSapObjectName(
    config.functionGroupName,
  ).toLowerCase();
  const encodedInclude = encodeSapObjectName(config.includeName.toUpperCase());
  const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `function include ${config.includeName}`);
  }
}

export async function getFunctionIncludeVersionSource(
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
