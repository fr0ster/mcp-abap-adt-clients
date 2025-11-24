/**
 * Function Group validation
 * Uses ADT validation endpoint: /sap/bc/adt/functions/groups/validation
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Validate function group name
 * Returns raw response from ADT - consumer decides how to interpret it
 * 
 * Endpoint: POST /sap/bc/adt/functions/groups/validation
 * 
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message (e.g., "Function group ... already exists")
 */
export async function validateFunctionGroupName(
  connection: AbapConnection,
  functionGroupName: string,
  description?: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/functions/groups/validation`;
  const encodedName = encodeSapObjectName(functionGroupName);
  
  const queryParams = new URLSearchParams({
    objtype: 'fugr',
    objname: encodedName
  });

  if (description) {
    queryParams.append('description', description);
  }

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.as+xml'
    }
  });
}
