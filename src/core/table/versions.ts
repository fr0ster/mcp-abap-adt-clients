import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { ITableConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

export async function getTableVersions(
  connection: IAbapConnection,
  config: Partial<ITableConfig>,
): Promise<IObjectVersion[]> {
  if (!config.tableName) throw new Error('tableName is required');
  const url = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(config.tableName)}/source/main/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `table ${config.tableName}`);
  }
}

export async function getTableVersionSource(
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
