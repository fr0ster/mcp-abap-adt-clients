/**
 * Domain validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/domains/validation
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate domain name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/domains/validation
 *
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message
 */
export async function validateDomainName(
  connection: IAbapConnection,
  domainName: string,
  packageName?: string,
  description?: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/domains/validation`;
  const queryParams = new URLSearchParams({
    objtype: 'doma',
    objname: domainName,
  });

  if (packageName) {
    queryParams.append('packagename', packageName);
  }

  // Description is required for domain validation
  queryParams.append('description', description || '');

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_VALIDATION,
    },
  });
}
