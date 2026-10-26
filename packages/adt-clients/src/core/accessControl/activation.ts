import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCESS_CONTROL } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Build activation XML payload
 */
function buildActivationXml(accessControlName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${ACCESS_CONTROL.uri(accessControlName)}" adtcore:name="${accessControlName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

/**
 * Parse activation response
 */

/**
 * Activate access control
 */
export async function activateAccessControl(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  accessControlName: string,
): Promise<IAdtWireResponse> {
  const url = '/sap/bc/adt/activation?method=activate&preauditRequested=true';
  const xmlBody = buildActivationXml(accessControlName);

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });

  return response;
}
