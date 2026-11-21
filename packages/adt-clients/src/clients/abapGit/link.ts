import type {
  IAbapGitCredentials,
  IAbapGitLinkArgs,
  IAbapGitLinkNewArgs,
  IAdtHeaders,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';
import { NEW_FORM } from './newForm';
import { ABAPGIT_REPOS } from './paths';
import { buildLinkBody, buildLinkBodyNew } from './xmlBuilder';

export async function linkRepo(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: IAbapGitLinkArgs,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'POST',
    url: '/sap/bc/adt/abapgit/repos',
    timeout: 0,
    headers: requestHeaders(headers),
    data: buildLinkBody(args),
  });
}

/** R2, the new form: the credential in the body, the caller's media types. */
export function linkRequest(
  headers: IAdtHeaders,
  args: IAbapGitLinkNewArgs,
  credentials: IAbapGitCredentials | null,
): IAbapRequestOptions {
  return {
    method: 'POST',
    url: ABAPGIT_REPOS,
    headers: requestHeaders(headers),
    data: buildLinkBodyNew(args, credentials),
    ...NEW_FORM,
  };
}
