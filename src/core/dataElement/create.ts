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
import { getDomainInfo } from './update';
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
  if (!args.type_kind) {
    throw new Error('type_kind is required. Must be one of: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType');
  }
  const requestedTypeKind = args.type_kind;
  // Use requestedTypeKind directly for XML (it's already one of: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType)
  const typeKindXml = requestedTypeKind;

  // Determine typeName based on typeKind
  let typeName = '';
  if (requestedTypeKind === 'domain') {
    typeName = (args.domain_name || args.type_name || '').toUpperCase();
  } else if (requestedTypeKind === 'predefinedAbapType' || requestedTypeKind === 'refToPredefinedAbapType') {
    // For predefinedAbapType and refToPredefinedAbapType, typeName is empty
    typeName = '';
  } else if (requestedTypeKind === 'refToDictionaryType' || requestedTypeKind === 'refToClifType') {
    // For refToDictionaryType and refToClifType, type_name is required
    typeName = (args.type_name || '').toUpperCase();
  }

  // Get dataType, length, decimals based on typeKind
  let dataType = '';
  let length = 0;
  let decimals = 0;

  if (requestedTypeKind === 'domain') {
    // For domain type, get information from the domain
    const domainName = (args.domain_name || args.type_name || '').toUpperCase();
    if (domainName) {
      try {
        const domainInfo = await getDomainInfo(connection, domainName);
        dataType = domainInfo.dataType;
        length = domainInfo.length;
        decimals = domainInfo.decimals;
      } catch (error: any) {
        // If domain info cannot be retrieved, use defaults
        dataType = 'CHAR';
        length = 100;
        decimals = 0;
      }
    } else {
      dataType = 'CHAR';
      length = 100;
      decimals = 0;
    }
  } else if (requestedTypeKind === 'predefinedAbapType' || requestedTypeKind === 'refToPredefinedAbapType') {
    // For predefinedAbapType and refToPredefinedAbapType, use provided values
    dataType = args.data_type || 'CHAR';
    length = args.length || 100;
    decimals = args.decimals || 0;
  } else {
    // For refToDictionaryType and refToClifType, dataType is empty, length/decimals are 0
    dataType = '';
    length = 0;
    decimals = 0;
  }

  const shortLabel = args.short_label || '';
  const mediumLabel = args.medium_label || '';
  const longLabel = args.long_label || '';
  const headingLabel = args.heading_label || '';
  const searchHelp = args.search_help !== undefined ? args.search_help : '';
  const searchHelpParameter = args.search_help_parameter !== undefined ? args.search_help_parameter : '';
  const setGetParameter = args.set_get_parameter !== undefined ? args.set_get_parameter : '';
  const defaultComponentName = args.default_component_name !== undefined ? args.default_component_name : '';
  const deactivateInputHistory = args.deactivate_input_history !== undefined ? args.deactivate_input_history : false;
  const changeDocument = args.change_document !== undefined ? args.change_document : false;
  const leftToRightDirection = args.left_to_right_direction !== undefined ? args.left_to_right_direction : false;
  const deactivateBIDIFiltering = args.deactivate_bidi_filtering !== undefined ? args.deactivate_bidi_filtering : false;

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
    <dtel:typeKind>${typeKindXml}</dtel:typeKind>
    ${typeName ? `<dtel:typeName>${typeName}</dtel:typeName>` : '<dtel:typeName/>'}
    ${dataType ? `<dtel:dataType>${dataType}</dtel:dataType>` : '<dtel:dataType/>'}
    <dtel:dataTypeLength>${String(length).padStart(6, '0')}</dtel:dataTypeLength>
    <dtel:dataTypeDecimals>${String(decimals).padStart(6, '0')}</dtel:dataTypeDecimals>
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
    ${searchHelp ? `<dtel:searchHelp>${searchHelp}</dtel:searchHelp>` : '<dtel:searchHelp/>'}
    ${searchHelpParameter ? `<dtel:searchHelpParameter>${searchHelpParameter}</dtel:searchHelpParameter>` : '<dtel:searchHelpParameter/>'}
    ${setGetParameter ? `<dtel:setGetParameter>${setGetParameter}</dtel:setGetParameter>` : '<dtel:setGetParameter/>'}
    ${defaultComponentName ? `<dtel:defaultComponentName>${defaultComponentName}</dtel:defaultComponentName>` : '<dtel:defaultComponentName/>'}
    <dtel:deactivateInputHistory>${deactivateInputHistory}</dtel:deactivateInputHistory>
    <dtel:changeDocument>${changeDocument}</dtel:changeDocument>
    <dtel:leftToRightDirection>${leftToRightDirection}</dtel:leftToRightDirection>
    <dtel:deactivateBIDIFiltering>${deactivateBIDIFiltering}</dtel:deactivateBIDIFiltering>
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

  if (!params.type_kind) {
    throw new Error('type_kind is required. Must be one of: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType');
  }
  const typeKind = params.type_kind;
  if (typeKind === 'domain' && !params.domain_name) {
    throw new Error('Domain name is required when type_kind is domain');
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
    const createResponse = await createDataElementInternal(
      connection,
      {
        ...params,
        type_kind: typeKind
      },
      sessionId,
      username,
      masterSystem
    );

    // Step 2: Activate data element
    await activateDataElement(connection, params.data_element_name, sessionId);

    // Return the real response from SAP (from initial POST)
    return createResponse;

  } catch (error: any) {
    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create data element ${params.data_element_name}: ${errorMessage}`);
  }
}

