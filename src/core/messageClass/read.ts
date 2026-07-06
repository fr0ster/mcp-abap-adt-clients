/**
 * Message class read operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
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
): Promise<IAdtResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    url: `${BASE}/${encoded}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_MESSAGE_CLASS },
  });
}
