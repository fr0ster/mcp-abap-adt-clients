/**
 * Table create operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_TABLE, CT_TABLE } from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateTableParams } from './types';

/**
 * Create empty ABAP table
 * Low-level function: only creates empty table via POST endpoint
 * DDL code should be added via update() method
 */
export async function createTable(
  connection: IAbapConnection,
  params: ICreateTableParams,
): Promise<IAdtWireResponse> {
  const masterSystem = params.masterSystem || '';
  const responsible = params.responsible || '';

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(params.table_name);
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = responsible
    ? ` adtcore:responsible="${responsible}"`
    : '';

  // Create empty table with POST
  const createUrl = `/sap/bc/adt/ddic/tables${params.transport_request ? `?corrNr=${params.transport_request}` : ''}`;

  const tableXml = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${params.masterLanguage || 'EN'}" adtcore:name="${params.table_name.toUpperCase()}" adtcore:type="TABL/DT" adtcore:masterLanguage="${params.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>

  <adtcore:packageRef adtcore:name="${params.package_name.toUpperCase()}"/>

</blue:blueSource>`;

  const headers = {
    Accept: ACCEPT_TABLE,
    'Content-Type': CT_TABLE,
  };

  // A refusal comes back as the transport's failure, with SAP's answer on it.
  // It used to be rewrapped in a new Error carrying the text alone, which
  // dropped the response the caller's `analyse` reads.
  return connection.makeAdtRequest({
    url: createUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: tableXml,
    headers,
  });
}
