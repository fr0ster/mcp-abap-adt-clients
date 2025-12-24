/**
 * Service Definition validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/srvd/sources/validation
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate service definition name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/srvd/sources/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <CHECK_RESULT/> or error response
 */
export async function validateServiceDefinitionName(
  connection: IAbapConnection,
  serviceDefinitionName: string,
  description?: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/srvd/sources/validation`;
  const encodedName = encodeSapObjectName(serviceDefinitionName);

  const queryParams = new URLSearchParams({
    objtype: 'srvdsrv',
    objname: encodedName,
  });

  if (description) {
    queryParams.append('description', description);
  }

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.as+xml',
    },
  });
}
