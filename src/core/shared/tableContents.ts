/**
 * Table contents operations via ADT DDIC Data Preview API
 *
 * Retrieves table metadata to build field list, then uses the DDIC Data Preview
 * endpoint with POST and SQL query in body (TABLE~FIELD syntax, same as Eclipse ADT).
 *
 * ⚠️ ABAP Cloud Limitation: Direct access to table data through ADT Data Preview
 * is blocked by SAP BTP backend policies when using JWT/XSUAA authentication.
 * This function works only for on-premise systems with basic authentication.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IGetTableContentsParams } from './types';

const ACCEPT_HEADER =
  'application/xml, application/vnd.sap.adt.datapreview.table.v1+xml';

/**
 * Get column names for a DDIC entity via metadata endpoint
 */
async function getColumnNames(
  connection: IAbapConnection,
  tableName: string,
): Promise<string[]> {
  const encodedName = encodeSapObjectName(tableName);
  const url = `/sap/bc/adt/datapreview/ddic/${encodedName}/metadata`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_HEADER,
    },
  });

  const xml = response.data;
  const fields: string[] = [];
  const fieldMatches = xml.match(/dataPreview:name="([^"]+)"/g);

  if (fieldMatches) {
    for (const match of fieldMatches) {
      const nameMatch = match.match(/dataPreview:name="([^"]+)"/);
      if (nameMatch) {
        fields.push(nameMatch[1]);
      }
    }
  }

  return fields;
}

/**
 * Get table contents via ADT DDIC Data Preview API
 *
 * @param connection - ABAP connection
 * @param params - Table contents parameters
 * @returns Table contents
 */
export async function getTableContents(
  connection: IAbapConnection,
  params: IGetTableContentsParams,
): Promise<AxiosResponse> {
  if (!params.table_name) {
    throw new Error('Table name is required');
  }

  const maxRows = params.max_rows || 100;
  const tableName = params.table_name.toUpperCase();

  // Get column names via metadata endpoint (as Eclipse ADT does)
  const fields = await getColumnNames(connection, tableName);

  if (fields.length === 0) {
    throw new Error('Could not retrieve column names from table metadata');
  }

  // Build SQL with TABLE~FIELD syntax (as Eclipse ADT does)
  const fieldList = fields.map((f) => `${tableName}~${f}`).join(', ');
  const sqlQuery = `SELECT ${fieldList} FROM ${tableName}`;

  const url = `/sap/bc/adt/datapreview/ddic?rowNumber=${maxRows}&ddicEntityName=${encodeURIComponent(tableName)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('long'),
    data: sqlQuery,
    headers: {
      'Content-Type': 'text/plain',
      Accept: ACCEPT_HEADER,
    },
  });
}
