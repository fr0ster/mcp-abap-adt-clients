/**
 * AMDP Debugger Data Preview
 *
 * Provides functions for data preview during AMDP debugging:
 * - Data preview for variables
 * - Cell substring retrieval
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
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
}

/**
 * Get AMDP debugger data preview
 *
 * @param connection - ABAP connection
 * @param options - Data preview options
 * @returns Axios response with data preview
 */
export async function getAmdpDataPreview(
  connection: IAbapConnection,
  options?: IGetAmdpDataPreviewOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/datapreview/amdpdebugger`;
  const params: Record<string, any> = {};

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

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation':
        'http://www.sap.com/adt/categories/datapreview/amdpdebugger',
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
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/datapreview/amdpdebugger/cellsubstring`;
  const params: Record<string, any> = {};

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
