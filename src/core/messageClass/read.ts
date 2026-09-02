/**
 * Message class read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const BASE = '/sap/bc/adt/messageclass';

/** Accept header covering both the dedicated MC content type and plain XML fallback. */
const ACCEPT_MESSAGE_CLASS =
  'application/vnd.sap.adt.mc.messageclass+xml, application/xml';

/**
 * Read message class metadata and messages.
 * GET /sap/bc/adt/messageclass/{name}
 */
export async function getMessageClassSource(
  connection: IAbapConnection,
  name: string,
  options?: { withLongPolling?: boolean },
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  // No ADT operation that changes system state guarantees when the change
  // becomes visible, so a read straight after a create can legitimately find
  // nothing. `withLongPolling=true` is how ADT is asked to wait for the object
  // instead of answering from whatever is there right now.
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  return connection.makeAdtRequest({
    url: `${BASE}/${encoded}${query}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_MESSAGE_CLASS },
  });
}
