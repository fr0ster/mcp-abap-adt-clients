/**
 * Enhancement create operations - Low-level functions
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { HttpError } from '@mcp-abap-adt/interfaces-network';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { limitDescription, safeStringify } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr } from '../../utils/xml';
import {
  ENHANCEMENT_TYPE_CODES,
  getEnhancementBaseUrl,
  type ICreateEnhancementParams,
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
  const esc = escapeXmlAttr;
  const prefix = args.enhancement_type === 'enhsxsb' ? 'enhs' : 'enho';
  const root =
    args.enhancement_type === 'enhoxhh' ? 'enhancement' : 'objectData';
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${esc(masterSystem)}"`
    : '';
  const responsibleAttr = username
    ? ` adtcore:responsible="${esc(username)}"`
    : '';
  let content: string;
  if (args.enhancement_type === 'enhsxsb') {
    content =
      '<enhs:contentCommon enhs:toolType="BADI_DEF"/><enhs:contentSpecific><enhs:badiTechnology><enhs:badiDefinitions/></enhs:badiTechnology></enhs:contentSpecific>';
  } else if (args.enhancement_type === 'enhoxhb') {
    content = `<enho:contentCommon enho:toolType="BADI_IMPL"><enho:usages><enhcore:referencedObject enhcore:element_usage="EXTO" enhcore:program_id="R3TR"><enhcore:objectReference adtcore:name="${esc(args.enhancement_spot ?? '')}" adtcore:type="ENHS/XS"/><enhcore:mainObjectReference/></enhcore:referencedObject></enho:usages></enho:contentCommon><enho:contentSpecific><enho:badiTechnology><enho:badiImplementations/></enho:badiTechnology></enho:contentSpecific>`;
  } else {
    const host = args.enhancedObject;
    content = `<enho:contentCommon enho:toolType="HOOK_IMPL" enho:adjustmentStatus="" enho:upgradeFlag="false"/><enho:contentSpecific><enho:hookTechnology enho:nextId="2"><enho:enhancedObject adtcore:uri="${esc(host?.uri ?? '')}" adtcore:type="${esc(host?.type ?? '')}" adtcore:name="${esc(host?.name ?? '')}"/><enho:hookImplementation enho:id="1" enho:spotname="" enho:programname="${esc(host?.program ?? '')}" enho:overwrite="" enho:method="" enho:enhmode="${esc(args.enhancementMode ?? '')}" enho:full_name="${esc(args.enhancementOption ?? '')}" enho:full_description=""/></enho:hookTechnology></enho:contentSpecific>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<${prefix}:${root} xmlns:${prefix}="http://www.sap.com/adt/enhancements/${prefix}" xmlns:adtcore="http://www.sap.com/adt/core" xmlns:enhcore="http://www.sap.com/abapsource/enhancementscore"
 adtcore:description="${esc(limitDescription(args.description || args.enhancement_name || ''))}"
 adtcore:language="${esc(args.masterLanguage || 'EN')}"
 adtcore:name="${esc(args.enhancement_name)}"
 adtcore:type="${esc(ENHANCEMENT_TYPE_CODES[args.enhancement_type])}"
 adtcore:masterLanguage="${esc(args.masterLanguage || 'EN')}"${masterSystemAttr}${responsibleAttr}>
 <adtcore:packageRef adtcore:name="${esc(args.package_name)}"/>
 ${content}
</${prefix}:${root}>`;
}

/**
 * Low-level: Create enhancement object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 *
 * @param connection - SAP connection
 * @param args - Create parameters
 * @returns Axios response
 */
export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateEnhancementParams,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${getEnhancementBaseUrl(args.enhancement_type)}${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const metadataXml = buildCreateXml(args, args.masterSystem, args.responsible);

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
      timeout: 0,
      data: metadataXml,
      headers: requestHeaders(headers),
    });
    return response;
  } catch (error: unknown) {
    const e = error as HttpError;
    if (e.response && debugEnabled) {
      logger?.error?.(
        `[ERROR] Create enhancement failed - Status: ${e.response.status}`,
      );
      logger?.error?.(
        `[ERROR] Create enhancement failed - StatusText: ${e.response.statusText}`,
      );
      logger?.error?.(
        `[ERROR] Create enhancement failed - Response headers: ${JSON.stringify(e.response.headers, null, 2)}`,
      );
      logger?.error?.(
        `[ERROR] Create enhancement failed - Response data (first 1000 chars):`,
        typeof e.response.data === 'string'
          ? e.response.data.substring(0, 1000)
          : safeStringify(e.response.data).substring(0, 1000),
      );
    }
    throw error;
  }
}
