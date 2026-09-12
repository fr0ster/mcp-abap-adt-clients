import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ObjectVersion } from '../shared/results';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';
import type { ITableTypeConfig } from './types';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

// candidate URI — probe-verify on trial
export async function getTableTypeVersions(
  connection: IAbapConnection,
  config: Partial<ITableTypeConfig>,
): Promise<ObjectVersion[]> {
  const encodedName = encodeSapObjectName(config.tableTypeName as string);
  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}/source/main/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `table type ${config.tableTypeName}`);
  }
}

export async function getTableTypeVersionSource(
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
