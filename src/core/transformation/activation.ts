import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { assertActivationSucceeded } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Build activation XML payload
 */
function buildActivationXml(transformationName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/xslt/transformations/${encodeSapObjectName(transformationName.toLowerCase())}" adtcore:name="${transformationName.toUpperCase()}"/>
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
  transformationName: string,
): Promise<IAdtWireResponse> {
  const url = '/sap/bc/adt/activation?method=activate&preauditRequested=true';
  const xmlBody = buildActivationXml(transformationName);

  const headers = {
    Accept: 'application/xml',
    'Content-Type': 'application/xml',
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });

  assertActivationSucceeded('Transformation', response.data);

  return response;
}
