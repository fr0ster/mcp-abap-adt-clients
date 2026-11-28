/** Type group UNLOCK: one `POST ?_action=UNLOCK&lockHandle=…`. */
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_GROUP } from '../../endpoints/objects';

export async function unlockTypeGroup(
  connection: IAbapConnection,
  typeGroupName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TYPE_GROUP.uri(typeGroupName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
    method: 'POST',
    timeout: 0,
  });
}
