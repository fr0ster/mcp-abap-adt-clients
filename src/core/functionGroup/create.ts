/**
 * FunctionGroup create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getSystemInformation } from '../shared/systemInfo';
import { activateFunctionGroup } from './activation';
import { CreateFunctionGroupParams } from './types';

/**
 * Create function group metadata via POST
 * Low-level function - creates function group without workflow logic
 */
export async function create(
  connection: AbapConnection,
  functionGroupName: string,
  description: string,
  packageName: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const url = `${baseUrl}/sap/bc/adt/functions/groups${transportRequest ? `?corrNr=${transportRequest}` : ''}`;

  // Get masterSystem and responsible (only for cloud systems)
  // On cloud, getSystemInformation returns systemID and userName
  // On on-premise, it returns null, so we don't add these attributes
  const systemInfo = await getSystemInformation(connection);
  const masterSystem = systemInfo?.systemID;
  const username = systemInfo?.userName || process.env.SAP_USERNAME || process.env.SAP_USER || '';

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<group:abapFunctionGroup xmlns:group="http://www.sap.com/adt/functions/groups" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${functionGroupName}" adtcore:type="FUGR/F" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${packageName}"/>
</group:abapFunctionGroup>`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/vnd.sap.adt.functions.groups.v3+xml',
    'Accept': 'application/vnd.sap.adt.functions.groups.v3+xml'
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers
  });
}