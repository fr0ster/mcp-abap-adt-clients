/**
 * Search operations for ABAP objects
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  ISearchResult,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ISearchObjectsParams } from './types';

/**
 * Search for ABAP objects by name pattern
 *
 * @param connection - ABAP connection
 * @param params - Search parameters
 * @returns Search results
 */
export async function searchObjects(
  connection: IAbapConnection,
  params: ISearchObjectsParams,
): Promise<IAdtWireResponse> {
  const encodedQuery = encodeSapObjectName(params.query);
  const maxResults = params.maxResults || 100;

  let url = `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodedQuery}&maxResults=${maxResults}`;

  if (params.objectType) {
    url += `&objectType=${encodeSapObjectName(params.objectType)}`;
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

/**
 * Read an attribute that ADT may or may not namespace-qualify.
 *
 * The quickSearch payload is not consistent across releases about whether the
 * objectReference attributes carry the `adtcore:` prefix, and the element
 * itself arrives unprefixed. Rather than pin one spelling and silently return
 * empty strings on a system that uses the other, try both.
 */
const attr = (
  node: Record<string, unknown>,
  name: string,
): string | undefined => {
  const value = node[`@_adtcore:${name}`] ?? node[`@_${name}`];
  if (value === undefined || value === null) {
    return undefined;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
};

const asArray = (value: unknown): Record<string, unknown>[] => {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]) as Record<string, unknown>[];
};

/**
 * Parse a quickSearch response into typed hits.
 *
 * Exported so the raw `searchObjects` above stays available: a caller that
 * needs headers, status or the untouched XML keeps it, and a caller that just
 * wants the objects uses `searchObjectsTyped`. Removing the raw form would take
 * away a choice that costs us nothing to keep.
 */
export function parseSearchResults(xml: string): ISearchResult[] {
  const parsed = xmlParser.parse(xml) as Record<string, unknown>;
  const root = (parsed['adtcore:objectReferences'] ??
    parsed.objectReferences) as Record<string, unknown> | undefined;
  if (!root) {
    return [];
  }

  const refs = asArray(root['adtcore:objectReference'] ?? root.objectReference);

  const results: ISearchResult[] = [];
  for (const ref of refs) {
    const name = attr(ref, 'name');
    const type = attr(ref, 'type');
    // A hit without a name or a type cannot be acted on by a caller, and the
    // repository does not produce one; drop it rather than emit a half object.
    if (!name || !type) {
      continue;
    }
    results.push({
      name,
      type,
      description: attr(ref, 'description') ?? '',
      packageName: attr(ref, 'packageName'),
      uri: attr(ref, 'uri'),
    });
  }
  return results;
}

/** Search for ABAP objects and return the hits, parsed. */
export async function searchObjectsTyped(
  connection: IAbapConnection,
  params: ISearchObjectsParams,
): Promise<ISearchResult[]> {
  const response = await searchObjects(connection, params);
  return parseSearchResults(String(response.data ?? ''));
}
