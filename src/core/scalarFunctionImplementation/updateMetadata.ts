import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_SCALAR_FUNCTION_IMPL,
  CT_SCALAR_FUNCTION_IMPL_UPDATE,
} from '../../constants/contentTypes';
import { SCALAR_FUNCTION_IMPLEMENTATION } from '../../endpoints/objects';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateScalarFunctionImplementationParams } from './types';

export async function updateScalarFunctionImplementationMetadata(
  connection: IAbapConnection,
  args: IUpdateScalarFunctionImplementationParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const url = `${SCALAR_FUNCTION_IMPLEMENTATION.uri(args.implementation_name)}${writeQuery(lockHandle, args.transport_request)}`;
  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers: {
      Accept: ACCEPT_SCALAR_FUNCTION_IMPL,
      'Content-Type': CT_SCALAR_FUNCTION_IMPL_UPDATE,
    },
  });
}
