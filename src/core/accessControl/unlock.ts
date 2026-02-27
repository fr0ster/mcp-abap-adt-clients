import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock access control
 * Must use same session and lock handle from lock operation
 */
export async function unlockAccessControl(
  connection: IAbapConnection,
  accessControlName: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  const accessControlNameEncoded = encodeSapObjectName(
    accessControlName.toLowerCase(),
  );
  const url = `/sap/bc/adt/acm/dcl/sources/${accessControlNameEncoded}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
