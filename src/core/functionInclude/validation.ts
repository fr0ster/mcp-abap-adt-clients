/**
 * FunctionInclude (FUGR/I) "validation".
 *
 * FUGR/I has no dedicated validation endpoint — instead, probe the parent
 * function group's existence. A 404 here tells the caller the group is
 * missing before any create/update is attempted.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { ACCEPT_FUNCTION_GROUP } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function validateFunctionIncludeName(
  connection: IAbapConnection,
  groupName: string,
  _includeName: string,
): Promise<void> {
  if (!groupName) {
    throw new Error('Function group name is required');
  }
  const groupLower = encodeSapObjectName(groupName).toLowerCase();
  await connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/functions/groups/${groupLower}`,
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_FUNCTION_GROUP },
  });
}
