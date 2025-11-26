/**
 * ServiceDefinition update operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { UpdateServiceDefinitionParams } from './types';

/**
 * Update service definition source code
 * Requires object to be locked first (lockHandle must be provided)
 */
export async function updateServiceDefinition(
  connection: AbapConnection,
  args: UpdateServiceDefinitionParams,
  lockHandle: string
): Promise<AxiosResponse> {
  const serviceDefinitionNameEncoded = encodeSapObjectName(args.service_definition_name.toLowerCase());

  const corrNrParam = args.transport_request ? `&corrNr=${args.transport_request}` : '';
  const url = `/sap/bc/adt/ddic/srvd/sources/${serviceDefinitionNameEncoded}/source/main?lockHandle=${lockHandle}${corrNrParam}`;

  const headers: Record<string, string> = {
    'Accept': 'text/plain',
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers
  });
}

