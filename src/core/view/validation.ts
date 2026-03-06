/**
 * View validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/ddl/validation
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate view name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddl/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export async function validateViewName(
  connection: IAbapConnection,
  viewName: string,
  packageName?: string,
  description?: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/ddl/validation`;
  const queryParams = new URLSearchParams({
    objtype: 'ddls',
    objname: viewName,
  });

  if (packageName) {
    queryParams.append('packagename', packageName);
  }

  // Description is required for view validation
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
