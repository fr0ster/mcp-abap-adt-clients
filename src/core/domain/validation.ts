/**
 * Domain validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/domains/validation
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate domain name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/domains/validation
 *
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message
 */
/**
 * `description` is required by the endpoint **and may not be empty**. Measured
 * on E19 (`RFCSAPRL 816`) 2026-08-28: sending `description=` answers **400,
 * "The description is missing for VALIDATION"**, which is why passing
 * `description || ''` never satisfied it. It moves ahead of the optional
 * `packageName`, which this endpoint does NOT require. See `docs/evidence/2026-08-28-validation-required-params.md`.
 */
export async function validateDomainName(
  connection: IAbapConnection,
  domainName: string,
  description: string,
  packageName?: string,
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/ddic/domains/validation`;
  const queryParams = new URLSearchParams({
    objtype: 'doma',
    objname: domainName,
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
