import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_ABAPGIT_REPOS_V2 } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/** Every linked repository — `GET /abapgit/repos`, answered as it arrived. */
export async function listRepos(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'GET',
    url: '/sap/bc/adt/abapgit/repos',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_ABAPGIT_REPOS_V2 },
  });
}
