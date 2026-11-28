/** Type group LOCK: one `POST ?_action=LOCK&accessMode=MODIFY`. */
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { TYPE_GROUP } from '../../endpoints/objects';

export async function lockTypeGroup(
  connection: IAbapConnection,
  typeGroupName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TYPE_GROUP.uri(typeGroupName)}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: ACCEPT_LOCK },
  });
}
