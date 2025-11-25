/**
 * Interface create operations - Low-level functions (1 function = 1 HTTP request)
 * 
 * NOTE: Builder should call connection.setSessionType("stateful") before creating
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';

/**
 * Generate minimal interface source code if not provided
 */
export function generateInterfaceTemplate(interfaceName: string, description: string): string {
  return `INTERFACE ${interfaceName}
  PUBLIC.

  " ${description}

  METHODS: get_value
    RETURNING VALUE(rv_result) TYPE string.

ENDINTERFACE.`;
}

/**
 * Low-level: Create interface object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 */
export async function create(
  connection: AbapConnection,
  interfaceName: string,
  description: string,
  packageName: string,
  transportRequest: string | undefined,
  masterSystem?: string,
  responsible?: string
): Promise<AxiosResponse> {
  // Get system information - only for cloud systems
  const systemInfo = await getSystemInformation(connection);
  
  let finalMasterSystem = masterSystem;
  let finalResponsible = responsible;

  if (systemInfo) {
    // Only for cloud systems - use systemInfo or provided values
    finalMasterSystem = finalMasterSystem || systemInfo.systemID;
    finalResponsible = finalResponsible || systemInfo.userName;
  } else {
    // For non-cloud systems - don't add these attributes
    finalMasterSystem = '';
    finalResponsible = '';
  }

  const masterSystemAttr = finalMasterSystem ? ` adtcore:masterSystem="${finalMasterSystem}"` : '';
  const responsibleAttr = finalResponsible ? ` adtcore:responsible="${finalResponsible}"` : '';

  const payload = `<?xml version="1.0" encoding="UTF-8"?><intf:abapInterface xmlns:intf="http://www.sap.com/adt/oo/interfaces" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${interfaceName}" adtcore:type="INTF/OI" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>



  <adtcore:packageRef adtcore:name="${packageName}"/>



</intf:abapInterface>`;

  const url = `/sap/bc/adt/oo/interfaces${transportRequest ? `?corrNr=${transportRequest}` : ''}`;

  const headers = {
    'Content-Type': 'application/vnd.sap.adt.oo.interfaces.v5+xml',
    'Accept': 'application/vnd.sap.adt.oo.interfaces.v5+xml'
  };

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      data: payload,
      headers
    });
    
    // Verify response status - should be 201 Created
    if (response.status !== 201 && response.status !== 200) {
      const errorData = typeof response.data === 'string'
        ? response.data.substring(0, 1000)
        : JSON.stringify(response.data).substring(0, 1000);
      console.error(`[ERROR] Create interface returned unexpected status - Status: ${response.status}`);
      console.error(`[ERROR] Create interface - Response data:`, errorData);
      throw new Error(`Interface creation returned status ${response.status} instead of 201`);
    }
    
    return response;
  } catch (error: any) {
    // Log error details for debugging (similar to class create)
    if (error.response) {
      const errorData = typeof error.response.data === 'string'
        ? error.response.data.substring(0, 1000)
        : JSON.stringify(error.response.data).substring(0, 1000);
      console.error(`[ERROR] Create interface failed - Status: ${error.response.status}`);
      console.error(`[ERROR] Create interface failed - StatusText: ${error.response.statusText}`);
      console.error(`[ERROR] Create interface failed - Response data:`, errorData);
    }
    throw error;
  }
}

/**
 * Low-level: Upload interface source code (PUT)
 * Requires lock handle - does NOT lock/unlock
 */
export async function upload(
  connection: AbapConnection,
  interfaceName: string,
  sourceCode: string,
  lockHandle: string,
  corrNr: string | undefined
): Promise<void> {
  let url = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName)}/source/main?lockHandle=${lockHandle}`;
  if (corrNr) {
    url += `&corrNr=${corrNr}`;
  }

  await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
