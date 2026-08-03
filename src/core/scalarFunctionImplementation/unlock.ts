import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function unlockScalarFunctionImplementation(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `/sap/bc/adt/ddic/dsfi/${encoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
