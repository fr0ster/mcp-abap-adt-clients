/**
 * AuthorizationField (SUSO / AUTH) create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 * when the caller intends to keep the lock on the object for further updates.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AUTHORIZATION_FIELD } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import type { ICreateAuthorizationFieldParams } from './types';
import { buildAuthorizationFieldXml } from './xmlBuilder';

/**
 * Low-level: Create authorization field (POST /sap/bc/adt/aps/iam/auth)
 */
export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateAuthorizationFieldParams,
): Promise<IAdtWireResponse> {
  const url = `${AUTHORIZATION_FIELD.collection}${args.transport_request ? `?corrNr=${encodeURIComponent(args.transport_request)}` : ''}`;

  const xmlBody = buildAuthorizationFieldXml(args);

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });
}
