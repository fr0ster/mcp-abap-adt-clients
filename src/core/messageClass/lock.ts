/**
 * Message class lock operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const BASE = '/sap/bc/adt/messageclass';

/**
 * Lock a message class for modification.
 * Returns the lock handle that must be used in subsequent update/delete requests.
 *
 * NOTE: Caller must enable stateful session via connection.setSessionType('stateful') first.
 */
export async function lockMessageClass(
  connection: IAbapConnection,
  name: string,
): Promise<string> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `${BASE}/${encoded}?_action=LOCK&accessMode=MODIFY`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const result = parser.parse(response.data);
  const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error(
      'Failed to extract lock handle from message class lock response',
    );
  }

  return lockHandle;
}
