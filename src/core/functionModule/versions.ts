import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { IFunctionModuleConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

// candidate URI — probe-verify on trial
export async function getFunctionModuleVersions(
  connection: IAbapConnection,
  config: Partial<IFunctionModuleConfig>,
): Promise<IObjectVersion[]> {
  if (!config.functionGroupName)
    throw new Error('functionGroupName is required');
  if (!config.functionModuleName)
    throw new Error('functionModuleName is required');
  const encodedGroup = encodeSapObjectName(config.functionGroupName);
  const encodedName = encodeSapObjectName(config.functionModuleName);
  const url = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/source/main/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `function module ${config.functionModuleName}`);
  }
}

export async function getFunctionModuleVersionSource(
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
