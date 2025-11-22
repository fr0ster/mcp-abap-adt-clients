/**
 * Check Metadata Extension (DDLX) syntax
 * 
 * Uses standard ABAP check run endpoint
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun } from '../shared/checkRun';

/**
 * Check metadata extension syntax
 * 
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check ('active' or 'inactive', default 'inactive')
 * @param sourceCode - Optional source code to validate before saving
 * @returns Axios response with check results
 * 
 * @example
 * ```typescript
 * const checkResult = await checkMetadataExtension(connection, 'ZOK_C_CDS_TEST_0001', sessionId);
 * ```
 */
export async function checkMetadataExtension(
  connection: AbapConnection,
  name: string,
  sessionId: string,
  version: 'active' | 'inactive' = 'inactive',
  sourceCode?: string
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const objectType = 'DDLX/EX';
  const objectName = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}`;

  return runCheckRun(
    connection,
    objectType,
    objectName,
    version,
    'abapCheckRun',
    sessionId,
    sourceCode
  );
}
