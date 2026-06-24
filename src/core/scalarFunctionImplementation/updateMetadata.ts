import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SCALAR_FUNCTION_IMPL,
  CT_SCALAR_FUNCTION_IMPL_UPDATE,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateScalarFunctionImplementationParams } from './types';

export async function updateScalarFunctionImplementationMetadata(
  connection: IAbapConnection,
  args: IUpdateScalarFunctionImplementationParams,
  lockHandle: string,
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(args.implementation_name.toLowerCase());
  const corrNrParam = args.transport_request
    ? `&corrNr=${encodeURIComponent(args.transport_request)}`
    : '';
  const url = `/sap/bc/adt/ddic/dsfi/${encoded}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
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
