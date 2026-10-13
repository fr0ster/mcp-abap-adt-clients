import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { SCALAR_FUNCTION } from '../../endpoints/objects';

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
    timeout: 0,
    headers: { Accept: ACCEPT_VALIDATION },
  });
}
