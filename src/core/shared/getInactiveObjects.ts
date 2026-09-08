/**
 * Get Inactive Objects - retrieve list of objects not yet activated
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { getTimeout } from '../../utils/timeouts';
import type { IInactiveObjectsResponse, IObjectReference } from './types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

/**
 * Get list of inactive objects (objects that are not yet activated)
 *
 * Endpoint: GET /sap/bc/adt/activation/inactiveobjects
 *
 * @param connection - ABAP connection instance
 * @param options - Optional parameters
 * @returns List of inactive objects with their metadata
 *
 * @example
 * ```typescript
 * const result = await getInactiveObjects(connection);
 *
 * // Objects can be directly passed to activateObjectsGroup
 * await activateObjectsGroup(connection, result.objects);
 * ```
 */
/**
 * The request, and only the request.
 *
 * Split from the reading below so the reading can be injected: this is one GET
 * with one answer, which is exactly the shape an `IResultStrategy` types. The
 * `includeRawXml` flag it used to take is gone with the split — a consumer who
 * wants the document passes `rawDocument` as the strategy, which is the same
 * removal `getWhereUsedList`'s flag got in this release.
 */
export async function fetchInactiveObjects(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/activation/inactiveobjects`,
    timeout: getTimeout('default'),
    headers: {
      Accept:
        'application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8',
    },
  });
}

/** The shipped reading of that answer. */
export const inactiveObjects: IResultStrategy<IInactiveObjectsResponse> = (
  response,
) => {
  const xml = response.data;
  const parsed = xmlParser.parse(xml);

  const objects: IObjectReference[] = [];

  // Parse XML response
  const root = parsed['ioc:inactiveObjects'];
  if (!root) {
    return { objects };
  }

  const entries = Array.isArray(root['ioc:entry'])
    ? root['ioc:entry']
    : root['ioc:entry']
      ? [root['ioc:entry']]
      : [];

  for (const entry of entries) {
    const objectData = entry['ioc:object'];
    if (!objectData) continue;

    const ref = objectData['ioc:ref'];
    if (!ref) continue;

    objects.push({
      type: ref['@_adtcore:type'] || '',
      name: ref['@_adtcore:name'] || '',
    });
  }

  return {
    objects,
  };
};
