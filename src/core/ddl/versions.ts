import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { IDdlConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

// candidate URI — probe-verify on trial
export async function getDdlVersions(
  connection: IAbapConnection,
  config: Partial<IDdlConfig>,
): Promise<IObjectVersion[]> {
  if (!config.ddlName) throw new Error('ddlName is required');
  const encodedName = encodeSapObjectName(config.ddlName);
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `DDL source ${config.ddlName}`);
  }
}

export async function getDdlVersionSource(
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
