import type {
  IAbapGitCredentials,
  IAbapGitRepoKeyArgs,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_ABAPGIT_PULL_MODIFIED_OBJECTS_V1 } from '../../constants/contentTypes';
import { credentialHeaders, NEW_FORM } from './newForm';
import { repoPath } from './paths';

/** R6 (cloud): what a pull would overwrite. Any other Accept answers 400. */
export function getModifiedObjectsRequest(
  args: IAbapGitRepoKeyArgs,
  credentials: IAbapGitCredentials | undefined,
): IAbapRequestOptions {
  return {
    method: 'GET',
    url: repoPath(args.key, 'pull', 'modifiedobjects'),
    headers: {
      Accept: ACCEPT_ABAPGIT_PULL_MODIFIED_OBJECTS_V1,
      ...credentialHeaders(credentials),
    },
    ...NEW_FORM,
  };
}
