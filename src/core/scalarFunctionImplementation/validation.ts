import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate DSFI name. Endpoint confirmed present in system discovery
 * (category dsfisfi/validation): POST /sap/bc/adt/ddic/dsfi/validation?objtype=dsfisfi
 */
export async function validateScalarFunctionImplementationName(
  connection: IAbapConnection,
  name: string,
  description?: string,
): Promise<AxiosResponse> {
  const queryParams = new URLSearchParams({
    objtype: 'dsfisfi',
    objname: name,
  });
  if (description) queryParams.append('description', description);
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/ddic/dsfi/validation?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VALIDATION },
  });
}
