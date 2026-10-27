/**
 * View create operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { DDL_SOURCE } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import type { ICreateDdlParams } from './types';

/**
 * Create DDLS object with metadata
 */
async function createDDLSObject(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateDdlParams,
): Promise<IAdtWireResponse> {
  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(args.description || args.ddl_name);
  // Check if transport_request is provided and not empty
  // Handle both string and undefined/null cases safely
  const transportRequest = args.transport_request?.trim();
  const hasTransportRequest = transportRequest && transportRequest.length > 0;
  const url = `${DDL_SOURCE.collection}${hasTransportRequest ? `?corrNr=${encodeURIComponent(transportRequest)}` : ''}`;

  const masterSystem = args.masterSystem || '';
  const responsible = args.responsible || '';

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = responsible
    ? ` adtcore:responsible="${responsible}"`
    : '';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><ddl:ddlSource xmlns:ddl="http://www.sap.com/adt/ddic/ddlsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${args.ddl_name}" adtcore:type="${TYPE_CODE.ddl}" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name}"/>
</ddl:ddlSource>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: metadataXml,
    headers: requestHeaders(headers),
  });
}

/**
 * Create ABAP view (CDS DDLS object)
 * Low-level: Only creates the DDLS object metadata, does NOT lock/upload/activate
 * For complete workflow, use AdtDdl
 */
export async function createDdl(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: ICreateDdlParams,
): Promise<IAdtWireResponse> {
  if (!params.ddl_name || !params.package_name) {
    throw new Error('Missing required parameters: ddl_name and package_name');
  }

  return createDDLSObject(connection, headers, params);
}
