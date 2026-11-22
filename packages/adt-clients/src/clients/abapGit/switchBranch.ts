import type {
  IAbapGitCredentials,
  IAbapGitSwitchBranchArgs,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { credentialHeaders, NEW_FORM } from './newForm';
import { repoPath } from './paths';

/**
 * R15 (onprem): the repository's branch. `?create=true` only when `create`
 * is true — then SAP creates a missing branch in the remote; without it a
 * missing branch changes nothing and answers success.
 */
export function switchBranchRequest(
  args: IAbapGitSwitchBranchArgs,
  credentials: IAbapGitCredentials | undefined,
): IAbapRequestOptions {
  return {
    method: 'POST',
    url: repoPath(args.key, 'branches', args.branch),
    headers: { ...credentialHeaders(credentials) },
    ...(args.create ? { params: { create: 'true' } } : {}),
    ...NEW_FORM,
  };
}
