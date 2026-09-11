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
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_DATA_PREVIEW } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IGetTableContentsParams } from './types';

const ACCEPT_HEADER = ACCEPT_DATA_PREVIEW;

/**
 * The columns a DDIC entity has — `/datapreview/ddic/{name}/metadata`.
 *
 * One request, and the document as it arrived. It exists because
 * {@link getTableContents} no longer makes it: the statement is the caller's,
 * and this is where they learn what they may name in it.
 */
export async function getTableColumns(
  connection: IAbapConnection,
  tableName: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(tableName);

  return connection.makeAdtRequest({
    url: `/sap/bc/adt/datapreview/ddic/${encodedName}/metadata`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_HEADER },
  });
}

/**
 * Rows from a DDIC entity — `/datapreview/ddic`.
 *
 * **One request: the statement in `params.sql_query` is posted as given.** This
 * used to read the entity's metadata first and build
 * `SELECT T~A, T~B FROM T` out of every column it found — two requests, and a
 * statement the caller could not reach: not the column list, not an ordering,
 * not a `WHERE`. Read the columns with {@link getTableColumns} and write the
 * statement you want.
 */
export async function getTableContents(
  connection: IAbapConnection,
  params: IGetTableContentsParams,
): Promise<IAdtWireResponse> {
  const tableName = params.table_name.toUpperCase();
  const maxRows = params.max_rows || 100;

  return connection.makeAdtRequest({
    url: `/sap/bc/adt/datapreview/ddic?rowNumber=${maxRows}&ddicEntityName=${encodeURIComponent(tableName)}`,
    method: 'POST',
    timeout: getTimeout('long'),
    data: params.sql_query,
    headers: {
      Accept: ACCEPT_HEADER,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
