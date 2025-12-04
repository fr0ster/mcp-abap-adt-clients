/**
 * Update Metadata Extension (DDLX) source code
 * 
 * Endpoint: PUT /sap/bc/adt/ddic/ddlx/sources/{name}/source/main?lockHandle={lockHandle}
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';

/**
 * Update metadata extension source code
 * 
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @param sourceCode - Metadata extension annotation source code
 * @param lockHandle - Lock handle from lockMetadataExtension
 * @returns Axios response
 * 
 * @example
 * ```typescript
 * const sourceCode = `@Metadata.layer: #CUSTOMER
 * annotate entity ZOK_C_CDS_TEST
 *   with
 * {
 *     @EndUserText.label: 'Field 1 Label'
 *     @UI.identification: [{ position: 10 }]
 *     Fld1;
 * }`;
 * 
 * await updateMetadataExtension(connection, 'ZOK_C_CDS_TEST_0001', sourceCode, lockHandle);
 * ```
 */
export async function updateMetadataExtension(
  connection: IAbapConnection,
  name: string,
  sourceCode: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}/source/main?lockHandle=${lockHandle}`;

  const headers = {
    'Accept': 'text/plain',
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers
  });
}
