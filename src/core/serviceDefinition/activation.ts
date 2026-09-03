/**
 * ServiceDefinition activation operations
 */

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
function buildActivationXml(serviceDefinitionName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/srvd/sources/${encodeSapObjectName(serviceDefinitionName.toLowerCase())}" adtcore:name="${serviceDefinitionName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

/**
 * Parse activation response
 */

/**
 * Activate service definition
 * Makes service definition active and usable in SAP system
 */
export async function activateServiceDefinition(
  connection: IAbapConnection,
  serviceDefinitionName: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
  const xmlBody = buildActivationXml(serviceDefinitionName);

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

  assertActivationSucceeded('Service definition', response.data);

  return response;
}
