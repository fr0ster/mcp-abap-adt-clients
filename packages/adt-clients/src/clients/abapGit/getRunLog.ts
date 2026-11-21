import type { IAbapGitRunLogArgs } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_ABAPGIT_REPO_OBJECT_V2 } from '../../constants/contentTypes';
import { NEW_FORM } from './newForm';
import { repoPath } from './paths';

/**
 * R8: a run's log. SAP loads it by `appLogKey` alone (cloud
 * `RES_REPO_OBJ_LOG->get` L23), so pairing it with the key is the caller's.
 * It reads no credential, so none is sent.
 */
export function getRunLogRequest(
  args: IAbapGitRunLogArgs,
): IAbapRequestOptions {
  return {
    method: 'GET',
    url: repoPath(args.key, 'log', args.appLogKey),
    headers: { Accept: CT_ABAPGIT_REPO_OBJECT_V2 },
    ...NEW_FORM,
  };
}
