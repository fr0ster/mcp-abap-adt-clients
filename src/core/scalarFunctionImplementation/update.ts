import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SCALAR_FUNCTION_IMPL_SOURCE,
  CT_SCALAR_FUNCTION_IMPL_SOURCE,
} from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateScalarFunctionImplementationParams } from './types';

/** *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateScalarFunctionImplementation(
  connection: IAbapConnection,
  args: IUpdateScalarFunctionImplementationParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(args.implementation_name.toLowerCase());
  const url = `/sap/bc/adt/ddic/dsfi/${encoded}/source/main${writeQuery(lockHandle, args.transport_request)}`;
  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers: {
      Accept: ACCEPT_SCALAR_FUNCTION_IMPL_SOURCE,
      'Content-Type': CT_SCALAR_FUNCTION_IMPL_SOURCE,
    },
  });
}
