/**
 * ServiceDefinition update operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateServiceDefinitionParams } from './types';

/**
 * Update service definition source code
 * Requires object to be locked first (lockHandle must be provided)
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateServiceDefinition(
  connection: IAbapConnection,
  args: IUpdateServiceDefinitionParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const serviceDefinitionNameEncoded = encodeSapObjectName(
    args.service_definition_name.toLowerCase(),
  );

  const url = `/sap/bc/adt/ddic/srvd/sources/${serviceDefinitionNameEncoded}/source/main${writeQuery(lockHandle, args.transport_request)}`;

  const headers: Record<string, string> = {
    Accept: ACCEPT_SOURCE,
    'Content-Type': CT_SOURCE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers,
  });
}
