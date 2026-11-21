import type {
  IAbapGitCredentials,
  IAbapGitRepoKeyArgs,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { credentialHeaders, NEW_FORM } from './newForm';
import { repoPath } from './paths';

/** R11: the repository's connection to its remote, checked. No body. */
export function checkRepoRequest(
  args: IAbapGitRepoKeyArgs,
  credentials: IAbapGitCredentials | undefined,
): IAbapRequestOptions {
  return {
    method: 'POST',
    url: repoPath(args.key, 'checks'),
    headers: { ...credentialHeaders(credentials) },
    ...NEW_FORM,
  };
}
