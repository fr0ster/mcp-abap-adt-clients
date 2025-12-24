/**
 * Type information operations for ABAP objects
 *
 * Retrieves type information (domain, data element, table type) with fallback chain.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get type information with fallback chain
 *
 * Tries multiple endpoints in order:
 * 1. Domain: `/sap/bc/adt/ddic/domains/{name}/source/main`
 * 2. Data Element: `/sap/bc/adt/ddic/dataelements/{name}`
 * 3. Table Type: `/sap/bc/adt/ddic/tabletypes/{name}`
 * 4. Fallback: `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri={uri}`
 *
 * @param connection - ABAP connection instance
 * @param typeName - Type name to look up
 * @returns Axios response with type information (XML)
 *
 * @example
 * ```typescript
 * const response = await getTypeInfo(connection, 'ZMY_TYPE');
 * // Response contains XML with type information
 * ```
 */
export async function getTypeInfo(
  connection: IAbapConnection,
  typeName: string,
): Promise<AxiosResponse> {
  if (!typeName) {
    throw new Error('Type name is required');
  }

  const encodedName = encodeSapObjectName(typeName.toLowerCase());

  // Try domain first
  try {
    const domainUrl = `/sap/bc/adt/ddic/domains/${encodedName}/source/main`;
    const domainResponse = await connection.makeAdtRequest({
      url: domainUrl,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'text/plain, application/xml',
      },
    });
    if (domainResponse.status === 200) {
      return domainResponse;
    }
  } catch (_error) {
    // Continue to next attempt
  }

  // Try data element
  try {
    const dataElementUrl = `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    const dataElementResponse = await connection.makeAdtRequest({
      url: dataElementUrl,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'application/vnd.sap.adt.dataelements.v2+xml, application/xml',
      },
    });
    if (dataElementResponse.status === 200) {
      return dataElementResponse;
    }
  } catch (_error) {
    // Continue to next attempt
  }

  // Try table type
  try {
    const tableTypeUrl = `/sap/bc/adt/ddic/tabletypes/${encodedName}`;
    const tableTypeResponse = await connection.makeAdtRequest({
      url: tableTypeUrl,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'application/vnd.sap.adt.tabletypes.v2+xml, application/xml',
      },
    });
    if (tableTypeResponse.status === 200) {
      return tableTypeResponse;
    }
  } catch (_error) {
    // Continue to fallback
  }

  // Fallback: use object properties endpoint
  const domainUri = encodeURIComponent(
    `/sap/bc/adt/ddic/domains/${encodedName}`,
  );
  const fallbackUrl = `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${domainUri}`;

  return connection.makeAdtRequest({
    url: fallbackUrl,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.objectproperties+xml, application/xml',
    },
  });
}
