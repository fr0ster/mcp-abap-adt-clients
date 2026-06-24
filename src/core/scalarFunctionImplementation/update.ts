import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateScalarFunctionImplementationParams } from './types';

export async function updateScalarFunctionImplementation(
  connection: IAbapConnection,
  args: IUpdateScalarFunctionImplementationParams,
  lockHandle: string,
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(args.implementation_name.toLowerCase());
  const corrNrParam = args.transport_request
    ? `&corrNr=${encodeURIComponent(args.transport_request)}`
    : '';
  const url = `/sap/bc/adt/ddic/dsfi/${encoded}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers: { Accept: ACCEPT_SOURCE, 'Content-Type': CT_SOURCE },
  });
}
