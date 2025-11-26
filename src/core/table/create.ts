/**
 * Table create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName, limitDescription } from '../../utils/internalUtils';
import { CreateTableParams } from './types';
import { getSystemInformation } from '../../utils/systemInfo';

/**
 * Create empty ABAP table
 * Low-level function: only creates empty table via POST endpoint
 * DDL code should be added via update() method
 */
export async function createTable(
  connection: AbapConnection,
  params: CreateTableParams
): Promise<AxiosResponse> {
  if (!params.table_name) {
    throw new Error('Table name is required');
  }
  if (!params.package_name) {
    throw new Error('Package name is required');
  }

  // Get system information - only for cloud systems
  const systemInfo = await getSystemInformation(connection);
  const username = systemInfo?.userName || '';
  const systemId = systemInfo?.systemID || '';

  // Only add masterSystem and responsible for cloud systems (when systemInfo is available)
  const masterSystem = systemInfo ? systemId : '';
  const responsible = systemInfo ? username : '';

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(params.table_name);
  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = responsible ? ` adtcore:responsible="${responsible}"` : '';

  // Create empty table with POST
  const createUrl = `/sap/bc/adt/ddic/tables${params.transport_request ? `?corrNr=${params.transport_request}` : ''}`;

  const tableXml = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${params.table_name.toUpperCase()}" adtcore:type="TABL/DT" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>

  <adtcore:packageRef adtcore:name="${params.package_name.toUpperCase()}"/>

</blue:blueSource>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.tables.v2+xml',
    'Content-Type': 'application/vnd.sap.adt.tables.v2+xml'
  };

  try {
    const createResponse = await connection.makeAdtRequest({
      url: createUrl,
      method: 'POST',
      timeout: getTimeout('default'),
      data: tableXml,
      headers
    });

    return createResponse;
  } catch (error: any) {
    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create table ${params.table_name}: ${errorMessage}`);
  }
}

