import type {
  IAbapConnection,
  IAbapGitUnlinkArgs,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { listRepos } from './listRepos';

export async function unlinkRepo(
  connection: IAbapConnection,
  args: IAbapGitUnlinkArgs,
): Promise<void> {
  const repos = await listRepos(connection);
  const match = repos.find(
    (r) => r.package.toUpperCase() === args.package.toUpperCase(),
  );
  if (!match) {
    throw new Error(
      `abapGit repository for package '${args.package}' not found`,
    );
  }
  if (!match.repositoryId) {
    throw new Error(
      `abapGit repository '${args.package}': response missing <abapgitrepo:key>`,
    );
  }
  const params: Record<string, string> = {};
  if (args.transportRequest) params.corrNr = args.transportRequest;
  await connection.makeAdtRequest({
    method: 'DELETE',
    url: `/sap/bc/adt/abapgit/repos/${encodeURIComponent(match.repositoryId)}`,
    timeout: getTimeout('default'),
    params,
  });
}
