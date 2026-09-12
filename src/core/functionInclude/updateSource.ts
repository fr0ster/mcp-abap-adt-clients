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
      // No `X-sap-adt-sessiontype` here. A write is stateless — Eclipse sends
      // it that way, carrying only `lockHandle` and `corrNr` — and the header
      // was set on the request while the connection's own mode was stateless,
      // so the connector never knew: measured , this PUT went out
      // labelled stateful without the `sap-adt-request-id` the connector adds
      // in that mode. What the server takes during a request that runs inside
      // the session is held by that session, which is what
      // `stateful covers the lock request, not the window` removed everywhere
      // else.
    },
  });
}
