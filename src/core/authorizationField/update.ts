/**
 * AuthorizationField (SUSO / AUTH) update operations
 *
 * Requires a valid lockHandle (acquired via lockAuthorizationField).
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_AUTHORIZATION_FIELD,
  CT_AUTHORIZATION_FIELD,
} from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateAuthorizationFieldParams } from './types';
import { buildAuthorizationFieldXml } from './xmlBuilder';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';

/**
 * Update authorization field via PUT.
 * The payload has the same shape as create; only unspecified optional fields
 * are omitted (server preserves their prior values).
 */
export async function updateAuthorizationField(
  connection: IAbapConnection,
  params: ICreateAuthorizationFieldParams,
  lockHandle?: string,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(
    params.authorization_field_name.toUpperCase(),
  );
  const url = `/sap/bc/adt/aps/iam/auth/${encoded}${writeQuery(lockHandle, params.transport_request)}`;

  const xmlBody = buildAuthorizationFieldXml(params);

  if (debugEnabled) {
    logger?.debug?.('[UPDATE XML]');
    logger?.debug?.(xmlBody);
  }

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept: ACCEPT_AUTHORIZATION_FIELD,
      'Content-Type': CT_AUTHORIZATION_FIELD,
    },
  });
}
