import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
/**
 * FunctionInclude (FUGR/I) source read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_SOURCE } from '../../constants/contentTypes';
import { FUNCTION_INCLUDE, sourceUri } from '../../endpoints/objects';
import { readQuery } from '../shared/readQuery';

/**
 * Read function include source code.
 */
export async function readFunctionIncludeSource(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  version?: AdtReadVersion,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(FUNCTION_INCLUDE.uri(groupName, includeName))}${readQuery(version, undefined)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: ACCEPT_SOURCE,
    },
  });
}
