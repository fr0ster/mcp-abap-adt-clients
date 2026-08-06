/**
 * Update Metadata Extension (DDLX) source code
 *
 * Endpoint: PUT /sap/bc/adt/ddic/ddlx/sources/{name}/source/main?lockHandle={lockHandle}
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Update metadata extension source code
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param sourceCode - Metadata extension annotation source code
 * @param lockHandle - Lock handle from lockMetadataExtension
 * @returns Axios response
 *
 * @example
 * ```typescript
 * const sourceCode = `@Metadata.layer: #CUSTOMER
 * annotate entity ZDEMO_C_CDS_MDE
 *   with
 * {
 *     @EndUserText.label: 'Field 1 Label'
 *     @UI.identification: [{ position: 10 }]
 *     Fld1;
 * }`;
 *
 * await updateMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', sourceCode, lockHandle);
 * ```
 */
export async function updateMetadataExtension(
  connection: IAbapConnection,
  name: string,
  sourceCode: string,
  lockHandle: string,
  transportRequest?: string,
): Promise<IAdtResponse> {
  const lowerName = name.toLowerCase();
  const corrNrParam = transportRequest ? `&corrNr=${transportRequest}` : '';
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;

  const headers = {
    Accept: ACCEPT_SOURCE,
    'Content-Type': CT_SOURCE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers,
  });
}
