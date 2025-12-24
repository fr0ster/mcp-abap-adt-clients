/**
 * View create operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { limitDescription } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateViewParams } from './types';

/**
 * Create DDLS object with metadata
 */
async function createDDLSObject(
  connection: IAbapConnection,
  args: ICreateViewParams,
): Promise<AxiosResponse> {
  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(args.description || args.view_name);
  // Check if transport_request is provided and not empty
  // Handle both string and undefined/null cases safely
  const transportRequest = args.transport_request?.trim();
  const hasTransportRequest = transportRequest && transportRequest.length > 0;
  const url = `/sap/bc/adt/ddic/ddl/sources${hasTransportRequest ? `?corrNr=${encodeURIComponent(transportRequest)}` : ''}`;

  // Get system information - only for cloud systems
  const systemInfo = await getSystemInformation(connection);
  const username = systemInfo?.userName || '';
  const systemId = systemInfo?.systemID || '';

  // Only add masterSystem and responsible for cloud systems (when systemInfo is available)
  const masterSystem = systemInfo ? systemId : '';
  const responsible = systemInfo ? username : '';

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = responsible
    ? ` adtcore:responsible="${responsible}"`
    : '';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><ddl:ddlSource xmlns:ddl="http://www.sap.com/adt/ddic/ddlsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.view_name}" adtcore:type="DDLS/DF" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name}"/>
</ddl:ddlSource>`;

  const headers = {
    Accept:
      'application/vnd.sap.adt.ddlSource.v2+xml, application/vnd.sap.adt.ddlSource+xml',
    'Content-Type': 'application/vnd.sap.adt.ddlSource+xml',
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: metadataXml,
    headers,
  });
}

/**
 * Create ABAP view (CDS DDLS object)
 * Low-level: Only creates the DDLS object metadata, does NOT lock/upload/activate
 * For complete workflow, use ViewBuilder
 */
export async function createView(
  connection: IAbapConnection,
  params: ICreateViewParams,
): Promise<AxiosResponse> {
  if (!params.view_name || !params.package_name) {
    throw new Error('Missing required parameters: view_name and package_name');
  }

  return createDDLSObject(connection, params);
}
