/**
 * DataElement activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { DATA_ELEMENT } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Build activation XML payload
 */
function buildActivationXml(dataElementName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${DATA_ELEMENT.uri(dataElementName)}" adtcore:name="${dataElementName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

/**
 * Parse activation response
 */

/**
 * Activate data element
 * Makes data element active and usable in SAP system
 */
export async function activateDataElement(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  dataElementName: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
  const xmlBody = buildActivationXml(dataElementName);

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });

  return response;
}
