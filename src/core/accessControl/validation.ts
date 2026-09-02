import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate access control name
 * Returns raw response from ADT - consumer decides how to interpret it
 */
/**
 * Both `packageName` and `description` are required by the endpoint, and both
 * used to be sent conditionally. Measured on E19 2026-08-28: omitting either
 * answers **400, "Parameter … could not be found."**, while an empty
 * `description` is accepted. See `docs/evidence/2026-08-28-validation-required-params.md`.
 */
export async function validateAccessControlName(
  connection: IAbapConnection,
  accessControlName: string,
  packageName: string,
  description?: string,
): Promise<IAdtWireResponse> {
  const url = '/sap/bc/adt/acm/dcl/validation';
  const queryParams = new URLSearchParams({
    objname: accessControlName,
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
