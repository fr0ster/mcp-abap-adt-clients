/**
 * Interface unlock operations
 */

import type {
  IAdtResponse as AxiosResponse,
  HttpError,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock interface
 * Must use same session and lock handle from lock operation
 */
export async function unlockInterface(
  connection: IAbapConnection,
  interfaceName: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout(),
      data: '',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response;
  } catch (error: unknown) {
    const e = error as HttpError;
    // If response is not returned (e.g., object locked by another user, network error),
    // provide more context in the error message
    if (!e.response) {
      throw new Error(
        `Failed to unlock interface ${interfaceName}: No response from server. ` +
          `Lock handle: ${lockHandle} ` +
          `The interface may be locked by another user or session may be invalid.`,
      );
    }
    // If we have a response, include its status and data in the error
    const status = e.response?.status;
    const statusText = status ? `HTTP ${status}` : 'HTTP ?';
    const errorData = e.response?.data
      ? typeof e.response.data === 'string'
        ? e.response.data
        : JSON.stringify(e.response.data)
      : e.message;

    throw new Error(
      `Failed to unlock interface ${interfaceName} (${statusText}): ${errorData}`,
    );
  }
}
