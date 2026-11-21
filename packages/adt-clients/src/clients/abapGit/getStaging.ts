import type {
  IAbapGitCredentials,
  IAbapGitRepoKeyArgs,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_ABAPGIT_REPO_STAGE_V1 } from '../../constants/contentTypes';
import { credentialHeaders, NEW_FORM } from './newForm';
import { repoPath } from './paths';

/** R9: the repository's unstaged, staged and ignored objects. Changes nothing. */
export function getStagingRequest(
  args: IAbapGitRepoKeyArgs,
  credentials: IAbapGitCredentials | undefined,
): IAbapRequestOptions {
  return {
    method: 'GET',
    url: repoPath(args.key, 'stage'),
    headers: {
      Accept: CT_ABAPGIT_REPO_STAGE_V1,
      ...credentialHeaders(credentials),
    },
    ...NEW_FORM,
  };
}
