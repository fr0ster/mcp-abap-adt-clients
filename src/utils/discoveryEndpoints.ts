/**
 * Discovery-based endpoint availability checking
 *
 * Utilities for parsing /sap/bc/adt/discovery and reading which collections a
 * system advertises.
 *
 * **Advertised is not the same as available**, and on a legacy system the gap is
 * real rather than theoretical. Measured: that system's discovery document lists
 * `/sap/bc/adt/atc/customizing`, and a `GET` of it answers
 * `404 No suitable resource found`. Two derived analyses of the same capture
 * disagreed about this for months — one calling ATC and the debugger absent, the
 * other marking them present — and only the raw document plus a live request
 * settled it. So treat a hit here as "the system says it has this", and a miss
 * as the stronger signal of the two.
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
    let match: RegExpExecArray | null = hrefRegex.exec(xml);
    while (match !== null) {
      const href = match[1];
      // Only include relative paths (skip absolute URLs like http://...)
      if (href.startsWith('/')) {
        endpoints.add(href);
      }
      match = hrefRegex.exec(xml);
    }
  } catch {
    // A failed discovery and a system advertising nothing both come back as an
    // empty set, and the caller cannot tell them apart. Left as it is because
    // changing it changes a published signature; worth knowing before treating
    // an empty result as an answer.
  }

  return endpoints;
}

/**
 * Check whether a path is advertised in the discovery set.
 *
 * Supports prefix matching — e.g., '/sap/bc/adt/ddic/domains' matches
 * if the discovery contains '/sap/bc/adt/ddic/domains' or any sub-path.
 *
 * `true` means the system listed it, not that a request will succeed; see the
 * note at the top of this file.
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
