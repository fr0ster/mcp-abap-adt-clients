/**
 * Lock Metadata Extension (DDLX) for editing
 * 
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=LOCK&accessMode=MODIFY
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';

/**
 * Lock a metadata extension for modification
 * 
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @param sessionId - Session ID for request tracking
 * @returns Lock handle string
 * 
 * @example
 * ```typescript
 * const lockHandle = await lockMetadataExtension(connection, 'ZOK_C_CDS_TEST_0001', sessionId);
 * ```
 */
export async function lockMetadataExtension(
  connection: IAbapConnection,
  name: string
): Promise<string> {
  const lowerName = name.toLowerCase();
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
  };

  const response = await connection.makeAdtRequest({
    method: 'POST',
    url,
    timeout: getTimeout('default'),
    data: undefined,
    headers
  });

  // Parse lock handle from XML response
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];

  if (!lockHandle) {
    throw new Error('Failed to obtain lock handle from SAP. Metadata extension may be locked by another user.');
  }

  return lockHandle;
}
