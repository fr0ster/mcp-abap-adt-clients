/**
 * FunctionInclude (FUGR/I) read operations
 */

import type {
  AdtReadVersion,
  IReadOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_FUNCTION_INCLUDE } from '../../constants/contentTypes';
import { FUNCTION_INCLUDE } from '../../endpoints/objects';
import { readQuery } from '../shared/readQuery';

// Declared once, in the contract. The copy here carried only
// `withLongPolling`, while `accept` is read in 54 places and `version` in 16 —
// a second type under the same name, narrower by omission rather than by intent.
export type { IReadOptions } from '@mcp-abap-adt/interfaces-adt';

/**
 * Read a function include (metadata only, no source).
 */
export async function readFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  version?: AdtReadVersion,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const url = `${FUNCTION_INCLUDE.uri(groupName, includeName)}${readQuery(version, options?.withLongPolling)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_FUNCTION_INCLUDE,
    },
  });
}
