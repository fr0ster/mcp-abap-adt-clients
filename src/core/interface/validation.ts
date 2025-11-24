/**
 * Interface validation
 * Uses ADT validation endpoint: /sap/bc/adt/oo/interfaces/validation
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Validate interface name
 * Returns raw response from ADT - consumer decides how to interpret it
 * 
 * Endpoint: POST /sap/bc/adt/oo/interfaces/validation
 * 
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export async function validateInterfaceName(
  connection: AbapConnection,
  interfaceName: string,
  description?: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/oo/interfaces/validation`;
  const encodedName = encodeSapObjectName(interfaceName);
  
  const queryParams = new URLSearchParams({
    objtype: 'intf',
    objname: encodedName
  });

  if (description) {
    queryParams.append('description', description);
  }

  // XML body required for validation
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<intf:abapInterface xmlns:intf="http://www.sap.com/adt/oo/interfaces" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description || encodedName}" adtcore:language="EN" adtcore:name="${encodedName}" adtcore:type="INTF/OI" adtcore:masterLanguage="EN">
</intf:abapInterface>`;

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      'Content-Type': 'application/vnd.sap.adt.oo.interfaces.v5+xml',
      'Accept': 'application/vnd.sap.as+xml'
    }
  });
}
