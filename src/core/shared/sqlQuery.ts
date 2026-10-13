/**
 * SQL query operations via ADT Data Preview API
 *
 * ⚠️ ABAP Cloud Limitation: Direct execution of SQL queries through ADT Data Preview
 * is blocked by SAP BTP backend policies when using JWT/XSUAA authentication.
 * This function works only for on-premise systems with basic authentication.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_DATA_PREVIEW, CT_SOURCE } from '../../constants/contentTypes';
import type { IGetSqlQueryParams } from './types';

/**
 * Execute freestyle SQL query via SAP ADT Data Preview API
 *
 * **No deadline of the library's.** The request carries `timeout: 0` — none:
 * a query over large tables runs as long as it runs, and how long to wait is
 * the caller's, set on the connection it hands in. Until 31.0.0 this set the
 * library's own long deadline (120 s by default), which a caller applying its
 * own deadline only where the request had none never got to.
 *
 * @param connection - ABAP connection
 * @param params - SQL query parameters
 * @returns Query results
 */
export async function getSqlQuery(
  connection: IAbapConnection,
  params: IGetSqlQueryParams,
): Promise<IAdtWireResponse> {
  const rowNumber = params.row_number || 100;
  const url = `/sap/bc/adt/datapreview/freestyle?rowNumber=${rowNumber}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    // No deadline: the contract requires a number, and 0 is what the wires
    // read as "do not abort". How long to wait is the caller's.
    timeout: 0,
    data: params.sql_query,
    headers: {
      'Content-Type': CT_SOURCE,
      Accept: ACCEPT_DATA_PREVIEW,
    },
  });
}
