/**
 * SQL query operations via ADT Data Preview API
 *
 * ⚠️ ABAP Cloud Limitation: Direct execution of SQL queries through ADT Data Preview
 * is blocked by SAP BTP backend policies when using JWT/XSUAA authentication.
 * This function works only for on-premise systems with basic authentication.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';
import { wrapSqlLines } from './sqlLines';
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
 * **A line longer than 255 is sent wrapped** ({@link wrapSqlLines}): the
 * preview keeps 255 characters of each line and drops the rest without a word,
 * so a long one-line statement lost its literal or its condition
 * (mcp-abap-adt#350). Only where whitespace is changes; a statement whose
 * lines fit is sent as given, since SAP_BASIS 751 refuses any line break inside
 * the statement (mcp-abap-adt#363).
 *
 * **No row bound of the library's.** `row_number` goes out as `rowNumber`
 * exactly as given, `0` included; without one the URL carries none and SAP's
 * own bound applies (mcp-abap-adt#391). Measured on the BTP ABAP environment
 * (2026-11-27): without `rowNumber` SAP answered 100 records of selections of
 * 163, 249, 1716 and 8466; `0`, a negative number and 2147483647 were refused
 * `400` ("If UP TO or OFFSET is used, … cannot be specified"), and 2147483646
 * was the largest accepted. Until 48.0.0 a missing or `0` bound was sent as
 * 100.
 *
 * @param connection - ABAP connection
 * @param params - SQL query parameters
 * @returns Query results
 */
export async function getSqlQuery(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IGetSqlQueryParams,
): Promise<IAdtWireResponse> {
  const url =
    params.row_number === undefined
      ? '/sap/bc/adt/datapreview/freestyle'
      : `/sap/bc/adt/datapreview/freestyle?rowNumber=${params.row_number}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    // No deadline: the contract requires a number, and 0 is what the wires
    // read as "do not abort". How long to wait is the caller's.
    timeout: 0,
    data: wrapSqlLines(params.sql_query),
    headers: requestHeaders(headers),
  });
}
