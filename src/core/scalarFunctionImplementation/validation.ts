import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { SCALAR_FUNCTION_IMPLEMENTATION } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate DSFI name. Endpoint confirmed present in system discovery
 * (category dsfisfi/validation): POST /sap/bc/adt/ddic/dsfi/validation?objtype=dsfisfi
 */
export async function validateScalarFunctionImplementationName(
  connection: IAbapConnection,
  name: string,
  description?: string,
): Promise<IAdtWireResponse> {
  const queryParams = new URLSearchParams({
    objtype: 'dsfisfi',
    objname: name,
  });
  if (description) queryParams.append('description', description);
  return connection.makeAdtRequest({
    url: `${SCALAR_FUNCTION_IMPLEMENTATION.validation}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VALIDATION },
  });
}
