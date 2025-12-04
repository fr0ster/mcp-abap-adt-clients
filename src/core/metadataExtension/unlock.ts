/**
 * Unlock Metadata Extension (DDLX)
 * 
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=UNLOCK&lockHandle={lockHandle}
 * 
 * NOTE: Builder should call connection.setSessionType("stateless") after unlocking
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';

/**
 * Unlock a metadata extension after editing
 * 
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @param lockHandle - Lock handle obtained from lockMetadataExtension
 * @returns Axios response
 * 
 * @example
 * ```typescript
 * await unlockMetadataExtension(connection, 'ZOK_C_CDS_TEST_0001', lockHandle);
 * connection.setSessionType("stateless");
 * ```
 */
export async function unlockMetadataExtension(
  connection: IAbapConnection,
  name: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default')
  });
}
