/**
 * FunctionInclude (FUGR/I) "validation".
 *
 * FUGR/I has no dedicated validation endpoint — instead, probe the parent
 * function group's existence. A 404 here tells the caller the group is
 * missing before any create/update is attempted.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_GROUP } from '../../endpoints/objects';

// Include both v3 (required on modern on-prem and cloud) and v2/v1 (older systems)
// so a single probe works across environments. Accept-negotiation will trim if needed.
const ACCEPT_FUNCTION_GROUP_ANY_VERSION =
  'application/vnd.sap.adt.functions.groups.v3+xml, ' +
  'application/vnd.sap.adt.functions.groups.v2+xml, ' +
  'application/vnd.sap.adt.functions.groups.v1+xml';

export async function validateFunctionIncludeName(
  connection: IAbapConnection,
  groupName: string,
  _includeName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'GET',
    url: `${FUNCTION_GROUP.uri(groupName)}`,
    timeout: 0,
    headers: { Accept: ACCEPT_FUNCTION_GROUP_ANY_VERSION },
  });
}
