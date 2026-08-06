import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { assertActivationSucceeded } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Build activation XML payload
 */
function buildActivationXml(accessControlName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/acm/dcl/sources/${encodeSapObjectName(accessControlName.toLowerCase())}" adtcore:name="${accessControlName.toUpperCase()}"/>
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
  accessControlName: string,
): Promise<IAdtResponse> {
  const url = '/sap/bc/adt/activation?method=activate&preauditRequested=true';
  const xmlBody = buildActivationXml(accessControlName);

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

  assertActivationSucceeded('Access control', response.data);

  return response;
}
