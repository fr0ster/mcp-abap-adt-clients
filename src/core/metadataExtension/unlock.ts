/**
 * Unlock Metadata Extension (DDLX)
 * 
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=UNLOCK&lockHandle={lockHandle}
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Unlock a metadata extension after editing
 * 
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @param lockHandle - Lock handle obtained from lockMetadataExtension
 * @param sessionId - Session ID for request tracking
 * @returns Axios response
 * 
 * @example
 * ```typescript
 * await unlockMetadataExtension(connection, 'ZOK_C_CDS_TEST_0001', lockHandle, sessionId);
 * ```
 */
export async function unlockMetadataExtension(
  connection: AbapConnection,
  name: string,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return makeAdtRequestWithSession(
    connection,
    sessionId,
    'POST',
    url,
    undefined,
    {}
  );
}
