/**
 * DataElement activation operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Build activation XML payload
 */
function buildActivationXml(dataElementName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/dataelements/${encodeSapObjectName(dataElementName.toLowerCase())}" adtcore:name="${dataElementName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

/**
 * Parse activation response
 */
function parseActivationResponse(response: AxiosResponse): { success: boolean; message: string } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  try {
    const result = parser.parse(response.data);
    const properties = result['chkl:messages']?.['chkl:properties'];

    if (properties) {
      const activated = properties['activationExecuted'] === 'true' || properties['activationExecuted'] === true;
      const checked = properties['checkExecuted'] === 'true' || properties['checkExecuted'] === true;

      return {
        success: activated && checked,
        message: activated ? 'Data element activated successfully' : 'Activation failed'
      };
    }

    return { success: false, message: 'Unknown activation status' };
  } catch (error) {
    return { success: false, message: `Failed to parse activation response: ${error}` };
  }
}

/**
 * Activate data element
 * Makes data element active and usable in SAP system
 */
export async function activateDataElement(
  connection: IAbapConnection,
  dataElementName: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
  const xmlBody = buildActivationXml(dataElementName);

  const headers = {
    'Accept': 'application/xml',
    'Content-Type': 'application/xml'
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers
  });

  const activationResult = parseActivationResponse(response);
  if (!activationResult.success) {
    throw new Error(`Data element activation failed: ${activationResult.message}`);
  }

  return response;
}