import type {
  IAbapGitExternalRepoCredentials,
  IAdtHeaders,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';
import { buildExternalRepoInfoBody } from './xmlBuilder';

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
