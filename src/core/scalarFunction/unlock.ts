import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function unlockScalarFunction(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
