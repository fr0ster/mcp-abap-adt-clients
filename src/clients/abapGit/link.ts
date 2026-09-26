import type { IAbapGitLinkArgs } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  CT_ABAPGIT_REPO_V3,
  CT_ABAPGIT_REPO_V4,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import { buildLinkBody } from './xmlBuilder';

export async function linkRepo(
  connection: IAbapConnection,
  args: IAbapGitLinkArgs,
  contentTypeVersion: 'v3' | 'v4' = 'v3',
): Promise<IAdtWireResponse> {
  const ct =
    contentTypeVersion === 'v4' ? CT_ABAPGIT_REPO_V4 : CT_ABAPGIT_REPO_V3;
  return connection.makeAdtRequest({
    method: 'POST',
    url: '/sap/bc/adt/abapgit/repos',
    timeout: getTimeout('default'),
    headers: { 'Content-Type': ct, Accept: ct },
    data: buildLinkBody(args),
  });
}
