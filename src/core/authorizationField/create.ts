/**
 * AuthorizationField (SUSO / AUTH) create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 * when the caller intends to keep the lock on the object for further updates.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_AUTHORIZATION_FIELD,
  CT_AUTHORIZATION_FIELD,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateAuthorizationFieldParams } from './types';
import { buildAuthorizationFieldXml } from './xmlBuilder';

/**
 * Low-level: Create authorization field (POST /sap/bc/adt/aps/iam/auth)
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateAuthorizationFieldParams,
): Promise<AxiosResponse> {
  if (!args.authorization_field_name) {
    throw new Error('authorization_field_name is required');
  }
  if (!args.package_name) {
    throw new Error('package_name is required');
  }

  const url = `/sap/bc/adt/aps/iam/auth${args.transport_request ? `?corrNr=${encodeURIComponent(args.transport_request)}` : ''}`;

  const xmlBody = buildAuthorizationFieldXml(args);

  const headers = {
    Accept: ACCEPT_AUTHORIZATION_FIELD,
    'Content-Type': CT_AUTHORIZATION_FIELD,
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
