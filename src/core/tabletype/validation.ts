/**
 * TableType validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/tabletypes/validation
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate table type name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/tabletypes/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export async function validateTableTypeName(
  connection: IAbapConnection,
  tableTypeName: string,
  description?: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/tabletypes/validation`;
  const encodedName = encodeSapObjectName(tableTypeName);

  const queryParams = new URLSearchParams({
    objtype: 'ttypda',
    objname: encodedName,
  });

  // Description is required for table type validation
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
