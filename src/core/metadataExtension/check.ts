/**
 * Check Metadata Extension (DDLX) syntax
 *
 * Uses standard ABAP check run endpoint
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { runCheckRun } from '../../utils/checkRun';

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
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  sourceCode?: string,
): Promise<AxiosResponse> {
  const objectType = 'DDLX/EX';
  // Pass just the name, getObjectUri will build the full URI
  const objectName = name;

  return runCheckRun(
    connection,
    objectType,
    objectName,
    version,
    'abapCheckRun',
    sourceCode,
  );
}
