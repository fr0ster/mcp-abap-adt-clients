/**
 * Interface create operations - Low-level functions (1 function = 1 HTTP request)
 *
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { limitDescription } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateInterfaceParams } from './types';

/**
 * Generate minimal interface source code if not provided
 */
export function generateInterfaceTemplate(
  interfaceName: string,
  description: string,
): string {
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
  connection: IAbapConnection,
  params: ICreateInterfaceParams,
): Promise<AxiosResponse> {
  // Get system information - only for cloud systems
  const systemInfo = await getSystemInformation(connection);

  let finalMasterSystem = params.masterSystem;
  let finalResponsible = params.responsible;

  if (systemInfo) {
    // Only for cloud systems - use systemInfo or provided values
    finalMasterSystem = finalMasterSystem || systemInfo.systemID;
    finalResponsible = finalResponsible || systemInfo.userName;
  } else {
    // For non-cloud systems - don't add these attributes
    finalMasterSystem = '';
    finalResponsible = '';
  }

  // Description is limited to 60 characters in SAP ADT
  const limitedDescription = limitDescription(params.description);
  const masterSystemAttr = finalMasterSystem
    ? ` adtcore:masterSystem="${finalMasterSystem}"`
    : '';
  const responsibleAttr = finalResponsible
    ? ` adtcore:responsible="${finalResponsible}"`
    : '';

  const payload = `<?xml version="1.0" encoding="UTF-8"?><intf:abapInterface xmlns:intf="http://www.sap.com/adt/oo/interfaces" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}" adtcore:language="EN" adtcore:name="${params.interfaceName}" adtcore:type="INTF/OI" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>



  <adtcore:packageRef adtcore:name="${params.packageName}"/>



</intf:abapInterface>`;

  const url = `/sap/bc/adt/oo/interfaces${params.transportRequest ? `?corrNr=${params.transportRequest}` : ''}`;

  const headers = {
    'Content-Type': 'application/vnd.sap.adt.oo.interfaces.v5+xml',
    Accept: 'application/vnd.sap.adt.oo.interfaces.v5+xml',
  };

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      data: payload,
      headers,
    });

    // Verify response status - should be 201 Created
    if (response.status !== 201 && response.status !== 200) {
      const errorData =
        typeof response.data === 'string'
          ? response.data.substring(0, 1000)
          : JSON.stringify(response.data).substring(0, 1000);
      console.error(
        `[ERROR] Create interface returned unexpected status - Status: ${response.status}`,
      );
      console.error(`[ERROR] Create interface - Response data:`, errorData);
      throw new Error(
        `Interface creation returned status ${response.status} instead of 201`,
      );
    }

    return response;
  } catch (error: any) {
    // Log error details for debugging (similar to class create)
    if (error.response) {
      const errorData =
        typeof error.response.data === 'string'
          ? error.response.data.substring(0, 1000)
          : JSON.stringify(error.response.data).substring(0, 1000);
      console.error(
        `[ERROR] Create interface failed - Status: ${error.response.status}`,
      );
      console.error(
        `[ERROR] Create interface failed - StatusText: ${error.response.statusText}`,
      );
      console.error(
        `[ERROR] Create interface failed - Response data:`,
        errorData,
      );
    }
    throw error;
  }
}
