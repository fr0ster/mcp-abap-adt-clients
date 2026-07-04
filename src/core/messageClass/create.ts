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
 * POST /sap/bc/adt/messageclass[?corrNr={transport}] with Content-Type application/xml.
 * For a transportable package pass `transport_request` (added as `?corrNr=`), like
 * domain/class create; local packages send no corrNr.
 */
export async function createMessageClass(
  connection: IAbapConnection,
  params: ICreateMessageClassParams,
): Promise<IAdtResponse> {
  // Emit BOTH adtcore:language and adtcore:masterLanguage (like domain/class),
  // both set to the resolved language.
  const lang = params.master_language ?? 'EN';
  const xmlBody = buildMessageClassXml({
    name: params.name.toUpperCase(),
    description: params.description,
    packageName: params.package_name.toUpperCase(),
    language: lang,
    masterLanguage: lang,
    messages: [],
  });

  const corrNrParam = params.transport_request?.trim()
    ? `?corrNr=${encodeURIComponent(params.transport_request)}`
    : '';

  return connection.makeAdtRequest({
    url: `${BASE}${corrNrParam}`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
