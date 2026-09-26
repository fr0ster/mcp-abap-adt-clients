/**
 * Package lock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * `POST …?_action=LOCK` — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member. Until 23.0.0 this parsed
 * it (and `CORR_NUMBER`, which nothing read) and threw when SAP's answer had no
 * handle, which turned a statement about SAP's answer into a library failure
 * and dropped the answer.
 *
 * NOTE: the member runs this inside a stateful session.
 */
export async function lockPackage(
  connection: IAbapConnection,
  packageName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/packages/${encodeSapObjectName(packageName.toLowerCase())}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}
