import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TRANSFORMATION } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Build activation XML payload
 */
function buildActivationXml(transformationName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${TRANSFORMATION.uri(transformationName)}" adtcore:name="${transformationName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

/**
 * Parse activation response
 */

/**
 * Activate transformation
 */
export async function activateTransformation(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  transformationName: string,
): Promise<IAdtWireResponse> {
  const url = '/sap/bc/adt/activation?method=activate&preauditRequested=true';
  const xmlBody = buildActivationXml(transformationName);

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });

  return response;
}
