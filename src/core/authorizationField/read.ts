/**
 * AuthorizationField (SUSO / AUTH) read operations
 */

import type { IReadOptions } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_AUTHORIZATION_FIELD } from '../../constants/contentTypes';
import { AUTHORIZATION_FIELD } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

// Declared once, in the contract — see core/functionInclude/read.ts.
export type { IReadOptions } from '@mcp-abap-adt/interfaces-adt';

/**
 * Read an authorization field (metadata-only, no source).
 */
export async function readAuthorizationField(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const params = new URLSearchParams();
  params.append('version', version);
  if (options?.withLongPolling) {
    params.append('withLongPolling', 'true');
  }
  const url = `${AUTHORIZATION_FIELD.uri(name)}?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_AUTHORIZATION_FIELD,
    },
  });
}
