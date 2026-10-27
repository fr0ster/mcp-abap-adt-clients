import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { SCALAR_FUNCTION } from '../../endpoints/objects';

export async function unlockScalarFunction(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${SCALAR_FUNCTION.uri(name)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
  });
}
