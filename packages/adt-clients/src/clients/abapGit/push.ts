import type {
  IAbapGitCredentials,
  IAbapGitPushArgs,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_ABAPGIT_REPO_STAGE_V1 } from '../../constants/contentTypes';
import { credentialHeaders, NEW_FORM } from './newForm';
import { repoPath } from './paths';
import { buildPushBody } from './xmlBuilder';

/** R10: the staged objects, committed with the caller's message and people. */
export function pushRequest(
  args: IAbapGitPushArgs,
  credentials: IAbapGitCredentials | undefined,
): IAbapRequestOptions {
  return {
    method: 'POST',
    url: repoPath(args.key, 'push'),
    headers: {
      'Content-Type': CT_ABAPGIT_REPO_STAGE_V1,
      ...credentialHeaders(credentials),
    },
    data: buildPushBody(args),
    ...NEW_FORM,
  };
}
