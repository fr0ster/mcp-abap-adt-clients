/**
 * Shared system information utilities
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';

/**
 * Get system information from SAP ADT (for cloud systems)
 * Returns systemID and userName if available
 */
export async function getSystemInformation(
  connection: AbapConnection
): Promise<{ systemID?: string; userName?: string } | null> {
  try {
    const baseUrl = await connection.getBaseUrl();
    const url = `${baseUrl}/sap/bc/adt/core/http/systeminformation`;

    const headers = {
      'Accept': 'application/json'
    };

    const response = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers
    });

    if (response.data && typeof response.data === 'object') {
      return {
        systemID: response.data.systemID,
        userName: response.data.userName
      };
    }

    return null;
  } catch (error) {
    // If endpoint doesn't exist (on-premise), return null
    return null;
  }
}

