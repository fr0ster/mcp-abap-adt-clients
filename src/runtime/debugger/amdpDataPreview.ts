/**
 * AMDP debugger data preview: a table variable's rows at the current stop.
 */

import type { IGetAmdpDataPreviewOptions } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getTimeout } from '../../utils/timeouts';

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
  options: IGetAmdpDataPreviewOptions,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/datapreview/amdpdebugger`;
  const params: Record<string, string | number | boolean> = {};

  if (options.rowNumber !== undefined) params.rowNumber = options.rowNumber;
  params.sessionId = options.sessionId;
  params.debuggerId = options.debuggerId;
  params.debuggeeId = options.debuggeeId;
  params.variableName = options.variableName;
  if (options.provideRowId !== undefined)
    params.provideRowId = options.provideRowId;

  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  );
  return connection.makeAdtRequest({
    url: `${url}?${query}`,
    method: 'POST',
    timeout: getTimeout('default'),
    // The server refuses a request without a content type, the empty one too
    // (400 "Content type missing"); no SELECT is an empty body.
    data: options.query ?? '',
    headers: {
      Accept:
        'application/xml, application/vnd.sap.adt.datapreview.table.v1+xml',
      'Content-Type': 'text/plain',
    },
  });
}
