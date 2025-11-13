/**
 * View create operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockDDLS } from './lock';
import { unlockDDLS } from './unlock';
import { activateDDLS } from './activation';
import { CreateViewParams } from './types';

/**
 * Create DDLS object with metadata
 */
async function createDDLSObject(
  connection: AbapConnection,
  args: CreateViewParams,
  sessionId: string
): Promise<AxiosResponse> {
  const description = args.description || args.view_name;
  const url = `/sap/bc/adt/ddic/ddl/sources${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><ddl:ddlSource xmlns:ddl="http://www.sap.com/adt/ddic/ddlsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.view_name}" adtcore:type="DDLS/DF" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="${args.package_name}"/>
</ddl:ddlSource>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.ddlSource.v2+xml, application/vnd.sap.adt.ddlSource+xml',
    'Content-Type': 'application/vnd.sap.adt.ddlSource+xml'
  };

  return makeAdtRequestWithSession(connection, url, 'POST', sessionId, metadataXml, headers);
}

/**
 * Upload DDL source code
 */
async function uploadDDLSource(
  connection: AbapConnection,
  viewName: string,
  ddlSource: string,
  lockHandle: string,
  sessionId: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const queryParams = `lockHandle=${lockHandle}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, ddlSource, headers);
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
  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    const createResponse = await createDDLSObject(connection, params, sessionId);
    if (createResponse.status < 200 || createResponse.status >= 300) {
      throw new Error(`Failed to create DDLS: ${createResponse.status} ${createResponse.statusText}`);
    }

    lockHandle = await lockDDLS(connection, viewName, sessionId);

    const uploadResponse = await uploadDDLSource(connection, viewName, params.ddl_source, lockHandle, sessionId, params.transport_request);
    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error(`Failed to upload DDL: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    await unlockDDLS(connection, viewName, lockHandle, sessionId);
    lockHandle = null;

    const activateResponse = await activateDDLS(connection, viewName, sessionId);

    let activationWarnings: string[] = [];
    if (typeof activateResponse.data === 'string' && activateResponse.data.includes('<chkl:messages')) {
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const result = parser.parse(activateResponse.data);
      const messages = result?.['chkl:messages']?.['msg'];
      if (messages) {
        const msgArray = Array.isArray(messages) ? messages : [messages];
        activationWarnings = msgArray.map((msg: any) =>
          `${msg['@_type']}: ${msg['shortText']?.['txt'] || 'Unknown'}`
        );
      }
    }

    return {
      data: {
        success: true,
        view_name: viewName,
        package_name: params.package_name,
        transport_request: params.transport_request || null,
        type: 'DDLS',
        message: `View ${viewName} created and activated successfully`,
        uri: `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}`,
        steps_completed: ['create_object', 'lock', 'upload_source', 'unlock', 'activate'],
        activation_warnings: activationWarnings.length > 0 ? activationWarnings : undefined
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    if (lockHandle) {
      try {
        await unlockDDLS(connection, viewName, lockHandle, sessionId);
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

