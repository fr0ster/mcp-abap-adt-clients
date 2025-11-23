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
): Promise<{ systemID?: string; userName?: string; client?: string; language?: string; userFullName?: string } | null> {
  try {
    const url = `/sap/bc/adt/core/http/systeminformation`;

    const headers = {
      'Accept': 'application/vnd.sap.adt.core.http.systeminformation.v1+json'
    };

    // Add cache busting parameter like Eclipse does
    const params = {
      '_': Date.now()
    };

    const response = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers,
      params
    });

    // Parse response - can be JSON or XML
    let data = response.data;
    if (typeof data === 'string') {
      try {
        // Try to parse as JSON
        data = JSON.parse(data);
      } catch {
        // If not JSON, might be XML or error - return null
        return null;
      }
    }

    if (data && typeof data === 'object') {
      return {
        systemID: data.systemID,
        userName: data.userName,
        userFullName: data.userFullName,
        client: data.client,
        language: data.language
      };
    }

    return null;
  } catch (error) {
    // If endpoint doesn't exist (on-premise) or returns error, return null
    return null;
  }
}

/**
 * Check if the system is a BTP ABAP Cloud Environment
 * Returns true if the systeminformation endpoint is available (cloud system)
 * Returns false if the endpoint doesn't exist (on-premise system)
 */
export async function isCloudEnvironment(connection: AbapConnection): Promise<boolean> {
  const systemInfo = await getSystemInformation(connection);
  return systemInfo !== null;
}

