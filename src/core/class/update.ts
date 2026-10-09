/**
 * Class update operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { CLASS, CLASS_INCLUDE, sourceUri } from '../../endpoints/objects';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Update class source code (low-level function)
 * Requires class to be locked first
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateClass(
  connection: IAbapConnection,
  className: string,
  sourceCode: string,
  lockHandle?: string,
  transportRequest?: string,
  sourceContentType?: string,
): Promise<IAdtWireResponse> {
  // **No lock handle is not this library's verdict.** It used to throw here, and
  // an update without a lock is a thing ADT judges: it answers its own refusal,
  // naming what it wants, and that answer is what a caller should read. The
  // parameter is simply left off the URL rather than sent empty.
  const url = `${sourceUri(CLASS.uri(className))}${writeQuery(lockHandle, transportRequest)}`;

  const contentType = sourceContentType || CT_SOURCE;
  const headers = {
    'Content-Type': contentType,
    Accept: ACCEPT_SOURCE,
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers,
  });
}

/**
 * Update class implementations include (low-level function)
 * Requires class to be locked first
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updateClassImplementations(
  connection: IAbapConnection,
  className: string,
  implementationCode: string,
  lockHandle?: string,
  transportRequest?: string,
  sourceContentType?: string,
): Promise<IAdtWireResponse> {
  const url = `${CLASS_INCLUDE.uri(className, 'implementations')}${writeQuery(lockHandle, transportRequest)}`;

  const contentType = sourceContentType || CT_SOURCE;
  const headers = {
    'Content-Type': contentType,
    Accept: ACCEPT_SOURCE,
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: implementationCode,
    headers,
  });
}
