/**
 * Function Group validation
 * Uses ADT validation endpoint: /sap/bc/adt/functions/validation
 * Matches Eclipse ADT behavior for on-premise and cloud systems
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate function group name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/functions/validation
 * (same endpoint for both function groups and function modules)
 *
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message (e.g., "Function group ... already exists")
 */
/**
 * `description` is required by the endpoint. Measured on E19 2026-08-28:
 * omitting it answers **400, "Parameter description could not be found."**, and
 * an empty value is accepted. `packagename` is genuinely optional here, which
 * is why it stays conditional. See `docs/evidence/2026-08-28-validation-required-params.md`.
 */
export async function validateFunctionGroupName(
  connection: IAbapConnection,
  functionGroupName: string,
  packageName?: string,
  description?: string,
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/functions/validation`;
  const queryParams = new URLSearchParams({
    objtype: 'FUGR/F',
    objname: functionGroupName,
  });

  if (packageName) {
    queryParams.append('packagename', packageName);
  }

  // Description is limited to 60 characters in SAP ADT. The fallback to the
  // group's own name was already computed here and then thrown away by a
  // condition; the endpoint requires the parameter, so it is always sent.
  queryParams.append(
    'description',
    description ? limitDescription(description) : functionGroupName,
  );

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_VALIDATION,
    },
  });
}
