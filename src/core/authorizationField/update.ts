/**
 * AuthorizationField (SUSO / AUTH) update operations
 *
 * Requires a valid lockHandle (acquired via lockAuthorizationField).
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_AUTHORIZATION_FIELD,
  CT_AUTHORIZATION_FIELD,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
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
  lockHandle: string,
  logger?: ILogger,
): Promise<void> {
  if (!params.authorization_field_name) {
    throw new Error('authorization_field_name is required');
  }
  if (!lockHandle) {
    throw new Error('lockHandle is required for update');
  }

  const encoded = encodeSapObjectName(
    params.authorization_field_name.toUpperCase(),
  );
  const corrNr = params.transport_request
    ? `&corrNr=${encodeURIComponent(params.transport_request)}`
    : '';
  const url = `/sap/bc/adt/aps/iam/auth/${encoded}?lockHandle=${encodeURIComponent(lockHandle)}${corrNr}`;

  const xmlBody = buildAuthorizationFieldXml(params);

  if (debugEnabled) {
    logger?.debug?.('[UPDATE XML]');
    logger?.debug?.(xmlBody);
  }

  await connection.makeAdtRequest({
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
