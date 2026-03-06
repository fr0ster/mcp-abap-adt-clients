/**
 * Discovery-based endpoint availability checking
 *
 * Utilities for parsing /sap/bc/adt/discovery and determining
 * which ADT endpoints a system supports.
 *
 * The main library uses isModernAdtSystem() to auto-detect and
 * AdtClientLegacy has hardcoded stubs for known-unsupported types.
 * These utilities are for consumers who want manual checking.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { ACCEPT_DISCOVERY } from '../constants/contentTypes';
import { getTimeout } from './timeouts';

/**
 * Fetch /sap/bc/adt/discovery and extract all collection href paths.
 *
 * @returns Set of endpoint paths available on the system
 */
export async function fetchDiscoveryEndpoints(
  connection: IAbapConnection,
): Promise<Set<string>> {
  const endpoints = new Set<string>();

  try {
    const response = await connection.makeAdtRequest({
      url: '/sap/bc/adt/discovery',
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: ACCEPT_DISCOVERY,
      },
    });

    const xml = typeof response.data === 'string' ? response.data : '';
    // Extract all href values from app:collection elements
    const hrefRegex = /href="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = hrefRegex.exec(xml)) !== null) {
      const href = match[1];
      // Only include relative paths (skip absolute URLs like http://...)
      if (href.startsWith('/')) {
        endpoints.add(href);
      }
    }
  } catch {
    // If discovery fails, return empty set — caller decides what to do
  }

  return endpoints;
}

/**
 * Check if a specific endpoint path is available in the discovery set.
 * Supports prefix matching — e.g., '/sap/bc/adt/ddic/domains' matches
 * if the discovery contains '/sap/bc/adt/ddic/domains' or any sub-path.
 */
export function isEndpointInDiscovery(
  endpoints: Set<string>,
  path: string,
): boolean {
  if (endpoints.has(path)) return true;
  for (const ep of endpoints) {
    if (ep.startsWith(path)) return true;
  }
  return false;
}
