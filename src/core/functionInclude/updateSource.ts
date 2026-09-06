/**
 * FunctionInclude (FUGR/I) source upload operations.
 *
 * Requires a valid lockHandle (acquired via lockFunctionInclude).
 * Does NOT lock/unlock — assumes the object is already locked.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SOURCE,
  ACCEPT_SOURCE_UTF8,
} from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
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
  lockHandle: string | undefined,
  unicode: boolean,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  if (!groupName) {
    throw new Error('Function group name is required');
  }
  if (!includeName) {
    throw new Error('Include name is required');
  }
  const groupLower = encodeSapObjectName(groupName).toLowerCase();
  const encodedInclude = encodeSapObjectName(includeName.toUpperCase());
  const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}/source/main${writeQuery(lockHandle, transportRequest)}`;

  const contentType = unicode ? ACCEPT_SOURCE_UTF8 : ACCEPT_SOURCE;

  // The answer is returned rather than discarded: what a write becomes is the
  // consumer's result strategy to decide, and a function that swallowed it left
  // that strategy nothing to read.
  return connection.makeAdtRequest({
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
