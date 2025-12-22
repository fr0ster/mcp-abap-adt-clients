/**
 * Interface validation
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 * Same endpoint as class validation, but with objtype=INTF/OI
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
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
export async function validateInterfaceName(
  connection: IAbapConnection,
  interfaceName: string,
  packageName?: string,
  description?: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(interfaceName);

  // Build query parameters for interface validation (same format as class validation)
  const params = new URLSearchParams({
    objname: encodedName,
    objtype: 'INTF/OI',
  });

  if (packageName) {
    params.append('packagename', packageName);
  }

  if (description) {
    params.append('description', description);
  }

  const url = `/sap/bc/adt/oo/validation/objectname?${params.toString()}`;
  const headers = {
    Accept:
      'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.oo.clifname.check',
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers,
  });
}
