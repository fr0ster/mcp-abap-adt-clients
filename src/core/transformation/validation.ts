import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate transformation name
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export async function validateTransformationName(
  connection: IAbapConnection,
  transformationName: string,
  packageName?: string,
  description?: string,
): Promise<AxiosResponse> {
  const url = '/sap/bc/adt/xslt/validation';
  const queryParams = new URLSearchParams({
    objname: transformationName,
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
      Accept: ACCEPT_VALIDATION,
    },
  });
}
