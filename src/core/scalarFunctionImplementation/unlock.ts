import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { SCALAR_FUNCTION_IMPLEMENTATION } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

export async function unlockScalarFunctionImplementation(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${SCALAR_FUNCTION_IMPLEMENTATION.uri(name)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
