/**
 * Class create operations - Low-level functions
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { getSystemInformation } from '../shared/systemInfo';

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  error: debugEnabled ? console.error : () => {},
};

export interface CreateClassParams {
  class_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  superclass?: string;
  final?: boolean;
  abstract?: boolean;
  create_protected?: boolean;
}


/**
 * Low-level: Create class object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 */
export async function create(
  connection: AbapConnection,
  args: CreateClassParams,
  sessionId: string
): Promise<AxiosResponse> {
  const description = args.description || args.class_name || '';
  const url = `/sap/bc/adt/oo/classes${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  // Get masterSystem and responsible (only for cloud systems)
  // On cloud, getSystemInformation returns systemID and userName
  // On on-premise, it returns null, so we don't add these attributes
  let masterSystem = args.master_system;
  let username = args.responsible;

  const systemInfo = await getSystemInformation(connection);
  if (systemInfo) {
    masterSystem = masterSystem || systemInfo.systemID;
    username = username || systemInfo.userName;
  }

  // Only use masterSystem from getSystemInformation (cloud), not from env
  // username can fallback to env if not provided
  username = username || process.env.SAP_USERNAME || process.env.SAP_USER || '';

  const finalAttr = args.final ? 'true' : 'false';
  const visibilityAttr = args.create_protected ? 'protected' : 'public';

  const superClassXml = args.superclass
    ? `<class:superClassRef adtcore:name="${args.superclass}"/>`
    : '<class:superClassRef/>';

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.class_name}" adtcore:type="CLAS/OC" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr} class:final="${finalAttr}" class:visibility="${visibilityAttr}">



  <adtcore:packageRef adtcore:name="${args.package_name}"/>



  <class:include adtcore:name="CLAS/OC" adtcore:type="CLAS/OC" class:includeType="testclasses"/>



  ${superClassXml}



</class:abapClass>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.oo.classes.v4+xml',
    'Content-Type': 'application/vnd.sap.adt.oo.classes.v4+xml'
  };

  // Log request details for debugging authorization issues
  const baseUrl = await connection.getBaseUrl();
  const fullUrl = `${baseUrl}${url}`;
  logger.debug(`[DEBUG] Creating class - URL: ${fullUrl}`);
  logger.debug(`[DEBUG] Creating class - Method: POST`);
  logger.debug(`[DEBUG] Creating class - Headers:`, JSON.stringify(headers, null, 2));
  logger.debug(`[DEBUG] Creating class - Body (first 500 chars):`, metadataXml.substring(0, 500));

  try {
    const response = await makeAdtRequestWithSession(connection, url, 'POST', sessionId, metadataXml, headers);
    return response;
  } catch (error: any) {
    // Log error details for debugging
    if (error.response) {
      logger.error(`[ERROR] Create class failed - Status: ${error.response.status}`);
      logger.error(`[ERROR] Create class failed - StatusText: ${error.response.statusText}`);
      logger.error(`[ERROR] Create class failed - Response headers:`, JSON.stringify(error.response.headers, null, 2));
      logger.error(`[ERROR] Create class failed - Response data (first 1000 chars):`,
        typeof error.response.data === 'string'
          ? error.response.data.substring(0, 1000)
          : JSON.stringify(error.response.data).substring(0, 1000));
    }
    throw error;
  }
}
