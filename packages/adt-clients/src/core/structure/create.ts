/**
 * Structure create operations
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { STRUCTURE } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { createRequestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr, languageAttributes } from '../../utils/xml';
import type { ICreateStructureParams } from './types';

/**
 * Create empty structure metadata via POST
 * Low-level function - creates metadata without DDL content
 */
export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: ICreateStructureParams,
): Promise<IAdtWireResponse> {
  const createUrl = `${STRUCTURE.collection}${params.transportRequest ? `?corrNr=${params.transportRequest}` : ''}`;

  const masterSystem = params.masterSystem || '';
  const responsible = params.responsible || '';

  // Description is limited to 60 characters in SAP ADT
  // Cut first, escaped after: an entity is never cut in two.
  const limitedDescription = escapeXmlAttr(
    limitDescription(params.description),
  );
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(masterSystem)}"`
    : '';
  const responsibleAttr = responsible
    ? ` adtcore:responsible="${escapeXmlAttr(responsible)}"`
    : '';

  const structureXml = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}"${languageAttributes(params.masterLanguage)} adtcore:name="${escapeXmlAttr(params.structureName.toUpperCase())}" adtcore:type="${TYPE_CODE.structure}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${escapeXmlAttr(params.packageName.toUpperCase())}"/>
</blue:blueSource>`;

  return connection.makeAdtRequest({
    url: createUrl,
    method: 'POST',
    timeout: 0,
    data: structureXml,
    headers: createRequestHeaders(headers, params.masterLanguage),
  });
}
