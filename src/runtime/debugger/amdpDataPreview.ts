/**
 * AMDP Debugger Data Preview
 *
 * Provides functions for data preview during AMDP debugging:
 * - Data preview for variables
 * - Cell substring retrieval
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get data preview options
 */
export interface IGetAmdpDataPreviewOptions {
  rowNumber?: number;
  colNumber?: number;
  sessionId?: string;
  debuggerId?: string;
  debuggeeId?: string;
  variableName?: string;
  schema?: string;
  provideRowId?: boolean;
  action?: string;
  /** The SELECT over the variable, sent as the body. */
  query?: string;
}

/**
 * A table variable's rows at the current stop.
 *
 * Measured from Eclipse ADT's Communication Log on premise (S/4HANA,
 * 2026-10-09): a POST from a stateless session, answered at once — no
 * request id, no event. `sessionId` is the HANA session the start named,
 * `debuggerId` the session's main id, `rowNumber` the most rows wanted.
 * Without a body the server selects every column itself — with
 * `provideRowId=true` adding `_rowId__` — so the whole variable and its
 * column types come back with no SQL written; Eclipse sends that first. With
 * a body, `text/plain`, the SELECT is the caller's
 * (`SELECT ":LT_ROWS"."N" AS "N", … FROM ":LT_ROWS"`): a filter, an order, a
 * subset. The answer (`datapreview.table.v1+xml`) is by column: each
 * `columns` carries its `metadata` and a `dataSet` of values, and
 * `executedQueryString` the SELECT that ran. `totalRows` answered 0 for a
 * table of two rows; count the values.
 */
export async function getAmdpDataPreview(
  connection: IAbapConnection,
  options?: IGetAmdpDataPreviewOptions,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/datapreview/amdpdebugger`;
  const params: Record<string, string | number | boolean> = {};

  if (options?.rowNumber !== undefined) params.rowNumber = options.rowNumber;
  if (options?.colNumber !== undefined) params.colNumber = options.colNumber;
  if (options?.sessionId) params.sessionId = options.sessionId;
  if (options?.debuggerId) params.debuggerId = options.debuggerId;
  if (options?.debuggeeId) params.debuggeeId = options.debuggeeId;
  if (options?.variableName) params.variableName = options.variableName;
  if (options?.schema) params.schema = options.schema;
  if (options?.provideRowId !== undefined)
    params.provideRowId = options.provideRowId;
  if (options?.action) params.action = options.action;

  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  );
  return connection.makeAdtRequest({
    url: `${url}?${query}`,
    method: 'POST',
    timeout: getTimeout('default'),
    // The server refuses a request without a content type, the empty one too
    // (400 "Content type missing"); no SELECT is an empty body.
    data: options?.query ?? '',
    headers: {
      Accept:
        'application/xml, application/vnd.sap.adt.datapreview.table.v1+xml',
      'Content-Type': 'text/plain',
    },
  });
}

/**
 * Get cell substring options
 */
export interface IGetAmdpCellSubstringOptions {
  rowNumber?: number;
  columnName?: string;
  sessionId?: string;
  debuggerId?: string;
  debuggeeId?: string;
  variableName?: string;
  valueOffset?: number;
  valueLength?: number;
  schema?: string;
  action?: string;
}

/**
 * Get cell substring from AMDP debugger data preview
 *
 * @param connection - ABAP connection
 * @param options - Cell substring options
 * @returns Axios response with cell substring
 */
export async function getAmdpCellSubstring(
  connection: IAbapConnection,
  options?: IGetAmdpCellSubstringOptions,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/datapreview/amdpdebugger/cellsubstring`;
  const params: Record<string, string | number | boolean> = {};

  if (options?.rowNumber !== undefined) params.rowNumber = options.rowNumber;
  if (options?.columnName) params.columnName = options.columnName;
  if (options?.sessionId) params.sessionId = options.sessionId;
  if (options?.debuggerId) params.debuggerId = options.debuggerId;
  if (options?.debuggeeId) params.debuggeeId = options.debuggeeId;
  if (options?.variableName) params.variableName = options.variableName;
  if (options?.valueOffset !== undefined)
    params.valueOffset = options.valueOffset;
  if (options?.valueLength !== undefined)
    params.valueLength = options.valueLength;
  if (options?.schema) params.schema = options.schema;
  if (options?.action) params.action = options.action;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation':
        'http://www.sap.com/adt/categories/datapreview/amdpdebugger/cellsubstring',
    },
  });
}
