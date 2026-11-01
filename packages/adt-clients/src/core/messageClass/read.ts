/**
 * Message class read operations
 */

import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { MESSAGE_CLASS } from '../../endpoints/objects';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readQuery } from '../shared/readQuery';

const BASE = MESSAGE_CLASS.collection;

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
  options?: { withLongPolling?: boolean; version?: AdtReadVersion },
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  // No ADT operation that changes system state guarantees when the change
  // becomes visible, so a read straight after a create can legitimately find
  // nothing. `withLongPolling=true` is how ADT is asked to wait for the object
  // instead of answering from whatever is there right now.
  return connection.makeAdtRequest({
    url: `${BASE}/${encoded}${readQuery(options?.version, options?.withLongPolling)}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_MESSAGE_CLASS },
  });
}
