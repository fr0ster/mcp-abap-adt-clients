/**
 * All types operations for ABAP objects
 *
 * Retrieves all valid ADT object types from the repository.
 */

import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
  INamedItem,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { AdtParseError, throwIfSapError } from '../../utils/adtErrors';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get all valid ADT object types
 *
 * Endpoint: GET /sap/bc/adt/repository/informationsystem/objecttypes
 *
 * @param connection - ABAP connection instance
 * @param maxItemCount - Maximum number of items to return (default: 999)
 * @param name - Name filter pattern (default: '*')
 * @param data - Data filter (default: 'usedByProvider')
 * @returns Axios response with XML containing all object types
 *
 * @example
 * ```typescript
 * const response = await getAllTypes(connection);
 * // Response contains XML with all ADT object types
 * ```
 */
export async function getAllTypes(
  connection: IAbapConnection,
  maxItemCount: number = 999,
  name: string = '*',
  data: string = 'usedByProvider',
): Promise<IAdtResponse> {
  const params = new URLSearchParams({
    maxItemCount: String(maxItemCount),
    name: name,
    data: data,
  });

  const url = `/sap/bc/adt/repository/informationsystem/objecttypes?${params.toString()}`;

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
  attributeNamePrefix: '',
  trimValues: true,
});

/**
 * `nameditem:namedItemList`, as {@link INamedItem} already names it.
 *
 * The same document the trace catalogues answer with, served from a different
 * resource — which is why this returns the shape that was named for those rather
 * than a second one meaning the same thing (decision 13: a contract names an
 * essence, not a method).
 *
 * `name` is kept exactly as the server writes it. An entry without one is
 * dropped: the field is required because an item nobody can name is not one, and
 * dropping it states that rather than handing back a hole.
 */
export const parseNamedItems = (
  xmlData: string,
  logger?: ILogger,
): INamedItem[] => {
  // Outside the try: a refusal must reach the caller, and the catch below turns
  // everything into an empty list.
  throwIfSapError(xmlData);

  try {
    if (!xmlData) {
      return [];
    }
    const parsed = xmlParser.parse(xmlData) as Record<string, unknown>;
    const list = parsed['nameditem:namedItemList'] as
      | Record<string, unknown>
      | undefined;

    // A document that is not this one. An empty list is `<namedItemList/>`, which
    // parses and yields no items — that is a result. Absent entirely is not.
    if (list === undefined) {
      throw new AdtParseError('nameditem:namedItemList', xmlData);
    }

    const raw = list?.['nameditem:namedItem'];
    const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

    const result: INamedItem[] = [];
    for (const item of items as Record<string, unknown>[]) {
      const name = item?.['nameditem:name'];
      if (name === undefined || name === null || name === '') {
        continue;
      }
      result.push({
        name: String(name),
        description: String(item?.['nameditem:description'] ?? ''),
      });
    }
    return result;
  } catch (error) {
    if (error instanceof AdtParseError) {
      throw error;
    }
    logger?.debug?.('Failed to parse named item list', { error });
    throw new AdtParseError('nameditem:namedItemList', xmlData);
  }
};
