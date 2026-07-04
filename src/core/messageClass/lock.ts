/**
 * Message class lock operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const BASE = '/sap/bc/adt/messageclass';

// Accept header for individual message lock (StatusMessage response type)
const ACCEPT_LOCK_MSG =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage';

/** Parse LOCK_HANDLE from the asx:abap lock response XML. Throws with errLabel if absent. */
function parseLockHandle(data: string, errLabel: string): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const result = parser.parse(data);
  const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
  if (!lockHandle) {
    throw new Error(`Failed to extract lock handle from ${errLabel}`);
  }
  return lockHandle;
}

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

  return parseLockHandle(response.data, 'message class lock response');
}

/**
 * Lock an individual message for modification.
 * Returns the message lock handle (MH) used in PUT XML as mc:lockhandle.
 *
 * NOTE: Caller must enable stateful session via connection.setSessionType('stateful') first.
 */
export async function lockMessage(
  connection: IAbapConnection,
  name: string,
  no: string,
): Promise<string> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `${BASE}/${encoded}/messages/${encodeURIComponent(no)}?_action=LOCK_MSG&accessMode=MODIFY`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: { Accept: ACCEPT_LOCK_MSG },
  });

  return parseLockHandle(response.data, 'message lock response');
}

/**
 * Lock a message class in the context of a specific message save.
 * Returns the class lock handle (CH) used in PUT ?lockHandle= parameter.
 *
 * NOTE: Caller must enable stateful session via connection.setSessionType('stateful') first.
 */
export async function lockClassForMessage(
  connection: IAbapConnection,
  name: string,
  no: string,
): Promise<string> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `${BASE}/${encoded}?_action=LOCK&accessMode=MODIFY&msgNo=${encodeURIComponent(no)}&onSave=X`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });

  return parseLockHandle(response.data, 'class-for-message lock response');
}
