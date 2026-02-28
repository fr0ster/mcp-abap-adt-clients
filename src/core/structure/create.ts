/**
 * Structure create operations
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateStructureParams } from './types';

/**
 * Create empty structure metadata via POST
 * Low-level function - creates metadata without DDL content
 */
export async function create(
  connection: IAbapConnection,
  params: ICreateStructureParams,
): Promise<AxiosResponse> {
  const createUrl = `/sap/bc/adt/ddic/structures${params.transportRequest ? `?corrNr=${params.transportRequest}` : ''}`;

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

  const structureXml = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}" adtcore:language="EN" adtcore:name="${params.structureName.toUpperCase()}" adtcore:type="TABL/DS" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${params.packageName.toUpperCase()}"/>
</blue:blueSource>`;

  const headers = {
    Accept:
      'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml',
    'Content-Type': 'application/vnd.sap.adt.structures.v2+xml',
  };

  return connection.makeAdtRequest({
    url: createUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: structureXml,
    headers,
  });
}
