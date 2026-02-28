/**
 * Function Group validation
 * Uses ADT validation endpoint: /sap/bc/adt/functions/validation
 * Matches Eclipse ADT behavior for on-premise and cloud systems
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  encodeSapObjectName,
  limitDescription,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate function group name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/functions/validation
 * (same endpoint for both function groups and function modules)
 *
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message (e.g., "Function group ... already exists")
 */
export async function validateFunctionGroupName(
  connection: IAbapConnection,
  functionGroupName: string,
  packageName?: string,
  description?: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/functions/validation`;
  const encodedName = encodeSapObjectName(functionGroupName);

  const queryParams = new URLSearchParams({
    objtype: 'FUGR/F',
    objname: encodedName,
  });

  if (packageName) {
    queryParams.append('packagename', encodeSapObjectName(packageName));
  }

  // Description is limited to 60 characters in SAP ADT
  const limitedDescription = description
    ? limitDescription(description)
    : encodedName;
  if (description) {
    queryParams.append('description', limitedDescription);
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
