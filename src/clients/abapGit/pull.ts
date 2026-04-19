import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  CT_ABAPGIT_REPO_V3,
  CT_ABAPGIT_REPO_V4,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import { getErrorLog } from './getErrorLog';
import { listRepos } from './listRepos';
import { pollUntilTerminal } from './poll';
import type {
  IAbapGitPullArgs,
  IAbapGitPullResult,
  IAbapGitRepoStatus,
} from './types';
import { buildPullBody } from './xmlBuilder';

export async function pullRepo(
  connection: IAbapConnection,
  args: IAbapGitPullArgs,
  contentTypeVersion: 'v3' | 'v4' = 'v3',
): Promise<IAbapGitPullResult> {
  const repos = await listRepos(connection);
  const match = repos.find(
    (r) => r.package.toUpperCase() === args.package.toUpperCase(),
  );
  if (!match) {
    throw new Error(
      `abapGit repository for package '${args.package}' not found`,
    );
  }
  if (!match.atomLinks.pullLink) {
    throw new Error(
      `abapGit repository '${args.package}': response missing pull_link atom link`,
    );
  }

  const resolvedBranch = args.branchName ?? match.branchName;
  const ct =
    contentTypeVersion === 'v4' ? CT_ABAPGIT_REPO_V4 : CT_ABAPGIT_REPO_V3;

  await connection.makeAdtRequest({
    method: 'POST',
    url: match.atomLinks.pullLink,
    timeout: getTimeout('default'),
    headers: { 'Content-Type': ct, Accept: ct },
    data: buildPullBody(args, resolvedBranch),
  });

  const terminal: IAbapGitRepoStatus = await pollUntilTerminal(
    connection,
    args.package,
    {
      pollIntervalMs: args.pollIntervalMs,
      maxPollDurationMs: args.maxPollDurationMs,
      signal: args.signal,
      onProgress: args.onProgress,
    },
  );

  const result: IAbapGitPullResult = { finalStatus: terminal };
  if (terminal.status === 'E' || terminal.status === 'A') {
    try {
      result.errorLog = await getErrorLog(connection, args.package);
    } catch {
      // Error log is best-effort. If it fails, return the result without it.
    }
  }
  return result;
}
