import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_ABAPGIT_EXTERNAL_REPO_INFO_RESPONSE_V2,
  CT_ABAPGIT_EXTERNAL_REPO_INFO_REQUEST_V2,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import type {
  IAbapGitExternalRepoCredentials,
  IAbapGitExternalRepoInfo,
} from './types';
import { buildExternalRepoInfoBody } from './xmlBuilder';
import { parseExternalRepoInfo } from './xmlParser';

export async function checkExternalRepo(
  connection: IAbapConnection,
  args: IAbapGitExternalRepoCredentials,
): Promise<IAbapGitExternalRepoInfo> {
  // Phase Z confirmed: request/response use DIFFERENT media-type families.
  //   Content-Type = application/abapgit.adt.repo.info.ext.request.v2+xml
  //   Accept       = application/abapgit.adt.repo.info.ext.response.v2+xml
  const resp = await connection.makeAdtRequest({
    method: 'POST',
    url: '/sap/bc/adt/abapgit/externalrepoinfo',
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_ABAPGIT_EXTERNAL_REPO_INFO_REQUEST_V2,
      Accept: ACCEPT_ABAPGIT_EXTERNAL_REPO_INFO_RESPONSE_V2,
    },
    data: buildExternalRepoInfoBody(args),
  });
  return parseExternalRepoInfo(String(resp.data));
}
