import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TRANSFORMATION } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock transformation
 * Must use same session and lock handle from lock operation
 */
export async function unlockTransformation(
  connection: IAbapConnection,
  transformationName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${TRANSFORMATION.uri(transformationName.toLowerCase())}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
