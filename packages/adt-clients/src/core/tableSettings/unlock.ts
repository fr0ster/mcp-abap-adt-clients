/**
 * Release the settings' lock with its handle, in the stateful session the
 * lock was taken in, as every UNLOCK of this library is sent; that SAP
 * refuses another session is not measured here.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TABLE_SETTINGS } from '../../endpoints/objects';

/** `POST …?_action=UNLOCK&lockHandle=…`. */
export async function unlockTableSettings(
  connection: IAbapConnection,
  tableName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TABLE_SETTINGS.uri(tableName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
    method: 'POST',
    timeout: 0,
    data: null,
    headers: {},
  });
}
