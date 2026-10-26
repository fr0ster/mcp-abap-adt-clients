import type {
  IAbapGitLinkArgs,
  IAdtHeaders,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';
import { buildLinkBody } from './xmlBuilder';

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
