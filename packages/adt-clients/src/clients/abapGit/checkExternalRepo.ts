import type {
  IAbapGitCredentials,
  IAbapGitExternalRepoArgs,
  IAbapGitExternalRepoCredentials,
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
import {
  buildExternalRepoInfoBody,
  buildExternalRepoRequestBody,
} from './xmlBuilder';

export async function checkExternalRepo(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: IAbapGitExternalRepoCredentials,
): Promise<IAdtWireResponse> {
  // Phase Z confirmed: request/response use DIFFERENT media-type families.
  //   Content-Type = application/abapgit.adt.repo.info.ext.request.v2+xml
  //   Accept       = application/abapgit.adt.repo.info.ext.response.v2+xml
  return connection.makeAdtRequest({
    method: 'POST',
    url: '/sap/bc/adt/abapgit/externalrepoinfo',
    timeout: 0,
    headers: requestHeaders(headers),
    data: buildExternalRepoInfoBody(args),
  });
}

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
