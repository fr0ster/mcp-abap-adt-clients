/**
 * AuthorizationField (SUSO / AUTH) read operations
 */

import type {
  AdtReadVersion,
  IReadOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_AUTHORIZATION_FIELD } from '../../constants/contentTypes';
import { AUTHORIZATION_FIELD } from '../../endpoints/objects';
import { readQuery } from '../shared/readQuery';

// Declared once, in the contract — see core/functionInclude/read.ts.
export type { IReadOptions } from '@mcp-abap-adt/interfaces-adt';

/**
 * Read an authorization field (metadata-only, no source).
 */
export async function readAuthorizationField(
  connection: IAbapConnection,
  name: string,
  version?: AdtReadVersion,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const url = `${AUTHORIZATION_FIELD.uri(name)}${readQuery(version, options?.withLongPolling)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_AUTHORIZATION_FIELD,
    },
  });
}
