/**
 * Program validation
 * Uses ADT validation endpoint: /sap/bc/adt/programs/validation
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

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
  connection: IAbapConnection,
  programName: string,
  description?: string,
  packageName?: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/programs/validation`;
  const encodedName = encodeSapObjectName(programName);

  const queryParams = new URLSearchParams({
    objname: encodedName,
    objtype: 'PROG/P',
  });

  if (packageName) {
    queryParams.append('packagename', packageName);
  }

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
