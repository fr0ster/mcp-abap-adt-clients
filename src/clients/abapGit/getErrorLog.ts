import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_ABAPGIT_REPO_OBJECT_V2 } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * A run's error log — one GET to the `log_link` `listRepos` reported.
 *
 * Until interfaces-adt 11 this took a package, listed every repository to find
 * the link, and threw "not found" when the package was not in the list: two
 * requests, and a sentence SAP never said (decision 37).
 */
export async function getErrorLog(
  connection: IAbapConnection,
  logLink: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'GET',
    url: logLink,
    timeout: getTimeout('default'),
    headers: { Accept: CT_ABAPGIT_REPO_OBJECT_V2 },
  });
}
