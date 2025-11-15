/**
 * DataElement create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId } from '../../utils/sessionUtils';
import { getSystemInformation } from '../shared/systemInfo';
import { activateDataElement } from './activation';
import { CreateDataElementParams } from './types';
import * as crypto from 'crypto';

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Make ADT request stateless
 */
async function makeAdtRequestStateless(
  connection: AbapConnection,
  url: string,
  method: string,
  sessionId: string,
  data?: any,
  additionalHeaders?: Record<string, string>
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

  const requestId = generateRequestId();
  const headers: Record<string, string> = {
    'sap-adt-connection-id': sessionId,
    'sap-adt-request-id': requestId,
    'X-sap-adt-profiling': 'server-time',
    ...additionalHeaders
  };

  return connection.makeAdtRequest({
    url: fullUrl,
    method,
    timeout: getTimeout('default'),
    data,
    headers
  });
}

/**
 * Create data element internal
 */
async function createDataElementInternal(
  connection: AbapConnection,
  args: CreateDataElementParams,
  sessionId: string,
  username: string,
  masterSystem?: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const url = `${baseUrl}/sap/bc/adt/ddic/dataelements${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const description = args.description || args.data_element_name;
  const dataType = args.data_type || 'CHAR';
  const length = args.length || 100;
  const decimals = args.decimals || 0;
  const shortLabel = args.short_label || '';
  const mediumLabel = args.medium_label || '';
  const longLabel = args.long_label || '';
  const headingLabel = args.heading_label || '';

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<blue:wbobj xmlns:blue="http://www.sap.com/wbobj/dictionary/dtel"
            xmlns:adtcore="http://www.sap.com/adt/core"
            xmlns:atom="http://www.w3.org/2005/Atom"
            xmlns:dtel="http://www.sap.com/adt/dictionary/dataelements"
            adtcore:description="${description}"
            adtcore:language="EN"
            adtcore:name="${args.data_element_name.toUpperCase()}"
            adtcore:type="DTEL/DE"
            adtcore:masterLanguage="EN"${masterSystemAttr}
            adtcore:responsible="${username}">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
  <dtel:dataElement>
    <dtel:typeKind>domain</dtel:typeKind>
    <dtel:typeName>${args.domain_name.toUpperCase()}</dtel:typeName>
    <dtel:dataType>${dataType}</dtel:dataType>
    <dtel:dataTypeLength>${length}</dtel:dataTypeLength>
    <dtel:dataTypeDecimals>${decimals}</dtel:dataTypeDecimals>
    <dtel:shortFieldLabel>${shortLabel}</dtel:shortFieldLabel>
    <dtel:shortFieldLength>10</dtel:shortFieldLength>
    <dtel:shortFieldMaxLength>10</dtel:shortFieldMaxLength>
    <dtel:mediumFieldLabel>${mediumLabel}</dtel:mediumFieldLabel>
    <dtel:mediumFieldLength>20</dtel:mediumFieldLength>
    <dtel:mediumFieldMaxLength>20</dtel:mediumFieldMaxLength>
    <dtel:longFieldLabel>${longLabel}</dtel:longFieldLabel>
    <dtel:longFieldLength>40</dtel:longFieldLength>
    <dtel:longFieldMaxLength>40</dtel:longFieldMaxLength>
    <dtel:headingFieldLabel>${headingLabel}</dtel:headingFieldLabel>
    <dtel:headingFieldLength>55</dtel:headingFieldLength>
    <dtel:headingFieldMaxLength>55</dtel:headingFieldMaxLength>
    <dtel:searchHelp/>
    <dtel:searchHelpParameter/>
    <dtel:setGetParameter/>
    <dtel:defaultComponentName/>
    <dtel:deactivateInputHistory>false</dtel:deactivateInputHistory>
    <dtel:changeDocument>false</dtel:changeDocument>
    <dtel:leftToRightDirection>false</dtel:leftToRightDirection>
    <dtel:deactivateBIDIFiltering>false</dtel:deactivateBIDIFiltering>
  </dtel:dataElement>
</blue:wbobj>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
    'Content-Type': 'application/vnd.sap.adt.dataelements.v2+xml'
  };

  return makeAdtRequestStateless(connection, url, 'POST', sessionId, xmlBody, headers);
}

/**
 * Get data element to verify creation
 */
async function getDataElementForVerification(
  connection: AbapConnection,
  dataElementName: string,
  sessionId: string
): Promise<any> {
  const baseUrl = await connection.getBaseUrl();
  const dataElementNameEncoded = encodeSapObjectName(dataElementName.toLowerCase());
  const url = `${baseUrl}/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
  };

  const response = await makeAdtRequestStateless(connection, url, 'GET', sessionId, null, headers);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const result = parser.parse(response.data);
  return result['blue:wbobj'];
}

/**
 * Create ABAP data element
 * Full workflow: create -> activate -> verify
 */
export async function createDataElement(
  connection: AbapConnection,
  params: CreateDataElementParams
): Promise<AxiosResponse> {
  if (!params.data_element_name) {
    throw new Error('Data element name is required');
  }
  if (!params.package_name) {
    throw new Error('Package name is required');
  }
  if (!params.domain_name) {
    throw new Error('Domain name is required');
  }

  const sessionId = generateSessionId();

  // Get masterSystem and responsible (only for cloud systems)
  // On cloud, getSystemInformation returns systemID and userName
  // On on-premise, it returns null, so we don't add these attributes
  const systemInfo = await getSystemInformation(connection);
  const masterSystem = systemInfo?.systemID;
  const username = systemInfo?.userName || process.env.SAP_USER || process.env.SAP_USERNAME || 'MPCUSER';

  try {
    // Step 1: Create data element with POST
    await createDataElementInternal(connection, params, sessionId, username, masterSystem);

    // Step 2: Activate data element
    await activateDataElement(connection, params.data_element_name, sessionId);

    // Step 3: Verify activation
    const finalDataElement = await getDataElementForVerification(connection, params.data_element_name, sessionId);

    // Return success response
    return {
      data: {
        success: true,
        data_element_name: params.data_element_name,
        package: params.package_name,
        transport_request: params.transport_request,
        domain_name: params.domain_name,
        status: 'active',
        version: finalDataElement['adtcore:version'] || 'unknown',
        session_id: sessionId,
        message: `Data element ${params.data_element_name} created and activated successfully`,
        data_element_details: {
          type_kind: finalDataElement['dtel:dataElement']?.['dtel:typeKind'],
          type_name: finalDataElement['dtel:dataElement']?.['dtel:typeName'],
          data_type: finalDataElement['dtel:dataElement']?.['dtel:dataType'],
          length: finalDataElement['dtel:dataElement']?.['dtel:dataTypeLength'],
          decimals: finalDataElement['dtel:dataElement']?.['dtel:dataTypeDecimals']
        }
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create data element ${params.data_element_name}: ${errorMessage}`);
  }
}

