/**
 * AuthorizationField (SUSO / AUTH) name validation
 * Endpoint: POST /sap/bc/adt/aps/iam/auth/validation
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate authorization field name against SAP naming rules.
 * Returns raw response — consumer interprets SEVERITY/SHORT_TEXT fields.
 */
/**
 * `description` is required by the endpoint **and may not be empty**. Measured
 * on E19 (`RFCSAPRL 816`) 2026-08-28: sending `description=` answers **400,
 * "The description is missing for VALIDATION"**, which is why passing
 * `description || ''` never satisfied it. It moves ahead of the optional
 * `packageName`, which this endpoint does NOT require. See `docs/evidence/2026-08-28-validation-required-params.md`.
 */
export async function validateAuthorizationFieldName(
  connection: IAbapConnection,
  name: string,
  description: string,
  packageName?: string,
): Promise<IAdtResponse> {
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
  queryParams.append('description', description);

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_VALIDATION,
    },
  });
}
