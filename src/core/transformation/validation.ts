import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate transformation name. Returns the raw response — the consumer decides
 * how to interpret it.
 *
 * **This endpoint answered 404 for every request on the one system it was
 * measured against**, including the control that sent every parameter, and E19's
 * discovery document lists no `xslt/validation` collection. So either this URL
 * is wrong or the resource does not exist there.
 *
 * A failed control proves nothing about parameters, which is why the
 * `packagename`/`description` conditionals below are left exactly as they are:
 * the other eleven modules were corrected from measurements, and this one has
 * none. Measured on an on-prem system, 2026-08-28.
 */
export async function validateTransformationName(
  connection: IAbapConnection,
  transformationName: string,
  packageName?: string,
  description?: string,
): Promise<IAdtResponse> {
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
