/**
 * FunctionModule create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { lockFunctionModule } from './lock';
import { unlockFunctionModule } from './unlock';
import { activateFunctionModule } from './activation';
import { CreateFunctionModuleParams } from './types';
import { getFunctionGroup } from '../functionGroup/read';
import { create as createFunctionGroupLowLevel } from '../functionGroup/create';
import { activateFunctionGroup } from '../functionGroup/activation';
import { validateFunctionModuleName } from './validation';

/**
 * Create function module metadata
 * Low-level function - creates metadata without workflow logic
 */
export async function create(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  description: string,
  corrNr: string | undefined
): Promise<AxiosResponse> {
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();

  let url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules${corrNr ? `?corrNr=${corrNr}` : ''}`;

  // Get masterSystem and responsible (only for cloud systems)
  // On cloud, getSystemInformation returns systemID and userName
  // On on-premise, it returns null, so we don't add these attributes
  const systemInfo = await getSystemInformation(connection);
  const masterSystem = systemInfo?.systemID;
  const username = systemInfo?.userName || process.env.SAP_USER || process.env.SAP_USERNAME || 'MPCUSER';

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:name="${functionModuleName}" adtcore:type="FUGR/FF"${masterSystemAttr}${responsibleAttr}>
  <adtcore:containerRef adtcore:name="${functionGroupName}" adtcore:type="FUGR/F" adtcore:uri="/sap/bc/adt/functions/groups/${encodedGroupName}"/>
</fmodule:abapFunctionModule>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      'Content-Type': 'application/vnd.sap.adt.functions.fmodules+xml',
      'Accept': 'application/vnd.sap.adt.functions.fmodules+xml'
    }
  });
}