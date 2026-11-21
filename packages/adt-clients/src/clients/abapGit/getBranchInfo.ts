import type {
  IAbapGitBranchInfoArgs,
  IAbapGitCredentials,
  IAdtHeaders,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';
import { NEW_FORM } from './newForm';
import { ABAPGIT_BRANCH_INFO } from './paths';
import { buildExternalRepoRequestBody } from './xmlBuilder';

/**
 * R14 (cloud): one remote branch for a package. A write: SAP links the
 * repository to the package, reads `.abapgit`, deletes the link and commits.
 */
export function getBranchInfoRequest(
  headers: IAdtHeaders,
  args: IAbapGitBranchInfoArgs,
  credentials: IAbapGitCredentials | undefined,
): IAbapRequestOptions {
  return {
    method: 'POST',
    url: ABAPGIT_BRANCH_INFO,
    headers: requestHeaders(headers),
    data: buildExternalRepoRequestBody(
      { url: args.url, branch: args.branch, package: args.package },
      credentials ?? null,
    ),
    ...NEW_FORM,
  };
}
