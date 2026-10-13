/**
 * Table lock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { TABLE } from '../../endpoints/objects';

/**
 * `POST …?_action=LOCK` — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member. Until 23.0.0 this parsed
 * it and threw when SAP's answer had none, which turned a statement about SAP's
 * answer into a library failure and dropped the answer.
 */
export async function lockTable(
  connection: IAbapConnection,
  tableName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TABLE.uri(tableName)}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: 0,
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}
