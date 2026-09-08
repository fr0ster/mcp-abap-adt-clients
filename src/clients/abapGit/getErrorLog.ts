import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { CT_ABAPGIT_REPO_OBJECT_V2 } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import { listRepos } from './listRepos';
import type { IAbapGitErrorLogEntry } from './types';
import { parseErrorLog } from './xmlParser';

export async function getErrorLog(
  connection: IAbapConnection,
  packageName: string,
): Promise<IAbapGitErrorLogEntry[]> {
  const repos = await listRepos(connection);
  const match = repos.find(
    (r) => r.package.toUpperCase() === packageName.toUpperCase(),
  );
  if (!match) {
    throw new Error(
      `abapGit repository for package '${packageName}' not found`,
    );
  }
  if (!match.atomLinks.logLink) {
    return [];
  }
  const resp = await connection.makeAdtRequest({
    method: 'GET',
    url: match.atomLinks.logLink,
    timeout: getTimeout('default'),
    headers: { Accept: CT_ABAPGIT_REPO_OBJECT_V2 },
  });
  return parseErrorLog(String(resp.data));
}
