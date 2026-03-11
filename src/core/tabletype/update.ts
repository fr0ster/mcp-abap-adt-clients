/**
 * TableType update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields (valueHelps, etc.)
 * that would be lost if XML were built from scratch.
 */

import type {
  IAdtResponse as AxiosResponse,
  HttpError,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { CT_TABLE_TYPE } from '../../constants/contentTypes';
import {
  encodeSapObjectName,
  limitDescription,
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
 * Update table type using existing lock/session (read-modify-write pattern)
 */
export async function updateTableType(
  connection: IAbapConnection,
  params: IUpdateTableTypeParams,
  lockHandle: string,
  logger?: ILogger,
): Promise<AxiosResponse> {
  if (!params.tabletype_name) {
    throw new Error('tabletype_name is required');
  }
  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const tableTypeName = params.tabletype_name.toUpperCase();
  const encodedName = encodeSapObjectName(tableTypeName).toLowerCase();
  const queryParams = `lockHandle=${encodeURIComponent(lockHandle)}${params.transport_request ? `&corrNr=${params.transport_request}` : ''}`;
  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}?${queryParams}`;

  // 1. GET current XML
  const { getTableTypeMetadata } = await import('./read');
  const currentResponse = await getTableTypeMetadata(
    connection,
    tableTypeName,
    undefined,
    logger,
  );
  const currentXml = extractXmlString(currentResponse.data);

  // 2. Patch only changed fields
  const updatedXml = patchTableTypeXml(currentXml, params);

  // 3. PUT
  const headers = {
    Accept: CT_TABLE_TYPE,
    'Content-Type': CT_TABLE_TYPE,
  };

  try {
    return await connection.makeAdtRequest({
      url,
      method: 'PUT',
      timeout: getTimeout('default'),
      data: updatedXml,
      headers,
    });
  } catch (error: unknown) {
    const e = error as HttpError;
    const status = e.response?.status || 'unknown';
    const statusText = e.response?.statusText || '';
    const responseData = e.response?.data
      ? typeof e.response.data === 'string'
        ? e.response.data
        : JSON.stringify(e.response.data, null, 2)
      : e.message || 'No response data';

    const fullError = `Failed to update table type ${params.tabletype_name}: HTTP ${status} ${statusText} — ${responseData}`;
    logger?.error?.(fullError);
    throw new Error(fullError);
  }
}
