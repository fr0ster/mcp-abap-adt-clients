import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { parseVersionsFeed, throwVersionsError } from '../shared/versions';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/** Class source lives in includes, not a single source/main resource. */
export type ClassIncludeType =
  | 'main'
  | 'definitions'
  | 'implementations'
  | 'testclasses'
  | 'macros';

export async function getClassIncludeVersions(
  connection: IAbapConnection,
  className: string,
  includeType: ClassIncludeType,
): Promise<IObjectVersion[]> {
  if (!className) throw new Error('className is required');
  const encodedName = encodeSapObjectName(className);
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/${includeType}/versions`;
  try {
    const res = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: { Accept: ACCEPT_VERSION_FEED },
    });
    return parseVersionsFeed(String(res.data));
  } catch (e) {
    throwVersionsError(e, `class ${className} (${includeType})`);
  }
}

export async function getClassVersionSource(
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
