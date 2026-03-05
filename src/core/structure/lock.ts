/**
 * Structure lock operations
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Lock structure for modification
 * Returns lock handle that must be used in subsequent requests
 */
export async function lockStructure(
  connection: IAbapConnection,
  structureName: string,
): Promise<string> {
  const url = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(structureName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;

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
      'Failed to obtain lock handle from SAP. Structure may be locked by another user.',
    );
  }

  return lockHandle;
}
