/**
 * Class update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Update class source code (low-level function)
 * Requires class to be locked first
 */
export async function updateClass(
  connection: AbapConnection,
  className: string,
  sourceCode: string,
  lockHandle: string,
  sessionId: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  if (!sourceCode) {
    throw new Error('source_code is required');
  }

  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const encodedName = encodeSapObjectName(className).toLowerCase();
  let url = `/sap/bc/adt/oo/classes/${encodedName}/source/main?lockHandle=${lockHandle}`;
  if (transportRequest) {
    url += `&corrNr=${transportRequest}`;
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Accept': 'text/plain'
  };

  return await makeAdtRequestWithSession(connection, url, 'PUT', sessionId, sourceCode, headers);
}


