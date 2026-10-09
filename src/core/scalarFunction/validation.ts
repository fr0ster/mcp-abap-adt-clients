import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { SCALAR_FUNCTION } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

export async function validateScalarFunctionName(
  connection: IAbapConnection,
  name: string,
  description?: string,
): Promise<IAdtWireResponse> {
  const queryParams = new URLSearchParams({
    objtype: 'dsfdscf',
    objname: name,
  });
  if (description) queryParams.append('description', description);
  return connection.makeAdtRequest({
    url: `${SCALAR_FUNCTION.validation}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VALIDATION },
  });
}
