import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  SCALAR_FUNCTION_IMPLEMENTATION,
  sourceUri,
} from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IUpdateScalarFunctionImplementationParams } from './types';

/** *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateScalarFunctionImplementation(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: IUpdateScalarFunctionImplementationParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(SCALAR_FUNCTION_IMPLEMENTATION.uri(args.implementation_name))}${writeQuery(lockHandle, args.transport_request)}`;
  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: args.source_code,
    headers: requestHeaders(headers),
  });
}
