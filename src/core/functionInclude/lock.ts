/**
 * FunctionInclude (FUGR/I) lock operation
 * NOTE: Caller should call connection.setSessionType("stateful") before locking.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * `POST …?_action=LOCK` on the function include — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member. Until 23.0.0 this parsed
 * it and threw when SAP's answer had none, which turned a statement about SAP's
 * answer into a library failure and dropped the answer.
 */
export async function lockFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
): Promise<IAdtWireResponse> {
  const groupLower = encodeSapObjectName(groupName).toLowerCase();
  const encodedInclude = encodeSapObjectName(includeName.toUpperCase());
  return connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}?_action=LOCK&accessMode=MODIFY`,
    headers: { Accept: ACCEPT_LOCK },
    timeout: getTimeout('default'),
  });
}
