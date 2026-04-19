/**
 * AuthorizationField (SUSO / AUTH) read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_AUTHORIZATION_FIELD } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export interface IReadOptions {
  withLongPolling?: boolean;
}

/**
 * Read an authorization field (metadata-only, no source).
 */
export async function readAuthorizationField(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
  options?: IReadOptions,
): Promise<AxiosResponse> {
  if (!name) {
    throw new Error('Authorization field name is required');
  }

  const encoded = encodeSapObjectName(name.toUpperCase());
  const params = new URLSearchParams();
  params.append('version', version);
  if (options?.withLongPolling) {
    params.append('withLongPolling', 'true');
  }
  const url = `/sap/bc/adt/aps/iam/auth/${encoded}?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_AUTHORIZATION_FIELD,
    },
  });
}
