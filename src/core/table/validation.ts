/**
 * Table validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/tables/validation
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate table name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/tables/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export async function validateTableName(
  connection: IAbapConnection,
  tableName: string,
  description?: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/tables/validation`;
  const encodedName = encodeSapObjectName(tableName);

  const queryParams = new URLSearchParams({
    objtype: 'tabldt',
    objname: encodedName,
  });

  // Description is required for table validation
  queryParams.append('description', description || '');

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.as+xml',
    },
  });
}
