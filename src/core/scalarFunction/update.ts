import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateScalarFunctionParams } from './types';

/** *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateScalarFunction(
  connection: IAbapConnection,
  args: IUpdateScalarFunctionParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(args.scalar_function_name.toLowerCase());
  const url = `/sap/bc/adt/ddic/dsfd/sources/${encoded}/source/main${writeQuery(lockHandle, args.transport_request)}`;
  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers: { Accept: ACCEPT_SOURCE, 'Content-Type': CT_SOURCE },
  });
}
