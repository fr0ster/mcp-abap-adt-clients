/**
 * TableType update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields (valueHelps, etc.)
 * that would be lost if XML were built from scratch.
 */

import type {
  HttpError,
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { CT_TABLE_TYPE } from '../../constants/contentTypes';
import {
  encodeSapObjectName,
  limitDescription,
  writeQuery,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import {
  extractXmlString,
  patchIf,
  patchXmlAttribute,
  patchXmlElement,
} from '../../utils/xmlPatch';
import type { IUpdateTableTypeParams } from './types';

/**
 * Patch current table type XML with updated values.
 * Only modifies fields that are explicitly provided in params.
 */
function patchTableTypeXml(
  currentXml: string,
  params: IUpdateTableTypeParams,
): string {
  let xml = currentXml;

  // Description
  if (params.description) {
    const description = limitDescription(params.description);
    xml = patchXmlAttribute(xml, 'adtcore:description', description);
  }

  // Row type
  xml = patchIf(xml, params.row_type_kind, (x, val) =>
    patchXmlElement(x, 'ttyp:typeKind', val),
  );
  xml = patchIf(xml, params.row_type_name, (x, val) =>
    patchXmlElement(x, 'ttyp:typeName', val.toUpperCase()),
  );

  // Access type
  xml = patchIf(xml, params.access_type, (x, val) =>
    patchXmlElement(x, 'ttyp:accessType', val),
  );

  // Primary key
  xml = patchIf(xml, params.primary_key_definition, (x, val) =>
    patchXmlElement(x, 'ttyp:definition', val),
  );
  xml = patchIf(xml, params.primary_key_kind, (x, val) =>
    patchXmlElement(x, 'ttyp:kind', val),
  );

  return xml;
}

/**
 * Write the document the caller built.
 *
 * **One request.** This used to GET the current document, patch the named
 * fields into it, and PUT the result — two requests in one member, and a merge
 * whose rules nobody outside could change. A caller reads the document with the
 * member that reads it, edits it, and passes it here, which is also where the
 * guarantee that it is valid belongs.
 *
 * A field left out of `document` is not preserved: nothing was read to preserve
 * it from.
 */
export async function updateTableType(
  connection: IAbapConnection,
  params: IUpdateTableTypeParams,
  document: string,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(
    params.tabletype_name.toUpperCase(),
  ).toLowerCase();
  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}${writeQuery(lockHandle, params.transport_request)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: { Accept: CT_TABLE_TYPE, 'Content-Type': CT_TABLE_TYPE },
  });
}
