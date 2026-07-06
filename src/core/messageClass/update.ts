/**
 * Message class update operations
 *
 * Uses read-modify-write pattern: GET current XML → apply description override
 * → rebuild full XML (messages preserved) → PUT with lock handle.
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { MESSAGE_CLASS_UPDATE_CONTENT_TYPE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { getMessageClassSource } from './read';
import { buildMessageClassXml, parseMessageClass } from './xml';

const BASE = '/sap/bc/adt/messageclass';

/**
 * Update a message class description.
 * Reads the current XML first to preserve all existing messages and attributes,
 * then rebuilds the full XML with the description override and PUTs it back.
 *
 * NOTE: Caller must enable stateful session and hold a valid lockHandle.
 */
export async function updateMessageClass(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
  description: string | undefined,
  transportRequest?: string,
): Promise<IAdtResponse> {
  // 1. Read current state to preserve existing messages and all SAP-managed attrs
  const currentResponse = await getMessageClassSource(connection, name);
  const current = parseMessageClass(String(currentResponse.data));

  // 2. Apply only the description override; everything else is preserved
  const updated = {
    ...current,
    ...(description !== undefined ? { description } : {}),
  };

  // 3. Rebuild full XML (round-trip preserving rawAttrs)
  const xmlBody = buildMessageClassXml(updated);

  // 4. PUT with lock handle
  const encoded = encodeSapObjectName(name.toLowerCase());
  const corrNrParam = transportRequest?.trim()
    ? `&corrNr=${encodeURIComponent(transportRequest)}`
    : '';
  const url = `${BASE}/${encoded}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: { 'Content-Type': MESSAGE_CLASS_UPDATE_CONTENT_TYPE },
  });
}
