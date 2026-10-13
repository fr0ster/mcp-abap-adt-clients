/**
 * FunctionInclude (FUGR/I) source read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_SOURCE } from '../../constants/contentTypes';
import { FUNCTION_INCLUDE, sourceUri } from '../../endpoints/objects';

/**
 * Read function include source code.
 */
export async function readFunctionIncludeSource(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  version: 'active' | 'inactive' = 'active',
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(FUNCTION_INCLUDE.uri(groupName, includeName))}?version=${encodeURIComponent(version)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: ACCEPT_SOURCE,
    },
  });
}
