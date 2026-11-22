import type { IAbapGitRepoKeyArgs } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_ABAPGIT_REPOS_V2 } from '../../constants/contentTypes';
import { NEW_FORM } from './newForm';
import { repoPath } from './paths';

/**
 * R7 (cloud): a GET that SAP's handler checks by its **Content-Type**, and
 * answers a fixed text. It reads no credential, so none is sent.
 */
export function getStatusRequest(
  args: IAbapGitRepoKeyArgs,
): IAbapRequestOptions {
  return {
    method: 'GET',
    url: repoPath(args.key, 'status'),
    headers: { 'Content-Type': ACCEPT_ABAPGIT_REPOS_V2 },
    ...NEW_FORM,
  };
}
