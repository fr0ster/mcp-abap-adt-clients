/**
 * Function Group validation
 * Uses ADT validation endpoint: /sap/bc/adt/functions/groups/validation
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
 * Endpoint: POST /sap/bc/adt/functions/groups/validation
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
  const url = `/sap/bc/adt/functions/groups/validation`;
  const encodedName = encodeSapObjectName(functionGroupName);

  const queryParams = new URLSearchParams({
    objtype: 'fugr',
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

  // XML body required for validation
  const packageRef = packageName
    ? `  <adtcore:packageRef adtcore:name="${encodeSapObjectName(packageName)}"/>`
    : '';
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<group:abapFunctionGroup xmlns:group="http://www.sap.com/adt/functions/groups" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}" adtcore:language="EN" adtcore:name="${encodedName}" adtcore:type="FUGR/F" adtcore:masterLanguage="EN">
${packageRef}
</group:abapFunctionGroup>`;

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      'Content-Type': 'application/vnd.sap.adt.functions.groups.v2+xml',
      Accept: 'application/vnd.sap.as+xml',
    },
  });
}
