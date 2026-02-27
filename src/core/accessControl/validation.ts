import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate access control name
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export async function validateAccessControlName(
  connection: IAbapConnection,
  accessControlName: string,
  packageName?: string,
  description?: string,
): Promise<AxiosResponse> {
  const url = '/sap/bc/adt/acm/dcl/validation';
  const encodedName = encodeSapObjectName(accessControlName);

  const queryParams = new URLSearchParams({
    objname: encodedName,
  });

  if (packageName) {
    queryParams.append('packagename', packageName);
  }

  if (description) {
    queryParams.append('description', description);
  }

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.as+xml',
    },
  });
}
