import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { ACCEPT_ABAPGIT_REPOS_V2 } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import { type IRepoEntityParsed, parseRepoList } from './xmlParser';

export async function listRepos(
  connection: IAbapConnection,
): Promise<IRepoEntityParsed[]> {
  const resp = await connection.makeAdtRequest({
    method: 'GET',
    url: '/sap/bc/adt/abapgit/repos',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_ABAPGIT_REPOS_V2 },
  });
  return parseRepoList(String(resp.data));
}
