/**
 * Class create operations - Low-level functions
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { limitDescription } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateClassParams } from './types';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  error: debugEnabled ? console.error : () => {},
};

/**
 * Low-level: Create class object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateClassParams,
): Promise<AxiosResponse> {
  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(
    args.description || args.class_name || '',
  );
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

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
  const abapSourceNamespace = args.template_xml
    ? ' xmlns:abapsource="http://www.sap.com/adt/abapsource"'
    : '';
  const templateSection = args.template_xml
    ? `\n\n  ${args.template_xml}\n\n`
    : '\n\n';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" xmlns:adtcore="http://www.sap.com/adt/core"${abapSourceNamespace} adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.class_name}" adtcore:type="CLAS/OC" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr} class:final="${finalAttr}" class:visibility="${visibilityAttr}">



  <adtcore:packageRef adtcore:name="${args.package_name}"/>



  ${templateSection}



  <class:include adtcore:name="CLAS/OC" adtcore:type="CLAS/OC" class:includeType="testclasses"/>



  ${superClassXml}



</class:abapClass>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.oo.classes.v4+xml',
    'Content-Type': 'application/vnd.sap.adt.oo.classes.v4+xml',
  };

  // Log request details for debugging authorization issues
  logger.debug(`[DEBUG] Creating class - URL: ${url}`);
  logger.debug(`[DEBUG] Creating class - Method: POST`);
  logger.debug(
    `[DEBUG] Creating class - Headers: ${JSON.stringify(headers, null, 2)}`,
  );
  logger.debug(
    `[DEBUG] Creating class - Body (first 500 chars): ${metadataXml.substring(0, 500)}`,
  );

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      data: metadataXml,
      headers,
    });
    return response;
  } catch (error: any) {
    // Log error details for debugging
    if (error.response) {
      logger.error(
        `[ERROR] Create class failed - Status: ${error.response.status}`,
      );
      logger.error(
        `[ERROR] Create class failed - StatusText: ${error.response.statusText}`,
      );
      logger.error(
        `[ERROR] Create class failed - Response headers: ${JSON.stringify(error.response.headers, null, 2)}`,
      );
      logger.error(
        `[ERROR] Create class failed - Response data (first 1000 chars):`,
        typeof error.response.data === 'string'
          ? error.response.data.substring(0, 1000)
          : JSON.stringify(error.response.data).substring(0, 1000),
      );
    }
    throw error;
  }
}
