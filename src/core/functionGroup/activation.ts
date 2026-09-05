/**
 * FunctionGroup activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate function group
 */
export async function activateFunctionGroup(
  connection: IAbapConnection,
  functionGroupName: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(functionGroupName).toLowerCase();
  const objectUri = `/sap/bc/adt/functions/groups/${encodedName}`;

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${objectUri}" adtcore:name="${functionGroupName}"/>
</adtcore:objectReferences>`;

  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 30000, // 30 seconds for activation
    data: xmlPayload,
    headers: {
      'Content-Type': 'application/xml',
      Accept: 'application/xml',
    },
  });
  return response;
}
