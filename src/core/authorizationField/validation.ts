/**
 * AuthorizationField (SUSO / AUTH) name validation
 * Endpoint: POST /sap/bc/adt/aps/iam/auth/validation
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate authorization field name against SAP naming rules.
 * Returns raw response — consumer interprets SEVERITY/SHORT_TEXT fields.
 */
export async function validateAuthorizationFieldName(
  connection: IAbapConnection,
  name: string,
  packageName?: string,
  description?: string,
): Promise<AxiosResponse> {
  if (!name) {
    throw new Error('Authorization field name is required');
  }

  const url = '/sap/bc/adt/aps/iam/auth/validation';
  const queryParams = new URLSearchParams({
    objname: name,
  });
  if (packageName) {
    queryParams.append('packagename', packageName);
  }
  queryParams.append('description', description || '');

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_VALIDATION,
    },
  });
}
