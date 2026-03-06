/**
 * Package lock operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Lock package for modification
 * Returns lock handle that must be used in subsequent requests
 *
 * NOTE: Caller must enable stateful session mode via connection.setSessionType("stateful")
 * before calling this function
 */
export async function lockPackage(
  connection: IAbapConnection,
  packageName: string,
): Promise<string> {
  const url = `/sap/bc/adt/packages/${encodeSapObjectName(packageName)}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    Accept: ACCEPT_LOCK,
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers,
  });

  // Parse lock handle from XML response
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error(
      'Failed to obtain lock handle from SAP. Package may be locked by another user.',
    );
  }

  return lockHandle;
}
