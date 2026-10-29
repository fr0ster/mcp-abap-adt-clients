/**
 * FunctionGroup activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_GROUP, sourceUri } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Activate function group.
 *
 * **Two references, one request.** A group's `source/main` is an activation
 * object of its own — the main program `FUGR/I SAPL<group>` — and activating
 * the group alone leaves both inactive in a transportable package (measured
 * 2026-10-29 on S/4HANA 2025; activating both together executes there, in
 * `$TMP`, and on ABAP cloud). So the request names the group and then its main
 * program.
 */
export async function activateFunctionGroup(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  functionGroupName: string,
): Promise<IAdtWireResponse> {
  const objectUri = FUNCTION_GROUP.uri(functionGroupName);
  const mainUri = sourceUri(objectUri);

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${objectUri}" adtcore:name="${functionGroupName}"/>
  <adtcore:objectReference adtcore:uri="${mainUri}" adtcore:type="FUGR/I" adtcore:name="SAPL${functionGroupName.toUpperCase()}"/>
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
