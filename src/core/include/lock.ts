/**
 * Include lock — the include itself is the lock target.
 *
 * Not the main program it is included in: the captured exchange locks
 * `/programs/includes/{name}`, and the source is written under that handle.
 * This is the opposite of class includes, where the CLASS is what gets locked.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

function includeUrl(includeName: string): string {
  return `/sap/bc/adt/programs/includes/${encodeSapObjectName(includeName).toLowerCase()}`;
}

/**
 * `POST …?_action=LOCK` — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member. Until 23.0.0 this parsed
 * it (and `CORRNR`, which nothing read) and threw when SAP's answer had no
 * handle, which turned a statement about SAP's answer into a library failure
 * and dropped the answer.
 */
export async function lockInclude(
  connection: IAbapConnection,
  includeName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${includeUrl(includeName)}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}

export { includeUrl };
