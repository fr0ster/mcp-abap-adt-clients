/**
 * Enhancement create operations - Low-level functions
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { limitDescription } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import {
  ENHANCEMENT_TYPE_CODES,
  getEnhancementBaseUrl,
  type ICreateEnhancementParams,
  isImplementationType,
} from './types';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';

/**
 * Build XML payload for enhancement creation based on type
 */
function buildCreateXml(
  args: ICreateEnhancementParams,
  masterSystem?: string,
  username?: string,
): string {
  const description = limitDescription(
    args.description || args.enhancement_name || '',
  );
  const typeCode = ENHANCEMENT_TYPE_CODES[args.enhancement_type];

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  // Base XML structure - may need adjustment based on actual ADT API
  // This is a template that should be verified against SAP documentation
  let enhancementSpecificXml = '';

  if (isImplementationType(args.enhancement_type)) {
    // Implementation types need reference to enhancement spot
    if (args.enhancement_spot) {
      enhancementSpecificXml = `<enh:enhancementSpotRef adtcore:name="${args.enhancement_spot}"/>`;
    }
    if (args.badi_definition && args.enhancement_type === 'enhoxhb') {
      enhancementSpecificXml += `<enh:badiDefinitionRef adtcore:name="${args.badi_definition}"/>`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<enh:enhancement xmlns:enh="http://www.sap.com/adt/enhancements" xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="${description}"
  adtcore:language="EN"
  adtcore:name="${args.enhancement_name}"
  adtcore:type="${typeCode}"
  adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name}"/>
  ${enhancementSpecificXml}
</enh:enhancement>`;
}

/**
 * Low-level: Create enhancement object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param args - Create parameters
 * @returns Axios response
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateEnhancementParams,
  logger?: ILogger,
): Promise<AxiosResponse> {
  if (!args.enhancement_name) {
    throw new Error('enhancement_name is required');
  }
  if (!args.enhancement_type) {
    throw new Error('enhancement_type is required');
  }
  if (!args.package_name) {
    throw new Error('package_name is required');
  }

  const url = `${getEnhancementBaseUrl(args.enhancement_type)}${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  // Get masterSystem and responsible
  let masterSystem: string | undefined;
  let username: string | undefined;

  const systemInfo = await getSystemInformation(connection);
  if (systemInfo) {
    masterSystem = systemInfo.systemID;
    username = systemInfo.userName;
  }

  username = username || process.env.SAP_USERNAME || process.env.SAP_USER || '';

  const metadataXml = buildCreateXml(args, masterSystem, username);

  const headers = {
    Accept: 'application/vnd.sap.adt.enhancements.v1+xml, application/xml',
    'Content-Type': 'application/vnd.sap.adt.enhancements.v1+xml',
  };

  if (debugEnabled) {
    logger?.debug?.(`[DEBUG] Creating enhancement - URL: ${url}`);
    logger?.debug?.(`[DEBUG] Creating enhancement - Method: POST`);
    logger?.debug?.(
      `[DEBUG] Creating enhancement - Headers: ${JSON.stringify(headers, null, 2)}`,
    );
    logger?.debug?.(
      `[DEBUG] Creating enhancement - Body (first 500 chars): ${metadataXml.substring(0, 500)}`,
    );
  }

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
    if (error.response && debugEnabled) {
      logger?.error?.(
        `[ERROR] Create enhancement failed - Status: ${error.response.status}`,
      );
      logger?.error?.(
        `[ERROR] Create enhancement failed - StatusText: ${error.response.statusText}`,
      );
      logger?.error?.(
        `[ERROR] Create enhancement failed - Response headers: ${JSON.stringify(error.response.headers, null, 2)}`,
      );
      logger?.error?.(
        `[ERROR] Create enhancement failed - Response data (first 1000 chars):`,
        typeof error.response.data === 'string'
          ? error.response.data.substring(0, 1000)
          : JSON.stringify(error.response.data).substring(0, 1000),
      );
    }
    throw error;
  }
}
