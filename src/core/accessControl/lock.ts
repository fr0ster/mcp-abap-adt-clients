/**
 * Access control lock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { ACCESS_CONTROL } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * `POST …?_action=LOCK` — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member. Until 23.0.0 this parsed
 * it and threw when SAP's answer had none, which turned a statement about SAP's
 * answer into a library failure and dropped the answer.
 */
export async function lockAccessControl(
  connection: IAbapConnection,
  accessControlName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'POST',
    url: `${ACCESS_CONTROL.uri(accessControlName.toLowerCase())}?_action=LOCK&accessMode=MODIFY`,
    headers: { Accept: ACCEPT_LOCK },
    timeout: getTimeout('default'),
  });
}
