/**
 * Interface validation
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 * Same endpoint as class validation, but with objtype=INTF/OI
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION_CLASS_NAME } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate interface name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/oo/validation/objectname
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
/**
 * `packageName` is required by the endpoint, not optional. Measured on E19
 * (`RFCSAPRL 816`) 2026-08-28: without `packagename` it answers **400,
 * "Parameter packagename could not be found."** — see
 * `docs/evidence/2026-08-28-validation-required-params.md`.
 */
export async function validateInterfaceName(
  connection: IAbapConnection,
  interfaceName: string,
  packageName: string,
  description?: string,
): Promise<IAdtResponse> {
  // Build query parameters for interface validation (same format as class validation)
  const params = new URLSearchParams({
    objname: interfaceName,
    objtype: 'INTF/OI',
    packagename: packageName,
  });

  if (description) {
    params.append('description', description);
  }

  const url = `/sap/bc/adt/oo/validation/objectname?${params.toString()}`;
  const headers = {
    Accept: ACCEPT_VALIDATION_CLASS_NAME,
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers,
  });
}
