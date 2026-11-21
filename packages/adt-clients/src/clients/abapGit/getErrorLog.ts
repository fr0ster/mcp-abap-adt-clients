import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_ABAPGIT_REPO_OBJECT_V2 } from '../../constants/contentTypes';

/**
 * A run's error log — one GET to the `log_link` `listRepos` reported.
 *
 * Until interfaces-adt 11 this took a package, listed every repository to find
 * the link, and threw "not found" when the package was not in the list: two
 * requests, and a sentence SAP never said (decision 37).
 *
 * Since 46.2.0 the link is sent only when it is exactly the path `getRunLog`
 * would build (`/sap/bc/adt/abapgit/repos/{key}/log/{id}`): it is taken apart
 * and rebuilt, and anything else — an absolute URL, another host, a query —
 * is refused with nothing sent.
 */
export async function getErrorLog(
  connection: IAbapConnection,
  // The log link rebuilt by `logLinkPath`.
  url: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'GET',
    url,
    timeout: 0,
    headers: { Accept: CT_ABAPGIT_REPO_OBJECT_V2 },
  });
}
