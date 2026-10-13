import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { STRUCTURE } from '../../endpoints/objects';

export async function unlockAppendStructure(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${STRUCTURE.uri(name)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
  });
}
