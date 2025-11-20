/**
 * Interface unlock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Unlock interface
 * Must use same session and lock handle from lock operation
 */
export async function unlockInterface(
  connection: AbapConnection,
  interfaceName: string,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName)}?_action=UNLOCK&lockHandle=${lockHandle}`;

  try {
    const response = await makeAdtRequestWithSession(
      connection,
      url,
      'POST',
      sessionId,
      '',
      { 'Content-Type': 'application/x-www-form-urlencoded' }
    );
    return response;
  } catch (error: any) {
    // If response is not returned (e.g., object locked by another user, network error),
    // provide more context in the error message
    if (!error.response) {
      throw new Error(
        `Failed to unlock interface ${interfaceName}: No response from server. ` +
        `Lock handle: ${lockHandle.substring(0, 10)}..., Session: ${sessionId.substring(0, 10)}... ` +
        `The interface may be locked by another user or session may be invalid.`
      );
    }
    // If we have a response, include its status and data in the error
    const status = error.response?.status;
    const statusText = status ? `HTTP ${status}` : 'HTTP ?';
    const errorData = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;
    
    throw new Error(
      `Failed to unlock interface ${interfaceName} (${statusText}): ${errorData}`
    );
  }
}

