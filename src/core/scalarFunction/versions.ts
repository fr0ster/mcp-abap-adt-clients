import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { IScalarFunctionConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

// candidate URI — probe-verify on trial
export async function getScalarFunctionVersions(
  connection: IAbapConnection,
  config: Partial<IScalarFunctionConfig>,
): Promise<IObjectVersion[]> {
  if (!config.scalarFunctionName)
    throw new Error('scalarFunctionName is required');
  const encodedName = encodeSapObjectName(
    config.scalarFunctionName.toLowerCase(),
  );
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encodedName}/source/main/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `scalar function ${config.scalarFunctionName}`);
  }
}

export async function getScalarFunctionVersionSource(
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
