/**
 * View validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/ddl/validation
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate view name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddl/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
/**
 * `packageName` is required by the endpoint. Measured on E19 2026-08-28:
 * without `packagename` it answers **400, "Parameter packagename could not be
 * found."**; `description` must be present but may be empty. See
 * `docs/evidence/2026-08-28-validation-required-params.md`.
 */
export async function validateDdlName(
  connection: IAbapConnection,
  ddlName: string,
  packageName: string,
  description?: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/ddic/ddl/validation`;
  const queryParams = new URLSearchParams({
    objtype: 'ddls',
    objname: ddlName,
    packagename: packageName,
    // Required, and an empty value is accepted here — measured.
    description: description || '',
  });

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_VALIDATION,
    },
  });
}
