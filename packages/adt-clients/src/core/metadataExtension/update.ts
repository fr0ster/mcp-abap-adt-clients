/**
 * Update Metadata Extension (DDLX) source code
 *
 * Endpoint: PUT /sap/bc/adt/ddic/ddlx/sources/{name}/source/main?lockHandle={lockHandle}
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { METADATA_EXTENSION, sourceUri } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';

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
 * annotate entity ZDEMO_C_CDS_VIEW
 *   with
 * {
 *     @EndUserText.label: 'Field 1 Label'
 *     @UI.identification: [{ position: 10 }]
 *     Fld1;
 * }`;
 *
 * await updateMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', sourceCode, lockHandle);
 * ```
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateMetadataExtension(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
  sourceCode: string,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(METADATA_EXTENSION.uri(name))}${writeQuery(lockHandle, transportRequest)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: sourceCode,
    headers: requestHeaders(headers),
  });
}
