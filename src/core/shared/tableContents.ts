/**
 * Table contents operations via ADT Data Preview API
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

/**
 * Get table contents via ADT Data Preview API
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
  const encodedName = encodeSapObjectName(params.table_name);

  // First, get table structure to know all fields
  const structureUrl = `/sap/bc/adt/ddic/tables/${encodedName}/source/main`;

  // Get table structure
  const structureResponse = await connection.makeAdtRequest({
    url: structureUrl,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {},
  });

  // Parse table structure to extract field names
  const structureText = structureResponse.data;
  const fields: string[] = [];

  // Extract field names from ABAP table definition
  // Support both old and new CDS view syntax
  if (structureText.includes('define table')) {
    // New CDS syntax
    const lines = structureText.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      const fieldMatch = trimmedLine.match(
        /^(key\s+)?([a-z0-9_]+)\s*:\s*[a-z0-9_]+/i,
      );
      if (fieldMatch) {
        const fieldName = fieldMatch[2].trim().toUpperCase();
        if (fieldName && fieldName.length > 0) {
          fields.push(`${params.table_name}~${fieldName}`);
        }
      }
    }
  } else {
    // Old ABAP syntax
    const patterns = [
      /^\s+([A-Z0-9_]+)\s*:\s*(TYPE|LIKE)/gim,
      /^\s+([A-Z0-9_]+)\s+(TYPE|LIKE)/gim,
      /^\s+([A-Z0-9_]+)\s*:\s*[A-Z0-9_]+/gim,
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null = pattern.exec(structureText);
      while (match !== null) {
        const fieldName = match[1].trim().toUpperCase();
        if (
          fieldName &&
          fieldName.length > 0 &&
          !fields.includes(`${params.table_name}~${fieldName}`)
        ) {
          fields.push(`${params.table_name}~${fieldName}`);
        }
        match = pattern.exec(structureText);
      }
    }
  }

  if (fields.length === 0) {
    throw new Error('Could not extract field names from table structure');
  }

  // Build SQL query with explicit field list
  const sqlQuery = `SELECT ${fields.join(', ')} FROM ${params.table_name}`;

  // Execute SQL query via Data Preview API
  const url = `/sap/bc/adt/datapreview/freestyle?rowNumber=${maxRows}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('long'),
    data: sqlQuery,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      Accept: 'application/xml',
    },
  });
}
