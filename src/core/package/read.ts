/**
 * Package read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { ACCEPT_PACKAGE, ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { PACKAGE, transportUri } from '../../endpoints/objects';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
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
): Promise<IAdtWireResponse> {
  const longPollingQuery = options?.withLongPolling
    ? '&withLongPolling=true'
    : '';
  const url = `${PACKAGE.uri(packageName)}?version=${version}${longPollingQuery}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? ACCEPT_PACKAGE,
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
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(PACKAGE.uri(packageName))}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
