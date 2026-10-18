/**
 * AuthorizationField (SUSO / AUTH) update operations
 *
 * Requires a valid lockHandle (acquired via lockAuthorizationField).
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AUTHORIZATION_FIELD } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import type { ICreateAuthorizationFieldParams } from './types';
import { buildAuthorizationFieldXml } from './xmlBuilder';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';

/**
 * Update authorization field via PUT.
 * The payload has the same shape as create; only unspecified optional fields
 * are omitted (server preserves their prior values).
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateAuthorizationField(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: ICreateAuthorizationFieldParams,
  lockHandle?: string,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const url = `${AUTHORIZATION_FIELD.uri(params.authorization_field_name.toUpperCase())}${writeQuery(lockHandle, params.transport_request)}`;

  const xmlBody = buildAuthorizationFieldXml(params);

  if (debugEnabled) {
    logger?.debug?.('[UPDATE XML]');
    logger?.debug?.(xmlBody);
  }

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });
}
