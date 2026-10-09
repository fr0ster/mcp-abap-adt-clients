/**
 * FunctionModule lock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { FUNCTION_MODULE } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * `POST …?_action=LOCK` on the function module — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member. Until 23.0.0 this parsed
 * it and threw when SAP's answer had none, which turned a statement about SAP's
 * answer into a library failure and dropped the answer.
 */
export async function lockFunctionModule(
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${FUNCTION_MODULE.uri(functionGroupName, functionModuleName)}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_LOCK },
  });
}
