import type { IAbapGitUnlinkArgs } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getTimeout } from '../../utils/timeouts';

/**
 * Remove a repository link — `DELETE /abapgit/repos/{key}`, by the key
 * `listRepos` reported.
 *
 * Until interfaces-adt 11 this took a package and listed every repository to
 * find the key, throwing "not found" or "response missing key" from its own
 * lookup (decision 37).
 */
export async function unlinkRepo(
  connection: IAbapConnection,
  args: IAbapGitUnlinkArgs,
): Promise<IAdtWireResponse> {
  const params: Record<string, string> = {};
  if (args.transportRequest) params.corrNr = args.transportRequest;
  return connection.makeAdtRequest({
    method: 'DELETE',
    url: `/sap/bc/adt/abapgit/repos/${encodeURIComponent(args.repositoryId)}`,
    timeout: getTimeout('default'),
    params,
  });
}
