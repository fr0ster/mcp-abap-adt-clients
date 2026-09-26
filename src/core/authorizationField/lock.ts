/**
 * AuthorizationField (SUSO / AUTH) lock operation
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * `POST …?_action=LOCK` — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member. Until 23.0.0 this parsed
 * it and threw when SAP's answer had none, which turned a statement about SAP's
 * answer into a library failure and dropped the answer.
 */
export async function lockAuthorizationField(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toUpperCase());
  return connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/aps/iam/auth/${encoded}?_action=LOCK&accessMode=MODIFY`,
    headers: { Accept: ACCEPT_LOCK },
    timeout: getTimeout('default'),
  });
}
