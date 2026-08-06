/**
 * Check Metadata Extension (DDLX) syntax
 *
 * Uses standard ABAP check run endpoint
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { runCheckRun } from '../../utils/checkRun';

/**
 * Check metadata extension syntax
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check ('active' or 'inactive', default 'inactive')
 * @param sourceCode - Optional source code to validate before saving
 * @returns Axios response with check results
 *
 * @example
 * ```typescript
 * const checkResult = await checkMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', sessionId);
 * ```
 */
export async function checkMetadataExtension(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'inactive',
  sourceCode?: string,
): Promise<IAdtResponse> {
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
