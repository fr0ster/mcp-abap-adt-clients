/**
 * TableType create operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { TABLE_TYPE } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { createRequestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr, languageAttributes } from '../../utils/xml';
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
  // Cut first, escaped after: an entity is never cut in two.
  const description = escapeXmlAttr(
    limitDescription(params.description || params.tabletype_name),
  );
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(masterSystem)}"`
    : '';
  const responsibleAttr = responsible
    ? ` adtcore:responsible="${escapeXmlAttr(responsible)}"`
    : '';

  // Create empty table type with POST using XML format (ttyp:tableType)
  const createUrl = `${TABLE_TYPE.collection}${params.transport_request ? `?corrNr=${params.transport_request}` : ''}`;

  // Empty table type XML (rowType added via update)
  const tableTypeXml = `<?xml version="1.0" encoding="UTF-8"?><ttyp:tableType xmlns:ttyp="http://www.sap.com/dictionary/tabletype" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}"${languageAttributes(params.masterLanguage)} adtcore:name="${escapeXmlAttr(params.tabletype_name.toUpperCase())}" adtcore:type="${TYPE_CODE.tableType}"${masterSystemAttr}${responsibleAttr}>

  <adtcore:packageRef adtcore:name="${escapeXmlAttr(params.package_name.toUpperCase())}"/>

</ttyp:tableType>`;

  // A refusal comes back as the transport's failure, with SAP's answer on it.
  // It used to be rewrapped in a new Error carrying the text alone, which
  // dropped the response the caller's `analyse` reads.
  return connection.makeAdtRequest({
    url: createUrl,
    method: 'POST',
    timeout: 0,
    data: tableTypeXml,
    headers: createRequestHeaders(headers, params.masterLanguage),
  });
}
