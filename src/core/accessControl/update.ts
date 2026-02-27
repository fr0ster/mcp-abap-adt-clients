import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateAccessControlParams } from './types';

/**
 * Update access control source code
 * Requires object to be locked first (lockHandle must be provided)
 */
export async function updateAccessControl(
  connection: IAbapConnection,
  args: IUpdateAccessControlParams,
  lockHandle: string,
): Promise<AxiosResponse> {
  const accessControlNameEncoded = encodeSapObjectName(
    args.access_control_name.toLowerCase(),
  );

  const corrNrParam = args.transport_request
    ? `&corrNr=${args.transport_request}`
    : '';
  const url = `/sap/bc/adt/acm/dcl/sources/${accessControlNameEncoded}/source/main?lockHandle=${lockHandle}${corrNrParam}`;

  const headers: Record<string, string> = {
    Accept: 'text/plain',
    'Content-Type': 'text/plain; charset=utf-8',
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers,
  });
}
