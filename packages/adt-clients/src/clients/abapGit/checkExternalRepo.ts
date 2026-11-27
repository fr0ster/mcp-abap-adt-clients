import type {
  IAbapGitCredentials,
  IAbapGitExternalRepoArgs,
  IAdtHeaders,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';
import { NEW_FORM } from './newForm';
import { ABAPGIT_EXTERNAL_REPO_INFO } from './paths';
import { buildExternalRepoRequestBody } from './xmlBuilder';

/**
 * R13, the new form: the credential in `user` / `password`, the fields SAP
 * reads — the defect of the deprecated form (`remoteUser`, ignored) fixed.
 */
export function checkExternalRepoRequest(
  headers: IAdtHeaders,
  args: IAbapGitExternalRepoArgs,
  credentials: IAbapGitCredentials | null,
): IAbapRequestOptions {
  return {
    method: 'POST',
    url: ABAPGIT_EXTERNAL_REPO_INFO,
    headers: requestHeaders(headers),
    data: buildExternalRepoRequestBody({ url: args.url }, credentials),
    ...NEW_FORM,
  };
}
