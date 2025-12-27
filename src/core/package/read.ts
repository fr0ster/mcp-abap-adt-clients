/**
 * Package read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

/**
 * Get ABAP package
 */
export async function getPackage(
  connection: IAbapConnection,
  packageName: string,
  version: 'active' | 'inactive' = 'active',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(packageName);
  const longPollingQuery = options?.withLongPolling
    ? '&withLongPolling=true'
    : '';
  const url = `/sap/bc/adt/packages/${encodedName}?version=${version}${longPollingQuery}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept:
          options?.accept ??
          'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
      },
    },
    { logger },
  );
}

/**
 * Get transport request for ABAP package
 * @param connection - SAP connection
 * @param packageName - Package name
 * @returns Transport request information
 */
export async function getPackageTransport(
  connection: IAbapConnection,
  packageName: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(packageName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/packages/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept:
        options?.accept ?? 'application/vnd.sap.adt.transportorganizer.v1+xml',
    },
  });
}

/**
 * Get package contents (list of objects in package)
 *
 * Uses node structure endpoint to get all objects in a package.
 *
 * @param connection - ABAP connection instance
 * @param packageName - Package name
 * @returns Axios response with XML containing package contents
 *
 * @example
 * ```typescript
 * const response = await getPackageContents(connection, 'ZMY_PACKAGE');
 * // Response contains XML with objects in the package
 * ```
 */
export async function getPackageContents(
  connection: IAbapConnection,
  packageName: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/repository/nodestructure`;

  const params = {
    parent_type: 'DEVC/K',
    parent_name: packageName,
    withShortDescriptions: true,
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept:
        'application/vnd.sap.adt.repository.nodestructure.v1+xml, application/xml',
    },
  });
}
