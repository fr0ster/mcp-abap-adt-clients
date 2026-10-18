/**
 * Structure create operations
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { STRUCTURE } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
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
  const limitedDescription = limitDescription(params.description);
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = responsible
    ? ` adtcore:responsible="${responsible}"`
    : '';

  const structureXml = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}" adtcore:language="${params.masterLanguage || 'EN'}" adtcore:name="${params.structureName.toUpperCase()}" adtcore:type="TABL/DS" adtcore:masterLanguage="${params.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${params.packageName.toUpperCase()}"/>
</blue:blueSource>`;

  return connection.makeAdtRequest({
    url: createUrl,
    method: 'POST',
    timeout: 0,
    data: structureXml,
    headers: requestHeaders(headers),
  });
}
