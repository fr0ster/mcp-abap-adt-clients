/**
 * FunctionInclude (FUGR/I) source upload operations.
 *
 * Requires a valid lockHandle (acquired via lockFunctionInclude).
 * Does NOT lock/unlock — assumes the object is already locked.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SOURCE,
  ACCEPT_SOURCE_UTF8,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Upload function include source code (low-level; uses an existing lockHandle).
 *
 * @param unicode when true, Content-Type is "text/plain; charset=utf-8";
 *                when false, plain "text/plain" (for legacy non-unicode systems).
 */
export async function uploadFunctionIncludeSource(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  sourceCode: string,
  lockHandle: string,
  unicode: boolean,
  transportRequest?: string,
): Promise<void> {
  if (!groupName) {
    throw new Error('Function group name is required');
  }
  if (!includeName) {
    throw new Error('Include name is required');
  }
  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const groupLower = encodeSapObjectName(groupName).toLowerCase();
  const encodedInclude = encodeSapObjectName(includeName.toUpperCase());
  let url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}/source/main?lockHandle=${encodeURIComponent(lockHandle)}`;
  if (transportRequest) {
    url += `&corrNr=${encodeURIComponent(transportRequest)}`;
  }

  const contentType = unicode ? ACCEPT_SOURCE_UTF8 : ACCEPT_SOURCE;

  await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers: {
      'Content-Type': contentType,
      Accept: ACCEPT_SOURCE,
      'X-sap-adt-sessiontype': 'stateful',
    },
  });
}
