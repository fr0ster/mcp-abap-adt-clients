/**
 * SQL query operations via ADT Data Preview API
 *
 * ⚠️ ABAP Cloud Limitation: Direct execution of SQL queries through ADT Data Preview
 * is blocked by SAP BTP backend policies when using JWT/XSUAA authentication.
 * This function works only for on-premise systems with basic authentication.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { GetSqlQueryParams } from './types';

/**
 * Execute freestyle SQL query via SAP ADT Data Preview API
 *
 * @param connection - ABAP connection
 * @param params - SQL query parameters
 * @returns Query results
 */
export async function getSqlQuery(
  connection: IAbapConnection,
  params: GetSqlQueryParams
): Promise<AxiosResponse> {
  if (!params.sql_query) {
    throw new Error('SQL query is required');
  }

  const rowNumber = params.row_number || 100;
  const url = `/sap/bc/adt/datapreview/freestyle?rowNumber=${rowNumber}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('long'),
    data: params.sql_query,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Accept': 'application/xml'
    }
  });
}

