/**
 * The settings' own lock: ESDICT `TABT`, which the table's lock does not
 * cover.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { TABLE_SETTINGS } from '../../endpoints/objects';

/** `POST …?_action=LOCK&accessMode=MODIFY` — answered as it arrived. */
export async function lockTableSettings(
  connection: IAbapConnection,
  tableName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TABLE_SETTINGS.uri(tableName)}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: 0,
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}
