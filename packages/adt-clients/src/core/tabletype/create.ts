/**
 * TableType create operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TABLE_TYPE } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import type { ICreateTableTypeParams } from './types';

/**
 * Create empty ABAP table type (XML-based entity like Domain/DataElement)
 * Low-level function: creates empty table type via POST endpoint
 * rowType should be added via update() method
 */
export async function createTableType(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: ICreateTableTypeParams,
): Promise<IAdtWireResponse> {
  const masterSystem = params.masterSystem || '';
  const responsible = params.responsible || '';

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(
    params.description || params.tabletype_name,
  );
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = responsible
    ? ` adtcore:responsible="${responsible}"`
    : '';

  // Create empty table type with POST using XML format (ttyp:tableType)
  const createUrl = `${TABLE_TYPE.collection}${params.transport_request ? `?corrNr=${params.transport_request}` : ''}`;

  // Empty table type XML (rowType added via update)
  const tableTypeXml = `<?xml version="1.0" encoding="UTF-8"?><ttyp:tableType xmlns:ttyp="http://www.sap.com/dictionary/tabletype" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${params.masterLanguage || 'EN'}" adtcore:name="${params.tabletype_name.toUpperCase()}" adtcore:type="TTYP/DA" adtcore:masterLanguage="${params.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>

  <adtcore:packageRef adtcore:name="${params.package_name.toUpperCase()}"/>

</ttyp:tableType>`;

  // A refusal comes back as the transport's failure, with SAP's answer on it.
  // It used to be rewrapped in a new Error carrying the text alone, which
  // dropped the response the caller's `analyse` reads.
  return connection.makeAdtRequest({
    url: createUrl,
    method: 'POST',
    timeout: 0,
    data: tableTypeXml,
    headers: requestHeaders(headers),
  });
}
