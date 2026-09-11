/**
 * AuthorizationField (SUSO / AUTH) read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  IReadOptions,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_AUTHORIZATION_FIELD } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

// Declared once, in the contract — see core/functionInclude/read.ts.
export type { IReadOptions } from '@mcp-abap-adt/interfaces';

/**
 * Read an authorization field (metadata-only, no source).
 */
export async function readAuthorizationField(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
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
