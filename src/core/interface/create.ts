/**
 * Interface create operations - Low-level functions (1 function = 1 HTTP request)
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { getSystemInformation } from '../shared/systemInfo';

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
  sessionId: string,
  masterSystem?: string,
  responsible?: string
): Promise<AxiosResponse> {
  // Get masterSystem and responsible (only for cloud systems)
  // On cloud, getSystemInformation returns systemID and userName
  // On on-premise, it returns null, so we don't add these attributes
  let finalMasterSystem = masterSystem;
  let finalResponsible = responsible;

  const systemInfo = await getSystemInformation(connection);
  if (systemInfo) {
    finalMasterSystem = finalMasterSystem || systemInfo.systemID;
    finalResponsible = finalResponsible || systemInfo.userName;
  }

  // Only use masterSystem from getSystemInformation (cloud), not from env
  // username can fallback to env if not provided
  finalResponsible = finalResponsible || process.env.SAP_USERNAME || process.env.SAP_USER || '';

  const masterSystemAttr = finalMasterSystem ? ` adtcore:masterSystem="${finalMasterSystem}"` : '';
  const responsibleAttr = finalResponsible ? ` adtcore:responsible="${finalResponsible}"` : '';

  const payload = `<?xml version="1.0" encoding="UTF-8"?><intf:abapInterface xmlns:intf="http://www.sap.com/adt/oo/interfaces" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${interfaceName}" adtcore:type="INTF/OI" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>



  <adtcore:packageRef adtcore:name="${packageName}"/>



</intf:abapInterface>`;

  const url = `/sap/bc/adt/oo/interfaces`;
  const params = transportRequest ? `?corrNr=${transportRequest}` : '';

  return makeAdtRequestWithSession(
    connection,
    url + params,
    'POST',
    sessionId,
    payload,
    {
      'Content-Type': 'application/vnd.sap.adt.oo.interfaces.v5+xml',
      'Accept': 'application/vnd.sap.adt.oo.interfaces.v5+xml'
    }
  );
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
  corrNr: string | undefined,
  sessionId: string
): Promise<void> {
  let url = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName)}/source/main?lockHandle=${lockHandle}`;
  if (corrNr) {
    url += `&corrNr=${corrNr}`;
  }

  await makeAdtRequestWithSession(
    connection,
    url,
    'PUT',
    sessionId,
    sourceCode,
    { 'Content-Type': 'text/plain; charset=utf-8' }
  );
}
