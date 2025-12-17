/**
 * TableType create operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { limitDescription } from '../../utils/internalUtils';
import { ICreateTableTypeParams } from './types';
import { getSystemInformation } from '../../utils/systemInfo';

/**
 * Create empty ABAP table type (XML-based entity like Domain/DataElement)
 * Low-level function: creates empty table type via POST endpoint
 * rowType should be added via update() method
 */
export async function createTableType(
  connection: IAbapConnection,
  params: ICreateTableTypeParams
): Promise<AxiosResponse> {
  if (!params.tabletype_name) {
    throw new Error('TableType name is required');
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
  const description = limitDescription(params.description || params.tabletype_name);
  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = responsible ? ` adtcore:responsible="${responsible}"` : '';

  // Create empty table type with POST using XML format (ttyp:tableType)
  const createUrl = `/sap/bc/adt/ddic/tabletypes${params.transport_request ? `?corrNr=${params.transport_request}` : ''}`;

  // Empty table type XML (rowType added via update)
  const tableTypeXml = `<?xml version="1.0" encoding="UTF-8"?><ttyp:tableType xmlns:ttyp="http://www.sap.com/dictionary/tabletype" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${params.tabletype_name.toUpperCase()}" adtcore:type="TTYP/DA" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
    
  <adtcore:packageRef adtcore:name="${params.package_name.toUpperCase()}"/>
  
</ttyp:tableType>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.tabletype.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.tabletype.v1+xml'
  };

  try {
    const createResponse = await connection.makeAdtRequest({
      url: createUrl,
      method: 'POST',
      timeout: getTimeout('default'),
      data: tableTypeXml,
      headers
    });

    return createResponse;
  } catch (error: any) {
    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create table type ${params.tabletype_name}: ${errorMessage}`);
  }
}
