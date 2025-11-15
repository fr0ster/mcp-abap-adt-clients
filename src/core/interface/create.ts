/**
 * Interface create operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockInterface } from './lock';
import { unlockInterface } from './unlock';
import { activateInterface } from './activation';
import { getSystemInformation } from '../shared/systemInfo';
import { CreateInterfaceParams } from './types';

/**
 * Generate minimal interface source code if not provided
 */
function generateInterfaceTemplate(interfaceName: string, description: string): string {
  return `INTERFACE ${interfaceName}
  PUBLIC.

  " ${description}

  METHODS: get_value
    RETURNING VALUE(rv_result) TYPE string.

ENDINTERFACE.`;
}

/**
 * Create interface object with metadata
 */
async function createInterfaceObject(
  connection: AbapConnection,
  interfaceName: string,
  description: string,
  packageName: string,
  transportRequest: string | undefined,
  sessionId: string,
  masterSystem?: string,
  responsible?: string
): Promise<void> {
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

  await makeAdtRequestWithSession(
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
 * Upload interface source code
 */
async function uploadInterfaceSource(
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

/**
 * Create ABAP interface
 * Full workflow: create object -> lock -> upload source -> unlock -> activate
 */
export async function createInterface(
  connection: AbapConnection,
  params: CreateInterfaceParams
): Promise<AxiosResponse> {
  if (!params.interface_name || !params.package_name) {
    throw new Error('interface_name and package_name are required');
  }

  const finalDescription = params.description || params.interface_name;
  const finalSourceCode = params.source_code || generateInterfaceTemplate(params.interface_name, finalDescription);

  const sessionId = generateSessionId();
  let lockHandle: string | undefined;

  try {
    // Step 1: Create interface object with metadata
    await createInterfaceObject(
      connection,
      params.interface_name,
      finalDescription,
      params.package_name,
      params.transport_request,
      sessionId,
      params.master_system,
      params.responsible
    );

    // Step 2: Lock interface
    const lockData = await lockInterface(connection, params.interface_name, sessionId);
    lockHandle = lockData.lockHandle;
    const corrNr = lockData.corrNr;

    // Step 3: Upload source code
    await uploadInterfaceSource(
      connection,
      params.interface_name,
      finalSourceCode,
      lockHandle,
      corrNr,
      sessionId
    );

    // Step 4: Unlock interface
    await unlockInterface(connection, params.interface_name, lockHandle, sessionId);
    lockHandle = undefined;

    // Step 5: Activate interface (optional)
    let activationResult;
    const shouldActivate = params.activate !== false;
    if (shouldActivate) {
      const activateResponse = await activateInterface(connection, params.interface_name, sessionId);

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
      });
      activationResult = parser.parse(activateResponse.data);
    }

    // Return success response
    return {
      data: {
        success: true,
        interface_name: params.interface_name,
        package_name: params.package_name,
        transport_request: params.transport_request || 'local',
        activated: shouldActivate,
        activation_result: activationResult,
        message: `Interface ${params.interface_name} created successfully${shouldActivate ? ' and activated' : ''}`
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    // Attempt to unlock if we have a lock handle
    if (lockHandle) {
      try {
        await unlockInterface(connection, params.interface_name, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create interface ${params.interface_name}: ${errorMessage}`);
  }
}

