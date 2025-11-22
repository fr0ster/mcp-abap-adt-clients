/**
 * View create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getSystemInformation } from '../shared/systemInfo';
import { lockDDLS } from './lock';
import { unlockDDLS } from './unlock';
import { activateDDLS } from './activation';
import { CreateViewParams } from './types';

/**
 * Create DDLS object with metadata
 */
async function createDDLSObject(
  connection: AbapConnection,
  args: CreateViewParams
): Promise<AxiosResponse> {
  const description = args.description || args.view_name;
  const url = `/sap/bc/adt/ddic/ddl/sources${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  // Get system information - only for cloud systems
  const systemInfo = await getSystemInformation(connection);
  const username = systemInfo?.userName || '';
  const systemId = systemInfo?.systemID || '';

  // Only add masterSystem and responsible for cloud systems (when systemInfo is available)
  const masterSystem = systemInfo ? systemId : '';
  const responsible = systemInfo ? username : '';

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = responsible ? ` adtcore:responsible="${responsible}"` : '';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><ddl:ddlSource xmlns:ddl="http://www.sap.com/adt/ddic/ddlsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.view_name}" adtcore:type="DDLS/DF" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name}"/>
</ddl:ddlSource>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.ddlSource.v2+xml, application/vnd.sap.adt.ddlSource+xml',
    'Content-Type': 'application/vnd.sap.adt.ddlSource+xml'
  };

  return connection.makeAdtRequest(
    {url, method: 'POST', timeout: getTimeout('default'), data: metadataXml, headers});
}

/**
 * Upload DDL source code
 */
async function uploadDDLSource(
  connection: AbapConnection,
  viewName: string,
  ddlSource: string,
  lockHandle: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const queryParams = `lockHandle=${lockHandle}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return connection.makeAdtRequest({url, method: 'PUT', timeout: getTimeout('default'), data: ddlSource, headers});
}

/**
 * Create ABAP view (CDS or Classic)
 * Full workflow: create object -> lock -> upload source -> unlock -> activate
 */
export async function createView(
  connection: AbapConnection,
  params: CreateViewParams
): Promise<AxiosResponse> {
  if (!params.view_name || !params.ddl_source || !params.package_name) {
    throw new Error('Missing required parameters: view_name, ddl_source, and package_name');
  }

  const viewName = params.view_name.toUpperCase();
  let lockHandle: string | null = null;

  try {
    const createResponse = await createDDLSObject(connection, params);
    if (createResponse.status < 200 || createResponse.status >= 300) {
      throw new Error(`Failed to create DDLS: ${createResponse.status} ${createResponse.statusText}`);
    }

    lockHandle = await lockDDLS(connection, viewName);

    const uploadResponse = await uploadDDLSource(connection, viewName, params.ddl_source, lockHandle, params.transport_request);
    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error(`Failed to upload DDL: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    await unlockDDLS(connection, viewName, lockHandle);
    lockHandle = null;

    await activateDDLS(connection, viewName);

    // Return the real response from SAP (from initial POST)
    return createResponse;

  } catch (error: any) {
    if (lockHandle) {
      try {
        await unlockDDLS(connection, viewName, lockHandle);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create view ${viewName}: ${errorMessage}`);
  }
}

