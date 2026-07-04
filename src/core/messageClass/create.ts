/**
 * Message class create operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateMessageClassParams } from './types';
import { buildMessageClassXml } from './xml';

const BASE = '/sap/bc/adt/messageclass';

/**
 * Create a new message class (shell — no messages yet).
 * POST /sap/bc/adt/messageclass with Content-Type application/xml.
 *
 * corrNr (transport) is intentionally omitted here — the local/no-transport
 * path is the only one confirmed by probe. Task 6.2 will wire it for
 * transportable packages once a corrNr probe succeeds.
 */
export async function createMessageClass(
  connection: IAbapConnection,
  params: ICreateMessageClassParams,
): Promise<IAdtResponse> {
  const xmlBody = buildMessageClassXml({
    name: params.name.toUpperCase(),
    description: params.description,
    packageName: params.package_name.toUpperCase(),
    masterLanguage: params.master_language ?? 'EN',
    messages: [],
  });

  return connection.makeAdtRequest({
    url: BASE,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
