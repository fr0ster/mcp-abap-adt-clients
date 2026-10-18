/**
 * FunctionGroup activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_GROUP } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Activate function group
 */
export async function activateFunctionGroup(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  functionGroupName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${FUNCTION_GROUP.uri(functionGroupName)}`;

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${objectUri}" adtcore:name="${functionGroupName}"/>
</adtcore:objectReferences>`;

  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlPayload,
    headers: requestHeaders(headers),
  });
  return response;
}
