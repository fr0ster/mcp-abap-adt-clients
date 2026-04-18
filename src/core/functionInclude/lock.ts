/**
 * FunctionInclude (FUGR/I) lock operation
 * NOTE: Caller should call connection.setSessionType("stateful") before locking.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Lock function include for modification.
 * Returns LOCK_HANDLE that must be passed to update/unlock.
 */
export async function lockFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  logger?: ILogger,
): Promise<string> {
  if (!groupName) {
    throw new Error('Function group name is required');
  }
  if (!includeName) {
    throw new Error('Include name is required');
  }

  const groupLower = encodeSapObjectName(groupName).toLowerCase();
  const encodedInclude = encodeSapObjectName(includeName.toUpperCase());
  const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}?_action=LOCK&accessMode=MODIFY`;

  const response = await connection.makeAdtRequest({
    method: 'POST',
    url,
    headers: { Accept: ACCEPT_LOCK },
    timeout: getTimeout('default'),
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const parsed = parser.parse(response.data);
  const lockHandle = parsed['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

  if (!lockHandle) {
    logger?.error?.('Failed to extract lock handle from response');
    throw new Error('Failed to extract lock handle from response');
  }

  return lockHandle;
}
