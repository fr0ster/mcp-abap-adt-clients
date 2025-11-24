/**
 * Program validation
 * Uses ADT validation endpoint: /sap/bc/adt/programs/validation
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Validate program name
 * Returns raw response from ADT - consumer decides how to interpret it
 * 
 * Endpoint: POST /sap/bc/adt/programs/validation
 * 
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export async function validateProgramName(
  connection: AbapConnection,
  programName: string,
  description?: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/programs/validation`;
  const encodedName = encodeSapObjectName(programName);
  
  const queryParams = new URLSearchParams({
    objtype: 'prog',
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
