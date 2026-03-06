/**
 * Shared system information utilities
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  AdtContentTypesBase,
  AdtContentTypesModern,
  type IAdtContentTypes,
} from '../core/shared/contentTypes';
import { getTimeout } from './timeouts';

/**
 * Get system information from SAP ADT (for cloud systems)
 * Returns systemID and userName if available
 */
export async function getSystemInformation(
  connection: IAbapConnection,
): Promise<{
  systemID?: string;
  userName?: string;
  client?: string;
  language?: string;
  userFullName?: string;
} | null> {
  try {
    const url = `/sap/bc/adt/core/http/systeminformation`;

    const headers = {
      Accept: 'application/vnd.sap.adt.core.http.systeminformation.v1+json',
    };

    // Add cache busting parameter like Eclipse does
    const params = {
      _: Date.now(),
    };

    const response = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers,
      params,
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
        language: data.language,
      };
    }

    return null;
  } catch (_error) {
    // If endpoint doesn't exist (on-premise) or returns error, return null
    return null;
  }
}

/**
 * Check if the system is a BTP ABAP Cloud Environment
 *
 * Detection strategy (ordered by reliability):
 * 1. URL pattern — cloud systems use *.hana.ondemand.com or *.abap.*.hana.ondemand.com
 * 2. HTTP with explicit port — almost always on-premise
 * 3. Fallback to systeminformation endpoint check
 */
export async function isCloudEnvironment(
  connection: IAbapConnection,
): Promise<boolean> {
  try {
    const baseUrl = await connection.getBaseUrl();
    if (baseUrl) {
      // Cloud systems use specific domain patterns
      if (/\.hana\.ondemand\.com/i.test(baseUrl)) {
        return true;
      }
      // HTTP with explicit port is typically on-premise
      try {
        const parsed = new URL(baseUrl);
        if (parsed.protocol === 'http:' && parsed.port) {
          return false;
        }
      } catch {
        // URL parsing failed — continue to fallback
      }
    }
  } catch {
    // getBaseUrl() failed — continue to fallback
  }

  // Fallback: check if systeminformation endpoint is available
  const systemInfo = await getSystemInformation(connection);
  return systemInfo !== null;
}

/**
 * Check if the system supports modern ADT endpoints (core/discovery).
 *
 * Modern systems (S/4 HANA, BTP) expose /sap/bc/adt/core/discovery.
 * Older systems (BASIS 7.40 and below) only have /sap/bc/adt/discovery.
 */
export async function isModernAdtSystem(
  connection: IAbapConnection,
): Promise<boolean> {
  try {
    const response = await connection.makeAdtRequest({
      url: '/sap/bc/adt/core/discovery',
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'application/atomsvc+xml',
      },
    });
    // Modern systems return XML with content-length > 0
    const contentType = String(response.headers?.['content-type'] || '');
    return contentType.includes('xml');
  } catch {
    return false;
  }
}

/**
 * Resolve the appropriate content types for the connected SAP system.
 *
 * Uses /sap/bc/adt/core/discovery to detect modern systems:
 * - Available → AdtContentTypesModern (v2+ headers)
 * - Not available → AdtContentTypesBase (v1 headers, universal)
 */
export async function resolveContentTypes(
  connection: IAbapConnection,
): Promise<IAdtContentTypes> {
  const isModern = await isModernAdtSystem(connection);
  return isModern ? new AdtContentTypesModern() : new AdtContentTypesBase();
}
