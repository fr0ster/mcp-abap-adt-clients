import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { SCALAR_FUNCTION_IMPLEMENTATION } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * `POST …?_action=LOCK` — answered as it arrived. The handle is read by
 * `lockHandleOf` in the member; until 23.0.0 this parsed it and threw when
 * SAP's answer had none, which dropped the answer.
 */
export async function lockScalarFunctionImplementation(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const url = `${SCALAR_FUNCTION_IMPLEMENTATION.uri(name)}?_action=LOCK&accessMode=MODIFY`;
  return connection.makeAdtRequest({
    method: 'POST',
    url,
    headers: { Accept: ACCEPT_LOCK },
    timeout: getTimeout('default'),
  });
}
